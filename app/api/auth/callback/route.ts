import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  requestTokens,
  spotifyCookies,
  spotifyEnv,
  storeTokens,
} from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const { redirectUri } = spotifyEnv();
  const params = request.nextUrl.searchParams;
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(spotifyCookies.state)?.value;
  cookieStore.delete(spotifyCookies.state);

  const home = new URL("/", request.url);
  const code = params.get("code");
  const fail = (reason: string) => {
    home.searchParams.set("auth_error", reason);
    return NextResponse.redirect(home);
  };
  const spotifyError = params.get("error");
  if (spotifyError) return fail(spotifyError);
  if (!code) return fail("missing_code");
  if (!expectedState) return fail("missing_state_cookie");
  if (params.get("state") !== expectedState) return fail("state_mismatch");

  const tokens = await requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  if (!tokens) return fail("token_exchange_failed");
  storeTokens(cookieStore, tokens);

  return NextResponse.redirect(home);
}
