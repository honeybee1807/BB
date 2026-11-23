import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Markdown from "react-markdown";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { getPost, listPosts, staticParams } from "@/lib/data/public";
import { formatLongDate } from "@/lib/format";
import { absoluteUrl, buildMetadata, trimDescription } from "@/lib/seo";
import { publicImageUrl } from "@/lib/storage";

export async function generateStaticParams() {
  const posts = await listPosts();
  return staticParams(
    posts.map((p) => ({ slug: p.slug })),
    { slug: "none" },
  );
}

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Not found", robots: { index: false } };
  return buildMetadata(`/journal/${post.slug}`, {
    title: post.seo_title ?? `${post.title} | Bargain Breaks Journal`,
    description: post.seo_description ?? trimDescription(post.excerpt ?? post.body_md),
    image: post.featured_image_path ? publicImageUrl("blog-images", post.featured_image_path) : null,
  });
}

async function PostView({ params }: { params: PageProps<"/journal/[slug]">["params"] }) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const image = post.featured_image_path ? publicImageUrl("blog-images", post.featured_image_path) : null;
  return (
    <article>
      <JsonLd
        data={{
          "@type": "Article",
          headline: post.title,
          url: absoluteUrl(`/journal/${post.slug}`),
          ...(image ? { image: [image] } : {}),
          ...(post.published_at ? { datePublished: post.published_at } : {}),
          dateModified: post.updated_at,
          publisher: { "@type": "Organization", name: "Bargain Breaks" },
        }}
      />
      <Breadcrumbs
        items={[
          { href: "/journal", label: "Journal" },
          { href: `/journal/${post.slug}`, label: post.title },
        ]}
      />
      <header className="mt-10 border-b-2 border-navy pb-6">
        {post.published_at && (
          <p className="text-xs tracking-[0.12em] text-muted uppercase">
            <time dateTime={post.published_at}>{formatLongDate(post.published_at)}</time>
          </p>
        )}
        <h1 className="mt-3 font-serif text-[32px] leading-tight text-navy sm:text-[42px]">{post.title}</h1>
      </header>
      {image && (
        <div className="relative mt-10 aspect-[16/9] overflow-hidden bg-mist">
          <Image src={image} alt="" fill unoptimized preload className="object-cover" />
        </div>
      )}
      <div className="mt-10 flex flex-col gap-5 text-[17px] leading-relaxed text-ink [&_a]:text-teal [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-gold [&_blockquote]:pl-5 [&_blockquote]:italic [&_h2]:mt-6 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-navy [&_h3]:mt-4 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-navy [&_li]:ml-6 [&_ol]:list-decimal [&_ul]:list-disc">
        <Markdown skipHtml components={{ h1: "h2" }}>
          {post.body_md}
        </Markdown>
      </div>
    </article>
  );
}

export default function PostPage({ params }: PageProps<"/journal/[slug]">) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
      <Suspense fallback={<p className="text-sm text-muted">Loading...</p>}>
        <PostView params={params} />
      </Suspense>
    </div>
  );
}
