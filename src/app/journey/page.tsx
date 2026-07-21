import { loadTracks, loadModules, loadExercises } from "@/lib/content/loader";

export default function JourneyPage() {
  const tracks = loadTracks();
  const modules = loadModules();
  const exercises = loadExercises();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-[var(--sails-navy)]">Journey</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Phase 0 proof: content files loaded from <code>/content</code>, validated, and rendered here.
      </p>

      {tracks.map(({ data: track }) => (
        <section key={track.slug} className="mt-8">
          <h2 className="text-lg font-medium text-[var(--sails-navy)]">{track.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{track.description}</p>

          {modules
            .filter((m) => m.data.tracks.includes(track.slug))
            .sort((a, b) => a.data.order - b.data.order)
            .map(({ data: mod }) => (
              <div key={mod.slug} className="mt-4 rounded-lg border border-neutral-200 p-4">
                <h3 className="font-medium">{mod.title}</h3>
                <ul className="mt-2 space-y-2">
                  {exercises
                    .filter((e) => e.data.module === mod.slug)
                    .map(({ data: ex }) => (
                      <li key={ex.slug} className="flex items-center justify-between text-sm">
                        <span>{ex.title}</span>
                        <span className="text-neutral-400">{ex.time_estimate}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
        </section>
      ))}
    </main>
  );
}
