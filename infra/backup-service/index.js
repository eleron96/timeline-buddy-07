const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cron = require('node-cron');

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.BACKUP_PORT || 7000);
const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
const DB_URL = process.env.SUPABASE_DB_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const BACKUP_CRON = process.env.BACKUP_CRON || '0 3 * * *';
const CORS_ORIGIN = process.env.BACKUP_CORS_ORIGIN || '*';

if (!DB_URL) {
  console.error('Missing SUPABASE_DB_URL');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET');
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL });

const app = express();
app.use(express.json({ limit: '1mb' }));

const withCors = (req, res) => {
  const origin = CORS_ORIGIN === '*' ? (req.headers.origin || '*') : CORS_ORIGIN;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
};

app.use((req, res, next) => {
  withCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

const buildTimestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const parseBackupType = (name) => {
  if (name.startsWith('manual-')) return 'manual';
  if (name.startsWith('daily-')) return 'daily';
  return 'manual';
};

const isSafeBackupName = (name) => /^[a-z0-9._-]+$/i.test(name) && name.endsWith('.dump');

let activeJob = null;

const requireSuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (_error) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = typeof payload === 'object' ? payload.sub : null;
  if (!userId || typeof userId !== 'string') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { rowCount } = await pool.query(
      'select 1 from public.super_admins where user_id = $1',
      [userId],
    );
    if (!rowCount) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: error.message || 'Database error' });
    return;
  }

  req.userId = userId;
  next();
};

const createBackup = async (type) => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const name = `${type}-${buildTimestamp()}.dump`;
  const filePath = path.join(BACKUP_DIR, name);
  await execFileAsync('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--file',
    filePath,
    '--dbname',
    DB_URL,
  ]);
  const stat = await fs.stat(filePath);
  return {
    name,
    type,
    createdAt: stat.mtime.toISOString(),
    size: stat.size,
  };
};

const restoreBackup = async (name) => {
  if (!isSafeBackupName(name)) {
    throw new Error('Invalid backup name.');
  }
  const filePath = path.join(BACKUP_DIR, name);
  await fs.access(filePath);
  await execFileAsync('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--dbname',
    DB_URL,
    filePath,
  ]);
};

const listBackups = async () => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const entries = await fs.readdir(BACKUP_DIR);
  const backups = await Promise.all(
    entries
      .filter((name) => isSafeBackupName(name))
      .map(async (name) => {
        const stat = await fs.stat(path.join(BACKUP_DIR, name));
        return {
          name,
          type: parseBackupType(name),
          createdAt: stat.mtime.toISOString(),
          size: stat.size,
        };
      }),
  );
  return backups.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/backups', requireSuperAdmin, async (_req, res) => {
  try {
    const backups = await listBackups();
    res.json({ backups });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to list backups.' });
  }
});

app.post('/backups', requireSuperAdmin, async (_req, res) => {
  if (activeJob) {
    res.status(409).json({ error: `Backup job already running: ${activeJob}` });
    return;
  }
  activeJob = 'manual-backup';
  try {
    const backup = await createBackup('manual');
    res.json({ backup });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create backup.' });
  } finally {
    activeJob = null;
  }
});

app.post('/backups/:name/restore', requireSuperAdmin, async (req, res) => {
  const name = req.params.name;
  if (activeJob) {
    res.status(409).json({ error: `Backup job already running: ${activeJob}` });
    return;
  }
  activeJob = `restore:${name}`;
  try {
    await restoreBackup(name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to restore backup.' });
  } finally {
    activeJob = null;
  }
});

cron.schedule(BACKUP_CRON, async () => {
  if (activeJob) return;
  activeJob = 'daily-backup';
  try {
    await createBackup('daily');
  } catch (error) {
    console.error('Daily backup failed:', error.message || error);
  } finally {
    activeJob = null;
  }
});

app.listen(PORT, () => {
  console.log(`Backup service listening on ${PORT}`);
});
