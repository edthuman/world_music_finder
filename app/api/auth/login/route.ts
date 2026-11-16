import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  secureCookies,
  spotifyCookies,
  spotifyEnv,
  spotifyScopes,
} from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const { clientId, redirectUri } = spotifyEnv();
  const cookieStore = await cookies();

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
