import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test } from "vitest";
import { GET } from "@/app/api/regions/[code]/random-track/route";
import { clearTracks, seedTracks } from "./helpers";

function getRandomTrack(code: string) {
  return GET(
    new NextRequest(`http://localhost/api/regions/${code}/random-track`),
    { params: Promise.resolve({ code }) },
  );
}

describe("GET /api/regions/[code]/random-track", () => {
  beforeEach(clearTracks);

  test("returns 404 for a region code that isn't on the map", async () => {
    const response = await getRandomTrack("RANDOM");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Unknown region" });
  });

  test("returns 404 for a region with no songs", async () => {
    const response = await getRandomTrack("FRA");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No songs for this region yet",
    });
  });

  test("returns a song for a region that has some, without caching it", async () => {
    await seedTracks("FRA", 1);

    const response = await getRandomTrack("FRA");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      name: "FRA song 1",
      artists: "FRA artist 1",
      spotifyUrl: "https://open.spotify.com/track/FRA-track-1",
      imageUrl: null,
    });
  });
});
