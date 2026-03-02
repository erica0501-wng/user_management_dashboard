-- CreateTable
CREATE TABLE "SharedWatchlist" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "symbols" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistComment" (
    "id" SERIAL NOT NULL,
    "sharedWatchlistId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistLike" (
    "id" SERIAL NOT NULL,
    "sharedWatchlistId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistLike_sharedWatchlistId_userId_key" ON "WatchlistLike"("sharedWatchlistId", "userId");

-- AddForeignKey
ALTER TABLE "SharedWatchlist" ADD CONSTRAINT "SharedWatchlist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistComment" ADD CONSTRAINT "WatchlistComment_sharedWatchlistId_fkey" FOREIGN KEY ("sharedWatchlistId") REFERENCES "SharedWatchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistComment" ADD CONSTRAINT "WatchlistComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistLike" ADD CONSTRAINT "WatchlistLike_sharedWatchlistId_fkey" FOREIGN KEY ("sharedWatchlistId") REFERENCES "SharedWatchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistLike" ADD CONSTRAINT "WatchlistLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
