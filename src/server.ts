/**
 * Xandeum Explorer - Clean, Simple Backend
 * Single file, no over-engineering
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import axios from "axios";
import { z } from "zod";
import OpenAI from "openai";

// ============================================
// Configuration
// ============================================

const PORT = parseInt(process.env.PORT || "3000", 10);
const BOOTSTRAP_URL = process.env.BOOTSTRAP_NODE_URL || "http://173.212.207.32:6000/rpc";
const SYNC_INTERVAL = 60_000; // 60 seconds

// OpenRouter AI
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  defaultHeaders: { "HTTP-Referer": "https://xandeum.network" },
});
const AI_MODEL = process.env.AI_MODEL || "meta-llama/llama-3.2-3b-instruct:free";

// ============================================
// Types & Schemas
// ============================================

interface GeoLocation {
  country: string;
  city: string;
  lat: number;
  lon: number;
}

interface NodeStats {
  cpu_percent: number;
  ram_used: number;
  ram_total: number;
  uptime: number;
  packets_sent: number;
  packets_received: number;
  active_streams: number;
  total_pages: number;
  file_size: number;
  total_bytes: number;
}

interface Node {
  ip: string;
  address: string;
  version: string | null;
  pubkey: string | null;
  status: "Online" | "Offline" | "Unknown";
  lastSeen: Date | null;
  lastSeenTimestamp: number | null;
  stats: NodeStats | null;
  geo: GeoLocation | null;
  derived: {
    health_score: number;
    ram_percent: number;
    ram_usage_percent?: number;
    uptime_human: string;
  } | null;
}

const PodSchema = z.object({
  address: z.string(),
  version: z.string().optional(),
  pubkey: z.string().nullable().optional(),
  last_seen_timestamp: z.number().optional(),
});

const StatsSchema = z.object({
  cpu_percent: z.number().optional().default(0),
  ram_used: z.number().optional().default(0),
  ram_total: z.number().optional().default(0),
  uptime: z.number().optional().default(0),
  packets_sent: z.number().optional().default(0),
  packets_received: z.number().optional().default(0),
  active_streams: z.number().optional().default(0),
  total_pages: z.number().optional().default(0),
  file_size: z.number().optional().default(0),
  total_bytes: z.number().optional().default(0),
});

// ============================================
// In-Memory Store
// ============================================

const nodeCache = new Map<string, Node>();
let lastSyncTime: Date | null = null;
let isSyncing = false;

// Consolidate nodes by pubkey (fallback to IP) to avoid double-counting
function consolidatedNodes(): Node[] {
  const grouped = new Map<string, Node & { ips?: string[] }>();
  for (const node of nodeCache.values()) {
    const key = node.pubkey || node.ip;
    const existing = grouped.get(key);
    const ramPercent = node.derived?.ram_percent ?? 0;
    const derived = node.derived ? {
      ...node.derived,
      ram_usage_percent: node.derived.ram_usage_percent ?? node.derived.ram_percent,
    } : null;

    if (!existing) {
      grouped.set(key, { ...node, derived, ips: [node.ip] });
      continue;
    }

    // Pick the better node: Online > Unknown > Offline; then latest lastSeenTimestamp
    const statusRank = (s: string) => (s === "Online" ? 2 : s === "Unknown" ? 1 : 0);
    const existingRank = statusRank(existing.status);
    const currentRank = statusRank(node.status);
    const existingTs = existing.lastSeenTimestamp || 0;
    const currentTs = node.lastSeenTimestamp || 0;

    const preferCurrent = currentRank > existingRank || (currentRank === existingRank && currentTs > existingTs);
    if (preferCurrent) {
      grouped.set(key, { ...node, derived: { ...derived, ram_usage_percent: derived?.ram_usage_percent ?? ramPercent }, ips: [...(existing.ips || []), node.ip] });
    } else {
      // keep existing but track IP list
      grouped.set(key, { ...existing, ips: [...(existing.ips || []), node.ip] });
    }
  }
  return Array.from(grouped.values());
}

// ============================================
// Helpers
// ============================================

function log(level: string, msg: string, data?: object) {
  const ts = new Date().toISOString();
  const prefix = level === "ERROR" ? "❌" : level === "WARN" ? "⚠️" : "📡";
  console.log(`[${level}] ${ts} ${prefix} ${msg}`, data ? JSON.stringify(data) : "");
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function extractIp(address: string): string {
  return address.split(":")[0];
}

function calculateHealth(stats: NodeStats | null, isOnline: boolean): number {
  if (!isOnline || !stats) return 0;
  
  let score = 50; // Base for being online
  
  // CPU (lower is better)
  if (stats.cpu_percent <= 30) score += 20;
  else if (stats.cpu_percent <= 50) score += 15;
  else if (stats.cpu_percent <= 70) score += 10;
  else if (stats.cpu_percent <= 85) score += 5;
  
  // RAM
  const ramPercent = stats.ram_total > 0 ? (stats.ram_used / stats.ram_total) * 100 : 0;
  if (ramPercent <= 50) score += 15;
  else if (ramPercent <= 70) score += 10;
  else if (ramPercent <= 85) score += 5;
  
  // Uptime
  const uptimeHours = stats.uptime / 3600;
  if (uptimeHours >= 168) score += 15;
  else if (uptimeHours >= 72) score += 10;
  else if (uptimeHours >= 24) score += 5;
  
  return Math.min(100, score);
}

// ============================================
// Network Calls
// ============================================

async function fetchPods(): Promise<z.infer<typeof PodSchema>[]> {
  const response = await axios.post(BOOTSTRAP_URL, {
    jsonrpc: "2.0", id: 1, method: "get-pods", params: []
  }, { timeout: 5000 });
  
  if (response.data.error) throw new Error(response.data.error.message);
  
  const result = z.object({ pods: PodSchema.array() }).safeParse(response.data.result);
  if (!result.success) throw new Error("Invalid pods response");
  
  return result.data.pods;
}

async function fetchNodeStats(ip: string): Promise<NodeStats | null> {
  try {
    const response = await axios.post(`http://${ip}:6000/rpc`, {
      jsonrpc: "2.0", id: 1, method: "get-stats", params: []
    }, { timeout: 3000 });
    
    if (response.data.error) return null;
    
    const result = StatsSchema.safeParse(response.data.result);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function fetchGeo(ips: string[]): Promise<Map<string, GeoLocation>> {
  const results = new Map<string, GeoLocation>();
  
  try {
    const response = await axios.post(
      "http://ip-api.com/batch?fields=query,status,country,city,lat,lon",
      ips.slice(0, 100).map(ip => ({ query: ip })),
      { timeout: 10000 }
    );
    
    for (const item of response.data) {
      if (item.status === "success") {
        results.set(item.query, {
          country: item.country,
          city: item.city,
          lat: item.lat,
          lon: item.lon,
        });
      }
    }
  } catch (err) {
    log("WARN", "Geo lookup failed");
  }
  
  return results;
}

// ============================================
// Sync Engine
// ============================================

async function syncNodes() {
  if (isSyncing) return;
  isSyncing = true;
  
  const start = Date.now();
  log("INFO", "Starting sync...");
  
  try {
    // 1. Fetch pods
    const pods = await fetchPods();
    log("INFO", `Got ${pods.length} pods`);
    
    // 2. Deduplicate by IP
    const uniquePods = new Map<string, typeof pods[0]>();
    for (const pod of pods) {
      const ip = extractIp(pod.address);
      if (!uniquePods.has(ip)) uniquePods.set(ip, pod);
    }
    
    // 3. Fetch geo for new IPs
    const newIps = [...uniquePods.keys()].filter(ip => !nodeCache.get(ip)?.geo);
    if (newIps.length > 0) {
      const geoMap = await fetchGeo(newIps);
      for (const [ip, geo] of geoMap) {
        const existing = nodeCache.get(ip);
        if (existing) existing.geo = geo;
      }
    }
    
    // 4. Probe all nodes for stats (parallel with limit)
    const ips = [...uniquePods.keys()];
    const BATCH = 30;
    let online = 0, offline = 0;
    
    for (let i = 0; i < ips.length; i += BATCH) {
      const batch = ips.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async ip => {
        const stats = await fetchNodeStats(ip);
        return { ip, stats };
      }));
      
      for (const { ip, stats } of results) {
        const pod = uniquePods.get(ip)!;
        const existing = nodeCache.get(ip);
        const isOnline = stats !== null;
        
        const ramPercent = stats && stats.ram_total > 0 
          ? (stats.ram_used / stats.ram_total) * 100 
          : 0;
        
        const node: Node = {
          ip,
          address: pod.address,
          version: pod.version || null,
          pubkey: pod.pubkey || null,
          status: isOnline ? "Online" : "Offline",
          lastSeen: isOnline ? new Date() : existing?.lastSeen || null,
          lastSeenTimestamp: pod.last_seen_timestamp || null,
          stats,
          geo: existing?.geo || null,
          derived: isOnline ? {
            health_score: calculateHealth(stats, true),
            ram_percent: Math.round(ramPercent * 100) / 100,
            ram_usage_percent: Math.round(ramPercent * 100) / 100,
            uptime_human: formatUptime(stats?.uptime || 0),
          } : null,
        };
        
        nodeCache.set(ip, node);
        isOnline ? online++ : offline++;
      }
    }
    
    lastSyncTime = new Date();
    log("INFO", "Sync complete", { 
      total: uniquePods.size, 
      online, 
      offline, 
      ms: Date.now() - start 
    });
    
  } catch (err) {
    log("ERROR", "Sync failed", { error: (err as Error).message });
  } finally {
    isSyncing = false;
  }
}

// ============================================
// API Server
// ============================================

const app = new Hono();
app.use("/*", cors());

// Root
app.get("/", (c) => c.json({
  name: "Xandeum Explorer API",
  version: "1.0.0",
  endpoints: ["/pnodes", "/stats", "/pnodes/:ip", "/ai/search", "/ai/diagnose", "/ai/briefing"]
}));

// Health check
app.get("/health", (c) => c.json({
  status: "ok",
  nodes: nodeCache.size,
  lastSync: lastSyncTime?.toISOString() || null,
}));

// ============================================
// Node Endpoints (matches frontend expectations)
// ============================================

app.get("/pnodes", (c) => {
  const nodes = consolidatedNodes();
  const onlineNodes = nodes.filter(n => n.status === "Online");
  
  // Aggregates
  const totalRam = onlineNodes.reduce((acc, n) => acc + (n.stats?.ram_total || 0), 0);
  const usedRam = onlineNodes.reduce((acc, n) => acc + (n.stats?.ram_used || 0), 0);
  const avgHealth = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
    : 0;
  const avgCpu = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / onlineNodes.length
    : 0;
  const avgRamPercent = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.ram_percent || 0), 0) / onlineNodes.length
    : 0;
  const avgUptimeSeconds = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / onlineNodes.length
    : 0;
  
  return c.json({
    meta: {
      total_nodes: nodes.length,
      online_nodes: onlineNodes.length,
      offline_nodes: nodes.filter(n => n.status === "Offline").length,
      unknown_nodes: nodes.filter(n => n.status === "Unknown").length,
      last_sync: lastSyncTime?.toISOString() || null,
      ram: {
        total_bytes: totalRam,
        used_bytes: usedRam,
        total_human: formatBytes(totalRam),
        used_human: formatBytes(usedRam),
        utilization_percent: totalRam > 0 ? Math.round((usedRam / totalRam) * 1000) / 10 : 0,
      },
      storage: {
        total_pages: onlineNodes.reduce((acc, n) => acc + (n.stats?.total_pages || 0), 0),
        nodes_reporting: onlineNodes.filter(n => (n.stats?.total_pages || 0) > 0).length,
      },
      traffic: {
        total_packets_sent: onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_sent || 0), 0),
        total_packets_received: onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_received || 0), 0),
        total_packets: onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_sent || 0) + (n.stats?.packets_received || 0), 0),
      },
      health: {
        avg_cpu_percent: Math.round(avgCpu * 10) / 10,
        avg_ram_percent: Math.round(avgRamPercent * 10) / 10,
        avg_health_score: Math.round(avgHealth),
        avg_uptime_seconds: Math.round(avgUptimeSeconds),
        avg_uptime_human: formatUptime(avgUptimeSeconds),
      }
    },
    nodes: nodes.map(n => ({
      ...n,
      stats_formatted: n.stats ? {
        cpu: typeof n.stats.cpu_percent === "number" ? `${n.stats.cpu_percent.toFixed(1)}%` : "N/A",
        ram: `${formatBytes(n.stats.ram_used || 0)} / ${formatBytes(n.stats.ram_total || 0)}`,
        uptime: n.derived?.uptime_human || "N/A",
        packets: `↑${(n.stats.packets_sent || 0).toLocaleString()} ↓${(n.stats.packets_received || 0).toLocaleString()}`,
      } : null,
    })),
  });
});

app.get("/pnodes/:ip", (c) => {
  const ip = decodeURIComponent(c.req.param("ip"));
  const node = nodeCache.get(ip);
  
  if (!node) return c.json({ error: "Node not found" }, 404);
  
  return c.json({ node, fetched_at: new Date().toISOString() });
});

app.get("/stats", (c) => {
  const nodes = consolidatedNodes();
  const onlineNodes = nodes.filter(n => n.status === "Online");
  
  // Distributions
  const versions: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const healthBuckets = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
  
  for (const n of nodes) {
    versions[n.version || "Unknown"] = (versions[n.version || "Unknown"] || 0) + 1;
    if (n.geo?.country) countries[n.geo.country] = (countries[n.geo.country] || 0) + 1;
    
    if (n.status === "Online") {
      const h = n.derived?.health_score || 0;
      if (h >= 80) healthBuckets.Excellent++;
      else if (h >= 60) healthBuckets.Good++;
      else if (h >= 40) healthBuckets.Fair++;
      else healthBuckets.Poor++;
    }
  }
  
  const avgHealth = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
    : 0;
  const avgCpu = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / onlineNodes.length
    : 0;
  const avgRamPercent = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.ram_percent || 0), 0) / onlineNodes.length
    : 0;
  const avgUptimeSeconds = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / onlineNodes.length
    : 0;
  const maxUptimeSeconds = onlineNodes.reduce((max, n) => Math.max(max, n.stats?.uptime || 0), 0);
  const totalRam = onlineNodes.reduce((acc, n) => acc + (n.stats?.ram_total || 0), 0);
  const usedRam = onlineNodes.reduce((acc, n) => acc + (n.stats?.ram_used || 0), 0);
  
  const onlinePercent = nodes.length > 0 ? (onlineNodes.length / nodes.length) * 100 : 0;
  
  return c.json({
    network: {
      total_nodes: nodes.length,
      online_nodes: onlineNodes.length,
      offline_nodes: nodes.length - onlineNodes.length,
      online_percent: Math.round(onlinePercent * 10) / 10,
      network_score: Math.round((onlinePercent * 0.5) + (avgHealth * 0.5)),
      unique_countries: Object.keys(countries).length,
      unique_versions: Object.keys(versions).length,
      last_sync: lastSyncTime?.toISOString() || null,
    },
    uptime: {
      avg_seconds: Math.round(avgUptimeSeconds),
      avg_human: formatUptime(avgUptimeSeconds),
      max_seconds: Math.round(maxUptimeSeconds),
      max_human: formatUptime(maxUptimeSeconds),
    },
    ram: {
      total_bytes: totalRam,
      used_bytes: usedRam,
      total_human: formatBytes(totalRam),
      used_human: formatBytes(usedRam),
      utilization_percent: totalRam > 0 ? Math.round((usedRam / totalRam) * 1000) / 10 : 0,
    },
    performance: {
      avg_cpu_percent: Math.round(avgCpu * 10) / 10,
      avg_ram_percent: Math.round(avgRamPercent * 10) / 10,
      avg_health_score: Math.round(avgHealth),
    },
    versions,
    countries,
    health_distribution: healthBuckets,
    status_distribution: {
      Online: onlineNodes.length,
      Offline: nodes.length - onlineNodes.length,
      Unknown: nodes.filter(n => n.status === "Unknown").length,
    },
  });
});

// Map markers
app.get("/map", (c) => {
  const markers = consolidatedNodes()
    .filter(n => n.geo?.lat && n.geo?.lon)
    .map(n => ({
      ip: n.ip,
      lat: n.geo!.lat,
      lon: n.geo!.lon,
      status: n.status,
      country: n.geo!.country,
      city: n.geo!.city,
      health: n.derived?.healthScore || 0,
    }));
  
  return c.json({ markers, total: markers.length });
});

// ============================================
// AI Endpoints
// ============================================

app.post("/ai/search", async (c) => {
  const { query } = await c.req.json();
  if (!query) return c.json({ error: "Query required" }, 400);
  
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: `Convert search to JSON filter. Keys: country, status (Online/Offline), minHealthScore (0-100). Return only JSON.` },
        { role: "user", content: query }
      ],
      temperature: 0.1,
      max_tokens: 100,
    });
    
    const text = completion.choices[0]?.message?.content || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const filter = match ? JSON.parse(match[0]) : {};
    
    // Apply filter
    let results = consolidatedNodes();
    if (filter.country) results = results.filter(n => n.geo?.country?.toLowerCase().includes(filter.country.toLowerCase()));
    if (filter.status) results = results.filter(n => n.status === filter.status);
    if (filter.minHealthScore) results = results.filter(n => (n.derived?.health_score || 0) >= filter.minHealthScore);
    
    return c.json({
      query,
      filter,
      total: results.length,
      nodes: results.slice(0, 20).map(n => ({
        ip: n.ip,
        country: n.geo?.country || "Unknown",
        status: n.status,
        health: n.derived?.health_score || 0,
      })),
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.post("/ai/diagnose", async (c) => {
  const { ip } = await c.req.json();
  const node = nodeCache.get(ip);
  if (!node) return c.json({ error: "Node not found" }, 404);
  
  const onlineNodes = Array.from(nodeCache.values()).filter(n => n.status === "Online");
  const avgCpu = onlineNodes.reduce((a, n) => a + (n.stats?.cpu_percent || 0), 0) / onlineNodes.length;
  const avgRam = onlineNodes.reduce((a, n) => a + (n.derived?.ramPercent || 0), 0) / onlineNodes.length;
  
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: `Diagnose node health. Return JSON: { "status": "Healthy|Warning|Critical", "summary": "brief", "recommendations": ["list"] }` },
        { role: "user", content: `Node ${ip}: CPU ${node.stats?.cpu_percent || 0}% (avg ${avgCpu.toFixed(1)}%), RAM ${node.derived?.ramPercent || 0}% (avg ${avgRam.toFixed(1)}%), Uptime ${node.derived?.uptimeHuman}, Status ${node.status}` }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });
    
    const text = completion.choices[0]?.message?.content || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const diagnosis = match ? JSON.parse(match[0]) : { status: "Unknown", summary: "Analysis failed", recommendations: [] };
    
    return c.json({ ip, diagnosis, node_stats: node.stats, derived: node.derived });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.get("/ai/briefing", async (c) => {
  const nodes = consolidatedNodes();
  const online = nodes.filter(n => n.status === "Online").length;
  const topCountry = Object.entries(
    nodes.reduce((acc, n) => { 
      if (n.geo?.country) acc[n.geo.country] = (acc[n.geo.country] || 0) + 1; 
      return acc; 
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0];
  
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: `Write 3 bullet points about network status. Return JSON: { "headline": "5 words", "bullets": ["point1", "point2", "point3"] }` },
        { role: "user", content: `${nodes.length} total nodes, ${online} online (${((online/nodes.length)*100).toFixed(0)}%), top country: ${topCountry?.[0] || "Unknown"} (${topCountry?.[1] || 0} nodes)` }
      ],
      temperature: 0.5,
      max_tokens: 200,
    });
    
    const text = completion.choices[0]?.message?.content || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const briefing = match ? JSON.parse(match[0]) : { headline: "Network Update", bullets: [`${online} nodes online`] };
    
    return c.json({ ...briefing, generated_at: new Date().toISOString() });
  } catch (err) {
    return c.json({
      headline: "Network Status",
      bullets: [`${online} of ${nodes.length} nodes online`, `Top region: ${topCountry?.[0] || "Unknown"}`],
      generated_at: new Date().toISOString(),
    });
  }
});

app.post("/ai/query", async (c) => {
  const { question } = await c.req.json();
  if (!question) return c.json({ error: "Question required" }, 400);
  
  const nodes = consolidatedNodes();
  const online = nodes.filter(n => n.status === "Online");
  const countries = nodes.reduce((acc, n) => {
    if (n.geo?.country) acc[n.geo.country] = (acc[n.geo.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const countryNames = Object.keys(countries);

  // Simple country detection from question
  const normalizedQ = question.toLowerCase();
  const matchedCountry = countryNames.find(c => normalizedQ.includes(c.toLowerCase()));
  const countryCount = matchedCountry ? countries[matchedCountry] : null;

  const dataSnapshot = {
    total_nodes: nodes.length,
    online_nodes: online.length,
    network_score: nodes.length > 0 ? Math.round(((online.length / nodes.length) * 50) + 50) : 0,
    countries_count: countryNames.length,
    country_breakdown: countries,
    matched_country: matchedCountry || "Unknown",
    matched_country_count: countryCount,
  };

  // Deterministic answer if no API key
  if (!process.env.OPENROUTER_API_KEY) {
    const base = `${online.length} of ${nodes.length} nodes are online across ${countryNames.length} countries.`;
    const countryLine = matchedCountry
      ? `${matchedCountry} currently has ${countryCount} node${countryCount === 1 ? "" : "s"}.`
      : "No specific country was detected in your question.";
    return c.json({
      question,
      answer: `${base} ${countryLine}`.trim(),
      data_snapshot: dataSnapshot,
      generated_at: new Date().toISOString(),
    });
  }
  
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: "You are a precise analyst. Use ONLY the provided data. Always include numeric counts when available. If the user asks about a country, use the supplied counts; never guess." },
        { role: "user", content: `Data: ${JSON.stringify(dataSnapshot)}. Question: ${question}` }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });
    
    return c.json({
      question,
      answer: completion.choices[0]?.message?.content || "Unable to answer",
      data_snapshot: dataSnapshot,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ============================================
// Start
// ============================================

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Xandeum Explorer
   http://localhost:${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Initial sync after 3 seconds
setTimeout(syncNodes, 3000);

// Periodic sync
setInterval(syncNodes, SYNC_INTERVAL);

serve({ fetch: app.fetch, port: PORT });
