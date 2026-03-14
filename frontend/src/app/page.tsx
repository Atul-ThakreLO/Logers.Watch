"use client";

import { useState, useEffect } from "react";
import VideoCard from "@/components/card/VideoCard";
import { videoService, Video } from "@/lib/api/video";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const { videos } = await videoService.getAll();
      setVideos(videos);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load videos";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="max-w-350 mx-auto text-center py-20">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <main>
        {videos.length === 0 ? (
          <div className="max-w-350 mx-auto text-center py-20">
            <h2 className="text-2xl font-bold text-primary mb-4">
              No Videos Available
            </h2>
            <p className="text-gray-600">
              Upload videos as a creator to see them here.
            </p>
          </div>
        ) : (
          <section className="max-w-350 mx-auto grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] items-center justify-center gap-4 w-full">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
