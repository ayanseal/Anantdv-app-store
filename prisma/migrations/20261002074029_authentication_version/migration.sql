-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuthChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuthChallenge" ("createdAt", "expiresAt", "id", "purpose", "tokenHash", "usedAt", "userId") SELECT "createdAt", "expiresAt", "id", "purpose", "tokenHash", "usedAt", "userId" FROM "AuthChallenge";
DROP TABLE "AuthChallenge";
ALTER TABLE "new_AuthChallenge" RENAME TO "AuthChallenge";
CREATE UNIQUE INDEX "AuthChallenge_tokenHash_key" ON "AuthChallenge"("tokenHash");
CREATE TABLE "new_RefreshSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RefreshSession" ("consumedAt", "createdAt", "expiresAt", "family", "id", "revokedAt", "tokenHash", "userId") SELECT "consumedAt", "createdAt", "expiresAt", "family", "id", "revokedAt", "tokenHash", "userId" FROM "RefreshSession";
DROP TABLE "RefreshSession";
ALTER TABLE "new_RefreshSession" RENAME TO "RefreshSession";
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE INDEX "RefreshSession_userId_family_idx" ON "RefreshSession"("userId", "family");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
