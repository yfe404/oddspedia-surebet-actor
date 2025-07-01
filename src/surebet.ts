/**
 * Types for sports betting arbitrage calculation
 */

export type Outcome = {
  outcome: string;    // e.g. "Home", "Away", "Over 2.5"
  odd: number;
  broker: string;
};

export type SportEvent = {
  market: string;     // e.g. "Match Winner", "Total Goals Over/Under"
  outcomes: [Outcome, Outcome];
};

export type SurebetResult = {
  isSurebet: boolean;
  allocation?: Array<{
    outcome: string;
    broker: string;
    odd: number;
    stake: number;
  }>;
  payout?: number;
  profit?: number;
  surebetPercentage?: number;
  message?: string;
};

/**
 * Calculates surebet stake allocation for a 2-way market.
 *
 * @param event - Sport event containing two outcomes
 * @param totalStake - Total amount to allocate (e.g. $100)
 * @returns Surebet result with stakes, profit, and payout info
 */
export function calculateSurebetAllocation(
  event: SportEvent,
  totalStake: number
): SurebetResult {
  const [outcome1, outcome2] = event.outcomes;

  const O1 = outcome1.odd;
  const O2 = outcome2.odd;

  const surebetPercentage = (1 / O1) + (1 / O2);

  if (surebetPercentage >= 1) {
    return {
      isSurebet: false,
      message: "No surebet opportunity for these odds."
    };
  }

  const stake1 = totalStake * (O2 / (O1 + O2));
  const stake2 = totalStake * (O1 / (O1 + O2));

  const payout = stake1 * O1;
  const profit = payout - totalStake;

  return {
    isSurebet: true,
    allocation: [
      {
        outcome: outcome1.outcome,
        broker: outcome1.broker,
        odd: O1,
        stake: parseFloat(stake1.toFixed(2)),
      },
      {
        outcome: outcome2.outcome,
        broker: outcome2.broker,
        odd: O2,
        stake: parseFloat(stake2.toFixed(2)),
      }
    ],
    payout: parseFloat(payout.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    surebetPercentage: parseFloat((surebetPercentage * 100).toFixed(2)),
  };
}

/**
 * Example usage
 */
export function example() {
  const event: SportEvent = {
    market: "Match Winner",
    outcomes: [
      {
        outcome: "Home",
        odd: 2.0,
        broker: "BrokerA",
      },
      {
        outcome: "Away",
        odd: 34.0,
        broker: "BrokerB",
      }
    ]
  };

  const result = calculateSurebetAllocation(event, 100);

  console.log("Surebet calculation result:");
  console.log(result);
}
// Uncomment to run the example directly
// example();

