"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Search, Filter, X, ChevronLeft, ChevronRight,
  Server, Globe2, Cpu, Clock, ArrowUpDown, Eye,
  Stethoscope, Copy, Check, RefreshCw
} from "lucide-react";
import { fetchNodes, diagnoseNode } from "../lib/api";
import { Node, PNodesResponse } from "../lib/types";
import { StatusBadge, HealthBadge, MetricBar, LoadingSpinner } from "../components/ui";

const ITEMS_PER_PAGE = 25;

type SortField = "ip" | "country" | "health" | "cpu" | "uptime" | "status";
type SortDirection = "asc" | "desc";

interface FilterState {
  search: string;
  status: string;
  country: string;
  healthMin: number;
}

export default function NodesPage() {
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
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" text="Loading Nodes..." />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Network Nodes</h1>
          <p className="text-gray-500 mt-1">
            {filteredNodes.length} of {data?.nodes.length || 0} nodes
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

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Nodes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("ip")}
                >
                  <div className="flex items-center gap-1">
                    Node
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("country")}
                >
                  <div className="flex items-center gap-1">
                    Location
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Version
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("cpu")}
                >
                  <div className="flex items-center gap-1">
                    CPU
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  RAM
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("uptime")}
                >
                  <div className="flex items-center gap-1">
                    Uptime
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("health")}
                >
                  <div className="flex items-center gap-1">
                    Health
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedNodes.map((node) => (
                <tr key={node.ip} className="hover:bg-gray-50 transition">
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
                    <div>
                      <span className="text-sm text-gray-900">{node.geo?.country || "Unknown"}</span>
                      {node.geo?.city && (
                        <p className="text-xs text-gray-400">{node.geo.city}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {node.version || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-32">
                    {node.stats ? (
                      <MetricBar value={node.stats.cpu_percent || 0} label="" showValue />
                    ) : (
                      <span className="text-gray-400 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 w-32">
                    {node.derived ? (
                      <MetricBar value={node.derived.ram_usage_percent} label="" showValue />
                    ) : (
                      <span className="text-gray-400 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-900">
                      {node.derived?.uptime_human || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge score={node.derived?.health_score || 0} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={node.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedNode(node)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDiagnose(node)}
                        className="p-2 hover:bg-teal-50 text-teal-600 rounded-lg transition"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredNodes.length)} of{" "}
              {filteredNodes.length} nodes
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Node Details Modal */}
      {selectedNode && !diagnosisResult && (
        <NodeDetailsModal 
          node={selectedNode} 
          onClose={() => setSelectedNode(null)}
          onDiagnose={() => handleDiagnose(selectedNode)}
          diagnosing={diagnosing}
        />
      )}

      {/* Diagnosis Modal */}
      {selectedNode && diagnosisResult && (
        <DiagnosisModal
          node={selectedNode}
          result={diagnosisResult}
          onClose={() => {
            setSelectedNode(null);
            setDiagnosisResult(null);
          }}
        />
      )}
    </div>
  );
}

// Node Details Modal Component
function NodeDetailsModal({ 
  node, 
  onClose, 
  onDiagnose,
  diagnosing 
}: { 
  node: Node; 
  onClose: () => void;
  onDiagnose: () => void;
  diagnosing: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">Node Details</h2>
              <p className="text-blue-100 mt-1 font-mono">{node.address}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex gap-3 mt-4">
            <StatusBadge status={node.status} />
            {node.derived && <HealthBadge score={node.derived.health_score} size="md" />}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Location</p>
              <p className="text-lg font-semibold text-gray-900">
                {node.geo?.country || "Unknown"}
              </p>
              <p className="text-sm text-gray-600">{node.geo?.city || "Unknown City"}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Version</p>
              <p className="text-lg font-semibold text-gray-900">{node.version || "Unknown"}</p>
              <p className="text-sm text-gray-600">Uptime: {node.derived?.uptime_human || "N/A"}</p>
            </div>
          </div>

          {/* Public Key */}
          {node.pubkey && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Public Key</p>
              <p className="text-sm font-mono text-gray-900 break-all">{node.pubkey}</p>
            </div>
          )}

          {/* Hardware Metrics */}
          {node.stats && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-500" />
                Hardware Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <MetricBar value={node.stats.cpu_percent || 0} label="CPU Usage" />
                <MetricBar value={node.derived?.ram_usage_percent || 0} label="RAM Usage" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-500">Packets Sent</p>
                  <p className="font-semibold">{(node.stats.packets_sent || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Packets Received</p>
                  <p className="font-semibold">{(node.stats.packets_received || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Diagnose Button */}
          <button
            onClick={onDiagnose}
            disabled={diagnosing}
            className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-medium hover:from-teal-700 hover:to-cyan-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {diagnosing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Stethoscope className="w-5 h-5" />
                Run AI Diagnosis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Diagnosis Result Modal
function DiagnosisModal({ 
  node, 
  result, 
  onClose 
}: { 
  node: Node; 
  result: any; 
  onClose: () => void;
}) {
  const statusColors = {
    Healthy: "border-green-500 bg-green-50 text-green-700",
    Warning: "border-yellow-500 bg-yellow-50 text-yellow-700",
    Critical: "border-red-500 bg-red-50 text-red-700",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Stethoscope className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">AI Diagnosis</h2>
                <p className="text-teal-100 mt-1 font-mono">{node.ip}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
          {/* Status */}
          <div className={`border-l-4 rounded-xl p-4 ${statusColors[result.diagnosis.status as keyof typeof statusColors]}`}>
            <p className="font-bold text-lg">{result.diagnosis.status}</p>
            <p className="mt-1">{result.diagnosis.summary}</p>
          </div>

          {/* Metrics Comparison */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 mb-4">Metrics vs Network Average</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">CPU Usage</p>
                <p className="text-xl font-bold">{result.diagnosis.metrics_comparison.cpu.node.toFixed(1)}%</p>
                <p className="text-xs text-gray-400">avg: {result.diagnosis.metrics_comparison.cpu.network_avg.toFixed(1)}%</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">RAM Usage</p>
                <p className="text-xl font-bold">{result.diagnosis.metrics_comparison.ram.node.toFixed(1)}%</p>
                <p className="text-xs text-gray-400">avg: {result.diagnosis.metrics_comparison.ram.network_avg.toFixed(1)}%</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-gray-500 mb-1">Uptime</p>
                <p className="text-xl font-bold">{result.diagnosis.metrics_comparison.uptime.node}</p>
                <p className="text-xs text-gray-400">avg: {result.diagnosis.metrics_comparison.uptime.network_avg}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Generated at {new Date(result.generated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
