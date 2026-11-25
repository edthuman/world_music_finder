export type SpotifyFailure = {
  regionCode?: string;
  status: number;
  message: string;
};

const spotifyApi = "https://api.spotify.com/v1";
const maxRateLimitRetries = 3;
const libraryCheckBatchSize = 40;

export async function spotifyRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${spotifyApi}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (response.status !== 429 || attempt >= maxRateLimitRetries) {
      return response;
    }
    const retryAfter = Number(response.headers.get("Retry-After")) || 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  }
}

export async function failureFrom(
  response: Response,
  regionCode?: string,
): Promise<SpotifyFailure> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  const failure = {
    regionCode,
    status: response.status,
    message: body?.error?.message ?? response.statusText,
  };
  console.error("Spotify request failed", failure);
  return failure;
}

/** Which of the given playlists are still in the user's Spotify library. A deleted playlist is not. */
export async function playlistsInLibrary(
  accessToken: string,
  playlistIds: string[],
) {
  const inLibrary = new Set<string>();

  for (
    let start = 0;
    start < playlistIds.length;
    start += libraryCheckBatchSize
  ) {
    const batch = playlistIds.slice(start, start + libraryCheckBatchSize);
    const uris = batch
      .map((id) => encodeURIComponent(`spotify:playlist:${id}`))
      .join(",");
    const response = await spotifyRequest(
      accessToken,
      `/me/library/contains?uris=${uris}`,
    );
    if (!response.ok) return { failure: await failureFrom(response) };

    const results = (await response.json()) as boolean[];
    if (results.length !== batch.length) {
      console.error(
        `Library check returned ${results.length} results for ${batch.length} playlists`,
      );
      return {
        failure: {
          status: 502,
          message: "Spotify returned an unexpected library check result",
        },
      };
    }
    batch.forEach((id, index) => {
      if (results[index]) inLibrary.add(id);
    });
  }

  return { inLibrary };
}
