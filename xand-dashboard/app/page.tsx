"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Activity, Server, Globe, ShieldCheck, Clock, Cpu } from "lucide-react";

// --- Types (Must match your Backend API) ---
interface NetworkStats {
  network: {
    total_nodes: number;
    unique_ips: number;
    last_sync: string;
  };
  bootstrap: {
    cpu_percent: number;
    ram_used: number;
    total_bytes: number;
    uptime: number;
  } | null;
  versions: Record<string, number>;
}

interface Node {
  ip: string;
  address: string;
  version: string;
  status: string;
  lastSeen: string;
}

interface PNodesResponse {
  meta: { active_nodes: number };
  nodes: Node[];
}

// --- Components ---
const StatCard = ({ title, value, icon: Icon, subtext }: any) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start space-x-4">
    <div className="p-3 bg-blue-50 rounded-lg">
      <Icon className="w-6 h-6 text-blue-600" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Data from your Backend
  const fetchData = async () => {
    try {
      // Note: Assuming backend is on localhost:3000
      const statsReq = axios.get("http://localhost:3000/stats");
      const nodesReq = axios.get("http://localhost:3000/pnodes");

      const [statsRes, nodesRes] = await Promise.all([statsReq, nodesReq]);
      
      setStats(statsRes.data);
      setNodes(nodesRes.data.nodes);
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

  if (loading) return <div className="flex h-screen items-center justify-center text-blue-600">Loading Xandeum Network...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Xandeum Network Explorer</h1>
            <p className="text-gray-500 mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Network Data • Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Refresh Now
          </button>
        </div>

        {/* 1. Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Active Nodes" 
            value={stats?.network.total_nodes} 
            icon={Server} 
            subtext={`${stats?.network.unique_ips} Unique IPs`}
          />
          <StatCard 
            title="Bootstrap CPU" 
            value={stats?.bootstrap ? `${stats.bootstrap.cpu_percent.toFixed(1)}%` : "N/A"} 
            icon={Cpu} 
            subtext="Network Entrypoint Load"
          />
          <StatCard 
            title="Storage Used" 
            value={stats?.bootstrap ? `${(stats.bootstrap.total_bytes / 1024 / 1024).toFixed(2)} MB` : "N/A"} 
            icon={Activity} 
            subtext="Tracked on Bootstrap"
          />
          <StatCard 
            title="Network Uptime" 
            value={stats?.bootstrap ? `${Math.floor(stats.bootstrap.uptime / 86400)} Days` : "N/A"} 
            icon={Clock} 
            subtext="Continuous Operation"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 2. Version Distribution (Chart Replacement) */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
              Software Versions
            </h2>
            <div className="space-y-4">
              {stats?.versions && Object.entries(stats.versions)
                .sort(([,a], [,b]) => b - a)
                .map(([version, count]) => (
                <div key={version}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 font-mono">{version}</span>
                    <span className="font-medium">{count} nodes</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(count / (stats?.network.total_nodes || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Node List Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-500" />
                Live pNode Feed
              </h2>
            </div>
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Address</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">IP Location</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Version</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {nodes.map((node, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-mono text-gray-700">{node.address}</td>
                      <td className="p-4 text-gray-500">{node.ip}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          {node.version}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}