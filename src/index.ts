/**
 * Xandeum Explorer - Main Server Entry Point
 * 
 * A fast, human-readable Xandeum network explorer
 * Inspired by Helius Orb for Solana
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { timing } from "hono/timing";

import { explorerRoutes, aiRoutes } from "./routes";
import { startSyncService, stopSyncService, getSyncConfig } from "./services/sync";
import * as store from "./services/store";
import logger from "./lib/logger";

// ============================================
// Configuration
// ============================================

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate required environment variables
const requiredEnvVars = ["OPENROUTER_API_KEY"];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.warn(`Missing optional env vars: ${missingVars.join(", ")}`);
}

// ============================================
// App Initialization
// ============================================

const app = new Hono();

// ============================================
// Middleware
// ============================================

// CORS
app.use("/*", cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["*"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Request logging (development only)
if (NODE_ENV === "development") {
  app.use("/*", honoLogger());
}

// Pretty JSON responses (development)
if (NODE_ENV === "development") {
  app.use("/*", prettyJSON());
}

// Request timing headers
app.use("/*", timing());

// ============================================
// Root Routes
// ============================================

app.get("/", (c) => {
  const syncStatus = store.getSyncStatus();
  
  return c.json({
    name: "Xandeum Explorer API",
    version: "1.0.0",
    description: "A fast, human-readable Xandeum network explorer",
    status: "operational",
    endpoints: {
      health: "/health",
      network: "/network",
      nodes: "/nodes",
      node: "/node/:ip",
      search: "/search",
      map: "/map",
      ai: {
        search: "POST /ai/search",
        diagnose: "POST /ai/diagnose",
        briefing: "/ai/briefing",
        query: "POST /ai/query",
        explain: "/ai/explain/:ip",
      },
      distributions: {
        versions: "/distribution/versions",
        countries: "/distribution/countries",
        health: "/distribution/health",
      },
      leaderboards: {
        health: "/leaderboard/health",
        uptime: "/leaderboard/uptime",
      },
    },
    sync: {
      lastSync: syncStatus.lastSync?.toISOString() || null,
      syncCount: syncStatus.syncCount,
      nodesTracked: store.getStoreSize(),
    },
    links: {
      github: "https://github.com/xandeum",
      docs: "https://docs.xandeum.network",
    },
  });
});

// OpenAPI spec endpoint
app.get("/openapi", (c) => {
  return c.json({
    openapi: "3.0.0",
    info: {
      title: "Xandeum Explorer API",
      version: "1.0.0",
      description: "API for exploring the Xandeum decentralized storage network",
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: "Local development" },
    ],
    paths: {
      "/health": { get: { summary: "Health check", tags: ["System"] } },
      "/network": { get: { summary: "Network statistics", tags: ["Network"] } },
      "/nodes": { get: { summary: "List all nodes", tags: ["Nodes"] } },
      "/node/{ip}": { get: { summary: "Get node details", tags: ["Nodes"] } },
      "/search": { get: { summary: "Search nodes with filters", tags: ["Search"] } },
      "/map": { get: { summary: "Get map markers", tags: ["Visualization"] } },
      "/ai/search": { post: { summary: "AI-powered natural language search", tags: ["AI"] } },
      "/ai/diagnose": { post: { summary: "AI node diagnostics", tags: ["AI"] } },
      "/ai/briefing": { get: { summary: "AI network briefing", tags: ["AI"] } },
      "/ai/query": { post: { summary: "Ask questions about the network", tags: ["AI"] } },
      "/ai/explain/{ip}": { get: { summary: "AI explanation of a node", tags: ["AI"] } },
    },
  });
});

// ============================================
// Mount Routes
// ============================================

app.route("/", explorerRoutes);
app.route("/ai", aiRoutes);

// ============================================
// Error Handling
// ============================================

app.onError((err, c) => {
  logger.error("Request error", { 
    path: c.req.path, 
    method: c.req.method,
    error: err.message,
    stack: NODE_ENV === "development" ? err.stack : undefined,
  });
  
  if (NODE_ENV === "production") {
    return c.json({ error: "Internal Server Error" }, 500);
  }
  
  return c.json({
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  }, 500);
});

app.notFound((c) => {
  return c.json({
    error: "Not Found",
    path: c.req.path,
    suggestion: "Check the API documentation at /",
  }, 404);
});

// ============================================
// Graceful Shutdown
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  // Stop sync service
  stopSyncService();
  
  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise Rejection", { reason: String(reason) });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error: error.message });
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// ============================================
// Start Server
// ============================================

logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
logger.info("🚀 Xandeum Explorer Starting...");
logger.info(`   Environment: ${NODE_ENV}`);
logger.info(`   Server: http://${HOST}:${PORT}`);
logger.info(`   API Docs: http://${HOST}:${PORT}/openapi`);
logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Start the sync service
startSyncService();

// Start HTTP server
serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});

export default app;
