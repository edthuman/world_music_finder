ALTER TABLE "playlists" DROP CONSTRAINT "playlists_region_code_unique";--> statement-breakpoint
CREATE INDEX "playlists_region_code_last_sync_idx" ON "playlists" USING btree ("region_code","last_spotify_ingestion_at");--> statement-breakpoint
ALTER TABLE "playlists" DROP COLUMN "is_public";