"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Activity, Server, Globe, ShieldCheck, Clock, Cpu, 
  HardDrive, Wifi, X, Database, Zap, TrendingUp,
  AlertCircle, CheckCircle2, XCircle, HelpCircle,
  Sparkles, Stethoscope, Newspaper, Search, Loader2, RefreshCw
} from "lucide-react";
import { 
  BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer 
} from "recharts";

// --- Types (Must match Backend API) ---
interface NodeStats {
  active_streams?: number;
  packets_received?: number;
  packets_sent?: number;
  file_size?: number;
  total_bytes?: number;
  total_pages?: number;
  current_index?: number;
  cpu_percent?: number;
  ram_used?: number;
  ram_total?: number;
  uptime?: number;
  last_updated?: number;
}

interface DerivedMetrics {
  storage_utilization_percent: number;
  ram_usage_percent: number;
  uptime_human: string;
  packets_per_second: number;
  health_score: number;
}

interface Node {
  ip: string;
  address: string;
  version?: string;
  pubkey?: string | null;
  status: "Online" | "Offline" | "Unknown";
  lastSeen: Date | string | null;
  lastSeenTimestamp?: number | null;
  stats: NodeStats | null;
  geo?: {
    country: string;
    city: string;
    lat?: number;
    lon?: number;
  } | null;
  derived: DerivedMetrics | null;
  stats_formatted?: {
    cpu: string;
    ram: string;
    storage: string;
    uptime: string;
    packets: string;
  } | null;
}

interface NetworkStats {
  network: {
    total_nodes: number;
    online_nodes: number;
    unique_ips: number;
    last_sync: string | null;
  };
  storage: {
    total_used_bytes: number;
    total_capacity_bytes: number;
    total_used_human: string;
    total_capacity_human: string;
    utilization_percent: number;
  };
  bootstrap: NodeStats | null;
  bootstrap_derived: DerivedMetrics | null;
  versions: Record<string, number>;
  status_distribution: Record<string, number>;
  countries: Record<string, number>;
  health_distribution: Record<string, number>;
}

interface PNodesResponse {
  meta: {
    total_nodes: number;
    online_nodes: number;
    offline_nodes: number;
    unknown_nodes: number;
    last_sync: string | null;
    storage: {
      total_used_bytes: number;
      total_capacity_bytes: number;
      total_used_human: string;
      total_capacity_human: string;
      utilization_percent: number;
    };
    traffic: {
      total_packets_sent: number;
      total_packets_received: number;
      total_packets: number;
    };
    health: {
      avg_cpu_percent: number;
      avg_ram_percent: number;
      avg_health_score: number;
    };
  };
  nodes: Node[];
}

interface NodeDetailsData {
  node: Node & {
    stats_formatted?: {
      cpu_percent: string;
      ram_used_human: string;
      ram_total_human: string;
      ram_percent: number;
      file_size_human: string;
      total_bytes_human: string;
      storage_percent: number;
      total_pages: number;
      current_index: number;
      packets_sent: string;
      packets_received: string;
      active_streams: number;
      packets_per_second: number;
      uptime_seconds: number;
      uptime_human: string;
      health_score: number;
    } | null;
  };
  fetched_at: string;
}

// --- AI Feature Types ---
interface SearchFilter {
  country?: string;
  status?: "Online" | "Offline" | "Unknown";
  min_ram_gb?: number;
  max_ram_gb?: number;
  min_storage_gb?: number;
  max_storage_gb?: number;
  min_cpu_percent?: number;
  max_cpu_percent?: number;
  min_health_score?: number;
  version?: string;
}

interface DiagnosisResult {
  status: "Healthy" | "Warning" | "Critical";
  summary: string;
  recommendations: string[];
  metrics_comparison: {
    cpu: { node: number; network_avg: number; status: string };
    ram: { node: number; network_avg: number; status: string };
    uptime: { node: string; network_avg: string; status: string };
  };
}

interface DiagnoseResponse {
  diagnosis: DiagnosisResult;
  node_data: any;
  network_averages: any;
  generated_at: string;
}

interface BriefingResult {
  headline: string;
  bullets: string[];
  generated_at: string;
  cached: boolean;
  error?: string;
}

// --- Components ---
const StatCard = ({ title, value, icon: Icon, subtext, trend }: any) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start space-x-4 hover:shadow-md transition-shadow">
    <div className="p-3 bg-blue-50 rounded-lg">
      <Icon className="w-6 h-6 text-blue-600" />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      {trend && <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> {trend}
      </p>}
    </div>
  </div>
);

// Health Badge Component
const HealthBadge = ({ score }: { score: number }) => {
  if (score >= 80) {
    return <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" /> Excellent
    </span>;
  } else if (score >= 60) {
    return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" /> Good
    </span>;
  } else if (score >= 40) {
    return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium flex items-center gap-1">
      <AlertCircle className="w-3 h-3" /> Fair
    </span>;
  } else {
    return <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium flex items-center gap-1">
      <XCircle className="w-3 h-3" /> Poor
    </span>;
  }
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "Online":
      return <span className="flex items-center gap-1.5 text-green-600 font-medium text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        Online
      </span>;
    case "Offline":
      return <span className="flex items-center gap-1.5 text-red-600 font-medium text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
        Offline
      </span>;
    default:
      return <span className="flex items-center gap-1.5 text-gray-500 font-medium text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
        Unknown
      </span>;
  }
};

// Metric Bar Component (for CPU/RAM visualization)
const MetricBar = ({ value, label, color = "blue" }: { value: number; label: string; color?: string }) => {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
  };
  
  const getColor = (val: number) => {
    if (val >= 90) return colorClasses.red;
    if (val >= 70) return colorClasses.orange;
    if (val >= 50) return colorClasses.yellow;
    return colorClasses.green;
  };
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div 
          className={`${getColor(value)} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

// Node Details Modal Component
const NodeDetailsModal = ({ node, onClose }: { node: Node | null; onClose: () => void }) => {
  const [detailedData, setDetailedData] = useState<NodeDetailsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (node?.ip) {
      setLoading(true);
      axios.get(`http://localhost:3000/pnodes/${node.ip}`)
        .then(res => setDetailedData(res.data))
        .catch(err => console.error("Failed to fetch node details", err))
        .finally(() => setLoading(false));
    }
  }, [node?.ip]);

  if (!node) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Node Details</h2>
            <p className="text-blue-100 mt-1 font-mono text-sm">{node.address}</p>
            <div className="flex gap-3 mt-3">
              <StatusBadge status={node.status} />
              {node.derived && <HealthBadge score={node.derived.health_score} />}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && detailedData && (
            <div className="space-y-6">
              {/* Identity Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Location</p>
                  <p className="text-lg font-semibold">
                    {node.geo?.country ? (
                      <>
                        {node.geo.country === "United States" ? "🇺🇸 " : 
                         node.geo.country === "Germany" ? "🇩🇪 " : 
                         node.geo.country === "Finland" ? "🇫🇮 " : "🌍 "} 
                        {node.geo.country}
                      </>
                    ) : "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{node.geo?.city || "Unknown City"}</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{node.ip}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Version</p>
                  <p className="text-lg font-semibold">{node.version || "Unknown"}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Uptime: {detailedData.node.stats_formatted?.uptime_human || "N/A"}
                  </p>
                </div>
              </div>

              {/* Hardware Vitals */}
              {detailedData.node.stats_formatted && (
                <>
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-purple-500" />
                      Hardware Vitals
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <MetricBar 
                          value={parseFloat(detailedData.node.stats_formatted.cpu_percent)} 
                          label="CPU Usage" 
                        />
                      </div>
                      <div>
                        <MetricBar 
                          value={detailedData.node.stats_formatted.ram_percent} 
                          label="RAM Usage" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-gray-500">RAM Used</p>
                        <p className="text-lg font-semibold">{detailedData.node.stats_formatted.ram_used_human}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">RAM Total</p>
                        <p className="text-lg font-semibold">{detailedData.node.stats_formatted.ram_total_human}</p>
                      </div>
                    </div>
                  </div>

                  {/* Storage Details */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Database className="w-5 h-5 text-green-500" />
                      Storage Details
                    </h3>
                    <div className="space-y-4">
                      <MetricBar 
                        value={detailedData.node.stats_formatted.storage_percent} 
                        label="Storage Utilization" 
                      />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-gray-500">Used</p>
                          <p className="text-lg font-semibold">{detailedData.node.stats_formatted.file_size_human}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Capacity</p>
                          <p className="text-lg font-semibold">{detailedData.node.stats_formatted.total_bytes_human}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Pages</p>
                          <p className="text-lg font-semibold">{detailedData.node.stats_formatted.total_pages.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Current Index</p>
                          <p className="text-lg font-semibold">{detailedData.node.stats_formatted.current_index.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Network Activity */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Wifi className="w-5 h-5 text-blue-500" />
                      Network Activity
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Packets Sent</p>
                        <p className="text-xl font-bold text-blue-600">{detailedData.node.stats_formatted.packets_sent}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Packets Received</p>
                        <p className="text-xl font-bold text-green-600">{detailedData.node.stats_formatted.packets_received}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Active Streams</p>
                        <p className="text-xl font-bold text-purple-600">{detailedData.node.stats_formatted.active_streams}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Packets/sec</p>
                        <p className="text-xl font-bold text-orange-600">{detailedData.node.stats_formatted.packets_per_second.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {!detailedData.node.stats_formatted && (
                <div className="text-center py-12 text-gray-500">
                  <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No detailed statistics available for this node</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===========================
// AI-POWERED COMPONENTS
// ===========================

// Part 1: Magic Search Bar Component
const MagicSearchBar = ({ 
  onFilter, 
  onClear 
}: { 
  onFilter: (filter: SearchFilter) => void; 
  onClear: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      handleClear();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post("http://localhost:3000/ai/search", { query });
      const filter = response.data.filter as SearchFilter;
      
      if (Object.keys(filter).length === 0) {
        setError("No matching filters found. Try: 'healthy nodes in Germany'");
      } else {
        setActiveFilter(filter);
        onFilter(filter);
      }
    } catch (err: any) {
      console.error("Magic Search failed:", err);
      setError("AI search unavailable. Try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setActiveFilter(null);
    setError(null);
    onClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-xl shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <Sparkles className="w-5 h-5 text-yellow-300" />
        <h3 className="text-white font-semibold">Magic Search</h3>
        <span className="text-purple-200 text-xs">AI-Powered</span>
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Try: 'Show me healthy nodes in Germany with > 16GB RAM'"
            className="w-full px-4 py-3 pr-10 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
            disabled={isLoading}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white animate-spin" />
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-6 py-3 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition disabled:opacity-50"
        >
          <Search className="w-5 h-5" />
        </button>
        {activeFilter && (
          <button
            onClick={handleClear}
            className="px-4 py-3 bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Active Filter Display */}
      {activeFilter && Object.keys(activeFilter).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(activeFilter).map(([key, value]) => (
            <span
              key={key}
              className="px-3 py-1 bg-white/20 text-white text-sm rounded-full"
            >
              {key.replace(/_/g, " ")}: {String(value)}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-yellow-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
};

// Part 2: Node Doctor Modal Component
const NodeDoctorModal = ({ 
  node, 
  onClose 
}: { 
  node: Node | null; 
  onClose: () => void;
}) => {
  const [diagnosis, setDiagnosis] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (node?.ip) {
      setLoading(true);
      setError(null);
      setDiagnosis(null);

      axios.post("http://localhost:3000/ai/diagnose", { ip: node.ip })
        .then(res => setDiagnosis(res.data))
        .catch(err => {
          console.error("Diagnosis failed:", err);
          setError(err?.response?.data?.error || "Diagnosis service unavailable");
        })
        .finally(() => setLoading(false));
    }
  }, [node?.ip]);

  if (!node) return null;

  const statusColors = {
    Healthy: "border-green-500 bg-green-50",
    Warning: "border-yellow-500 bg-yellow-50",
    Critical: "border-red-500 bg-red-50",
  };

  const statusIcons = {
    Healthy: <CheckCircle2 className="w-6 h-6 text-green-500" />,
    Warning: <AlertCircle className="w-6 h-6 text-yellow-500" />,
    Critical: <XCircle className="w-6 h-6 text-red-500" />,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Stethoscope className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Node Doctor</h2>
              <p className="text-teal-100 mt-1 font-mono text-sm">{node.ip}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-4" />
              <p className="text-gray-500">AI is analyzing node health...</p>
              <p className="text-gray-400 text-sm mt-1">Comparing against network averages</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {diagnosis && (
            <div className="space-y-6">
              {/* Diagnosis Summary */}
              <div className={`border-l-4 rounded-xl p-6 ${statusColors[diagnosis.diagnosis.status]}`}>
                <div className="flex items-start gap-4">
                  {statusIcons[diagnosis.diagnosis.status]}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg font-bold ${
                        diagnosis.diagnosis.status === "Healthy" ? "text-green-700" :
                        diagnosis.diagnosis.status === "Warning" ? "text-yellow-700" : "text-red-700"
                      }`}>
                        {diagnosis.diagnosis.status}
                      </span>
                      <span className="text-gray-400 text-sm">• AI Analysis</span>
                    </div>
                    <p className="text-gray-700">{diagnosis.diagnosis.summary}</p>
                  </div>
                </div>
              </div>

              {/* Metrics Comparison */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Metrics vs Network Average
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <p className="text-xs text-gray-500 mb-1">CPU Usage</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">{diagnosis.diagnosis.metrics_comparison.cpu.node.toFixed(1)}%</span>
                      <span className="text-sm text-gray-400">
                        avg: {diagnosis.diagnosis.metrics_comparison.cpu.network_avg.toFixed(1)}%
                      </span>
                    </div>
                    <span className={`text-xs ${
                      diagnosis.diagnosis.metrics_comparison.cpu.status === "good" ? "text-green-600" : "text-yellow-600"
                    }`}>
                      {diagnosis.diagnosis.metrics_comparison.cpu.status === "good" ? "✓ Normal" : "⚠ Elevated"}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <p className="text-xs text-gray-500 mb-1">RAM Usage</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">{diagnosis.diagnosis.metrics_comparison.ram.node.toFixed(1)}%</span>
                      <span className="text-sm text-gray-400">
                        avg: {diagnosis.diagnosis.metrics_comparison.ram.network_avg.toFixed(1)}%
                      </span>
                    </div>
                    <span className={`text-xs ${
                      diagnosis.diagnosis.metrics_comparison.ram.status === "good" ? "text-green-600" : "text-yellow-600"
                    }`}>
                      {diagnosis.diagnosis.metrics_comparison.ram.status === "good" ? "✓ Normal" : "⚠ Elevated"}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <p className="text-xs text-gray-500 mb-1">Uptime</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">{diagnosis.diagnosis.metrics_comparison.uptime.node}</span>
                      <span className="text-sm text-gray-400">
                        avg: {diagnosis.diagnosis.metrics_comparison.uptime.network_avg}
                      </span>
                    </div>
                    <span className={`text-xs ${
                      diagnosis.diagnosis.metrics_comparison.uptime.status === "good" ? "text-green-600" : "text-yellow-600"
                    }`}>
                      {diagnosis.diagnosis.metrics_comparison.uptime.status === "good" ? "✓ Good" : "⚠ Low"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {diagnosis.diagnosis.recommendations.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {diagnosis.diagnosis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-blue-800">
                        <span className="text-blue-500 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Analysis generated at {new Date(diagnosis.generated_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Part 3: Daily Briefing Widget Component
const DailyBriefing = () => {
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get("http://localhost:3000/ai/briefing");
      setBriefing(response.data);
    } catch (err: any) {
      console.error("Failed to fetch briefing:", err);
      setError("Unable to load briefing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Daily Briefing</h3>
        </div>
        <div className="flex items-center gap-2">
          {briefing?.cached && (
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Cached</span>
          )}
          <button
            onClick={fetchBriefing}
            disabled={loading}
            className="p-1.5 hover:bg-amber-100 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 text-amber-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !briefing && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
        </div>
      )}

      {error && !briefing && (
        <div className="text-center py-4 text-amber-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {briefing && (
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
          <p className="text-xs text-amber-600 mt-4 text-right">
            {briefing.cached ? "📦 Cached • " : "✨ Fresh • "}
            {new Date(briefing.generated_at).toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [diagnosingNode, setDiagnosingNode] = useState<Node | null>(null);
  const [activeFilter, setActiveFilter] = useState<SearchFilter | null>(null);

  // Apply filters to nodes
  const applyFilter = useCallback((filter: SearchFilter) => {
    setActiveFilter(filter);
    
    let result = [...nodes];

    if (filter.country) {
      result = result.filter(n => 
        n.geo?.country?.toLowerCase().includes(filter.country!.toLowerCase())
      );
    }

    if (filter.status) {
      result = result.filter(n => n.status === filter.status);
    }

    if (filter.min_ram_gb) {
      const minRamBytes = filter.min_ram_gb * 1024 * 1024 * 1024;
      result = result.filter(n => (n.stats?.ram_total || 0) >= minRamBytes);
    }

    if (filter.max_ram_gb) {
      const maxRamBytes = filter.max_ram_gb * 1024 * 1024 * 1024;
      result = result.filter(n => (n.stats?.ram_total || 0) <= maxRamBytes);
    }

    if (filter.min_health_score) {
      result = result.filter(n => (n.derived?.health_score || 0) >= filter.min_health_score!);
    }

    if (filter.min_cpu_percent) {
      result = result.filter(n => (n.stats?.cpu_percent || 0) >= filter.min_cpu_percent!);
    }

    if (filter.max_cpu_percent) {
      result = result.filter(n => (n.stats?.cpu_percent || 0) <= filter.max_cpu_percent!);
    }

    if (filter.version) {
      result = result.filter(n => 
        n.version?.toLowerCase().includes(filter.version!.toLowerCase())
      );
    }

    setFilteredNodes(result);
  }, [nodes]);

  const clearFilter = useCallback(() => {
    setActiveFilter(null);
    setFilteredNodes(nodes);
  }, [nodes]);

  // Fetch Data from Backend
  const fetchData = async () => {
    try {
      const statsReq = axios.get<NetworkStats>("http://localhost:3000/stats");
      const nodesReq = axios.get<PNodesResponse>("http://localhost:3000/pnodes");

      const [statsRes, nodesRes] = await Promise.all([statsReq, nodesReq]);
      
      setStats(statsRes.data);
      setNodes(nodesRes.data.nodes);
      
      // Reapply filter if active, otherwise show all
      if (activeFilter) {
        applyFilter(activeFilter);
      } else {
        setFilteredNodes(nodesRes.data.nodes);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-semibold">Loading Xandeum Network...</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const versionChartData = stats?.versions 
    ? Object.entries(stats.versions).map(([version, count]) => ({
        name: version.length > 20 ? version.substring(0, 20) + "..." : version,
        fullName: version,
        count
      })).sort((a, b) => b.count - a.count).slice(0, 10) // Top 10
    : [];

  const statusChartData = stats?.status_distribution
    ? Object.entries(stats.status_distribution).map(([status, count]) => ({
        name: status,
        value: count
      }))
    : [];

  const COLORS = {
    Online: "#10b981",
    Offline: "#ef4444",
    Unknown: "#6b7280",
  };

  const onlineNodes = nodes.filter(n => n.status === "Online");
  const avgHealth = onlineNodes.length > 0
    ? onlineNodes.reduce((acc, n) => acc + (n.derived?.health_score || 0), 0) / onlineNodes.length
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-[1800px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              Xandeum Network Explorer
            </h1>
            <p className="text-gray-500 mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Network Data • Last updated: {stats?.network.last_sync 
                ? new Date(stats.network.last_sync).toLocaleTimeString() 
                : "Never"}
            </p>
          </div>
          <button 
            onClick={fetchData}
            className="px-6 py-3 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh Now
          </button>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard 
            title="Active Nodes" 
            value={stats?.network.online_nodes || 0} 
            icon={Server} 
            subtext={`${stats?.network.total_nodes} Total Nodes`}
          />
          <StatCard 
            title="Network Health" 
            value={`${avgHealth.toFixed(0)}/100`}
            icon={Zap} 
            subtext="Average Health Score"
            trend={avgHealth >= 80 ? "Excellent" : avgHealth >= 60 ? "Good" : "Needs Attention"}
          />
          <StatCard 
            title="Storage Used" 
            value={stats?.storage.total_used_human || "0 B"} 
            icon={HardDrive} 
            subtext={`${stats?.storage.utilization_percent.toFixed(1)}% of ${stats?.storage.total_capacity_human}`}
          />
          <StatCard 
            title="Network Uptime" 
            value={stats?.bootstrap_derived?.uptime_human || "N/A"} 
            icon={Clock} 
            subtext="Bootstrap Node"
          />
        </div>

        {/* AI Features Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Magic Search Bar */}
          <div className="lg:col-span-2">
            <MagicSearchBar onFilter={applyFilter} onClear={clearFilter} />
          </div>
          
          {/* Daily Briefing */}
          <div className="lg:col-span-1">
            <DailyBriefing />
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Version Distribution Bar Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
              Software Version Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={versionChartData}>
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelFormatter={(label) => {
                    const item = versionChartData.find(d => d.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution Donut Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-500" />
              Network Status
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {statusChartData.map((item) => (
                <div key={item.name} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[item.name as keyof typeof COLORS] }}
                    ></div>
                    <span>{item.name}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Storage Progress Widget */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-5 h-5" />
              Network Storage Health
            </h3>
            <span className="text-2xl font-bold">{stats?.storage.utilization_percent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-blue-800 rounded-full h-4">
            <div 
              className="bg-white h-4 rounded-full transition-all shadow-lg"
              style={{ width: `${Math.min(stats?.storage.utilization_percent || 0, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-3 text-sm text-blue-100">
            <span>{stats?.storage.total_used_human} Used</span>
            <span>{stats?.storage.total_capacity_human} Total Capacity</span>
          </div>
        </div>

        {/* Advanced Node Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Server className="w-5 h-5 text-green-500" />
              Live pNode Feed
              {activeFilter && (
                <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  Filtered
                </span>
              )}
              <span className="ml-auto text-sm font-normal text-gray-500">
                {filteredNodes.length} of {nodes.length} nodes • Click row for details
              </span>
            </h2>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Node</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Location</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Version</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">CPU %</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">RAM %</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Health</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredNodes.map((node, i) => {
                  const cpuPercent = node.stats?.cpu_percent || 0;
                  const ramPercent = node.derived?.ram_usage_percent || 0;
                  const healthScore = node.derived?.health_score || 0;
                  
                  return (
                    <tr 
                      key={i} 
                      className="hover:bg-blue-50 transition cursor-pointer"
                      onClick={() => setSelectedNode(node)}
                    >
                      <td className="p-4">
                        <div className="font-mono text-gray-700 text-xs">{node.address}</div>
                        <div className="text-xs text-gray-400 mt-1">{node.ip}</div>
                      </td>
                      <td className="p-4 text-gray-500">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 text-sm">
                            {node.geo?.country ? (
                              <>
                                {node.geo.country === "United States" ? "🇺🇸 " : 
                                 node.geo.country === "Germany" ? "🇩🇪 " : 
                                 node.geo.country === "Finland" ? "🇫🇮 " : "🌍 "} 
                                {node.geo.country}
                              </>
                            ) : (
                              "Unknown"
                            )}
                          </span>
                          <span className="text-xs text-gray-400">{node.geo?.city || "-"}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          {node.version || "Unknown"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                cpuPercent > 80 ? 'bg-red-500' : 
                                cpuPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{cpuPercent.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                ramPercent > 80 ? 'bg-red-500' : 
                                ramPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(ramPercent, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{ramPercent.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <HealthBadge score={healthScore} />
                      </td>
                      <td className="p-4">
                        <StatusBadge status={node.status} />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDiagnosingNode(node);
                          }}
                          className="p-2 hover:bg-teal-100 rounded-lg transition text-teal-600 hover:text-teal-700"
                          title="AI Diagnose"
                        >
                          <Stethoscope className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>

      {/* Node Details Modal */}
      {selectedNode && (
        <NodeDetailsModal 
          node={selectedNode} 
          onClose={() => setSelectedNode(null)} 
        />
      )}

      {/* Node Doctor Modal */}
      {diagnosingNode && (
        <NodeDoctorModal 
          node={diagnosingNode} 
          onClose={() => setDiagnosingNode(null)} 
        />
      )}
    </div>
  );
}