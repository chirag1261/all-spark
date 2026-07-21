"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Banner + gallery URLs; the component cycles through them. */
  images: string[];
  alt: string;
}

const INTERVAL_MS = 6000;

/**
 * Auto-playing hero media carousel — crossfades through the event's banner
 * and gallery with a slow Ken Burns drift, plus glassy dot controls.
 * Purely presentational: renders as the hero's background layer.
 */
export default function HeroMedia({ images, alt }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={images[index]}
        src={images[index]}
        alt={alt}
        className="hero-frame-active absolute inset-0 w-full h-full object-cover"
      />

      {images.length > 1 && (
        <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3 py-2">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === index ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
