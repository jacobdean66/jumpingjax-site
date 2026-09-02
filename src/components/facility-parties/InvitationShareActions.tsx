"use client";

import { useState } from "react";

export function InvitationShareActions({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const [status, setStatus] = useState("");

  function currentUrl(): string {
    return window.location.href;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setStatus("Invitation link copied");
    } catch {
      window.prompt("Copy this invitation link:", currentUrl());
    }
  }

  async function shareInvitation() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: message, url: currentUrl() });
        setStatus("Invitation shared");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        await copyLink();
      }
      return;
    }
    await copyLink();
  }

  function emailInvitation() {
    const body = `${message}\n\nOpen the full invitation:\n${currentUrl()}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }

  const buttonClass =
    "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2" data-invitation-share-actions>
      <button type="button" onClick={shareInvitation} className="rounded-full bg-pink-600 px-4 py-2 text-sm font-black text-white hover:bg-pink-700">
        Share invitation
      </button>
      <button type="button" onClick={emailInvitation} className={buttonClass}>
        Email invitation
      </button>
      <button type="button" onClick={copyLink} className={buttonClass}>
        Copy link
      </button>
      <span className="text-xs font-bold text-emerald-700" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
