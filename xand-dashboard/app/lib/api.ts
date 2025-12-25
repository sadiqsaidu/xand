import axios from "axios";
import { NetworkStats, PNodesResponse, AIQueryResponse, AISearchResponse, BriefingResult, Node } from "./types";

const API_BASE = "http://localhost:3000";

export async function fetchStats(): Promise<NetworkStats> {
  const response = await axios.get<NetworkStats>(`${API_BASE}/stats`);
  return response.data;
}

export async function fetchNodes(): Promise<PNodesResponse> {
  const response = await axios.get<PNodesResponse>(`${API_BASE}/pnodes`);
  return response.data;
}

export async function fetchNodeDetails(ip: string): Promise<{ node: Node; fetched_at: string }> {
  const response = await axios.get(`${API_BASE}/pnodes/${ip}`);
  return response.data;
}

export async function askAI(question: string): Promise<AIQueryResponse> {
  const response = await axios.post<AIQueryResponse>(`${API_BASE}/ai/query`, { question });
  return response.data;
}

export async function searchAI(query: string): Promise<AISearchResponse> {
  const response = await axios.post<AISearchResponse>(`${API_BASE}/ai/search`, { query });
  return response.data;
}

export async function fetchBriefing(): Promise<BriefingResult> {
  const response = await axios.get<BriefingResult>(`${API_BASE}/ai/briefing`);
  return response.data;
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
  const response = await axios.post(`${API_BASE}/ai/diagnose`, { ip });
  return response.data;
}
