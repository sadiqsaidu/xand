"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Search, Activity, Map, HelpCircle, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Hide search bar on home page (it has its own hero search)
  const isHomePage = pathname === "/";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const navItems = [
    { href: "/", label: "Explore", icon: Search },
    { href: "/network", label: "Stats", icon: Activity },
    { href: "/nodes", label: "Nodes", icon: Map },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#e85a4f] to-[#c94a40] flex items-center justify-center">
              <span className="text-white font-bold text-sm">X</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 group-hover:text-[#e85a4f] transition-colors">
              Xandeum
            </span>
          </Link>

          {/* Center - Search (hidden on home page and mobile) */}
          {!isHomePage && (
            <form 
              onSubmit={handleSearch}
              className="hidden md:flex items-center flex-1 max-w-lg mx-8"
            >
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes by IP, pubkey, or location..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e85a4f]/20 focus:border-[#e85a4f] placeholder-gray-400"
                />
              </div>
            </form>
          )}

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-[#e85a4f] bg-[#e85a4f]/10"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
