import { cookies } from "next/headers";
import { refreshAccessToken } from "@/lib/spotify";

export async function POST() {
  const refreshed = await refreshAccessToken(await cookies());
  return new Response(null, { status: refreshed ? 204 : 401 });
}
