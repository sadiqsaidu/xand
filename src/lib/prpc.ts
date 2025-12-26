/**
 * Xandeum Explorer - pRPC Client
 * Client for communicating with Xandeum network nodes
 */

import axios from "axios";
import logger from "./logger";
import { sleep } from "./format";
import { 
  PodSchema, 
  GetPodsResultSchema, 
  NodeStatsSchema,
  type Pod,
  type NodeStats 
} from "../types";

// Configuration
const BOOTSTRAP_NODE_URL = process.env.BOOTSTRAP_NODE_URL || "http://173.212.207.32:6000/rpc";
const RPC_TIMEOUT_MS = 3000;
const STATS_PORT = 6000;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params: unknown[];
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown } | null;
}

/**
 * Generic JSON-RPC call to a pNode
 */
export async function callPrpc<T>(
  method: string,
  params: unknown[] = [],
  url: string = BOOTSTRAP_NODE_URL,
  timeout: number = RPC_TIMEOUT_MS
): Promise<T> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };
  
  try {
    const response = await axios.post<JsonRpcResponse<T>>(
      url,
      request,
      { 
        headers: { "content-type": "application/json" },
        timeout,
      }
    );
    
    if (response.data.error) {
      throw new Error(`pRPC error ${response.data.error.code}: ${response.data.error.message}`);
    }
    
    return response.data.result as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        throw new Error(`RPC timeout: ${url}`);
      }
      if (error.code === "ECONNREFUSED") {
        throw new Error(`Connection refused: ${url}`);
      }
    }
    throw error;
  }
}

/**
 * Get all pods (nodes) from the bootstrap node
 */
export async function getPods(): Promise<Pod[]> {
  logger.debug("Fetching pods from bootstrap node", { url: BOOTSTRAP_NODE_URL });
  
  const result = await callPrpc<unknown>("get-pods", [], BOOTSTRAP_NODE_URL);
  const parsed = GetPodsResultSchema.safeParse(result);
  
  if (!parsed.success) {
    logger.error("get-pods validation failed", { 
      errors: parsed.error.format() 
    });
    throw new Error("get-pods result validation failed");
  }
  
  logger.debug(`Retrieved ${parsed.data.pods.length} pods`);
  return parsed.data.pods;
}

/**
 * Get stats for a specific node by IP
 */
export async function getNodeStats(
  ip: string,
  maxRetries: number = 2
): Promise<NodeStats | null> {
  const url = `http://${ip}:${STATS_PORT}/rpc`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callPrpc<unknown>("get-stats", [], url, RPC_TIMEOUT_MS);
      
      const parsed = NodeStatsSchema.safeParse(result);
      if (!parsed.success) {
        logger.debug(`Stats validation failed for ${ip}`, { 
          errors: parsed.error.format() 
        });
        return null;
      }
      
      return parsed.data;
    } catch (error) {
      const err = error as Error;
      
      // Don't retry on certain errors
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ENOTFOUND") ||
        err.message.includes("EHOSTUNREACH")
      ) {
        logger.debug(`Node unreachable: ${ip}`);
        return null;
      }
      
      // Retry on timeout or other errors
      if (attempt < maxRetries) {
        await sleep(500 * attempt);
        continue;
      }
      
      logger.debug(`Failed to get stats for ${ip} after ${maxRetries} attempts`);
      return null;
    }
  }
  
  return null;
}

/**
 * Batch get stats for multiple nodes with concurrency control
 */
export async function batchGetNodeStats(
  ips: string[],
  concurrency: number = 20
): Promise<Map<string, NodeStats | null>> {
  const results = new Map<string, NodeStats | null>();
  
  // Dynamic import for p-limit (ESM module)
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);
  
  const promises = ips.map(ip => 
    limit(async () => {
      const stats = await getNodeStats(ip, 2);
      results.set(ip, stats);
      return { ip, stats };
    })
  );
  
  await Promise.all(promises);
  
  return results;
}

/**
 * Check if a node's RPC is accessible
 */
export async function isNodeReachable(ip: string): Promise<boolean> {
  try {
    const stats = await getNodeStats(ip, 1);
    return stats !== null;
  } catch {
    return false;
  }
}

/**
 * Get bootstrap node info
 */
export function getBootstrapInfo(): { url: string; port: number } {
  return {
    url: BOOTSTRAP_NODE_URL,
    port: STATS_PORT,
  };
}
