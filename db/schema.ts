import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionCode: text("region_code").notNull(),
    spotifyPlaylistId: text("spotify_playlist_id").notNull().unique(),
    ownerSpotifyUserId: text("owner_spotify_user_id").notNull(),
    snapshotId: text("snapshot_id"),
    lastSpotifyIngestionAt: timestamp("last_spotify_ingestion_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("playlists_region_code_last_sync_idx").on(
      table.regionCode,
      table.lastSpotifyIngestionAt,
    ),
  ],
);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotifyTrackId: text("spotify_track_id").notNull(),
    regionCode: text("region_code").notNull(),
    name: text("name").notNull(),
    artists: text("artists").notNull(),
    isrc: text("isrc"),
    explicit: boolean("explicit").notNull().default(false),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // A song can be saved for several regions, but only once per region
  (table) => [
    unique("tracks_region_spotify_track_unique").on(
      table.regionCode,
      table.spotifyTrackId,
    ),
    unique("tracks_region_isrc_unique").on(table.regionCode, table.isrc),
  ],
);
