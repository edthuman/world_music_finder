import { Suspense } from "react";
import SpotifyName from "@/components/spotify-name";

async function AuthButton() {
  return (
    <a href="/api/auth/login" className="auth-button">
      Log in with <SpotifyName />
    </a>
  )
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
