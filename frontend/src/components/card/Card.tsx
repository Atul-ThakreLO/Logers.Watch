import { Bookmark, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Movie } from "@/data/movies";

interface CardProps {
  movie: Movie;
}

const Card: React.FC<CardProps> = ({ movie }) => {
  return (
    <Link href={`/watch/${movie.id}`}>
      <div className="border-3 hover:-translate-1.5 hover:shadow-[6px_6px_0px_0px_black] hover:cursor-pointer duration-100">
        <div className="relative">
          <div className="absolute top-0 left-0 w-full z-10">
            <div className="w-[90%] mx-auto py-2 flex justify-between">
              <Bookmark className="text-white drop-shadow-lg" />
            </div>
          </div>
          <Image
            className="object-cover object-top w-full h-70"
            src={movie.posterUrl}
            height={200}
            width={200}
            alt={movie.name}
          />
          <div className="border-dashed border-t-3 border-black/50 p-4">
            <h1 className="text-primary text-2xl">{movie.name}</h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              {movie.categories.map((category, index) => (
                <span
                  key={index}
                  className="border-2 px-2 text-xs bg-secondary"
                >
                  &bull; {category}
                </span>
              ))}
            </div>
            <div className="mt-3 flex justify-between items-center">
              <div className="flex items-center gap-1">
                <Star size={13} fill="currentColor" />
                <span className="text-xs">{movie.imdb}</span>
              </div>
              <span className="text-xs">{movie.duration}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default Card;
