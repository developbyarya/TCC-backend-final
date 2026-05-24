-- Add bid_close flag to artworks
ALTER TABLE "Artwork" ADD COLUMN "bid_close" BOOLEAN NOT NULL DEFAULT false;
