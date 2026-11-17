import { Suspense } from "react";
import { cookies } from "next/headers";
import SpotifyName from "@/components/spotify-name";
import { spotifyCookies } from "@/lib/spotify";

async function AuthButton() {
  const cookieStore = await cookies();
  const loggedIn = cookieStore.has(spotifyCookies.accessToken);

  return loggedIn ? (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className="auth-button">
        Log out
      </button>
    </form>
  ) : (
    <a href="/api/auth/login" className="auth-button">
      Log in with <SpotifyName />
    </a>
  );
}

export default function SiteHeader() {
  return (
    <header className="site-header">
      <span className="site-title">World Music Finder</span>
      <Suspense>
        <AuthButton />
      </Suspense>
    </header>
  );
}
