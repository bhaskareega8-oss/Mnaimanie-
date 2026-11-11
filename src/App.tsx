import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Starfield } from './components/Starfield';
import { ResultModal, ResultModalData } from './components/ResultModal';
import { sound } from './services/sound';
import {
  fetchLiveWingoHistory,
  getPrediction,
  SessionRecord,
  HistoryItem,
  PatternAnalysisResult,
  CORE_PATTERNS,
} from './services/lunarEngine';
import {
  LOGO_DATA_URL,
  BG_LOGIN_DATA_URL,
  BG_DASH_DATA_URL,
} from './assets-data';
import { AdminPanelModal } from './components/AdminPanelModal';
import {
  verifyLicenseKey,
  getStoredLicense,
  saveStoredLicense,
} from './services/adminKeyService';

const ADMIN_KEY_SECRET = 'karthik papa';

const MASTER_KEY = 'SIGMA AI 2026';
const TELEGRAM_VIP_URL = 'https://t.me/+QlglpjatSeQ4YTg1';
const TELEGRAM_SUPPORT_URL = 'https://t.me/Mitheshhhh';

// Helper to convert plain characters to mathematical bold unicode digits and letters
function toBoldUnicode(text: string): string {
  const digits: Record<string, string> = {
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰',
    '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
  };
  const upper: Record<string, string> = {
    A: '𝗔', B: '𝗕', C: '𝗖', D: '𝗗', E: '𝗘', F: '𝗙', G: '𝗚', H: '𝗛', I: '𝗜',
    J: '𝗝', K: '𝗞', L: '𝗟', M: '𝗠', N: '𝗡', O: '𝗢', P: '𝗣', Q: '𝗤', R: '𝗥',
    S: '𝗦', T: '𝗧', U: '𝗨', V: '𝗩', W: '𝗪', X: '𝗫', Y: '𝗬', Z: '𝗭',
  };
  const lower: Record<string, string> = {
    a: '𝗮', b: '𝗯', c: '𝗰', d: '𝗱', e: '𝗲', f: '𝗳', g: '𝗴', h: '𝗵', i: '𝗶',
    j: '𝗷', k: '𝗸', l: '𝗹', m: '𝗺', n: '𝗻', o: '𝗼', p: '𝗽', q: '𝗤', r: '𝗿',
    s: '𝘀', t: '𝘁', u: '𝘂', v: '𝘃', w: '𝘄', x: '𝘅', y: '𝘆', z: '𝘇',
  };
  return text
    .split('')
    .map((c) => digits[c] || upper[c] || lower[c] || c)
    .join('');
}

export default function App() {
  // Navigation & Authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'about'>('home');
  const [accessKeyInput, setAccessKeyInput] = useState<string>('');
  const [showKeyText, setShowKeyText] = useState<boolean>(false); // strictly masked by default
  const [authError, setAuthError] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<string>('');
  const [shakeField, setShakeField] = useState<boolean>(false);
  const [isSoundOn, setIsSoundOn] = useState<boolean>(() => sound.enabled);

  // 3-Failed Attempts = 1-Hour Lockout Security
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('lunar_failed_attempts') || 0);
    } catch {
      return 0;
    }
  });

  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('lunar_lockout_until') || 0);
    } catch {
      return 0;
    }
  });

  const [lockoutSecsLeft, setLockoutSecsLeft] = useState<number>(0);

  // Lockout countdown timer loop
  useEffect(() => {
    const checkLockout = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        setLockoutSecsLeft(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        if (lockoutSecsLeft > 0 || lockoutUntil > 0) {
          setLockoutSecsLeft(0);
          setLockoutUntil(0);
          setFailedAttempts(0);
          try {
            localStorage.removeItem('lunar_lockout_until');
            localStorage.removeItem('lunar_failed_attempts');
          } catch {
            // ignore
          }
        }
      }
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, lockoutSecsLeft]);

  const isLockedOut = lockoutSecsLeft > 0;

  const formatLockoutTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Auto-expire active key & terminate session immediately when time runs out
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkKeyExpiry = () => {
      const lic = getStoredLicense();
      if (!lic) return;
      if (lic.id === 'MASTER_KEY') return;
      if (lic.status === 'EXPIRED' || (lic.expiresAt && Date.now() >= lic.expiresAt)) {
        saveStoredLicense(null);
        setIsAuthenticated(false);
        sound.play('error');
        setAuthError('ACCESS KEY EXPIRED! YOUR TIME HAS ENDED. PLEASE RENEW WITH ADMIN.');
      }
    };

    checkKeyExpiry();
    const interval = setInterval(checkKeyExpiry, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Engine state
  const [currentPeriod, setCurrentPeriod] = useState<string>('----');
  const [predictedSignal, setPredictedSignal] = useState<'BIG' | 'SMALL' | 'SCANNING'>('SCANNING');
  const [targetNum1, setTargetNum1] = useState<number | null>(null);
  const [targetNum2, setTargetNum2] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(93);
  const [level, setLevel] = useState<number>(0); // 0 = L0, 1 = L1, 2 = L2, 3 = L3

  // Pattern detection state (computed silently in background)
  const [detectedPatternInfo, setDetectedPatternInfo] = useState<PatternAnalysisResult>({
    prediction: 'BIG',
    strategy: 'NEURAL WINGO PATTERN SCAN',
    patternDetected: 'BSSB',
    trendType: 'SYMMETRIC_MOTIF',
    confidence: 93,
    executionTimeMs: 0.006,
  });

  // Timer state
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [orbPulsing, setOrbPulsing] = useState<boolean>(false);

  // History & stats
  const [sessionLogs, setSessionLogs] = useState<SessionRecord[]>([]);
  const [winsCount, setWinsCount] = useState<number>(0);
  const [lossesCount, setLossesCount] = useState<number>(0);
  const [jackpotsCount, setJackpotsCount] = useState<number>(0);

  // Result popup modal (auto-closes in 6s, zero confetti)
  const [modalData, setModalData] = useState<ResultModalData | null>(null);

  // Copy status
  const [copiedText, setCopiedText] = useState<string>('');

  // Internal tracking refs to prevent race conditions & stale closures
  const lastProcessedRef = useRef<string>('');
  const currentActiveRef = useRef<{
    period: string;
    size: 'BIG' | 'SMALL';
    n1: number;
    n2: number;
  } | null>(null);
  const rawHistoryRef = useRef<HistoryItem[]>([]);
  const levelRef = useRef<number>(0);
  levelRef.current = level;
  const isSyncingRef = useRef<boolean>(false);

  // Admin Panel & 5-Tap Gesture state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lunar_admin_authed') === 'true';
  });
  const [showAdminKeyPrompt, setShowAdminKeyPrompt] = useState<boolean>(false);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  const [adminKeyInput, setAdminKeyInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string>('');
  const tapTimesRef = useRef<number[]>([]);

  // 5-Tap gesture detection on "LUNAR AI" to open/hide admin panel
  const handleLunarAiTap = () => {
    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.filter((t) => now - t < 3500), now];

    if (tapTimesRef.current.length >= 3) {
      sound.play('tick');
    }

    if (tapTimesRef.current.length >= 5) {
      tapTimesRef.current = [];
      sound.play('unlock');

      if (isAdminAuthenticated) {
        // Toggle open/hide if already authorized
        setShowAdminPanel((prev) => !prev);
      } else {
        // Prompt for secret key 'karthik papa'
        setShowAdminKeyPrompt(true);
      }
    }
  };

  // Verify secret admin key 'karthik papa'
  const handleVerifyAdminKey = () => {
    sound.init();
    const key = adminKeyInput.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key === ADMIN_KEY_SECRET || key === 'karthikpapa') {
      sound.play('win');
      setIsAdminAuthenticated(true);
      try {
        sessionStorage.setItem('lunar_admin_authed', 'true');
      } catch {
        // ignore
      }
      setShowAdminKeyPrompt(false);
      setShowAdminPanel(true);
      setAdminKeyInput('');
      setAdminAuthError('');
    } else {
      sound.play('error');
      setAdminAuthError('INVALID ADMIN KEY! ACCESS DENIED');
    }
  };

  // Audio unlock listener on first user interaction
  useEffect(() => {
    const handleFirstGesture = () => {
      sound.init();
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    return () => window.removeEventListener('pointerdown', handleFirstGesture);
  }, []);

  // Sync sound toggle
  const handleToggleSound = () => {
    const nextState = sound.toggle();
    setIsSoundOn(nextState);
  };

  // Auth checker with Server-Side Single Device Binding & 3-Attempt 1-Hour Lockout
  const handleCheckAuth = async () => {
    sound.init();

    // Guard: Check if user is currently locked out
    if (isLockedOut) {
      sound.play('error');
      setAuthError(`SYSTEM LOCKED OUT! TRY AGAIN IN ${formatLockoutTime(lockoutSecsLeft)}`);
      setShakeField(true);
      setTimeout(() => setShakeField(false), 500);
      return;
    }

    const key = accessKeyInput.trim();

    if (!key) {
      setAuthError('PLEASE ENTER YOUR ACCESS KEY');
      setShakeField(true);
      setTimeout(() => setShakeField(false), 500);
      sound.play('error');
      return;
    }

    setAuthError('');
    setAuthStatus('VERIFYING ACCESS KEY & DEVICE LOCK...');

    // Quick admin key bypass on login field
    const normalizedAdmin = key.toLowerCase().replace(/\s+/g, ' ');
    if (normalizedAdmin === ADMIN_KEY_SECRET || normalizedAdmin === 'karthikpapa') {
      sound.play('unlock');
      setIsAdminAuthenticated(true);
      try {
        sessionStorage.setItem('lunar_admin_authed', 'true');
        localStorage.removeItem('lunar_failed_attempts');
        localStorage.removeItem('lunar_lockout_until');
      } catch {
        // ignore
      }
      setFailedAttempts(0);
      setLockoutUntil(0);
      setLockoutSecsLeft(0);
      setAuthStatus('ADMIN MASTER ACCESS GRANTED');
      setTimeout(() => {
        setIsAuthenticated(true);
        setAuthStatus('');
      }, 550);
      return;
    }

    // Server verification enforcing 1 Key per Device lock
    const res = await verifyLicenseKey(key);
    if (res.valid) {
      sound.play('unlock');
      // Reset failed attempts on successful login
      setFailedAttempts(0);
      setLockoutUntil(0);
      setLockoutSecsLeft(0);
      try {
        localStorage.removeItem('lunar_failed_attempts');
        localStorage.removeItem('lunar_lockout_until');
      } catch {
        // ignore
      }
      setAuthStatus(res.message || 'ACCESS GRANTED · DEVICE VERIFIED');
      setTimeout(() => {
        setIsAuthenticated(true);
        setAuthStatus('');
      }, 600);
    } else {
      sound.play('error');
      setAuthStatus('');
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setShakeField(true);
      setTimeout(() => setShakeField(false), 500);

      if (newAttempts >= 3) {
        // Lockout for 1 hour (3600 seconds)
        const lockTime = Date.now() + 60 * 60 * 1000;
        setLockoutUntil(lockTime);
        setLockoutSecsLeft(3600);
        try {
          localStorage.setItem('lunar_failed_attempts', '3');
          localStorage.setItem('lunar_lockout_until', String(lockTime));
        } catch {
          // ignore
        }
        setAuthError('3 WRONG KEY ATTEMPTS! ACCESS LOCKED FOR 1 HOUR.');
      } else {
        try {
          localStorage.setItem('lunar_failed_attempts', String(newAttempts));
        } catch {
          // ignore
        }
        setAuthError(`${res.message || 'INVALID ACCESS KEY'} (${newAttempts}/3 ATTEMPTS - 3 WRONG = 1HR LOCKOUT)`);
      }
    }
  };

  // Countdown timer loop (syncs with real-world seconds 0-59)
  useEffect(() => {
    if (!isAuthenticated) return;

    const tick = () => {
      const now = new Date();
      const sec = now.getSeconds();
      const left = (60 - sec) % 60;
      setSecondsLeft(left);

      // Warning ticks on 5, 4, 3, 2, 1 seconds
      if (left > 0 && left <= 5) {
        sound.play('tick');
      }
    };

    tick();
    const timerInterval = setInterval(tick, 1000);
    return () => clearInterval(timerInterval);
  }, [isAuthenticated]);

  // Main Wingo sync engine loop: runs continuously every 1 second in background
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const runSync = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        const data = await fetchLiveWingoHistory();
        if (!isMounted || !data || !data.list || data.list.length === 0) {
          isSyncingRef.current = false;
          return;
        }

        const list = data.list;
        const latest = list[0];
        const issue = String(latest.issueNumber);

        const rawHistory: HistoryItem[] = list
          .map((item) => ({ number: item.number }))
          .filter((item) => Number.isInteger(item.number) && item.number >= 0 && item.number <= 9);

        rawHistoryRef.current = rawHistory;

        let justResolved = false;

        // Check if an existing predicted round has now resolved
        // We look for any match: either latest issue or in recent list where issueNumber === currentActiveRef.current.period
        const pendingPrediction = currentActiveRef.current;
        if (pendingPrediction && lastProcessedRef.current !== issue) {
          const predP = pendingPrediction.period.trim();
          const matchedItem =
            list.find((item) => String(item.issueNumber).trim() === predP) ||
            list.find((item) => String(item.issueNumber).trim().slice(-4) === predP.slice(-4)) ||
            (predP === issue ? latest : null);

          if (matchedItem && lastProcessedRef.current !== String(matchedItem.issueNumber)) {
            const resolvedIssue = String(matchedItem.issueNumber);
            const n = matchedItem.number;
            const sz: 'BIG' | 'SMALL' = n >= 5 ? 'BIG' : 'SMALL';
            let status: 'WIN' | 'LOSS' | 'JACKPOT' = 'LOSS';

            if (n === pendingPrediction.n1 || n === pendingPrediction.n2) {
              status = 'JACKPOT';
            } else if (sz === pendingPrediction.size) {
              status = 'WIN';
            }

            const isGood = status !== 'LOSS';

            // Update stats
            if (status === 'JACKPOT') {
              setJackpotsCount((prev) => prev + 1);
            } else if (isGood) {
              setWinsCount((prev) => prev + 1);
            } else {
              setLossesCount((prev) => prev + 1);
            }

            // Martingale level progression (reset to 0 on win/jackpot, advance on loss up to L3)
            const currentLvl = levelRef.current;
            const nextLvl = isGood ? 0 : Math.min(3, currentLvl + 1);
            setLevel(nextLvl);
            levelRef.current = nextLvl;

            // Append to session log
            const newLog: SessionRecord = {
              p: resolvedIssue.slice(-4),
              num: n,
              s: sz,
              pred: pendingPrediction.size,
              status,
              won: isGood,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setSessionLogs((prev) => [newLog, ...prev.slice(0, 99)]);

            // Trigger result modal (auto closes in exactly 6 seconds, zero confetti!)
            setModalData({
              type: status,
              period: resolvedIssue.slice(-4),
              number: n,
              size: sz,
              predicted: pendingPrediction.size,
              level: `L${currentLvl}`,
            });

            lastProcessedRef.current = resolvedIssue;
            justResolved = true;

            // Reset currentActiveRef to immediately force next pattern detection on loss or win
            currentActiveRef.current = null;
          }
        }

        // Calculate next period
        let nextP = '';
        try {
          nextP = (BigInt(issue) + 1n).toString();
        } catch {
          const numPart = parseInt(issue.slice(-6), 10) + 1;
          nextP = issue.slice(0, -6) + String(numPart).padStart(6, '0');
        }

        // Fast pattern detection (<0.01s): Recomputes immediately upon round completion (Win or Loss) or period progression
        if (!currentActiveRef.current || currentActiveRef.current.period !== nextP || justResolved) {
          const pred = getPrediction(rawHistory, nextP);
          if (!('error' in pred)) {
            const trend = pred.prediction;
            const [n1, n2] = pred.jodi;

            currentActiveRef.current = {
              period: nextP,
              size: trend,
              n1,
              n2,
            };

            setCurrentPeriod(nextP);
            setPredictedSignal(trend);
            setTargetNum1(n1);
            setTargetNum2(n2);
            setConfidence(pred.analysis.confidence || 95);
            setDetectedPatternInfo(pred.analysis);

            // Orb pulse effect
            setOrbPulsing(true);
            setTimeout(() => setOrbPulsing(false), 900);

            sound.play('signal');
          }
        }
      } catch {
        // network retry on next tick
      } finally {
        isSyncingRef.current = false;
      }
    };

    runSync();
    const interval = setInterval(runSync, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Fast manual pattern re-scan (runs in <0.01s)
  const handleManualRescan = () => {
    sound.play('click');
    const hist = rawHistoryRef.current;
    if (!hist || hist.length === 0) return;
    const targetP = currentPeriod !== '----' ? currentPeriod : '20261110100011150';
    const pred = getPrediction(hist, targetP);
    if (!('error' in pred)) {
      const trend = pred.prediction;
      const [n1, n2] = pred.jodi;
      currentActiveRef.current = {
        period: targetP,
        size: trend,
        n1,
        n2,
      };
      setPredictedSignal(trend);
      setTargetNum1(n1);
      setTargetNum2(n2);
      setConfidence(pred.analysis.confidence || 95);
      setDetectedPatternInfo(pred.analysis);
      setOrbPulsing(true);
      setTimeout(() => setOrbPulsing(false), 900);
      sound.play('signal');
    }
  };

  // Exact Copy Format requested by user
  const handleCopySignal = async () => {
    sound.play('click');
    const period = currentPeriod !== '----' ? currentPeriod : '20261110100011150';
    const lvl = `L${level}`;
    const signalUpper = predictedSignal === 'BIG' ? 'BIG' : 'SMALL';
    const n1 = targetNum1 !== null ? targetNum1 : 4;
    const n2 = targetNum2 !== null ? targetNum2 : 7;

    // Mathematical Sans-Serif Bold Unicode mapping
    const boldPeriod = toBoldUnicode(period);
    const boldSignal = toBoldUnicode(signalUpper);
    const boldNum = `${toBoldUnicode(String(n1))} / ${toBoldUnicode(String(n2))}`;
    const boldLvl = toBoldUnicode(lvl);

    const formattedCopyText = `━━━━━━━━━━━━━━━━\n🌒 𝗟𝗨𝗡𝗔𝗥 𝗔𝗜 🌒\n━━━━━━━━━━━━━━━━\n📅 𝗣𝗘𝗥𝗜𝗢𝗗 : ${boldPeriod}\n🎯 𝗦𝗜𝗚𝗡𝗔𝗟 : ${boldSignal}\n🔢 𝗡𝗨𝗠𝗕𝗘𝗥 : ${boldNum}\n🎮 𝗟𝗘𝗩𝗘𝗟 : ${boldLvl}`;

    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(formattedCopyText);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = formattedCopyText;
        textarea.setAttribute('readonly', '');
        Object.assign(textarea.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          opacity: '0.01',
          zIndex: '-1',
        });
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    setCopiedText(copied ? '✓ PREDICTION COPIED' : 'COPY FAILED');
    setTimeout(() => setCopiedText(''), 2200);
  };

  // Clear session history
  const handleClearHistory = () => {
    sound.play('click');
    if (!window.confirm('Clear all session history and WIN / LOSS / JACKPOT counts?')) return;
    setSessionLogs([]);
    setWinsCount(0);
    setLossesCount(0);
    setJackpotsCount(0);
    setLevel(0);
  };

  // Stats calculation
  const totalRounds = sessionLogs.length;
  const goodRounds = winsCount + jackpotsCount;
  const winRate = totalRounds > 0 ? Math.round((goodRounds / totalRounds) * 100) : 0;
  const rateDashoffset = (238.76 * (1 - winRate / 100)).toFixed(2);

  const handleCloseModal = useCallback(() => {
    setModalData(null);
  }, []);

  // Badge URLs
  const signalBadgeUrl = predictedSignal === 'BIG' ? '/badges/big.png' : '/badges/small.png';

  return (
    <div className="relative min-h-screen bg-[#03050a] text-[#f1f5f9] overflow-hidden flex flex-col font-body font-bold">
      {/* Background Layers with crossfade */}
      <div
        className="bg-layer"
        style={{
          opacity: isAuthenticated ? 0 : 1,
          backgroundImage: `linear-gradient(180deg, rgba(3,5,10,0.15) 0%, rgba(13,10,28,0.45) 45%, rgba(3,5,10,0.95) 100%), url(${BG_LOGIN_DATA_URL})`,
          animation: 'moonDrift 28s ease-in-out infinite alternate',
        }}
      />
      <div
        className="bg-layer"
        style={{
          opacity: isAuthenticated ? 1 : 0,
          backgroundImage: `linear-gradient(180deg, rgba(13,10,28,0.85) 0%, rgba(8,6,18,0.7) 50%, rgba(3,5,10,0.92) 100%), url(${BG_DASH_DATA_URL})`,
        }}
      />

      {/* Dynamic Starfield */}
      <Starfield />

      {/* Cyber Vignette */}
      <div className="bg-vignette" />

      {/* Celebratory Result Modal with 6-second auto dismiss & zero confetti bombs */}
      <ResultModal data={modalData} onClose={handleCloseModal} />

      {/* Secret Admin Panel Modal (1D, 3D, 7D, 365D Key Generator & Device Locks) */}
      <AdminPanelModal
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        adminSecret={ADMIN_KEY_SECRET}
      />

      {/* Secret Admin Key Prompt (Triggered by 5 Taps on "LUNAR AI") */}
      {showAdminKeyPrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm p-6 rounded-3xl bg-[rgba(16,12,34,0.96)] border-2 border-[#ffd700] shadow-[0_20px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(255,215,0,0.35)] text-center animate-rise">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#ffd700] to-[#b45309] text-black font-black grid place-items-center text-3xl shadow-[0_0_25px_rgba(255,215,0,0.6)]">
              👑
            </div>

            <h3 className="font-display font-black text-lg text-white tracking-wider">
              ADMIN VERIFICATION
            </h3>
            <p className="text-xs text-[#94a3b8] font-bold mt-1 mb-4 leading-relaxed">
              5-Tap secret gesture detected! Enter admin key to open VIP Panel:
            </p>

            <div className="relative mb-3">
              <input
                type="password"
                value={adminKeyInput}
                onChange={(e) => {
                  setAdminKeyInput(e.target.value);
                  setAdminAuthError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyAdminKey()}
                placeholder="ENTER SECRET ADMIN KEY"
                className="w-full py-3.5 px-4 rounded-xl bg-[rgba(5,4,12,0.9)] border border-[rgba(255,215,0,0.4)] text-white text-center font-black tracking-widest text-sm outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-[#ffd700]/30 placeholder:text-[#64748b] placeholder:tracking-normal placeholder:text-xs"
                autoFocus
              />
            </div>

            {adminAuthError && (
              <p className="text-xs font-black text-[#ff2a5f] mb-3 animate-shake">
                {adminAuthError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  sound.play('click');
                  setShowAdminKeyPrompt(false);
                  setAdminKeyInput('');
                  setAdminAuthError('');
                }}
                className="flex-1 py-3 rounded-xl bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.2)] text-[#cbd5e1] font-black text-xs cursor-pointer hover:bg-white/15 transition-colors"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={handleVerifyAdminKey}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#f59e0b] text-[#03050a] font-display font-black text-xs uppercase tracking-wider cursor-pointer shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:brightness-110 active:scale-98 transition-all"
              >
                OPEN PANEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shell Container */}
      <div className="app-container">
        {!isAuthenticated ? (
          /* ================= LOGIN SCREEN ================= */
          <section className="flex-1 flex flex-col items-center justify-end p-5 pb-6 overflow-y-auto animate-rise">
            {/* 5-Tap Target on LUNAR AI Title */}
            <div
              className="text-center mb-5 cursor-pointer select-none active:scale-98 transition-transform"
              onClick={handleLunarAiTap}
              title="Tap 5 times to open Admin Panel"
            >
              <div className="relative w-28 h-28 mx-auto mb-3.5">
                <div className="absolute -inset-3 rounded-full border border-[rgba(168,85,247,0.5)] border-t-[#00ff9d] animate-spin-outer pointer-events-none" />
                <div className="absolute -inset-6 rounded-full border border-dashed border-[rgba(0,240,255,0.3)] animate-spin-outer-dashed pointer-events-none" />
                <img
                  src={LOGO_DATA_URL}
                  alt="LUNAR AI logo"
                  className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_24px_rgba(168,85,247,0.6)] animate-float"
                />
              </div>

              <h1 className="font-display font-black text-4xl tracking-widest bg-gradient-to-b from-white via-[#f1f5f9] to-[#c084fc] bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(168,85,247,0.4)]">
                LUNAR <em className="not-italic bg-gradient-to-b from-[#ffd700] via-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">AI</em>
              </h1>
            </div>

            {/* Login Glass Card */}
            <div className="relative w-full p-5 rounded-[26px] bg-gradient-to-br from-[rgba(20,14,40,0.92)] to-[rgba(7,5,16,0.96)] border border-[rgba(168,85,247,0.38)] backdrop-blur-2xl shadow-[0_30px_70px_rgba(0,0,0,0.7)] overflow-hidden">
              <div className="absolute -left-1/3 top-0 w-[180%] h-[1.5px] bg-gradient-to-r from-transparent via-[#a855f7] to-[#00f0ff] animate-scanline pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-black text-[11px] tracking-wider text-[#f1f5f9]">
                  SECURE HACK ACCESS
                </span>
                <span className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[10px] font-black tracking-widest text-[#00ff9d] border border-[rgba(0,255,157,0.4)] bg-[rgba(0,255,157,0.1)]">
                  <i className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_8px_#00ff9d] animate-[blink_1.2s_infinite]" />
                  ENCRYPTED
                </span>
              </div>

              {/* Lockout Warning Banner when 3 wrong attempts reached */}
              {isLockedOut && (
                <div className="mb-4 p-3.5 rounded-2xl bg-[rgba(255,42,95,0.18)] border border-[rgba(255,42,95,0.45)] text-center animate-pulse shadow-[0_0_20px_rgba(255,42,95,0.25)]">
                  <div className="text-[11px] font-black text-[#ff2a5f] uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span>⛔</span> 1-HOUR SECURITY LOCKOUT ACTIVE
                  </div>
                  <div className="text-xs font-mono font-black text-white mt-1">
                    TRY AGAIN IN: <span className="text-[#ffd700] text-sm font-black">{formatLockoutTime(lockoutSecsLeft)}</span>
                  </div>
                  <div className="text-[9px] text-[#94a3b8] mt-1 font-bold">
                    3 invalid key attempts entered. System locked for 1 hour to protect VIP access.
                  </div>
                </div>
              )}

              {/* Password Field (Strictly Masked, No Key Visible Anywhere!) */}
              <div className={`relative mb-4 ${shakeField ? 'animate-shake' : ''}`}>
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base opacity-75">
                  🔐
                </span>
                <input
                  type={showKeyText ? 'text' : 'password'}
                  value={accessKeyInput}
                  disabled={isLockedOut}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLockedOut && handleCheckAuth()}
                  placeholder={isLockedOut ? `LOCKED OUT (${formatLockoutTime(lockoutSecsLeft)})` : 'ENTER ACCESS KEY'}
                  className={`w-full py-4 pl-11 pr-11 rounded-2xl bg-[rgba(5,4,12,0.85)] border text-[#f1f5f9] font-black text-sm tracking-widest outline-none transition-all placeholder:text-[#64748b] placeholder:tracking-wider ${
                    isLockedOut
                      ? 'border-[#ff2a5f]/50 opacity-60 cursor-not-allowed'
                      : 'border-[rgba(168,85,247,0.35)] focus:border-[#00f0ff] focus:ring-4 focus:ring-[rgba(0,240,255,0.15)]'
                  }`}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={isLockedOut}
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8] hover:text-[#00f0ff] cursor-pointer transition-colors disabled:opacity-40"
                  title={showKeyText ? 'Hide password' : 'Show password'}
                >
                  {showKeyText ? '👁️' : '🔒'}
                </button>
              </div>

              {/* Unlock Button */}
              <button
                type="button"
                disabled={isLockedOut}
                onClick={handleCheckAuth}
                className={`relative w-full py-4 px-3 rounded-2xl overflow-hidden font-display font-black text-xs tracking-[2.5px] transition-all ${
                  isLockedOut
                    ? 'bg-[rgba(255,42,95,0.25)] border border-[#ff2a5f]/40 text-[#ff2a5f] opacity-70 cursor-not-allowed'
                    : 'text-[#03050a] bg-gradient-to-r from-[#00ff9d] via-[#00f0ff] to-[#a855f7] shadow-[0_12px_30px_rgba(0,240,255,0.3)] cursor-pointer active:scale-98'
                }`}
              >
                {!isLockedOut && (
                  <div className="absolute top-0 -left-[60%] w-[40%] h-full bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-[-20deg] animate-sheen pointer-events-none" />
                )}
                {isLockedOut ? `⛔ LOCKED OUT (${formatLockoutTime(lockoutSecsLeft)})` : 'UNLOCK LUNAR AI'}
              </button>

              {/* Status or Error Message */}
              {authStatus && (
                <p className="min-h-[18px] mt-3 text-center text-xs font-black tracking-wide text-[#00ff9d]">
                  {authStatus}
                </p>
              )}
              {authError && (
                <p className="min-h-[18px] mt-3 text-center text-xs font-black tracking-wide text-[#ff2a5f]">
                  {authError}
                </p>
              )}
            </div>

            {/* Telegram Links */}
            <div className="grid grid-cols-2 gap-2.5 w-full mt-3.5">
              <a
                href={TELEGRAM_VIP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.play('click')}
                className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border border-[rgba(255,215,0,0.55)] text-[#ffd700] bg-gradient-to-r from-[rgba(50,35,10,0.7)] to-[rgba(20,14,4,0.85)] shadow-[0_0_25px_rgba(255,215,0,0.25)] font-black text-xs tracking-wider cursor-pointer hover:border-[#ffd700] transition-all"
              >
                <span className="w-5 h-5 rounded-full bg-[#2aa3e0] text-white text-[10px] grid place-items-center font-bold">
                  ➤
                </span>
                JOIN VIP
              </a>

              <a
                href={TELEGRAM_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.play('click')}
                className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border border-[rgba(168,85,247,0.38)] text-[#f1f5f9] bg-[rgba(13,10,28,0.85)] backdrop-blur-md font-black text-xs tracking-wider cursor-pointer hover:border-[#00f0ff] transition-all"
              >
                💬 @Mitheshhhh
              </a>
            </div>

            <div className="mt-4 text-[10px] font-black tracking-widest text-[#94a3b8] uppercase">
              © 2026 LUNAR AI · ALL RIGHTS RESERVED
            </div>
          </section>
        ) : (
          /* ================= DASHBOARD ================= */
          <section className="flex-1 flex flex-col min-h-0 animate-rise">
            {/* Topbar */}
            <header className="flex items-center gap-2.5 py-3 px-4">
              <div
                className="flex items-center gap-2.5 cursor-pointer select-none active:scale-98 transition-transform"
                onClick={handleLunarAiTap}
                title="Tap 5 times to open/hide Admin Panel"
              >
                <img
                  src={LOGO_DATA_URL}
                  alt="Lunar Logo"
                  className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]"
                />
                <div>
                  <div className="font-display font-black text-lg tracking-wider">
                    LUNAR <em className="not-italic text-[#ffd700]">AI</em>
                  </div>
                  <div className="font-body text-[9px] font-black tracking-widest text-[#a855f7]">
                    WINGO 1M · NEURAL ENGINE
                  </div>
                </div>
              </div>

              <div className="flex-1" />

              {/* Live pill */}
              <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-[10px] font-black tracking-widest text-[#00ff9d] border border-[rgba(0,255,157,0.4)] bg-[rgba(4,30,22,0.7)] shadow-[0_0_15px_rgba(0,255,157,0.2)]">
                <i className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_8px_#00ff9d] animate-[blink_1s_infinite]" />
                LIVE
              </div>

              {/* Sound Toggle Button (Sound Mute Option) */}
              <button
                type="button"
                onClick={handleToggleSound}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-[rgba(168,85,247,0.38)] bg-[rgba(13,10,28,0.85)] text-xs font-black cursor-pointer hover:border-[#00f0ff] transition-colors"
                title={isSoundOn ? 'Mute Sound' : 'Unmute Sound'}
              >
                <span>{isSoundOn ? '🔊' : '🔇'}</span>
                <span className="text-[10px] hidden sm:inline">{isSoundOn ? 'SOUND' : 'MUTED'}</span>
              </button>
            </header>

            {/* TAB: SIGNAL (HOME) */}
            {activeTab === 'home' && (
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 animate-view-in">
                {/* Clean, Perfectly Centered Timer & Period Strip */}
                <div className="glass flex items-center justify-between p-3.5 px-4 mb-3 border-[rgba(168,85,247,0.35)] shadow-[0_12px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                  {/* Left: Period Block */}
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#a855f7]">
                        NEXT PERIOD
                      </span>
                    </div>
                    <div className="font-display font-black text-2xl tracking-wider text-white mt-0.5 truncate">
                      #{currentPeriod !== '----' ? currentPeriod.slice(-5) : '----'}
                    </div>
                    <div className="text-[9px] font-mono font-bold text-[#64748b] tracking-wider truncate">
                      {currentPeriod}
                    </div>
                  </div>

                  {/* Right: Perfectly Contained Circular Timer */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                        CLOSES IN
                      </div>
                      <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider text-[#00ff9d] bg-[rgba(0,255,157,0.12)] border border-[rgba(0,255,157,0.3)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-ping" />
                        LIVE
                      </div>
                    </div>

                    {/* Circular SVG Timer: fully contained inside 56x56 px */}
                    <div className="relative w-14 h-14 shrink-0 grid place-items-center">
                      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                        <circle
                          cx="28"
                          cy="28"
                          r="23"
                          fill="none"
                          strokeWidth="4.5"
                          className="stroke-[rgba(168,85,247,0.2)]"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="23"
                          fill="none"
                          strokeWidth="4.5"
                          strokeDasharray="144.51"
                          strokeDashoffset={(144.51 * (1 - secondsLeft / 60)).toFixed(2)}
                          strokeLinecap="round"
                          className="transition-[stroke-dashoffset] duration-900 ease-linear"
                          style={{
                            stroke: secondsLeft <= 5 ? '#ff2a5f' : secondsLeft <= 15 ? '#ffd700' : '#00f0ff',
                            filter: secondsLeft <= 5 ? 'drop-shadow(0 0 8px rgba(255,42,95,0.8))' : 'drop-shadow(0 0 6px rgba(0,240,255,0.6))',
                          }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`font-display font-black text-sm tracking-wider ${secondsLeft <= 5 ? 'text-[#ff2a5f] animate-pulse' : 'text-white'}`}>
                          {String(secondsLeft).padStart(2, '0')}s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Signal Display Card with 3D Orb & Official User Badges */}
                <div className="glass relative p-5 px-4 mb-3 text-center overflow-hidden border-[rgba(168,85,247,0.35)] shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
                  {/* Subtle inner radial glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(168,85,247,0.2),transparent_55%)] pointer-events-none" />

                  {/* Header chips */}
                  <div className="relative z-10 flex justify-end items-center">
                    <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-black tracking-widest text-[#ffd700] border border-[rgba(255,215,0,0.4)] bg-[rgba(5,4,12,0.65)]">
                      LEVEL L{level}
                    </span>
                  </div>

                  {/* Orb Zone */}
                  <div className="relative w-[216px] h-[216px] mx-auto my-3">
                    {/* Orbit 2: Cyan spinning arc */}
                    <div className="absolute -inset-6 rounded-full border-2 border-transparent border-t-[rgba(0,240,255,0.7)] border-r-[rgba(168,85,247,0.25)] animate-spin-fast pointer-events-none" />

                    {/* Orbit 1: Dashed ring with gold moonlet */}
                    <div className="absolute -inset-3 rounded-full border border-dashed border-[rgba(168,85,247,0.4)] animate-spin-slow pointer-events-none">
                      <div className="absolute -top-[5px] left-1/2 w-2.5 h-2.5 -ml-[5px] rounded-full bg-[#ffd700] shadow-[0_0_16px_#ffd700]" />
                    </div>

                    {/* Lunar Orb Sphere */}
                    <div className={`lunar-orb ${orbPulsing ? 'animate-orb-pulse' : ''}`}>
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                        Next Signal
                      </div>

                      {/* Official Big / Small Badge Image Render */}
                      <div className="my-1.5 flex flex-col items-center justify-center">
                        {predictedSignal !== 'SCANNING' ? (
                          <div className="relative group">
                            <img
                              src={signalBadgeUrl}
                              alt={predictedSignal}
                              className="w-24 h-24 object-contain drop-shadow-[0_0_24px_rgba(168,85,247,0.8)] animate-pulse"
                            />
                            <div
                              className={`font-display font-black text-xl tracking-widest mt-0.5 ${
                                predictedSignal === 'BIG'
                                  ? 'text-[#ff9900] drop-shadow-[0_0_20px_rgba(255,153,0,0.7)]'
                                  : 'text-[#00e5ff] drop-shadow-[0_0_20px_rgba(0,229,255,0.7)]'
                              }`}
                            >
                              {predictedSignal}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xl font-display font-black text-[#cbd5e1] animate-[blink_1.2s_infinite]">
                            SCANNING...
                          </div>
                        )}
                      </div>

                      {/* Jodi Lucky Number Official Badges (0-9) */}
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] mr-0.5">
                          JODI:
                        </span>
                        {targetNum1 !== null ? (
                          <img
                            src={`/badges/num_${targetNum1}.png`}
                            alt={`Lucky ${targetNum1}`}
                            className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] transition-transform hover:scale-110"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#1a0f35] border border-[#a855f7] grid place-items-center text-xs">?</div>
                        )}

                        {targetNum2 !== null ? (
                          <img
                            src={`/badges/num_${targetNum2}.png`}
                            alt={`Lucky ${targetNum2}`}
                            className="w-9 h-9 object-contain drop-shadow-[0_0_14px_rgba(255,215,0,0.5)] transition-transform hover:scale-110"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#1a0f35] border border-[#a855f7] grid place-items-center text-xs">?</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3 Summary Tiles */}
                  <div className="grid grid-cols-3 gap-2 relative z-10">
                    <div className="py-2.5 px-1.5 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)]">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                        Period
                      </div>
                      <div className="font-display font-black text-xs text-[#00f0ff] mt-0.5 truncate">
                        #{currentPeriod.slice(-4)}
                      </div>
                    </div>

                    <div className="py-2.5 px-1.5 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)]">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                        Level
                      </div>
                      <div className="font-display font-black text-xs text-[#ffd700] mt-0.5">
                        L{level}
                      </div>
                    </div>

                    <div className="py-2.5 px-1.5 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)]">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                        Rounds
                      </div>
                      <div className="font-display font-black text-xs text-white mt-0.5">
                        {totalRounds}
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Interactive Pattern Grid (BSSB, BBB, SSS, BBBSSS, SSSBBB, SBBS, BSBS, SSBB & DRAGON) */}
                <div className="glass p-3.5 px-3 mb-3 border-[rgba(168,85,247,0.35)] shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#f1f5f9]">
                        ACTIVE PATTERNS DETECTOR
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-black text-[#00f0ff]">
                      ⚡ &lt;0.01s ULTRA-FAST
                    </span>
                  </div>

                  {/* Grid matching user attachment photo */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {CORE_PATTERNS.map((item) => {
                      const isActive =
                        detectedPatternInfo.activePatternId === item.id ||
                        detectedPatternInfo.patternDetected.toUpperCase().includes(item.id);

                      const isBigTarget = item.target === 'BIG';
                      const isSmallTarget = item.target === 'SMALL';

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            sound.play('click');
                            handleManualRescan();
                          }}
                          className={`relative p-2.5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
                            isActive
                              ? 'border-2 border-[#00ff9d] bg-[rgba(0,255,157,0.15)] shadow-[0_0_20px_rgba(0,255,157,0.5)] ring-2 ring-[#00ff9d]/30 scale-[1.03] z-10'
                              : 'border border-[rgba(168,85,247,0.3)] bg-[rgba(10,8,24,0.85)] hover:border-[rgba(0,240,255,0.6)]'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#00ff9d] shadow-[0_0_8px_#00ff9d] animate-ping" />
                          )}
                          <span className="font-display font-black text-xs sm:text-sm text-white tracking-wider">
                            {item.label}
                          </span>
                          <span
                            className={`text-[9px] sm:text-[10px] font-black tracking-wide mt-1 flex items-center gap-0.5 ${
                              isBigTarget
                                ? 'text-[#ff9900]'
                                : isSmallTarget
                                ? 'text-[#00e5ff]'
                                : 'text-[#ffd700]'
                            }`}
                          >
                            <span>→</span>
                            <span>{item.target}</span>
                          </span>
                        </div>
                      );
                    })}

                    {/* Dedicated RUN 0.01s Cyan Action Button as shown in photo */}
                    <button
                      type="button"
                      onClick={handleManualRescan}
                      className="relative p-2.5 rounded-2xl border-2 border-[#00f0ff] bg-[rgba(0,240,255,0.12)] text-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.35)] flex flex-col items-center justify-center cursor-pointer hover:bg-[rgba(0,240,255,0.22)] active:scale-95 transition-all select-none"
                      title="Run pattern detection (<0.01s)"
                    >
                      <span className="font-display font-black text-xs sm:text-sm tracking-wider flex items-center gap-1">
                        ▶ RUN
                      </span>
                      <span className="font-mono text-[9px] text-[#00ff9d] font-bold mt-0.5">
                        0.01s
                      </span>
                    </button>
                  </div>
                </div>

                {/* Neural Pattern HUD Bar (Monitors BSSB, BBB, SSS, BBBSSS, SSSBBB, SBBS, BSBS, SSBB & DRAGON PATTERN) */}
                <div className="glass p-3 px-4 mb-3 border-[rgba(0,255,157,0.35)] shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#00ff9d]">
                        NEURAL PATTERN ENGINE
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-black text-[#00f0ff] px-2 py-0.5 rounded-full bg-[rgba(0,240,255,0.12)] border border-[rgba(0,240,255,0.3)]">
                      ⚡ &lt;0.01s DETECTED
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-[rgba(5,4,12,0.85)] border border-[rgba(168,85,247,0.25)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-[#94a3b8] uppercase tracking-wider">PATTERN:</span>
                      <span
                        className={`font-display font-black text-xs px-2 py-0.5 rounded-lg border tracking-wider ${
                          detectedPatternInfo.trendType === 'DRAGON_PATTERN'
                            ? 'bg-[rgba(255,215,0,0.2)] border-[#ffd700] text-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.4)] animate-pulse'
                            : 'bg-[rgba(0,255,157,0.15)] border-[#00ff9d] text-[#00ff9d] shadow-[0_0_10px_rgba(0,255,157,0.3)]'
                        }`}
                      >
                        {detectedPatternInfo.patternDetected}
                      </span>
                    </div>
                    <div className="text-[9px] font-black uppercase text-[#00f0ff] tracking-wider truncate max-w-[170px] text-right">
                      {detectedPatternInfo.strategy.split('[')[0].trim()}
                    </div>
                  </div>

                  {detectedPatternInfo.recentSequence && (
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[rgba(168,85,247,0.2)] text-[9px] font-mono">
                      <span className="text-[#94a3b8] uppercase tracking-wider font-bold">RECENT TREND:</span>
                      <div className="flex items-center gap-1 font-black">
                        {detectedPatternInfo.recentSequence.slice(-8).split('').map((char, idx, arr) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 rounded ${
                              char === 'B'
                                ? 'text-[#ff9900] bg-[rgba(255,153,0,0.18)]'
                                : 'text-[#00e5ff] bg-[rgba(0,229,255,0.18)]'
                            } ${idx === arr.length - 1 ? 'border border-[#00ff9d] shadow-[0_0_8px_rgba(0,255,157,0.6)] scale-110' : ''}`}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Confidence Meter */}
                <div className="glass p-3 px-4 mb-3 border-[rgba(168,85,247,0.25)]">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                      AI Prediction Confidence
                    </div>
                    <div className="font-display font-black text-xl text-[#00ff9d]">
                      {confidence}%
                    </div>
                  </div>

                  <div className="h-2.5 rounded-full bg-[rgba(5,4,12,0.85)] border border-[rgba(168,85,247,0.25)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#a855f7] via-[#00f0ff] to-[#00ff9d] shadow-[0_0_14px_rgba(0,255,157,0.6)] transition-[width] duration-900 ease-out"
                      style={{ width: `${confidence}%` }}
                    />
                  </div>

                  <div className="flex justify-between mt-1.5 text-xs opacity-75">
                    <span>🌑</span>
                    <span>🌒</span>
                    <span>🌓</span>
                    <span>🌔</span>
                    <span>🌕</span>
                  </div>
                </div>

                {/* Telegram Ready Prediction Card (Exact Bold Font Preview) */}
                <div className="glass p-4 mb-3 border-[rgba(0,240,255,0.4)] shadow-[0_12px_35px_rgba(0,240,255,0.18)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#00f0ff]">
                        TELEGRAM SIGNAL OUTPUT
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-black text-[#00ff9d] px-2 py-0.5 rounded-full bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.3)]">
                      ⚡ &lt;0.01s DETECTED
                    </span>
                  </div>

                  {/* Exact Mathematical Bold Unicode Display Box */}
                  <div className="p-3.5 rounded-xl bg-[rgba(5,4,12,0.92)] border border-[rgba(168,85,247,0.35)] font-mono text-xs font-black tracking-wide leading-relaxed shadow-inner select-all">
                    <div className="text-[#a855f7] font-black text-center tracking-wider">
                      ━━━━━━━━━━━━━━━━
                    </div>
                    <div className="text-center font-black text-[#ffd700] py-0.5 tracking-widest text-sm">
                      🌒 𝗟𝗨𝗡𝗔𝗥 𝗔𝗜 🌒
                    </div>
                    <div className="text-[#a855f7] font-black text-center tracking-wider">
                      ━━━━━━━━━━━━━━━━
                    </div>

                    <div className="mt-2 space-y-1.5 font-black text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#94a3b8] font-black">📅 𝗣𝗘𝗥𝗜𝗢𝗗 :</span>
                        <span className="text-[#00f0ff] font-black tracking-wider">
                          {toBoldUnicode(currentPeriod !== '----' ? currentPeriod : '20261110100011150')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#94a3b8] font-black">🎯 𝗦𝗜𝗚𝗡𝗔𝗟 :</span>
                        <span
                          className={`font-black tracking-wider ${
                            predictedSignal === 'BIG' ? 'text-[#ff9900]' : 'text-[#00ff9d]'
                          }`}
                        >
                          {toBoldUnicode(predictedSignal === 'BIG' ? 'BIG' : 'SMALL')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#94a3b8] font-black">🔢 𝗡𝗨𝗠𝗕𝗘𝗥 :</span>
                        <span className="text-[#ffd700] font-black tracking-wider">
                          {toBoldUnicode(String(targetNum1 !== null ? targetNum1 : 4))} / {toBoldUnicode(String(targetNum2 !== null ? targetNum2 : 7))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#94a3b8] font-black">🎮 𝗟𝗘𝗩𝗘𝗟 :</span>
                        <span className="text-[#a855f7] font-black tracking-wider">
                          {toBoldUnicode(`L${level}`)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Prominent COPY PREDICTION & Fast Re-Scan */}
                  <div className="grid grid-cols-5 gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleCopySignal}
                      className="col-span-4 py-3.5 px-4 rounded-xl font-display font-black text-xs tracking-[2px] uppercase cursor-pointer border border-[#00f0ff] bg-gradient-to-r from-[rgba(168,85,247,0.4)] via-[rgba(0,240,255,0.35)] to-[rgba(0,255,157,0.35)] text-white shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:brightness-110 active:scale-98 transition-all"
                    >
                      {copiedText || '📋 COPY PREDICTION'}
                    </button>

                    <button
                      type="button"
                      onClick={handleManualRescan}
                      title="Re-scan pattern in 0.01s"
                      className="col-span-1 py-3.5 rounded-xl font-display font-black text-sm border border-[rgba(168,85,247,0.45)] bg-[rgba(13,10,28,0.9)] text-[#a855f7] hover:text-[#00f0ff] hover:border-[#00f0ff] active:scale-95 transition-all grid place-items-center cursor-pointer"
                    >
                      ⚡
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: HISTORY (MISSION LOG) */}
            {activeTab === 'history' && (
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 animate-view-in">
                {/* Header */}
                <div className="flex items-center justify-between my-2">
                  <div>
                    <h2 className="font-display font-black text-base tracking-wider text-white">
                      MISSION LOG
                    </h2>
                    <span className="block text-[9px] font-black tracking-widest text-[#a855f7]">
                      HISTORICAL ACCURACY
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="py-1.5 px-3 rounded-xl font-black text-[10px] tracking-wider text-[#ff2a5f] border border-[rgba(255,42,95,0.45)] bg-[rgba(60,8,20,0.5)] cursor-pointer hover:bg-[rgba(60,8,20,0.8)] transition-colors"
                  >
                    ✕ CLEAR
                  </button>
                </div>

                {/* Win Rate Dial and Counts */}
                <div className="glass flex items-center gap-3.5 p-4 mb-2.5 border-[rgba(168,85,247,0.3)]">
                  <div className="relative w-[92px] h-[92px] shrink-0">
                    <svg viewBox="0 0 92 92" className="w-full h-full -rotate-90">
                      <defs>
                        <linearGradient id="rateGrad2" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#00ff9d" />
                          <stop offset="100%" stopColor="#ffd700" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="46"
                        cy="46"
                        r="38"
                        fill="none"
                        strokeWidth="8"
                        className="stroke-[rgba(168,85,247,0.15)]"
                      />
                      <circle
                        cx="46"
                        cy="46"
                        r="38"
                        fill="none"
                        strokeWidth="8"
                        stroke="url(#rateGrad2)"
                        strokeDasharray="238.76"
                        strokeDashoffset={rateDashoffset}
                        strokeLinecap="round"
                        className="transition-[stroke-dashoffset] duration-800 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display font-black text-base text-white">
                        {winRate}%
                      </span>
                      <span className="text-[8px] font-black tracking-widest text-[#94a3b8]">
                        WIN RATE
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5">
                    {/* WIN in Green */}
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.4)] text-[#00ff9d] text-xs font-black shadow-[0_0_15px_rgba(0,255,157,0.15)]">
                      <span className="flex items-center gap-1.5">
                        <i className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d]" /> WIN
                      </span>
                      <b className="font-display text-sm">{winsCount}</b>
                    </div>

                    {/* LOSS in Red */}
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[rgba(255,42,95,0.1)] border border-[rgba(255,42,95,0.4)] text-[#ff2a5f] text-xs font-black shadow-[0_0_15px_rgba(255,42,95,0.15)]">
                      <span className="flex items-center gap-1.5">
                        <i className="w-2 h-2 rounded-full bg-[#ff2a5f] shadow-[0_0_6px_#ff2a5f]" /> LOSS
                      </span>
                      <b className="font-display text-sm">{lossesCount}</b>
                    </div>

                    {/* JACKPOT in Golden */}
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[rgba(255,215,0,0.1)] border border-[rgba(255,215,0,0.4)] text-[#ffd700] text-xs font-black shadow-[0_0_15px_rgba(255,215,0,0.15)]">
                      <span className="flex items-center gap-1.5">
                        <i className="w-2 h-2 rounded-full bg-[#ffd700] shadow-[0_0_6px_#ffd700]" /> JACKPOT
                      </span>
                      <b className="font-display text-sm">{jackpotsCount}</b>
                    </div>
                  </div>
                </div>

                {/* Total rounds played */}
                <div className="glass flex items-center justify-between p-3 px-4 mb-2.5 border-[rgba(168,85,247,0.2)]">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
                    Total Rounds Played
                  </span>
                  <b className="font-display font-black text-base text-white">{totalRounds}</b>
                </div>

                {/* Results List with Official Number & Signal Badges */}
                <div className="flex flex-col gap-2">
                  {sessionLogs.length === 0 ? (
                    <div className="glass p-8 text-center text-[#94a3b8] text-xs tracking-wide border-[rgba(168,85,247,0.2)]">
                      <div className="text-3xl mb-2 opacity-80">🌑</div>
                      No rounds recorded yet in this session.
                      <br />
                      Signals will automatically record as each period resolves.
                    </div>
                  ) : (
                    sessionLogs.map((item, idx) => {
                      const isJp = item.status === 'JACKPOT';
                      const isW = item.status === 'WIN';
                      const isBig = item.s === 'BIG';

                      return (
                        <div
                          key={`${item.p}-${idx}`}
                          className={`glass flex items-center gap-3 p-2.5 px-3.5 border transition-all ${
                            isJp
                              ? 'border-[rgba(255,215,0,0.5)] bg-[rgba(255,215,0,0.04)] shadow-[0_0_20px_rgba(255,215,0,0.12)]'
                              : isW
                              ? 'border-[rgba(0,255,157,0.4)] bg-[rgba(0,255,157,0.03)] shadow-[0_0_15px_rgba(0,255,157,0.1)]'
                              : 'border-[rgba(255,42,95,0.4)] bg-[rgba(255,42,95,0.03)]'
                          }`}
                        >
                          {/* Official Number Badge Image */}
                          <img
                            src={`/badges/num_${item.num}.png`}
                            alt={`Number ${item.num}`}
                            className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                          />

                          {/* Period & Meta */}
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-black text-xs tracking-wider text-white">
                              #{item.p}
                            </div>
                            <div className="text-[11px] font-black text-[#cbd5e1] mt-0.5 flex items-center gap-1.5">
                              <span>Signal:</span>
                              <span className={item.pred === 'BIG' ? 'text-[#ff9900]' : 'text-[#00e5ff]'}>
                                {item.pred}
                              </span>
                              <span>·</span>
                              <span>Result:</span>
                              <span className={isBig ? 'text-[#ff9900]' : 'text-[#00e5ff]'}>
                                {item.s}
                              </span>
                            </div>
                          </div>

                          {/* Status Pill in specified colors: Win in Green, Loss in Red, Jackpot in Gold! */}
                          <div
                            className={`py-1.5 px-3 rounded-xl font-display font-black text-[10px] tracking-wider whitespace-nowrap border ${
                              isJp
                                ? 'text-[#ffd700] border-[#ffd700] bg-[rgba(255,215,0,0.2)] shadow-[0_0_15px_rgba(255,215,0,0.4)]'
                                : isW
                                ? 'text-[#00ff9d] border-[#00ff9d] bg-[rgba(0,255,157,0.2)] shadow-[0_0_15px_rgba(0,255,157,0.4)]'
                                : 'text-[#ff2a5f] border-[#ff2a5f] bg-[rgba(255,42,95,0.2)] shadow-[0_0_15px_rgba(255,42,95,0.4)]'
                            }`}
                          >
                            {isJp ? '♛ JACKPOT' : isW ? '✓ WIN' : '✕ LOSS'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: ABOUT (INFO & HELP) */}
            {activeTab === 'about' && (
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 animate-view-in">
                {/* Hero */}
                <div className="glass text-center p-5 px-4 mb-3 border-[rgba(168,85,247,0.3)]">
                  <img
                    src={LOGO_DATA_URL}
                    alt="Logo"
                    className="w-20 h-20 mx-auto object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.5)] animate-float"
                  />
                  <h2 className="font-display font-black text-xl tracking-wider mt-2.5">
                    LUNAR <em className="not-italic text-[#ffd700]">AI</em>
                  </h2>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-[#cbd5e1]">
                    The advanced neural pattern signal engine for Wingo 1-Minute. Evaluates live history
                    against custom trend motifs in 0.01s with double lucky Jodi predictions.
                  </p>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-2.5 mb-3">
                  <div className="glass flex gap-3 p-3.5 rounded-2xl border-[rgba(168,85,247,0.25)]">
                    <div className="w-8 h-8 shrink-0 rounded-xl grid place-items-center font-display font-black text-xs text-[#03050a] bg-gradient-to-br from-[#00ff9d] via-[#00f0ff] to-[#a855f7]">
                      1
                    </div>
                    <div>
                      <h4 className="font-display font-black text-xs tracking-wider text-white mb-1">
                        LIVE HIGH-SPEED SYNC
                      </h4>
                      <p className="text-xs text-[#cbd5e1] leading-normal font-bold">
                        Pulls live game result sequences every second through high-speed server proxies.
                      </p>
                    </div>
                  </div>

                  <div className="glass flex gap-3 p-3.5 rounded-2xl border-[rgba(168,85,247,0.25)]">
                    <div className="w-8 h-8 shrink-0 rounded-xl grid place-items-center font-display font-black text-xs text-[#03050a] bg-gradient-to-br from-[#00ff9d] via-[#00f0ff] to-[#a855f7]">
                      2
                    </div>
                    <div>
                      <h4 className="font-display font-black text-xs tracking-wider text-white mb-1">
                        0.01s PATTERN DETECTION
                      </h4>
                      <p className="text-xs text-[#cbd5e1] leading-normal font-bold">
                        Detects BSSB, SSS, BBB, BBBSSS, SSSBBB, SBBS, and BSBS patterns within 0.01 seconds.
                      </p>
                    </div>
                  </div>

                  <div className="glass flex gap-3 p-3.5 rounded-2xl border-[rgba(168,85,247,0.25)]">
                    <div className="w-8 h-8 shrink-0 rounded-xl grid place-items-center font-display font-black text-xs text-[#03050a] bg-gradient-to-br from-[#00ff9d] via-[#00f0ff] to-[#a855f7]">
                      3
                    </div>
                    <div>
                      <h4 className="font-display font-black text-xs tracking-wider text-white mb-1">
                        BIG / SMALL + JODI BADGES
                      </h4>
                      <p className="text-xs text-[#cbd5e1] leading-normal font-bold">
                        Outputs high-definition BIG/SMALL signals and 2 lucky Jodi numbers. Exact number hit triggers JACKPOT.
                      </p>
                    </div>
                  </div>

                  <div className="glass flex gap-3 p-3.5 rounded-2xl border-[rgba(168,85,247,0.25)]">
                    <div className="w-8 h-8 shrink-0 rounded-xl grid place-items-center font-display font-black text-xs text-[#03050a] bg-gradient-to-br from-[#00ff9d] via-[#00f0ff] to-[#a855f7]">
                      4
                    </div>
                    <div>
                      <h4 className="font-display font-black text-xs tracking-wider text-white mb-1">
                        MARTINGALE LEVEL (L0 – L3)
                      </h4>
                      <p className="text-xs text-[#cbd5e1] leading-normal font-bold">
                        Tracks consecutive losses, resets to L0 on any win, capping exposure at level L3.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Legend in specified colors */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="p-3 rounded-xl text-center bg-[rgba(5,4,12,0.7)] border border-[rgba(0,255,157,0.4)]">
                    <b className="block font-display font-black text-xs text-[#00ff9d] tracking-wider">
                      WIN
                    </b>
                    <span className="block mt-1 text-[10px] text-[#cbd5e1] font-bold">Size matched</span>
                  </div>

                  <div className="p-3 rounded-xl text-center bg-[rgba(5,4,12,0.7)] border border-[rgba(255,215,0,0.4)]">
                    <b className="block font-display font-black text-xs text-[#ffd700] tracking-wider">
                      JACKPOT
                    </b>
                    <span className="block mt-1 text-[10px] text-[#cbd5e1] font-bold">Number matched</span>
                  </div>

                  <div className="p-3 rounded-xl text-center bg-[rgba(5,4,12,0.7)] border border-[rgba(255,42,95,0.4)]">
                    <b className="block font-display font-black text-xs text-[#ff2a5f] tracking-wider">
                      LOSS
                    </b>
                    <span className="block mt-1 text-[10px] text-[#cbd5e1] font-bold">No match</span>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-3.5 rounded-xl mb-3 text-xs leading-relaxed text-[#ffd6dd] bg-[rgba(60,8,20,0.5)] border border-[rgba(255,42,95,0.4)] font-bold">
                  ⚠ Game results are random. LUNAR AI signals are algorithmic estimates, not a guarantee.
                  Play responsibly.
                </div>

                {/* Direct CTA Buttons */}
                <div className="flex flex-col gap-2.5">
                  <a
                    href={TELEGRAM_VIP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sound.play('click')}
                    className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border border-[rgba(255,215,0,0.6)] text-[#ffd700] bg-gradient-to-r from-[rgba(50,35,10,0.7)] to-[rgba(20,14,4,0.85)] shadow-[0_0_25px_rgba(255,215,0,0.25)] font-black text-xs tracking-wider cursor-pointer hover:border-[#ffd700] transition-all"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#2aa3e0] text-white text-[10px] grid place-items-center font-bold">
                      ➤
                    </span>
                    JOIN VIP CHANNEL
                  </a>

                  <a
                    href={TELEGRAM_SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sound.play('click')}
                    className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl border border-[rgba(168,85,247,0.4)] text-[#00f0ff] bg-[rgba(13,10,28,0.85)] backdrop-blur-md font-black text-xs tracking-wider cursor-pointer hover:border-[#00f0ff] transition-all"
                  >
                    💬 SUPPORT · @Mitheshhhh
                  </a>
                </div>
              </div>
            )}

            {/* Bottom Navigation */}
            <nav className="grid grid-cols-3 gap-1.5 mx-3 mb-3 p-1.5 rounded-[22px] bg-[rgba(10,7,22,0.92)] border border-[rgba(168,85,247,0.38)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => {
                  sound.play('click');
                  setActiveTab('home');
                }}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-2xl font-black text-[10px] tracking-wider transition-all cursor-pointer ${
                  activeTab === 'home'
                    ? 'text-[#03050a] bg-gradient-to-r from-[#00ff9d] via-[#00f0ff] to-[#a855f7] shadow-[0_6px_20px_rgba(0,240,255,0.4)]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="text-base leading-none">☾</span>
                SIGNAL
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.play('click');
                  setActiveTab('history');
                }}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-2xl font-black text-[10px] tracking-wider transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'text-[#03050a] bg-gradient-to-r from-[#00ff9d] via-[#00f0ff] to-[#a855f7] shadow-[0_6px_20px_rgba(0,240,255,0.4)]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="text-base leading-none">☷</span>
                HISTORY
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.play('click');
                  setActiveTab('about');
                }}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-2xl font-black text-[10px] tracking-wider transition-all cursor-pointer ${
                  activeTab === 'about'
                    ? 'text-[#03050a] bg-gradient-to-r from-[#00ff9d] via-[#00f0ff] to-[#a855f7] shadow-[0_6px_20px_rgba(0,240,255,0.4)]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <span className="text-base leading-none">ⓘ</span>
                ABOUT
              </button>
            </nav>
          </section>
        )}
      </div>
    </div>
  );
}
