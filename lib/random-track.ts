import { eq, sql } from "drizzle-orm";
import { tracks } from "@/db/schema";
import { getDb } from "@/lib/db";

export type RandomTrack = {
  name: string;
  artists: string;
  spotifyUrl: string;
};

/** A random song saved for the region, or null if it has none. */
export async function getRandomTrack(
  regionCode: string,
): Promise<RandomTrack | null> {
  const [track] = await getDb()
    .select({
      spotifyTrackId: tracks.spotifyTrackId,
      name: tracks.name,
      artists: tracks.artists,
    })
    .from(tracks)
    .where(eq(tracks.regionCode, regionCode))
    .orderBy(sql`random()`)
    .limit(1);
  if (!track) return null;

  return {
    name: track.name,
    artists: track.artists,
    spotifyUrl: `https://open.spotify.com/track/${track.spotifyTrackId}`,
  };
}
