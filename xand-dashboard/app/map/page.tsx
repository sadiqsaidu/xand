"use client";

import { useEffect, useState } from "react";
import { Globe2, MapPin, Server, Activity } from "lucide-react";
import { fetchStats } from "../lib/api";
import { NetworkStats } from "../lib/types";
import { LoadingSpinner } from "../components/ui";

export default function MapPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Loading Map Data..." />
      </div>
    );
  }

  const countries = stats?.countries 
    ? Object.entries(stats.countries).sort(([, a], [, b]) => b - a)
    : [];

  const totalNodes = stats?.network.total_nodes || 0;

  return (
    <div className="p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-mono font-bold text-foreground">World Map</h1>
        <p className="text-gray-400 font-mono mt-1">
          Geographic distribution of {totalNodes} nodes across {countries.length} countries
        </p>
      </div>

      {/* Map Placeholder */}
      <div className="bg-gradient-to-br from-navy-900 to-orb-purple/20 rounded-2xl p-8 text-white relative overflow-hidden min-h-[400px] flex items-center justify-center border border-card-border">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 border border-white rounded-full" />
          <div className="absolute top-20 right-20 w-48 h-48 border border-white rounded-full" />
          <div className="absolute bottom-10 left-1/4 w-24 h-24 border border-white rounded-full" />
          <div className="absolute bottom-20 right-1/3 w-40 h-40 border border-white rounded-full" />
        </div>
        
        {/* Placeholder Content */}
        <div className="text-center z-10">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Globe2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Interactive Map Coming Soon</h2>
          <p className="text-gray-300 font-mono max-w-md">
            A beautiful interactive world map showing the global distribution of Xandeum pNodes 
            will be available here. View node clusters, performance by region, and more.
          </p>
        </div>
      </div>

      {/* Country List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Countries */}
        <div className="bg-card-bg p-6 rounded-xl border border-card-border shadow-sm">
          <h3 className="text-lg font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orb-teal" />
            Node Distribution by Country
          </h3>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {countries.map(([country, count], i) => {
              const percentage = totalNodes > 0 ? (count / totalNodes) * 100 : 0;
              
              return (
                <div key={country} className="flex items-center gap-4">
                  <span className="text-gray-500 font-mono text-sm w-6">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-medium text-foreground">{country}</span>
                      <span className="text-gray-400 font-mono text-sm">{count} nodes</span>
                    </div>
                    <div className="w-full bg-navy-900 rounded-full h-2">
                      <div 
                        className="bg-orb-teal h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-gray-400 font-mono text-sm w-12 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          <div className="bg-card-bg p-6 rounded-xl border border-card-border shadow-sm">
            <h3 className="text-lg font-mono font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orb-teal" />
              Geographic Stats
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-navy-900 p-4 rounded-lg border border-card-border">
                <p className="text-xs font-mono text-gray-400 mb-1">Total Countries</p>
                <p className="text-3xl font-mono font-bold text-foreground">{countries.length}</p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-card-border">
                <p className="text-xs font-mono text-gray-400 mb-1">Largest Region</p>
                <p className="text-xl font-mono font-bold text-foreground truncate">
                  {countries[0]?.[0] || "N/A"}
                </p>
                <p className="text-xs font-mono text-gray-500">
                  {countries[0]?.[1] || 0} nodes
                </p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-card-border">
                <p className="text-xs font-mono text-gray-400 mb-1">Average per Country</p>
                <p className="text-3xl font-mono font-bold text-foreground">
                  {countries.length > 0 ? Math.round(totalNodes / countries.length) : 0}
                </p>
              </div>
              <div className="bg-navy-900 p-4 rounded-lg border border-card-border">
                <p className="text-xs font-mono text-gray-400 mb-1">Top 5 Share</p>
                <p className="text-3xl font-mono font-bold text-foreground">
                  {totalNodes > 0 
                    ? Math.round((countries.slice(0, 5).reduce((acc, [, c]) => acc + c, 0) / totalNodes) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Top 5 Card */}
          <div className="bg-orb-purple text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-mono font-semibold mb-4">Top 5 Countries</h3>
            <div className="space-y-3">
              {countries.slice(0, 5).map(([country, count], i) => (
                <div key={country} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-mono font-bold">
                      {i + 1}
                    </span>
                    <span className="font-mono font-medium">{country}</span>
                  </div>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-mono">
                    {count} nodes
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
