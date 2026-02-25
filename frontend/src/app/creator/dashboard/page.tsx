"use client";

import { useState, useEffect } from "react";
import { creatorService, Video } from "@/lib/api/creator";
import { Creator } from "@/lib/api/auth";
import Link from "next/link";
import {
  Loader2,
  Video as VideoIcon,
  DollarSign,
  Clock,
  TrendingUp,
  Plus,
  Eye,
  Calendar,
} from "lucide-react";

export default function CreatorDashboardPage() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      setError(err.response?.data?.error || "Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
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
      <div className="bg-gray-800 rounded-xl p-8 text-center">
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

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {creator?.name}!
          </h1>
          <p className="text-gray-400 mt-1">
            {creator?.company || "Independent Creator"}
          </p>
        </div>
        <Link
          href="/creator/upload"
          className="flex items-center gap-2 bg-secondary text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-secondary/90 transition-all"
        >
          <Plus className="h-5 w-5" />
          Upload Video
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Earnings</p>
              <p className="text-2xl font-bold text-white">
                ${creator?.amountEarned?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Watch Time</p>
              <p className="text-2xl font-bold text-white">
                {formatWatchTime(creator?.watchTime || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <VideoIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Videos</p>
              <p className="text-2xl font-bold text-white">{videos.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg. per Video</p>
              <p className="text-2xl font-bold text-white">
                $
                {videos.length > 0
                  ? ((creator?.amountEarned || 0) / videos.length).toFixed(2)
                  : "0.00"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Recent Videos</h2>
          <Link
            href="/creator/videos"
            className="text-secondary hover:underline text-sm"
          >
            View All
          </Link>
        </div>

        {videos.length === 0 ? (
          <div className="p-12 text-center">
            <VideoIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              No videos yet
            </h3>
            <p className="text-gray-500 mb-6">
              Upload your first video to start earning
            </p>
            <Link
              href="/creator/upload"
              className="inline-flex items-center gap-2 bg-secondary text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-secondary/90 transition-all"
            >
              <Plus className="h-5 w-5" />
              Upload Video
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {videos.slice(0, 5).map((video) => (
              <div
                key={video.id}
                className="p-6 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                    <VideoIcon className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{video.videoId}</p>
                    <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <Link
                    href={`/watch/${video.videoId}`}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <Eye className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/creator/upload"
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-secondary transition-colors group"
        >
          <div className="w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-secondary/30 transition-colors">
            <Plus className="w-6 h-6 text-secondary" />
          </div>
          <h3 className="font-semibold text-white mb-1">Upload New Video</h3>
          <p className="text-sm text-gray-400">
            Add new content to your channel
          </p>
        </Link>

        <Link
          href="/creator/analytics"
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-400 transition-colors group"
        >
          <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
            <TrendingUp className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">View Analytics</h3>
          <p className="text-sm text-gray-400">
            Track your performance metrics
          </p>
        </Link>

        <Link
          href="/creator/settings"
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-400 transition-colors group"
        >
          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
            <DollarSign className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">Payment Settings</h3>
          <p className="text-sm text-gray-400">Configure your payout address</p>
        </Link>
      </div>
    </div>
  );
}
