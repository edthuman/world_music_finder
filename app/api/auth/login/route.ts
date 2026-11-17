import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  refreshAccessToken,
  secureCookies,
  spotifyCookies,
  spotifyEnv,
  spotifyScopes,
} from "@/lib/spotify";

export async function GET() {
  const { clientId, redirectUri } = spotifyEnv();
  const cookieStore = await cookies();

  // A valid refresh token means we can skip the Spotify round trip.
  if (await refreshAccessToken(cookieStore)) {
    return NextResponse.redirect(new URL("/", redirectUri));
  }

  const state = crypto.randomUUID();
  cookieStore.set(spotifyCookies.state, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    maxAge: 600,
    path: "/",
  });

  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: spotifyScopes.join(" "),
    state,
  }).toString();

  return NextResponse.redirect(url);
}
