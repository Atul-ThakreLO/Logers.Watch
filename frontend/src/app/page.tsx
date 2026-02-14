import Card from "@/components/card/Card";
import { MOVIES_DATA } from "@/data/movies";

export default function Home() {
  return (
    <div className="p-4">
      <main>
        <section className="max-w-350 mx-auto grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] items-center justify-center gap-4 w-full">
          {MOVIES_DATA.map((movie) => (
            <Card key={movie.id} movie={movie} />
          ))}
        </section>
      </main>
    </div>
  );
}
