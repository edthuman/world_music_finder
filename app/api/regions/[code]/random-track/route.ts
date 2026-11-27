import { NextResponse, type NextRequest } from "next/server";
import { getRandomTrack } from "@/lib/random-track";
import { regionCodes } from "@/lib/regions";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/regions/[code]/random-track">,
) {
  const { code } = await ctx.params;
  if (!regionCodes.has(code)) {
    return NextResponse.json({ error: "Unknown region" }, { status: 404 });
  }

  try {
    const track = await getRandomTrack(code);
    if (!track) {
      return NextResponse.json(
        { error: "No songs for this region yet" },
        { status: 404 },
      );
    }
    return NextResponse.json(track, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(`Could not get a random song for ${code}`, error);
    return NextResponse.json(
      { error: "Something went wrong getting a song for this region" },
      { status: 500 },
    );
  }
}
