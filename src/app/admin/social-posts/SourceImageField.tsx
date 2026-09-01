"use client";

import { useMemo, useState } from "react";
import type { SocialSourceImage } from "@/lib/social-posts/social-source-images";

type Props = {
  images: SocialSourceImage[];
  disabled?: boolean;
};

function isPublicImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SourceImageField({ images, disabled = false }: Props) {
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const selectedLabel = useMemo(
    () => images.find((image) => image.url === sourceImageUrl)?.label ?? "",
    [images, sourceImageUrl],
  );
  const canPreview = isPublicImageUrl(sourceImageUrl);

  return (
    <div className="space-y-2">
      {images.length > 0 ? (
        <select
          disabled={disabled}
          value={selectedLabel ? sourceImageUrl : ""}
          onChange={(event) => setSourceImageUrl(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
        >
          <option value="">Choose an existing rental/facility image</option>
          {images.map((image) => (
            <option key={image.url} value={image.url}>
              {image.label}{image.assetKind === "lifestyle" ? " — approved lifestyle photo" : image.assetKind === "product" ? " — exact product photo" : ""}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-950">
          No source images found. Add public images to the site or Supabase Storage.
        </div>
      )}

      <input
        name="source_image_url"
        disabled={disabled}
        value={sourceImageUrl}
        onChange={(event) => setSourceImageUrl(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
        placeholder="https://..."
      />

      <p className="text-xs font-semibold text-slate-500">
        Required before a rental social post can start. Select the exact
        product photo, or an owner-approved lifestyle photo. Product photos
        keep the rental exact while the creative may add generic kids;
        lifestyle photos preserve the actual people shown.
      </p>

      {canPreview ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceImageUrl}
            alt="Selected source image preview"
            className="max-h-44 w-full rounded-lg object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
