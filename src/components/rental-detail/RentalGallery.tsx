"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { Rental, RentalMedia } from "@/data/rentals";

export default function RentalGallery({ rental }: { rental: Rental }) {
  const media = useMemo(() => rental.media ?? [], [rental.media]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());

  useEffect(() => {
    for (const [id, video] of videoRefs.current) {
      if (id !== media[selectedIndex]?.id) video.pause();
    }
  }, [media, selectedIndex]);

  if (media.length === 0) return null;

  function select(index: number) {
    const next = (index + media.length) % media.length;
    setSelectedIndex(next);
    const scroller = scrollerRef.current;
    scroller?.scrollTo({
      left: next * scroller.clientWidth,
      behavior: "smooth",
    });
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const next = Math.round(scroller.scrollLeft / scroller.clientWidth);
    if (next >= 0 && next < media.length && next !== selectedIndex) {
      setSelectedIndex(next);
    }
  }

  return (
    <section aria-label={`${rental.title} photos and videos`}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {media.map((item, index) => (
            <div
              key={item.id}
              className="relative aspect-[4/3] min-w-full snap-center sm:aspect-[3/2]"
            >
              <GalleryItem
                item={item}
                rentalTitle={rental.title}
                active={index === selectedIndex}
                priority={index === 0}
                setVideoRef={(video) => {
                  if (video) videoRefs.current.set(item.id, video);
                  else videoRefs.current.delete(item.id);
                }}
              />
            </div>
          ))}
        </div>

        {media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => select(selectedIndex - 1)}
              aria-label="Previous gallery item"
              className="absolute left-3 top-1/2 hidden min-h-12 min-w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/85 sm:flex"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => select(selectedIndex + 1)}
              aria-label="Next gallery item"
              className="absolute right-3 top-1/2 hidden min-h-12 min-w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/85 sm:flex"
            >
              <ChevronRight aria-hidden="true" />
            </button>
            <p
              aria-live="polite"
              className="absolute bottom-3 right-3 rounded-full bg-black/75 px-3 py-1.5 text-sm font-black text-white"
            >
              {selectedIndex + 1} of {media.length}
            </p>
          </>
        ) : null}
      </div>

      {media.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(index)}
              aria-label={`Show ${item.mediaType} ${index + 1} of ${media.length}`}
              aria-current={index === selectedIndex ? "true" : undefined}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-950 transition sm:h-20 sm:w-24 ${
                index === selectedIndex
                  ? "border-cyan-300"
                  : "border-white/15 hover:border-white/40"
              }`}
            >
              {item.mediaType === "image" ? (
                <Image src={item.url} alt="" fill className="object-cover" sizes="96px" />
              ) : item.posterUrl ? (
                <span
                  aria-hidden="true"
                  className="block h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${JSON.stringify(item.posterUrl)})` }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-cyan-200">
                  <Play aria-hidden="true" />
                </span>
              )}
              {item.mediaType === "video" ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                  Video
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-center text-xs font-semibold text-slate-400 sm:hidden">
        Swipe to browse photos and videos
      </p>
      {media[selectedIndex]?.caption ? (
        <p className="mt-2 text-sm text-slate-300">
          {media[selectedIndex].caption}
        </p>
      ) : null}
    </section>
  );
}

function GalleryItem({
  item,
  rentalTitle,
  active,
  priority,
  setVideoRef,
}: {
  item: RentalMedia;
  rentalTitle: string;
  active: boolean;
  priority: boolean;
  setVideoRef: (video: HTMLVideoElement | null) => void;
}) {
  if (item.mediaType === "image") {
    return (
      <Image
        src={item.url}
        alt={item.altText || rentalTitle}
        fill
        priority={priority}
        fetchPriority={priority ? "high" : "auto"}
        quality={82}
        className="object-cover object-center"
        sizes="(max-width: 896px) 100vw, 896px"
      />
    );
  }
  return (
    <video
      ref={setVideoRef}
      src={active ? item.url : undefined}
      poster={item.posterUrl ?? undefined}
      controls
      playsInline
      preload={active ? "metadata" : "none"}
      aria-label={item.caption || `${rentalTitle} video`}
      className="h-full w-full bg-black object-contain"
    />
  );
}
