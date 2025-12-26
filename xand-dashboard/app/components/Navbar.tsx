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
            <div className="w-8 h-8 bg-[#e85a4f] flex items-center justify-center">
              <span className="text-white font-mono font-bold text-lg">X</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-[#e85a4f] transition-colors font-mono">
              orb<span className="text-[#e85a4f]">beta</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-6 ml-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-mono transition-colors ${
                    isActive
                      ? "text-[#e85a4f]"
                      : "text-gray-500 hover:text-gray-900"
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
