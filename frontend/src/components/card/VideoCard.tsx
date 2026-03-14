import { Bookmark, Clock, User } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Video } from "@/lib/api/video";

interface VideoCardProps {
  video: Video;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "Unknown";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  return (
    <Link href={`/watch/${video.videoId}`}>
      <div className="border-3 hover:-translate-1.5 hover:shadow-[6px_6px_0px_0px_black] hover:cursor-pointer duration-100">
        <div className="relative">
          <div className="absolute top-0 left-0 w-full z-10">
            <div className="w-[90%] mx-auto py-2 flex justify-between">
              <Bookmark className="text-white drop-shadow-lg" />
            </div>
          </div>
          {/* Placeholder for video thumbnail */}
          <div className="w-full h-70 bg-linear-to-br from-primary/20 to-secondary/40 flex items-center justify-center">
            <span className="text-6xl font-bold text-primary/30">
              {(video.title || video.videoId).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="border-dashed border-t-3 border-black/50 p-4">
            <h1 className="text-primary text-2xl">
              {video.title || video.videoId}
            </h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              {video.creator && (
                <span className="border-2 px-2 text-xs bg-secondary flex items-center gap-1">
                  <User size={10} />
                  {video.creator.name}
                </span>
              )}
              <span
                className={`border-2 px-2 text-xs ${
                  video.status === "COMPLETED" || video.status === "READY"
                    ? "bg-green-200"
                    : video.status === "PROCESSING"
                      ? "bg-yellow-200"
                      : "bg-gray-200"
                }`}
              >
                {video.status}
              </span>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <div className="flex items-center gap-1">
                <Clock size={13} />
                <span className="text-xs">
                  {formatDuration(video.duration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;
