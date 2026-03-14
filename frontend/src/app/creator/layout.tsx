"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  DollarSign,
  Settings,
  LogOut,
  Home,
  Upload,
  BarChart3,
} from "lucide-react";
import { emitAuthStateChanged } from "@/lib/auth/events";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("creatorAccessToken");
    const userType = localStorage.getItem("userType");

    if (!token || userType !== "creator") {
      router.push("/auth/creator/login");
    } else {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("creatorAccessToken");
    localStorage.removeItem("creatorRefreshToken");
    localStorage.removeItem("userType");
    emitAuthStateChanged();
    router.push("/auth/creator/login");
  };

  const navItems = [
    { href: "/creator/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/creator/videos", label: "My Videos", icon: Video },
    { href: "/creator/upload", label: "Upload", icon: Upload },
    { href: "/creator/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/creator/earnings", label: "Earnings", icon: DollarSign },
    { href: "/creator/settings", label: "Settings", icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 h-[calc(100vh-77px)] sticky top-18 left-0 bg-gray-800 border-r-2 border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b-2 border-gray-700">
          <Link href="/">
            <h1 className="text-2xl font-bold">
              <span className="text-white">Logers.</span>
              <span className="text-secondary">Watch</span>
            </h1>
          </Link>
          <p className="text-xs text-gray-400 mt-1">Creator Studio</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 border-2 transition-all ${
                  isActive
                    ? "bg-secondary text-gray-900 border-black shadow-[4px_4px_0_0_#000]"
                    : "text-gray-300 border-transparent hover:bg-gray-700 hover:text-white hover:border-secondary"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-gray-700 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 text-gray-300 border-2 border-transparent hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all"
          >
            <Home className="h-5 w-5" />
            <span>Back to Home</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 border-2 border-transparent hover:bg-red-900/20 hover:border-red-500 transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
