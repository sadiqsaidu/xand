/**
 * Xandeum Explorer - Health Score Calculator
 * Computes node health based on multiple factors
 */

import type { NodeStats, DerivedMetrics, NodeStatus } from "../types";
import { formatUptime } from "./format";
import { clamp } from "./format";

interface HealthWeights {
  cpu: number;
  ram: number;
  uptime: number;
  network: number;
  online: number;
}

const DEFAULT_WEIGHTS: HealthWeights = {
  cpu: 0.25,
  ram: 0.20,
  uptime: 0.25,
  network: 0.10,
  online: 0.20,
};

/**
 * Calculate CPU health score (0-100)
 * Lower CPU usage = higher score
 */
function calculateCpuScore(cpuPercent: number): number {
  if (cpuPercent <= 30) return 100;
  if (cpuPercent <= 50) return 85;
  if (cpuPercent <= 70) return 65;
  if (cpuPercent <= 85) return 40;
  if (cpuPercent <= 95) return 20;
  return 5;
}

/**
 * Calculate RAM health score (0-100)
 * Lower RAM usage = higher score
 */
function calculateRamScore(ramPercent: number): number {
  if (ramPercent <= 50) return 100;
  if (ramPercent <= 70) return 80;
  if (ramPercent <= 85) return 55;
  if (ramPercent <= 95) return 30;
  return 10;
}

/**
 * Calculate uptime health score (0-100)
 * Longer uptime = higher score
 */
function calculateUptimeScore(uptimeSeconds: number): number {
  const uptimeHours = uptimeSeconds / 3600;
  
  if (uptimeHours >= 168) return 100; // 7+ days
  if (uptimeHours >= 72) return 85;   // 3+ days
  if (uptimeHours >= 24) return 65;   // 1+ day
  if (uptimeHours >= 6) return 45;    // 6+ hours
  if (uptimeHours >= 1) return 25;    // 1+ hour
  return 10;
}

/**
 * Calculate network activity score (0-100)
 * Active network = higher score
 */
function calculateNetworkScore(
  activeStreams: number,
  totalPackets: number
): number {
  let score = 50; // Base score for being reachable
  
  if (activeStreams > 0) score += 20;
  if (totalPackets > 100) score += 10;
  if (totalPackets > 1000) score += 10;
  if (totalPackets > 10000) score += 10;
  
  return Math.min(score, 100);
}

/**
 * Get health grade from score
 */
export function getHealthGrade(
  score: number
): DerivedMetrics["healthGrade"] {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  if (score >= 20) return "poor";
  return "critical";
}

/**
 * Calculate comprehensive health score for a node
 */
export function calculateHealthScore(
  stats: NodeStats | null,
  status: NodeStatus,
  weights: HealthWeights = DEFAULT_WEIGHTS
): number {
  // Offline nodes get 0 health
  if (status === "offline" || status === "unknown") {
    return 0;
  }

  // No stats available
  if (!stats) {
    return status === "degraded" ? 25 : 50;
  }

  // Calculate individual scores
  const cpuScore = calculateCpuScore(stats.cpu_percent);
  
  const ramPercent = stats.ram_total > 0 
    ? (stats.ram_used / stats.ram_total) * 100 
    : 0;
  const ramScore = calculateRamScore(ramPercent);
  
  const uptimeScore = calculateUptimeScore(stats.uptime);
  
  const totalPackets = stats.packets_sent + stats.packets_received;
  const networkScore = calculateNetworkScore(stats.active_streams, totalPackets);
  
  // Online bonus
  const onlineScore = 100;

  // Weighted average
  const weightedScore = 
    (cpuScore * weights.cpu) +
    (ramScore * weights.ram) +
    (uptimeScore * weights.uptime) +
    (networkScore * weights.network) +
    (onlineScore * weights.online);

  return Math.round(clamp(weightedScore, 0, 100));
}

/**
 * Calculate all derived metrics for a node
 */
export function calculateDerivedMetrics(
  stats: NodeStats | null,
  status: NodeStatus
): DerivedMetrics | null {
  if (!stats && status !== "online") {
    return null;
  }

  const healthScore = calculateHealthScore(stats, status);
  
  const ramUsagePercent = stats && stats.ram_total > 0
    ? (stats.ram_used / stats.ram_total) * 100
    : 0;

  const storageUtilizationPercent = stats && stats.file_size > 0 && stats.total_bytes > 0
    ? (stats.total_bytes / stats.file_size) * 100
    : 0;

  const packetsPerSecond = stats && stats.uptime > 0
    ? (stats.packets_sent + stats.packets_received) / stats.uptime
    : 0;

  return {
    ramUsagePercent: Math.round(ramUsagePercent * 100) / 100,
    storageUtilizationPercent: Math.round(storageUtilizationPercent * 100) / 100,
    uptimeHuman: formatUptime(stats?.uptime),
    packetsPerSecond: Math.round(packetsPerSecond * 100) / 100,
    healthScore,
    healthGrade: getHealthGrade(healthScore),
  };
}

/**
 * Compare node health to network averages
 */
export function compareToNetworkAverage(
  nodeScore: number,
  networkAvgScore: number
): { status: "above" | "at" | "below"; diff: number } {
  const diff = nodeScore - networkAvgScore;
  const threshold = 5;

  if (diff > threshold) {
    return { status: "above", diff: Math.round(diff) };
  } else if (diff < -threshold) {
    return { status: "below", diff: Math.round(diff) };
  }
  return { status: "at", diff: Math.round(diff) };
}
