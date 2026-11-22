import { inArray } from "drizzle-orm";
import { playlists } from "@/db/schema";
import { getDb } from "@/lib/db";
import { regions } from "@/lib/regions";

export type PlaylistVisibility = "private" | "public";

export type PlaylistFailure = {
  regionCode?: string;
  status: number;
  message: string;
};

export type CreatePlaylistsResult = {
  created: string[];
  /** Regions that already had a playlist saved in the database. */
  skipped: string[];
  /** Set if the run stopped early; regions after this one were not attempted. */
  failure?: PlaylistFailure;
};

type CreatedPlaylist = {
  id: string;
  public: boolean | null;
  snapshot_id: string;
};

const spotifyApi = "https://api.spotify.com/v1";
const description = "Created by World Music Finder";
const maxRateLimitRetries = 3;

async function spotifyRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${spotifyApi}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (response.status !== 429 || attempt >= maxRateLimitRetries) {
      return response;
    }
    const retryAfter = Number(response.headers.get("Retry-After")) || 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  }
}

async function failureFrom(
  response: Response,
  regionCode?: string,
): Promise<PlaylistFailure> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return {
    regionCode,
    status: response.status,
    message: body?.error?.message ?? response.statusText,
  };
}

/**
 * Creates a playlist named after each selected region that doesn't already have one saved, and saves it
 * to the database. Stops at the first failure.
 */
export async function createRegionPlaylists({
  accessToken,
  userId,
  visibility,
  regionCodes,
}: {
  accessToken: string;
  userId: string;
  visibility: PlaylistVisibility;
  regionCodes: string[];
}): Promise<CreatePlaylistsResult> {
  const db = getDb();
  const result: CreatePlaylistsResult = { created: [], skipped: [] };

  const selected = regions.filter((region) =>
    regionCodes.includes(region.code),
  );
  const saved = new Set(
    (
      await db
        .select({ regionCode: playlists.regionCode })
        .from(playlists)
        .where(inArray(playlists.regionCode, regionCodes))
    ).map((row) => row.regionCode),
  );
  const todo = selected.filter((region) => !saved.has(region.code));
  result.skipped = selected
    .filter((region) => saved.has(region.code))
    .map((region) => region.code);
  if (todo.length === 0) return result;

  for (const region of todo) {
    const response = await spotifyRequest(accessToken, "/me/playlists", {
      method: "POST",
      body: JSON.stringify({
        name: region.name,
        description,
        public: visibility === "public",
      }),
    });
    if (!response.ok) {
      return { ...result, failure: await failureFrom(response, region.code) };
    }
    const playlist = (await response.json()) as CreatedPlaylist;

    try {
      await db.insert(playlists).values({
        regionCode: region.code,
        spotifyPlaylistId: playlist.id,
        ownerSpotifyUserId: userId,
        isPublic: playlist.public ?? visibility === "public",
        snapshotId: playlist.snapshot_id,
      });
    } catch (error) {
      console.error(`Could not save the playlist for ${region.code}`, error);
      return {
        ...result,
        failure: {
          regionCode: region.code,
          status: 500,
          message: "The playlist was made on Spotify but could not be saved",
        },
      };
    }
    result.created.push(region.code);
  }

  return result;
}
