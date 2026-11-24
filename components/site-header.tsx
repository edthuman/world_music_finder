import { Suspense } from "react";
import { cookies } from "next/headers";
import SettingsIcon from "@/components/settings-icon";
import SiteTitle from "@/components/site-title";
import SpotifyName from "@/components/spotify-name";
import { getAdmin } from "@/lib/admin";
import { spotifyCookies } from "@/lib/spotify";

async function SettingsLink() {
  if (!(await getAdmin())) return null;

  return (
    <a href="/settings" className="icon-button" aria-label="Settings">
      <SettingsIcon />
    </a>
  );
}

async function AuthButton() {
  const cookieStore = await cookies();
  const loggedIn = cookieStore.has(spotifyCookies.accessToken);

  return loggedIn ? (
    <div className="auth-actions">
      <Suspense>
        <SettingsLink />
      </Suspense>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="auth-button">
          Log out
        </button>
      </form>
    </div>
  ) : (
    <a href="/api/auth/login" className="auth-button">
      Log in with <SpotifyName />
    </a>
  );
}

export default function SiteHeader() {
  return (
    <header className="site-header">
      <SiteTitle />
      <Suspense>
        <AuthButton />
      </Suspense>
    </header>
  );
}
