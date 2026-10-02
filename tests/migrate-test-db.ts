import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
export function migrateTestDatabase(filename: string) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const sql = new DatabaseSync(filename);
  const legacy = !!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'").get();
  sql.exec('CREATE TABLE IF NOT EXISTS TestMigration (name TEXT PRIMARY KEY)');
  const directories = readdirSync('prisma/migrations', { withFileTypes: true }).filter(d => d.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
  try {
    for (const [index, dir] of directories.entries()) {
      if (sql.prepare('SELECT name FROM TestMigration WHERE name = ?').get(dir.name)) continue;
      sql.exec('BEGIN');
      try {
        if (!(legacy && index === 0)) sql.exec(readFileSync(`prisma/migrations/${dir.name}/migration.sql`, 'utf8'));
        sql.prepare('INSERT INTO TestMigration(name) VALUES (?)').run(dir.name);
        sql.exec('COMMIT');
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  } finally { sql.close(); }
}
