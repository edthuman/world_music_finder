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
  /** Regions where the user had no saved playlist, so a new one was created. */
  created: string[];
  /** Regions where all of the user's saved playlists were gone from their library, so a new one was created. */
  replaced: string[];
  /** Regions where the user still has a saved playlist, so none was created. */
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
const libraryCheckBatchSize = 40;

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

/** Which of the given playlists are still in the user's Spotify library. A deleted playlist is not. */
async function playlistsInLibrary(accessToken: string, playlistIds: string[]) {
  const inLibrary = new Set<string>();

  for (
    let start = 0;
    start < playlistIds.length;
    start += libraryCheckBatchSize
  ) {
    const batch = playlistIds.slice(start, start + libraryCheckBatchSize);
    const uris = batch
      .map((id) => encodeURIComponent(`spotify:playlist:${id}`))
      .join(",");
    const response = await spotifyRequest(
      accessToken,
      `/me/library/contains?uris=${uris}`,
    );
    if (!response.ok) return { failure: await failureFrom(response) };

    const results = (await response.json()) as boolean[];
    if (results.length !== batch.length) {
      return {
        failure: {
          status: 502,
          message: "Spotify returned an unexpected library check result",
        },
      };
    }
    batch.forEach((id, index) => {
      if (results[index]) inLibrary.add(id);
    });
  }

  return { inLibrary };
}

/**
 * Creates a private playlist named after each selected region where the user has no saved playlist still
 * in their Spotify library, and saves it to the database. Deleted playlists stay saved as history. Other
 * admins' playlists don't count. Stops at the first failure.
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
  const result: CreatePlaylistsResult = {
    created: [],
    replaced: [],
    existing: [],
  };

  const selected = regions.filter((region) =>
    regionCodes.includes(region.code),
  );
  const saved = await db
    .select({
      regionCode: playlists.regionCode,
      spotifyPlaylistId: playlists.spotifyPlaylistId,
    })
    .from(playlists)
    .where(
      and(
        inArray(playlists.regionCode, regionCodes),
        eq(playlists.ownerSpotifyUserId, userId),
      ),
    );

  // Check everything before creating anything, so a failed check can't lead to duplicates.
  const library = await playlistsInLibrary(
    accessToken,
    saved.map((row) => row.spotifyPlaylistId),
  );
  if (!library.inLibrary) return { ...result, failure: library.failure };

  for (const region of selected) {
    const rows = saved.filter((row) => row.regionCode === region.code);
    if (rows.some((row) => library.inLibrary.has(row.spotifyPlaylistId))) {
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
    (rows.length > 0 ? result.replaced : result.created).push(region.code);
  }

  return result;
}
