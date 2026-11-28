import { tracks } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Removes every saved song, so each test starts from an empty database. */
export async function clearTracks() {
  await getDb().delete(tracks);
}

/** Saves `count` fixture songs for a region, numbered from 1. Returns their Spotify IDs. */
export async function seedTracks(regionCode: string, count: number) {
  if (count === 0) return [];
  const rows = Array.from({ length: count }, (_, index) => ({
    spotifyTrackId: `${regionCode}-track-${index + 1}`,
    regionCode,
    name: `${regionCode} song ${index + 1}`,
    artists: `${regionCode} artist ${index + 1}`,
    isrc: `${regionCode}ISRC${index + 1}`,
    imageUrl: null,
  }));
  await getDb().insert(tracks).values(rows);
  return rows.map((row) => row.spotifyTrackId);
}
