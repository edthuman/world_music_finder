import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import PlaylistManager from "@/components/playlist-manager";
import { getAdmin } from "@/lib/admin";
import { regions } from "@/lib/regions";
import { hasAdminScopes } from "@/lib/spotify";

async function SettingsContent() {
  if (!(await getAdmin())) redirect("/");

  if (!hasAdminScopes(await cookies())) {
    return (
      <div className="settings-content">
        <p>
          As an admin for World Music Finder, you have the ability to update the
          playlists for regions on the map. In order to do so, you need to grant
          permission for World Music Finder to read and edit Spotify playlists
          on your behalf. Only playlists created by World Music Finder will be
          edited.
        </p>
        <a
          href="/api/auth/login?scope=admin&returnTo=/settings"
          className="primary-button primary-link"
        >
          Grant playlist permissions
        </a>
      </div>
    );
  }

  return (
    <div className="settings-content">
      <p>
        Creates a Spotify playlist named after each selected region. Regions
        that already have a saved playlist are skipped.
      </p>
      <PlaylistManager regions={regions} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="settings-page">
      <Link href="/" className="back-link">
        &larr; Back to map
      </Link>
      <Suspense>
        <SettingsContent />
      </Suspense>
    </main>
  );
}
