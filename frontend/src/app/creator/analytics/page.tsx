"use client";

import { useState, useEffect } from "react";
import { creatorService, Video } from "@/lib/api/creator";
import { Creator } from "@/lib/api/auth";
import {
  Loader2,
  Clock,
  DollarSign,
  BarChart3,
  Video as VideoIcon,
} from "lucide-react";

export default function CreatorAnalyticsPage() {
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
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-8 text-center border-2 border-gray-600">
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

  const readyVideos = videos.filter((video) => video.status === "READY");
  const avgDurationSeconds =
    readyVideos.length > 0
      ? Math.round(
          readyVideos.reduce((sum, video) => sum + (video.duration || 0), 0) /
            readyVideos.length,
        )
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">
            Performance based on your live creator data
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-green-400 hover:shadow-[4px_4px_0_0_#4ade80] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/20 border-2 border-green-400 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Earnings</p>
              <p className="text-2xl font-bold text-white">
                ${creator?.amountEarned?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">All time earnings</p>
        </div>

        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-blue-400 hover:shadow-[4px_4px_0_0_#60a5fa] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Watch Time</p>
              <p className="text-2xl font-bold text-white">
                {formatWatchTime(creator?.watchTime || 0)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">All time watch time</p>
        </div>

        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-purple-400 hover:shadow-[4px_4px_0_0_#c084fc] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 border-2 border-purple-400 flex items-center justify-center">
              <VideoIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Uploaded Videos</p>
              <p className="text-2xl font-bold text-white">{videos.length}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Total uploads</p>
        </div>

        <div className="bg-gray-800 p-6 border-2 border-gray-600 hover:border-secondary hover:shadow-[4px_4px_0_0_#facc15] transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg. Watch Duration</p>
              <p className="text-2xl font-bold text-white">
                {avgDurationSeconds > 0
                  ? formatWatchTime(avgDurationSeconds)
                  : "0m"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Average of processed videos
          </p>
        </div>
      </div>

      {/* Video Performance */}
      <div className="bg-gray-800 border-2 border-gray-600">
        <div className="p-6 border-b-2 border-gray-600">
          <h3 className="text-lg font-semibold text-white">
            Video Performance (Real Data)
          </h3>
        </div>
        <div className="divide-y-2 divide-gray-700">
          {videos.slice(0, 8).map((video) => (
            <div
              key={video.id}
              className="p-6 flex items-center gap-4 hover:bg-gray-750 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                <VideoIcon className="w-5 h-5 text-gray-300" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">
                  {video.title || video.videoId}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Uploaded: {new Date(video.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white capitalize">
                  {video.status?.toLowerCase() || "unknown"}
                </p>
                <p className="text-xs text-gray-500">
                  {video.duration
                    ? formatWatchTime(video.duration)
                    : "Duration N/A"}
                </p>
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

      <div className="bg-gray-800 p-6 border-2 border-gray-600">
        <h3 className="text-lg font-semibold text-white mb-4">
          Processing Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border-2 border-gray-700 bg-gray-900">
            <p className="text-sm text-gray-400">Ready Videos</p>
            <p className="text-2xl font-bold text-white">
              {readyVideos.length}
            </p>
          </div>
          <div className="p-4 border-2 border-gray-700 bg-gray-900">
            <p className="text-sm text-gray-400">Processing</p>
            <p className="text-2xl font-bold text-white">
              {videos.filter((video) => video.status === "PROCESSING").length}
            </p>
          </div>
          <div className="p-4 border-2 border-gray-700 bg-gray-900">
            <p className="text-sm text-gray-400">Failed</p>
            <p className="text-2xl font-bold text-white">
              {videos.filter((video) => video.status === "FAILED").length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
