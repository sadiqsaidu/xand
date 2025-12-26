import { NetworkStats, PNodesResponse, AIQueryResponse, AISearchResponse, BriefingResult, Node } from "./types";

// Backend API URL - will be set via environment variable for production
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function fetchStats(): Promise<NetworkStats> {
  const response = await fetch(`${API_BASE}/network`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch stats');
  const data = await response.json();
  return data.stats;
}

export async function fetchNodes(): Promise<PNodesResponse> {
  const response = await fetch(`${API_BASE}/network`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch nodes');
  const data = await response.json();
  
  return {
    meta: data.meta,
    nodes: data.nodes
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
  const response = await fetch(`${API_BASE}/ai/briefing`, { cache: 'no-store' });
  if (!response.ok) {
    // Fallback if endpoint not available yet
    return {
      headline: "Network briefing coming soon",
      bullets: [
        "Real-time monitoring active",
        "AI analysis in development",
        "Check back soon for daily briefings"
      ],
      generated_at: new Date().toISOString(),
      cached: false
    };
  }
  return response.json()
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
  generated_at: string;/${encodeURIComponent(ip)}`, {
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Failed to diagnose node');
  return response.json() network_averages: {},
    generated_at: new Date().toISOString()
  };
}
