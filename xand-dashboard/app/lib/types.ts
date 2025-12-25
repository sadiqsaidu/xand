// Shared types that match backend API
export interface NodeStats {
  active_streams?: number;
  packets_received?: number;
  packets_sent?: number;
  file_size?: number;
  total_bytes?: number;
  total_pages?: number;
  current_index?: number;
  cpu_percent?: number;
  ram_used?: number;
  ram_total?: number;
  uptime?: number;
  last_updated?: number;
}

export interface DerivedMetrics {
  storage_utilization_percent: number;
  ram_usage_percent: number;
  uptime_human: string;
  packets_per_second: number;
  health_score: number;
}

export interface GeoLocation {
  country: string;
  city: string;
  lat?: number;
  lon?: number;
}

export interface Node {
  ip: string;
  address: string;
  version?: string;
  pubkey?: string | null;
  status: "Online" | "Offline" | "Unknown";
  lastSeen: Date | string | null;
  lastSeenTimestamp?: number | null;
  stats: NodeStats | null;
  geo: GeoLocation | null;
  derived: DerivedMetrics | null;
  stats_formatted?: {
    cpu: string;
    ram: string;
    uptime: string;
    packets: string;
    pages?: number;
  } | null;
}

export interface NetworkStats {
  network: {
    total_nodes: number;
    online_nodes: number;
    offline_nodes: number;
    unknown_nodes: number;
    online_percent: number;
    network_score: number;
    unique_countries: number;
    unique_versions: number;
    last_sync: string | null;
  };
  uptime: {
    avg_seconds: number;
    avg_human: string;
    max_seconds: number;
    max_human: string;
  };
  ram: {
    total_bytes: number;
    used_bytes: number;
    total_human: string;
    used_human: string;
    utilization_percent: number;
  };
  performance: {
    avg_cpu_percent: number;
    avg_ram_percent: number;
    avg_health_score: number;
  };
  versions: Record<string, number>;
  status_distribution: Record<string, number>;
  countries: Record<string, number>;
  health_distribution: Record<string, number>;
}

export interface PNodesResponse {
  meta: {
    total_nodes: number;
    online_nodes: number;
    offline_nodes: number;
    unknown_nodes: number;
    last_sync: string | null;
    ram: {
      total_bytes: number;
      used_bytes: number;
      total_human: string;
      used_human: string;
      utilization_percent: number;
    };
    storage: {
      total_pages: number;
      nodes_reporting: number;
    };
    traffic: {
      total_packets_sent: number;
      total_packets_received: number;
      total_packets: number;
    };
    health: {
      avg_cpu_percent: number;
      avg_ram_percent: number;
      avg_health_score: number;
      avg_uptime_seconds: number;
      avg_uptime_human: string;
    };
  };
  nodes: Node[];
}

export interface AIQueryResponse {
  question: string;
  answer: string;
  data_snapshot: {
    total_nodes: number;
    online_nodes: number;
    network_score: number;
    countries_count: number;
  };
  generated_at: string;
}

export interface AISearchResponse {
  filter: Record<string, unknown>;
  query: string;
  message: string;
  summary: {
    total_matches: number;
    online: number;
    offline: number;
    avg_health_score: number;
    countries: Record<string, number>;
  };
  sample_nodes: Array<{
    ip: string;
    country: string;
    status: string;
    health_score: number;
  }>;
}

export interface BriefingResult {
  headline: string;
  bullets: string[];
  generated_at: string;
  cached: boolean;
  error?: string;
}
