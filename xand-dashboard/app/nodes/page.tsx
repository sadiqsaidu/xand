"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Search, Filter, X, ChevronLeft, ChevronRight,
  Server, Globe2, Cpu, Clock, ArrowUpDown, Eye,
  Stethoscope, Copy, Check, RefreshCw, Star, ArrowLeft
} from "lucide-react";
import { fetchNodes, diagnoseNode } from "../lib/api";
import { Node, PNodesResponse } from "../lib/types";
import { Sparkline } from "../components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 25;

// Helper to get flag emoji from country name
const getFlagEmoji = (countryName: string) => {
  const flags: Record<string, string> = {
    "United States": "🇺🇸", "Germany": "🇩🇪", "United Kingdom": "🇬🇧", "France": "🇫🇷",
    "Canada": "🇨🇦", "Japan": "🇯🇵", "China": "🇨🇳", "India": "🇮🇳", "Brazil": "🇧🇷",
    "Australia": "🇦🇺", "Russia": "🇷🇺", "South Korea": "🇰🇷", "Netherlands": "🇳🇱",
    "Singapore": "🇸🇬", "Ireland": "🇮🇪", "Sweden": "🇸🇪", "Switzerland": "🇨🇭",
    "Finland": "🇫🇮", "Norway": "🇳🇴", "Denmark": "🇩🇰", "Italy": "🇮🇹", "Spain": "🇪🇸"
  };
  return flags[countryName] || "🌍";
};

type SortField = "ip" | "country" | "health" | "cpu" | "uptime" | "status";
type SortDirection = "asc" | "desc";

interface FilterState {
  search: string;
  status: string;
  country: string;
  healthMin: number;
}

function NodesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PNodesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<SortField>("health");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    country: "all",
    healthMin: 0,
  });

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const nodesData = await fetchNodes();
      setData(nodesData);
    } catch (err) {
      console.error("Failed to load nodes:", err);
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

  // Apply country filter from query param
  useEffect(() => {
    const countryParam = searchParams.get("country");
    if (countryParam) {
      setFilters(f => ({ ...f, country: countryParam }));
      setCurrentPage(1);
    }
  }, [searchParams]);

  // Get unique countries for filter
  const countries = useMemo(() => {
    if (!data) return [];
    const countrySet = new Set<string>();
    data.nodes.forEach(n => {
      if (n.geo?.country) countrySet.add(n.geo.country);
    });
    return Array.from(countrySet).sort();
  }, [data]);

  // Filter and sort nodes
  const filteredNodes = useMemo(() => {
    if (!data) return [];
    
    let nodes = [...data.nodes];
    
    // Apply search filter (IP, pubkey, country, city)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      nodes = nodes.filter(n => 
        n.ip.toLowerCase().includes(searchLower) ||
        n.address.toLowerCase().includes(searchLower) ||
        n.pubkey?.toLowerCase().includes(searchLower) ||
        n.geo?.country?.toLowerCase().includes(searchLower) ||
        n.geo?.city?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (filters.status !== "all") {
      nodes = nodes.filter(n => n.status === filters.status);
    }
    
    // Apply country filter
    if (filters.country !== "all") {
      nodes = nodes.filter(n => n.geo?.country === filters.country);
    }
    
    // Apply health filter
    if (filters.healthMin > 0) {
      nodes = nodes.filter(n => (n.derived?.health_score || 0) >= filters.healthMin);
    }
    
    // Apply sorting
    nodes.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "ip":
          comparison = a.ip.localeCompare(b.ip);
          break;
        case "country":
          comparison = (a.geo?.country || "").localeCompare(b.geo?.country || "");
          break;
        case "health":
          comparison = (a.derived?.health_score || 0) - (b.derived?.health_score || 0);
          break;
        case "cpu":
          comparison = (a.stats?.cpu_percent || 0) - (b.stats?.cpu_percent || 0);
          break;
        case "uptime":
          comparison = (a.stats?.uptime || 0) - (b.stats?.uptime || 0);
          break;
        case "status":
          const statusOrder = { Online: 0, Unknown: 1, Offline: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return nodes;
  }, [data, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredNodes.length / ITEMS_PER_PAGE);
  const paginatedNodes = filteredNodes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleDiagnose = async (node: Node) => {
    setSelectedNode(node);
    setDiagnosing(true);
    setDiagnosisResult(null);
    
    try {
      const result = await diagnoseNode(node.ip);
      setDiagnosisResult(result);
    } catch (err) {
      console.error("Diagnosis failed:", err);
    } finally {
      setDiagnosing(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      country: "all",
      healthMin: 0,
    });
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-orb-teal flex items-center justify-center animate-pulse">
            <span className="text-white font-mono font-bold text-lg">X</span>
          </div>
          <p className="text-gray-400 font-mono text-sm">Loading nodes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-orb-teal mb-6 font-mono text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-mono font-bold text-foreground">All Nodes</h1>
            <p className="text-gray-400 mt-1 font-mono text-sm">
              {filteredNodes.length} of {data?.nodes.length || 0} nodes
            </p>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium text-gray-300 bg-card-bg border border-card-border hover:bg-card-border transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card-bg border border-card-border p-4 mb-6">
          <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by IP, public key, location..."
                value={filters.search}
                onChange={(e) => {
                  setFilters(f => ({ ...f, search: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 font-mono text-sm bg-background border border-card-border text-foreground focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal placeholder-gray-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters(f => ({ ...f, status: e.target.value }));
              setCurrentPage(1);
            }}
            className="px-4 py-2 font-mono text-sm bg-background border border-card-border text-foreground focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal"
          >
            <option value="all">All Status</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Unknown">Unknown</option>
          </select>

          {/* Country Filter */}
          <select
            value={filters.country}
            onChange={(e) => {
              setFilters(f => ({ ...f, country: e.target.value }));
              setCurrentPage(1);
            }}
            className="px-4 py-2 font-mono text-sm bg-background border border-card-border text-foreground focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal"
          >
            <option value="all">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Health Filter */}
          <select
            value={filters.healthMin}
            onChange={(e) => {
              setFilters(f => ({ ...f, healthMin: Number(e.target.value) }));
              setCurrentPage(1);
            }}
            className="px-4 py-2 font-mono text-sm bg-background border border-card-border text-foreground focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal"
          >
            <option value="all">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Health Filter */}
          <select
            value={filters.healthMin}
            onChange={(e) => {
              setFilters(f => ({ ...f, healthMin: Number(e.target.value) }));
              setCurrentPage(1);
            }}
            className="px-4 py-2 font-mono text-sm bg-background border border-card-border text-foreground focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal"
          >
            <option value={0}>All Health</option>
            <option value={80}>Excellent (80+)</option>
            <option value={60}>Good (60+)</option>
            <option value={40}>Fair (40+)</option>
          </select>

          {/* Clear Filters */}
          {(filters.search || filters.status !== "all" || filters.country !== "all" || filters.healthMin > 0) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 font-mono text-sm text-orb-teal hover:bg-orb-teal/10 transition"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
          </div>
        </div>

      {/* Nodes Table */}
      <div className="bg-card-bg border border-card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-bg border-b border-card-border">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase cursor-pointer hover:bg-card-border"
                  onClick={() => handleSort("ip")}
                >
                  <div className="flex items-center gap-1">
                    Node
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase">
                  CPU Trend
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase cursor-pointer hover:bg-card-border"
                  onClick={() => handleSort("country")}
                >
                  <div className="flex items-center gap-1">
                    Location
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase">
                  Version
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase cursor-pointer hover:bg-card-border"
                  onClick={() => handleSort("cpu")}
                >
                  <div className="flex items-center gap-1">
                    CPU
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase">
                  RAM
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase cursor-pointer hover:bg-card-border"
                  onClick={() => handleSort("uptime")}
                >
                  <div className="flex items-center gap-1">
                    Uptime
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase cursor-pointer hover:bg-card-border"
                  onClick={() => handleSort("health")}
                >
                  <div className="flex items-center gap-1">
                    Health
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase cursor-pointer hover:bg-card-border"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-mono font-semibold text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {paginatedNodes.map((node) => (
                <tr key={node.ip} className="hover:bg-card-border/50 transition">
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-900">{node.ip}</span>
                        <button
                          onClick={() => copyToClipboard(node.ip)}
                          className="p-1 hover:bg-gray-200 rounded transition"
                          title="Copy IP"
                        >
                          {copiedIp === node.ip ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                      {node.pubkey && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[200px]" title={node.pubkey}>
                          {node.pubkey.slice(0, 8)}...{node.pubkey.slice(-6)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {node.stats?.cpu_percent !== undefined ? (
                      <Sparkline 
                        data={(() => {
                          // Generate synthetic CPU trend data based on current value
                          const base = node.stats?.cpu_percent || 0;
                          const variance = 15;
                          return Array.from({ length: 10 }, (_, i) => {
                            const noise = (Math.sin(i * 0.8 + base) * variance) + (Math.random() * 5 - 2.5);
                            return Math.max(0, Math.min(100, base + noise - (i * 0.5)));
                          });
                        })()}
                        width={80}
                        height={24}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm text-foreground flex items-center gap-2">
                        <span>{getFlagEmoji(node.geo?.country || "")}</span>
                        {node.geo?.country || "Unknown"}
                      </span>
                      {node.geo?.city && (
                        <p className="text-xs text-gray-400 ml-6">{node.geo.city}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-orb-teal/10 text-orb-teal rounded-full font-mono">
                      {node.version || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    {node.stats ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              (node.stats.cpu_percent || 0) > 80 ? 'bg-red-500' :
                              (node.stats.cpu_percent || 0) > 60 ? 'bg-orb-orange' : 'bg-orb-teal'
                            }`}
                            style={{ width: `${Math.min(node.stats.cpu_percent || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-10 font-mono">{typeof node.stats?.cpu_percent === "number" ? node.stats.cpu_percent.toFixed(0) : "0"}%</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm font-mono">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 w-32">
                    {node.derived ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              node.derived.ram_usage_percent > 80 ? 'bg-red-500' :
                              node.derived.ram_usage_percent > 60 ? 'bg-orb-orange' : 'bg-orb-purple'
                            }`}
                            style={{ width: `${Math.min(node.derived.ram_usage_percent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-10 font-mono">{typeof node.derived?.ram_usage_percent === "number" ? node.derived.ram_usage_percent.toFixed(0) : "0"}%</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm font-mono">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground font-mono">
                      {node.derived?.uptime_human || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold text-sm font-mono ${
                      (node.derived?.health_score || 0) >= 80 ? 'text-orb-teal' :
                      (node.derived?.health_score || 0) >= 60 ? 'text-orb-orange' :
                      (node.derived?.health_score || 0) >= 40 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {node.derived?.health_score || 0}/100
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium font-mono ${
                      node.status === 'Online' ? 'bg-orb-teal/10 text-orb-teal' :
                      node.status === 'Offline' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        node.status === 'Online' ? 'bg-orb-teal' :
                        node.status === 'Offline' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      {node.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/node/${encodeURIComponent(node.ip)}`}
                        className="p-2 hover:bg-orb-teal/10 text-orb-teal rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDiagnose(node)}
                        className="p-2 hover:bg-orb-teal/10 text-gray-400 hover:text-orb-teal rounded-lg transition"
                        title="AI Diagnose"
                      >
                        <Stethoscope className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-card-border bg-card-bg">
            <p className="text-sm text-gray-400 font-mono">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredNodes.length)} of{" "}
              {filteredNodes.length} nodes
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-card-border rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400 font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-card-border rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Node Details Modal - Now using /node/[ip] page instead */}
    </div>
    </div>
  );
}

export default function NodesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e85a4f] to-[#c94a40] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">X</span>
          </div>
          <p className="text-gray-500">Loading nodes...</p>
        </div>
      </div>
    }>
      <NodesPageContent />
    </Suspense>
  );
}
