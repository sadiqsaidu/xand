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

const getFlagEmoji = (countryName: string) => {
  const countryCodeMap: { [key: string]: string } = {
    'United States': '🇺🇸',
    'Germany': '🇩🇪',
    'Finland': '🇫🇮',
    'Singapore': '🇸🇬',
    'United Kingdom': '🇬🇧',
    'Japan': '🇯🇵',
    'Netherlands': '🇳🇱',
    'Canada': '🇨🇦',
    'France': '🇫🇷',
    'Australia': '🇦🇺',
    'Ireland': '🇮🇪',
    'Poland': '🇵🇱',
    'Sweden': '🇸🇪',
    'South Korea': '🇰🇷',
    'Brazil': '🇧🇷',
    'India': '🇮🇳',
    'China': '🇨🇳',
    'Russia': '🇷🇺',
    'Ukraine': '🇺🇦',
    'Italy': '🇮🇹',
    'Spain': '🇪🇸',
    'Switzerland': '🇨🇭',
    'Norway': '🇳🇴',
    'Denmark': '🇩🇰',
    'Belgium': '🇧🇪',
    'Austria': '🇦🇹',
    'Portugal': '🇵🇹',
    'Greece': '🇬🇷',
    'Turkey': '🇹🇷',
    'Israel': '🇮🇱',
    'South Africa': '🇿🇦',
    'New Zealand': '🇳🇿',
    'Mexico': '🇲🇽',
    'Argentina': '🇦🇷',
    'Chile': '🇨🇱',
    'Colombia': '🇨🇴',
    'Peru': '🇵🇪',
    'Venezuela': '🇻🇪',
    'Egypt': '🇪🇬',
    'Nigeria': '🇳🇬',
    'Kenya': '🇰🇪',
    'Morocco': '🇲🇦',
    'Tunisia': '🇹🇳',
    'Saudi Arabia': '🇸🇦',
    'UAE': '🇦🇪',
    'Qatar': '🇶🇦',
    'Kuwait': '🇰🇼',
    'Bahrain': '🇧🇭',
    'Oman': '🇴🇲',
    'Jordan': '🇯🇴',
    'Lebanon': '🇱🇧',
    'Iraq': '🇮🇶',
    'Iran': '🇮🇷',
    'Pakistan': '🇵🇰',
    'Bangladesh': '🇧🇩',
    'Vietnam': '🇻🇳',
    'Thailand': '🇹🇭',
    'Indonesia': '🇮🇩',
    'Malaysia': '🇲🇾',
    'Philippines': '🇵🇭',
    'Taiwan': '🇹🇼',
    'Hong Kong': '🇭🇰',
  };
  return countryCodeMap[countryName] || '🏳️';
};

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
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-orb-teal flex items-center justify-center animate-pulse">
            <span className="text-white font-mono font-bold text-lg">X</span>
          </div>
          <p className="text-gray-400 font-mono text-sm">Searching...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-orb-teal mb-6 font-mono text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explorer
        </Link>

        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-mono font-bold text-foreground mb-4">Search Results</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by IP, pubkey, country, or city..."
                className="w-full pl-12 pr-4 py-3 bg-background border border-card-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal placeholder-gray-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-orb-teal text-white font-mono font-medium rounded-lg hover:bg-orb-teal/90 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* AI Summary */}
        {(aiLoading || aiAnswer) && (
          <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-4">
            {aiLoading ? (
              <p className="text-gray-400 text-sm font-mono">Analyzing network data...</p>
            ) : (
              <p className="text-gray-300 whitespace-pre-wrap font-mono text-sm">{aiAnswer}</p>
            )}
            {aiSnapshot && (
              <div className="mt-3 text-xs text-gray-500 font-mono flex gap-3 flex-wrap">
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
          <p className="text-gray-400 font-mono text-sm">
            Found <span className="font-semibold text-foreground">{filteredNodes.length}</span> results
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
              className="px-3 py-2 bg-card-bg border border-card-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-orb-teal focus:border-orb-teal"
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
            <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card-border bg-navy-900/50">
                    <th className="text-left px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-wider">Node</th>
                    <th className="text-right px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-wider">Health</th>
                    <th className="text-right px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-wider">Uptime</th>
                    <th className="text-right px-6 py-3 text-xs font-mono text-gray-400 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedNodes.map((node, index) => (
                    <tr 
                      key={node.ip}
                      className="border-b border-card-border hover:bg-card-border/10 transition-colors cursor-pointer"
                      onClick={() => router.push(`/node/${encodeURIComponent(node.ip)}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            className="text-gray-600 hover:text-orb-orange transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Star className="w-4 h-4" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-foreground">{node.ip}</span>
                              {node.geo?.country && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  {getFlagEmoji(node.geo.country)} {node.geo.country}
                                </span>
                              )}
                            </div>
                            {node.pubkey && (
                              <span className="text-xs text-gray-500 font-mono block mt-0.5">
                                {node.pubkey.slice(0, 8)}...{node.pubkey.slice(-4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-mono font-medium ${
                          (node.derived?.health_score || 0) >= 80 ? "text-orb-teal" :
                          (node.derived?.health_score || 0) >= 60 ? "text-orb-orange" :
                          "text-red-500"
                        }`}>
                          {node.derived?.health_score || 0}/100
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-mono ${
                          node.status === "Online" ? "text-orb-teal" :
                          node.status === "Offline" ? "text-red-500" :
                          "text-gray-500"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            node.status === "Online" ? "bg-orb-teal" :
                            node.status === "Offline" ? "bg-red-500" :
                            "bg-gray-400"
                          }`} />
                          {node.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-gray-400 font-mono text-sm">
                          {node.derived?.uptime_human || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/node/${encodeURIComponent(node.ip)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-medium text-orb-teal border border-orb-teal/30 rounded hover:bg-orb-teal/10 transition-colors"
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
                  className="p-2 rounded-lg border border-card-border text-gray-400 hover:bg-card-border/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className={`w-10 h-10 rounded-lg font-mono font-medium transition-colors ${
                          currentPage === pageNum
                            ? "bg-orb-teal text-white"
                            : "hover:bg-card-border/30 text-gray-400"
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
                  className="p-2 rounded-lg border border-card-border text-gray-400 hover:bg-card-border/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Server className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-mono font-semibold text-foreground mb-2">No results found</h2>
            <p className="text-gray-400 font-mono">
              No nodes match your search for "{query}"
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-orb-teal hover:text-orb-teal/80 font-mono font-medium transition-colors"
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
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-orb-teal flex items-center justify-center animate-pulse">
            <span className="text-white font-mono font-bold text-lg">X</span>
          </div>
          <p className="text-gray-400 font-mono text-sm">Loading...</p>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
