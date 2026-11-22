"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Region } from "@/lib/regions";

type Visibility = "private" | "public";

type Result = {
  created?: string[];
  skipped?: string[];
  failure?: { regionCode?: string; status: number; message: string };
  error?: string;
};

const visibilities: Visibility[] = ["private", "public"];

function describe(result: Result) {
  if (result.error) return `${result.error}.`;
  const summary = `Created ${result.created?.length ?? 0}, skipped ${result.skipped?.length ?? 0} already saved.`;
  if (!result.failure) return summary;
  const { regionCode, message, status } = result.failure;
  return `${summary} Stopped${regionCode ? ` at ${regionCode}` : ""}: ${message} (${status}). If this is a permissions error, log out and back in.`;
}

export default function PlaylistManager({ regions }: { regions: Region[] }) {
  const allToggle = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<Visibility>("private");
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
        body: JSON.stringify({ visibility, regionCodes: [...selected] }),
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
          <div className="visibility-toggle">
            <div
              className="segmented"
              role="group"
              aria-label="Visibility of new playlists"
            >
              {visibilities.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={visibility === option}
                  onClick={() => setVisibility(option)}
                >
                  {option === "private" ? "Private" : "Public"}
                </button>
              ))}
            </div>
          </div>
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
          {toast}
        </div>
      )}
    </>
  );
}
