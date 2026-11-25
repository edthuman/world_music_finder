import { cache } from "react";
import { cookies } from "next/headers";
import { spotifyCookies } from "@/lib/spotify";

function adminUserIds() {
  return (process.env.SPOTIFY_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Returns the user ID for an access token if they are an admin, otherwise null. The ID comes from
 * Spotify's `/me`, never a cookie, so it can't be forged.
 */
export async function adminUserIdFor(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const { id } = (await response.json()) as { id: string };
  return adminUserIds().includes(id) ? id : null;
}

/** Returns the access token and user ID of the logged-in user if they are an admin, otherwise null. */
export const getAdmin = cache(async () => {
  const accessToken = (await cookies()).get(spotifyCookies.accessToken)?.value;
  if (!accessToken) return null;

  const userId = await adminUserIdFor(accessToken);
  return userId ? { accessToken, userId } : null;
});
