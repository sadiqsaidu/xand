import OpenAI from "openai";

// OpenRouter Configuration
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const MODEL = "meta-llama/llama-3-8b-instruct:free";

// Initialize OpenAI client pointing to OpenRouter
export const openai = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: process.env.OPENROUTER_API_KEY || "",
  defaultHeaders: {
    "HTTP-Referer": "https://xandeum.network", // Required by OpenRouter
    "X-Title": "Xandeum Analytics Dashboard",
  },
});

export const AI_MODEL = MODEL;

// Type definitions for AI responses
export interface SearchFilter {
  country?: string;
  status?: "Online" | "Offline" | "Unknown";
  min_ram_gb?: number;
  max_ram_gb?: number;
  min_storage_gb?: number;
  max_storage_gb?: number;
  min_cpu_percent?: number;
  max_cpu_percent?: number;
  min_health_score?: number;
  version?: string;
}

export interface DiagnosisResult {
  status: "Healthy" | "Warning" | "Critical";
  summary: string;
  recommendations: string[];
  metrics_comparison: {
    cpu: { node: number; network_avg: number; status: string };
    ram: { node: number; network_avg: number; status: string };
    uptime: { node: string; network_avg: string; status: string };
  };
}

export interface BriefingResult {
  generated_at: string;
  bullets: string[];
  headline: string;
  cached: boolean;
}

// System prompts
export const SEARCH_SYSTEM_PROMPT = `You are a query translator for a network monitoring dashboard. Convert user natural language queries into a JSON filter object.

Available filter keys:
- country: string (country name, e.g., "Germany", "United States", "Finland")
- status: "Online" | "Offline" | "Unknown"
- min_ram_gb: number (minimum RAM in GB)
- max_ram_gb: number (maximum RAM in GB)
- min_storage_gb: number (minimum storage in GB)
- max_storage_gb: number (maximum storage in GB)
- min_cpu_percent: number (minimum CPU usage percentage)
- max_cpu_percent: number (maximum CPU usage percentage)
- min_health_score: number (minimum health score 0-100)
- version: string (software version)

Rules:
1. Return ONLY valid JSON, no explanation
2. Only include keys that the user explicitly mentions
3. If user says "healthy", set min_health_score to 70
4. If user says "high RAM" or "> X GB RAM", use min_ram_gb
5. If user says "low CPU", use max_cpu_percent with value 30
6. If query is unclear or asks for non-existent data, return {}
7. Country names should be properly capitalized

Examples:
- "nodes in Germany" → {"country": "Germany"}
- "healthy nodes with high RAM" → {"min_health_score": 70, "min_ram_gb": 16}
- "offline nodes" → {"status": "Offline"}
- "show me everything" → {}`;

export const DIAGNOSE_SYSTEM_PROMPT = `You are a network node diagnostic assistant. Analyze the provided node statistics compared to network averages and provide a health assessment.

Your response MUST be valid JSON with this exact structure:
{
  "status": "Healthy" | "Warning" | "Critical",
  "summary": "A one-sentence summary of the node's health",
  "recommendations": ["Array of 1-3 actionable recommendations"]
}

Rules:
1. Base your analysis ONLY on the provided metrics - never invent data
2. Status criteria:
   - "Healthy": CPU < 70%, RAM < 80%, performing at or above network average
   - "Warning": CPU 70-90% OR RAM 80-95% OR significantly below network average
   - "Critical": CPU > 90% OR RAM > 95% OR node offline
3. Be specific in recommendations - reference actual numbers
4. Keep summary under 100 characters
5. Return ONLY valid JSON`;

export const BRIEFING_SYSTEM_PROMPT = `You are a network analyst writing a daily briefing for a blockchain storage network dashboard.

Write a concise 3-bullet point briefing based STRICTLY on the provided metrics. Do not invent any statistics or news.

Format your response as valid JSON:
{
  "headline": "A catchy 5-7 word headline summarizing the network state",
  "bullets": [
    "First key insight based on the data",
    "Second key insight based on the data", 
    "Third key insight based on the data"
  ]
}

Rules:
1. Only reference numbers explicitly provided to you
2. Use professional but accessible language
3. Highlight notable patterns (e.g., geographic concentration, version adoption)
4. Keep each bullet under 100 characters
5. Be factual, not speculative
6. Return ONLY valid JSON`;
