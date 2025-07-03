/**
 * Types and helpers for sports‑betting arbitrage calculation
 *
 * Revision 2 — adds sanity guards so that malformed odds (e.g. “11” that
 * should have been +110 or 11/10) no longer slip through as decimal and
 * create bogus sure‑bets.
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
 * Internal guardrails – outside those ranges we assume the feed is wrong.
 * Decimal odds under 1.01 pay negative/zero; over 20 are vanishingly rare
 * in match markets and almost always signal a parsing error.
 */
const DECIMAL_MIN = 1.01;
const DECIMAL_MAX = 20;

/** Detect the notation used for one odds price. */
export function detectOddsFormat(odd: string | number): OddsFormat {
  // Strings first ---------------------------------------------------------
  if (typeof odd === 'string') {
    const trimmed = odd.trim();

    // 4/5 or 11 / 4  → Fractional
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return 'fractional';
    // +150 or -125   → American / Moneyline
    if (/^[+-]\d+$/.test(trimmed)) return 'american';

    odd = parseFloat(trimmed);
    if (Number.isNaN(odd)) throw new Error(`Invalid odds value: ${trimmed}`);
  }

  // Numeric heuristics ----------------------------------------------------
  const n = odd as number;

  /*
   * Heuristic table (feed quirks we’ve observed):
   *  - Decimal odds should show a decimal point once they’re > 10 (books
   *    rarely quote „11“ instead of „11.0“).
   *  - Positive American prices often lose their + sign but are always ≥100.
   */
  if (n >= 100) return 'american';          // 110, 600, etc.

  if (n >= 1 && Number.isInteger(n)) {
    // Ambiguous 2 … 99 without sign or dot: treat as decimal *but* it will
    // later be rejected if it falls outside sane ranges (see toDecimal).
    return 'decimal';
  }

  if (n > 1) return 'decimal';              // 2.50, 5.75, … (has dot)
  if (n > 0 && n < 1) return 'hongkong';    // 0.80, 0.25

  // n < 0 -----------------------------------------------------------------
  const abs = Math.abs(n);
  if (abs > 1) return 'indonesian';         // -1.25, -2.10
  return 'malay';                           // -0.95, -0.75
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
      const [num, den] = (raw as string)
        .split('/')
        .map((p) => parseFloat(p.trim()));
      dec = 1 + num / den;
      break;
    }

    case 'american': {
      const val = typeof raw === 'number' ? raw : parseInt(raw as string, 10);
      dec = val > 0 ? 1 + val / 100 : 1 + 100 / Math.abs(val);
      break;
    }

    case 'hongkong': {
      const hk = typeof raw === 'number' ? raw : parseFloat(raw);
      dec = hk + 1;
      break;
    }

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

  // ── Sanity guardrails ──────────────────────────────────────────────────
  if (dec < DECIMAL_MIN || dec > DECIMAL_MAX) {
    throw new RangeError(`Suspicious decimal odd ${dec} derived from “${raw}”`);
  }

  return dec;
}

// ────────────────────────────────────────────────────────────
//  Core data structures
// ────────────────────────────────────────────────────────────

export type Outcome = {
  outcome: string;           // e.g. "Home", "Away", "Over 2.5"
  odd: number | string;      // Any notation – will be normalised later
  broker: string;
};

export type SportEvent = {
  market: string;            // e.g. "Match Winner", "Total Goals Over/Under"
  sport: string;             // e.g. "Football", "Basketball"
  league?: string;           // e.g. "Premier League", "NBA"
  date?: string;             // ISO event date
  home: string;              // Home team name
  away: string;              // Away team name
  country?: string;          // Country of the event

  outcomes: Outcome[];       // Two‑way market expected below
};

export type SurebetResult = {
  isSurebet: boolean;
  allocation?: Array<{
    outcome: string;
    broker: string;
    odd: number;             // decimal odds used for the allocation
    stake: number;
  }>;
  payout: number;
  profit: number;
  surebetPercentage: number; // expressed as 0–100 %
  message?: string;
};

// ────────────────────────────────────────────────────────────
//  Sure‑bet stake allocator (2‑way markets)
// ────────────────────────────────────────────────────────────

/**
 * Calculates sure‑bet stake allocation for a 2‑way market.
 *
 * Odds are auto‑detected & converted to decimal; blatantly wrong prices are
 * rejected early. We also dismiss "too‑good‑to‑be‑true" arbs (margin > 20 %).
 */
export function calculateSurebetAllocation(
  event: SportEvent,
  totalStake: number,
): SurebetResult {
  // Guard: must be exactly two outcomes ----------------------------------
  if (event.outcomes.length !== 2) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: 0,
      message: 'Sure‑bet calculation only supports exactly two outcomes.',
    };
  }

  // Convert odds — bail out on parsing/sanity errors ----------------------
  let O1: number, O2: number;
  try {
    [O1, O2] = event.outcomes.map((o) => toDecimal(o.odd)) as [number, number];
  } catch (err) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: 0,
      message: (err as Error).message,
    };
  }

  const surebetPercentage = 1 / O1 + 1 / O2; // < 1 ⇒ arbitrage
  const margin = 1 - surebetPercentage;      // our yield on stake (0.05 = 5 %)

  // Filter unrealistic arbs (> 20 % margin usually means bad data) ---------
  if (margin < 0.0001 || margin > 0.20) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: parseFloat((surebetPercentage * 100).toFixed(2)),
      message: 'Arbitrage margin outside realistic bounds — likely bad feed.',
    };
  }

  // Stakes proportional to opposite odds ----------------------------------
  const stake1 = totalStake * (O2 / (O1 + O2));
  const stake2 = totalStake * (O1 / (O1 + O2));

  const payout = stake1 * O1; // equal on both outcomes
  const profit = payout - totalStake;

  return {
    isSurebet: true,
    allocation: [
      {
        outcome: event.outcomes[0].outcome,
        broker: event.outcomes[0].broker,
        odd: parseFloat(O1.toFixed(2)),
        stake: parseFloat(stake1.toFixed(2)),
      },
      {
        outcome: event.outcomes[1].outcome,
        broker: event.outcomes[1].broker,
        odd: parseFloat(O2.toFixed(2)),
        stake: parseFloat(stake2.toFixed(2)),
      },
    ],
    payout: parseFloat(payout.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    surebetPercentage: parseFloat((surebetPercentage * 100).toFixed(2)),
  };
}
