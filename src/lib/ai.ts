/**
 * Xandeum Explorer - AI Service
 * AI-powered features: search, diagnostics, briefings, explanations
 */

import OpenAI from "openai";
import logger from "./logger";
import type { 
  NodeSearchFilter, 
  AIDiagnosis, 
  AIBriefing, 
  AIQueryResult,
  XandeumNode,
  NetworkStats
} from "../types";

// Configuration
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const AI_MODEL = process.env.AI_MODEL || "meta-llama/llama-3.2-3b-instruct:free";

// Initialize OpenAI client pointing to OpenRouter
export const openai = new OpenAI({
  baseURL: OPENROUTER_BASE_URL,
  apiKey: process.env.OPENROUTER_API_KEY || "",
  defaultHeaders: {
    "HTTP-Referer": "https://xandeum.network",
    "X-Title": "Xandeum Explorer",
  },
});

// ============================================
// System Prompts
// ============================================

export const SYSTEM_PROMPTS = {
  search: `You are a query translator for a Xandeum network explorer. Convert user natural language queries into a JSON filter object.

Available filter keys:
- country: string (country name, e.g., "Germany", "United States")
- status: "online" | "offline" | "unknown" | "degraded"
- minRamGb: number (minimum RAM in GB)
- maxRamGb: number (maximum RAM in GB)
- minCpuPercent: number (minimum CPU usage)
- maxCpuPercent: number (maximum CPU usage)
- minHealthScore: number (minimum health score 0-100)
- version: string (software version)
- hasPublicRpc: boolean

Rules:
1. Return ONLY valid JSON, no explanation
2. Only include keys explicitly mentioned
3. "healthy" = minHealthScore: 70
4. "low CPU" = maxCpuPercent: 30
5. Country names should be properly capitalized
6. Return {} for unclear queries

Examples:
- "nodes in Germany" → {"country": "Germany"}
- "healthy nodes" → {"minHealthScore": 70}
- "offline nodes" → {"status": "offline"}`,

  diagnose: `You are a network node diagnostic assistant for Xandeum. Analyze node statistics and provide a health assessment.

Your response MUST be valid JSON:
{
  "status": "healthy" | "warning" | "critical",
  "summary": "One-sentence summary (max 100 chars)",
  "recommendations": ["1-3 actionable recommendations"]
}

Rules:
1. Base analysis ONLY on provided metrics
2. healthy: CPU < 70%, RAM < 80%, good uptime
3. warning: CPU 70-90% OR RAM 80-95%
4. critical: CPU > 90% OR RAM > 95% OR offline
5. Return ONLY valid JSON`,

  briefing: `You are a network analyst for Xandeum. Write a concise briefing based STRICTLY on provided metrics.

Format as valid JSON:
{
  "headline": "5-7 word headline",
  "bullets": ["3 key insights, each under 100 chars"],
  "insights": ["1-2 deeper observations"]
}

Rules:
1. Only reference provided numbers
2. Professional but accessible language
3. Highlight notable patterns
4. Return ONLY valid JSON`,

  query: `You are an AI assistant for the Xandeum network explorer. Answer questions based ONLY on the provided real-time data.

Data includes: total nodes, online/offline counts, geographic distribution, health scores, version distribution.

Rules:
1. ONLY use provided data - never invent statistics
2. If data doesn't contain the answer, say so
3. Be concise but informative
4. Include relevant numbers`,

  explain: `You are an explainer for the Xandeum decentralized storage network. Explain node details in simple, human-readable terms.

The user is viewing a specific node's details. Explain what the metrics mean and whether the node is performing well.

Rules:
1. Use simple language, avoid jargon
2. Compare to network averages when provided
3. Highlight notable aspects
4. Keep response under 150 words`,
};

// ============================================
// AI Feature: Magic Search
// ============================================

export async function aiParseSearchQuery(query: string): Promise<NodeSearchFilter> {
  try {
    logger.ai("search", `Parsing: "${query}"`);
    
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.search },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {};
  } catch (error) {
    logger.error("AI search parse failed", { error: (error as Error).message });
    return {};
  }
}

// ============================================
// AI Feature: Node Diagnostics
// ============================================

export async function aiDiagnoseNode(
  node: XandeumNode,
  networkAvg: { cpuPercent: number; ramPercent: number; uptimeSeconds: number; healthScore: number }
): Promise<AIDiagnosis> {
  try {
    logger.ai("diagnose", `Analyzing node ${node.ip}`);
    
    const prompt = `
Analyze this Xandeum node:

NODE STATS:
- IP: ${node.ip}
- Status: ${node.status}
- Location: ${node.geo?.city || "Unknown"}, ${node.geo?.country || "Unknown"}
- Version: ${node.version || "Unknown"}
- CPU Usage: ${node.stats?.cpu_percent?.toFixed(1) || 0}%
- RAM Usage: ${node.derived?.ramUsagePercent?.toFixed(1) || 0}%
- Uptime: ${node.derived?.uptimeHuman || "N/A"}
- Health Score: ${node.derived?.healthScore || 0}/100

NETWORK AVERAGES:
- Average CPU: ${networkAvg.cpuPercent.toFixed(1)}%
- Average RAM: ${networkAvg.ramPercent.toFixed(1)}%
- Average Health: ${networkAvg.healthScore.toFixed(0)}/100

Provide your diagnosis.`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.diagnose },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        status: parsed.status || "warning",
        summary: parsed.summary || "Unable to generate summary",
        recommendations: parsed.recommendations || [],
        metricsComparison: {
          cpu: {
            node: node.stats?.cpu_percent || 0,
            networkAvg: networkAvg.cpuPercent,
            status: (node.stats?.cpu_percent || 0) <= networkAvg.cpuPercent * 1.2 ? "good" : "elevated",
          },
          ram: {
            node: node.derived?.ramUsagePercent || 0,
            networkAvg: networkAvg.ramPercent,
            status: (node.derived?.ramUsagePercent || 0) <= networkAvg.ramPercent * 1.2 ? "good" : "elevated",
          },
          uptime: {
            node: node.derived?.uptimeHuman || "N/A",
            networkAvg: `${Math.round(networkAvg.uptimeSeconds / 3600)}h`,
            status: (node.stats?.uptime || 0) >= networkAvg.uptimeSeconds * 0.8 ? "good" : "low",
          },
        },
      };
    }
    
    throw new Error("No JSON in response");
  } catch (error) {
    logger.error("AI diagnosis failed", { error: (error as Error).message });
    
    // Fallback diagnosis based on raw metrics
    const healthScore = node.derived?.healthScore || 0;
    return {
      status: healthScore >= 70 ? "healthy" : healthScore >= 40 ? "warning" : "critical",
      summary: `Node health score: ${healthScore}/100`,
      recommendations: ["Monitor resource usage", "Check network connectivity"],
      metricsComparison: {
        cpu: { node: node.stats?.cpu_percent || 0, networkAvg: networkAvg.cpuPercent, status: "unknown" },
        ram: { node: node.derived?.ramUsagePercent || 0, networkAvg: networkAvg.ramPercent, status: "unknown" },
        uptime: { node: node.derived?.uptimeHuman || "N/A", networkAvg: "unknown", status: "unknown" },
      },
    };
  }
}

// ============================================
// AI Feature: Network Briefing
// ============================================

export async function aiGenerateBriefing(stats: NetworkStats): Promise<AIBriefing> {
  try {
    logger.ai("briefing", "Generating network briefing");
    
    const topCountry = Object.entries(stats.distribution.countries)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];
    
    const topVersion = Object.entries(stats.distribution.versions)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];
    
    const prompt = `
XANDEUM NETWORK METRICS (${new Date().toLocaleString()}):

NETWORK STATUS:
- Total Nodes: ${stats.summary.totalNodes}
- Online: ${stats.summary.onlineNodes} (${stats.summary.onlinePercent.toFixed(1)}%)
- Offline: ${stats.summary.offlineNodes}
- Network Score: ${stats.summary.networkScore}/100
- Average Health: ${stats.performance.avgHealthScore}/100

STORAGE:
- Total RAM: ${stats.storage.totalRamHuman}
- RAM Utilization: ${stats.storage.ramUtilizationPercent.toFixed(1)}%

GEOGRAPHY:
- Top Country: ${topCountry ? `${topCountry[0]} (${topCountry[1]} nodes)` : "Unknown"}
- Countries: ${stats.summary.uniqueCountries}

SOFTWARE:
- Top Version: ${topVersion ? `${topVersion[0]} (${topVersion[1]} nodes)` : "Unknown"}
- Versions: ${stats.summary.uniqueVersions}

Generate the briefing.`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.briefing },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 400,
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        headline: parsed.headline || "Network Status Update",
        bullets: parsed.bullets || [],
        insights: parsed.insights || [],
        generatedAt: new Date().toISOString(),
        cached: false,
      };
    }
    
    throw new Error("No JSON in response");
  } catch (error) {
    logger.error("AI briefing failed", { error: (error as Error).message });
    
    return {
      headline: "Network Status Update",
      bullets: [
        `${stats.summary.onlineNodes} of ${stats.summary.totalNodes} nodes online`,
        `Network score: ${stats.summary.networkScore}/100`,
        `Operating across ${stats.summary.uniqueCountries} countries`,
      ],
      insights: [],
      generatedAt: new Date().toISOString(),
      cached: false,
    };
  }
}

// ============================================
// AI Feature: Query Answering
// ============================================

export async function aiAnswerQuery(
  question: string,
  stats: NetworkStats
): Promise<AIQueryResult> {
  try {
    logger.ai("query", `Question: "${question}"`);
    
    const sortedCountries = Object.entries(stats.distribution.countries)
      .sort(([, a], [, b]) => (b as number) - (a as number));
    
    const contextPayload = `
CURRENT XANDEUM NETWORK DATA:

SUMMARY:
- Total Nodes: ${stats.summary.totalNodes}
- Online: ${stats.summary.onlineNodes} (${stats.summary.onlinePercent.toFixed(1)}%)
- Offline: ${stats.summary.offlineNodes}
- Network Score: ${stats.summary.networkScore}/100
- Average Health: ${stats.performance.avgHealthScore}/100

GEOGRAPHY (${stats.summary.uniqueCountries} countries):
${sortedCountries.slice(0, 15).map(([country, count]) => `- ${country}: ${count} nodes`).join('\n')}

HEALTH DISTRIBUTION:
- Excellent (80-100): ${stats.distribution.health.excellent}
- Good (60-79): ${stats.distribution.health.good}
- Fair (40-59): ${stats.distribution.health.fair}
- Poor (20-39): ${stats.distribution.health.poor}
- Critical (0-19): ${stats.distribution.health.critical}

USER QUESTION: ${question}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.query },
        { role: "user", content: contextPayload },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });
    
    const answer = completion.choices[0]?.message?.content?.trim() || "Unable to generate response.";
    
    return {
      question,
      answer,
      dataSnapshot: {
        totalNodes: stats.summary.totalNodes,
        onlineNodes: stats.summary.onlineNodes,
        networkScore: stats.summary.networkScore,
        countriesCount: stats.summary.uniqueCountries,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("AI query failed", { error: (error as Error).message });
    
    return {
      question,
      answer: "Sorry, I couldn't process your question. Please try again.",
      dataSnapshot: {
        totalNodes: stats.summary.totalNodes,
        onlineNodes: stats.summary.onlineNodes,
        networkScore: stats.summary.networkScore,
        countriesCount: stats.summary.uniqueCountries,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

// ============================================
// AI Feature: Node Explainer (Orb-inspired)
// ============================================

export async function aiExplainNode(
  node: XandeumNode,
  networkAvg: { cpuPercent: number; ramPercent: number; healthScore: number }
): Promise<string> {
  try {
    logger.ai("explain", `Explaining node ${node.ip}`);
    
    const prompt = `
Explain this Xandeum storage node in simple terms:

Node: ${node.ip}
Location: ${node.geo?.city || "Unknown"}, ${node.geo?.country || "Unknown"}
Status: ${node.status}
Version: ${node.version || "Unknown"}
Health Score: ${node.derived?.healthScore || 0}/100 (network avg: ${networkAvg.healthScore.toFixed(0)})
CPU: ${node.stats?.cpu_percent?.toFixed(1) || 0}% (network avg: ${networkAvg.cpuPercent.toFixed(1)}%)
RAM: ${node.derived?.ramUsagePercent?.toFixed(1) || 0}% (network avg: ${networkAvg.ramPercent.toFixed(1)}%)
Uptime: ${node.derived?.uptimeHuman || "N/A"}
Packets: ↑${node.stats?.packets_sent || 0} ↓${node.stats?.packets_received || 0}

Provide a brief, friendly explanation of what this node is doing and how it's performing.`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.explain },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 200,
    });
    
    return completion.choices[0]?.message?.content?.trim() || "Unable to generate explanation.";
  } catch (error) {
    logger.error("AI explain failed", { error: (error as Error).message });
    return `This is a Xandeum storage node located in ${node.geo?.country || "an unknown location"}. It's currently ${node.status} with a health score of ${node.derived?.healthScore || 0}/100.`;
  }
}
