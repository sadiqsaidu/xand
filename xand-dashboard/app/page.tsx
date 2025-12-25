"use client";

import { useEffect, useState } from "react";
import { 
  Server, Globe2, Clock, Cpu, Activity, 
  ArrowUpRight, RefreshCw, Newspaper, Zap,
  HardDrive
} from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis
} from "recharts";
import { fetchStats, fetchNodes, fetchBriefing } from "./lib/api";
import { NetworkStats, Node, BriefingResult } from "./lib/types";
import { StatCard, NetworkScore, LoadingSpinner, HealthBadge, StatusBadge } from "./components/ui";
import Link from "next/link";

export default function OverviewPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsData, nodesData, briefingData] = await Promise.all([
        fetchStats(),
        fetchNodes(),
        fetchBriefing().catch(() => null),
      ]);
      setStats(statsData);
      setNodes(nodesData.nodes);
      if (briefingData) setBriefing(briefingData);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Loading Network Data..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Failed to load network data</p>
      </div>
    );
  }

  // Prepare chart data
  const statusChartData = [
    { name: "Online", value: stats.status_distribution.Online || 0 },
    { name: "Offline", value: stats.status_distribution.Offline || 0 },
    { name: "Unknown", value: stats.status_distribution.Unknown || 0 },
  ].filter(d => d.value > 0);

  const healthChartData = [
    { name: "Excellent", value: stats.health_distribution.Excellent || 0, color: "#10b981" },
    { name: "Good", value: stats.health_distribution.Good || 0, color: "#3b82f6" },
    { name: "Fair", value: stats.health_distribution.Fair || 0, color: "#f59e0b" },
    { name: "Poor", value: stats.health_distribution.Poor || 0, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const topCountries = Object.entries(stats.countries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([country, count]) => ({ country, count }));

  const STATUS_COLORS: Record<string, string> = {
    Online: "#10b981",
    Offline: "#ef4444",
    Unknown: "#6b7280",
  };

  // Top 5 nodes by health score
  const topNodes = [...nodes]
    .filter(n => n.status === "Online" && n.derived)
    .sort((a, b) => (b.derived?.health_score || 0) - (a.derived?.health_score || 0))
    .slice(0, 5);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Network Overview</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live • Last updated: {stats.network.last_sync 
              ? new Date(stats.network.last_sync).toLocaleTimeString() 
              : "Never"}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Network Score + Key Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <NetworkScore 
          score={stats.network.network_score} 
          onlinePercent={stats.network.online_percent}
        />
        <StatCard
          title="Total Nodes"
          value={stats.network.total_nodes}
          icon={Server}
          subtext={`${stats.network.online_nodes} online`}
          color="blue"
        />
        <StatCard
          title="Countries"
          value={stats.network.unique_countries}
          icon={Globe2}
          subtext="Geographic distribution"
          color="purple"
        />
        <StatCard
          title="Avg Uptime"
          value={stats.uptime.avg_human}
          icon={Clock}
          subtext={`Max: ${stats.uptime.max_human}`}
          color="teal"
        />
      </div>

      {/* Performance Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Avg CPU Usage"
          value={`${stats.performance.avg_cpu_percent.toFixed(1)}%`}
          icon={Cpu}
          color="orange"
        />
        <StatCard
          title="Avg RAM Usage"
          value={`${stats.performance.avg_ram_percent.toFixed(1)}%`}
          icon={HardDrive}
          color="green"
        />
        <StatCard
          title="Network RAM"
          value={stats.ram.total_human}
          icon={Zap}
          subtext={`${stats.ram.used_human} used`}
          color="blue"
        />
        <StatCard
          title="Software Versions"
          value={stats.network.unique_versions}
          icon={Activity}
          subtext="Active versions"
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Node Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {statusChartData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[item.name] }}
                />
                <span className="text-gray-600">{item.name}</span>
                <span className="font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Health Distribution */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={healthChartData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {healthChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Countries */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Countries</h3>
          <div className="space-y-3">
            {topCountries.map((item, i) => (
              <div key={item.country} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-4">{i + 1}</span>
                  <span className="text-gray-900 font-medium">{item.country}</span>
                </div>
                <span className="text-gray-600 text-sm">{item.count} nodes</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Briefing */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Daily Briefing</h3>
            </div>
            {briefing?.cached && (
              <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Cached</span>
            )}
          </div>
          
          {briefing ? (
            <>
              <div className="bg-white rounded-lg p-4 mb-4 border border-amber-100">
                <p className="text-lg font-bold text-gray-900">{briefing.headline}</p>
              </div>
              <ul className="space-y-3">
                {briefing.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700">
                    <span className="flex-shrink-0 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm">{bullet}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-gray-500 text-sm">AI briefing unavailable</p>
          )}
        </div>

        {/* Top Performing Nodes */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Nodes</h3>
            <Link 
              href="/nodes"
              className="text-blue-600 text-sm hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {topNodes.map((node, i) => (
              <div 
                key={node.ip}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-mono text-sm text-gray-900">{node.ip}</p>
                    <p className="text-xs text-gray-500">{node.geo?.country || "Unknown"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HealthBadge score={node.derived?.health_score || 0} />
                  <StatusBadge status={node.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
