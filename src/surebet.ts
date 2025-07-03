/**
 * Types and helpers for sports‑betting arbitrage calculation
 *
 * Revision 4 — fixes false negatives for very large odds / huge‑margin arbs.
 *   • Positive‑integer “101”, “600”… are now **decimal** unless a sign is
 *     present *and* the value is a multiple of 5 (typical Moneyline style).
 *   • Removed the 20 % upper margin cap; we just warn but still return a
 *     sure‑bet when inverse odds sum < 1.
 *   • Expanded DECIMAL_MAX so longshots (outrights, props) no longer throw.
 */

// ────────────────────────────────────────────────────────────
//  Odds‑format detection & conversion → Decimal
// ────────────────────────────────────────────────────────────

export type OddsFormat =
  | 'decimal'
  | 'fractional'
  | 'american'
  | 'hongkong'
  | 'indonesian'
  | 'malay';

/**
 * Guardrails – values way outside these will still be flagged, but we loosen
 * the upper bound because outrights can price at 100‑to‑1 or more.
 */
const DECIMAL_MIN = 1.01;
const DECIMAL_MAX = 1_000;

/** Detect the notation used for one odds price. */
export function detectOddsFormat(odd: string | number): OddsFormat {
  if (typeof odd === 'string') {
    const trimmed = odd.trim();
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return 'fractional';
    if (/^[+-]\d+$/.test(trimmed)) return 'american'; // explicit sign
    odd = parseFloat(trimmed);
    if (Number.isNaN(odd)) throw new Error(`Invalid odds value: ${trimmed}`);
  }

  const n = odd as number;

  // Positive integers ≥100 could be decimal (longshot) or moneyline.
  // Heuristic: American odds are almost always multiples of 5;
  // if not, treat as decimal.
  if (n >= 100 && Number.isInteger(n)) {
    return n % 5 === 0 ? 'american' : 'decimal';
  }

  if (n >= 1) return 'decimal';        // 1.95, 5.6, etc.
  if (n > 0 && n < 1) return 'hongkong';

  const abs = Math.abs(n);
  if (abs > 1) return 'indonesian';
  return 'malay';
}

/** Convert any supported odds notation to *Decimal* odds. */
export function toDecimal(raw: string | number): number {
  const format = detectOddsFormat(raw);
  let dec: number;
  switch (format) {
    case 'decimal':
      dec = typeof raw === 'number' ? raw : parseFloat(raw);
      break;
    case 'fractional': {
      const [num, den] = (raw as string).split('/').map((p) => parseFloat(p.trim()));
      dec = 1 + num / den;
      break;
    }
    case 'american': {
      const val = typeof raw === 'number' ? raw : parseInt(raw as string, 10);
      dec = val > 0 ? 1 + val / 100 : 1 + 100 / Math.abs(val);
      break;
    }
    case 'hongkong':
      dec = (typeof raw === 'number' ? raw : parseFloat(raw)) + 1;
      break;
    case 'indonesian': {
      const indo = typeof raw === 'number' ? raw : parseFloat(raw);
      dec = indo > 0 ? indo + 1 : 1 + 1 / Math.abs(indo);
      break;
    }
    case 'malay': {
      const my = typeof raw === 'number' ? raw : parseFloat(raw);
      dec = my > 0 ? my + 1 : 1 + 1 / Math.abs(my);
      break;
    }
  }

  if (dec < DECIMAL_MIN || dec > DECIMAL_MAX) {
    throw new RangeError(`Suspicious decimal odd ${dec} derived from “${raw}”`);
  }
  return dec;
}

// ────────────────────────────────────────────────────────────
//  Core data structures (unchanged)
// ────────────────────────────────────────────────────────────

export type Outcome = {
  outcome: string;
  odd: number | string;
  broker: string;
};

export type SportEvent = {
  market: string;
  sport: string;
  league?: string;
  date?: string;
  home: string;
  away: string;
  country?: string;
  outcomes: Outcome[];
};

export type SurebetResult = {
  isSurebet: boolean;
  allocation?: Array<{
    outcome: string;
    broker: string;
    odd: number;
    stake: number;
  }>;
  payout: number;
  profit: number;
  surebetPercentage: number;
  message?: string;
};

// ────────────────────────────────────────────────────────────
//  Arbitrage calculator (2‑ & 3‑way markets)
// ────────────────────────────────────────────────────────────

export function calculateSurebetAllocation(
  event: SportEvent,
  totalStake: number,
): SurebetResult {
  const n = event.outcomes.length;
  if (n < 2 || n > 3) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: 0,
      message: 'Calculator supports only 2‑ or 3‑way markets.',
    };
  }

  // Convert odds with safety ---------------------------------------------
  let decOdds: number[];
  try {
    decOdds = event.outcomes.map((o) => toDecimal(o.odd));
  } catch (err) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: 0,
      message: (err as Error).message,
    };
  }

  const inverseSum = decOdds.reduce((acc, o) => acc + 1 / o, 0);
  if (inverseSum >= 1) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: parseFloat((inverseSum * 100).toFixed(2)),
      message: 'No arbitrage opportunity for these odds.',
    };
  }

  // — We DO allow >20 % margin now —
  const payoutPerOutcome = totalStake / inverseSum;
  const allocation = event.outcomes.map((out, idx) => {
    const stake = payoutPerOutcome / decOdds[idx];
    return {
      outcome: out.outcome,
      broker: out.broker,
      odd: parseFloat(decOdds[idx].toFixed(2)),
      stake: parseFloat(stake.toFixed(2)),
    };
  });

  const profit = payoutPerOutcome - totalStake;

  return {
    isSurebet: true,
    allocation,
    payout: parseFloat(payoutPerOutcome.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    surebetPercentage: parseFloat((inverseSum * 100).toFixed(2)),
    message: profit / totalStake > 0.20
      ? '⚠️ Margin is extraordinarily high — double‑check odds before betting.'
      : undefined,
  };
}
