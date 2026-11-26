# World Music Finder

World Music Finder is an interactive map for discovering music connected to countries, linking to users' Spotify accounts to let them save songs and add them to their playlists.

## Built with

- Next.js and React
- PostgreSQL, accessed with Drizzle ORM
- MapLibre GL JS, using the MapLibre World style and locally bundled vector tiles

## Spotify setup

Spotify may require a Premium account to create an app and use the Web API in development mode, so check the current [Spotify Developer Docs](https://developer.spotify.com/documentation/web-api) before you start. You'll need this for the Spotify features that support core features for World Music Finder.

Follow the instructions in the [Spotify Developer Docs](https://developer.spotify.com/documentation/web-api) to create a Web API app in the Spotify for Developers platform.

When asked to set a redirect URI, for local development you should set it to `http://127.0.0.1:3000/api/auth/callback`, since Spotify doesn't allow `localhost` to be used.

While the app is in development mode, only the Spotify account that created the app in the Spotify for Developers platform and users added to the app under **User Management** may log in.

Once you have created the app, open its **Settings** to find the **client ID** and **client secret**. Save these to a `.env` file - you can create one by running:

```bash
cp .env.example .env
```

Once you've finished, the `.env` should look like the below.

```
SPOTIFY_CLIENT_ID=<your client ID>
SPOTIFY_CLIENT_SECRET=<your client secret>
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
SPOTIFY_ADMIN_USER_IDS=<comma-separated Spotify user IDs>
DATABASE_URL=<your Postgres connection string>
```

All of these are required. `DATABASE_URL` is covered in [Database setup](#database-setup) below.

`SPOTIFY_ADMIN_USER_IDS` lists the Spotify users who can visit the settings page. To find your Spotify user ID, open your profile in Spotify, click the three dots and then **Copy link to profile**, and take the ID from the end of the link (`https://open.spotify.com/user/<user ID>?<queries>`).

Admin users are asked for playlist and library permissions (`playlist-modify-private`, `playlist-modify-public`, `playlist-read-private`, `user-library-read` and `user-follow-read`), which are used to create and manage the region playlists. If the scopes requested by your app change, admins should log out and back in to grant them.

Keep your client secret private. `.env` is gitignored, so don't commit it.

## Database setup

World Music Finder stores regions' playlists and songs in a PostgreSQL database - so you should set one up before you run the app for the first time. You can install Postgres locally, run it in Docker, or use a hosted service.

Create an empty database, then set `DATABASE_URL` in your `.env` to its connection string. It generally looks like this, but the exact format depends on how you've set up Postgres:

```
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database name>
```

Hosted databases usually need `?sslmode=require` on the end.

After you have a database set up, run the migrations to create the required tables:

```bash
npm run db:migrate
```

If you change `db/schema.ts`, generate a new migration with:

```bash
npm run db:generate -- --name=<migration_name>
```

Then run `npm run db:migrate` again to apply it.

## Settings page

Admins can use the settings page to manage the region playlists. Select regions in the list, choose an action from the tabs and confirm it:

- **Create playlists** creates a private Spotify playlist for each selected region you don't already have one for, and saves it to the database.
- **Import songs** saves the songs in each selected region's playlist to the database, and removes saved songs you have taken out of it. Regions whose playlist hasn't changed since the last import are skipped.

Each region in the list shows whether it has a playlist and how many songs are saved. Actions run in batches, and can be paused and resumed. When a region fails, the run stops and shows the error - resuming retries the request, skipping continues on from the next region, or the remaining requests can be cancelled.

## Development

You'll need a Node.js (22.12 or later) and npm. You can then install the dependencies using:

```bash
npm install
```

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

Check formatting with Prettier:

```bash
npx prettier --check .
```
