import React from "react";
import VideoPlayer from "@/components/watch/VideoPlayer";
import { getMovieById } from "@/data/movies";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";

export default async function WatchPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const movie = getMovieById(id);
  if (!movie) {
    notFound();
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-primary mb-6 border-b-3 border-black pb-2">
          Watch
        </h1>

        <VideoPlayer
          src={movie.videoUrl}
          poster={movie.posterUrl}
        />

        <div className="mt-6 border-3 border-black p-6 bg-back shadow-[6px_6px_0px_0px_black]">
          <div className="flex justify-between items-start">
            <h2 className="text-3xl text-primary font-bold">{movie.name}</h2>
            <div className="flex items-center gap-1 bg-secondary px-3 py-1 border-2 border-black">
              <Star size={16} fill="currentColor" className="text-black" />
              <span className="text-sm font-bold text-black">{movie.imdb}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {movie.categories.map((category, index) => (
              <span
                key={index}
                className="border-2 px-3 py-1 text-xs bg-secondary border-black"
              >
                &bull; {category}
              </span>
            ))}
            <span className="border-2 px-3 py-1 text-xs bg-tertiary text-white border-black">
              {movie.duration}
            </span>
          </div>

          <p className="mt-6 text-base leading-relaxed text-black/80">
            {movie.description}
          </p>
        </div>
      </div>
    </div>
  );
}
