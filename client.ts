import axios from "axios";
import { z } from "zod";

// --- Configuration ---
// This is the IP of the known Xandeum bootstrap node.
// We target port 6000 (pRPC) to ask for data.
const BOOTSTRAP_NODE_URL = "http://173.212.207.32:6000/rpc";

// --- Zod Schemas (Data Validation) ---
// This ensures the data we get back actually looks like what we expect.
const PodSchema = z.object({
  address: z.string(), // "IP:Port"
  last_seen_timestamp: z.number().optional(),
  last_seen: z.string().optional(),
  pubkey: z.string().nullable().optional(),
  version: z.string().optional(),
});

const GetPodsResultSchema = z.object({
  pods: PodSchema.array(),
  total_count: z.number(),
});

// Define the schema for the rich stats
const StatsSchema = z.object({
  active_streams: z.number(),
  cpu_percent: z.number(),
  current_index: z.number(),
  file_size: z.number(),
  last_updated: z.number(),
  packets_received: z.number(),
  packets_sent: z.number(),
  ram_total: z.number(),
  ram_used: z.number(),
  total_bytes: z.number(),
  total_pages: z.number(),
  uptime: z.number(),
});

// --- Helper Types ---
type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown } | null;
};

// --- Core Function: The RPC Caller ---
async function callPrpc<T>(method: string, params: unknown[] = [], url?: string): Promise<T> {
  const targetUrl = url || BOOTSTRAP_NODE_URL;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };

  try {
    console.log(`📡 Sending ${method} to ${targetUrl}...`);
    
    const response = await axios.post<JsonRpcResponse<unknown>>(
      targetUrl, 
      body, 
      { headers: { "content-type": "application/json" }, timeout: 5000 }
    );

    const json = response.data;

    if (json.error) {
      throw new Error(`❌ pRPC Error ${json.error.code}: ${json.error.message}`);
    }

    return json.result as T;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
        throw new Error(`❌ Network Error: ${error.message}`);
    }
    throw error;
  }
}

async function getStatsForNode(ip: string) {
  // Construct the URL for the specific node
  // Note: We use the IP from the list, but ensure we hit port 6000
  const nodeUrl = `http://${ip.split(':')[0]}:6000/rpc`;
  
  console.log(`🕵️ Probing details for ${nodeUrl}...`);
  const result = await callPrpc("get-stats", [], nodeUrl);
  return result;
}

// --- Main Execution ---
async function main() {
  try {
    // 1. Fetch the list of pods
    console.log("🔍 Fetching active pNodes...");
    const rawResult = await callPrpc<unknown>("get-pods");
    
    // 2. Validate the data
    const parsed = GetPodsResultSchema.safeParse(rawResult);

    if (!parsed.success) {
      console.error("⚠️  Data validation failed:", parsed.error.format());
      return;
    }

    const pods = parsed.data.pods;
    
    // Analyze the data
    const versionCounts = new Map<string, number>();
    const uniqueIPs = new Set<string>();
    const portCounts = new Map<string, number>();
    
    pods.forEach((pod) => {
      const version = pod.version || "Unknown";
      versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
      
      const [ip, port] = pod.address.split(':');
      if (ip) uniqueIPs.add(ip);
      if (port) portCounts.set(port, (portCounts.get(port) || 0) + 1);
    });
    
    // 3. Display Results
    console.log(`\n✅ Success! Found ${pods.length} active nodes in the gossip network.`);
    console.log(`   Unique IPs: ${uniqueIPs.size} | Unique Versions: ${versionCounts.size}`);
    
    console.log("\n📊 Version Distribution:");
    console.log("==========================================");
    Array.from(versionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([version, count]) => {
        const percentage = ((count / pods.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(count / pods.length * 40));
        console.log(`${version.padEnd(35)} ${count.toString().padStart(3)} (${percentage}%) ${bar}`);
      });
    
    console.log("\n🌍 Port Distribution:");
    console.log("==========================================");
    Array.from(portCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([port, count]) => {
        const percentage = ((count / pods.length) * 100).toFixed(1);
        console.log(`Port ${port}: ${count} nodes (${percentage}%)`);
      });
    
    console.log("\n📋 Sample Nodes (first 10):");
    console.log("--------------------------------------------");
    console.log("| IP Address          | Version           |");
    console.log("--------------------------------------------");
    
    pods.slice(0, 10).forEach((pod) => { // Show top 10
      const version = pod.version || "Unknown";
      console.log(`| ${pod.address.padEnd(19)} | ${version.padEnd(17)} |`);
    });
    
    if (pods.length > 10) console.log(`... and ${pods.length - 10} more.`);

    // Fetch bootstrap node stats
    console.log("\n📊 Bootstrap Node Stats:");
    console.log("==========================================");
    const bootstrapStats = await callPrpc<unknown>("get-stats");
    const parsedStats = StatsSchema.safeParse(bootstrapStats);
    
    if (parsedStats.success) {
      const stats = parsedStats.data;
      console.log(`CPU Usage:        ${stats.cpu_percent.toFixed(2)}%`);
      console.log(`RAM Used:         ${(stats.ram_used / 1024 / 1024 / 1024).toFixed(2)} GB / ${(stats.ram_total / 1024 / 1024 / 1024).toFixed(2)} GB`);
      console.log(`Uptime:           ${Math.floor(stats.uptime / 86400)}d ${Math.floor((stats.uptime % 86400) / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`);
      console.log(`Active Streams:   ${stats.active_streams}`);
      console.log(`Packets Sent:     ${stats.packets_sent.toLocaleString()}`);
      console.log(`Packets Received: ${stats.packets_received.toLocaleString()}`);
      console.log(`Total Pages:      ${stats.total_pages}`);
      console.log(`Total Bytes:      ${stats.total_bytes.toLocaleString()}`);
    } else {
      console.log("⚠️  Failed to parse bootstrap stats");
    }

  } catch (err: any) {
    console.error("\n💥 Fatal Error:", err.message);
  }
}

main();