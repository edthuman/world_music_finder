"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Region } from "@/lib/regions";

type Result = {
  created?: string[];
  replaced?: string[];
  existing?: string[];
  failure?: { regionCode?: string; status: number; message: string };
  error?: string;
};

function describe(result: Result) {
  if (result.error) return `${result.error}.`;

  const created =
    (result.created?.length ?? 0) + (result.replaced?.length ?? 0);
  const skipped = result.existing?.length ?? 0;
  const summary =
    created > 0
      ? `Created ${created} ${created === 1 ? "playlist" : "playlists"}${skipped > 0 ? " (skipped playlists that already exist)" : ""}.`
      : skipped > 0 && !result.failure
        ? "No playlists created - all already exist in your Spotify account."
        : "No playlists created.";
  if (!result.failure) return summary;

  const { regionCode } = result.failure;
  return `${summary} Stopped${regionCode ? ` at ${regionCode}` : ""} because something went wrong. Try again, or log out and back in if it keeps happening.`;
}

const itemClass =
  "flex cursor-pointer items-center gap-[0.7rem] px-[0.9rem] py-[0.55rem] text-[1.05rem]";

export default function PlaylistManager({ regions }: { regions: Region[] }) {
  const allToggle = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return regions;
    return regions.filter(
      (region) =>
        region.name.toLowerCase().includes(text) ||
        region.code.toLowerCase().includes(text),
    );
  }, [regions, query]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((region) => selected.has(region.code));
  const someVisibleSelected = visible.some((region) =>
    selected.has(region.code),
  );

  useEffect(() => {
    if (allToggle.current) {
      allToggle.current.indeterminate =
        someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  function toggle(code: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const region of visible) {
        if (allVisibleSelected) next.delete(region.code);
        else next.add(region.code);
      }
      return next;
    });
  }

  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionCodes: [...selected] }),
      });
      setToast(describe((await response.json()) as Result));
    } catch {
      setToast("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const count = selected.size;

  return (
    <>
      <div className="mb-5 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="search"
            className="flex-[1_1_12rem] rounded-lg border border-edge bg-surface px-[0.8rem] py-[0.55rem] text-fg"
            placeholder="Search regions"
            aria-label="Search regions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="min-h-32 overflow-y-auto rounded-lg border border-edge bg-surface">
          <label
            className={`${itemClass} sticky top-0 z-1 border-b border-edge bg-surface-raised font-semibold`}
          >
            <input
              ref={allToggle}
              className="size-[1.15rem] accent-accent"
              type="checkbox"
              checked={allVisibleSelected}
              disabled={visible.length === 0}
              onChange={toggleAllVisible}
            />
            <span>{query.trim() ? "All shown regions" : "All regions"}</span>
            <span
              className="ml-auto text-[0.85rem] font-normal text-fg-muted"
              aria-live="polite"
            >
              {count} of {regions.length} selected
            </span>
          </label>
          <ul>
            {visible.map((region) => (
              <li key={region.code}>
                <label className={`${itemClass} hover:bg-fg/5`}>
                  <input
                    type="checkbox"
                    className="size-[1.15rem] accent-accent"
                    checked={selected.has(region.code)}
                    onChange={() => toggle(region.code)}
                  />
                  <span>{region.name}</span>
                  <span className="ml-auto text-[0.75rem] text-fg-faint">
                    {region.code}
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="p-[0.9rem] text-fg-muted">No regions match.</li>
            )}
          </ul>
        </div>
      </div>

      <button
        type="button"
        className="w-full flex-none cursor-pointer rounded-lg bg-accent px-4 py-3 font-semibold text-white enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
        disabled={busy || count === 0}
        onClick={() => void create()}
      >
        {busy
          ? "Creating playlists..."
          : `Create playlists${count > 0 ? ` (${count})` : ""}`}
      </button>

      {toast && (
        <div
          className="fixed right-5 bottom-5 z-10 flex max-w-96 items-start gap-3 rounded-lg border border-edge bg-surface px-4 py-[0.8rem] font-sans text-sm/[1.4] text-fg shadow-[0_6px_20px_rgba(18,48,79,0.16)]"
          role="status"
        >
          <span>{toast}</span>
          <button
            type="button"
            className="flex-none cursor-pointer p-0 text-[1.25rem] leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
