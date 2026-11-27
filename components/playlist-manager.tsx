"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { RegionStatus } from "@/lib/region-status";
import type { Region } from "@/lib/regions";

type Result = {
  created?: string[];
  replaced?: string[];
  existing?: string[];
  imported?: string[];
  unchanged?: string[];
  noPlaylist?: string[];
  failure?: { regionCode?: string; status: number; message: string };
  error?: string;
};

type Action = {
  id: string;
  label: string;
  description: string;
  busyLabel: string;
  confirmLabel: (selected: Region[]) => string;
  /** Whether the action can be forced to redo regions that are already up to date. */
  supportsForce?: boolean;
  endpoint: string;
  describe: (result: Result, regions: Region[]) => string;
};

function withFailure(
  summary: string,
  failure: Result["failure"],
  regions: Region[],
) {
  if (!failure) return summary;

  const name = regions.find(
    (region) => region.code === failure.regionCode,
  )?.name;
  return `${summary}. Stopped${name ? ` at ${name}` : ""} because something went wrong. Try again, or log out and back in if it keeps happening.`;
}

function describeCreate(result: Result, regions: Region[]) {
  if (result.error) return `${result.error}.`;

  const created =
    (result.created?.length ?? 0) + (result.replaced?.length ?? 0);
  const skipped = result.existing?.length ?? 0;
  const summary =
    created > 0
      ? `Created ${created} ${created === 1 ? "playlist" : "playlists"}${skipped > 0 ? " (skipped playlists that already exist)" : ""}`
      : skipped > 0 && !result.failure
        ? "No playlists created - all already exist in your Spotify account"
        : "No playlists created";
  return withFailure(summary, result.failure, regions);
}

function describeImport(result: Result, regions: Region[]) {
  if (result.error) return `${result.error}.`;

  const updated = result.imported?.length ?? 0;
  const skipped = (
    [
      [result.unchanged?.length ?? 0, "without changes"],
      [result.noPlaylist?.length ?? 0, "without a playlist"],
    ] as [number, string][]
  )
    .filter(([count]) => count > 0)
    .map(([count, reason]) => `${count} ${reason}`);
  const summary = `${updated === 0 ? "No" : updated} region ${updated === 1 ? "playlist" : "playlists"} updated${skipped.length > 0 ? ` (skipped ${skipped.join(", ")})` : ""}`;
  return withFailure(summary, result.failure, regions);
}

const actions: Action[] = [
  {
    id: "create",
    label: "Create playlists",
    description:
      "Creates a Spotify playlist named after each selected region that you do not already have a playlist for. If a playlist has been deleted, a new one will be created.",
    busyLabel: "Creating playlists...",
    confirmLabel: (selected) =>
      selected.length === 0
        ? "Create playlists"
        : selected.length === 1
          ? `Create playlist for ${selected[0].name}`
          : `Create playlists for ${selected.length} regions`,
    endpoint: "/api/admin/playlists",
    describe: describeCreate,
  },
  {
    id: "import",
    label: "Import songs",
    description:
      "Saves the songs from each selected region's playlists into the database. Saved songs no longer in the playlist are deleted. Skips regions whose playlists have not changed since the last import, unless the import is forced.",
    busyLabel: "Importing songs...",
    confirmLabel: (selected) =>
      selected.length === 0
        ? "Import songs"
        : selected.length === 1
          ? `Import songs for ${selected[0].name}`
          : `Import songs for ${selected.length} regions`,
    supportsForce: true,
    endpoint: "/api/admin/tracks",
    describe: describeImport,
  },
];

type Session = {
  action: Action;
  /** Whether unchanged regions are processed anyway. */
  force: boolean;
  /** Region codes not yet processed, in the order the server handles them. */
  remaining: string[];
  total: number;
  /** Regions the user chose to skip after they failed. */
  skipped: string[];
  /** Everything the server has reported so far. */
  result: Result;
};

type Phase = "idle" | "running" | "paused" | "stopped";

const batchSize = 10;
const maxSkippedNames = 3;
const listKeys = [
  "created",
  "replaced",
  "existing",
  "imported",
  "unchanged",
  "noPlaylist",
] as const;

/** Adds the lists from a later batch to those so far. Only the latest batch's failure counts. */
function mergeResults(total: Result, next: Result): Result {
  const merged: Result = { failure: next.failure, error: next.error };
  for (const key of listKeys) {
    if (total[key] || next[key]) {
      merged[key] = [...(total[key] ?? []), ...(next[key] ?? [])];
    }
  }
  return merged;
}

function songsText(status?: RegionStatus) {
  if (!status || status.playlists === 0) return "No playlist";
  return `${status.tracks} ${status.tracks === 1 ? "song" : "songs"}`;
}

const itemClass =
  "flex cursor-pointer items-center gap-[0.7rem] px-[0.9rem] py-[0.55rem] text-[1.05rem]";
const primaryButtonClass =
  "cursor-pointer rounded-lg bg-accent px-4 py-3 font-semibold text-white enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButtonClass =
  "cursor-pointer rounded-lg border border-edge bg-surface px-4 py-3 font-semibold text-fg enabled:hover:bg-fg/6 disabled:cursor-not-allowed disabled:opacity-45";

export default function PlaylistManager({
  regions,
  statuses,
}: {
  regions: Region[];
  statuses: Record<string, RegionStatus>;
}) {
  const router = useRouter();
  const allToggle = useRef<HTMLInputElement>(null);
  const [actionId, setActionId] = useState(actions[0].id);
  const [query, setQuery] = useState("");
  const [force, setForce] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pausing, setPausing] = useState(false);
  const pauseRequested = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

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

  const action = actions.find((candidate) => candidate.id === actionId)!;

  /** Sends the session's remaining regions in batches, until it finishes, is paused, or a batch fails. */
  async function process(start: Session) {
    const { action } = start;
    let { remaining } = start;
    // A failure from before is either resolved by trying again, or skipped.
    let result: Result = {
      ...start.result,
      failure: undefined,
      error: undefined,
    };
    pauseRequested.current = false;
    setPausing(false);
    setAlert(null);
    setSession(start);
    setPhase("running");

    while (remaining.length > 0) {
      const batch = remaining.slice(0, batchSize);
      let next: Result;
      try {
        const response = await fetch(action.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regionCodes: batch,
            ...(start.force && { force: true }),
          }),
        });
        next = (await response.json()) as Result;
      } catch {
        setSession({ ...start, remaining, result });
        setAlert("Could not reach the server.");
        setPhase("stopped");
        return;
      }

      result = mergeResults(result, next);
      router.refresh();

      if (next.error || next.failure) {
        // Resume from the region that failed. Without one, nothing in the batch was handled.
        const failedAt = remaining.indexOf(next.failure?.regionCode ?? "");
        remaining = remaining.slice(Math.max(failedAt, 0));
        setSession({ ...start, remaining, result });
        setAlert(action.describe(result, regions));
        setPhase("stopped");
        return;
      }

      remaining = remaining.slice(batch.length);
      setSession({ ...start, remaining, result });
      if (pauseRequested.current && remaining.length > 0) {
        setPhase("paused");
        return;
      }
    }

    setSession(null);
    setPhase("idle");
    report(action, result, start.skipped);
  }

  /** The toast says what worked, and the alert, if anything was skipped, says which regions weren't. */
  function report(action: Action, result: Result, skipped: string[]) {
    setToast(
      action.describe(
        { ...result, failure: undefined, error: undefined },
        regions,
      ),
    );
    setAlert(skipped.length > 0 ? skippedMessage(skipped) : null);
  }

  function skippedMessage(codes: string[]) {
    const names = codes.map(
      (code) => regions.find((region) => region.code === code)?.name ?? code,
    );
    const shown = names.slice(0, maxSkippedNames);
    const more = names.length - shown.length;
    return `Skipped ${more > 0 ? `${shown.join(", ")} and ${more} more` : new Intl.ListFormat("en-GB").format(shown)}.`;
  }

  function begin() {
    // In the order the server handles regions, so a failure's region marks where to resume.
    const codes = regions
      .filter((region) => selected.has(region.code))
      .map((region) => region.code);
    void process({
      action,
      force: action.supportsForce === true && force,
      remaining: codes,
      total: codes.length,
      skipped: [],
      result: {},
    });
  }

  function skip() {
    const code = session?.result.failure?.regionCode;
    if (!session || !code) return;
    void process({
      ...session,
      remaining: session.remaining.filter((remaining) => remaining !== code),
      skipped: [...session.skipped, code],
    });
  }

  function pause() {
    pauseRequested.current = true;
    setPausing(true);
  }

  function cancel() {
    if (session && session.remaining.length < session.total) {
      report(session.action, session.result, session.skipped);
    } else {
      setAlert(null);
    }
    setSession(null);
    setPhase("idle");
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = actions.findIndex((candidate) => candidate.id === actionId);
    const next = actions[(index + step + actions.length) % actions.length];
    setActionId(next.id);
    document.getElementById(`action-tab-${next.id}`)?.focus();
  }

  const count = selected.size;
  const done = session ? session.total - session.remaining.length : 0;
  const skippedNote = session?.skipped.length
    ? ` (${session.skipped.length} skipped)`
    : "";
  const confirmLabel = action.confirmLabel(
    regions.filter((region) => selected.has(region.code)),
  );

  return (
    <>
      <div
        role="tablist"
        aria-label="Action"
        className="mb-3 flex flex-none gap-1 border-b border-edge"
      >
        {actions.map((candidate) => {
          const active = candidate.id === actionId;
          return (
            <button
              key={candidate.id}
              id={`action-tab-${candidate.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="action-panel"
              tabIndex={active ? 0 : -1}
              disabled={session !== null}
              className={`-mb-px cursor-pointer border-b-2 px-3 py-2 font-semibold disabled:cursor-not-allowed ${active ? "border-accent text-fg" : "border-transparent text-fg-muted enabled:hover:text-fg"}`}
              onClick={() => setActionId(candidate.id)}
              onKeyDown={onTabKeyDown}
            >
              {candidate.label}
            </button>
          );
        })}
      </div>
      <p
        id="action-panel"
        role="tabpanel"
        aria-labelledby={`action-tab-${action.id}`}
        className="mb-4 flex-none text-fg-muted"
      >
        {action.description}
      </p>

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
          {action.supportsForce && (
            <label className="flex cursor-pointer items-center gap-2 text-fg">
              <input
                className="size-4 accent-accent"
                type="checkbox"
                checked={force}
                disabled={session !== null}
                onChange={(event) => setForce(event.target.checked)}
              />
              <span>Force import</span>
            </label>
          )}
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
                  <span className="min-w-0 truncate">{region.name}</span>
                  <span className="ml-auto flex-none text-[0.75rem] text-fg-faint">
                    {songsText(statuses[region.code])}
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

      {alert && (
        <div
          className="mb-3 flex flex-none items-center gap-3 rounded-lg border border-danger-edge bg-danger-surface px-4 py-[0.8rem] text-sm/[1.4] text-danger"
          role="alert"
        >
          <span className="min-w-0">{alert}</span>
          <button
            type="button"
            className="ml-auto flex-none cursor-pointer p-0 text-[1.25rem] leading-none opacity-85 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => setAlert(null)}
          >
            &times;
          </button>
        </div>
      )}

      {session && (
        <p
          className="mb-3 flex-none text-center text-sm text-fg-muted"
          role="status"
        >
          {phase === "running"
            ? `${session.action.busyLabel} ${done} of ${session.total} regions${skippedNote}`
            : `${phase === "paused" ? "Paused" : "Stopped"} - ${done} of ${session.total} regions done${skippedNote}`}
        </p>
      )}

      {session ? (
        <div className="flex flex-none gap-3">
          {phase === "running" ? (
            <button
              type="button"
              className={`${secondaryButtonClass} w-full`}
              disabled={pausing}
              onClick={pause}
            >
              {pausing ? "Pausing..." : "Pause"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${primaryButtonClass} flex-1`}
                onClick={() => void process(session)}
              >
                Resume
              </button>
              {phase === "stopped" && session.result.failure?.regionCode && (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={skip}
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={cancel}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`${primaryButtonClass} w-full`}
          disabled={count === 0}
          onClick={begin}
        >
          {confirmLabel}
        </button>
      )}

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
