import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import axios from "axios";
import { z } from "zod";

// --- Configuration ---
const PORT = 3000;
const BOOTSTRAP_NODE_URL = "http://173.212.207.32:6000/rpc";

// --- In-Memory Database ---
let nodeCache: Map<string, any> = new Map();
let lastSyncTime: Date | null = null;
let isSyncing = false;

// --- Schemas ---
const PodSchema = z.object({
  address: z.string(),
  version: z.string().optional(),
});
const GetPodsResultSchema = z.object({
  pods: PodSchema.array(),
});
const StatsSchema = z.object({
  active_streams: z.number().optional(),
  cpu_percent: z.number().optional(),
  current_index: z.number().optional(),
  file_size: z.number().optional(),
  last_updated: z.number().optional(),
  packets_received: z.number().optional(),
  packets_sent: z.number().optional(),
  ram_total: z.number().optional(),
  ram_used: z.number().optional(),
  total_bytes: z.number().optional(),
  total_pages: z.number().optional(),
  uptime: z.number().optional(),
});

// --- RPC Helper ---
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
    console.log(`📋 Crawler: Found ${pods.length} nodes.`);

    // 2. Cache all nodes from gossip network
    pods.forEach((pod) => {
      const [ip] = pod.address.split(':');
      if (!ip) return;
      
      nodeCache.set(pod.address, {
        ip,
        address: pod.address,
        version: pod.version || "Unknown",
        status: "Active", // In gossip network = active
        lastSeen: new Date(),
        pubkey: (pod as any).pubkey || null
      });
    });

    // 3. Fetch bootstrap node stats for network-wide metrics
    try {
      const bootstrapStats = await callPrpc<any>("get-stats", [], BOOTSTRAP_NODE_URL);
      const parsedStats = StatsSchema.safeParse(bootstrapStats);
      if (parsedStats.success) {
        nodeCache.set("__bootstrap__", {
          type: "bootstrap",
          address: BOOTSTRAP_NODE_URL,
          stats: parsedStats.data,
          lastUpdated: new Date()
        });
      }
    } catch (err) {
      console.warn("⚠️  Could not fetch bootstrap stats");
    }

    lastSyncTime = new Date();
    console.log(`✅ Crawler: Sync complete. Cached ${nodeCache.size} nodes.`);

  } catch (err: any) {
    console.error("❌ Crawler Error:", err?.message || err);
  } finally {
    isSyncing = false;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// --- API Server ---
const app = new Hono();
app.use("/*", cors());

// Logging middleware
app.use("*", async (c, next) => {
  console.log(`${c.req.method} ${c.req.path}`);
  await next();
});

app.get("/", (c) => c.text("Xandeum Analytics Backend is Active 🟢"));

app.get("/pnodes", (c) => {
  const nodes = Array.from(nodeCache.values()).filter(n => n.type !== "bootstrap");
  const activeNodes = nodes.filter(n => n.status === "Active");
  
  return c.json({
    meta: {
      total_nodes: nodes.length,
      active_nodes: activeNodes.length,
      last_sync: lastSyncTime,
      is_syncing: isSyncing
    },
    nodes: nodes
  });
});

app.get("/stats", (c) => {
  const nodes = Array.from(nodeCache.values()).filter(n => n.type !== "bootstrap");
  const bootstrap = nodeCache.get("__bootstrap__");
  
  // Calculate version distribution
  const versionCounts = new Map<string, number>();
  const portCounts = new Map<string, number>();
  const uniqueIPs = new Set<string>();
  
  nodes.forEach((node) => {
    versionCounts.set(node.version, (versionCounts.get(node.version) || 0) + 1);
    const [, port] = node.address.split(':');
    if (port) portCounts.set(port, (portCounts.get(port) || 0) + 1);
    uniqueIPs.add(node.ip);
  });
  
  return c.json({
    network: {
      total_nodes: nodes.length,
      unique_ips: uniqueIPs.size,
      last_sync: lastSyncTime
    },
    bootstrap: bootstrap?.stats || null,
    versions: Object.fromEntries(versionCounts),
    ports: Object.fromEntries(portCounts)
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    uptime: process.uptime(),
    cache_size: nodeCache.size,
    last_sync: lastSyncTime,
    is_syncing: isSyncing
  });
});

// --- Start ---
console.log(`🚀 Server starting on http://localhost:${PORT}`);
runCrawler(); 
setInterval(runCrawler, 60 * 1000); 

serve({ fetch: app.fetch, port: PORT });