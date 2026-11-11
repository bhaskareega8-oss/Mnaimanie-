import React, { useEffect, useState, useRef } from 'react';
import { sound } from '../services/sound';

export interface ResultModalData {
  type: 'WIN' | 'LOSS' | 'JACKPOT';
  period: string;
  number: number;
  size: 'BIG' | 'SMALL';
  predicted: 'BIG' | 'SMALL';
  level: string;
  strategy?: string;
}

interface ResultModalProps {
  data: ResultModalData | null;
  onClose: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ data, onClose }) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(6);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!data) return;

    setSecondsRemaining(6);

    // Play synthesized sound effects only (party bombs / confetti removed as requested!)
    if (data.type === 'JACKPOT') {
      sound.play('jackpot');
    } else if (data.type === 'WIN') {
      sound.play('win');
    } else {
      sound.play('loss');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 60, 80]);
      }
    }

    // Hard 6-second deadline timestamp (immune to component re-renders)
    const endTimestamp = Date.now() + 6000;

    const intervalId = setInterval(() => {
      const msLeft = endTimestamp - Date.now();
      const sec = Math.max(0, Math.ceil(msLeft / 1000));
      setSecondsRemaining(sec);

      if (msLeft <= 0) {
        clearInterval(intervalId);
        onCloseRef.current();
      }
    }, 200);

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      onCloseRef.current();
    }, 6000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [data?.period, data?.type]);

  if (!data) return null;

  const isWin = data.type === 'WIN';
  const isLoss = data.type === 'LOSS';
  const isJackpot = data.type === 'JACKPOT';

  const accentColor = isWin
    ? '#00ff9d'
    : isLoss
    ? '#ff2a5f'
    : '#ffd700';

  const signalBadge = data.predicted === 'BIG' ? '/badges/big.png' : '/badges/small.png';
  const resultBadge = `/badges/num_${data.number}.png`;

  return (
    <>
      {/* Screen flash on loss */}
      {isLoss && (
        <div className="fixed inset-0 pointer-events-none z-[9998] animate-[flash_0.9s_ease] shadow-[inset_0_0_140px_rgba(255,42,95,0.85)]" />
      )}

      {/* Main modal overlay */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_45%,rgba(13,10,28,0.85),rgba(3,5,10,0.96)_70%)] backdrop-blur-md animate-[rise_0.35s_ease-out]"
        style={{ '--c': accentColor } as React.CSSProperties}
      >
        {/* Radiating rays */}
        {(isJackpot || isWin) && (
          <div
            className={`absolute w-[780px] h-[780px] rounded-full pointer-events-none ${
              isJackpot ? 'opacity-90 animate-spin-slow' : 'opacity-40 animate-spin-slow'
            }`}
            style={{
              background: `repeating-conic-gradient(from 0deg, ${
                isJackpot ? 'rgba(255,215,0,0.35)' : 'rgba(0,255,157,0.25)'
              } 0deg 8deg, transparent 8deg 22deg)`,
              maskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
            }}
          />
        )}

        {/* Shockwave expanding rings */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span
            className="absolute w-[120px] h-[120px] rounded-full border-2 animate-[ringBurst_1.6s_cubic-bezier(0.1,0.7,0.3,1)_forwards]"
            style={{ borderColor: accentColor }}
          />
          <span
            className="absolute w-[120px] h-[120px] rounded-full border-2 animate-[ringBurst_1.6s_cubic-bezier(0.1,0.7,0.3,1)_0.18s_forwards]"
            style={{ borderColor: accentColor }}
          />
          <span
            className="absolute w-[120px] h-[120px] rounded-full border-2 animate-[ringBurst_1.6s_cubic-bezier(0.1,0.7,0.3,1)_0.36s_forwards]"
            style={{ borderColor: accentColor }}
          />
        </div>

        {/* Modal Card */}
        <div
          className={`relative w-full max-w-[340px] pt-10 px-6 pb-6 rounded-[30px] text-center border shadow-2xl backdrop-blur-2xl ${
            isLoss ? 'animate-[cardIn_0.5s_ease-out_forwards,shake_0.5s_0.5s]' : 'animate-[cardIn_0.7s_cubic-bezier(0.2,1.4,0.4,1)_forwards]'
          }`}
          style={{
            backgroundColor: 'rgba(16, 12, 34, 0.96)',
            borderColor: accentColor,
            boxShadow: `0 0 0 6px color-mix(in srgb, ${accentColor} 14%, transparent), 0 0 50px color-mix(in srgb, ${accentColor} 35%, transparent), 0 30px 80px rgba(0,0,0,0.85)`,
          }}
        >
          {/* Emblem with Official Badge */}
          <div
            className="relative w-[108px] h-[108px] -mt-24 mx-auto mb-3 grid place-items-center rounded-full border-2 shadow-2xl animate-[pop_0.7s_0.15s_cubic-bezier(0.2,1.6,0.4,1)_both]"
            style={{
              borderColor: accentColor,
              backgroundColor: '#0a0718',
              boxShadow: `0 0 40px color-mix(in srgb, ${accentColor} 60%, transparent)`,
            }}
          >
            {isWin && (
              <img
                src={signalBadge}
                alt="Win Badge"
                className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(0,255,157,0.6)] animate-float"
              />
            )}

            {isLoss && (
              <img
                src={resultBadge}
                alt="Result"
                className="w-18 h-18 object-contain filter grayscale-[30%] drop-shadow-[0_0_15px_rgba(255,42,95,0.6)]"
              />
            )}

            {isJackpot && (
              <img
                src={resultBadge}
                alt="Jackpot Badge"
                className="w-22 h-22 object-contain drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] animate-[spinIn_1s_cubic-bezier(0.2,1.2,0.4,1)]"
              />
            )}
          </div>

          {/* 6-second auto dismiss timer indicator */}
          <div className="inline-flex items-center gap-1.5 py-0.5 px-3 rounded-full text-[9px] font-black uppercase tracking-wider text-[#a855f7] bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-ping" />
            AUTO-CLOSING IN {secondsRemaining}S
          </div>

          <div className="font-body text-[10px] tracking-[3px] text-[#cbd5e1] uppercase font-black">
            {isWin
              ? '⚡ LUNAR AI · SIGNAL HIT'
              : isLoss
              ? '⚡ LUNAR AI · MISSED'
              : '👑 LUNAR AI · JACKPOT HIT'}
          </div>

          <div
            className={`my-2 font-display text-4xl font-black tracking-widest ${
              isJackpot
                ? 'text-[#ffd700]'
                : isLoss
                ? 'text-[#ff2a5f]'
                : 'text-[#00ff9d]'
            }`}
            style={{
              textShadow: isLoss
                ? '0 0 28px rgba(255,42,95,0.8)'
                : isWin
                ? '0 0 28px rgba(0,255,157,0.8)'
                : '0 0 32px rgba(255,215,0,0.9)',
            }}
          >
            {data.type}
          </div>

          <div className="font-body text-xs text-[#cbd5e1] font-bold tracking-wide mb-3">
            {isWin
              ? `Period #${data.period} confirmed ${data.size}`
              : isLoss
              ? `Period #${data.period} went ${data.size} · Next pattern detected`
              : `Jackpot lucky number ${data.number} hit on #${data.period}!`}
          </div>

          {/* Official Badge Preview Row */}
          <div className="flex items-center justify-center gap-3 my-3 p-2.5 rounded-2xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.25)]">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
                Landed
              </span>
              <img
                src={resultBadge}
                alt={`Number ${data.number}`}
                className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
              />
            </div>
            <div className="text-lg font-black text-[#a855f7]">⇄</div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
                Predicted
              </span>
              <img
                src={signalBadge}
                alt={`Signal ${data.predicted}`}
                className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="p-2 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)]">
              <div className="font-body text-[9px] uppercase tracking-wider text-[#94a3b8] font-bold">
                Result
              </div>
              <div className="font-display font-black text-lg text-white mt-1">
                {data.number}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)]">
              <div className="font-body text-[9px] uppercase tracking-wider text-[#94a3b8] font-bold">
                Signal
              </div>
              <div
                className={`font-display font-black text-lg mt-1 ${
                  data.predicted === 'BIG' ? 'text-[#ff9900]' : 'text-[#00e5ff]'
                }`}
              >
                {data.predicted}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[rgba(5,4,12,0.7)] border border-[rgba(168,85,247,0.2)]">
              <div className="font-body text-[9px] uppercase tracking-wider text-[#94a3b8] font-bold">
                Level
              </div>
              <div className="font-display font-black text-lg text-[#ffd700] mt-1">
                {data.level}
              </div>
            </div>
          </div>

          {/* Auto-closing progress bar */}
          <div className="w-full h-1.5 rounded-full bg-[rgba(5,4,12,0.8)] border border-[rgba(168,85,247,0.2)] overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-[#00ff9d] to-[#00f0ff] transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsRemaining / 6) * 100}%` }}
            />
          </div>

          {/* Continue Button */}
          <button
            type="button"
            onClick={() => {
              sound.play('click');
              onClose();
            }}
            className="w-full py-3.5 px-4 rounded-2xl font-display font-black text-xs tracking-[2.5px] uppercase cursor-pointer transition-transform active:scale-98"
            style={{
              backgroundColor: isLoss ? '#ff2a5f' : isWin ? '#00ff9d' : '#ffd700',
              color: isLoss ? '#ffffff' : '#03050a',
              boxShadow: `0 8px 24px color-mix(in srgb, ${accentColor} 45%, transparent)`,
            }}
          >
            CONTINUE ({secondsRemaining}S)
          </button>
        </div>
      </div>
    </>
  );
};
