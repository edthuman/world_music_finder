"use client";

import { useEffect, useRef } from "react";

export default function RegionModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // Not closed on cleanup: that would fire onClose and clear the selection under StrictMode
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

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
      <div className="relative grid gap-1 py-5 pr-12 pl-5">
        <h2 id="region-modal-title" className="text-xl font-bold">
          {name}
        </h2>
        <button
          type="button"
          className="absolute top-3 right-4 cursor-pointer text-[1.25rem]"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          x
        </button>
      </div>
    </dialog>
  );
}
