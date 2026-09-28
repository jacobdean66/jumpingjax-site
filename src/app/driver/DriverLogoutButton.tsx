"use client";

import { useRouter } from "next/navigation";

export function DriverLogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        for (const key of Object.keys(window.localStorage)) {
          if (key.startsWith("jumpingjax-driver-location-sharing:")) {
            window.localStorage.removeItem(key);
          }
        }
        await fetch("/api/driver/session", { method: "DELETE" });
        router.push("/driver");
        router.refresh();
      }}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black leading-tight text-slate-700 hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}
