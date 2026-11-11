// Lunar AI Wingo 1-Minute Prediction and Neural Pattern Engine
// High-speed pattern detection (<0.01s) with active continuation, transition, and instant loss-recovery

export interface HistoryItem {
  number: number;
  issueNumber?: string;
  color?: string;
}

export interface SessionRecord {
  p: string; // period last 4 or full
  num: number; // outcome number 0-9
  s: 'BIG' | 'SMALL'; // result size
  pred: 'BIG' | 'SMALL'; // predicted size
  status: 'WIN' | 'LOSS' | 'JACKPOT';
  won: boolean;
  time?: string;
}

export interface PatternAnalysisResult {
  prediction: 'BIG' | 'SMALL';
  strategy: string;
  patternDetected: string;
  trendType: string;
  confidence: number;
  executionTimeMs: number;
  recentSequence?: string;
  activePatternId?: string;
}

// User requested patterns explicitly:
// SSS & BBB (3-term complete block reversals)
// BSSB & SBBS (Symmetric motifs)
// BBBSSS & SSSBBB (6-mirror cycles)
// BSBS & SBSB (Alternations)
interface PatternRuleDefinition {
  tail: string;
  prediction: 'BIG' | 'SMALL';
  name: string;
  type: string;
  confidence: number;
}

export const COMPREHENSIVE_RULES: PatternRuleDefinition[] = [
  // 1. Dragon Super Streaks (Length 7-8) - Follow the Dragon
  { tail: 'BBBBBBBB', prediction: 'BIG', name: '8-DRAGON RUN [BBBBBBBB] → BIG', type: 'DRAGON_PATTERN', confidence: 99 },
  { tail: 'SSSSSSSS', prediction: 'SMALL', name: '8-DRAGON RUN [SSSSSSSS] → SMALL', type: 'DRAGON_PATTERN', confidence: 99 },
  { tail: 'BBBBBBB', prediction: 'BIG', name: '7-DRAGON RUN [BBBBBBB] → BIG', type: 'DRAGON_PATTERN', confidence: 99 },
  { tail: 'SSSSSSS', prediction: 'SMALL', name: '7-DRAGON RUN [SSSSSSS] → SMALL', type: 'DRAGON_PATTERN', confidence: 99 },

  // 2. 6-Phase Mirror Cycles & Dragon Continuations - Length 6
  { tail: 'BBBBBB', prediction: 'BIG', name: '6-DRAGON CONTINUATION [BBBBBB] → BIG', type: 'DRAGON_PATTERN', confidence: 98 },
  { tail: 'SSSSSS', prediction: 'SMALL', name: '6-DRAGON CONTINUATION [SSSSSS] → SMALL', type: 'DRAGON_PATTERN', confidence: 98 },
  { tail: 'BBBSSS', prediction: 'BIG', name: '6-MIRROR CYCLE [BBBSSS] → BIG', type: 'BBBSSS_PATTERN', confidence: 98 },
  { tail: 'SSSBBB', prediction: 'SMALL', name: '6-MIRROR CYCLE [SSSBBB] → SMALL', type: 'SSSBBB_PATTERN', confidence: 98 },
  { tail: 'BBBBBS', prediction: 'SMALL', name: 'DRAGON CUT CONFIRMATION [BBBBBS] → SMALL', type: 'DRAGON_CUT', confidence: 96 },
  { tail: 'SSSSSB', prediction: 'BIG', name: 'DRAGON CUT CONFIRMATION [SSSSSB] → BIG', type: 'DRAGON_CUT', confidence: 96 },

  // 3. 5-Phase Dragon Streaks & Mirror Anticipations - Length 5
  { tail: 'BBBBB', prediction: 'BIG', name: '5-DRAGON RUN [BBBBB] → BIG', type: 'DRAGON_PATTERN', confidence: 98 },
  { tail: 'SSSSS', prediction: 'SMALL', name: '5-DRAGON RUN [SSSSS] → SMALL', type: 'DRAGON_PATTERN', confidence: 98 },
  { tail: 'BBBBS', prediction: 'SMALL', name: 'DRAGON CUT CONFIRMATION [BBBBS] → SMALL', type: 'DRAGON_CUT', confidence: 96 },
  { tail: 'SSSSB', prediction: 'BIG', name: 'DRAGON CUT CONFIRMATION [SSSSB] → BIG', type: 'DRAGON_CUT', confidence: 96 },
  { tail: 'BBBSS', prediction: 'BIG', name: 'ANTICIPATING BBBSSS [BBBSS] → BIG', type: 'BBBSSS_ANTICIPATION', confidence: 96 },
  { tail: 'SSSBB', prediction: 'SMALL', name: 'ANTICIPATING SSSBBB [SSSBB] → SMALL', type: 'SSSBBB_ANTICIPATION', confidence: 96 },

  // 4. 4-Phase Cycles: BSSB, SBBS, BSBS, SBSB, SSBB, BBSS, and 4-Dragon
  { tail: 'BBBB', prediction: 'BIG', name: '4-DRAGON TREND [BBBB] → BIG', type: 'DRAGON_PATTERN', confidence: 97 },
  { tail: 'SSSS', prediction: 'SMALL', name: '4-DRAGON TREND [SSSS] → SMALL', type: 'DRAGON_PATTERN', confidence: 97 },
  { tail: 'BSSB', prediction: 'SMALL', name: 'BSSB MOTIF [BSSB] → SMALL', type: 'BSSB_PATTERN', confidence: 96 },
  { tail: 'SBBS', prediction: 'BIG', name: 'SBBS MOTIF [SBBS] → BIG', type: 'SBBS_PATTERN', confidence: 96 },
  { tail: 'BSBS', prediction: 'BIG', name: 'BSBS ALTERNATION [BSBS] → BIG', type: 'BSBS_PATTERN', confidence: 96 },
  { tail: 'SBSB', prediction: 'SMALL', name: 'SBSB ALTERNATION [SBSB] → SMALL', type: 'SBSB_PATTERN', confidence: 96 },
  { tail: 'SSBB', prediction: 'SMALL', name: 'SSBB 2-2 CYCLE [SSBB] → SMALL', type: 'SSBB_PATTERN', confidence: 96 },
  { tail: 'BBSS', prediction: 'BIG', name: 'BBSS 2-2 CYCLE [BBSS] → BIG', type: 'BBSS_PATTERN', confidence: 96 },

  // 5. 3-Phase Blocks: BBB, SSS, and Clean Anticipations
  { tail: 'BBB', prediction: 'SMALL', name: 'BBB 3-STREAK PIVOT [BBB] → SMALL', type: 'BBB_PATTERN', confidence: 96 },
  { tail: 'SSS', prediction: 'BIG', name: 'SSS 3-STREAK PIVOT [SSS] → BIG', type: 'SSS_PATTERN', confidence: 96 },
  { tail: 'SSB', prediction: 'BIG', name: 'ANTICIPATING SSBB [SSB] → BIG', type: 'SSBB_ANTICIPATION', confidence: 95 },
  { tail: 'BBS', prediction: 'SMALL', name: 'ANTICIPATING BBSS [BBS] → SMALL', type: 'BBSS_ANTICIPATION', confidence: 95 },
  { tail: 'BSS', prediction: 'BIG', name: 'ANTICIPATING BSSB [BSS] → BIG', type: 'BSSB_ANTICIPATION', confidence: 95 },
  { tail: 'SBB', prediction: 'SMALL', name: 'ANTICIPATING SBBS [SBB] → SMALL', type: 'SBBS_ANTICIPATION', confidence: 95 },
  { tail: 'BSB', prediction: 'BIG', name: 'ANTICIPATING BSBS [BSB] → BIG', type: 'BSBS_ANTICIPATION', confidence: 94 },
  { tail: 'SBS', prediction: 'SMALL', name: 'ANTICIPATING SBSB [SBS] → SMALL', type: 'SBSB_ANTICIPATION', confidence: 94 },

  // 6. 2-Phase Anticipation & Starters
  { tail: 'BB', prediction: 'BIG', name: 'ANTICIPATING BBB [BB] → BIG', type: 'BBB_ANTICIPATION', confidence: 93 },
  { tail: 'SS', prediction: 'SMALL', name: 'ANTICIPATING SSS [SS] → SMALL', type: 'SSS_ANTICIPATION', confidence: 93 },
  { tail: 'BS', prediction: 'BIG', name: 'ALTERNATING MOTIF [BS] → BIG', type: 'STARTER', confidence: 88 },
  { tail: 'SB', prediction: 'SMALL', name: 'ALTERNATING MOTIF [SB] → SMALL', type: 'STARTER', confidence: 88 },
];

// Core Patterns explicitly requested by the user:
// BSSB, BBB, SSS, BBBSSS, SSSBBB, SBBS, BSBS, SSBB & DRAGON PATTERN
export interface PatternCardItem {
  id: string;
  pattern: string;
  target: 'BIG' | 'SMALL' | 'TREND';
  label: string;
}

export const CORE_PATTERNS: PatternCardItem[] = [
  { id: 'BSSB', pattern: 'BSSB', target: 'SMALL', label: 'BSSB' },
  { id: 'BBB', pattern: 'BBB', target: 'SMALL', label: 'BBB' },
  { id: 'SSS', pattern: 'SSS', target: 'BIG', label: 'SSS' },
  { id: 'BBBSSS', pattern: 'BBBSSS', target: 'BIG', label: 'BBBSSS' },
  { id: 'SSSBBB', pattern: 'SSSBBB', target: 'SMALL', label: 'SSSBBB' },
  { id: 'SBBS', pattern: 'SBBS', target: 'BIG', label: 'SBBS' },
  { id: 'BSBS', pattern: 'BSBS', target: 'BIG', label: 'BSBS' },
  { id: 'SSBB', pattern: 'SSBB', target: 'SMALL', label: 'SSBB' },
  { id: 'DRAGON', pattern: 'BBBB+', target: 'TREND', label: 'DRAGON PATTERN' },
];

// Pre-sort rules by pattern length descending so longest patterns match first
export const SORTED_RULES = [...COMPREHENSIVE_RULES].sort((a, b) => b.tail.length - a.tail.length);

export function getOutcomePattern(history: HistoryItem[], count = 16): string {
  return (history || [])
    .slice(0, count)
    .reverse()
    .map((item) => (item.number >= 5 ? 'B' : 'S'))
    .join('');
}

// Ultra-fast pattern detection with precise benchmark timing (< 0.01 seconds)
// Supports BSSB, BBB, SSS, BBBSSS, SSSBBB, SBBS, BSBS and DRAGON PATTERN
export function analyzePatternLogic(history: HistoryItem[]): PatternAnalysisResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const sequence = getOutcomePattern(history, 16);

  // 1. Dynamic DRAGON PATTERN detection (4 or more consecutive identical outcomes: BBBB... or SSSS...)
  const lastChar = sequence.slice(-1) || 'B';
  let dragonStreak = 0;
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (sequence[i] === lastChar) {
      dragonStreak++;
    } else {
      break;
    }
  }

  if (dragonStreak >= 4) {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    const isBig = lastChar === 'B';
    const side = isBig ? 'BIG' : 'SMALL';
    return {
      prediction: isBig ? 'BIG' : 'SMALL',
      strategy: `🐉 ${dragonStreak}-DRAGON PATTERN [${lastChar.repeat(Math.min(8, dragonStreak))}] → FOLLOW DRAGON`,
      patternDetected: `DRAGON (${dragonStreak}x ${side})`,
      trendType: 'DRAGON_PATTERN',
      activePatternId: 'DRAGON',
      confidence: Math.min(99, 94 + Math.min(5, dragonStreak)),
      executionTimeMs: Math.max(0.005, Number(elapsed.toFixed(3))),
      recentSequence: sequence,
    };
  }

  // 2. Scan through all specific pattern rules (BSSB, BBB, SSS, BBBSSS, SSSBBB, SBBS, BSBS, SSBB, etc.)
  for (const rule of SORTED_RULES) {
    if (sequence.endsWith(rule.tail)) {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;

      // Map to core pattern ID if applicable
      let activePatternId: string | undefined = undefined;
      if (rule.tail === 'BSSB' || rule.type.includes('BSSB')) activePatternId = 'BSSB';
      else if (rule.tail === 'SBBS' || rule.type.includes('SBBS')) activePatternId = 'SBBS';
      else if (rule.tail === 'BBB' || rule.type === 'BBB_PATTERN') activePatternId = 'BBB';
      else if (rule.tail === 'SSS' || rule.type === 'SSS_PATTERN') activePatternId = 'SSS';
      else if (rule.tail === 'BBBSSS' || rule.type.includes('BBBSSS')) activePatternId = 'BBBSSS';
      else if (rule.tail === 'SSSBBB' || rule.type.includes('SSSBBB')) activePatternId = 'SSSBBB';
      else if (rule.tail === 'BSBS' || rule.type.includes('BSBS')) activePatternId = 'BSBS';
      else if (rule.tail === 'SSBB' || rule.type.includes('SSBB')) activePatternId = 'SSBB';
      else if (rule.type.includes('DRAGON')) activePatternId = 'DRAGON';

      return {
        prediction: rule.prediction,
        strategy: rule.name,
        patternDetected: rule.tail,
        trendType: rule.type,
        activePatternId,
        confidence: rule.confidence,
        executionTimeMs: Math.max(0.005, Number(elapsed.toFixed(3))),
        recentSequence: sequence,
      };
    }
  }

  // 3. Fallback if sequence is 1 char or empty
  const pred = lastChar === 'B' ? 'SMALL' : 'BIG';
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;

  return {
    prediction: pred,
    strategy: `DYNAMIC BALANCE [${lastChar}] → ${pred}`,
    patternDetected: lastChar,
    trendType: 'DYNAMIC_BALANCE',
    confidence: 85,
    executionTimeMs: Math.max(0.005, Number(elapsed.toFixed(3))),
    recentSequence: sequence,
  };
}

export function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getTargetNums(
  trend: 'BIG' | 'SMALL',
  seed: number,
  hist: HistoryItem[]
): { n1: number; n2: number } {
  // When BIG: primary pool [5, 6, 7, 8, 9], counter pool [0, 1, 2, 3, 4]
  // When SMALL: primary pool [0, 1, 2, 3, 4], counter pool [5, 6, 7, 8, 9]
  const samePool = trend === 'BIG' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  const oppositePool = trend === 'BIG' ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];
  const historyKey = (hist || [])
    .slice(0, 10)
    .map((item) => item.number)
    .join(',');
  const base = stableHash(`${seed}|${trend}|${historyKey}`);
  return {
    n1: samePool[base % samePool.length],
    n2: oppositePool[Math.floor(base / 7) % oppositePool.length],
  };
}

export function getPrediction(
  history: HistoryItem[],
  targetPeriod: string
): {
  prediction: 'BIG' | 'SMALL';
  jodi: [number, number];
  analysis: PatternAnalysisResult;
} | { error: string } {
  const validHistory = (history || []).filter(
    (item) => Number.isInteger(item.number) && item.number >= 0 && item.number <= 9
  );
  if (!validHistory.length) {
    return { error: 'Result history not available' };
  }
  const seed = parseInt(String(targetPeriod).slice(-6), 10) || 0;
  const analysis = analyzePatternLogic(validHistory);
  const nums = getTargetNums(analysis.prediction, seed, validHistory);
  return {
    prediction: analysis.prediction,
    jodi: [nums.n1, nums.n2],
    analysis,
  };
}

// Fetch helper: attempts proxy, direct, then fallback
export async function fetchLiveWingoHistory(): Promise<{
  list: { issueNumber: string; number: number; color?: string }[];
} | null> {
  const endpoints = [
    `/api/wingo?t=${Date.now()}`,
    `https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?t=${Date.now()}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.data && Array.isArray(data.data.list) && data.data.list.length > 0) {
        return {
          list: data.data.list.map((item: Record<string, unknown>) => {
            const rawNum =
              item.number !== undefined
                ? item.number
                : item.result !== undefined
                ? item.result
                : item.openNumber;
            return {
              issueNumber: String(item.issueNumber || ''),
              number: parseInt(String(rawNum), 10),
              color: item.color ? String(item.color) : undefined,
            };
          }),
        };
      }
    } catch {
      // try next endpoint
    }
  }

  return null;
}
