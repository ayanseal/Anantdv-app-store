-- AlterTable
ALTER TABLE "Company" ADD COLUMN "logoUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "iconUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_App" ("active", "createdAt", "description", "iconUrl", "id", "name", "platform", "slug", "updatedAt") SELECT "active", "createdAt", "description", "iconUrl", "id", "name", "platform", "slug", "updatedAt" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
