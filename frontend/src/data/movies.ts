/**
 * Interface defining the structure of a Movie object
 */
export interface Movie {
  id: string;
  name: string;
  description: string;
  imdb: number;
  categories: string[];
  duration: string;
  videoUrl: string;
  posterUrl: string;
}

/**
 * Dummy Movie Dataset
 */
export const MOVIES_DATA: Movie[] = [
  {
    id: "m7",
    name: "Animal 2023 (DASH)",
    description:
      "Animal DASH version - A violent, polarizing drama about a man's obsessive quest for revenge after his father is targeted, with adaptive streaming quality.",
    imdb: 6.2,
    categories: ["Action", "Thriller", "Adventure"],
    duration: "3h 24m",
    videoUrl: "/updated_manifest.mpd",
    posterUrl: "/thumbnail/animal.png",
  },
  {
    id: "m6",
    name: "Animal 2023",
    description:
      "Animal is a violent, polarizing drama about a man's obsessive quest for revenge after his father is targeted, driven by deep-seated daddy issues and a descent into primal rage.",
    imdb: 6.2,
    categories: ["Action", "Thriller", "Adventure"],
    duration: "3h 24m",
    videoUrl: "/movies/animal.mp4",
    posterUrl: "/thumbnail/animal.png",
  },
  {
    id: "m1",
    name: "The Rip",
    description:
      "A high-stakes thriller set in the near future where a deep-sea salvage crew discovers a lost tech-utopia hidden in a massive oceanic rift.",
    imdb: 8.2,
    categories: ["Sci-Fi", "Thriller", "Adventure"],
    duration: "2h 15m",
    videoUrl: "/movies/therip.mp4",
    posterUrl: "/thumbnail/therip.png",
  },
  {
    id: "m2",
    name: "Tere IM",
    description:
      "An emotionally charged romantic drama exploring the intersections of tradition and modern ambition in a bustling metropolis.",
    imdb: 7.9,
    categories: ["Romance", "Drama"],
    duration: "2h 40m",
    videoUrl: "/movies/tereishqme.mp4",
    posterUrl: "/thumbnail/tere.png",
  },
  {
    id: "m3",
    name: "Finding Her Edge",
    description:
      "A gritty sports documentary following the comeback story of a world-class athlete who loses everything and fights to regain her title.",
    imdb: 8.5,
    categories: ["Documentary", "Sport"],
    duration: "1h 52m",
    videoUrl: "/movies/findingher.mp4",
    posterUrl: "/thumbnail/findingher.png",
  },
  {
    id: "m4",
    name: "The Big Fake",
    description:
      "A satirical comedy about a small-town theater troupe that accidentally gets hired to perform a heist for a billionaire.",
    imdb: 7.1,
    categories: ["Comedy", "Crime"],
    duration: "1h 38m",
    videoUrl: "/movies/thebigfake.mp4",
    posterUrl: "/thumbnail/thebigfake.png",
  },
  {
    id: "m5",
    name: "Neon Shadows",
    description:
      "In a neon-drenched cyberpunk city, a rogue detective investigates a series of digital disappearances that lead back to a powerful AI.",
    imdb: 7.6,
    categories: ["Sci-Fi", "Mystery", "Action"],
    duration: "2h 05m",
    videoUrl: "/movies/neonshadow.mp4",
    posterUrl: "/thumbnail/neonshadow.png",
  },
];

/**
 * Get a movie by its ID
 */
export function getMovieById(id: string): Movie | undefined {
  return MOVIES_DATA.find((movie) => movie.id == id);
}
