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
  const data = await response.json();
  return { pnodes: data };
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
