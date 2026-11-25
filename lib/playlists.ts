import { and, eq, inArray } from "drizzle-orm";
import { playlists } from "@/db/schema";
import { getDb } from "@/lib/db";
import { regions } from "@/lib/regions";
import {
  failureFrom,
  playlistsInLibrary,
  spotifyRequest,
  type SpotifyFailure,
} from "@/lib/spotify-api";

export type CreatePlaylistsResult = {
  /** Regions where the user had no saved playlist, so a new one was created. */
  created: string[];
  /** Regions where all of the user's saved playlists were gone from their library, so a new one was created. */
  replaced: string[];
  /** Regions where the user still has a saved playlist, so none was created. */
  existing: string[];
  /** Set if the run stopped early; regions after this one were not attempted. */
  failure?: SpotifyFailure;
};

type CreatedPlaylist = {
  id: string;
  snapshot_id: string;
};

const description = "Created by World Music Finder";

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
