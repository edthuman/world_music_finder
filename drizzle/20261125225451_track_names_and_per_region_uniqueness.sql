ALTER TABLE "tracks" DROP CONSTRAINT "tracks_spotify_track_id_unique";--> statement-breakpoint
DROP INDEX "tracks_region_code_idx";--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "artists" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_region_spotify_track_unique" UNIQUE("region_code","spotify_track_id");--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_region_isrc_unique" UNIQUE("region_code","isrc");