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
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-orb-teal flex items-center justify-center animate-pulse">
            <span className="text-white font-mono font-bold text-lg">X</span>
          </div>
          <p className="text-gray-400 font-mono text-sm">Loading node details...</p>
        </div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 bg-background min-h-screen">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-orb-teal mb-8 font-mono text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-mono font-semibold text-foreground mb-2">Node Not Found</h2>
          <p className="text-gray-400 font-mono">The node with IP {ip} could not be found.</p>
        </div>
      </div>
    );
  }

  const statusColor = node.status === "Online" ? "orb-teal" : node.status === "Offline" ? "red-500" : "gray-400";
  const healthScore = node.derived?.health_score || 0;
  const healthColor = healthScore >= 80 ? "orb-teal" : healthScore >= 60 ? "orb-orange" : "red-500";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-orb-teal mb-6 font-mono text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        {/* Node Header */}
        <div className="bg-card-bg border border-card-border rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl ${
                node.status === "Online" ? "bg-orb-teal/10" : 
                node.status === "Offline" ? "bg-red-500/10" : "bg-gray-800"
              } flex items-center justify-center`}>
                <Server className={`w-7 h-7 ${
                  node.status === "Online" ? "text-orb-teal" : 
                  node.status === "Offline" ? "text-red-500" : "text-gray-400"
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-mono font-bold text-foreground">{node.ip}</h1>
                  <button
                    onClick={() => copyToClipboard(node.ip)}
                    className="p-1.5 text-gray-400 hover:text-orb-teal hover:bg-orb-teal/10 rounded transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-orb-teal" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {node.geo && (
                  <p className="text-gray-400 font-mono text-sm flex items-center gap-1 mt-1">
                    <Globe2 className="w-4 h-4" />
                    {node.geo.city}, {node.geo.country}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium ${
                node.status === "Online" ? "bg-orb-teal/10 text-orb-teal" : 
                node.status === "Offline" ? "bg-red-500/10 text-red-500" : "bg-gray-800 text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  node.status === "Online" ? "bg-orb-teal" : 
                  node.status === "Offline" ? "bg-red-500" : "bg-gray-400"
                }`} />
                {node.status}
              </span>
            </div>
          </div>

          {/* Pubkey */}
          {node.pubkey && (
            <div className="mt-4 p-3 bg-navy-900/50 rounded-lg border border-card-border">
              <p className="text-xs text-gray-400 font-mono mb-1">Public Key</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-300 font-mono flex-1 truncate">
                  {node.pubkey}
                </code>
                <button
                  onClick={() => copyToClipboard(node.pubkey!)}
                  className="p-1.5 text-gray-400 hover:text-orb-teal hover:bg-orb-teal/10 rounded transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-mono mb-1">
              <Activity className="w-4 h-4" />
              Health Score
            </div>
            <p className={`text-2xl font-mono font-bold ${
              healthScore >= 80 ? "text-orb-teal" : healthScore >= 60 ? "text-orb-orange" : "text-red-500"
            }`}>{healthScore}/100</p>
          </div>
          
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-mono mb-1">
              <Clock className="w-4 h-4" />
              Uptime
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">{node.derived?.uptime_human || "N/A"}</p>
          </div>
          
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-mono mb-1">
              <Cpu className="w-4 h-4" />
              CPU Usage
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">{node.stats?.cpu_percent?.toFixed(1) || 0}%</p>
          </div>
          
          <div className="bg-card-bg border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-mono mb-1">
              <HardDrive className="w-4 h-4" />
              RAM Usage
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">{node.derived?.ram_usage_percent?.toFixed(1) || 0}%</p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-card-border">
            <h2 className="text-lg font-mono font-semibold text-foreground">Node Statistics</h2>
          </div>
          <div className="divide-y divide-card-border">
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">Version</span>
              <code className="text-sm bg-navy-900 px-2 py-1 rounded text-orb-teal font-mono">{node.version || "Unknown"}</code>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">Active Streams</span>
              <span className="font-mono font-medium text-foreground">{node.stats?.active_streams || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">Packets Received</span>
              <span className="font-mono font-medium text-foreground">{node.stats?.packets_received?.toLocaleString() || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">Packets Sent</span>
              <span className="font-mono font-medium text-foreground">{node.stats?.packets_sent?.toLocaleString() || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">Total Pages</span>
              <span className="font-mono font-medium text-foreground">{node.stats?.total_pages?.toLocaleString() || 0}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">RAM Total</span>
              <span className="font-mono font-medium text-foreground">{formatBytes(node.stats?.ram_total || 0)}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">RAM Used</span>
              <span className="font-mono font-medium text-foreground">{formatBytes(node.stats?.ram_used || 0)}</span>
            </div>
            <div className="px-6 py-4 flex justify-between">
              <span className="text-gray-400 font-mono text-sm">Last Seen</span>
              <span className="font-mono font-medium text-foreground">
                {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : "Never"}
              </span>
            </div>
          </div>
        </div>

        {/* AI Diagnosis Section - Like Orb's "Explain with AI" */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orb-teal" />
              <h2 className="text-lg font-mono font-semibold text-foreground">AI Diagnosis</h2>
            </div>
            <button
              onClick={handleDiagnose}
              disabled={diagnosing || node.status !== "Online"}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-mono font-medium text-white bg-orb-teal rounded-lg hover:bg-orb-teal/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex items-center gap-3 text-gray-400 font-mono text-sm">
                <AlertCircle className="w-5 h-5" />
                <p>AI diagnosis is only available for online nodes.</p>
              </div>
            ) : diagnosis ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {diagnosis.diagnosis.status === "Healthy" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orb-teal/10 text-orb-teal rounded-full text-xs font-mono font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Healthy
                    </span>
                  ) : diagnosis.diagnosis.status === "Warning" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orb-orange/10 text-orb-orange rounded-full text-xs font-mono font-medium">
                      <AlertCircle className="w-4 h-4" />
                      Warning
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 rounded-full text-xs font-mono font-medium">
                      <XCircle className="w-4 h-4" />
                      Critical
                    </span>
                  )}
                </div>

                {/* Summary */}
                <p className="text-gray-300 font-mono text-sm leading-relaxed">{diagnosis.diagnosis.summary}</p>

                {/* Metrics Comparison */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-navy-900/50 border border-card-border rounded-lg">
                  <div>
                    <p className="text-xs font-mono text-gray-400 mb-1">CPU</p>
                    <p className="font-mono font-semibold text-foreground">Node: {diagnosis.diagnosis.metrics_comparison.cpu.node.toFixed(1)}%</p>
                    <p className="text-xs font-mono text-gray-500">Avg: {diagnosis.diagnosis.metrics_comparison.cpu.network_avg.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-gray-400 mb-1">RAM</p>
                    <p className="font-mono font-semibold text-foreground">Node: {diagnosis.diagnosis.metrics_comparison.ram.node.toFixed(1)}%</p>
                    <p className="text-xs font-mono text-gray-500">Avg: {diagnosis.diagnosis.metrics_comparison.ram.network_avg.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-gray-400 mb-1">Uptime</p>
                    <p className="font-mono font-semibold text-foreground">Node: {diagnosis.diagnosis.metrics_comparison.uptime.node}</p>
                    <p className="text-xs font-mono text-gray-500">Avg: {diagnosis.diagnosis.metrics_comparison.uptime.network_avg}</p>
                  </div>
                </div>

                {/* Recommendations */}
                {diagnosis.diagnosis.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-mono font-medium text-gray-300 mb-2">Recommendations:</p>
                    <ul className="space-y-2">
                      {diagnosis.diagnosis.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm font-mono text-gray-400">
                          <span className="text-orb-teal">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="font-mono text-sm">Click "Analyze Node" to get an AI-powered health diagnosis</p>
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
