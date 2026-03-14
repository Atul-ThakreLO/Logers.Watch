"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { User, CreditCard, Settings, Wallet } from "lucide-react";
import { emitAuthStateChanged } from "@/lib/auth/events";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getTabClassName = (isActive: boolean) =>
    `flex items-center gap-3 px-4 py-3 text-gray-700 border-3 transition-all ${
      isActive
        ? "bg-secondary/80 shadow-[4px_4px_0px_0px_black] cursor-pointer border-black"
        : "hover:bg-secondary/80 hover:shadow-[4px_4px_0px_0px_black] hover:cursor-pointer border-transparent hover:border-black"
    }`;

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const userType = localStorage.getItem("userType");

    if (!token || userType !== "user") {
      router.push("/auth/login");
    } else {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userType");
    emitAuthStateChanged();
    router.push("/auth/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-back flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-back">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="md:col-span-1">
            <nav className="bg-white border-2 border-black p-4 space-y-2">
              <Link
                href="/profile"
                className={getTabClassName(pathname === "/profile")}
              >
                <User className="h-5 w-5" />
                <span>Profile</span>
              </Link>
              <Link
                href="/profile/balance"
                className={getTabClassName(
                  pathname.startsWith("/profile/balance"),
                )}
              >
                <Wallet className="h-5 w-5" />
                <span>Balance</span>
              </Link>
              <Link
                href="/profile/recharge"
                className={getTabClassName(
                  pathname.startsWith("/profile/recharge"),
                )}
              >
                <CreditCard className="h-5 w-5" />
                <span>Recharge</span>
              </Link>
              <Link
                href="/profile/settings"
                className={getTabClassName(
                  pathname.startsWith("/profile/settings"),
                )}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-secondary/80 hover:shadow-[4px_4px_0px_0px_black] hover:cursor-pointer border-3 border-transparent hover:border-red-400 transition-all"
              >
                Logout
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="md:col-span-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
