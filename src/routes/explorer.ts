/**
 * Xandeum Explorer - Explorer Routes
 * Main API routes for the network explorer (Orb-inspired)
 */

import { Hono } from "hono";
import * as store from "../services/store";
import { syncOnce, getSyncConfig } from "../services/sync";
import { formatBytes, formatUptime } from "../lib/format";
import logger from "../lib/logger";
import type { XandeumNode, NodeSearchFilter } from "../types";

const explorer = new Hono();

// ============================================
// Health Check
// ============================================

explorer.get("/health", (c) => {
  const syncStatus = store.getSyncStatus();
  const syncConfig = getSyncConfig();
  
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: syncStatus.uptime,
    uptimeHuman: formatUptime(syncStatus.uptime),
    sync: {
      status: syncStatus.status,
      lastSync: syncStatus.lastSync?.toISOString() || null,
      syncCount: syncStatus.syncCount,
      interval: syncConfig.intervalMs,
      isRunning: syncConfig.isRunning,
    },
    store: {
      totalNodes: store.getStoreSize(),
    },
    version: process.env.npm_package_version || "1.0.0",
  });
});

// ============================================
// Network Overview (Like Orb's network stats page)
// ============================================

explorer.get("/network", (c) => {
  const stats = store.calculateNetworkStats();
  
  return c.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
});

explorer.get("/network/summary", (c) => {
  const stats = store.calculateNetworkStats();
  
  return c.json({
    summary: stats.summary,
    performance: stats.performance,
    lastSync: stats.lastSync?.toISOString() || null,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Nodes List (Like Orb's validators page)
// ============================================

explorer.get("/nodes", (c) => {
  const nodes = store.getAllNodes();
  const stats = store.calculateNetworkStats();
  
  // Sort options
  const sortBy = c.req.query("sort") || "health";
  const order = c.req.query("order") || "desc";
  const limit = parseInt(c.req.query("limit") || "100", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  
  // Sort nodes
  let sortedNodes = [...nodes];
  
  switch (sortBy) {
    case "health":
      sortedNodes.sort((a, b) => 
        (b.derived?.healthScore || 0) - (a.derived?.healthScore || 0)
      );
      break;
    case "cpu":
      sortedNodes.sort((a, b) => 
        (a.stats?.cpu_percent || 0) - (b.stats?.cpu_percent || 0)
      );
      break;
    case "ram":
      sortedNodes.sort((a, b) => 
        (a.derived?.ramUsagePercent || 0) - (b.derived?.ramUsagePercent || 0)
      );
      break;
    case "uptime":
      sortedNodes.sort((a, b) => 
        (b.stats?.uptime || 0) - (a.stats?.uptime || 0)
      );
      break;
    case "lastSeen":
      sortedNodes.sort((a, b) => 
        (b.lastSeenTimestamp || 0) - (a.lastSeenTimestamp || 0)
      );
      break;
    case "country":
      sortedNodes.sort((a, b) => 
        (a.geo?.country || "ZZZ").localeCompare(b.geo?.country || "ZZZ")
      );
      break;
  }
  
  if (order === "asc") {
    sortedNodes.reverse();
  }
  
  // Paginate
  const paginatedNodes = sortedNodes.slice(offset, offset + limit);
  
  return c.json({
    meta: {
      ...stats.summary,
      lastSync: stats.lastSync?.toISOString() || null,
      storage: stats.storage,
      traffic: stats.traffic,
      performance: stats.performance,
    },
    pagination: {
      total: nodes.length,
      limit,
      offset,
      hasMore: offset + limit < nodes.length,
    },
    nodes: paginatedNodes,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Node Detail (Like Orb's address page)
// ============================================

explorer.get("/node/:ip", (c) => {
  const ip = decodeURIComponent(c.req.param("ip"));
  const node = store.getNode(ip);
  
  if (!node) {
    return c.json({ 
      error: "Node not found", 
      ip,
      suggestion: "Check if the IP is correct or wait for next sync"
    }, 404);
  }
  
  const networkAvg = store.getNetworkAverages();
  
  // Calculate comparison to network
  const comparison = {
    cpuVsAvg: node.stats?.cpu_percent 
      ? Math.round((node.stats.cpu_percent - networkAvg.cpuPercent) * 10) / 10
      : null,
    ramVsAvg: node.derived?.ramUsagePercent
      ? Math.round((node.derived.ramUsagePercent - networkAvg.ramPercent) * 10) / 10
      : null,
    uptimeVsAvg: node.stats?.uptime
      ? Math.round(((node.stats.uptime - networkAvg.uptimeSeconds) / 3600) * 10) / 10
      : null,
    healthVsAvg: node.derived?.healthScore
      ? node.derived.healthScore - networkAvg.healthScore
      : null,
  };
  
  return c.json({
    node,
    networkComparison: comparison,
    networkAverages: networkAvg,
    fetchedAt: new Date().toISOString(),
  });
});

// ============================================
// Search (Natural language + filters)
// ============================================

explorer.get("/search", (c) => {
  // Build filter from query params
  const filter: NodeSearchFilter = {};
  
  const country = c.req.query("country");
  if (country) filter.country = country;
  
  const status = c.req.query("status") as NodeSearchFilter["status"];
  if (status) filter.status = status;
  
  const minHealth = c.req.query("minHealth");
  if (minHealth) filter.minHealthScore = parseInt(minHealth, 10);
  
  const maxCpu = c.req.query("maxCpu");
  if (maxCpu) filter.maxCpuPercent = parseInt(maxCpu, 10);
  
  const version = c.req.query("version");
  if (version) filter.version = version;
  
  const hasRpc = c.req.query("hasRpc");
  if (hasRpc) filter.hasPublicRpc = hasRpc === "true";
  
  const results = store.searchNodes(filter);
  
  // Calculate summary of results
  const onlineCount = results.filter(n => n.status === "online").length;
  const offlineCount = results.filter(n => n.status === "offline").length;
  const avgHealth = results.length > 0
    ? results.reduce((acc, n) => acc + (n.derived?.healthScore || 0), 0) / results.length
    : 0;
  
  // Country breakdown
  const countryBreakdown: Record<string, number> = {};
  results.forEach(n => {
    if (n.geo?.country) {
      countryBreakdown[n.geo.country] = (countryBreakdown[n.geo.country] || 0) + 1;
    }
  });
  
  return c.json({
    filter,
    totalMatches: results.length,
    summary: {
      online: onlineCount,
      offline: offlineCount,
      avgHealthScore: Math.round(avgHealth),
      countries: countryBreakdown,
    },
    nodes: results.slice(0, 100), // Limit results
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Geographic Data (For map visualization)
// ============================================

explorer.get("/map", (c) => {
  const markers = store.getMapMarkers();
  const stats = store.calculateNetworkStats();
  
  return c.json({
    markers,
    totalMarkers: markers.length,
    countries: stats.distribution.countries,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Distribution Data (For charts)
// ============================================

explorer.get("/distribution/versions", (c) => {
  const stats = store.calculateNetworkStats();
  
  // Sort by count descending
  const sorted = Object.entries(stats.distribution.versions)
    .sort(([, a], [, b]) => b - a);
  
  return c.json({
    versions: Object.fromEntries(sorted),
    total: sorted.length,
    timestamp: new Date().toISOString(),
  });
});

explorer.get("/distribution/countries", (c) => {
  const stats = store.calculateNetworkStats();
  
  // Sort by count descending
  const sorted = Object.entries(stats.distribution.countries)
    .sort(([, a], [, b]) => b - a);
  
  return c.json({
    countries: Object.fromEntries(sorted),
    total: sorted.length,
    timestamp: new Date().toISOString(),
  });
});

explorer.get("/distribution/health", (c) => {
  const stats = store.calculateNetworkStats();
  
  return c.json({
    health: stats.distribution.health,
    avgScore: stats.performance.avgHealthScore,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Manual Sync Trigger (Admin)
// ============================================

explorer.post("/sync", async (c) => {
  // Optional auth check
  const syncToken = process.env.SYNC_TOKEN;
  if (syncToken) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || authHeader !== `Bearer ${syncToken}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  
  logger.info("Manual sync triggered");
  
  const result = await syncOnce();
  
  return c.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Leaderboards (Orb-inspired)
// ============================================

explorer.get("/leaderboard/health", (c) => {
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const nodes = store.getAllNodes()
    .filter(n => n.status === "online")
    .sort((a, b) => (b.derived?.healthScore || 0) - (a.derived?.healthScore || 0))
    .slice(0, limit);
  
  return c.json({
    title: "Healthiest Nodes",
    nodes: nodes.map((n, i) => ({
      rank: i + 1,
      ip: n.ip,
      healthScore: n.derived?.healthScore || 0,
      healthGrade: n.derived?.healthGrade || "unknown",
      country: n.geo?.country || "Unknown",
      uptime: n.derived?.uptimeHuman || "N/A",
    })),
    timestamp: new Date().toISOString(),
  });
});

explorer.get("/leaderboard/uptime", (c) => {
  const limit = parseInt(c.req.query("limit") || "10", 10);
  const nodes = store.getAllNodes()
    .filter(n => n.stats?.uptime)
    .sort((a, b) => (b.stats?.uptime || 0) - (a.stats?.uptime || 0))
    .slice(0, limit);
  
  return c.json({
    title: "Longest Running Nodes",
    nodes: nodes.map((n, i) => ({
      rank: i + 1,
      ip: n.ip,
      uptimeSeconds: n.stats?.uptime || 0,
      uptimeHuman: n.derived?.uptimeHuman || "N/A",
      country: n.geo?.country || "Unknown",
      healthScore: n.derived?.healthScore || 0,
    })),
    timestamp: new Date().toISOString(),
  });
});

export default explorer;
