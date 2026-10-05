const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const logsDir = path.resolve('./data/logs');
fs.mkdirSync(logsDir, { recursive: true });

const db = new sqlite3('./data/payana.db');
const events = db.prepare('SELECT * FROM AuditEvent ORDER BY createdAt ASC').all();

const logLines = [];
const jsonLines = [];

for (const ev of events) {
  let meta = {};
  try { meta = JSON.parse(ev.metadata || '{}'); } catch {}
  const humanLine = `[${ev.createdAt}] ACTION: ${(ev.action || '').padEnd(20)} | Actor: ${ev.actorId || 'system'} | Target: ${ev.targetId || '-'} | Meta: ${JSON.stringify(meta)}`;
  const jsonLine = JSON.stringify({
    id: ev.id,
    timestamp: ev.createdAt,
    action: ev.action,
    actorId: ev.actorId,
    targetId: ev.targetId,
    metadata: meta
  });
  logLines.push(humanLine);
  jsonLines.push(jsonLine);
}

fs.writeFileSync(path.join(logsDir, 'activity.log'), logLines.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(logsDir, 'activity.jsonl'), jsonLines.join('\n') + '\n', 'utf8');
console.log('Successfully written', events.length, 'events to', logsDir);
