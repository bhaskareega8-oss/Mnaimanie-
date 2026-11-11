import React, { useState, useEffect } from 'react';
import {
  LicenseKey,
  fetchAdminKeys,
  generateAdminKey,
  resetKeyDevice,
  deleteKey,
} from '../services/adminKeyService';
import { sound } from '../services/sound';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminSecret: string;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  adminSecret,
}) => {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDuration, setSelectedDuration] = useState<'1D' | '3D' | '7D' | '365D'>('7D');
  const [clientNote, setClientNote] = useState<string>('');
  const [generatedKey, setGeneratedKey] = useState<LicenseKey | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNUSED' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string>('');
  const [copiedKeyId, setCopiedKeyId] = useState<string>('');

  const loadKeys = async () => {
    setLoading(true);
    const res = await fetchAdminKeys(adminSecret);
    if (res.success) {
      setKeys(res.keys);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadKeys();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    sound.play('click');
    setLoading(true);
    setActionMessage('');
    const res = await generateAdminKey(adminSecret, selectedDuration, clientNote);
    if (res.success && res.key) {
      setGeneratedKey(res.key);
      setClientNote('');
      sound.play('win');
      setActionMessage(`✓ Generated new ${selectedDuration} VIP Key!`);
      await loadKeys();
    } else {
      sound.play('loss');
      setActionMessage(`Error: ${res.error || 'Failed to generate key'}`);
    }
    setLoading(false);
  };

  const handleResetDevice = async (keyId: string) => {
    if (!window.confirm(`Reset device lock for ${keyId}? The customer will be able to bind a new device.`)) {
      return;
    }
    sound.play('click');
    const res = await resetKeyDevice(adminSecret, keyId);
    if (res.success) {
      setActionMessage(`✓ Device lock reset for ${keyId}`);
      await loadKeys();
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!window.confirm(`Delete key ${keyId} permanently?`)) return;
    sound.play('click');
    const res = await deleteKey(adminSecret, keyId);
    if (res.success) {
      setActionMessage(`✓ Key deleted`);
      await loadKeys();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    sound.play('click');
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(''), 2000);
    } catch {
      // ignore
    }
  };

  const getTelegramMessage = (k: LicenseKey) => {
    return `━━━━━━━━━━━━━━━━━━━━━━\n   🌒 𝗟𝗨𝗡𝗔𝗥 𝗔𝗜 𝗩𝗜𝗣 𝗞𝗘𝗬 🌒\n━━━━━━━━━━━━━━━━━━━━━━\n🔑 𝗞𝗘𝗬 : ${k.id}\n⏳ 𝗩𝗔𝗟𝗜𝗗𝗜𝗧𝗬 : ${k.duration}\n📱 𝗦𝗜𝗡𝗚𝗟𝗘 𝗗𝗘𝗩𝗜𝗖𝗘 𝗕𝗢𝗨𝗡𝗗\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ Note: This key locks to your device on first login. It will NOT work on any other phone or browser!`;
  };

  const filteredKeys = keys.filter((k) => {
    if (activeTab === 'UNUSED' && k.status !== 'UNUSED') return false;
    if (activeTab === 'ACTIVE' && k.status !== 'ACTIVE') return false;
    if (activeTab === 'EXPIRED' && k.status !== 'EXPIRED') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = k.id.toLowerCase().includes(q);
      const matchNote = (k.note || '').toLowerCase().includes(q);
      const matchDevice = (k.boundDeviceName || '').toLowerCase().includes(q);
      if (!matchId && !matchNote && !matchDevice) return false;
    }
    return true;
  });

  const unusedCount = keys.filter((k) => k.status === 'UNUSED').length;
  const activeCount = keys.filter((k) => k.status === 'ACTIVE').length;
  const expiredCount = keys.filter((k) => k.status === 'EXPIRED').length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[rgba(10,8,22,0.96)] border border-[rgba(255,215,0,0.45)] shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(255,215,0,0.18)] overflow-hidden">
        {/* Top Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ffd700] via-[#00f0ff] to-[#a855f7]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-[rgba(168,85,247,0.25)] bg-[rgba(16,12,34,0.7)]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ffd700] to-[#b45309] text-black font-black grid place-items-center text-sm shadow-[0_0_15px_rgba(255,215,0,0.5)]">
              👑
            </span>
            <div>
              <h2 className="font-display font-black text-base text-white tracking-wider flex items-center gap-2">
                LUNAR AI <span className="text-[#ffd700]">VIP ADMIN PANEL</span>
              </h2>
              <p className="text-[10px] font-mono font-bold text-[#94a3b8]">
                SECURITY: <span className="text-[#00ff9d]">AUTHORIZED ADMIN</span> · 1 DEVICE LOCK
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.play('click');
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-[rgba(255,42,95,0.15)] border border-[rgba(255,42,95,0.35)] text-[#ff2a5f] hover:bg-[#ff2a5f] hover:text-white transition-colors flex items-center justify-center font-black text-sm cursor-pointer"
            title="Close Admin Panel"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 px-5 space-y-4">
          {actionMessage && (
            <div className="p-2.5 rounded-xl bg-[rgba(0,255,157,0.12)] border border-[rgba(0,255,157,0.35)] text-[#00ff9d] text-xs font-black tracking-wide text-center">
              {actionMessage}
            </div>
          )}

          {/* GENERATE SECTION */}
          <div className="p-4 rounded-2xl bg-[rgba(18,14,38,0.8)] border border-[rgba(0,240,255,0.3)] shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#00f0ff] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
                GENERATE VIP ACCESS KEYS (1D / 3D / 7D / 365D)
              </span>
              <span className="text-[9px] font-mono text-[#ffd700] px-2 py-0.5 rounded-full bg-[rgba(255,215,0,0.15)] border border-[rgba(255,215,0,0.3)]">
                🔒 1 Device Bound per Key
              </span>
            </div>

            {/* Duration Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {(['1D', '3D', '7D', '365D'] as const).map((dur) => {
                const isSelected = selectedDuration === dur;
                return (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => {
                      sound.play('click');
                      setSelectedDuration(dur);
                    }}
                    className={`py-2.5 rounded-xl font-display font-black text-xs tracking-wider transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-[#03050a] shadow-[0_0_15px_rgba(255,215,0,0.5)] scale-102 border-transparent'
                        : 'bg-[rgba(5,4,12,0.7)] text-[#94a3b8] border border-[rgba(168,85,247,0.3)] hover:border-[#00f0ff] hover:text-white'
                    }`}
                  >
                    {dur === '1D' && '⚡ 1 DAY'}
                    {dur === '3D' && '⚡ 3 DAYS'}
                    {dur === '7D' && '👑 7 DAYS'}
                    {dur === '365D' && '💎 365 DAYS'}
                  </button>
                );
              })}
            </div>

            {/* Note Input & Generate Button */}
            <div className="flex gap-2">
              <input
                type="text"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                placeholder="Optional Client Name or Telegram (e.g. @username)"
                className="flex-1 py-2.5 px-3 rounded-xl bg-[rgba(5,4,12,0.9)] border border-[rgba(168,85,247,0.3)] text-xs text-white font-bold outline-none focus:border-[#00f0ff]"
              />
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#00ff9d] via-[#00f0ff] to-[#a855f7] font-display font-black text-xs text-[#03050a] tracking-wider uppercase shadow-[0_0_20px_rgba(0,255,157,0.4)] cursor-pointer hover:brightness-110 active:scale-98 transition-all shrink-0"
              >
                {loading ? 'GENERATING...' : `+ GENERATE ${selectedDuration}`}
              </button>
            </div>

            {/* Newly Generated Key Alert Box */}
            {generatedKey && (
              <div className="mt-3 p-3.5 rounded-xl bg-[rgba(5,4,12,0.95)] border-2 border-[#00ff9d] shadow-[0_0_25px_rgba(0,255,157,0.25)] animate-rise">
                <div className="flex items-center justify-between mb-1 text-[10px] font-black text-[#00ff9d] uppercase">
                  <span>✓ KEY GENERATED SUCCESSFULLY</span>
                  <span className="font-mono text-[#ffd700]">VALIDITY: {generatedKey.duration}</span>
                </div>

                <div className="p-2 rounded-lg bg-black/60 border border-[rgba(0,255,157,0.3)] font-mono font-black text-sm text-[#00f0ff] tracking-widest text-center select-all my-1.5">
                  {generatedKey.id}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedKey.id, generatedKey.id)}
                    className="flex-1 py-2 rounded-lg bg-[rgba(0,240,255,0.18)] border border-[rgba(0,240,255,0.4)] text-[#00f0ff] font-black text-[11px] hover:bg-[rgba(0,240,255,0.3)] cursor-pointer transition-colors"
                  >
                    {copiedKeyId === generatedKey.id ? '✓ KEY COPIED!' : '📋 COPY KEY ONLY'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(getTelegramMessage(generatedKey), `${generatedKey.id}_tg`)
                    }
                    className="flex-1 py-2 rounded-lg bg-[rgba(255,215,0,0.18)] border border-[rgba(255,215,0,0.4)] text-[#ffd700] font-black text-[11px] hover:bg-[rgba(255,215,0,0.3)] cursor-pointer transition-colors"
                  >
                    {copiedKeyId === `${generatedKey.id}_tg`
                      ? '✓ TELEGRAM MSG COPIED!'
                      : '📱 COPY TELEGRAM FORMAT'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STATS OVERVIEW */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-[rgba(16,12,34,0.7)] border border-[rgba(168,85,247,0.2)] text-center">
              <div className="text-[9px] font-black text-[#94a3b8] uppercase">Total Keys</div>
              <div className="font-display font-black text-base text-white mt-0.5">{keys.length}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[rgba(16,12,34,0.7)] border border-[rgba(255,215,0,0.25)] text-center">
              <div className="text-[9px] font-black text-[#ffd700] uppercase">Available</div>
              <div className="font-display font-black text-base text-[#ffd700] mt-0.5">{unusedCount}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[rgba(16,12,34,0.7)] border border-[rgba(0,255,157,0.25)] text-center">
              <div className="text-[9px] font-black text-[#00ff9d] uppercase">Active Devices</div>
              <div className="font-display font-black text-base text-[#00ff9d] mt-0.5">{activeCount}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[rgba(16,12,34,0.7)] border border-[rgba(255,42,95,0.25)] text-center">
              <div className="text-[9px] font-black text-[#ff2a5f] uppercase">Expired</div>
              <div className="font-display font-black text-base text-[#ff2a5f] mt-0.5">{expiredCount}</div>
            </div>
          </div>

          {/* KEYS LIST & MANAGEMENT */}
          <div className="p-4 rounded-2xl bg-[rgba(18,14,38,0.8)] border border-[rgba(168,85,247,0.25)]">
            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
              <div className="flex rounded-xl bg-[rgba(5,4,12,0.8)] p-0.5 border border-[rgba(168,85,247,0.25)]">
                {(['ALL', 'UNUSED', 'ACTIVE', 'EXPIRED'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      sound.play('click');
                      setActiveTab(tab);
                    }}
                    className={`py-1 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                      activeTab === tab
                        ? 'bg-[#a855f7] text-white shadow-sm'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keys / notes..."
                  className="py-1 px-3 rounded-lg bg-[rgba(5,4,12,0.8)] border border-[rgba(168,85,247,0.25)] text-xs text-white outline-none w-full sm:w-44 placeholder:text-[#64748b]"
                />
                <button
                  type="button"
                  onClick={loadKeys}
                  title="Refresh keys list"
                  className="p-1 px-2.5 rounded-lg bg-[rgba(168,85,247,0.2)] border border-[rgba(168,85,247,0.3)] text-[#00f0ff] font-black text-xs hover:bg-[rgba(168,85,247,0.4)] cursor-pointer"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* List */}
            {filteredKeys.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-[#64748b]">
                No license keys found. Generate a key above!
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredKeys.map((k) => {
                  const isUnused = k.status === 'UNUSED';
                  const isActive = k.status === 'ACTIVE';
                  const isExpired = k.status === 'EXPIRED';

                  let remainingText = '';
                  if (isActive && k.expiresAt) {
                    const diffMs = k.expiresAt - Date.now();
                    if (diffMs > 0) {
                      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                      remainingText = `${days}d ${hours}h left`;
                    } else {
                      remainingText = 'Expired';
                    }
                  }

                  return (
                    <div
                      key={k.id}
                      className="p-3 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)] hover:border-[rgba(0,240,255,0.4)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      {/* Left Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm text-[#00f0ff] tracking-wider select-all">
                            {k.id}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[rgba(255,215,0,0.15)] text-[#ffd700] border border-[rgba(255,215,0,0.3)]">
                            {k.duration}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              isUnused
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : isActive
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            {k.status}
                          </span>
                        </div>

                        {/* Device & Expiry Sub-text */}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-[#94a3b8] flex-wrap">
                          {k.boundDeviceId ? (
                            <span className="text-[#00ff9d] font-bold">
                              📱 Bound: {k.boundDeviceName || 'Device'} ({k.boundDeviceId.slice(-8)})
                            </span>
                          ) : (
                            <span className="text-amber-300 font-bold">📱 Not Bound (Available)</span>
                          )}

                          {remainingText && (
                            <span className="text-[#ffd700] font-mono">⏳ {remainingText}</span>
                          )}

                          {k.note && <span className="text-[#cbd5e1] italic font-normal">📝 {k.note}</span>}
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(k.id, k.id)}
                          className="py-1 px-2 rounded-lg bg-[rgba(0,240,255,0.12)] border border-[rgba(0,240,255,0.3)] text-[#00f0ff] text-[10px] font-black hover:bg-[rgba(0,240,255,0.25)] cursor-pointer"
                          title="Copy Key"
                        >
                          {copiedKeyId === k.id ? '✓' : 'COPY'}
                        </button>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(getTelegramMessage(k), `${k.id}_tg`)}
                          className="py-1 px-2 rounded-lg bg-[rgba(255,215,0,0.12)] border border-[rgba(255,215,0,0.3)] text-[#ffd700] text-[10px] font-black hover:bg-[rgba(255,215,0,0.25)] cursor-pointer"
                          title="Copy Telegram Formatted Message"
                        >
                          {copiedKeyId === `${k.id}_tg` ? '✓' : 'TG MSG'}
                        </button>

                        {k.boundDeviceId && (
                          <button
                            type="button"
                            onClick={() => handleResetDevice(k.id)}
                            className="py-1 px-2 rounded-lg bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.35)] text-[#c084fc] text-[10px] font-black hover:bg-[rgba(168,85,247,0.3)] cursor-pointer"
                            title="Reset device lock so user can use on another device"
                          >
                            RESET DEV
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(k.id)}
                          className="py-1 px-2 rounded-lg bg-[rgba(255,42,95,0.12)] border border-[rgba(255,42,95,0.3)] text-[#ff2a5f] text-[10px] font-black hover:bg-[rgba(255,42,95,0.25)] cursor-pointer"
                          title="Delete Key"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-[rgba(168,85,247,0.2)] bg-[rgba(10,8,22,0.95)] flex items-center justify-between text-[10px] text-[#94a3b8] font-bold">
          <span>🔒 SINGLE DEVICE BINDING ENGINE ENFORCED</span>
          <button
            type="button"
            onClick={() => {
              sound.play('click');
              onClose();
            }}
            className="py-1.5 px-4 rounded-xl bg-[rgba(255,215,0,0.15)] border border-[rgba(255,215,0,0.4)] text-[#ffd700] font-black uppercase tracking-wider hover:bg-[#ffd700] hover:text-black transition-colors cursor-pointer"
          >
            HIDE ADMIN PANEL
          </button>
        </div>
      </div>
    </div>
  );
};
