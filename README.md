# World Music Finder

World Music Finder is an interactive map for discovering music connected to countries, linking to users' Spotify accounts to let them save songs and add them to their playlists.

## Built with

- Next.js and React
- MapLibre GL JS, using the MapLibre World style and locally bundled vector tiles

## Spotify setup

Spotify may require a Premium account to create an app and use the Web API in development mode, so check the current [Spotify Developer Docs](https://developer.spotify.com/documentation/web-api) before you start. You'll need this for the Spotify features that support core features for World Music Finder.

Follow the instructions in the [Spotify Developer Docs](https://developer.spotify.com/documentation/web-api) to create a Web API app in the Spotify for Developers platform.

When asked to set a redirect URI, for local development you should set it to `http://127.0.0.1:3000/api/auth/callback`, since Spotify doesn't allow `localhost` to be used.

Once you have created the app, open its **Settings** to find the **client ID** and **client secret**. Save these to a `.env` file - you can create one by running:

```bash
cp .env.example .env
```

Once you've finished, the `.env` should look like the below.

```
SPOTIFY_CLIENT_ID=<your client ID>
SPOTIFY_CLIENT_SECRET=<your client secret>
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
```

Keep your client secret private. `.env` is gitignored, so don't commit it.

## Development

Start the development server:

```bash
npm run dev
```

Then open <http://127.0.0.1:3000>. Don't use `localhost`: the login cookie is set for the host you start on, so it would be lost when Spotify redirects back to `127.0.0.1`.

In IDEs that read `.vscode/launch.json`, such as VSCode, you can instead run the **Open site** debug compound. It starts the dev server and launches Chrome at `http://127.0.0.1:3000` with the debugger attached.

## Checks

Run ESLint:

```bash
npm run lint
```

Run the TypeScript check:

```bash
npx tsc --noEmit
```
