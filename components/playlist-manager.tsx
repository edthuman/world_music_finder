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
      <div className="region-picker">
        <div className="region-controls">
          <input
            type="search"
            className="region-search"
            placeholder="Search regions"
            aria-label="Search regions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="region-box">
          <label className="region-item region-all">
            <input
              ref={allToggle}
              type="checkbox"
              checked={allVisibleSelected}
              disabled={visible.length === 0}
              onChange={toggleAllVisible}
            />
            <span>{query.trim() ? "All shown regions" : "All regions"}</span>
            <span className="region-count" aria-live="polite">
              {count} of {regions.length} selected
            </span>
          </label>
          <ul className="region-list">
            {visible.map((region) => (
              <li key={region.code}>
                <label className="region-item">
                  <input
                    type="checkbox"
                    checked={selected.has(region.code)}
                    onChange={() => toggle(region.code)}
                  />
                  <span>{region.name}</span>
                  <span className="region-code">{region.code}</span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="region-empty">No regions match.</li>
            )}
          </ul>
        </div>
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={busy || count === 0}
        onClick={() => void create()}
      >
        {busy
          ? "Creating playlists..."
          : `Create playlists${count > 0 ? ` (${count})` : ""}`}
      </button>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            type="button"
            className="toast-close"
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
