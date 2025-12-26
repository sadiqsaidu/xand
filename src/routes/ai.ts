/**
 * Xandeum Explorer - AI Routes
 * AI-powered endpoints for intelligent search, diagnostics, and insights
 */

import { Hono } from "hono";
import * as store from "../services/store";
import { 
  aiParseSearchQuery, 
  aiDiagnoseNode, 
  aiGenerateBriefing,
  aiAnswerQuery,
  aiExplainNode
} from "../lib/ai";
import logger from "../lib/logger";

const ai = new Hono();

// Briefing cache (regenerate every 6 hours)
let briefingCache: { data: import("../types").AIBriefing | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const BRIEFING_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ============================================
// Magic Search - Natural Language Filtering
// ============================================

ai.post("/search", async (c) => {
  try {
    const body = await c.req.json();
    const query = body.query?.trim();
    
    if (!query) {
      return c.json({ 
        filter: {}, 
        message: "Empty query",
        results: [],
        totalMatches: 0,
      });
    }
    
    logger.ai("search", `Query: "${query}"`);
    
    // Parse natural language to filter
    const filter = await aiParseSearchQuery(query);
    
    // Apply filter to nodes
    const results = store.searchNodes(filter);
    
    // Calculate summary
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
      query,
      filter,
      message: `Found ${results.length} matching nodes`,
      totalMatches: results.length,
      summary: {
        online: onlineCount,
        offline: offlineCount,
        avgHealthScore: Math.round(avgHealth),
        countries: countryBreakdown,
      },
      // Return first 20 nodes for quick preview
      nodes: results.slice(0, 20).map(n => ({
        ip: n.ip,
        status: n.status,
        country: n.geo?.country || "Unknown",
        city: n.geo?.city || "Unknown",
        healthScore: n.derived?.healthScore || 0,
        healthGrade: n.derived?.healthGrade || "unknown",
        version: n.version,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("AI search failed", { error: (err as Error).message });
    return c.json({ 
      filter: {}, 
      error: (err as Error).message,
      totalMatches: 0,
    }, 500);
  }
});

// ============================================
// Node Diagnostics - Health Analysis
// ============================================

ai.post("/diagnose", async (c) => {
  try {
    const body = await c.req.json();
    const ip = body.ip?.trim();
    
    if (!ip) {
      return c.json({ error: "IP address required" }, 400);
    }
    
    const node = store.getNode(ip);
    if (!node) {
      return c.json({ error: "Node not found", ip }, 404);
    }
    
    logger.ai("diagnose", `Analyzing ${ip}`);
    
    const networkAvg = store.getNetworkAverages();
    const diagnosis = await aiDiagnoseNode(node, networkAvg);
    
    return c.json({
      ip,
      diagnosis,
      node: {
        status: node.status,
        healthScore: node.derived?.healthScore || 0,
        healthGrade: node.derived?.healthGrade || "unknown",
        location: node.geo ? `${node.geo.city}, ${node.geo.country}` : "Unknown",
        version: node.version,
        uptime: node.derived?.uptimeHuman || "N/A",
      },
      networkAverages: networkAvg,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("AI diagnose failed", { error: (err as Error).message });
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ============================================
// Network Briefing - AI Summary
// ============================================

ai.get("/briefing", async (c) => {
  try {
    const now = Date.now();
    
    // Check cache
    if (briefingCache.data && (now - briefingCache.timestamp) < BRIEFING_CACHE_TTL) {
      logger.ai("briefing", "Returning cached briefing");
      return c.json({ ...briefingCache.data, cached: true });
    }
    
    logger.ai("briefing", "Generating fresh briefing");
    
    const stats = store.calculateNetworkStats();
    const briefing = await aiGenerateBriefing(stats);
    
    // Cache the result
    briefingCache = {
      data: briefing,
      timestamp: now,
    };
    
    return c.json(briefing);
  } catch (err) {
    logger.error("AI briefing failed", { error: (err as Error).message });
    
    // Return fallback briefing
    const stats = store.calculateNetworkStats();
    return c.json({
      headline: "Network Status Update",
      bullets: [
        `${stats.summary.onlineNodes} of ${stats.summary.totalNodes} nodes online`,
        `Network score: ${stats.summary.networkScore}/100`,
        `Operating across ${stats.summary.uniqueCountries} countries`,
      ],
      insights: [],
      generatedAt: new Date().toISOString(),
      cached: false,
      error: (err as Error).message,
    });
  }
});

// ============================================
// Query - Natural Language Q&A
// ============================================

ai.post("/query", async (c) => {
  try {
    const body = await c.req.json();
    const question = body.question?.trim();
    
    if (!question) {
      return c.json({ 
        answer: "Please ask a question about the network.",
        error: true,
      });
    }
    
    logger.ai("query", `Question: "${question}"`);
    
    const stats = store.calculateNetworkStats();
    const result = await aiAnswerQuery(question, stats);
    
    return c.json(result);
  } catch (err) {
    logger.error("AI query failed", { error: (err as Error).message });
    return c.json({ 
      answer: "Sorry, I couldn't process your question. Please try again.",
      error: (err as Error).message,
    }, 500);
  }
});

// ============================================
// Explain - Node Explainer (Orb-inspired)
// ============================================

ai.get("/explain/:ip", async (c) => {
  try {
    const ip = decodeURIComponent(c.req.param("ip"));
    const node = store.getNode(ip);
    
    if (!node) {
      return c.json({ error: "Node not found", ip }, 404);
    }
    
    logger.ai("explain", `Explaining ${ip}`);
    
    const networkAvg = store.getNetworkAverages();
    const explanation = await aiExplainNode(node, networkAvg);
    
    return c.json({
      ip,
      explanation,
      node: {
        status: node.status,
        healthScore: node.derived?.healthScore || 0,
        location: node.geo ? `${node.geo.city}, ${node.geo.country}` : "Unknown",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("AI explain failed", { error: (err as Error).message });
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ============================================
// Clear Briefing Cache (Admin)
// ============================================

ai.post("/briefing/refresh", async (c) => {
  // Optional auth
  const syncToken = process.env.SYNC_TOKEN;
  if (syncToken) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || authHeader !== `Bearer ${syncToken}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  
  briefingCache = { data: null, timestamp: 0 };
  logger.ai("briefing", "Cache cleared");
  
  // Generate new briefing
  const stats = store.calculateNetworkStats();
  const briefing = await aiGenerateBriefing(stats);
  
  briefingCache = {
    data: briefing,
    timestamp: Date.now(),
  };
  
  return c.json({
    message: "Briefing cache refreshed",
    briefing,
  });
});

export default ai;
