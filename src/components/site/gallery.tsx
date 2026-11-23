"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export type GalleryPhoto = { full: string; thumb: string; alt: string; width: number; height: number };

const arrow =
  "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center bg-white/90 text-navy shadow hover:bg-white";

// Photos are already resized to WebP on upload, so the image optimiser is skipped.
export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  if (!photo) return null;
  const many = photos.length > 1;
  const go = (step: number) => setIndex((i) => (i + step + photos.length) % photos.length);

  return (
    <section aria-label="Photos">
      <div className="relative aspect-[3/2] overflow-hidden bg-mist">
        <Image
          key={photo.full}
          src={photo.full}
          alt={photo.alt}
          fill
          unoptimized
          preload={index === 0}
          className="object-cover"
        />
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} className={`${arrow} left-3`}>
              <ChevronLeft aria-hidden strokeWidth={1.5} className="size-6" />
              <span className="sr-only">Previous photo</span>
            </button>
            <button type="button" onClick={() => go(1)} className={`${arrow} right-3`}>
              <ChevronRight aria-hidden strokeWidth={1.5} className="size-6" />
              <span className="sr-only">Next photo</span>
            </button>
            <p aria-live="polite" className="absolute right-3 bottom-3 bg-navy/80 px-2.5 py-1 text-xs text-white">
              {index + 1} of {photos.length}
            </p>
          </>
        )}
      </div>
      {many && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <li key={p.thumb} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? "true" : undefined}
                className={`relative block h-16 w-24 overflow-hidden border-2 ${i === index ? "border-teal" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                <Image src={p.thumb} alt="" fill unoptimized className="object-cover" />
                <span className="sr-only">
                  Show photo {i + 1}: {p.alt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
