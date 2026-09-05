"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
} from "@/data/rentals";
import type { RentalMedia } from "@/data/rentals";
import type { AdminInventoryItem } from "@/lib/admin/inventory";
import {
  INVENTORY_IMAGE_BUCKET,
} from "@/lib/admin/inventory-image-constants";
import {
  classifyInventoryMediaUpload,
  validateInventoryMediaUpload,
} from "@/lib/admin/inventory-media";
import { emptyInventoryDimensions } from "@/lib/admin/inventory-ops";
import { supabase, isSupabaseBrowserConfigured } from "@/lib/supabaseClient";
import { InventoryOpsFields } from "./InventoryOpsFields";

const ROUTE_KIND_OPTIONS = [
  ["standard", "Standard inflatable"],
  ["big-slide", "Big slide"],
  ["accessory", "Accessory"],
  ["foam", "Foam party"],
  ["yard-game", "Yard game"],
] as const;

const PHOTO_OPTIMIZE_THRESHOLD_BYTES = 4 * 1024 * 1024;
const PHOTO_MAX_EDGE_PX = 3000;

function selectedFileKey(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

function mergeSelectedFiles(current: readonly File[], additions: readonly File[]): File[] {
  const files = new Map(current.map((file) => [selectedFileKey(file), file]));
  for (const file of additions) files.set(selectedFileKey(file), file);
  return [...files.values()];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function photoUploadName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || "rental-photo";
  return `${base}.webp`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not optimize this photo.")),
      "image/webp",
      quality,
    );
  });
}

async function optimizeLargePhoto(file: File): Promise<File> {
  if (file.size <= PHOTO_OPTIMIZE_THRESHOLD_BYTES) return file;

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const initialScale = Math.min(
      1,
      PHOTO_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height),
    );
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let smallest: Blob | null = null;

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the photo.");
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.9, 0.82, 0.72, 0.6, 0.48]) {
        const blob = await canvasToBlob(canvas, quality);
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= PHOTO_OPTIMIZE_THRESHOLD_BYTES) {
          return new File([blob], photoUploadName(file.name), {
            type: "image/webp",
            lastModified: file.lastModified,
          });
        }
      }

      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }

    if (!smallest) throw new Error("Could not optimize this photo.");
    return new File([smallest], photoUploadName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

type Props = {
  token: string;
  item?: AdminInventoryItem;
  cancelHref: string;
};

async function uploadInventoryMediaDirect(input: {
  file: File;
  slug: string;
  title: string;
}): Promise<{ url: string; mediaType: "image" | "video" }> {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error("Supabase browser client is not configured.");
  }

  const signResponse = await fetch("/api/admin/inventory/image-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.file.name,
      contentType: input.file.type || "image/jpeg",
      fileSize: input.file.size,
      slug: input.slug,
      title: input.title,
    }),
  });

  const signed = (await signResponse.json()) as {
    error?: string;
    bucket?: string;
    path?: string;
    token?: string;
    publicUrl?: string;
    mediaType?: "image" | "video";
  };

  if (!signResponse.ok || !signed.path || !signed.token || !signed.publicUrl) {
    throw new Error(signed.error ?? "Could not prepare photo upload.");
  }

  const { error } = await supabase.storage
    .from(signed.bucket || INVENTORY_IMAGE_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) throw new Error(error.message);
  return {
    url: signed.publicUrl,
    mediaType: signed.mediaType === "video" ? "video" : "image",
  };
}

function orderedMedia(media: readonly RentalMedia[]): RentalMedia[] {
  return media.map((item, index) => ({ ...item, sortOrder: index }));
}

export function InventoryItemForm({ token, item, cancelHref }: Props) {
  const dimensions = item?.dimensions ?? emptyInventoryDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<RentalMedia[]>(item?.media ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  function handleMediaSelection(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.currentTarget.files ?? [])].filter((file) => file.size > 0);
    setPendingFiles((current) => mergeSelectedFiles(current, selected));
    setError(null);
    event.currentTarget.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const native = event.nativeEvent as SubmitEvent;
    const submitter = native.submitter as HTMLButtonElement | null;
    const formAction = submitter?.getAttribute("formAction") ?? form.action;

    // Delete keeps the existing small form post (id + token only).
    if (formAction.includes("/api/admin/inventory/delete")) {
      return;
    }

    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const formData = new FormData(form);
      const mediaInput = form.elements.namedItem("mediaFiles") as HTMLInputElement | null;
      const files = [...pendingFiles];
      let nextMedia = [...media];
      const title = String(formData.get("title") ?? "").trim();
      const slug = String(formData.get("slug") ?? "");

      for (const [index, file] of files.entries()) {
        const mediaType = classifyInventoryMediaUpload({
          fileName: file.name,
          contentType: file.type,
        });
        if (!mediaType) {
          validateInventoryMediaUpload({
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
          });
        }
        if (mediaType === "image" && file.size > PHOTO_OPTIMIZE_THRESHOLD_BYTES) {
          setUploadStatus(`Optimizing ${index + 1} of ${files.length}: ${file.name}`);
        }
        const uploadFile = mediaType === "image" ? await optimizeLargePhoto(file) : file;
        validateInventoryMediaUpload({
          fileName: uploadFile.name,
          contentType: uploadFile.type,
          fileSize: uploadFile.size,
        });
        const optimized = uploadFile !== file ? " (optimized automatically)" : "";
        setUploadStatus(`Uploading ${index + 1} of ${files.length}: ${file.name}${optimized}`);
        const uploaded = await uploadInventoryMediaDirect({ file: uploadFile, slug, title });
        const hasCover = nextMedia.some((item) => item.isCover);
        nextMedia.push({
          id: `new:${crypto.randomUUID()}`,
          mediaType: uploaded.mediaType,
          url: uploaded.url,
          altText: uploaded.mediaType === "image" ? title : "",
          caption: "",
          sortOrder: nextMedia.length,
          isCover: uploaded.mediaType === "image" && !hasCover,
          posterUrl: null,
        });
      }

      nextMedia = orderedMedia(nextMedia);
      if (!nextMedia.some((entry) => entry.mediaType === "image" && entry.isCover)) {
        throw new Error("Add at least one photo and select it as the cover image.");
      }
      setMedia(nextMedia);
      const mediaJsonInput = form.elements.namedItem("mediaJson") as HTMLInputElement;
      mediaJsonInput.value = JSON.stringify(nextMedia);
      const cover = nextMedia.find((entry) => entry.isCover);
      (form.elements.namedItem("imageSrc") as HTMLInputElement).value = cover?.url ?? "";
      (form.elements.namedItem("imageAlt") as HTMLInputElement).value = cover?.altText ?? title;
      if (mediaInput) mediaInput.value = "";
      setPendingFiles([]);
      setUploadStatus(null);

      // Native submit bypasses this React handler and posts only metadata/URL.
      HTMLFormElement.prototype.submit.call(form);
    } catch (err) {
      setBusy(false);
      setUploadStatus(null);
      const message = err instanceof Error ? err.message : "Inventory save failed";
      setError(
        /exceeded the maximum allowed size/i.test(message)
          ? "That file is larger than the storage service allows. Large photos are normally resized automatically; try uploading this file as a photo instead of a video."
          : message,
      );
    }
  }

  return (
    <form
      action="/api/admin/inventory/item"
      method="post"
      encType="multipart/form-data"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="token" value={token} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="imageSrc" defaultValue={item?.imageSrc ?? ""} />
      <input type="hidden" name="imageAlt" defaultValue={item?.imageAlt ?? ""} />
      <input type="hidden" name="mediaJson" value={JSON.stringify(orderedMedia(media))} readOnly />

      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Inventory Editor
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {item ? `Edit ${item.title}` : "Add a rental item"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {item ? (
            <button
              type="submit"
              formAction="/api/admin/inventory/delete"
              disabled={busy}
              className="rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-60"
            >
              Delete Item
            </button>
          ) : null}
          <Link
            href={cancelHref}
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save Item"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Item name
          <input
            name="title"
            required
            defaultValue={item?.title ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Category
          <select
            name="categoryId"
            defaultValue={item?.categoryId ?? "bounce-houses"}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {CATEGORY_COPY[id].title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Starting price
          <input
            name="startingPrice"
            type="number"
            min="0"
            step="1"
            defaultValue={item?.startingPrice ?? 0}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <h3 className="text-lg font-black text-slate-950">Rental Photos &amp; Videos</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
            Add as many photos as you want—even in separate selections. Large
            photos are resized automatically. MP4 and WebM videos are also supported.
            HEIC, HEVC, and MOV files are not supported.
          </p>
        </div>
        <input
          id="inventory-media-files"
          name="mediaFiles"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm"
          disabled={busy}
          onChange={handleMediaSelection}
          className="sr-only"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label
            htmlFor="inventory-media-files"
            className={`cursor-pointer rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white hover:bg-sky-600 ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            {pendingFiles.length > 0 ? "Add more photos or videos" : "Choose photos or videos"}
          </label>
          <span className="text-sm font-bold text-slate-700">
            {pendingFiles.length > 0
              ? `${pendingFiles.length} new ${pendingFiles.length === 1 ? "file" : "files"} ready`
              : "No new files selected"}
          </span>
          {pendingFiles.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingFiles([])}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Clear new files
            </button>
          ) : null}
        </div>
        {pendingFiles.length > 0 ? (
          <div className="mt-3 grid gap-2" aria-label="New files ready to upload">
            {pendingFiles.map((file) => (
              <div
                key={selectedFileKey(file)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{file.name}</p>
                  <p className="text-xs font-semibold text-slate-600">
                    {formatFileSize(file.size)}
                    {classifyInventoryMediaUpload({ fileName: file.name, contentType: file.type }) === "image" && file.size > PHOTO_OPTIMIZE_THRESHOLD_BYTES
                      ? " · will be resized automatically"
                      : " · ready to upload"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPendingFiles((current) => current.filter((entry) => selectedFileKey(entry) !== selectedFileKey(file)))}
                  className="rounded-full bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-sm disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {uploadStatus ? <p className="mt-2 text-sm font-bold text-sky-700">{uploadStatus}</p> : null}

        <div className="mt-4 grid gap-3">
          {media.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-600">
              No media yet. Add at least one photo to use as the rental cover.
            </p>
          ) : media.map((entry, index) => (
            <div key={entry.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[8rem_1fr]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
                {entry.mediaType === "image" ? (
                  <Image src={entry.url} alt={entry.altText || "Rental media preview"} fill unoptimized className="object-cover" sizes="128px" />
                ) : (
                  <video src={entry.url} poster={entry.posterUrl ?? undefined} controls preload="metadata" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black uppercase text-slate-600">{entry.mediaType}</span>
                  {entry.isCover ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black uppercase text-emerald-800">Cover photo</span> : null}
                </div>
                <label className="mt-2 block text-xs font-bold text-slate-700">
                  {entry.mediaType === "image" ? "Alt text" : "Caption"}
                  <input
                    value={entry.mediaType === "image" ? entry.altText : entry.caption}
                    onChange={(event) => setMedia((current) => current.map((item) => item.id === entry.id ? {
                      ...item,
                      ...(item.mediaType === "image" ? { altText: event.target.value } : { caption: event.target.value }),
                    } : item))}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-950"
                  />
                </label>
                {entry.mediaType === "video" ? (
                  <label className="mt-2 block text-xs font-bold text-slate-700">
                    Poster image URL (optional)
                    <input value={entry.posterUrl ?? ""} onChange={(event) => setMedia((current) => current.map((item) => item.id === entry.id ? { ...item, posterUrl: event.target.value || null } : item))} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-950" />
                  </label>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.mediaType === "image" && !entry.isCover ? <button type="button" onClick={() => setMedia((current) => orderedMedia([
                    { ...entry, isCover: true },
                    ...current.filter((item) => item.id !== entry.id).map((item) => ({ ...item, isCover: false })),
                  ]))} className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white">Make cover</button> : null}
                  <button type="button" disabled={index === 0} onClick={() => setMedia((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return orderedMedia(next); })} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black disabled:opacity-40">Move up</button>
                  <button type="button" disabled={index === media.length - 1} onClick={() => setMedia((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return orderedMedia(next); })} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black disabled:opacity-40">Move down</button>
                  <button type="button" onClick={() => setMedia((current) => {
                    const remaining = current.filter((item) => item.id !== entry.id);
                    if (entry.isCover) {
                      const nextCover = remaining.find((item) => item.mediaType === "image");
                      return orderedMedia(remaining.map((item) => ({ ...item, isCover: item.id === nextCover?.id })));
                    }
                    return orderedMedia(remaining);
                  })} className="rounded-full bg-rose-100 px-3 py-2 text-xs font-black text-rose-800">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4">
        <label className="text-sm font-bold text-slate-700">
          Short card description
          <textarea
            name="shortDescription"
            rows={3}
            defaultValue={item?.shortDescription ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Full page description
          <textarea
            name="description"
            rows={5}
            defaultValue={item?.description ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Age recommendation
          <input
            name="ageRecommendation"
            defaultValue={item?.ageRecommendation ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Setup requirements
          <textarea
            name="setupRequirements"
            rows={5}
            defaultValue={(item?.setupRequirements ?? []).join("\n")}
            placeholder="One requirement per line"
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Route planner type
          <select
            name="routeKind"
            defaultValue={item?.routeKind ?? "standard"}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          >
            {ROUTE_KIND_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Setup minutes
          <input
            name="estimatedSetupMinutes"
            type="number"
            min="0"
            max="240"
            defaultValue={item?.estimatedSetupMinutes ?? 45}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <InventoryOpsFields
        key={item?.id ?? "new-item"}
        blowerRequirements={item?.blowerRequirements ?? []}
        tarpRequirement={item?.tarpRequirement ?? ""}
        cleaningSupply={item?.cleaningSupply ?? "disinfectant"}
        dimensions={dimensions}
      />

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={item?.isActive ?? true}
            className="mt-1 h-4 w-4"
          />
          Active for employees
        </label>
        <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
          <input
            name="publicVisible"
            type="checkbox"
            defaultChecked={item?.publicVisible ?? false}
            className="mt-1 h-4 w-4"
          />
          Show on public website
        </label>
        <p className="sm:col-span-2 text-xs font-semibold leading-relaxed text-slate-500">
          Approving for the website only removes the Review status. The item stays
          in this inventory list either way.
        </p>
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-800">
          Advanced website settings
        </summary>
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-bold text-slate-700">
            Website link name
            <input
              name="slug"
              defaultValue={item?.slug ?? ""}
              placeholder="Leave blank to make this automatically"
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
            />
          </label>
          <p className="text-xs font-semibold leading-relaxed text-slate-500">
            This is made automatically from the item name. Only change it if a
            manager asks you to.
          </p>
        </div>
      </details>
    </form>
  );
}
