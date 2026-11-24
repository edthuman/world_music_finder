import { and, eq, inArray } from "drizzle-orm";
import { playlists } from "@/db/schema";
import { getDb } from "@/lib/db";
import { regions } from "@/lib/regions";

export type PlaylistFailure = {
  regionCode?: string;
  status: number;
  message: string;
};

export type CreatePlaylistsResult = {
  created: string[];
  /** Regions where the user already had a saved playlist, so none was created. */
  existing: string[];
  /** Set if the run stopped early; regions after this one were not attempted. */
  failure?: PlaylistFailure;
};

type CreatedPlaylist = {
  id: string;
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
 * Creates a private playlist named after each selected region that the user has no saved playlist for,
 * and saves it to the database. Other admins' playlists don't count, and existing playlists are not
 * touched. Stops at the first failure.
 */
export async function createRegionPlaylists({
  accessToken,
  userId,
  regionCodes,
}: {
  accessToken: string;
  userId: string;
  regionCodes: string[];
}): Promise<CreatePlaylistsResult> {
  const db = getDb();
  const result: CreatePlaylistsResult = { created: [], existing: [] };

  const selected = regions.filter((region) =>
    regionCodes.includes(region.code),
  );
  const owned = new Set(
    (
      await db
        .select({ regionCode: playlists.regionCode })
        .from(playlists)
        .where(
          and(
            inArray(playlists.regionCode, regionCodes),
            eq(playlists.ownerSpotifyUserId, userId),
          ),
        )
    ).map((row) => row.regionCode),
  );

  for (const region of selected) {
    if (owned.has(region.code)) {
      result.existing.push(region.code);
      continue;
    }

    const response = await spotifyRequest(accessToken, "/me/playlists", {
      method: "POST",
      body: JSON.stringify({
        name: region.name,
        description,
        public: false,
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
