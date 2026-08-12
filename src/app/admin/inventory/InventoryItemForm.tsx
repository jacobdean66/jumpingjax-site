"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  CATEGORY_COPY,
  CATEGORY_IDS,
} from "@/data/rentals";
import type { AdminInventoryItem } from "@/lib/admin/inventory";
import {
  INVENTORY_IMAGE_BUCKET,
  isWebSafeInventoryImageUpload,
} from "@/lib/admin/inventory-image-constants";
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

type Props = {
  token: string;
  item?: AdminInventoryItem;
  cancelHref: string;
};

async function uploadInventoryImageDirect(input: {
  file: File;
  slug: string;
  title: string;
}): Promise<string> {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error("Supabase browser client is not configured.");
  }

  const signResponse = await fetch("/api/admin/inventory/image-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.file.name,
      contentType: input.file.type || "image/jpeg",
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
  return signed.publicUrl;
}

export function InventoryItemForm({ token, item, cancelHref }: Props) {
  const dimensions = item?.dimensions ?? emptyInventoryDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const imageInput = form.elements.namedItem("imageFile") as HTMLInputElement | null;
      const imageFile = imageInput?.files?.[0];

      if (imageFile && imageFile.size > 0) {
        if (
          !isWebSafeInventoryImageUpload({
            fileName: imageFile.name,
            contentType: imageFile.type,
          })
        ) {
          throw new Error(
            'Use a JPG, PNG, WEBP, or GIF photo. iPhone HEIC photos will not show on the website — choose "Most Compatible" or export as JPG first.',
          );
        }
        const title = String(formData.get("title") ?? "");
        const slug = String(formData.get("slug") ?? "");
        const publicUrl = await uploadInventoryImageDirect({
          file: imageFile,
          slug,
          title,
        });
        const imageSrcInput = form.elements.namedItem(
          "imageSrc",
        ) as HTMLInputElement | null;
        if (imageSrcInput) imageSrcInput.value = publicUrl;
        if (imageInput) imageInput.value = "";
      }

      // Native submit bypasses this React handler and posts only metadata/URL.
      HTMLFormElement.prototype.submit.call(form);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Inventory save failed");
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
        <label className="text-sm font-bold text-slate-700">
          Rental photo
          <input
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            disabled={busy}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-950 file:mr-4 file:rounded-full file:border-0 file:bg-sky-500 file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-sky-600"
          />
          {item?.imageSrc ? (
            <span className="mt-2 block break-all text-xs font-semibold text-slate-500">
              Current photo saved. New photos upload directly to storage before
              Save. Use JPG/PNG/WEBP (not HEIC).
            </span>
          ) : (
            <span className="mt-2 block text-xs font-semibold text-slate-500">
              Choose a JPG, PNG, or WEBP photo. It uploads to storage before
              Save.
            </span>
          )}
        </label>
        <label className="text-sm font-bold text-slate-700">
          Image description
          <input
            name="imageAlt"
            defaultValue={item?.imageAlt ?? ""}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
          />
        </label>
      </div>

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
