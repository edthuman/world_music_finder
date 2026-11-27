"use client";

import { useEffect, useRef, useState } from "react";
import type { RandomTrack } from "@/lib/random-track";

type TrackState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; track: RandomTrack };

/** Square album artwork that fades in once loaded, and is left out if it is missing or fails to load. */
function Artwork({ url, alt }: { url: string; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  if (status === "failed") return null;

  return (
    <div className="mb-2 size-56 overflow-hidden rounded-[0.3rem] bg-ink/8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={`size-full object-cover transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
      />
    </div>
  );
}

export default function RegionModal({
  name,
  code,
  onClose,
}: {
  name: string;
  code: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<TrackState>({ status: "loading" });

  useEffect(() => {
    // Not closed on cleanup: that would fire onClose and clear the selection under StrictMode
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/regions/${code}/random-track`, { signal: controller.signal })
      .then(async (response): Promise<TrackState> => {
        if (response.status === 404) return { status: "empty" };
        if (!response.ok) return { status: "error" };
        return { status: "ready", track: await response.json() };
      })
      .catch((error): TrackState | undefined =>
        error instanceof DOMException && error.name === "AbortError"
          ? undefined
          : { status: "error" },
      )
      .then((next) => {
        if (next) setState(next);
      });
    return () => controller.abort();
  }, [code]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="region-modal-title"
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-[0.4rem] border border-ink/16 bg-white p-0 font-sans text-ink shadow-[0_3px_14px_rgba(20,39,31,0.14)] backdrop:bg-ink/40"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop is reported as a click on the dialog itself
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="relative grid gap-3 p-5">
        <h2 id="region-modal-title" className="pr-8 text-xl font-bold">
          {name}
        </h2>
        <div
          aria-live="polite"
          className="grid justify-items-center gap-1 py-3 text-center text-sm/[1.4]"
        >
          {state.status === "loading" && (
            <p className="text-ink-muted">Finding a song…</p>
          )}
          {state.status === "empty" && (
            <p className="text-ink-muted">No songs for this region yet</p>
          )}
          {state.status === "error" && (
            <p className="text-ink-muted">
              Something went wrong - please try again later
            </p>
          )}
          {state.status === "ready" && (
            <>
              {state.track.imageUrl && (
                <Artwork
                  key={state.track.imageUrl}
                  url={state.track.imageUrl}
                  alt={`Album artwork for ${state.track.name}`}
                />
              )}
              <strong className="text-xl">{state.track.name}</strong>
              <span className="text-base text-ink-muted">
                {state.track.artists}
              </span>
              <a
                href={state.track.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 w-fit rounded-full border border-ink px-4 py-2 font-bold text-ink hover:bg-ink/8"
              >
                Open in Spotify
              </a>
            </>
          )}
        </div>
        <button
          type="button"
          className="absolute top-2 right-4 cursor-pointer text-[1.25rem]"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          &times;
        </button>
      </div>
    </dialog>
  );
}
