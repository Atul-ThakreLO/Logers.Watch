"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creatorService } from "@/lib/api/creator";
import {
  Loader2,
  Upload,
  Video as VideoIcon,
  Link as LinkIcon,
  AlertCircle,
  Check,
  Info,
} from "lucide-react";

export default function UploadVideoPage() {
  const router = useRouter();
  const [videoId, setVideoId] = useState("");
  const [mpdFileUrl, setMpdFileUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!videoId.trim()) {
      setError("Video ID is required");
      return;
    }

    if (!mpdFileUrl.trim()) {
      setError("MPD File URL is required");
      return;
    }

    // Basic URL validation
    try {
      new URL(mpdFileUrl);
    } catch {
      // Allow relative URLs
      if (!mpdFileUrl.startsWith("/")) {
        setError("Please enter a valid URL for the MPD file");
        return;
      }
    }

    setIsUploading(true);

    try {
      await creatorService.createVideo({
        videoId: videoId.trim(),
        mpdFileUrl: mpdFileUrl.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        router.push("/creator/videos");
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to publish video");
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 p-12 text-center border-2 border-gray-600">
          <div className="w-20 h-20 bg-green-500/20 border-2 border-green-400 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Video Published!
          </h2>
          <p className="text-gray-400 mb-4">
            Your video has been successfully added to the platform.
          </p>
          <p className="text-sm text-gray-500">Redirecting to videos page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Publish New Video</h1>
        <p className="text-gray-400 mt-1">Add a new video to your channel</p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border-2 border-blue-500 p-6 flex gap-4">
        <Info className="h-6 w-6 text-blue-400 shrink-0" />
        <div>
          <h3 className="font-semibold text-blue-400 mb-1">How it works</h3>
          <p className="text-blue-300/80 text-sm">
            Your video needs to be hosted externally and converted to DASH
            format (MPD). Provide the video ID and the URL to your MPD manifest
            file.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-800 p-8 border-2 border-gray-600 hover:shadow-[4px_4px_0_0_#facc15] transition-shadow">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border-2 border-red-500 text-red-400 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="videoId"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Video ID
            </label>
            <div className="relative">
              <VideoIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                id="videoId"
                type="text"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="e.g., my-awesome-video"
                className="w-full pl-12 pr-4 py-3 bg-gray-700 border-2 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              A unique identifier for your video (letters, numbers, hyphens)
            </p>
          </div>

          <div>
            <label
              htmlFor="mpdUrl"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              MPD File URL
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                id="mpdUrl"
                type="text"
                value={mpdFileUrl}
                onChange={(e) => setMpdFileUrl(e.target.value)}
                placeholder="https://cdn.example.com/videos/manifest.mpd"
                className="w-full pl-12 pr-4 py-3 bg-gray-700 border-2 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              The URL to your DASH manifest file (.mpd)
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isUploading}
              className="w-full bg-secondary text-gray-900 py-4 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Publish Video
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Help Section */}
      <div className="bg-gray-800 p-6 border-2 border-gray-600">
        <h3 className="font-semibold text-white mb-4">
          Need help with DASH encoding?
        </h3>
        <div className="space-y-3 text-sm text-gray-400">
          <p>Use FFmpeg to convert your video to DASH format:</p>
          <pre className="bg-gray-900 p-4 border-2 border-gray-700 overflow-x-auto text-green-400">
            {`ffmpeg -i input.mp4 \\
  -c:v libx264 -c:a aac \\
  -f dash manifest.mpd`}
          </pre>
          <p className="mt-4">
            Then upload the generated .mpd file and video segments to your CDN
            or storage service.
          </p>
        </div>
      </div>
    </div>
  );
}
