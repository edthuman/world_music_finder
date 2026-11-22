import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { refreshCookiePath, spotifyCookies, spotifyEnv } from "@/lib/spotify";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(spotifyCookies.accessToken);
  cookieStore.delete(spotifyCookies.scope);
  cookieStore.delete({
    name: spotifyCookies.refreshToken,
    path: refreshCookiePath,
  });
  return NextResponse.redirect(new URL("/", spotifyEnv().redirectUri), 303);
}
