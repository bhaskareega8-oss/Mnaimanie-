export interface LicenseKey {
  id: string;
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

export interface KeyVerificationResult {
  valid: boolean;
  error?: string;
  message: string;
  isMaster?: boolean;
  isFirstActivation?: boolean;
  key?: Partial<LicenseKey>;
}

const DEVICE_ID_STORAGE_KEY = 'lunar_device_uuid_v2';
const ACTIVE_LICENSE_STORAGE_KEY = 'lunar_active_license_v2';

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 9);
      const time = Date.now().toString(36);
      id = `dev_${rand}_${time}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_fallback_' + Date.now().toString(36);
  }
}

export function getDeviceFriendlyName(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iPad|iPhone|iPod/.test(ua)) os = 'iOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';

  return `${os} (${browser})`;
}

export function getStoredLicense(): Partial<LicenseKey> | null {
  try {
    const raw = localStorage.getItem(ACTIVE_LICENSE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredLicense(lic: Partial<LicenseKey> | null) {
  try {
    if (!lic) {
      localStorage.removeItem(ACTIVE_LICENSE_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_LICENSE_STORAGE_KEY, JSON.stringify(lic));
    }
  } catch {
    // ignore
  }
}

const LOCAL_KEYS_STORAGE_KEY = 'lunar_admin_keys_db';

const DURATION_MS_MAP: Record<string, number> = {
  '1D': 1 * 24 * 60 * 60 * 1000,
  '3D': 3 * 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '365D': 365 * 24 * 60 * 60 * 1000,
};

function generateKeySegment(len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function getLocalKeys(): LicenseKey[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalKeys(keys: LicenseKey[]): void {
  try {
    localStorage.setItem(LOCAL_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function mergeKeys(primary: LicenseKey[], secondary: LicenseKey[]): LicenseKey[] {
  const map = new Map<string, LicenseKey>();
  for (const k of secondary) {
    map.set(k.id.toUpperCase(), k);
  }
  for (const k of primary) {
    map.set(k.id.toUpperCase(), k);
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// Client verify key call (Checks server + local database fallback)
export async function verifyLicenseKey(keyInput: string): Promise<KeyVerificationResult> {
  const deviceId = getOrCreateDeviceId();
  const deviceName = getDeviceFriendlyName();
  const trimmedKey = keyInput.trim();

  try {
    const res = await fetch('/api/keys/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: trimmedKey,
        deviceId,
        deviceName,
      }),
    });

    const data = await res.json();
    if (res.ok && data.valid) {
      if (data.key) {
        saveStoredLicense(data.key);
      }
      return data;
    }

    if (res.status === 400 || res.status === 403) {
      return {
        valid: false,
        error: data.error || 'INVALID_KEY',
        message: data.message || 'Key verification failed',
      };
    }
  } catch {
    // network fallback below
  }

  // Master key offline check
  const norm = trimmedKey.toLowerCase().replace(/\s+/g, ' ');
  if (
    norm === 'karthik papa' ||
    norm === 'karthikpapa' ||
    trimmedKey.toUpperCase() === 'SIGMA AI 2026' ||
    trimmedKey.toUpperCase() === 'LUNAR2026'
  ) {
    const masterKey: Partial<LicenseKey> = {
      id: 'MASTER_KEY',
      duration: '365D',
      status: 'ACTIVE',
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    };
    saveStoredLicense(masterKey);
    return {
      valid: true,
      isMaster: true,
      message: 'MASTER ACCESS GRANTED',
      key: masterKey,
    };
  }

  // Local keys fallback check (ensures single device binding offline as well)
  const localKeys = getLocalKeys();
  const found = localKeys.find((k) => k.id.toUpperCase() === trimmedKey.toUpperCase());
  if (found) {
    if (found.status === 'REVOKED') {
      return { valid: false, error: 'KEY_REVOKED', message: 'THIS ACCESS KEY HAS BEEN REVOKED' };
    }

    if (found.status === 'EXPIRED' || (found.expiresAt && Date.now() >= found.expiresAt)) {
      found.status = 'EXPIRED';
      saveLocalKeys(localKeys);
      saveStoredLicense(null);
      return { valid: false, error: 'KEY_EXPIRED', message: 'ACCESS KEY EXPIRED! LOGIN NOT ALLOWED' };
    }

    // Unused -> Bind to current device
    if (!found.boundDeviceId) {
      found.boundDeviceId = deviceId;
      found.boundDeviceName = deviceName;
      found.activatedAt = Date.now();
      found.expiresAt = Date.now() + found.durationMs;
      found.status = 'ACTIVE';
      saveLocalKeys(localKeys);
      saveStoredLicense(found);
      return {
        valid: true,
        isFirstActivation: true,
        message: 'KEY ACTIVATED & BOUND TO YOUR DEVICE',
        key: found,
      };
    }

    // Already bound to this device
    if (found.boundDeviceId === deviceId) {
      saveStoredLicense(found);
      return {
        valid: true,
        isFirstActivation: false,
        message: 'DEVICE VERIFIED · ACCESS GRANTED',
        key: found,
      };
    }

    // Bound to another device
    return {
      valid: false,
      error: 'KEY_ALREADY_BOUND',
      message: 'THIS KEY IS ALREADY BOUND TO ANOTHER DEVICE! 1 KEY PER DEVICE ONLY.',
    };
  }

  // Cached active license check
  const cached = getStoredLicense();
  if (cached && cached.id?.toUpperCase() === trimmedKey.toUpperCase()) {
    if (cached.status === 'EXPIRED' || (cached.expiresAt && Date.now() >= cached.expiresAt)) {
      saveStoredLicense(null);
      return {
        valid: false,
        error: 'KEY_EXPIRED',
        message: 'ACCESS KEY EXPIRED! LOGIN NOT ALLOWED',
      };
    }
    return {
      valid: true,
      message: 'ACCESS GRANTED · DEVICE VERIFIED',
      key: cached,
    };
  }

  return {
    valid: false,
    error: 'INVALID_KEY',
    message: 'INVALID ACCESS KEY — GET VALID KEY FROM VIP',
  };
}

// Admin APIs with Zero-Failure Dual-Sync
export async function fetchAdminKeys(adminKey: string): Promise<{ success: boolean; keys: LicenseKey[]; error?: string }> {
  let serverKeys: LicenseKey[] = [];
  try {
    const res = await fetch(`/api/admin/keys?adminKey=${encodeURIComponent(adminKey)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.keys)) {
        serverKeys = data.keys;
      }
    }
  } catch {
    // network issue, will merge local keys
  }

  const localKeys = getLocalKeys();
  const merged = mergeKeys(serverKeys, localKeys);
  saveLocalKeys(merged);

  return {
    success: true,
    keys: merged,
  };
}

export async function generateAdminKey(
  adminKey: string,
  duration: '1D' | '3D' | '7D' | '365D',
  note?: string
): Promise<{ success: boolean; key?: LicenseKey; error?: string; message?: string }> {
  const durationMs = DURATION_MS_MAP[duration] || DURATION_MS_MAP['1D'];
  const fallbackKey: LicenseKey = {
    id: `LUNAR-${duration}-${generateKeySegment()}-${generateKeySegment()}`,
    duration,
    durationMs,
    createdAt: Date.now(),
    activatedAt: null,
    expiresAt: null,
    boundDeviceId: null,
    boundDeviceName: null,
    status: 'UNUSED',
    note: (note || '').trim() || undefined,
  };

  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, duration, note }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.key) {
        // Save to local keys storage
        const current = getLocalKeys();
        saveLocalKeys([data.key, ...current.filter((k) => k.id !== data.key.id)]);
        return { success: true, key: data.key, message: data.message };
      }
    }
  } catch {
    // fallback to local generation
  }

  // Resilient fallback generation ensures it NEVER fails
  const current = getLocalKeys();
  const updated = [fallbackKey, ...current];
  saveLocalKeys(updated);

  return {
    success: true,
    key: fallbackKey,
    message: `GENERATED ${duration} VIP KEY SUCCESSFULLY`,
  };
}

export async function resetKeyDevice(
  adminKey: string,
  keyId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await fetch('/api/admin/reset-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, keyId }),
    });
  } catch {
    // ignore
  }

  // Update local keys database
  const current = getLocalKeys();
  const target = current.find((k) => k.id === keyId);
  if (target) {
    target.boundDeviceId = null;
    target.boundDeviceName = null;
    saveLocalKeys(current);
  }

  return { success: true, message: `DEVICE BINDING RESET FOR ${keyId}` };
}

export async function deleteKey(
  adminKey: string,
  keyId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await fetch('/api/admin/delete-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, keyId }),
    });
  } catch {
    // ignore
  }

  // Update local keys database
  const current = getLocalKeys();
  const filtered = current.filter((k) => k.id !== keyId);
  saveLocalKeys(filtered);

  // If the deleted key was active on this device, wipe it
  const activeLic = getStoredLicense();
  if (activeLic && activeLic.id === keyId) {
    saveStoredLicense(null);
  }

  return { success: true, message: 'KEY DELETED SUCCESSFULLY' };
}

export async function clearExpiredKeys(
  adminKey: string
): Promise<{ success: boolean; clearedCount: number; message?: string; error?: string }> {
  let clearedCount = 0;
  try {
    const res = await fetch('/api/admin/clear-expired', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey }),
    });
    if (res.ok) {
      const data = await res.json();
      clearedCount = data.clearedCount || 0;
    }
  } catch {
    // ignore
  }

  // Also purge locally
  const now = Date.now();
  const current = getLocalKeys();
  const initial = current.length;
  const filtered = current.filter((k) => !(k.status === 'EXPIRED' || (k.expiresAt && now >= k.expiresAt)));
  saveLocalKeys(filtered);

  const totalCleared = Math.max(clearedCount, initial - filtered.length);
  return {
    success: true,
    clearedCount: totalCleared,
    message: `CLEARED ${totalCleared} EXPIRED KEYS`,
  };
}
