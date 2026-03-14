"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import VideoPlayer from "@/components/watch/VideoPlayer";
import { videoService, Video } from "@/lib/api/video";
import { Loader2, Clock } from "lucide-react";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "Unknown";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (videoId) {
      fetchVideo();
    }
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      const { video } = await videoService.getByVideoId(videoId);
      setVideo(video);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Video not found";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-5xl mx-auto text-center py-20">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Video Not Found
          </h2>
          <p className="text-gray-600">
            {error || "The video does not exist."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-primary text-white border-2 border-black"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-primary mb-6 border-b-3 border-black pb-2">
          Watch
        </h1>

        <VideoPlayer videoId={videoId} />

        <div className="mt-6 border-3 border-black p-6 bg-back shadow-[6px_6px_0px_0px_black]">
          <div className="flex justify-between items-start">
            <h2 className="text-3xl text-primary font-bold">
              {video.title || video.videoId}
            </h2>
            <div className="flex items-center gap-1 bg-secondary px-3 py-1 border-2 border-black">
              <Clock size={16} className="text-black" />
              <span className="text-sm font-bold text-black">
                {formatDuration(video.duration)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {video.creator && (
              <span className="border-2 px-3 py-1 text-xs bg-secondary border-black">
                By {video.creator.name}
              </span>
            )}
            <span className="border-2 px-3 py-1 text-xs bg-tertiary text-white border-black">
              {video.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
