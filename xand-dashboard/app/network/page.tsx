"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Server, Globe2, Activity, Clock, Cpu, HardDrive, Database,
  RefreshCw, TrendingUp, Zap, ArrowUpDown, ChevronRight, BarChart3
} from "lucide-react";
import Link from "next/link";
import { fetchStats, fetchNodes } from "../lib/api";
import { NetworkStats, Node, PNodesResponse } from "../lib/types";

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function NetworkPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [meta, setMeta] = useState<PNodesResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsData, nodesData] = await Promise.all([
        fetchStats(),
        fetchNodes(),
      ]);
      setStats(statsData);
      setNodes(nodesData.nodes);
      setMeta(nodesData.meta);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, []);

  // Get country distribution sorted by count
  const countryData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.countries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));
  }, [stats]);

  // Get version distribution
  const versionData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.versions)
      .sort(([, a], [, b]) => b - a)
      .map(([version, count]) => ({ version, count }));
  }, [stats]);

  // Get total nodes count for percentage calculations
  const totalNodes = stats?.network.total_nodes || 1;

  // Calculate storage metrics from nodes
  const storageStats = useMemo(() => {
    const onlineNodes = nodes.filter(n => n.status === "Online" && n.stats);
    const totalFileSize = onlineNodes.reduce((acc, n) => acc + (n.stats?.file_size || 0), 0);
    const totalPages = onlineNodes.reduce((acc, n) => acc + (n.stats?.total_pages || 0), 0);
    const nodesReporting = onlineNodes.filter(n => n.stats?.total_pages && n.stats.total_pages > 0).length;
    return { totalFileSize, totalPages, nodesReporting };
  }, [nodes]);

  // Calculate network traffic from nodes
  const trafficStats = useMemo(() => {
    const onlineNodes = nodes.filter(n => n.status === "Online" && n.stats);
    const totalSent = onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_sent || 0), 0);
    const totalReceived = onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_received || 0), 0);
    const activeStreams = onlineNodes.reduce((acc, n) => acc + (n.stats?.active_streams || 0), 0);
    return { totalSent, totalReceived, activeStreams };
  }, [nodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e85a4f] to-[#c94a40] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">X</span>
          </div>
          <p className="text-gray-500">Loading network statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Failed to load network data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Main Stats Grid - Like Orb */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Network Health Score */}
          <div className="bg-gradient-to-br from-[#e85a4f] to-[#c94a40] rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 opacity-80" />
              <span className="text-sm font-medium opacity-80">Network Score</span>
            </div>
            <p className="text-4xl font-bold">{stats.network.network_score}</p>
            <p className="text-sm opacity-70 mt-1">out of 100</p>
          </div>

          {/* Total Nodes */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-500">Total pNodes</span>
            </div>
            <p className="text-4xl font-bold text-gray-900">{stats.network.total_nodes}</p>
            <p className="text-sm text-green-600 mt-1">
              {stats.network.online_nodes} online ({stats.network.online_percent.toFixed(1)}%)
            </p>
          </div>

          {/* Countries */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Globe2 className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-500">Countries</span>
            </div>
            <p className="text-4xl font-bold text-gray-900">{stats.network.unique_countries}</p>
            <p className="text-sm text-gray-400 mt-1">global distribution</p>
          </div>

          {/* Avg Health */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-500">Avg Health</span>
            </div>
            <p className="text-4xl font-bold text-gray-900">{stats.performance.avg_health_score}</p>
            <p className="text-sm text-gray-400 mt-1">score / 100</p>
          </div>
        </div>

        {/* Resource Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500 uppercase">Avg CPU</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.performance.avg_cpu_percent.toFixed(1)}%</p>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 uppercase">Avg RAM</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.performance.avg_ram_percent.toFixed(1)}%</p>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-teal-500" />
              <span className="text-xs text-gray-500 uppercase">Avg Uptime</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.uptime.avg_human}</p>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-500 uppercase">Max Uptime</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.uptime.max_human}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpDown className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-gray-500 uppercase">Versions</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.network.unique_versions}</p>
          </div>
        </div>

        {/* Storage & Network Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Storage Stats */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-[#e85a4f]" />
              <h3 className="font-semibold text-gray-900">Storage</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Data Stored</p>
                  <p className="text-lg font-bold text-gray-900">{formatBytes(storageStats.totalFileSize)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Pages</p>
                  <p className="text-lg font-bold text-gray-900">{storageStats.totalPages.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Nodes Storing</p>
                  <p className="text-lg font-bold text-gray-900">{storageStats.nodesReporting}</p>
                </div>
              </div>
              {meta?.ram && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 uppercase">Network RAM Usage</span>
                    <span className="text-sm font-semibold text-gray-900">{meta.ram.utilization_percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.min(meta.ram.utilization_percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>{meta.ram.used_human} used</span>
                    <span>{meta.ram.total_human} total</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Network Traffic */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#e85a4f]" />
              <h3 className="font-semibold text-gray-900">Network Traffic</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Packets Sent</p>
                  <p className="text-lg font-bold text-gray-900">{trafficStats.totalSent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Packets Received</p>
                  <p className="text-lg font-bold text-gray-900">{trafficStats.totalReceived.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Active Streams</p>
                  <p className="text-lg font-bold text-gray-900">{trafficStats.activeStreams.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase">Total Packets</span>
                  <span className="text-lg font-bold text-[#e85a4f]">
                    {(trafficStats.totalSent + trafficStats.totalReceived).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700">Excellent (80+)</span>
              <span className="text-2xl font-bold text-green-700">{stats.health_distribution.Excellent || 0}</span>
            </div>
            <div className="mt-2 h-1.5 bg-green-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${((stats.health_distribution.Excellent || 0) / totalNodes) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-700">Good (60-79)</span>
              <span className="text-2xl font-bold text-yellow-700">{stats.health_distribution.Good || 0}</span>
            </div>
            <div className="mt-2 h-1.5 bg-yellow-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 rounded-full"
                style={{ width: `${((stats.health_distribution.Good || 0) / totalNodes) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-orange-700">Fair (40-59)</span>
              <span className="text-2xl font-bold text-orange-700">{stats.health_distribution.Fair || 0}</span>
            </div>
            <div className="mt-2 h-1.5 bg-orange-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${((stats.health_distribution.Fair || 0) / totalNodes) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-700">Poor (0-39)</span>
              <span className="text-2xl font-bold text-red-700">{stats.health_distribution.Poor || 0}</span>
            </div>
            <div className="mt-2 h-1.5 bg-red-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${((stats.health_distribution.Poor || 0) / totalNodes) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Country Distribution */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-[#e85a4f]" />
                <h3 className="font-semibold text-gray-900">Geographic Distribution</h3>
              </div>
              <span className="text-xs text-gray-400">{stats.network.unique_countries} countries</span>
            </div>
            <div className="divide-y divide-gray-50">
              {countryData.map((item, index) => (
                <div 
                  key={item.country}
                  className="px-6 py-3 flex items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="w-6 text-sm text-gray-400 font-medium">{index + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900">{item.country}</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden mr-4">
                    <div 
                      className="h-full bg-[#e85a4f] rounded-full transition-all"
                      style={{ width: `${(item.count / totalNodes) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-12 text-right">{item.count}</span>
                </div>
              ))}
            </div>
            <Link 
              href={`/nodes${countryData.length ? `?country=${encodeURIComponent(countryData[0].country)}` : ""}`}
              className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-[#e85a4f] hover:bg-[#e85a4f]/5 border-t border-gray-100 transition-colors"
            >
              View All Nodes <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Version Distribution */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-[#e85a4f]" />
                <h3 className="font-semibold text-gray-900">Version Distribution</h3>
              </div>
              <span className="text-xs text-gray-400">{versionData.length} versions</span>
            </div>
            <div className="divide-y divide-gray-50">
              {versionData.slice(0, 8).map((item, index) => (
                <div 
                  key={item.version}
                  className="px-6 py-3 flex items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="w-6 text-sm text-gray-400 font-medium">{index + 1}</span>
                  <span className="flex-1 text-sm font-mono text-gray-900">
                    {item.version || "Unknown"}
                  </span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden mr-4">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(item.count / totalNodes) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">
                    {((item.count / totalNodes) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            {versionData.length > 8 && (
              <div className="px-6 py-3 text-center text-sm text-gray-400 border-t border-gray-100">
                +{versionData.length - 8} more versions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
