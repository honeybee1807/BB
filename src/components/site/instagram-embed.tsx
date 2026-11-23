"use client";

import { Play } from "lucide-react";
import { useState } from "react";

// Nothing loads from Instagram until the guest asks for it.
export function InstagramEmbed({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const match = url.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  const kind = match[1] === "reels" ? "reel" : match[1];
  const embed = `https://www.instagram.com/${kind}/${match[2]}/embed`;

  if (open) {
    return (
      <iframe
        src={embed}
        title={`Instagram video of ${title}`}
        className="h-[640px] w-full max-w-[400px] border border-line"
        loading="lazy"
        allowFullScreen
      />
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-navy px-5 py-3 text-xs font-bold tracking-[0.14em] text-navy uppercase hover:bg-navy hover:text-white"
      >
        <Play aria-hidden strokeWidth={1.5} className="size-4" />
        Watch the video
      </button>
      <p className="text-[13px] text-muted">
        This loads a video from Instagram.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Open it on Instagram instead
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
    </div>
  );
}
