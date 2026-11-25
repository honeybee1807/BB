import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/site/section-heading";
import { listPosts } from "@/lib/data/public";
import { formatLongDate } from "@/lib/format";
import { staticPageMetadata } from "@/lib/seo";
import { publicImageUrl } from "@/lib/storage";

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata("/journal");
}

export default async function JournalPage() {
  const posts = await listPosts();
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8 lg:py-20">
      <SectionHeading level={1} title="Journal" />
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
        Travel ideas, local tips and guides to halal-friendly holidays in South Africa.
      </p>
      {posts.length > 0 ? (
        <ul className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/journal/${post.slug}`} className="group block">
                <div className="relative aspect-[8/5] overflow-hidden bg-mist">
                  {post.featured_image_path ? (
                    <Image
                      src={publicImageUrl("blog-images", post.featured_image_path)}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div aria-hidden className="absolute inset-0 bg-linear-to-br from-navy/15 via-mist to-sand/60" />
                  )}
                </div>
                {post.published_at && (
                  <p className="mt-5 text-xs tracking-[0.12em] text-muted uppercase">
                    <time dateTime={post.published_at}>{formatLongDate(post.published_at)}</time>
                  </p>
                )}
                <h2 className="mt-2 font-serif text-[22px] leading-snug text-navy group-hover:underline group-hover:underline-offset-4">
                  {post.title}
                </h2>
                {post.excerpt && <p className="mt-2 text-sm leading-relaxed text-muted">{post.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 border border-line px-6 py-10 text-center text-muted">
          Our first stories are on the way. Please check back soon.
        </p>
      )}
    </div>
  );
}
