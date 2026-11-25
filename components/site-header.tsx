import { Suspense } from "react";
import { cookies } from "next/headers";
import HideOnSettings from "@/components/hide-on-settings";
import SettingsIcon from "@/components/settings-icon";
import SiteTitle from "@/components/site-title";
import SpotifyName from "@/components/spotify-name";
import { getAdmin } from "@/lib/admin";
import { spotifyCookies } from "@/lib/spotify";

const authButtonClass =
  "cursor-pointer rounded-full bg-spotify px-[0.9rem] py-2 font-semibold text-white hover:bg-spotify-hover disabled:cursor-default disabled:opacity-60";

async function SettingsLink() {
  if (!(await getAdmin())) return null;

  return (
    <a
      href="/settings"
      className="grid size-[2.1rem] place-items-center rounded-full text-ink hover:bg-ink/8 settings:text-fg settings:hover:bg-fg/8"
      aria-label="Settings"
    >
      <SettingsIcon />
    </a>
  );
}

async function AuthButton() {
  const cookieStore = await cookies();
  const loggedIn = cookieStore.has(spotifyCookies.accessToken);

  return loggedIn ? (
    <div className="flex items-center gap-2">
      <HideOnSettings>
        <Suspense>
          <SettingsLink />
        </Suspense>
      </HideOnSettings>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className={authButtonClass}>
          Log out
        </button>
      </form>
    </div>
  ) : (
    <a href="/api/auth/login" className={authButtonClass}>
      Log in with <SpotifyName />
    </a>
  );
}

export default function SiteHeader() {
  return (
    <header className="z-3 flex h-13 flex-none items-center justify-between border-b border-ink/16 bg-white px-5 font-sans text-sm/none text-ink settings:border-edge settings:bg-surface settings:text-fg">
      <SiteTitle />
      <Suspense>
        <AuthButton />
      </Suspense>
    </header>
  );
}
