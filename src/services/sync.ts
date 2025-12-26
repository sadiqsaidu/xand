/**
 * Xandeum Explorer - Sync Engine
 * Background crawler that syncs node data from the Xandeum network
 */

import logger from "../lib/logger";
import { getPods, batchGetNodeStats } from "../lib/prpc";
import { batchGetGeoLocation, getUncachedIps } from "../lib/geo";
import { extractIp } from "../lib/format";
import * as store from "./store";
import type { Pod } from "../types";

// Configuration
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || "60000", 10); // 60 seconds
const STATS_CONCURRENCY = parseInt(process.env.STATS_CONCURRENCY || "30", 10);
const STALE_NODE_RETENTION_DAYS = parseInt(process.env.STALE_RETENTION_DAYS || "7", 10);
const INITIAL_SYNC_DELAY_MS = 5000;

let syncIntervalId: NodeJS.Timeout | null = null;
let isRunning = false;

// ============================================
// Core Sync Logic
// ============================================

/**
 * Run a single sync cycle
 */
export async function syncOnce(): Promise<{
  success: boolean;
  totalPods: number;
  uniqueIps: number;
  onlineCount: number;
  offlineCount: number;
  durationMs: number;
}> {
  if (isRunning) {
    logger.warn("Sync already in progress, skipping");
    return { success: false, totalPods: 0, uniqueIps: 0, onlineCount: 0, offlineCount: 0, durationMs: 0 };
  }
  
  isRunning = true;
  store.setSyncStatus("syncing");
  const startTime = Date.now();
  
  try {
    // 1. Fetch all pods from bootstrap node
    logger.sync("Fetching pods from network...");
    const pods = await getPods();
    
    if (pods.length === 0) {
      logger.warn("No pods returned from network");
      store.setSyncStatus("error");
      return { success: false, totalPods: 0, uniqueIps: 0, onlineCount: 0, offlineCount: 0, durationMs: Date.now() - startTime };
    }
    
    logger.sync(`Retrieved ${pods.length} pods from gossip`);
    
    // 2. Deduplicate by IP (keep most recent by last_seen_timestamp)
    const podsByIp = deduplicatePods(pods);
    const uniquePods = Array.from(podsByIp.values());
    const uniqueIps = uniquePods.map(p => extractIp(p.address));
    
    logger.sync(`Deduplicated to ${uniquePods.length} unique IPs`);
    
    // 3. Fetch geolocation for new IPs
    const ipsNeedingGeo = getUncachedIps(uniqueIps);
    if (ipsNeedingGeo.length > 0) {
      logger.sync(`Fetching geo for ${ipsNeedingGeo.length} new IPs...`);
      await batchGetGeoLocation(ipsNeedingGeo);
    }
    
    // 4. Batch fetch stats from all nodes
    logger.sync(`Probing ${uniqueIps.length} nodes for stats...`);
    const statsMap = await batchGetNodeStats(uniqueIps, STATS_CONCURRENCY);
    
    // 5. Update store with results
    let onlineCount = 0;
    let offlineCount = 0;
    
    for (const pod of uniquePods) {
      const ip = extractIp(pod.address);
      const stats = statsMap.get(ip);
      const geo = await getGeoForIp(ip);
      
      store.upsertNode(ip, pod.address, {
        version: pod.version,
        pubkey: pod.pubkey,
        lastSeenTimestamp: pod.last_seen_timestamp,
        stats: stats || null,
        geo,
        isOnline: stats !== null,
      });
      
      if (stats) {
        onlineCount++;
      } else {
        offlineCount++;
      }
    }
    
    // 6. Mark nodes not in current gossip
    const currentIps = new Set(uniqueIps);
    store.markAbsentNodesUnknown(currentIps);
    
    // 7. Cleanup stale nodes
    const removedCount = store.removeStaleNodes(STALE_NODE_RETENTION_DAYS);
    
    store.setSyncStatus("idle");
    const durationMs = Date.now() - startTime;
    
    logger.sync(`Sync complete`, {
      totalPods: pods.length,
      uniqueIps: uniquePods.length,
      online: onlineCount,
      offline: offlineCount,
      removed: removedCount,
      durationMs,
      successRate: `${((onlineCount / uniquePods.length) * 100).toFixed(1)}%`,
    });
    
    return {
      success: true,
      totalPods: pods.length,
      uniqueIps: uniquePods.length,
      onlineCount,
      offlineCount,
      durationMs,
    };
  } catch (error) {
    logger.error("Sync failed", { error: (error as Error).message });
    store.setSyncStatus("error");
    return { 
      success: false, 
      totalPods: 0, 
      uniqueIps: 0, 
      onlineCount: 0, 
      offlineCount: 0, 
      durationMs: Date.now() - startTime 
    };
  } finally {
    isRunning = false;
  }
}

/**
 * Deduplicate pods by IP, keeping the one with most recent timestamp
 */
function deduplicatePods(pods: Pod[]): Map<string, Pod> {
  const podsByIp = new Map<string, Pod>();
  const seenPubkeys = new Set<string>();
  
  for (const pod of pods) {
    const ip = extractIp(pod.address);
    if (!ip) continue;
    
    const existing = podsByIp.get(ip);
    
    // Handle duplicate pubkeys
    if (pod.pubkey && seenPubkeys.has(pod.pubkey)) {
      logger.debug(`Duplicate pubkey for ${ip}, clearing`);
      pod.pubkey = null;
    }
    
    if (!existing) {
      podsByIp.set(ip, pod);
      if (pod.pubkey) seenPubkeys.add(pod.pubkey);
    } else {
      // Keep the one with more recent timestamp
      const existingTs = existing.last_seen_timestamp ?? 0;
      const newTs = pod.last_seen_timestamp ?? 0;
      if (newTs > existingTs) {
        podsByIp.set(ip, pod);
      }
    }
  }
  
  return podsByIp;
}

/**
 * Get cached geolocation for an IP
 */
async function getGeoForIp(ip: string): Promise<import("../types").GeoLocation | null> {
  const { getCachedGeo } = await import("../lib/geo");
  return getCachedGeo(ip) || null;
}

// ============================================
// Sync Service Management
// ============================================

/**
 * Start the automated sync service
 */
export function startSyncService(): void {
  if (syncIntervalId) {
    logger.warn("Sync service already running");
    return;
  }
  
  logger.info(`Starting sync service (interval: ${SYNC_INTERVAL_MS / 1000}s)`);
  
  // Initial sync after short delay
  setTimeout(async () => {
    logger.sync("Running initial sync...");
    await syncOnce();
  }, INITIAL_SYNC_DELAY_MS);
  
  // Periodic sync
  syncIntervalId = setInterval(async () => {
    await syncOnce();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the sync service
 */
export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info("Sync service stopped");
  }
}

/**
 * Check if sync service is running
 */
export function isSyncServiceRunning(): boolean {
  return syncIntervalId !== null;
}

/**
 * Get sync service configuration
 */
export function getSyncConfig(): {
  intervalMs: number;
  concurrency: number;
  staleRetentionDays: number;
  isRunning: boolean;
} {
  return {
    intervalMs: SYNC_INTERVAL_MS,
    concurrency: STATS_CONCURRENCY,
    staleRetentionDays: STALE_NODE_RETENTION_DAYS,
    isRunning: syncIntervalId !== null,
  };
}
