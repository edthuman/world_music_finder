CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_code" text NOT NULL,
	"spotify_playlist_id" text NOT NULL,
	"owner_spotify_user_id" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"snapshot_id" text,
	"last_spotify_ingestion_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlists_region_code_unique" UNIQUE("region_code"),
	CONSTRAINT "playlists_spotify_playlist_id_unique" UNIQUE("spotify_playlist_id")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_track_id" text NOT NULL,
	"region_code" text NOT NULL,
	"isrc" text,
	"explicit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_spotify_track_id_unique" UNIQUE("spotify_track_id")
);
--> statement-breakpoint
CREATE INDEX "tracks_region_code_idx" ON "tracks" USING btree ("region_code");