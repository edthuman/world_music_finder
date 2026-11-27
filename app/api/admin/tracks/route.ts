import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/admin";
import { parseRegionCodes } from "@/lib/regions";
import { importRegionTracks } from "@/lib/tracks";

export async function POST(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    regionCodes?: unknown;
    force?: unknown;
  } | null;
  const selected = parseRegionCodes(body?.regionCodes);
  if (!selected) {
    return NextResponse.json(
      { error: "Select at least one valid region" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await importRegionTracks({
        accessToken: admin.accessToken,
        userId: admin.userId,
        regionCodes: selected,
        force: body?.force === true,
      }),
    );
  } catch (error) {
    console.error("Could not import region tracks", error);
    return NextResponse.json(
      { error: "Something went wrong importing the songs" },
      { status: 500 },
    );
  }
}
