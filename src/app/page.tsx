// Phase 1 placeholder. Replaced by the real home page in Phase 4.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="font-serif text-4xl uppercase tracking-display text-navy">
        Bargain Breaks
      </h1>
      <p className="text-muted">Halal accommodation, from the coast to the mountains.</p>
      <div className="flex gap-3" aria-label="Design token preview">
        <span className="rounded-pill bg-sand px-3 py-1 text-sm text-navy">New</span>
        <span className="rounded-pill bg-teal-light px-3 py-1 text-sm text-navy">In progress</span>
        <span className="rounded-pill bg-teal px-3 py-1 text-sm text-white">Actioned</span>
      </div>
    </main>
  );
}
