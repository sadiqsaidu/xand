"use client";

import Link from "next/link";
import Image from "next/image";
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8">
              <Image 
                src="/logo.png" 
                alt="Xandeum" 
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground group-hover:text-orb-teal transition-colors font-mono">
              xandeum <span className="text-orb-teal">orb</span>
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-8 ml-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-mono transition-colors ${
                    isActive
                      ? "text-orb-teal"
                      : "text-gray-400 hover:text-foreground"
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
