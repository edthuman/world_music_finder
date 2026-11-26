import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { playlists, tracks } from "@/db/schema";
import { getDb } from "@/lib/db";
import { regions } from "@/lib/regions";
import {
  failureFrom,
  playlistsInLibrary,
  spotifyRequest,
  type SpotifyFailure,
} from "@/lib/spotify-api";

export type ImportTracksResult = {
  /** Regions whose playlist was read and saved. */
  imported: string[];
  /** Regions where the playlist is unchanged since it was last imported. */
  unchanged: string[];
  /** Regions where none of the user's saved playlists are still in their library, so nothing was read. */
  noPlaylist: string[];
  /** Songs saved that were not saved before. */
  added: number;
  /** Songs deleted because they are no longer in any of the region's playlists. */
  removed: number;
  /** Songs skipped because the same recording is already saved for the same region. */
  duplicates: number;
  /** Set if the run stopped early; regions after this one were not attempted. */
  failure?: SpotifyFailure;
};

type PlaylistMeta = {
  snapshot_id: string;
  items: { total: number };
};

type PlaylistEntry = {
  is_local?: boolean;
  item: {
    id: string | null;
    type: string;
    name: string;
    explicit: boolean;
    is_local?: boolean;
    artists?: { name: string }[];
    external_ids?: { isrc?: string };
  } | null;
};

type Song = {
  spotifyTrackId: string;
  name: string;
  artists: string;
  isrc: string | null;
  explicit: boolean;
};

const pageSize = 50;
const writeBatchSize = 1000;

function* batches<T>(items: T[]) {
  for (let start = 0; start < items.length; start += writeBatchSize) {
    yield items.slice(start, start + writeBatchSize);
  }
}

function normaliseIsrc(isrc?: string) {
  return isrc?.replaceAll("-", "").toUpperCase() || null;
}

/** Reads every song in a playlist, skipping local files, episodes and removed entries. */
async function readSongs(
  accessToken: string,
  playlistId: string,
  total: number,
) {
  const songs: Song[] = [];
  let read = 0;

  while (read < total) {
    const response = await spotifyRequest(
      accessToken,
      `/playlists/${playlistId}/items?limit=${pageSize}&offset=${read}`,
    );
    if (!response.ok) return { failure: await failureFrom(response) };

    const { items } = (await response.json()) as { items: PlaylistEntry[] };
    if (items.length === 0) break;
    read += items.length;

    for (const { item, is_local } of items) {
      if (!item || item.type !== "track" || !item.id) continue;
      if (is_local || item.is_local) continue;
      songs.push({
        spotifyTrackId: item.id,
        name: item.name,
        artists: (item.artists ?? []).map((artist) => artist.name).join(", "),
        isrc: normaliseIsrc(item.external_ids?.isrc),
        explicit: item.explicit,
      });
    }
  }

  // A mismatch means the playlist changed while it was being read, so nothing from it is trusted.
  if (read !== total) {
    console.error(`Read ${read} items from a playlist holding ${total}`);
    return {
      failure: {
        status: 502,
        message: "Spotify returned a different number of songs than expected",
      },
    };
  }
  return { songs };
}

/** Makes a region's saved songs match the songs read from its playlist, in one transaction. */
async function saveRegionSongs(
  regionCode: string,
  songs: Song[],
  imported: { id: string; snapshotId: string },
) {
  return getDb().transaction(async (tx) => {
    const existing = await tx
      .select({ id: tracks.id, spotifyTrackId: tracks.spotifyTrackId })
      .from(tracks)
      .where(eq(tracks.regionCode, regionCode));
    const existingIds = new Set(existing.map((row) => row.spotifyTrackId));

    const ordered = [
      ...songs.filter((song) => existingIds.has(song.spotifyTrackId)),
      ...songs.filter((song) => !existingIds.has(song.spotifyTrackId)),
    ];
    const wanted: Song[] = [];
    const seenIds = new Set<string>();
    const seenIsrcs = new Set<string>();
    let duplicates = 0;
    for (const song of ordered) {
      if (
        seenIds.has(song.spotifyTrackId) ||
        (song.isrc && seenIsrcs.has(song.isrc))
      ) {
        duplicates++;
        continue;
      }
      seenIds.add(song.spotifyTrackId);
      if (song.isrc) seenIsrcs.add(song.isrc);
      wanted.push(song);
    }

    // Deleted before inserting, so a recording whose saved version was removed can be saved as another.
    const removeIds = existing
      .filter((row) => !seenIds.has(row.spotifyTrackId))
      .map((row) => row.id);
    for (const batch of batches(removeIds)) {
      await tx.delete(tracks).where(inArray(tracks.id, batch));
    }

    for (const batch of batches(wanted)) {
      await tx
        .insert(tracks)
        .values(batch.map((song) => ({ ...song, regionCode })))
        .onConflictDoUpdate({
          target: [tracks.regionCode, tracks.spotifyTrackId],
          set: {
            name: sql`excluded.name`,
            artists: sql`excluded.artists`,
            isrc: sql`excluded.isrc`,
            explicit: sql`excluded.explicit`,
          },
        });
    }

    await tx
      .update(playlists)
      .set({
        snapshotId: imported.snapshotId,
        lastSpotifyIngestionAt: new Date(),
      })
      .where(eq(playlists.id, imported.id));

    return {
      added: wanted.filter((song) => !existingIds.has(song.spotifyTrackId))
        .length,
      removed: removeIds.length,
      duplicates,
    };
  });
}

/**
 * Saves the songs in each selected region's newest playlist that is still in the user's library, and
 * deletes ones no longer in it. Stops at the first failure.
 */
export async function importRegionTracks({
  accessToken,
  userId,
  regionCodes,
}: {
  accessToken: string;
  userId: string;
  regionCodes: string[];
}): Promise<ImportTracksResult> {
  const db = getDb();
  const result: ImportTracksResult = {
    imported: [],
    unchanged: [],
    noPlaylist: [],
    added: 0,
    removed: 0,
    duplicates: 0,
  };

  const saved = await db
    .select({
      id: playlists.id,
      regionCode: playlists.regionCode,
      spotifyPlaylistId: playlists.spotifyPlaylistId,
      snapshotId: playlists.snapshotId,
      lastSpotifyIngestionAt: playlists.lastSpotifyIngestionAt,
    })
    .from(playlists)
    .where(
      and(
        inArray(playlists.regionCode, regionCodes),
        eq(playlists.ownerSpotifyUserId, userId),
      ),
    )
    .orderBy(desc(playlists.createdAt));

  const library = await playlistsInLibrary(
    accessToken,
    saved.map((row) => row.spotifyPlaylistId),
  );
  if (!library.inLibrary) return { ...result, failure: library.failure };

  for (const region of regions.filter((candidate) =>
    regionCodes.includes(candidate.code),
  )) {
    const playlist = saved.find(
      (row) =>
        row.regionCode === region.code &&
        library.inLibrary.has(row.spotifyPlaylistId),
    );
    if (!playlist) {
      result.noPlaylist.push(region.code);
      continue;
    }

    const response = await spotifyRequest(
      accessToken,
      `/playlists/${playlist.spotifyPlaylistId}?fields=snapshot_id,items.total`,
    );
    if (!response.ok) {
      return { ...result, failure: await failureFrom(response, region.code) };
    }
    const meta = (await response.json()) as PlaylistMeta;

    if (
      playlist.lastSpotifyIngestionAt &&
      playlist.snapshotId === meta.snapshot_id
    ) {
      result.unchanged.push(region.code);
      continue;
    }

    const read = await readSongs(
      accessToken,
      playlist.spotifyPlaylistId,
      meta.items.total,
    );
    if (!read.songs) {
      return {
        ...result,
        failure: { ...read.failure, regionCode: region.code },
      };
    }

    try {
      // The snapshot is the one read before the songs, so a change made mid-read is picked up next time.
      const saveResult = await saveRegionSongs(region.code, read.songs, {
        id: playlist.id,
        snapshotId: meta.snapshot_id,
      });
      result.added += saveResult.added;
      result.removed += saveResult.removed;
      result.duplicates += saveResult.duplicates;
    } catch (error) {
      console.error(`Could not save the songs for ${region.code}`, error);
      return {
        ...result,
        failure: {
          regionCode: region.code,
          status: 500,
          message: "The songs were read from Spotify but could not be saved",
        },
      };
    }
    result.imported.push(region.code);
  }

  return result;
}
