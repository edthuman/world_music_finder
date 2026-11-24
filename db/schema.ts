import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
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
    spotifyTrackId: text("spotify_track_id").notNull().unique(),
    regionCode: text("region_code").notNull(),
    isrc: text("isrc"),
    explicit: boolean("explicit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("tracks_region_code_idx").on(table.regionCode)],
);
