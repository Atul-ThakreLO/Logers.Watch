"use client";

import { useState, useEffect } from "react";
import { creatorService, Video } from "@/lib/api/creator";
import { Creator } from "@/lib/api/auth";
import {
  Loader2,
  TrendingUp,
  Clock,
  Eye,
  DollarSign,
  Calendar,
  BarChart3,
} from "lucide-react";

export default function CreatorAnalyticsPage() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">(
    "30d",
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [creatorRes, videosRes] = await Promise.all([
        creatorService.getProfile(),
        creatorService.getVideos(),
      ]);
      setCreator(creatorRes.creator);
      setVideos(videosRes.videos);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 text-secondary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Mock data for chart visualization
  const mockDailyData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
    watchTime: Math.random() * 1000 + 100,
    earnings: Math.random() * 10 + 1,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Track your channel performance</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                timeRange === range
                  ? "bg-secondary text-gray-900"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {range === "all" ? "All Time" : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Earnings</p>
              <p className="text-2xl font-bold text-white">
                ${creator?.amountEarned?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
            <span className="text-green-400">+12.5%</span>
            <span className="text-gray-500 ml-2">vs last period</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Watch Time</p>
              <p className="text-2xl font-bold text-white">
                {formatWatchTime(creator?.watchTime || 0)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
            <span className="text-green-400">+8.3%</span>
            <span className="text-gray-500 ml-2">vs last period</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Views</p>
              <p className="text-2xl font-bold text-white">
                {Math.floor((creator?.watchTime || 0) / 120)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
            <span className="text-green-400">+15.2%</span>
            <span className="text-gray-500 ml-2">vs last period</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg. Watch Duration</p>
              <p className="text-2xl font-bold text-white">
                {videos.length > 0
                  ? formatWatchTime(
                      (creator?.watchTime || 0) /
                        Math.max(videos.length, 1) /
                        10,
                    )
                  : "0m"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
            <span className="text-green-400">+5.7%</span>
            <span className="text-gray-500 ml-2">vs last period</span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-6">
          Earnings Over Time
        </h3>
        <div className="h-64 flex items-end justify-between gap-1">
          {mockDailyData.slice(-14).map((day, index) => {
            const maxEarnings = Math.max(
              ...mockDailyData.map((d) => d.earnings),
            );
            const height = (day.earnings / maxEarnings) * 100;

            return (
              <div
                key={index}
                className="flex-1 bg-secondary/20 rounded-t-sm hover:bg-secondary/40 transition-colors relative group"
                style={{ height: `${Math.max(height, 5)}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  ${day.earnings.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-4 text-xs text-gray-500">
          <span>14 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Top Performing Videos */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Top Performing Videos
          </h3>
        </div>
        <div className="divide-y divide-gray-700">
          {videos.slice(0, 5).map((video, index) => (
            <div key={video.id} className="p-6 flex items-center gap-4">
              <span className="text-2xl font-bold text-gray-600 w-8">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-white">{video.videoId}</p>
                <p className="text-sm text-gray-400 flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {Math.floor(Math.random() * 1000 + 100)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor(Math.random() * 60 + 10)}m watched
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-400">
                  ${(Math.random() * 50 + 5).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">earnings</p>
              </div>
            </div>
          ))}
          {videos.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No videos uploaded yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
