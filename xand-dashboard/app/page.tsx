"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Search, Star, TrendingUp, ArrowUpRight, ArrowDownRight,
  Server, Activity, Globe2, Zap, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchStats, fetchNodes } from "./lib/api";
import { NetworkStats, Node } from "./lib/types";

import Image from "next/image";

export default function ExplorePage() {
  const router = useRouter();
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches] = useState<string[]>(["Germany nodes", "Online", "High health"]);

  const loadData = async () => {
    try {
      const [statsData, nodesData] = await Promise.all([
        fetchStats(),
        fetchNodes(),
      ]);
      setStats(statsData);
      setNodes(nodesData.nodes);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, []);

  // Get top performing nodes
  const topNodes = useMemo(() => {
    return [...nodes]
      .filter(n => n.status === "Online" && n.derived)
      .sort((a, b) => (b.derived?.health_score || 0) - (a.derived?.health_score || 0))
      .slice(0, 5);
  }, [nodes]);

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center animate-pulse">
            <span className="text-orb-teal font-bold text-xl">X</span>
          </div>
          <p className="text-gray-400 text-sm font-mono">Loading network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section - Orb Style */}
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-4">
        {/* Title Only - Logo Removed */}
        <div className="flex items-center gap-4 mb-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-mono tracking-tight text-center">
              xandeum <span className="text-orb-teal">orb</span>
            </h1>
            <p className="text-sm text-gray-400 font-mono text-center mt-2">Explorer and Dashboard</p>
          </div>
        </div>

        {/* Main Search Bar - Single, Prominent */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl mb-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-orb-teal transition-colors" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes by IP, pubkey, country, or ask a question..."
              className="w-full pl-14 pr-6 py-4 text-lg font-mono bg-card-bg border-2 border-card-border text-foreground rounded-none focus:outline-none focus:border-orb-teal focus:ring-0 shadow-sm hover:border-gray-600 transition-all placeholder-gray-500"
              autoFocus
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono text-gray-400 bg-card-border border border-gray-600 rounded-sm">↵</kbd>
            </div>
          </div>
        </form>

      </div>

      {/* Quick Stats Bar - Like Orb */}
      {stats && (
        <div className="border-y border-card-border bg-card-bg/50">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-8 overflow-x-auto">
              <div className="flex items-center gap-3 min-w-fit">
                <div className="w-10 h-10 bg-orb-teal/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-orb-teal" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wide">Nodes Online</p>
                  <p className="text-xl font-mono font-bold text-foreground">
                    {stats.network.online_nodes}
                    <span className="text-sm text-gray-500 font-normal ml-1">/ {stats.network.total_nodes}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-fit">
                <div className="w-10 h-10 bg-blue-500/10 flex items-center justify-center">
                  <Globe2 className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wide">Countries</p>
                  <p className="text-xl font-mono font-bold text-foreground">{stats.network.unique_countries}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-fit">
                <div className="w-10 h-10 bg-orb-orange/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-orb-orange" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wide">Network Score</p>
                  <p className="text-xl font-mono font-bold text-orb-orange">{stats.network.network_score}/100</p>
                </div>
              </div>

              <div className="flex items-center gap-3 min-w-fit">
                <div className="w-10 h-10 bg-orb-purple/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-orb-purple" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wide">Avg Uptime</p>
                  <p className="text-xl font-mono font-bold text-foreground">{stats.uptime?.avg_human || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Performing Nodes */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orb-teal" strokeWidth={1.5} />
            <h2 className="text-lg font-mono font-semibold text-foreground">Top Performing Nodes</h2>
          </div>
          <Link 
            href="/nodes"
            className="text-sm font-mono text-orb-teal hover:text-orb-teal/80 font-medium flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="bg-card-bg border border-card-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-card-bg border-b border-card-border">
                <th className="text-left px-4 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Node</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Location</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">RAM</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">Uptime</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-semibold text-gray-400 uppercase">CPU</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-semibold text-gray-400 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {topNodes.map((node, index) => (
                <tr 
                  key={node.ip}
                  className="hover:bg-card-border/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/node/${encodeURIComponent(node.ip)}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-card-border flex items-center justify-center text-xs font-mono font-bold text-gray-400">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-mono text-sm text-foreground">{node.ip}</p>
                        {node.pubkey && (
                          <p className="text-xs text-gray-500 font-mono">
                            {node.pubkey.slice(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">
                      {node.geo?.city ? `${node.geo.city}, ` : ""}{node.geo?.country || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 font-semibold text-sm ${
                      (node.derived?.ram_usage_percent || 0) <= 50 ? "text-orb-teal" :
                      (node.derived?.ram_usage_percent || 0) <= 75 ? "text-orb-orange" : "text-orb-error"
                    }`}>
                      {typeof node.derived?.ram_usage_percent === "number" ? node.derived.ram_usage_percent.toFixed(0) : "0"}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-400">{node.derived?.uptime_human || "N/A"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm ${
                      (node.stats?.cpu_percent || 0) > 70 ? "text-orb-error" : "text-gray-400"
                    }`}>
                      {(node.stats?.cpu_percent || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-card-border py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <span className="font-semibold text-gray-400">Xandeum</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/network" className="hover:text-gray-300 transition-colors">Stats</Link>
              <Link href="/nodes" className="hover:text-gray-300 transition-colors">Nodes</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
