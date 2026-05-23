-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "artworksId" TEXT NOT NULL,
    "artist_altname" TEXT NOT NULL,
    "artwork_name" TEXT NOT NULL,
    "bid_price_highest" INTEGER NOT NULL,
    "congratulation_sentence" TEXT NOT NULL,
    "certificate_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_artworksId_key" ON "Certificate"("artworksId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_artworksId_fkey" FOREIGN KEY ("artworksId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
