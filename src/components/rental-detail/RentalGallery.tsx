"use client";

import { useState } from "react";
import Image from "next/image";
import { RentalItem } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RentalGalleryProps {
  rental: RentalItem;
}

export default function RentalGallery({ rental }: RentalGalleryProps) {
  const images = rental.galleryImages || [rental.image];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return null; // Don't render if no images
  }

  const selectedImage = images[selectedImageIndex];

  const goToPrevious = () => {
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <section className="px-4 py-16 md:py-20 lg:py-24 border-t border-white/10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-4xl md:text-5xl font-black text-white">
          Gallery
        </h2>

        {/* Main Image Display */}
        <div className="mb-8">
          <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black/50">
            <Image
              src={selectedImage}
              alt={`${rental.name} - Image ${selectedImageIndex + 1}`}
              fill
              className="object-cover transition-opacity duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 60vw"
            />

            {/* Navigation Arrows (shown if multiple images) */}
            {images.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full transition-colors z-10"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full transition-colors z-10"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-black/75 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                {selectedImageIndex + 1} / {images.length}
              </div>
            )}
          </div>
        </div>

        {/* Thumbnail Strip (shown if multiple images) */}
        {images.length > 1 && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImageIndex(index)}
                className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                  index === selectedImageIndex
                    ? "border-cyan-400"
                    : "border-white/20 hover:border-white/40"
                }`}
                aria-label={`View image ${index + 1}`}
                aria-current={index === selectedImageIndex}
              >
                <Image
                  src={image}
                  alt={`${rental.name} - Thumbnail ${index + 1}`}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
