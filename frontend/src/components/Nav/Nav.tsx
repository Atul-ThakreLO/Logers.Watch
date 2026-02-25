"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CustomConnectButton } from "./ConnectButton.custom";
import { User, Video, LogOut, ChevronDown, Wallet } from "lucide-react";

const Nav = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<"user" | "creator" | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkAuth();
    // Listen for storage changes (login/logout in other tabs)
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const checkAuth = () => {
    const accessToken = localStorage.getItem("accessToken");
    const creatorToken = localStorage.getItem("creatorAccessToken");
    const type = localStorage.getItem("userType") as "user" | "creator" | null;

    if (accessToken || creatorToken) {
      setIsAuthenticated(true);
      setUserType(type);
    } else {
      setIsAuthenticated(false);
      setUserType(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("creatorAccessToken");
    localStorage.removeItem("creatorRefreshToken");
    localStorage.removeItem("userType");
    setIsAuthenticated(false);
    setUserType(null);
    setShowDropdown(false);
    window.location.href = "/";
  };

  return (
    <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
      <div className="flex justify-between items-center py-3 w-[90%] mx-auto">
        <Link href="/">
          <h1 className="text-3xl font-bold">
            <span className="text-gray-900">Logers.</span>
            <span className="text-primary">Watch</span>
          </h1>
        </Link>

        <div className="flex items-center gap-4">
          <CustomConnectButton />

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {userType === "creator" ? (
                  <Video className="w-5 h-5 text-secondary" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
                <span className="text-gray-700 font-medium">
                  {userType === "creator" ? "Creator" : "Account"}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {userType === "creator" ? (
                    <>
                      <Link
                        href="/creator/dashboard"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Video className="w-4 h-4" />
                        Dashboard
                      </Link>
                      <Link
                        href="/creator/earnings"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Wallet className="w-4 h-4" />
                        Earnings
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <User className="w-4 h-4" />
                        Profile
                      </Link>
                      <Link
                        href="/profile/balance"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Wallet className="w-4 h-4" />
                        Balance
                      </Link>
                    </>
                  )}
                  <hr className="border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Nav;
