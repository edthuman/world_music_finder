export const spotifyCookies = {
  state: "spotify_auth_state",
  accessToken: "spotify_access_token",
  refreshToken: "spotify_refresh_token",
  scope: "spotify_scope",
  returnTo: "spotify_auth_return_to",
} as const;

// Everyone logs in without scopes, which is enough to identify them.
export const userScopes: string[] = [];

// Admins grant these separately, from the settings page, to manage the playlists.
export const adminScopes: string[] = [
  "playlist-modify-private",
  "playlist-modify-public",
];

export function spotifyEnv() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET or SPOTIFY_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export const secureCookies = process.env.NODE_ENV === "production";

// The refresh token is only sent to the auth routes, not to every request.
export const refreshCookiePath = "/api/auth";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookies,
} as const;

export const accessCookieOptions = (maxAge: number) => ({
  ...baseCookieOptions,
  path: "/",
  maxAge,
});
export const refreshCookieOptions = {
  ...baseCookieOptions,
  path: refreshCookiePath,
  maxAge: 60 * 60 * 24 * 30,
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export async function requestTokens(
  body: Record<string, string>,
): Promise<TokenResponse | null> {
  const { clientId, clientSecret } = spotifyEnv();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  return response.ok ? ((await response.json()) as TokenResponse) : null;
}

type CookieStore = Awaited<ReturnType<typeof import("next/headers").cookies>>;

export function storeTokens(cookieStore: CookieStore, tokens: TokenResponse) {
  cookieStore.set(
    spotifyCookies.accessToken,
    tokens.access_token,
    accessCookieOptions(tokens.expires_in),
  );
  if (tokens.scope !== undefined) {
    cookieStore.set(
      spotifyCookies.scope,
      tokens.scope,
      accessCookieOptions(tokens.expires_in),
    );
  }
  if (tokens.refresh_token) {
    cookieStore.set(
      spotifyCookies.refreshToken,
      tokens.refresh_token,
      refreshCookieOptions,
    );
  }
}

/** Whether the current token was granted the scopes admins need to manage playlists. */
export function hasAdminScopes(cookieStore: CookieStore) {
  const granted = (cookieStore.get(spotifyCookies.scope)?.value ?? "").split(
    " ",
  );
  return adminScopes.every((scope) => granted.includes(scope));
}

/** Exchanges the stored refresh token for a new access token. Returns false if there is none or it was rejected. */
export async function refreshAccessToken(cookieStore: CookieStore) {
  const refreshToken = cookieStore.get(spotifyCookies.refreshToken)?.value;
  if (!refreshToken) return false;

  const tokens = await requestTokens({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (!tokens) {
    cookieStore.delete({
      name: spotifyCookies.refreshToken,
      path: refreshCookiePath,
    });
    return false;
  }
  storeTokens(cookieStore, tokens);
  return true;
}
