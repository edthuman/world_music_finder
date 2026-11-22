import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { adminUserIdFor } from "@/lib/admin";
import {
  includesAdminScopes,
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
  const returnTo = cookieStore.get(spotifyCookies.returnTo)?.value;
  cookieStore.delete(spotifyCookies.returnTo);

  const home = new URL("/", redirectUri);
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

  // Admins go straight on to grant the playlist permissions, unless they have just done that.
  const wasAdminLogin = returnTo !== undefined;
  if (
    !wasAdminLogin &&
    !includesAdminScopes(tokens.scope ?? "") &&
    (await adminUserIdFor(tokens.access_token))
  ) {
    return NextResponse.redirect(
      new URL("/api/auth/login?scope=admin", redirectUri),
    );
  }

  return NextResponse.redirect(
    returnTo === "/settings" ? new URL("/settings", redirectUri) : home,
  );
}
