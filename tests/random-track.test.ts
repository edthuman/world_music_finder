import { beforeEach, describe, expect, test } from "vitest";
import { getRandomTrack } from "@/lib/random-track";
import { clearTracks, seedTracks } from "./helpers";

describe("getRandomTrack", () => {
  beforeEach(clearTracks);

  test("returns null for a region with no songs", async () => {
    expect(await getRandomTrack("FRA")).toBeNull();
  });

  test("returns the song's details with a Spotify link", async () => {
    await seedTracks("FRA", 1);

    expect(await getRandomTrack("FRA")).toEqual({
      name: "FRA song 1",
      artists: "FRA artist 1",
      spotifyUrl: "https://open.spotify.com/track/FRA-track-1",
      imageUrl: null,
    });
  });

  test("only returns songs saved for the requested region", async () => {
    await seedTracks("FRA", 5);
    await seedTracks("JPN", 5);

    for (let attempt = 0; attempt < 20; attempt++) {
      const track = await getRandomTrack("JPN");
      expect(track?.name).toMatch(/^JPN song/);
    }
  });

  test("can return every song in the region", async () => {
    await seedTracks("FRA", 3);

    const seen = new Set<string>();
    for (let attempt = 0; attempt < 100 && seen.size < 3; attempt++) {
      seen.add((await getRandomTrack("FRA"))!.name);
    }
    expect(seen.size).toBe(3);
  });
});
