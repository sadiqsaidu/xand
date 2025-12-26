/**
 * Xandeum Explorer - Formatting Utilities
 * Human-readable formatting for bytes, time, numbers
 */

/**
 * Format bytes to human readable string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "Invalid";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Format seconds to human readable uptime string (e.g., "3d 12h 5m")
 */
export function formatUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "N/A";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

/**
 * Format timestamp to "X ago" string
 */
export function formatTimeAgo(timestamp: number | Date | null): string {
  if (!timestamp) return "Never";
  
  const now = Date.now();
  const then = timestamp instanceof Date ? timestamp.getTime() : timestamp * 1000;
  const diffSeconds = Math.floor((now - then) / 1000);
  
  if (diffSeconds < 0) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  
  return new Date(then).toLocaleDateString();
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Format percentage with specified precision
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Extract IP from address string like "192.190.136.37:9001"
 */
export function extractIp(address: string): string {
  return address.split(":")[0];
}

/**
 * Extract port from address string
 */
export function extractPort(address: string): string | null {
  const parts = address.split(":");
  return parts.length > 1 ? parts[1] ?? null : null;
}

/**
 * Generate a unique ID from IP (deterministic)
 */
export function generateNodeId(ip: string): string {
  return `node-${ip.replace(/\./g, "-")}`;
}

/**
 * Truncate pubkey for display (e.g., "ABC...XYZ")
 */
export function truncatePubkey(pubkey: string | null | undefined, chars: number = 6): string {
  if (!pubkey) return "Unknown";
  if (pubkey.length <= chars * 2) return pubkey;
  return `${pubkey.slice(0, chars)}...${pubkey.slice(-chars)}`;
}

/**
 * Format location string from geo data
 */
export function formatLocation(
  city: string | null | undefined,
  country: string | null | undefined
): string {
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return "Unknown";
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Delay helper for rate limiting
 */
export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Convert BigInt to number safely
 */
export function toNumber(value: bigint | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return Number(value);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
