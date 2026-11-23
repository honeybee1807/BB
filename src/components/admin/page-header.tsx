export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-serif text-3xl text-navy">{title}</h1>
      {description && <p className="mt-1 text-muted">{description}</p>}
    </header>
  );
}

export function NotBuiltYet() {
  return (
    <div className="rounded-card bg-white p-6 text-muted shadow-sm ring-1 ring-line">
      Not built yet.
    </div>
  );
}
