import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export interface LicenseKey {
  id: string; // e.g. "LUNAR-7D-A8F2-39C1"
  duration: '1D' | '3D' | '7D' | '365D';
  durationMs: number;
  createdAt: number;
  activatedAt: number | null;
  expiresAt: number | null;
  boundDeviceId: string | null;
  boundDeviceName?: string | null;
  status: 'UNUSED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  note?: string;
}

const ADMIN_SECRET = 'karthik papa';

function getKeysFilePath() {
  const dir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, 'keys.json');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]', 'utf-8');
  }
  return file;
}

function readKeys(): LicenseKey[] {
  try {
    const raw = fs.readFileSync(getKeysFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveKeys(keys: LicenseKey[]) {
  try {
    fs.writeFileSync(getKeysFilePath(), JSON.stringify(keys, null, 2), 'utf-8');
  } catch (err) {
    console.error('[KeyApi] Failed to save keys:', err);
  }
}

function generateRandomSegment(len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

function parseJsonBody<T = any>(req: any): Promise<T> {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'object') return resolve(req.body as T);
      if (typeof req.body === 'string') {
        try {
          return resolve(JSON.parse(req.body) as T);
        } catch {
          return resolve({} as T);
        }
      }
    }
    if (req.readableEnded) {
      return resolve({} as T);
    }
    let data = '';
    const timer = setTimeout(() => {
      try {
        resolve(data ? JSON.parse(data) : ({} as T));
      } catch {
        resolve({} as T);
      }
    }, 1200);

    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(data ? JSON.parse(data) : ({} as T));
      } catch {
        resolve({} as T);
      }
    });
    req.on('error', () => {
      clearTimeout(timer);
      resolve({} as T);
    });
  });
}

function sendJson(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

export function keyApiPlugin(): Plugin {
  return {
    name: 'lunar-key-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '/', 'http://localhost:3000');
        const pathname = urlObj.pathname;

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        // ================= CLIENT KEY VERIFICATION =================
        if (pathname === '/api/keys/verify' && req.method === 'POST') {
          const body = await parseJsonBody<{
            key?: string;
            deviceId?: string;
            deviceName?: string;
          }>(req);

          const rawKey = (body.key || '').trim();
          const deviceId = (body.deviceId || '').trim();
          const deviceName = (body.deviceName || 'Web Client').trim();

          if (!rawKey) {
            return sendJson(res, 400, {
              valid: false,
              error: 'EMPTY_KEY',
              message: 'PLEASE ENTER YOUR ACCESS KEY',
            });
          }

          // Admin Master Key override
          const normalized = rawKey.toLowerCase().replace(/\s+/g, ' ');
          if (
            normalized === ADMIN_SECRET ||
            normalized === 'karthikpapa' ||
            rawKey.toUpperCase() === 'SIGMA AI 2026' ||
            rawKey.toUpperCase() === 'LUNAR2026'
          ) {
            return sendJson(res, 200, {
              valid: true,
              isMaster: true,
              message: 'MASTER ACCESS GRANTED',
              key: {
                id: 'MASTER_KEY',
                duration: '365D',
                status: 'ACTIVE',
                expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
              },
            });
          }

          const keys = readKeys();
          const found = keys.find(
            (k) => k.id.toUpperCase() === rawKey.toUpperCase()
          );

          if (!found) {
            return sendJson(res, 400, {
              valid: false,
              error: 'INVALID_KEY',
              message: 'INVALID ACCESS KEY — GET VALID KEY FROM VIP',
            });
          }

          if (found.status === 'REVOKED') {
            return sendJson(res, 403, {
              valid: false,
              error: 'KEY_REVOKED',
              message: 'THIS ACCESS KEY HAS BEEN REVOKED BY ADMIN',
            });
          }

          // Check if key is expired or already marked expired
          if (found.status === 'EXPIRED' || (found.expiresAt && Date.now() >= found.expiresAt)) {
            found.status = 'EXPIRED';
            saveKeys(keys);
            return sendJson(res, 403, {
              valid: false,
              error: 'KEY_EXPIRED',
              message: 'ACCESS KEY EXPIRED! LOGIN NOT ALLOWED',
            });
          }

          // 1. Unused Key -> Bind to current device immediately
          if (!found.boundDeviceId) {
            found.boundDeviceId = deviceId || 'dev_' + Date.now().toString(36);
            found.boundDeviceName = deviceName;
            found.activatedAt = Date.now();
            found.expiresAt = Date.now() + found.durationMs;
            found.status = 'ACTIVE';
            saveKeys(keys);

            return sendJson(res, 200, {
              valid: true,
              isFirstActivation: true,
              message: 'KEY ACTIVATED & BOUND TO YOUR DEVICE',
              key: found,
            });
          }

          // 2. Already Bound Key -> Verify device ID
          if (found.boundDeviceId === deviceId) {
            return sendJson(res, 200, {
              valid: true,
              isFirstActivation: false,
              message: 'DEVICE VERIFIED · ACCESS GRANTED',
              key: found,
            });
          }

          // 3. Bound to another device -> BLOCK! ("OKA key oka ni ki a open kavli vere a vallaki ki vadhu")
          return sendJson(res, 403, {
            valid: false,
            error: 'KEY_ALREADY_BOUND',
            message:
              'THIS KEY IS ALREADY BOUND TO ANOTHER DEVICE! 1 KEY PER DEVICE ONLY.',
          });
        }

        // ================= ADMIN: GET ALL KEYS =================
        if (pathname === '/api/admin/keys' && req.method === 'GET') {
          const authHeader = urlObj.searchParams.get('adminKey') || '';
          const normalized = authHeader.trim().toLowerCase().replace(/\s+/g, ' ');

          if (normalized !== ADMIN_SECRET && normalized !== 'karthikpapa') {
            return sendJson(res, 401, { error: 'UNAUTHORIZED_ADMIN' });
          }

          const keys = readKeys();
          // Auto-mark expired
          let changed = false;
          const now = Date.now();
          for (const k of keys) {
            if (k.expiresAt && now > k.expiresAt && k.status === 'ACTIVE') {
              k.status = 'EXPIRED';
              changed = true;
            }
          }
          if (changed) saveKeys(keys);

          return sendJson(res, 200, {
            success: true,
            total: keys.length,
            keys: [...keys].reverse(), // newest first without mutating original
          });
        }

        // ================= ADMIN: GENERATE NEW KEY (1D / 3D / 7D / 365D) =================
        if (pathname === '/api/admin/keys' && req.method === 'POST') {
          const body = await parseJsonBody<{
            adminKey?: string;
            duration?: '1D' | '3D' | '7D' | '365D';
            note?: string;
          }>(req);

          const adminKey = (body.adminKey || urlObj.searchParams.get('adminKey') || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (adminKey !== ADMIN_SECRET && adminKey !== 'karthikpapa') {
            return sendJson(res, 401, { error: 'UNAUTHORIZED_ADMIN' });
          }

          const duration = body.duration || '1D';
          const durationMap: Record<string, number> = {
            '1D': 1 * 24 * 60 * 60 * 1000,
            '3D': 3 * 24 * 60 * 60 * 1000,
            '7D': 7 * 24 * 60 * 60 * 1000,
            '365D': 365 * 24 * 60 * 60 * 1000,
          };

          const durationMs = durationMap[duration] || durationMap['1D'];
          const keyId = `LUNAR-${duration}-${generateRandomSegment()}-${generateRandomSegment()}`;

          const newKey: LicenseKey = {
            id: keyId,
            duration,
            durationMs,
            createdAt: Date.now(),
            activatedAt: null,
            expiresAt: null,
            boundDeviceId: null,
            boundDeviceName: null,
            status: 'UNUSED',
            note: (body.note || '').trim() || undefined,
          };

          const keys = readKeys();
          keys.push(newKey);
          saveKeys(keys);

          return sendJson(res, 200, {
            success: true,
            key: newKey,
            message: `GENERATED ${duration} KEY SUCCESSFULLY`,
          });
        }

        // ================= ADMIN: RESET DEVICE BINDING =================
        if (pathname === '/api/admin/reset-device' && req.method === 'POST') {
          const body = await parseJsonBody<{
            adminKey?: string;
            keyId?: string;
          }>(req);

          const adminKey = (body.adminKey || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (adminKey !== ADMIN_SECRET && adminKey !== 'karthikpapa') {
            return sendJson(res, 401, { error: 'UNAUTHORIZED_ADMIN' });
          }

          const keys = readKeys();
          const target = keys.find((k) => k.id === body.keyId);
          if (!target) {
            return sendJson(res, 404, { error: 'KEY_NOT_FOUND' });
          }

          target.boundDeviceId = null;
          target.boundDeviceName = null;
          saveKeys(keys);

          return sendJson(res, 200, {
            success: true,
            message: `DEVICE BINDING RESET FOR ${target.id}`,
            key: target,
          });
        }

        // ================= ADMIN: DELETE / REVOKE KEY =================
        if (pathname === '/api/admin/delete-key' && req.method === 'POST') {
          const body = await parseJsonBody<{
            adminKey?: string;
            keyId?: string;
          }>(req);

          const adminKey = (body.adminKey || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (adminKey !== ADMIN_SECRET && adminKey !== 'karthikpapa') {
            return sendJson(res, 401, { error: 'UNAUTHORIZED_ADMIN' });
          }

          let keys = readKeys();
          keys = keys.filter((k) => k.id !== body.keyId);
          saveKeys(keys);

          return sendJson(res, 200, {
            success: true,
            message: 'KEY DELETED SUCCESSFULLY',
          });
        }

        // ================= ADMIN: CLEAR ALL EXPIRED KEYS =================
        if (pathname === '/api/admin/clear-expired' && req.method === 'POST') {
          const body = await parseJsonBody<{ adminKey?: string }>(req);
          const adminKey = (body.adminKey || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (adminKey !== ADMIN_SECRET && adminKey !== 'karthikpapa') {
            return sendJson(res, 401, { error: 'UNAUTHORIZED_ADMIN' });
          }

          const now = Date.now();
          let keys = readKeys();
          const initialCount = keys.length;
          keys = keys.filter((k) => !(k.status === 'EXPIRED' || (k.expiresAt && now >= k.expiresAt)));
          saveKeys(keys);

          return sendJson(res, 200, {
            success: true,
            clearedCount: initialCount - keys.length,
            message: `CLEARED ${initialCount - keys.length} EXPIRED KEYS`,
          });
        }

        next();
      });
    },
  };
}
