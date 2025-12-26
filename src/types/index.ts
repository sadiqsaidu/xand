/**
 * Xandeum Explorer - Core Type Definitions
 * Inspired by Orb's clean, human-readable approach to blockchain data
 */

import { z } from "zod";

// ============================================
// pRPC Response Schemas (from Xandeum network)
// ============================================

export const PodSchema = z.object({
  address: z.string(),
  version: z.string().optional(),
  pubkey: z.string().nullable().optional(),
  last_seen_timestamp: z.number().optional(),
});

export const GetPodsResultSchema = z.object({
  pods: PodSchema.array(),
  total_count: z.number().optional(),
});

export const NodeStatsSchema = z.object({
  // Network Activity
  active_streams: z.number().optional().default(0),
  packets_received: z.number().optional().default(0),
  packets_sent: z.number().optional().default(0),
  
  // Storage Metrics
  file_size: z.number().optional().default(0),
  total_bytes: z.number().optional().default(0),
  total_pages: z.number().optional().default(0),
  current_index: z.number().optional().default(0),
  
  // Hardware Metrics
  cpu_percent: z.number().optional().default(0),
  ram_used: z.number().optional().default(0),
  ram_total: z.number().optional().default(0),
  
  // System
  uptime: z.number().optional().default(0),
  last_updated: z.number().optional(),
  
  // Additional disk metrics (some nodes report these)
  disk_total: z.number().optional(),
  disk_used: z.number().optional(),
  disk_free: z.number().optional(),
});

export type Pod = z.infer<typeof PodSchema>;
export type NodeStats = z.infer<typeof NodeStatsSchema>;

// ============================================
// Geolocation Types
// ============================================

export interface GeoLocation {
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  city: string;
  region?: string;
  timezone?: string;
}

// ============================================
// Node Status & Health
// ============================================

export type NodeStatus = "online" | "offline" | "unknown" | "degraded";

export interface DerivedMetrics {
  ramUsagePercent: number;
  storageUtilizationPercent: number;
  uptimeHuman: string;
  packetsPerSecond: number;
  healthScore: number; // 0-100 composite score
  healthGrade: "excellent" | "good" | "fair" | "poor" | "critical";
}

// ============================================
// Core Node Model (Explorer View)
// ============================================

export interface XandeumNode {
  // Identity
  id: string; // Unique ID (IP-based)
  ip: string;
  address: string; // Full address (IP:port)
  pubkey: string | null;
  version: string | null;
  
  // Status
  status: NodeStatus;
  isOnline: boolean;
  hasPublicRpc: boolean;
  
  // Timestamps
  lastSeen: Date | null;
  lastSeenTimestamp: number | null;
  lastSeenAgo: string | null; // Human readable "2 hours ago"
  firstSeen: Date | null;
  
  // Raw Stats (from pRPC)
  stats: NodeStats | null;
  
  // Computed Metrics
  derived: DerivedMetrics | null;
  
  // Location
  geo: GeoLocation | null;
  
  // Formatted display values
  display: {
    cpu: string;
    ram: string;
    ramUsed: string;
    ramTotal: string;
    storage: string;
    uptime: string;
    packets: string;
    healthScore: string;
    location: string;
  } | null;
}

// ============================================
// Network Summary Statistics
// ============================================

export interface NetworkSummary {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unknownNodes: number;
  degradedNodes: number;
  onlinePercent: number;
  networkScore: number; // 0-100
  uniqueCountries: number;
  uniqueVersions: number;
}

export interface NetworkPerformance {
  avgCpuPercent: number;
  avgRamPercent: number;
  avgHealthScore: number;
  avgUptimeSeconds: number;
  avgUptimeHuman: string;
  maxUptimeSeconds: number;
  maxUptimeHuman: string;
}

export interface NetworkStorage {
  totalRamBytes: number;
  usedRamBytes: number;
  totalRamHuman: string;
  usedRamHuman: string;
  ramUtilizationPercent: number;
  totalPages: number;
  nodesReporting: number;
}

export interface NetworkTraffic {
  totalPacketsSent: number;
  totalPacketsReceived: number;
  totalPackets: number;
  avgPacketsPerSecond: number;
  totalActiveStreams: number;
}

export interface DistributionData {
  versions: Record<string, number>;
  countries: Record<string, number>;
  status: Record<NodeStatus, number>;
  health: {
    excellent: number; // 80-100
    good: number;      // 60-79
    fair: number;      // 40-59
    poor: number;      // 20-39
    critical: number;  // 0-19
  };
}

export interface NetworkStats {
  summary: NetworkSummary;
  performance: NetworkPerformance;
  storage: NetworkStorage;
  traffic: NetworkTraffic;
  distribution: DistributionData;
  lastSync: Date | null;
  syncStatus: "syncing" | "idle" | "error";
}

// ============================================
// API Response Types
// ============================================

export interface NodesListResponse {
  meta: NetworkSummary & {
    lastSync: Date | null;
    storage: NetworkStorage;
    traffic: NetworkTraffic;
    performance: NetworkPerformance;
  };
  nodes: XandeumNode[];
  timestamp: string;
}

export interface NodeDetailResponse {
  node: XandeumNode;
  networkComparison: {
    cpuVsAvg: number;
    ramVsAvg: number;
    uptimeVsAvg: number;
    healthVsAvg: number;
  };
  fetchedAt: string;
}

export interface NetworkStatsResponse extends NetworkStats {
  timestamp: string;
}

// ============================================
// Search & Filter Types
// ============================================

export interface NodeSearchFilter {
  country?: string;
  status?: NodeStatus;
  minRamGb?: number;
  maxRamGb?: number;
  minStorageGb?: number;
  maxStorageGb?: number;
  minCpuPercent?: number;
  maxCpuPercent?: number;
  minHealthScore?: number;
  maxHealthScore?: number;
  version?: string;
  city?: string;
  hasPublicRpc?: boolean;
}

export interface SearchResult {
  filter: NodeSearchFilter;
  query: string;
  totalMatches: number;
  summary: {
    online: number;
    offline: number;
    avgHealthScore: number;
    countries: Record<string, number>;
  };
  nodes: XandeumNode[];
}

// ============================================
// AI Types
// ============================================

export interface AIDiagnosis {
  status: "healthy" | "warning" | "critical";
  summary: string;
  recommendations: string[];
  metricsComparison: {
    cpu: { node: number; networkAvg: number; status: string };
    ram: { node: number; networkAvg: number; status: string };
    uptime: { node: string; networkAvg: string; status: string };
  };
}

export interface AIBriefing {
  headline: string;
  bullets: string[];
  insights: string[];
  generatedAt: string;
  cached: boolean;
}

export interface AIQueryResult {
  question: string;
  answer: string;
  dataSnapshot: {
    totalNodes: number;
    onlineNodes: number;
    networkScore: number;
    countriesCount: number;
  };
  generatedAt: string;
}

// ============================================
// Activity & Timeline (Orb-inspired)
// ============================================

export interface NodeActivityPoint {
  timestamp: Date;
  status: NodeStatus;
  healthScore: number;
  cpuPercent: number;
  ramPercent: number;
}

export interface NodeHeatmapData {
  date: string; // YYYY-MM-DD
  transactionCount: number; // For Xandeum: could be packet count
  intensity: number; // 0-1 normalized
}

// ============================================
// Explorer-specific Types
// ============================================

export interface ExplorerSearchResult {
  type: "node" | "pubkey" | "country" | "version";
  value: string;
  displayName: string;
  count?: number;
}

export interface MapMarker {
  ip: string;
  lat: number;
  lng: number;
  status: NodeStatus;
  healthScore: number;
  country: string;
  city: string;
}
