import { NetworkStats, PNodesResponse, AIQueryResponse, AISearchResponse, BriefingResult, Node } from "./types";

// Use Next.js API routes (all requests go to /api/*)
const API_BASE = "/api";

export async function fetchStats(): Promise<NetworkStats> {
  const response = await fetch(`${API_BASE}/stats`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function fetchNodes(): Promise<PNodesResponse> {
  const response = await fetch(`${API_BASE}/pnodes`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch nodes');
  const nodes = await response.json();
  
  // Calculate metadata
  const onlineNodes = nodes.filter((n: any) => n.status === 'Online');
  const totalRam = nodes.reduce((sum: number, n: any) => sum + (n.stats?.ram_total || 0), 0);
  const usedRam = nodes.reduce((sum: number, n: any) => sum + (n.stats?.ram_used || 0), 0);
  const totalPacketsSent = nodes.reduce((sum: number, n: any) => sum + (n.stats?.packets_sent || 0), 0);
  const totalPacketsReceived = nodes.reduce((sum: number, n: any) => sum + (n.stats?.packets_received || 0), 0);
  
  return {
    meta: {
      total_nodes: nodes.length,
      online_nodes: onlineNodes.length,
      offline_nodes: nodes.filter((n: any) => n.status === 'Offline').length,
      unknown_nodes: nodes.filter((n: any) => n.status === 'Unknown').length,
      last_sync: new Date().toISOString(),
      ram: {
        total_bytes: totalRam,
        used_bytes: usedRam,
        total_human: `${(totalRam / 1024 / 1024 / 1024).toFixed(1)} GB`,
        used_human: `${(usedRam / 1024 / 1024 / 1024).toFixed(1)} GB`,
        utilization_percent: totalRam > 0 ? (usedRam / totalRam) * 100 : 0
      },
      storage: {
        total_pages: nodes.reduce((sum: number, n: any) => sum + (n.stats?.total_pages || 0), 0),
        nodes_reporting: nodes.filter((n: any) => n.stats?.total_pages).length
      },
      traffic: {
        total_packets_sent: totalPacketsSent,
        total_packets_received: totalPacketsReceived,
        total_packets: totalPacketsSent + totalPacketsReceived
      },
      health: {
        avg_cpu_percent: onlineNodes.reduce((sum: number, n: any) => sum + (n.stats?.cpu_percent || 0), 0) / (onlineNodes.length || 1),
        avg_ram_percent: onlineNodes.reduce((sum: number, n: any) => sum + ((n.stats?.ram_used / n.stats?.ram_total * 100) || 0), 0) / (onlineNodes.length || 1),
        avg_health_score: onlineNodes.reduce((sum: number, n: any) => sum + (n.derived?.health_score || 0), 0) / (onlineNodes.length || 1),
        avg_uptime_seconds: onlineNodes.reduce((sum: number, n: any) => sum + (n.stats?.uptime || 0), 0) / (onlineNodes.length || 1),
        avg_uptime_human: '0d 0h'
      }
    },
    nodes
  };
}

export async function fetchNodeDetails(ip: string): Promise<{ node: Node; fetched_at: string }> {
  const response = await fetch(`${API_BASE}/pnodes`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch nodes');
  const nodes = await response.json();
  const node = nodes.find((n: any) => n.ip === ip);
  return { node, fetched_at: new Date().toISOString() };
}

export async function askAI(question: string): Promise<AIQueryResponse> {
  const response = await fetch(`${API_BASE}/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Failed to ask AI');
  return response.json();
}

export async function searchAI(query: string): Promise<AISearchResponse> {
  const response = await fetch(`${API_BASE}/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: query }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Failed to search');
  return response.json();
}

export async function fetchBriefing(): Promise<BriefingResult> {
  // For now, return a default since we don't have this endpoint yet
  return {
    briefing: "Network briefing coming soon",
    generated_at: new Date().toISOString(),
    network_snapshot: {
      total_nodes: 0,
      online_nodes: 0,
      network_score: 0,
      countries_count: 0
    }
  };
}

export async function diagnoseNode(ip: string): Promise<{
  diagnosis: {
    status: "Healthy" | "Warning" | "Critical";
    summary: string;
    recommendations: string[];
    metrics_comparison: {
      cpu: { node: number; network_avg: number; status: string };
      ram: { node: number; network_avg: number; status: string };
      uptime: { node: string; network_avg: string; status: string };
    };
  };
  node_data: Record<string, unknown>;
  network_averages: Record<string, unknown>;
  generated_at: string;
}> {
  const response = await fetch(`${API_BASE}/ai/diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Failed to diagnose node');
  const data = await response.json();
  return {
    ...data,
    node_data: {},
    network_averages: {},
    generated_at: new Date().toISOString()
  };
}
