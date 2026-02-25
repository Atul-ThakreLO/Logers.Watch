"use client";

import { useState, useEffect } from "react";
import { creatorService, Video } from "@/lib/api/creator";
import Link from "next/link";
import {
  Loader2,
  Video as VideoIcon,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  ExternalLink,
} from "lucide-react";

export default function CreatorVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    const filtered = videos.filter((video) =>
      video.videoId.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredVideos(filtered);
  }, [searchQuery, videos]);

  const fetchVideos = async () => {
    try {
      const { videos } = await creatorService.getVideos();
      setVideos(videos);
      setFilteredVideos(videos);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load videos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;

    setIsDeleting(true);
    try {
      await creatorService.deleteVideo(deleteModal.id);
      setVideos(videos.filter((v) => v.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete video");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">My Videos</h1>
          <p className="text-gray-400 mt-1">{videos.length} videos uploaded</p>
        </div>
        <Link
          href="/creator/upload"
          className="flex items-center gap-2 bg-secondary text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-secondary/90 transition-all"
        >
          <Plus className="h-5 w-5" />
          Upload Video
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search videos..."
          className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-secondary focus:border-transparent"
        />
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
          <VideoIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {searchQuery ? "No videos found" : "No videos yet"}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery
              ? "Try a different search term"
              : "Upload your first video to start earning"}
          </p>
          {!searchQuery && (
            <Link
              href="/creator/upload"
              className="inline-flex items-center gap-2 bg-secondary text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-secondary/90 transition-all"
            >
              <Plus className="h-5 w-5" />
              Upload Video
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-700 flex items-center justify-center relative">
                <VideoIcon className="w-12 h-12 text-gray-500" />
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Link
                    href={`/watch/${video.videoId}`}
                    className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <Eye className="w-5 h-5 text-white" />
                  </Link>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {video.videoId}
                    </h3>
                    <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveMenu(activeMenu === video.id ? null : video.id)
                      }
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenu === video.id && (
                      <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg overflow-hidden shadow-lg z-10 min-w-[150px]">
                        <Link
                          href={`/watch/${video.videoId}`}
                          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View
                        </Link>
                        <button
                          onClick={() => {
                            setActiveMenu(null);
                            setDeleteModal(video);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500 truncate">
                    MPD: {video.mpdFileUrl}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-2">
              Delete Video?
            </h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete &quot;{deleteModal.videoId}&quot;?
              This action cannot be undone.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
