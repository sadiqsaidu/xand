"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { 
  ArrowLeft, Copy, Check, ExternalLink, Cpu, HardDrive,
  Clock, Activity, Globe2, Server, Sparkles, RefreshCw,
  AlertCircle, CheckCircle, XCircle
} from "lucide-react";
import Link from "next/link";
import { fetchNodeDetails, diagnoseNode } from "../../lib/api";
import { Node } from "../../lib/types";

interface NodePageProps {
  params: Promise<{ ip: string }>;
}

export default function NodePage({ params }: NodePageProps) {
  const resolvedParams = use(params);
  const ip = decodeURIComponent(resolvedParams.ip);
  
  const [node, setNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNode() {
      try {
        const data = await fetchNodeDetails(ip);
        setNode(data.node);
      } catch (err) {
        setError("Failed to load node details");
      } finally {
        setLoading(false);
      }
    }
    loadNode();
  }, [ip]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDiagnose = async () => {
    setDiagnosing(true);
    try {
      const result = await diagnoseNode(ip);
      setDiagnosis(result);
    } catch (err) {
      console.error("Diagnosis failed:", err);
    } finally {
      setDiagnosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e85a4f] to-[#c94a40] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">X</span>
          </div>
          <p className="text-gray-500">Loading node details...</p>
        </div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Node Not Found</h2>
          <p className="text-gray-500">The node with IP {ip} could not be found.</p>
        </div>
      </div>
    );
  }

  const statusColor = node.status === "Online" ? "green" : node.status === "Offline" ? "red" : "gray";
  const healthScore = node.derived?.health_score || 0;
  const healthColor = healthScore >= 80 ? "green" : healthScore >= 60 ? "yellow" : "red";

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        {/* Node Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-${statusColor}-100 flex items-center justify-center`}>
                <Server className={`w-7 h-7 text-${statusColor}-600`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{node.ip}</h1>
                  <button
                    onClick={() => copyToClipboard(node.ip)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {node.geo && (
                  <p className="text-gray-500 flex items-center gap-1 mt-1">
                    <Globe2 className="w-4 h-4" />
                    {node.geo.city}, {node.geo.country}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-${statusColor}-100 text-${statusColor}-700`}>
                <span className={`w-2 h-2 rounded-full bg-${statusColor}-500`} />
                {node.status}
              </span>
            </div>
          </div>

          {/* Pubkey */}
          {node.pubkey && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Public Key</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-700 font-mono flex-1 truncate">
                  {node.pubkey}
                </code>
                <button
                  onClick={() => copyToClipboard(node.pubkey!)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Health Score
            </div>
            <p className={`text-2xl font-bold text-${healthColor}-600`}>{healthScore}/100</p>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Uptime
            </div>
            <p className="text-2xl font-bold text-gray-900">{node.derived?.uptime_human || "N/A"}</p>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Cpu className="w-4 h-4" />
              CPU Usage
            </div>
            <p className="text-2xl font-bold text-gray-900">{node.stats?.cpu_percent?.toFixed(1) || 0}%</p>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <HardDrive className="w-4 h-4" />
              RAM Usage
            </div>
            <p className="text-2xl font-bold text-gray-900">{node.derived?.ram_usage_percent?.toFixed(1) || 0}%</p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Node Statistics</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">Version</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{node.version || "Unknown"}</code>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">Active Streams</span>
              <span className="font-medium">{node.stats?.active_streams || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">Packets Received</span>
              <span className="font-medium">{node.stats?.packets_received?.toLocaleString() || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">Packets Sent</span>
              <span className="font-medium">{node.stats?.packets_sent?.toLocaleString() || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">Total Pages</span>
              <span className="font-medium">{node.stats?.total_pages?.toLocaleString() || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">RAM Total</span>
              <span className="font-medium">{formatBytes(node.stats?.ram_total || 0)}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">RAM Used</span>
              <span className="font-medium">{formatBytes(node.stats?.ram_used || 0)}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-500">Last Seen</span>
              <span className="font-medium">
                {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : "Never"}
              </span>
            </div>
          </div>
        </div>

        {/* AI Diagnosis Section - Like Orb's "Explain with AI" */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#e85a4f]" />
              <h2 className="text-lg font-semibold text-gray-900">AI Diagnosis</h2>
            </div>
            <button
              onClick={handleDiagnose}
              disabled={diagnosing || node.status !== "Online"}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#e85a4f] rounded-lg hover:bg-[#c94a40] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {diagnosing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Node
                </>
              )}
            </button>
          </div>
          
          <div className="p-6">
            {node.status !== "Online" ? (
              <div className="flex items-center gap-3 text-gray-500">
                <AlertCircle className="w-5 h-5" />
                <p>AI diagnosis is only available for online nodes.</p>
              </div>
            ) : diagnosis ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {diagnosis.diagnosis.status === "Healthy" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Healthy
                    </span>
                  ) : diagnosis.diagnosis.status === "Warning" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                      <AlertCircle className="w-4 h-4" />
                      Warning
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      <XCircle className="w-4 h-4" />
                      Critical
                    </span>
                  )}
                </div>

                {/* Summary */}
                <p className="text-gray-700">{diagnosis.diagnosis.summary}</p>

                {/* Metrics Comparison */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">CPU</p>
                    <p className="font-semibold">Node: {diagnosis.diagnosis.metrics_comparison.cpu.node.toFixed(1)}%</p>
                    <p className="text-sm text-gray-400">Avg: {diagnosis.diagnosis.metrics_comparison.cpu.network_avg.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">RAM</p>
                    <p className="font-semibold">Node: {diagnosis.diagnosis.metrics_comparison.ram.node.toFixed(1)}%</p>
                    <p className="text-sm text-gray-400">Avg: {diagnosis.diagnosis.metrics_comparison.ram.network_avg.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Uptime</p>
                    <p className="font-semibold">Node: {diagnosis.diagnosis.metrics_comparison.uptime.node}</p>
                    <p className="text-sm text-gray-400">Avg: {diagnosis.diagnosis.metrics_comparison.uptime.network_avg}</p>
                  </div>
                </div>

                {/* Recommendations */}
                {diagnosis.diagnosis.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Recommendations:</p>
                    <ul className="space-y-2">
                      {diagnosis.diagnosis.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-[#e85a4f]">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Click "Analyze Node" to get an AI-powered health diagnosis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
