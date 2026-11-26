import { count, eq } from "drizzle-orm";
import { playlists, tracks } from "@/db/schema";
import { getDb } from "@/lib/db";

export type RegionStatus = {
  /** Playlists the user has saved for the region, including ones since deleted from Spotify. */
  playlists: number;
  tracks: number;
};

/** What the database holds for each region, keyed by region code. Regions with nothing saved are absent. */
export async function getRegionStatuses(userId: string) {
  const db = getDb();
  const [playlistRows, trackRows] = await Promise.all([
    db
      .select({ regionCode: playlists.regionCode, playlists: count() })
      .from(playlists)
      .where(eq(playlists.ownerSpotifyUserId, userId))
      .groupBy(playlists.regionCode),
    db
      .select({ regionCode: tracks.regionCode, tracks: count() })
      .from(tracks)
      .groupBy(tracks.regionCode),
  ]);

  const statuses: Record<string, RegionStatus> = {};
  for (const row of playlistRows) {
    statuses[row.regionCode] = { playlists: row.playlists, tracks: 0 };
  }
  for (const row of trackRows) {
    statuses[row.regionCode] ??= { playlists: 0, tracks: 0 };
    statuses[row.regionCode].tracks = row.tracks;
  }
  return statuses;
}
