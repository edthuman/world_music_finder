import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import PlaylistManager from "@/components/playlist-manager";
import { getAdmin } from "@/lib/admin";
import { regions } from "@/lib/regions";
import { hasAdminScopes } from "@/lib/spotify";

const contentClass =
  "mx-auto mt-4 flex min-h-0 w-full max-w-xl flex-1 flex-col";
const paragraphClass = "mb-4 flex-none text-fg-muted";

async function SettingsContent() {
  if (!(await getAdmin())) redirect("/");

  if (!hasAdminScopes(await cookies())) {
    return (
      <div className={contentClass}>
        <p className={paragraphClass}>
          As an admin for World Music Finder, you have the ability to update the
          playlists for regions on the map. In order to do so, you need to grant
          permission for World Music Finder to read and edit Spotify playlists
          on your behalf. Only playlists created by World Music Finder will be
          edited.
        </p>
        <a
          href="/api/auth/login?scope=admin&returnTo=/settings"
          className="block w-full flex-none cursor-pointer rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white enabled:hover:bg-accent-hover"
        >
          Grant playlist permissions
        </a>
      </div>
    );
  }

  return (
    <div className={contentClass}>
      <p className={paragraphClass}>
        Creates a Spotify playlist named after each selected region that you do
        not already have a playlist for. If a playlist has been deleted, a new
        one will be created.
      </p>
      <PlaylistManager regions={regions} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="settings-page flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 pb-5 font-sans text-base/normal text-fg">
      <Link
        href="/"
        className="inline-flex flex-none self-start rounded-full border border-edge px-[0.8rem] py-[0.4rem] text-sm/normal text-fg-muted hover:bg-fg/6 hover:text-fg"
      >
        &larr; Back to map
      </Link>
      <Suspense
        fallback={
          <div
            className={`${contentClass} items-center justify-center`}
            role="status"
            aria-label="Loading"
          >
            <span className="size-7 animate-spinner rounded-full border-3 border-edge border-t-accent opacity-0" />
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </main>
  );
}
