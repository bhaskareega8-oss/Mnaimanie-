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

// Client verify key call
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

    return {
      valid: false,
      error: data.error || 'INVALID_KEY',
      message: data.message || 'Key verification failed',
    };
  } catch {
    // If backend proxy is unreachable, fallback to check master key or cached license
    const norm = trimmedKey.toLowerCase().replace(/\s+/g, ' ');
    if (
      norm === 'karthik papa' ||
      norm === 'karthikpapa' ||
      trimmedKey.toUpperCase() === 'SIGMA AI 2026' ||
      trimmedKey.toUpperCase() === 'LUNAR2026'
    ) {
      const masterKey = {
        id: 'MASTER_KEY',
        duration: '365D' as const,
        status: 'ACTIVE' as const,
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      };
      saveStoredLicense(masterKey);
      return {
        valid: true,
        isMaster: true,
        message: 'MASTER ACCESS GRANTED (OFFLINE)',
        key: masterKey,
      };
    }

    const cached = getStoredLicense();
    if (cached && cached.id?.toUpperCase() === trimmedKey.toUpperCase()) {
      if (cached.expiresAt && Date.now() > cached.expiresAt) {
        return {
          valid: false,
          error: 'KEY_EXPIRED',
          message: 'ACCESS KEY EXPIRED! CONTACT ADMIN FOR RENEWAL',
        };
      }
      return {
        valid: true,
        message: 'ACCESS GRANTED (OFFLINE CACHE)',
        key: cached,
      };
    }

    return {
      valid: false,
      error: 'NETWORK_ERROR',
      message: 'CONNECTION ERROR — PLEASE TRY AGAIN',
    };
  }
}

// Admin APIs
export async function fetchAdminKeys(adminKey: string): Promise<{ success: boolean; keys: LicenseKey[]; error?: string }> {
  try {
    const res = await fetch(`/api/admin/keys?adminKey=${encodeURIComponent(adminKey)}`);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, keys: [], error: data.error || 'UNAUTHORIZED' };
    }
    return { success: true, keys: data.keys || [] };
  } catch (err: any) {
    return { success: false, keys: [], error: err.message };
  }
}

export async function generateAdminKey(
  adminKey: string,
  duration: '1D' | '3D' | '7D' | '365D',
  note?: string
): Promise<{ success: boolean; key?: LicenseKey; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, duration, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to generate key' };
    }
    return { success: true, key: data.key, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resetKeyDevice(
  adminKey: string,
  keyId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/reset-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, keyId }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteKey(
  adminKey: string,
  keyId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/delete-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, keyId }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
