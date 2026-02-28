"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isCreatorPath = pathname?.includes("/creator");

  return (
    <div className="min-h-screen bg-back flex flex-col pt-10">
      <div className="flex justify-center gap-4 mb-8">
        <Link
          href="/auth/login"
          className={`px-6 py-2 hover:shadow-[4px_4px_0px_0px_black] hover:cursor-pointer border-black border-3 transition-all ${
            !isCreatorPath
              ? "bg-primary text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          User
        </Link>
        <Link
          href="/auth/creator/login"
          className={`px-6 py-2 hover:shadow-[4px_4px_0px_0px_black] hover:cursor-pointer border-black border-3 transition-all ${
            isCreatorPath
              ? "bg-secondary text-gray-900"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Creator
        </Link>
      </div>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="py-4 text-center text-gray-600 text-sm">
        <p>
          &copy; {new Date().getFullYear()} Logers.Watch. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
