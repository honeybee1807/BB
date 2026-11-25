import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site-theme mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <p className="text-xs tracking-wide-plus text-muted uppercase">Page not found</p>
      <h1 className="font-serif text-4xl text-navy">We couldn&apos;t find that page</h1>
      <p className="text-muted">It may have moved, or the link may be out of date.</p>
      <Link
        href="/"
        className="mt-3 bg-navy px-8 py-4 text-xs font-bold tracking-[0.16em] text-white uppercase hover:bg-navy-hover"
      >
        Back to the home page
      </Link>
    </main>
  );
}
