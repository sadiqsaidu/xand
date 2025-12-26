/**
 * Xandeum Explorer - Geolocation Service
 * IP-based geolocation using ip-api.com (free tier)
 */

import axios from "axios";
import logger from "./logger";
import { sleep } from "./format";
import type { GeoLocation } from "../types";

// In-memory cache to avoid redundant API calls
const geoCache = new Map<string, GeoLocation | null>();

// Rate limiting: ip-api.com allows 45 requests/minute for free tier
const RATE_LIMIT_DELAY_MS = 1500;
const BATCH_SIZE = 100; // ip-api.com batch endpoint limit
const REQUEST_TIMEOUT_MS = 5000;

interface IpApiResponse {
  status: string;
  query?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  regionName?: string;
  timezone?: string;
  lat?: number;
  lon?: number;
}

/**
 * Check if IP is private/local (should skip geolocation)
 */
export function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return true;
  if (parts.some(p => isNaN(p))) return true;
  
  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (parts[0] === 127) return true;
  // 0.0.0.0
  if (parts.every(p => p === 0)) return true;
  
  return false;
}

/**
 * Get cached geolocation for an IP
 */
export function getCachedGeo(ip: string): GeoLocation | null | undefined {
  return geoCache.get(ip);
}

/**
 * Set cached geolocation for an IP
 */
export function setCachedGeo(ip: string, geo: GeoLocation | null): void {
  geoCache.set(ip, geo);
}

/**
 * Clear the geolocation cache
 */
export function clearGeoCache(): void {
  geoCache.clear();
  logger.geo("Cache cleared");
}

/**
 * Get geolocation for a single IP
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  // Check cache first
  if (geoCache.has(ip)) {
    return geoCache.get(ip) || null;
  }
  
  // Skip private IPs
  if (isPrivateIp(ip)) {
    geoCache.set(ip, null);
    return null;
  }
  
  try {
    const response = await axios.get<IpApiResponse>(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,timezone,lat,lon`,
      { timeout: REQUEST_TIMEOUT_MS }
    );
    
    if (response.data.status === "success" && response.data.lat && response.data.lon) {
      const geo: GeoLocation = {
        latitude: response.data.lat,
        longitude: response.data.lon,
        country: response.data.country || "Unknown",
        countryCode: response.data.countryCode || "XX",
        city: response.data.city || "Unknown",
        region: response.data.regionName,
        timezone: response.data.timezone,
      };
      
      geoCache.set(ip, geo);
      return geo;
    }
    
    geoCache.set(ip, null);
    return null;
  } catch (error) {
    logger.geo(`Failed for IP ${ip}`, { error: (error as Error).message });
    geoCache.set(ip, null);
    return null;
  }
}

/**
 * Batch get geolocation for multiple IPs
 * Uses ip-api.com batch endpoint for efficiency
 */
export async function batchGetGeoLocation(
  ips: string[]
): Promise<Map<string, GeoLocation | null>> {
  const results = new Map<string, GeoLocation | null>();
  
  // Filter out duplicates and already cached IPs
  const uniqueIps = [...new Set(ips)].filter(ip => {
    if (geoCache.has(ip)) {
      results.set(ip, geoCache.get(ip) || null);
      return false;
    }
    if (isPrivateIp(ip)) {
      results.set(ip, null);
      geoCache.set(ip, null);
      return false;
    }
    return true;
  });
  
  if (uniqueIps.length === 0) {
    return results;
  }
  
  logger.geo(`Resolving ${uniqueIps.length} IPs`);
  
  // Create batches
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIps.length; i += BATCH_SIZE) {
    batches.push(uniqueIps.slice(i, i + BATCH_SIZE));
  }
  
  for (const batch of batches) {
    try {
      const response = await axios.post<IpApiResponse[]>(
        "http://ip-api.com/batch?fields=status,query,country,countryCode,city,regionName,timezone,lat,lon",
        batch.map(ip => ({ query: ip })),
        { timeout: REQUEST_TIMEOUT_MS * 2 }
      );
      
      for (const item of response.data) {
        if (!item.query) continue;
        
        if (item.status === "success" && item.lat && item.lon) {
          const geo: GeoLocation = {
            latitude: item.lat,
            longitude: item.lon,
            country: item.country || "Unknown",
            countryCode: item.countryCode || "XX",
            city: item.city || "Unknown",
            region: item.regionName,
            timezone: item.timezone,
          };
          results.set(item.query, geo);
          geoCache.set(item.query, geo);
        } else {
          results.set(item.query, null);
          geoCache.set(item.query, null);
        }
      }
      
      // Rate limiting between batches
      if (batches.length > 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } catch (error) {
      logger.warn(`Batch geolocation failed`, { 
        batchSize: batch.length,
        error: (error as Error).message 
      });
      
      // Mark failed IPs as null to prevent retries
      for (const ip of batch) {
        if (!results.has(ip)) {
          results.set(ip, null);
          geoCache.set(ip, null);
        }
      }
    }
  }
  
  logger.geo(`Resolved ${results.size} IPs, ${geoCache.size} total cached`);
  return results;
}

/**
 * Get all IPs that need geolocation (not in cache)
 */
export function getUncachedIps(ips: string[]): string[] {
  return ips.filter(ip => !geoCache.has(ip) && !isPrivateIp(ip));
}

/**
 * Get cache statistics
 */
export function getGeoCacheStats(): { total: number; withLocation: number; withoutLocation: number } {
  let withLocation = 0;
  let withoutLocation = 0;
  
  geoCache.forEach(geo => {
    if (geo) withLocation++;
    else withoutLocation++;
  });
  
  return {
    total: geoCache.size,
    withLocation,
    withoutLocation,
  };
}
