import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/admin";
import { createRegionPlaylists } from "@/lib/playlists";
import { parseRegionCodes } from "@/lib/regions";

export async function POST(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    regionCodes?: unknown;
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
      await createRegionPlaylists({
        accessToken: admin.accessToken,
        userId: admin.userId,
        regionCodes: selected,
      }),
    );
  } catch (error) {
    console.error("Could not create region playlists", error);
    return NextResponse.json(
      { error: "Something went wrong creating the playlists" },
      { status: 500 },
    );
  }
}
