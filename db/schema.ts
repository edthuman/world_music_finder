import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  regionCode: text("region_code").notNull().unique(),
  spotifyPlaylistId: text("spotify_playlist_id").notNull().unique(),
  ownerSpotifyUserId: text("owner_spotify_user_id").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  snapshotId: text("snapshot_id"),
  lastSpotifyIngestionAt: timestamp("last_spotify_ingestion_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
