import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/admin";
import {
  adminScopes,
  refreshAccessToken,
  secureCookies,
  spotifyCookies,
  spotifyEnv,
  userScopes,
} from "@/lib/spotify";

const shortLivedCookie = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookies,
  maxAge: 600,
  path: "/",
} as const;

export async function GET(request: NextRequest) {
  const { clientId, redirectUri } = spotifyEnv();
  const cookieStore = await cookies();

  // Only a logged-in admin can ask for the extra playlist permissions.
  const asAdmin =
    request.nextUrl.searchParams.get("scope") === "admin" &&
    (await getAdmin()) !== null;

  // A valid refresh token means we can skip the Spotify round trip, unless new scopes are needed.
  if (!asAdmin && (await refreshAccessToken(cookieStore))) {
    return NextResponse.redirect(new URL("/", redirectUri));
  }

  const state = crypto.randomUUID();
  cookieStore.set(spotifyCookies.state, state, shortLivedCookie);
  if (asAdmin) {
    cookieStore.set(spotifyCookies.returnTo, "/settings", shortLivedCookie);
  }

  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: (asAdmin ? adminScopes : userScopes).join(" "),
    state,
  }).toString();

  return NextResponse.redirect(url);
}
