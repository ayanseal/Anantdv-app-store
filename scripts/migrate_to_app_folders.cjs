const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../data/payana.db');
const uploadsDir = path.resolve(__dirname, '../data/uploads');

const db = new Database(dbPath);

const apps = db.prepare('SELECT * FROM App').all();
const releases = db.prepare('SELECT * FROM Release').all();

console.log(`Found ${apps.length} apps and ${releases.length} releases.`);

for (const app of apps) {
  const safeSlug = app.slug.replace(/[^a-zA-Z0-9_-]/g, '_');
  const appDir = path.join(uploadsDir, 'apps', safeSlug);
  fs.mkdirSync(appDir, { recursive: true });

  // Copy app icon if exists
  const iconsDir = path.join(uploadsDir, 'icons');
  if (fs.existsSync(iconsDir)) {
    const iconFiles = fs.readdirSync(iconsDir).filter(f => f.startsWith(`${app.id}.`));
    for (const iconFile of iconFiles) {
      const ext = iconFile.split('.').pop() || 'png';
      const targetIcon = path.join(appDir, `icon.${ext}`);
      fs.copyFileSync(path.join(iconsDir, iconFile), targetIcon);
      console.log(`Copied icon to ${targetIcon}`);
    }
  }

  // Handle releases for this app
  const appReleases = releases.filter(r => r.appId === app.id);
  for (const rel of appReleases) {
    const safeVer = rel.version.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relDir = path.join(appDir, 'releases', `v${safeVer}`);
    fs.mkdirSync(relDir, { recursive: true });

    const safeFilename = (rel.filename.split(/[/\\]/).pop() || 'download').replace(/[\x00-\x1f\x7f"<>:|?*]/g, '_');
    const targetFile = path.join(relDir, safeFilename);

    // Source could be in uploads/<uuid> or already at relative path
    const srcInUploads = path.join(uploadsDir, rel.storageKey);
    if (fs.existsSync(srcInUploads)) {
      fs.copyFileSync(srcInUploads, targetFile);
      console.log(`Copied binary from ${srcInUploads} -> ${targetFile}`);
    } else {
      console.warn(`Source file not found at ${srcInUploads}`);
    }

    // Write release-info.json
    const info = {
      appId: app.id,
      appName: app.name,
      appSlug: app.slug,
      version: rel.version,
      filename: rel.filename,
      size: rel.size,
      checksum: rel.checksum,
      contentType: rel.contentType,
      notes: rel.notes,
      published: Boolean(rel.published),
      publishedAt: rel.publishedAt,
      createdAt: rel.createdAt,
    };
    fs.writeFileSync(path.join(relDir, 'release-info.json'), JSON.stringify(info, null, 2), 'utf-8');
    console.log(`Wrote release-info.json in ${relDir}`);

    // Update DB storageKey to relative path
    const newStorageKey = `apps/${safeSlug}/releases/v${safeVer}/${safeFilename}`.replace(/\\/g, '/');
    db.prepare('UPDATE Release SET storageKey = ? WHERE id = ?').run(newStorageKey, rel.id);
    console.log(`Updated Release ${rel.id} storageKey to "${newStorageKey}"`);
  }
}

console.log('Migration complete!');
