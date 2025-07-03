/**
 * Types and helpers for sports‑betting arbitrage calculation
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

/** Detect the notation used for one odds price. */
export function detectOddsFormat(odd: string | number): OddsFormat {
  // String patterns first --------------------------------------------------
  if (typeof odd === 'string') {
    const trimmed = odd.trim();

    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return 'fractional'; // 4/5
    if (/^[+-]\d+$/.test(trimmed)) return 'american';              // –125, +150

    odd = parseFloat(trimmed);
    if (Number.isNaN(odd)) throw new Error(`Invalid odds value: ${trimmed}`);
  }

  // Numeric heuristics -----------------------------------------------------
  const n = odd as number;
  if (n >= 1) return 'decimal';             // 1.80
  if (n > 0 && n < 1) return 'hongkong';    // 0.80 (HK|Malay +)

  const abs = Math.abs(n);
  if (abs >= 100) return 'american';        // –125
  if (abs > 1) return 'indonesian';         // –1.25
  return 'malay';                           // –0.80
}

/** Convert any supported odds notation to *Decimal* odds. */
export function toDecimal(odd: string | number): number {
  const format = detectOddsFormat(odd);

  switch (format) {
    case 'decimal':
      return typeof odd === 'number' ? odd : parseFloat(odd);

    case 'fractional': {
      const [num, den] = (odd as string)
        .split('/')
        .map((p) => parseFloat(p.trim()));
      return 1 + num / den;
    }

    case 'american': {
      const val = typeof odd === 'number' ? odd : parseInt(odd as string, 10);
      return val > 0 ? 1 + val / 100 : 1 + 100 / Math.abs(val);
    }

    case 'hongkong': {
      const hk = typeof odd === 'number' ? odd : parseFloat(odd);
      return hk + 1;
    }

    case 'indonesian': {
      const indo = typeof odd === 'number' ? odd : parseFloat(odd);
      return indo > 0 ? indo + 1 : 1 + 1 / Math.abs(indo);
    }

    case 'malay': {
      const malay = typeof odd === 'number' ? odd : parseFloat(odd);
      return malay > 0 ? malay + 1 : 1 + 1 / Math.abs(malay);
    }
  }
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
 * Incoming odds are auto‑detected & converted to Decimal before maths.
 *
 * @param event       Sport event containing exactly two outcomes
 * @param totalStake  Total bankroll to distribute (e.g. 100 €)
 */
export function calculateSurebetAllocation(
  event: SportEvent,
  totalStake: number,
): SurebetResult {
  // Guard: must be exactly two outcomes -----------------------------------
  if (event.outcomes.length !== 2) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: 0,
      message: 'Sure‑bet calculation only supports exactly two outcomes.',
    };
  }

  // Normalise odds to Decimal ---------------------------------------------
  const [raw1, raw2] = event.outcomes as [Outcome, Outcome];
  const O1 = toDecimal(raw1.odd);
  const O2 = toDecimal(raw2.odd);

  const surebetPercentage = 1 / O1 + 1 / O2; // < 1 ⇒ arbitrage

  if (surebetPercentage >= 1) {
    return {
      isSurebet: false,
      payout: 0,
      profit: 0,
      surebetPercentage: parseFloat((surebetPercentage * 100).toFixed(2)),
      message: 'No arbitrage opportunity for these odds.',
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
        outcome: raw1.outcome,
        broker: raw1.broker,
        odd: parseFloat(O1.toFixed(2)),
        stake: parseFloat(stake1.toFixed(2)),
      },
      {
        outcome: raw2.outcome,
        broker: raw2.broker,
        odd: parseFloat(O2.toFixed(2)),
        stake: parseFloat(stake2.toFixed(2)),
      },
    ],
    payout: parseFloat(payout.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    surebetPercentage: parseFloat((surebetPercentage * 100).toFixed(2)),
  };
}
