"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Search, ArrowLeft, Server, Star, Filter,
  ChevronLeft, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchNodes, askAI } from "../lib/api";
import { Node } from "../lib/types";

const ITEMS_PER_PAGE = 20;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSnapshot, setAiSnapshot] = useState<any>(null);
  const [searchInput, setSearchInput] = useState(query);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadNodes() {
      try {
        const data = await fetchNodes();
        setNodes(data.nodes);
      } catch (err) {
        console.error("Failed to load nodes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadNodes();
  }, []);

  // AI summary when query looks like a question
  useEffect(() => {
    const qLower = query.toLowerCase();
    const isQuestion = qLower.includes("how many") || qLower.includes("count") || qLower.includes("number") || qLower.includes("?") || qLower.split(" ").length > 3;
    if (!query || !isQuestion) {
      setAiAnswer(null);
      setAiSnapshot(null);
      setAiLoading(false);
      return;
    }
    let canceled = false;
    setAiLoading(true);
    askAI(query)
      .then((res) => {
        if (canceled) return;
        setAiAnswer(res.answer);
        setAiSnapshot(res.data_snapshot);
      })
      .catch(() => {
        if (!canceled) {
          setAiAnswer("Sorry, I couldn't compute that right now.");
        }
      })
      .finally(() => {
        if (!canceled) setAiLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [query]);

  useEffect(() => {
    setSearchInput(query);
    setCurrentPage(1);
  }, [query]);

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!query) return nodes;
    
    const q = query.toLowerCase();
    return nodes.filter(node => 
      node.ip.toLowerCase().includes(q) ||
      node.address.toLowerCase().includes(q) ||
      node.pubkey?.toLowerCase().includes(q) ||
      node.geo?.country?.toLowerCase().includes(q) ||
      node.geo?.city?.toLowerCase().includes(q)
    ).filter(node => 
      statusFilter === "all" || node.status === statusFilter
    );
  }, [nodes, query, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredNodes.length / ITEMS_PER_PAGE);
  const paginatedNodes = filteredNodes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e85a4f] to-[#c94a40] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">X</span>
          </div>
          <p className="text-gray-500">Searching...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Search Results</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by IP, pubkey, country, or city..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e85a4f]/20 focus:border-[#e85a4f]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#e85a4f] text-white font-medium rounded-lg hover:bg-[#c94a40] transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* AI Summary */}
        {(aiLoading || aiAnswer) && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">AI Summary</span>
              </div>
              {aiSnapshot?.matched_country_count !== undefined && (
                <span className="text-xs text-gray-500">Matched country count: {aiSnapshot.matched_country_count ?? "N/A"}</span>
              )}
            </div>
            {aiLoading ? (
              <p className="text-gray-500 text-sm">Analyzing network data...</p>
            ) : (
              <p className="text-gray-800 whitespace-pre-wrap">{aiAnswer}</p>
            )}
            {aiSnapshot && (
              <div className="mt-3 text-xs text-gray-500 flex gap-3 flex-wrap">
                <span>Total: {aiSnapshot.total_nodes}</span>
                <span>Online: {aiSnapshot.online_nodes}</span>
                <span>Countries: {aiSnapshot.countries_count}</span>
                {aiSnapshot.matched_country && (
                  <span>{aiSnapshot.matched_country}: {aiSnapshot.matched_country_count ?? 0}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500">
            Found <span className="font-semibold text-gray-900">{filteredNodes.length}</span> results
            {query && <span> for "{query}"</span>}
          </p>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e85a4f]/20"
            >
              <option value="all">All Status</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {filteredNodes.length > 0 ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Node</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Health</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Uptime</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedNodes.map((node, index) => (
                    <tr 
                      key={node.ip}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/node/${encodeURIComponent(node.ip)}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            className="text-gray-300 hover:text-[#e85a4f] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Star className="w-4 h-4" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{node.ip}</span>
                              {node.geo?.country && (
                                <span className="text-xs text-gray-400">{node.geo.country}</span>
                              )}
                            </div>
                            {node.pubkey && (
                              <span className="text-xs text-gray-400 font-mono">
                                {node.pubkey.slice(0, 8)}...{node.pubkey.slice(-4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold ${
                          (node.derived?.health_score || 0) >= 80 ? "text-green-600" :
                          (node.derived?.health_score || 0) >= 60 ? "text-yellow-600" :
                          "text-red-600"
                        }`}>
                          {node.derived?.health_score || 0}/100
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${
                          node.status === "Online" ? "text-green-600" :
                          node.status === "Offline" ? "text-red-600" :
                          "text-gray-500"
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            node.status === "Online" ? "bg-green-500" :
                            node.status === "Offline" ? "bg-red-500" :
                            "bg-gray-400"
                          }`} />
                          {node.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-gray-600 font-medium">
                          {node.derived?.uptime_human || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/node/${encodeURIComponent(node.ip)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#e85a4f] border border-[#e85a4f]/30 rounded-lg hover:bg-[#e85a4f]/5 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          currentPage === pageNum
                            ? "bg-[#e85a4f] text-white"
                            : "hover:bg-gray-100 text-gray-600"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Server className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No results found</h2>
            <p className="text-gray-500">
              No nodes match your search for "{query}"
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-[#e85a4f] hover:text-[#c94a40] font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e85a4f] to-[#c94a40] flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-lg">X</span>
          </div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
