import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import axios from "axios";
import { z } from "zod";
import { 
  openai, 
  AI_MODEL, 
  SEARCH_SYSTEM_PROMPT, 
  DIAGNOSE_SYSTEM_PROMPT, 
  BRIEFING_SYSTEM_PROMPT,
  QUERY_SYSTEM_PROMPT,
  SearchFilter,
  DiagnosisResult,
  BriefingResult
} from "./lib/ai";

// --- Configuration ---
const PORT = 3000;
const BOOTSTRAP_NODE_URL = "http://173.212.207.32:6000/rpc";

// --- In-Memory Database ---
let nodeCache: Map<string, EnrichedNode> = new Map();
let lastSyncTime: Date | null = null;
let isSyncing = false;

// --- AI Briefing Cache ---
let briefingCache: { data: BriefingResult | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const BRIEFING_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// --- Schemas & Types ---
interface GeoLocation {
  country: string;
  city: string;
  lat: number;
  lon: number;
}

// Extended Pod Schema to capture pubkey from gossip
const PodSchema = z.object({
  address: z.string(),
  version: z.string().optional(),
  pubkey: z.string().nullable().optional(),
  last_seen_timestamp: z.number().optional(),
});

const GetPodsResultSchema = z.object({
  pods: PodSchema.array(),
  total_count: z.number().optional(),
});

// Comprehensive Stats Schema - captures ALL pNode metrics
const StatsSchema = z.object({
  // Network Activity
  active_streams: z.number().optional().default(0),
  packets_received: z.number().optional().default(0),
  packets_sent: z.number().optional().default(0),
  
  // Storage Metrics - Note: total_pages represents storage capacity units
  file_size: z.number().optional().default(0),        // Current data stored
  total_bytes: z.number().optional().default(0),       // Total bytes tracked in current session
  total_pages: z.number().optional().default(0),       // Storage pages allocated
  current_index: z.number().optional().default(0),
  
  // Hardware Metrics
  cpu_percent: z.number().optional().default(0),
  ram_used: z.number().optional().default(0),
  ram_total: z.number().optional().default(0),
  
  // System
  uptime: z.number().optional().default(0),
  last_updated: z.number().optional(),
  
  // Additional fields some nodes may report
  disk_total: z.number().optional(),
  disk_used: z.number().optional(),
  disk_free: z.number().optional(),
});

type NodeStats = z.infer<typeof StatsSchema>;

// Enriched Node with derived metrics
interface EnrichedNode {
  ip: string;
  address: string;
  version: string | undefined;
  pubkey: string | null | undefined;
  status: "Online" | "Offline" | "Unknown";
  lastSeen: Date | null;
  lastSeenTimestamp: number | null;
  stats: NodeStats | null;
  geo: GeoLocation | null;
  // Derived metrics
  derived: {
    storage_utilization_percent: number;
    ram_usage_percent: number;
    uptime_human: string;
    packets_per_second: number;
    health_score: number; // 0-100 composite score
  } | null;
}

// --- Helper Functions ---

// Format uptime seconds to human readable
function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`); // Only show minutes if < 1 day
  
  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

// Calculate derived metrics for a node
function calculateDerivedMetrics(stats: NodeStats | null, isOnline: boolean = true): EnrichedNode["derived"] {
  if (!stats) return null;
  
  // RAM usage percentage
  const ramUsage = stats.ram_total > 0 
    ? (stats.ram_used / stats.ram_total) * 100 
    : 0;
  
  // Packets per second (approximation based on uptime)
  const totalPackets = stats.packets_sent + stats.packets_received;
  const packetsPerSec = stats.uptime > 0 ? totalPackets / stats.uptime : 0;
  
  // Health score calculation - more nuanced scoring
  let healthScore = 0;
  
  if (!isOnline) {
    // Offline nodes get 0 health
    healthScore = 0;
  } else {
    // Start with base score for being online
    healthScore = 50;
    
    // CPU scoring (up to +20 points)
    if (stats.cpu_percent <= 30) healthScore += 20;
    else if (stats.cpu_percent <= 50) healthScore += 15;
    else if (stats.cpu_percent <= 70) healthScore += 10;
    else if (stats.cpu_percent <= 85) healthScore += 5;
    // Above 85% = 0 additional points
    
    // RAM scoring (up to +15 points)
    if (ramUsage <= 50) healthScore += 15;
    else if (ramUsage <= 70) healthScore += 10;
    else if (ramUsage <= 85) healthScore += 5;
    // Above 85% = 0 additional points
    
    // Uptime scoring (up to +15 points)
    const uptimeHours = stats.uptime / 3600;
    if (uptimeHours >= 168) healthScore += 15; // 7+ days
    else if (uptimeHours >= 72) healthScore += 12; // 3+ days
    else if (uptimeHours >= 24) healthScore += 8; // 1+ day
    else if (uptimeHours >= 1) healthScore += 4; // 1+ hour
    // Less than 1 hour = 0 additional points
    
    // Network activity bonus (optional, shows node is working)
    if (stats.active_streams > 0) healthScore = Math.min(healthScore + 2, 100);
    if (totalPackets > 1000) healthScore = Math.min(healthScore + 3, 100);
  }
  
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  return {
    storage_utilization_percent: 0, // We'll calculate network-wide storage differently
    ram_usage_percent: Math.round(ramUsage * 100) / 100,
    uptime_human: formatUptime(stats.uptime),
    packets_per_second: Math.round(packetsPerSec * 100) / 100,
    health_score: healthScore,
  };
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// --- Helper Functions ---

async function callPrpc<T>(method: string, params: unknown[] = [], url: string): Promise<T> {
  try {
    const response = await axios.post(
      url,
      { jsonrpc: "2.0", id: 1, method, params },
      { headers: { "content-type": "application/json" }, timeout: 3000 } 
    );
    if (response.data.error) throw new Error(response.data.error.message);
    return response.data.result as T;
  } catch (error) {
    throw error;
  }
}

// Batch Fetch Geolocation (Chunks of 100)
async function fetchGeoBatch(ips: string[]): Promise<Map<string, GeoLocation>> {
  const results = new Map<string, GeoLocation>();
  const uniqueIps = [...new Set(ips)]; // Remove duplicates
  
  // Create chunks of 100 (API limit)
  const chunks = [];
  for (let i = 0; i < uniqueIps.length; i += 100) {
    chunks.push(uniqueIps.slice(i, i + 100));
  }

  console.log(`🌍 Geo: Resolving locations for ${uniqueIps.length} IPs...`);

  for (const chunk of chunks) {
    try {
      // ip-api.com batch endpoint
      const response = await axios.post(
        "http://ip-api.com/batch?fields=query,status,country,city,lat,lon",
        chunk.map((ip) => ({ query: ip })),
        { timeout: 10000 }
      );

      response.data.forEach((item: any) => {
        if (item.status === "success") {
          results.set(item.query, {
            country: item.country,
            city: item.city,
            lat: item.lat,
            lon: item.lon
          });
        }
      });
      
      // Sleep 1s to respect rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error("❌ Geo Batch Failed:", error);
    }
  }

  return results;
}

// --- The Crawler Engine ---
async function runCrawler() {
  if (isSyncing) return;
  isSyncing = true;
  console.log("🔄 Crawler: Starting network sync...");

  try {
    // 1. Get the list of all peers from Bootstrap
    const rawPods = await callPrpc<unknown>("get-pods", [], BOOTSTRAP_NODE_URL);
    const parsed = GetPodsResultSchema.safeParse(rawPods);
    
    if (!parsed.success) {
      console.error("❌ Crawler: Failed to fetch pod list");
      isSyncing = false;
      return;
    }

    const pods = parsed.data.pods;
    console.log(`📋 Crawler: Found ${pods.length} nodes in gossip.`);

    // 2. Identify New IPs needing Geolocation
    const ipsToGeolocate: string[] = [];
    pods.forEach(pod => {
      const ip = pod.address.split(':')[0];
      if (ip && !nodeCache.has(ip)) {
        ipsToGeolocate.push(ip);
      } else if (ip && nodeCache.has(ip) && !nodeCache.get(ip)?.geo) {
        ipsToGeolocate.push(ip); // Retry if missing geo
      }
    });

    // 3. Fetch Geolocation for new IPs
    let newGeoMap = new Map<string, GeoLocation>();
    if (ipsToGeolocate.length > 0) {
      newGeoMap = await fetchGeoBatch(ipsToGeolocate);
    }

    // 4. Probe ALL nodes in parallel batches for better coverage
    const BATCH_SIZE = 50; // Probe 50 nodes at a time
    const allResults: { pod: typeof pods[0]; success: boolean; stats: NodeStats | null }[] = [];
    
    console.log(`🔍 Crawler: Probing all ${pods.length} nodes...`);
    
    for (let i = 0; i < pods.length; i += BATCH_SIZE) {
      const batch = pods.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (pod) => {
        const ip = pod.address.split(':')[0];
        if (!ip) return { pod, success: false, stats: null };
        
        const rpcUrl = `http://${ip}:6000/rpc`;
        try {
          const rawStats = await callPrpc<unknown>("get-stats", [], rpcUrl);
          const parsedStats = StatsSchema.safeParse(rawStats);
          return { 
            pod, 
            success: true, 
            stats: parsedStats.success ? parsedStats.data : null 
          };
        } catch {
          return { pod, success: false, stats: null };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
      
      // Progress log
      console.log(`   Probed ${Math.min(i + BATCH_SIZE, pods.length)}/${pods.length} nodes...`);
    }

    // 5. Update Cache with all results
    let onlineCount = 0;
    let offlineCount = 0;
    
    for (const result of allResults) {
      const pod = result.pod;
      const ip = pod.address.split(':')[0];
      if (!ip) continue;
      
      // Get geo from new fetch or existing cache
      const existing = nodeCache.get(ip);
      const geo = newGeoMap.get(ip) || existing?.geo || null;
      
      if (result.success && result.stats) {
        const derived = calculateDerivedMetrics(result.stats, true);
        const enrichedNode: EnrichedNode = {
          ip,
          address: pod.address,
          version: pod.version,
          pubkey: pod.pubkey,
          status: "Online",
          lastSeen: new Date(),
          lastSeenTimestamp: pod.last_seen_timestamp || null,
          stats: result.stats,
          geo,
          derived,
        };
        nodeCache.set(ip, enrichedNode);
        onlineCount++;
      } else {
        // Node is offline but in gossip
        const offlineNode: EnrichedNode = {
          ip,
          address: pod.address,
          version: pod.version,
          pubkey: pod.pubkey,
          status: "Offline",
          lastSeen: existing?.lastSeen || null,
          lastSeenTimestamp: pod.last_seen_timestamp || existing?.lastSeenTimestamp || null,
          stats: existing?.stats || null,
          geo,
          derived: existing?.derived ? { ...existing.derived, health_score: 0 } : null,
        };
        nodeCache.set(ip, offlineNode);
        offlineCount++;
      }
    }

    // 6. Mark nodes not in current gossip as Unknown
    const currentIps = new Set(pods.map(p => p.address.split(':')[0]));
    nodeCache.forEach((node, ip) => {
      if (!currentIps.has(ip) && node.status === "Online") {
        node.status = "Unknown";
      }
    });

    lastSyncTime = new Date();
    console.log(`✅ Crawler: Sync complete. ${onlineCount} online, ${offlineCount} offline. Total cached: ${nodeCache.size}`);

  } catch (err: any) {
    console.error("❌ Crawler Error:", err?.message || err);
  } finally {
    isSyncing = false;
  }
}

// --- API Server ---
const app = new Hono();
app.use("/*", cors());

app.get("/", (c) => c.text("Xandeum Analytics Backend is Active 🟢"));

// Enhanced /pnodes endpoint with derived metrics
app.get("/pnodes", (c) => {
  const nodes = Array.from(nodeCache.values());
  const onlineNodes = nodes.filter(n => n.status === "Online");
  const offlineNodes = nodes.filter(n => n.status === "Offline");
  const unknownNodes = nodes.filter(n => n.status === "Unknown");
  
  // Calculate network-wide RAM (this is meaningful - total RAM capacity of the network)
  const totalRamBytes = onlineNodes.reduce((acc, n) => acc + (n.stats?.ram_total || 0), 0);
  const usedRamBytes = onlineNodes.reduce((acc, n) => acc + (n.stats?.ram_used || 0), 0);
  
  // Network traffic aggregates
  const totalPacketsSent = nodes.reduce((acc, n) => acc + (n.stats?.packets_sent || 0), 0);
  const totalPacketsReceived = nodes.reduce((acc, n) => acc + (n.stats?.packets_received || 0), 0);
  
  // Average metrics (only from online nodes with stats)
  const nodesWithStats = onlineNodes.filter(n => n.stats);
  const avgCpu = nodesWithStats.length > 0 
    ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / nodesWithStats.length 
    : 0;
  const avgRam = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.derived?.ram_usage_percent || 0), 0) / nodesWithStats.length
    : 0;
  const avgHealthScore = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
    : 0;
  
  // Calculate average uptime
  const avgUptimeSeconds = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / nodesWithStats.length
    : 0;
  
  // Get total pages across network (storage capacity indicator)
  const totalPages = nodes.reduce((acc, n) => acc + (n.stats?.total_pages || 0), 0);
  
  return c.json({
    meta: {
      total_nodes: nodes.length,
      online_nodes: onlineNodes.length,
      offline_nodes: offlineNodes.length,
      unknown_nodes: unknownNodes.length,
      last_sync: lastSyncTime,
      // RAM aggregates (this makes sense as actual network capacity)
      ram: {
        total_bytes: totalRamBytes,
        used_bytes: usedRamBytes,
        total_human: formatBytes(totalRamBytes),
        used_human: formatBytes(usedRamBytes),
        utilization_percent: totalRamBytes > 0 
          ? Math.round((usedRamBytes / totalRamBytes) * 10000) / 100 
          : 0,
      },
      // Storage capacity (using total_pages as indicator)
      storage: {
        total_pages: totalPages,
        nodes_reporting: nodesWithStats.length,
      },
      // Network traffic aggregates
      traffic: {
        total_packets_sent: totalPacketsSent,
        total_packets_received: totalPacketsReceived,
        total_packets: totalPacketsSent + totalPacketsReceived,
      },
      // Health aggregates
      health: {
        avg_cpu_percent: Math.round(avgCpu * 100) / 100,
        avg_ram_percent: Math.round(avgRam * 100) / 100,
        avg_health_score: Math.round(avgHealthScore),
        avg_uptime_seconds: Math.round(avgUptimeSeconds),
        avg_uptime_human: formatUptime(avgUptimeSeconds),
      },
    },
    nodes: nodes.map(n => ({
      ...n,
      // Add formatted fields for frontend convenience
      stats_formatted: n.stats ? {
        cpu: `${(n.stats.cpu_percent || 0).toFixed(1)}%`,
        ram: `${formatBytes(n.stats.ram_used || 0)} / ${formatBytes(n.stats.ram_total || 0)}`,
        uptime: n.derived?.uptime_human || "N/A",
        packets: `↑${(n.stats.packets_sent || 0).toLocaleString()} ↓${(n.stats.packets_received || 0).toLocaleString()}`,
        pages: n.stats.total_pages || 0,
      } : null,
    })),
  });
});

// NEW: Get detailed stats for a single node
app.get("/pnodes/:ip", (c) => {
  const ip = c.req.param("ip");
  const node = nodeCache.get(ip);
  
  if (!node) {
    return c.json({ error: "Node not found", ip }, 404);
  }
  
  // Return comprehensive node details
  return c.json({
    node: {
      ...node,
      stats_formatted: node.stats ? {
        // Hardware
        cpu_percent: `${(node.stats.cpu_percent || 0).toFixed(1)}%`,
        ram_used_human: formatBytes(node.stats.ram_used || 0),
        ram_total_human: formatBytes(node.stats.ram_total || 0),
        ram_percent: node.derived?.ram_usage_percent || 0,
        
        // Storage
        file_size_human: formatBytes(node.stats.file_size || 0),
        total_bytes_human: formatBytes(node.stats.total_bytes || 0),
        storage_percent: node.derived?.storage_utilization_percent || 0,
        total_pages: node.stats.total_pages || 0,
        current_index: node.stats.current_index || 0,
        
        // Network
        packets_sent: (node.stats.packets_sent || 0).toLocaleString(),
        packets_received: (node.stats.packets_received || 0).toLocaleString(),
        active_streams: node.stats.active_streams || 0,
        packets_per_second: node.derived?.packets_per_second || 0,
        
        // System
        uptime_seconds: node.stats.uptime || 0,
        uptime_human: node.derived?.uptime_human || "N/A",
        health_score: node.derived?.health_score || 0,
      } : null,
    },
    // Include timestamp for cache invalidation
    fetched_at: new Date().toISOString(),
  });
});

// Enhanced /stats endpoint with comprehensive analytics
app.get("/stats", (c) => {
  const nodes = Array.from(nodeCache.values());
  const onlineNodes = nodes.filter(n => n.status === "Online");
  const nodesWithStats = onlineNodes.filter(n => n.stats);
  
  // Version distribution
  const versionCounts: Record<string, number> = {};
  // Status distribution  
  const statusCounts: Record<string, number> = { Online: 0, Offline: 0, Unknown: 0 };
  // Country distribution
  const countryCounts: Record<string, number> = {};
  // Health distribution (buckets: Excellent 80-100, Good 60-79, Fair 40-59, Poor 0-39)
  const healthBuckets = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };

  nodes.forEach(n => {
    // Count Versions
    const v = n.version || "Unknown";
    versionCounts[v] = (versionCounts[v] || 0) + 1;

    // Count Status
    statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;

    // Count Countries
    if (n.geo?.country) {
      countryCounts[n.geo.country] = (countryCounts[n.geo.country] || 0) + 1;
    }
    
    // Health buckets (only for online nodes)
    if (n.status === "Online") {
      const health = n.derived?.health_score || 0;
      if (health >= 80) healthBuckets.Excellent++;
      else if (health >= 60) healthBuckets.Good++;
      else if (health >= 40) healthBuckets.Fair++;
      else healthBuckets.Poor++;
    }
  });

  // Calculate network uptime (average of all online nodes)
  const avgUptimeSeconds = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / nodesWithStats.length
    : 0;
  
  // Calculate max uptime (longest running node)
  const maxUptimeSeconds = nodesWithStats.length > 0
    ? Math.max(...nodesWithStats.map(n => n.stats?.uptime || 0))
    : 0;
  
  // Network RAM totals
  const totalRamBytes = nodesWithStats.reduce((acc, n) => acc + (n.stats?.ram_total || 0), 0);
  const usedRamBytes = nodesWithStats.reduce((acc, n) => acc + (n.stats?.ram_used || 0), 0);
  
  // Average metrics
  const avgCpu = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / nodesWithStats.length
    : 0;
  const avgRamPercent = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.derived?.ram_usage_percent || 0), 0) / nodesWithStats.length
    : 0;
  const avgHealthScore = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
    : 0;
  
  // Network score (composite of online ratio + average health)
  const onlineRatio = nodes.length > 0 ? (onlineNodes.length / nodes.length) * 100 : 0;
  const networkScore = Math.round((onlineRatio * 0.5) + (avgHealthScore * 0.5));

  return c.json({
    network: {
      total_nodes: nodes.length,
      online_nodes: onlineNodes.length,
      offline_nodes: statusCounts.Offline,
      unknown_nodes: statusCounts.Unknown,
      online_percent: Math.round(onlineRatio * 10) / 10,
      network_score: networkScore,
      unique_countries: Object.keys(countryCounts).length,
      unique_versions: Object.keys(versionCounts).length,
      last_sync: lastSyncTime,
    },
    uptime: {
      avg_seconds: Math.round(avgUptimeSeconds),
      avg_human: formatUptime(avgUptimeSeconds),
      max_seconds: maxUptimeSeconds,
      max_human: formatUptime(maxUptimeSeconds),
    },
    ram: {
      total_bytes: totalRamBytes,
      used_bytes: usedRamBytes,
      total_human: formatBytes(totalRamBytes),
      used_human: formatBytes(usedRamBytes),
      utilization_percent: totalRamBytes > 0 
        ? Math.round((usedRamBytes / totalRamBytes) * 10000) / 100 
        : 0,
    },
    performance: {
      avg_cpu_percent: Math.round(avgCpu * 100) / 100,
      avg_ram_percent: Math.round(avgRamPercent * 100) / 100,
      avg_health_score: Math.round(avgHealthScore),
    },
    versions: versionCounts,
    status_distribution: statusCounts,
    countries: countryCounts,
    health_distribution: healthBuckets,
  });
});

// ===========================
// AI-POWERED ENDPOINTS
// ===========================

// Part 1: Magic Search - Natural Language Filtering with Results
app.post("/ai/search", async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query?.trim();

    if (!query) {
      return c.json({ filter: {}, message: "Empty query", results: [] });
    }

    console.log(`🔮 AI Search: "${query}"`);

    // Call OpenRouter API
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SEARCH_SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 200,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
    
    // Parse JSON from response (handle potential markdown code blocks)
    let filter: SearchFilter = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        filter = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("❌ AI Search: Failed to parse response:", responseText);
      return c.json({ filter: {}, message: "Could not understand query", raw: responseText, results: [] });
    }

    // Apply filters to cached nodes and return summary
    const allNodes = Array.from(nodeCache.values());
    let filteredNodes = [...allNodes];
    
    if (filter.country) {
      filteredNodes = filteredNodes.filter(n => 
        n.geo?.country?.toLowerCase().includes(filter.country!.toLowerCase())
      );
    }
    if (filter.status) {
      filteredNodes = filteredNodes.filter(n => n.status === filter.status);
    }
    if (filter.min_health_score) {
      filteredNodes = filteredNodes.filter(n => (n.derived?.health_score || 0) >= filter.min_health_score!);
    }
    if (filter.min_ram_gb) {
      const minBytes = filter.min_ram_gb * 1024 * 1024 * 1024;
      filteredNodes = filteredNodes.filter(n => (n.stats?.ram_total || 0) >= minBytes);
    }
    if (filter.max_cpu_percent) {
      filteredNodes = filteredNodes.filter(n => (n.stats?.cpu_percent || 0) <= filter.max_cpu_percent!);
    }
    if (filter.version) {
      filteredNodes = filteredNodes.filter(n => 
        n.version?.toLowerCase().includes(filter.version!.toLowerCase())
      );
    }
    
    // Generate a summary of results
    const onlineCount = filteredNodes.filter(n => n.status === "Online").length;
    const offlineCount = filteredNodes.filter(n => n.status === "Offline").length;
    const avgHealth = filteredNodes.length > 0 
      ? filteredNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / filteredNodes.length 
      : 0;
    
    // Get country breakdown if not filtering by country
    const countryBreakdown: Record<string, number> = {};
    filteredNodes.forEach(n => {
      if (n.geo?.country) {
        countryBreakdown[n.geo.country] = (countryBreakdown[n.geo.country] || 0) + 1;
      }
    });

    console.log(`✅ AI Search: Found ${filteredNodes.length} nodes matching filter`);
    return c.json({ 
      filter, 
      query, 
      message: "Filter generated successfully",
      summary: {
        total_matches: filteredNodes.length,
        online: onlineCount,
        offline: offlineCount,
        avg_health_score: Math.round(avgHealth),
        countries: countryBreakdown,
      },
      // Return first 10 matching IPs for quick reference
      sample_nodes: filteredNodes.slice(0, 10).map(n => ({
        ip: n.ip,
        country: n.geo?.country || "Unknown",
        status: n.status,
        health_score: n.derived?.health_score || 0,
      })),
    });

  } catch (err: any) {
    console.error("❌ AI Search Error:", err?.message || err);
    return c.json({ filter: {}, error: err?.message || "AI service unavailable", results: [] }, 500);
  }
});

// Part 1b: AI Query - Direct Q&A about the network
app.post("/ai/query", async (c) => {
  try {
    const body = await c.req.json();
    const question = body.question?.trim();

    if (!question) {
      return c.json({ answer: "Please ask a question about the network.", error: true });
    }

    console.log(`❓ AI Query: "${question}"`);

    // Gather all current network data to provide context
    const allNodes = Array.from(nodeCache.values());
    const onlineNodes = allNodes.filter(n => n.status === "Online");
    const offlineNodes = allNodes.filter(n => n.status === "Offline");
    
    // Country breakdown
    const countryCounts: Record<string, number> = {};
    allNodes.forEach(n => {
      if (n.geo?.country) {
        countryCounts[n.geo.country] = (countryCounts[n.geo.country] || 0) + 1;
      }
    });
    const sortedCountries = Object.entries(countryCounts)
      .sort(([, a], [, b]) => b - a);
    
    // Version breakdown
    const versionCounts: Record<string, number> = {};
    allNodes.forEach(n => {
      const v = n.version || "Unknown";
      versionCounts[v] = (versionCounts[v] || 0) + 1;
    });
    
    // Health distribution
    const healthDist = { excellent: 0, good: 0, fair: 0, poor: 0 };
    onlineNodes.forEach(n => {
      const h = n.derived?.health_score || 0;
      if (h >= 80) healthDist.excellent++;
      else if (h >= 60) healthDist.good++;
      else if (h >= 40) healthDist.fair++;
      else healthDist.poor++;
    });
    
    // Average metrics
    const nodesWithStats = onlineNodes.filter(n => n.stats);
    const avgCpu = nodesWithStats.length > 0
      ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / nodesWithStats.length
      : 0;
    const avgHealth = onlineNodes.length > 0
      ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
      : 0;
    
    const onlinePercent = allNodes.length > 0 ? (onlineNodes.length / allNodes.length) * 100 : 0;
    const networkScore = Math.round((onlinePercent * 0.5) + (avgHealth * 0.5));

    // Build context payload
    const contextPayload = `
CURRENT NETWORK DATA (Real-time):

SUMMARY:
- Total Nodes: ${allNodes.length}
- Online Nodes: ${onlineNodes.length} (${onlinePercent.toFixed(1)}%)
- Offline Nodes: ${offlineNodes.length}
- Network Score: ${networkScore}/100
- Average Health Score: ${avgHealth.toFixed(0)}/100
- Average CPU Usage: ${avgCpu.toFixed(1)}%

GEOGRAPHIC DISTRIBUTION (${Object.keys(countryCounts).length} countries):
${sortedCountries.slice(0, 15).map(([country, count]) => `- ${country}: ${count} nodes`).join('\n')}
${sortedCountries.length > 15 ? `... and ${sortedCountries.length - 15} more countries` : ''}

HEALTH DISTRIBUTION (Online nodes only):
- Excellent (80-100): ${healthDist.excellent} nodes
- Good (60-79): ${healthDist.good} nodes
- Fair (40-59): ${healthDist.fair} nodes
- Poor (0-39): ${healthDist.poor} nodes

VERSION DISTRIBUTION:
${Object.entries(versionCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([v, c]) => `- ${v}: ${c} nodes`).join('\n')}

USER QUESTION: ${question}

Provide a helpful, concise answer based on the data above.`;

    // Call AI
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: QUERY_SYSTEM_PROMPT },
        { role: "user", content: contextPayload },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "Unable to generate a response.";
    
    console.log(`✅ AI Query answered`);
    return c.json({
      question,
      answer,
      data_snapshot: {
        total_nodes: allNodes.length,
        online_nodes: onlineNodes.length,
        network_score: networkScore,
        countries_count: Object.keys(countryCounts).length,
      },
      generated_at: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error("❌ AI Query Error:", err?.message || err);
    return c.json({ 
      answer: "Sorry, I couldn't process your question. Please try again.", 
      error: err?.message 
    }, 500);
  }
});

// Part 2: Node Doctor - Diagnostic Agent
app.post("/ai/diagnose", async (c) => {
  try {
    const body = await c.req.json();
    const ip = body.ip?.trim();

    if (!ip) {
      return c.json({ error: "IP address required" }, 400);
    }

    // Find node in cache
    const node = nodeCache.get(ip);
    if (!node) {
      return c.json({ error: "Node not found", ip }, 404);
    }

    console.log(`🩺 AI Diagnose: Analyzing node ${ip}`);

    // Calculate network averages from ALL nodes (grounded data)
    const allNodes = Array.from(nodeCache.values());
    const onlineNodes = allNodes.filter(n => n.status === "Online" && n.stats);
    
    const networkAvg = {
      cpu_percent: onlineNodes.length > 0
        ? onlineNodes.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / onlineNodes.length
        : 0,
      ram_percent: onlineNodes.length > 0
        ? onlineNodes.reduce((acc, n) => acc + (n.derived?.ram_usage_percent || 0), 0) / onlineNodes.length
        : 0,
      uptime_seconds: onlineNodes.length > 0
        ? onlineNodes.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / onlineNodes.length
        : 0,
      health_score: onlineNodes.length > 0
        ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
        : 0,
    };

    // Construct the data payload for AI (ONLY real data)
    const nodeData = {
      ip: node.ip,
      status: node.status,
      version: node.version || "Unknown",
      country: node.geo?.country || "Unknown",
      city: node.geo?.city || "Unknown",
      cpu_percent: node.stats?.cpu_percent || 0,
      ram_used_bytes: node.stats?.ram_used || 0,
      ram_total_bytes: node.stats?.ram_total || 0,
      ram_percent: node.derived?.ram_usage_percent || 0,
      storage_used_bytes: node.stats?.file_size || 0,
      storage_total_bytes: node.stats?.total_bytes || 0,
      storage_percent: node.derived?.storage_utilization_percent || 0,
      uptime_seconds: node.stats?.uptime || 0,
      uptime_human: node.derived?.uptime_human || "N/A",
      packets_sent: node.stats?.packets_sent || 0,
      packets_received: node.stats?.packets_received || 0,
      active_streams: node.stats?.active_streams || 0,
      health_score: node.derived?.health_score || 0,
    };

    // Build prompt with REAL data
    const userPrompt = `
Analyze this node's health:

NODE STATS:
- IP: ${nodeData.ip}
- Status: ${nodeData.status}
- Location: ${nodeData.city}, ${nodeData.country}
- Version: ${nodeData.version}
- CPU Usage: ${nodeData.cpu_percent.toFixed(1)}%
- RAM Usage: ${nodeData.ram_percent.toFixed(1)}% (${formatBytes(nodeData.ram_used_bytes)} / ${formatBytes(nodeData.ram_total_bytes)})
- Storage: ${nodeData.storage_percent.toFixed(1)}% utilized
- Uptime: ${nodeData.uptime_human}
- Network Activity: ${nodeData.packets_sent.toLocaleString()} sent, ${nodeData.packets_received.toLocaleString()} received
- Active Streams: ${nodeData.active_streams}
- Health Score: ${nodeData.health_score}/100

NETWORK AVERAGES (${onlineNodes.length} online nodes):
- Average CPU: ${networkAvg.cpu_percent.toFixed(1)}%
- Average RAM: ${networkAvg.ram_percent.toFixed(1)}%
- Average Uptime: ${formatUptime(networkAvg.uptime_seconds)}
- Average Health Score: ${networkAvg.health_score.toFixed(0)}/100

Compare this node to network averages and provide your diagnosis.`;

    // Call AI
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: DIAGNOSE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    
    // Parse diagnosis
    let diagnosis: DiagnosisResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        diagnosis = {
          status: parsed.status || "Warning",
          summary: parsed.summary || "Unable to generate summary",
          recommendations: parsed.recommendations || [],
          metrics_comparison: {
            cpu: {
              node: nodeData.cpu_percent,
              network_avg: networkAvg.cpu_percent,
              status: nodeData.cpu_percent <= networkAvg.cpu_percent * 1.2 ? "good" : "elevated",
            },
            ram: {
              node: nodeData.ram_percent,
              network_avg: networkAvg.ram_percent,
              status: nodeData.ram_percent <= networkAvg.ram_percent * 1.2 ? "good" : "elevated",
            },
            uptime: {
              node: nodeData.uptime_human,
              network_avg: formatUptime(networkAvg.uptime_seconds),
              status: nodeData.uptime_seconds >= networkAvg.uptime_seconds * 0.8 ? "good" : "low",
            },
          },
        };
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseErr) {
      console.error("❌ AI Diagnose: Parse failed, using fallback");
      diagnosis = {
        status: nodeData.health_score >= 70 ? "Healthy" : nodeData.health_score >= 40 ? "Warning" : "Critical",
        summary: `Node has health score ${nodeData.health_score}/100 with ${nodeData.cpu_percent.toFixed(1)}% CPU usage.`,
        recommendations: ["Monitor resource usage", "Check network connectivity"],
        metrics_comparison: {
          cpu: { node: nodeData.cpu_percent, network_avg: networkAvg.cpu_percent, status: "unknown" },
          ram: { node: nodeData.ram_percent, network_avg: networkAvg.ram_percent, status: "unknown" },
          uptime: { node: nodeData.uptime_human, network_avg: formatUptime(networkAvg.uptime_seconds), status: "unknown" },
        },
      };
    }

    console.log(`✅ AI Diagnose: ${diagnosis.status} - ${diagnosis.summary}`);
    return c.json({
      diagnosis,
      node_data: nodeData,
      network_averages: networkAvg,
      generated_at: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error("❌ AI Diagnose Error:", err?.message || err);
    return c.json({ error: err?.message || "Diagnosis failed" }, 500);
  }
});

// Part 3: Daily AI Briefing
app.get("/ai/briefing", async (c) => {
  try {
    // Check cache first
    const now = Date.now();
    if (briefingCache.data && (now - briefingCache.timestamp) < BRIEFING_CACHE_TTL) {
      console.log("📰 AI Briefing: Returning cached briefing");
      return c.json({ ...briefingCache.data, cached: true });
    }

    console.log("📰 AI Briefing: Generating fresh briefing...");

    // Aggregate REAL metrics from nodeCache
    const allNodes = Array.from(nodeCache.values());
    const onlineNodes = allNodes.filter(n => n.status === "Online");
    const offlineNodes = allNodes.filter(n => n.status === "Offline");

    // Version distribution
    const versionCounts: Record<string, number> = {};
    allNodes.forEach(n => {
      const v = n.version || "Unknown";
      versionCounts[v] = (versionCounts[v] || 0) + 1;
    });
    const topVersion = Object.entries(versionCounts)
      .sort(([, a], [, b]) => b - a)[0];

    // Country distribution
    const countryCounts: Record<string, number> = {};
    allNodes.forEach(n => {
      if (n.geo?.country) {
        countryCounts[n.geo.country] = (countryCounts[n.geo.country] || 0) + 1;
      }
    });
    const topCountry = Object.entries(countryCounts)
      .sort(([, a], [, b]) => b - a)[0];

    // Storage aggregates
    const totalStorageUsed = allNodes.reduce((acc, n) => acc + (n.stats?.file_size || 0), 0);
    const totalStorageCapacity = allNodes.reduce((acc, n) => acc + (n.stats?.total_bytes || 0), 0);
    
    // Health distribution
    const healthyCount = allNodes.filter(n => (n.derived?.health_score || 0) >= 70).length;
    const warningCount = allNodes.filter(n => {
      const score = n.derived?.health_score || 0;
      return score >= 40 && score < 70;
    }).length;

    // Average metrics
    const avgCpu = onlineNodes.length > 0
      ? onlineNodes.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / onlineNodes.length
      : 0;
    const avgHealthScore = onlineNodes.length > 0
      ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
      : 0;

    // Build metrics payload for AI (ONLY real data)
    const metricsPayload = `
XANDEUM NETWORK METRICS (as of ${new Date().toLocaleString()}):

NETWORK STATUS:
- Total Nodes: ${allNodes.length}
- Online Nodes: ${onlineNodes.length} (${((onlineNodes.length / allNodes.length) * 100).toFixed(1)}%)
- Offline Nodes: ${offlineNodes.length}
- Healthy Nodes (score ≥70): ${healthyCount}
- Warning Nodes (score 40-69): ${warningCount}
- Average Health Score: ${avgHealthScore.toFixed(0)}/100
- Average CPU Usage: ${avgCpu.toFixed(1)}%

STORAGE:
- Total Used: ${formatBytes(totalStorageUsed)}
- Total Capacity: ${formatBytes(totalStorageCapacity)}
- Utilization: ${totalStorageCapacity > 0 ? ((totalStorageUsed / totalStorageCapacity) * 100).toFixed(1) : 0}%

TOP GEOGRAPHY:
- #1 Country: ${topCountry ? `${topCountry[0]} (${topCountry[1]} nodes)` : "Unknown"}
- Countries Represented: ${Object.keys(countryCounts).length}

SOFTWARE:
- Most Common Version: ${topVersion ? `${topVersion[0]} (${topVersion[1]} nodes, ${((topVersion[1] / allNodes.length) * 100).toFixed(0)}%)` : "Unknown"}
- Unique Versions: ${Object.keys(versionCounts).length}

Generate a morning briefing based ONLY on these metrics.`;

    // Call AI
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: BRIEFING_SYSTEM_PROMPT },
        { role: "user", content: metricsPayload },
      ],
      temperature: 0.5,
      max_tokens: 400,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    
    // Parse briefing
    let briefing: BriefingResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        briefing = {
          headline: parsed.headline || "Network Status Update",
          bullets: parsed.bullets || [],
          generated_at: new Date().toISOString(),
          cached: false,
        };
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseErr) {
      console.error("❌ AI Briefing: Parse failed, using fallback");
      briefing = {
        headline: "Network Status Update",
        bullets: [
          `${onlineNodes.length} of ${allNodes.length} nodes currently online`,
          `${topCountry ? topCountry[0] : "Various regions"} leads in node count`,
          `Network health score averages ${avgHealthScore.toFixed(0)}/100`,
        ],
        generated_at: new Date().toISOString(),
        cached: false,
      };
    }

    // Cache the result
    briefingCache = {
      data: briefing,
      timestamp: now,
    };

    console.log(`✅ AI Briefing: "${briefing.headline}"`);
    return c.json(briefing);

  } catch (err: any) {
    console.error("❌ AI Briefing Error:", err?.message || err);
    // Return fallback briefing with real data
    const allNodes = Array.from(nodeCache.values());
    const onlineNodes = allNodes.filter(n => n.status === "Online");
    return c.json({
      headline: "Network Status",
      bullets: [
        `${onlineNodes.length} nodes online`,
        `${allNodes.length} total nodes tracked`,
        "AI briefing temporarily unavailable",
      ],
      generated_at: new Date().toISOString(),
      cached: false,
      error: err?.message,
    });
  }
});

// --- Start ---
console.log(`🚀 Server starting on http://localhost:${PORT}`);
runCrawler(); 
setInterval(runCrawler, 60 * 1000); 

serve({ fetch: app.fetch, port: PORT });