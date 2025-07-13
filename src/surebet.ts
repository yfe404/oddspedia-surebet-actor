/**
 * Types and helpers for sports‑betting arbitrage calculation
 */

// ────────────────────────────────────────────────────────────
//  Core data structures
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
    allocation?: {
        outcome: string;
        broker: string;
        odd: number;
        stake: number;
    }[];
    payout: number;
    profit: number;
    surebetPercentage: number;
    message?: string;
};

// ────────────────────────────────────────────────────────────
//  Arbitrage calculator (2‑ & 3‑way markets)
// ────────────────────────────────────────────────────────────

export function calculateSurebetAllocation(event: SportEvent, totalStake: number): SurebetResult {
    console.log('Calculating surebet for event:', event);
    console.log(
        'Event odds:',
        event.outcomes.map((o) => o.odd),
    );
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
        decOdds = event.outcomes.map((o) => (typeof o.odd === 'number' ? o.odd : parseFloat(o.odd as string)));
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

    // — We DO allow >20% margin now —
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

    console.log('Surebet allocation:', allocation);
    return {
        isSurebet: true,
        allocation,
        payout: parseFloat(payoutPerOutcome.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        surebetPercentage: parseFloat((inverseSum * 100).toFixed(2)),
        message:
            profit / totalStake > 0.2
                ? '⚠️ Margin is extraordinarily high — double‑check odds before betting.'
                : undefined,
    };
}
