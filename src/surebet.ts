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

/**
 * Best‑effort detection of the notation used for one odds price.
 * Supported: Decimal, Fractional, American/Moneyline, Hong‑Kong, Indonesian, Malay.
 *
 * @param odd – raw odds value as string or number
 */
export function detectOddsFormat(odd: string | number): OddsFormat {
  // Handle obvious string patterns first -----------------------------------
  if (typeof odd === 'string') {
    const trimmed = odd.trim();

    // 4/5 or 11 / 4  → Fractional
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return 'fractional';
    // +150  –125     → American / Moneyline
    if (/^[+-]\d+$/.test(trimmed)) return 'american';

    odd = parseFloat(trimmed);
    if (Number.isNaN(odd)) throw new Error(`Invalid odds value: ${trimmed}`);
  }

  // From here on we have a number ------------------------------------------
  const n = odd as number;

  if (n >= 1) {
    // Plain unsigned numbers ≥ 1 are overwhelmingly used as Decimal odds.
    return 'decimal';
  }

  if (n > 0 && n < 1) {
    // Positive sub‑1 odds are either Hong‑Kong or Malay (+) – conversion is the same.
    return 'hongkong';
  }

  // n < 0 ------------------------------------------------------------------
  const abs = Math.abs(n);

  if (abs >= 100) {
    return 'american'; // –125 etc.
  }
  if (abs > 1) {
    return 'indonesian'; // –1.25 etc.
  }
  return 'malay'; // –0.80 etc.
}

/**
 * Converts any supported odds notation to *Decimal* odds.
 *
 * @param odd – raw odds as string or number
 */
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
  outcome: string;           // e.g. "Home", "Away", "Over 2.5"
  odd: number | string;      // Accept any notation – will be normalised later
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
  surebetPercentage: number; // expressed as 0–100 %
  message?: string;
};

// ────────────────────────────────────────────────────────────
//  Surebet stake allocator (2‑way markets)
// ────────────────────────────────────────────────────────────

/**
 * Calculates sure‑bet stake allocation for a 2‑way market.
 *
 * Any incoming odds are auto‑detected & converted to Decimal before maths.
 *
 * @param event       Sport event containing exactly two outcomes
 * @param totalStake  Total bankroll to distribute (e.g. 100 €)
 */
export function calculateSurebetAllocation(
  event: SportEvent,
  totalStake: number
): SurebetResult {
  if (event.outcomes.length !== 2) {
    return {
      isSurebet: false,
      message: 'Sure‑bet calculation only supports exactly two outcomes.',
    };
  }

  // Normalise odds to Decimal first ----------------------------------------
  const [raw1, raw2] = event.outcomes as [Outcome, Outcome];
  const O1 = toDecimal(raw1.odd);
  const O2 = toDecimal(raw2.odd);

  const surebetPercentage = 1 / O1 + 1 / O2;

  if (surebetPercentage >= 1) {
    return {
      isSurebet: false,
      message: 'No arbitrage opportunity for these odds.'
    };
  }

  const stake1 = totalStake * (O2 / (O1 + O2));
  const stake2 = totalStake * (O1 / (O1 + O2));

  const payout = stake1 * O1; // same for both outcomes
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
