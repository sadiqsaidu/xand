/**
 * Xandeum Explorer - Node Store
 * In-memory data store with abstractions for node management
 */

import type { 
  XandeumNode, 
  NodeStats, 
  NodeStatus, 
  GeoLocation,
  NetworkStats,
  NetworkSummary,
  NetworkPerformance,
  NetworkStorage,
  NetworkTraffic,
  DistributionData,
  NodeSearchFilter,
  MapMarker
} from "../types";
import { calculateDerivedMetrics, getHealthGrade } from "../lib/health";
import { 
  formatBytes, 
  formatUptime, 
  formatTimeAgo, 
  formatPercent, 
  formatNumber,
  formatLocation,
  generateNodeId,
  extractIp,
  extractPort
} from "../lib/format";
import logger from "../lib/logger";

// ============================================
// Store State
// ============================================

interface StoreState {
  nodes: Map<string, XandeumNode>;
  lastSync: Date | null;
  syncStatus: "syncing" | "idle" | "error";
  syncCount: number;
  startTime: Date;
}

const state: StoreState = {
  nodes: new Map(),
  lastSync: null,
  syncStatus: "idle",
  syncCount: 0,
  startTime: new Date(),
};

// ============================================
// Node CRUD Operations
// ============================================

/**
 * Create or update a node in the store
 */
export function upsertNode(
  ip: string,
  address: string,
  data: {
    version?: string | null;
    pubkey?: string | null;
    lastSeenTimestamp?: number | null;
    stats?: NodeStats | null;
    geo?: GeoLocation | null;
    isOnline?: boolean;
  }
): XandeumNode {
  const existing = state.nodes.get(ip);
  const now = new Date();
  
  // Determine status
  let status: NodeStatus;
  const hasStats = data.stats !== null && data.stats !== undefined;
  
  if (data.isOnline === false) {
    status = "offline";
  } else if (hasStats) {
    status = "online";
  } else if (existing?.status === "online") {
    // Was online but no stats this round = degraded
    status = "degraded";
  } else {
    status = "unknown";
  }
  
  // Calculate derived metrics
  const derived = calculateDerivedMetrics(data.stats || null, status);
  
  // Build display values
  const display = data.stats ? {
    cpu: `${(data.stats.cpu_percent || 0).toFixed(1)}%`,
    ram: `${formatPercent(derived?.ramUsagePercent || 0)}`,
    ramUsed: formatBytes(data.stats.ram_used || 0),
    ramTotal: formatBytes(data.stats.ram_total || 0),
    storage: formatBytes(data.stats.file_size || 0),
    uptime: derived?.uptimeHuman || "N/A",
    packets: `↑${formatNumber(data.stats.packets_sent || 0)} ↓${formatNumber(data.stats.packets_received || 0)}`,
    healthScore: `${derived?.healthScore || 0}/100`,
    location: formatLocation(data.geo?.city, data.geo?.country),
  } : null;
  
  const node: XandeumNode = {
    id: generateNodeId(ip),
    ip,
    address,
    pubkey: data.pubkey || existing?.pubkey || null,
    version: data.version || existing?.version || null,
    status,
    isOnline: status === "online" || status === "degraded",
    hasPublicRpc: hasStats,
    lastSeen: status === "online" ? now : existing?.lastSeen || null,
    lastSeenTimestamp: data.lastSeenTimestamp || existing?.lastSeenTimestamp || null,
    lastSeenAgo: formatTimeAgo(data.lastSeenTimestamp || existing?.lastSeenTimestamp || null),
    firstSeen: existing?.firstSeen || now,
    stats: data.stats || existing?.stats || null,
    derived,
    geo: data.geo || existing?.geo || null,
    display,
  };
  
  state.nodes.set(ip, node);
  return node;
}

/**
 * Get a node by IP
 */
export function getNode(ip: string): XandeumNode | undefined {
  return state.nodes.get(ip);
}

/**
 * Get all nodes
 */
export function getAllNodes(): XandeumNode[] {
  return Array.from(state.nodes.values());
}

/**
 * Get nodes by status
 */
export function getNodesByStatus(status: NodeStatus): XandeumNode[] {
  return getAllNodes().filter(n => n.status === status);
}

/**
 * Mark a node as offline
 */
export function markNodeOffline(ip: string): void {
  const node = state.nodes.get(ip);
  if (node) {
    node.status = "offline";
    node.isOnline = false;
    if (node.derived) {
      node.derived.healthScore = 0;
      node.derived.healthGrade = "critical";
    }
    state.nodes.set(ip, node);
  }
}

/**
 * Mark nodes not in current sync as unknown
 */
export function markAbsentNodesUnknown(currentIps: Set<string>): void {
  state.nodes.forEach((node, ip) => {
    if (!currentIps.has(ip) && node.status === "online") {
      node.status = "unknown";
      state.nodes.set(ip, node);
    }
  });
}

/**
 * Remove stale nodes older than specified days
 */
export function removeStaleNodes(days: number): number {
  const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
  let removed = 0;
  
  state.nodes.forEach((node, ip) => {
    const lastSeen = node.lastSeen?.getTime() || 0;
    if (lastSeen < threshold && node.status !== "online") {
      state.nodes.delete(ip);
      removed++;
    }
  });
  
  if (removed > 0) {
    logger.info(`Removed ${removed} stale nodes`);
  }
  
  return removed;
}

// ============================================
// Search & Filter
// ============================================

/**
 * Search nodes with filters
 */
export function searchNodes(filter: NodeSearchFilter): XandeumNode[] {
  let results = getAllNodes();
  
  if (filter.country) {
    const countryLower = filter.country.toLowerCase();
    results = results.filter(n => 
      n.geo?.country?.toLowerCase().includes(countryLower)
    );
  }
  
  if (filter.status) {
    results = results.filter(n => n.status === filter.status);
  }
  
  if (filter.minHealthScore !== undefined) {
    results = results.filter(n => 
      (n.derived?.healthScore || 0) >= filter.minHealthScore!
    );
  }
  
  if (filter.maxHealthScore !== undefined) {
    results = results.filter(n => 
      (n.derived?.healthScore || 0) <= filter.maxHealthScore!
    );
  }
  
  if (filter.minRamGb !== undefined) {
    const minBytes = filter.minRamGb * 1024 * 1024 * 1024;
    results = results.filter(n => (n.stats?.ram_total || 0) >= minBytes);
  }
  
  if (filter.maxRamGb !== undefined) {
    const maxBytes = filter.maxRamGb * 1024 * 1024 * 1024;
    results = results.filter(n => (n.stats?.ram_total || 0) <= maxBytes);
  }
  
  if (filter.minCpuPercent !== undefined) {
    results = results.filter(n => 
      (n.stats?.cpu_percent || 0) >= filter.minCpuPercent!
    );
  }
  
  if (filter.maxCpuPercent !== undefined) {
    results = results.filter(n => 
      (n.stats?.cpu_percent || 0) <= filter.maxCpuPercent!
    );
  }
  
  if (filter.version) {
    const versionLower = filter.version.toLowerCase();
    results = results.filter(n => 
      n.version?.toLowerCase().includes(versionLower)
    );
  }
  
  if (filter.city) {
    const cityLower = filter.city.toLowerCase();
    results = results.filter(n => 
      n.geo?.city?.toLowerCase().includes(cityLower)
    );
  }
  
  if (filter.hasPublicRpc !== undefined) {
    results = results.filter(n => n.hasPublicRpc === filter.hasPublicRpc);
  }
  
  return results;
}

// ============================================
// Statistics & Aggregates
// ============================================

/**
 * Calculate network statistics
 */
export function calculateNetworkStats(): NetworkStats {
  const nodes = getAllNodes();
  const onlineNodes = nodes.filter(n => n.status === "online");
  const offlineNodes = nodes.filter(n => n.status === "offline");
  const unknownNodes = nodes.filter(n => n.status === "unknown");
  const degradedNodes = nodes.filter(n => n.status === "degraded");
  const nodesWithStats = onlineNodes.filter(n => n.stats);
  
  // Summary
  const onlinePercent = nodes.length > 0 
    ? (onlineNodes.length / nodes.length) * 100 
    : 0;
  
  const avgHealthScore = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.healthScore || 0), 0) / onlineNodes.length
    : 0;
  
  const networkScore = Math.round((onlinePercent * 0.5) + (avgHealthScore * 0.5));
  
  // Count unique countries and versions
  const countriesSet = new Set<string>();
  const versionsSet = new Set<string>();
  nodes.forEach(n => {
    if (n.geo?.country) countriesSet.add(n.geo.country);
    if (n.version) versionsSet.add(n.version);
  });
  
  const summary: NetworkSummary = {
    totalNodes: nodes.length,
    onlineNodes: onlineNodes.length,
    offlineNodes: offlineNodes.length,
    unknownNodes: unknownNodes.length,
    degradedNodes: degradedNodes.length,
    onlinePercent: Math.round(onlinePercent * 10) / 10,
    networkScore,
    uniqueCountries: countriesSet.size,
    uniqueVersions: versionsSet.size,
  };
  
  // Performance
  const avgCpu = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) / nodesWithStats.length
    : 0;
  
  const avgRam = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.derived?.ramUsagePercent || 0), 0) / nodesWithStats.length
    : 0;
  
  const avgUptimeSeconds = nodesWithStats.length > 0
    ? nodesWithStats.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / nodesWithStats.length
    : 0;
  
  const maxUptimeSeconds = nodesWithStats.length > 0
    ? Math.max(...nodesWithStats.map(n => n.stats?.uptime || 0))
    : 0;
  
  const performance: NetworkPerformance = {
    avgCpuPercent: Math.round(avgCpu * 100) / 100,
    avgRamPercent: Math.round(avgRam * 100) / 100,
    avgHealthScore: Math.round(avgHealthScore),
    avgUptimeSeconds: Math.round(avgUptimeSeconds),
    avgUptimeHuman: formatUptime(avgUptimeSeconds),
    maxUptimeSeconds,
    maxUptimeHuman: formatUptime(maxUptimeSeconds),
  };
  
  // Storage
  const totalRamBytes = nodesWithStats.reduce((acc, n) => acc + (n.stats?.ram_total || 0), 0);
  const usedRamBytes = nodesWithStats.reduce((acc, n) => acc + (n.stats?.ram_used || 0), 0);
  const totalPages = nodes.reduce((acc, n) => acc + (n.stats?.total_pages || 0), 0);
  
  const storage: NetworkStorage = {
    totalRamBytes,
    usedRamBytes,
    totalRamHuman: formatBytes(totalRamBytes),
    usedRamHuman: formatBytes(usedRamBytes),
    ramUtilizationPercent: totalRamBytes > 0 
      ? Math.round((usedRamBytes / totalRamBytes) * 10000) / 100 
      : 0,
    totalPages,
    nodesReporting: nodesWithStats.length,
  };
  
  // Traffic
  const totalPacketsSent = nodes.reduce((acc, n) => acc + (n.stats?.packets_sent || 0), 0);
  const totalPacketsReceived = nodes.reduce((acc, n) => acc + (n.stats?.packets_received || 0), 0);
  const totalActiveStreams = nodes.reduce((acc, n) => acc + (n.stats?.active_streams || 0), 0);
  const totalUptime = nodesWithStats.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0);
  
  const traffic: NetworkTraffic = {
    totalPacketsSent,
    totalPacketsReceived,
    totalPackets: totalPacketsSent + totalPacketsReceived,
    avgPacketsPerSecond: totalUptime > 0 
      ? Math.round(((totalPacketsSent + totalPacketsReceived) / totalUptime) * 100) / 100
      : 0,
    totalActiveStreams,
  };
  
  // Distribution
  const versions: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const statusDist: Record<NodeStatus, number> = { online: 0, offline: 0, unknown: 0, degraded: 0 };
  const health = { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 };
  
  nodes.forEach(n => {
    // Version
    const v = n.version || "Unknown";
    versions[v] = (versions[v] || 0) + 1;
    
    // Country
    if (n.geo?.country) {
      countries[n.geo.country] = (countries[n.geo.country] || 0) + 1;
    }
    
    // Status
    statusDist[n.status] = (statusDist[n.status] || 0) + 1;
    
    // Health (only for online nodes)
    if (n.status === "online") {
      const score = n.derived?.healthScore || 0;
      if (score >= 80) health.excellent++;
      else if (score >= 60) health.good++;
      else if (score >= 40) health.fair++;
      else if (score >= 20) health.poor++;
      else health.critical++;
    }
  });
  
  const distribution: DistributionData = {
    versions,
    countries,
    status: statusDist,
    health,
  };
  
  return {
    summary,
    performance,
    storage,
    traffic,
    distribution,
    lastSync: state.lastSync,
    syncStatus: state.syncStatus,
  };
}

/**
 * Get network averages for comparison
 */
export function getNetworkAverages(): {
  cpuPercent: number;
  ramPercent: number;
  uptimeSeconds: number;
  healthScore: number;
} {
  const stats = calculateNetworkStats();
  return {
    cpuPercent: stats.performance.avgCpuPercent,
    ramPercent: stats.performance.avgRamPercent,
    uptimeSeconds: stats.performance.avgUptimeSeconds,
    healthScore: stats.performance.avgHealthScore,
  };
}

/**
 * Get map markers for visualization
 */
export function getMapMarkers(): MapMarker[] {
  return getAllNodes()
    .filter(n => n.geo?.latitude && n.geo?.longitude)
    .map(n => ({
      ip: n.ip,
      lat: n.geo!.latitude,
      lng: n.geo!.longitude,
      status: n.status,
      healthScore: n.derived?.healthScore || 0,
      country: n.geo?.country || "Unknown",
      city: n.geo?.city || "Unknown",
    }));
}

// ============================================
// Sync State Management
// ============================================

export function setSyncStatus(status: "syncing" | "idle" | "error"): void {
  state.syncStatus = status;
  if (status === "idle") {
    state.lastSync = new Date();
    state.syncCount++;
  }
}

export function getSyncStatus(): { 
  status: "syncing" | "idle" | "error"; 
  lastSync: Date | null; 
  syncCount: number;
  uptime: number;
} {
  return {
    status: state.syncStatus,
    lastSync: state.lastSync,
    syncCount: state.syncCount,
    uptime: Math.floor((Date.now() - state.startTime.getTime()) / 1000),
  };
}

export function getStoreSize(): number {
  return state.nodes.size;
}

/**
 * Clear all nodes (useful for testing)
 */
export function clearStore(): void {
  state.nodes.clear();
  state.lastSync = null;
  state.syncCount = 0;
  logger.info("Store cleared");
}
