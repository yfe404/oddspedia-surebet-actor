# Surebet Arbitrage Scraper

An Apify Actor that:

✅ Crawls surebet pages
✅ Parses sports events and odds using Cheerio
✅ Calculates surebet allocations and guaranteed profits
✅ Saves results into an Apify Dataset for easy export (JSON, CSV, XLSX)

---

## 🚀 How It Works

This actor:

1. Loads HTML pages via Playwright
2. Parses all surebet matches (e.g. Tennis, Football, MMA, etc.)
3. Extracts:
    - Sport
    - Country
    - League
    - Date and time
    - Market (e.g. Home/Away, Over/Under)
    - Team or player names
    - Odds and bookmakers
4. Calculates surebet allocations for **2-way markets**:
    - Stake split
    - Total payout
    - Guaranteed profit
    - Surebet percentage
5. Saves everything as JSON records in an Apify dataset.

---

## 📦 Input

WIP

---

## ✅ Output

The actor saves results to a dataset with fields:

| Field      | Description                                   |
| ---------- | --------------------------------------------- |
| url        | Source page URL                               |
| sport      | Sport name (e.g. Tennis, Football)            |
| country    | Country or region                             |
| league     | Tournament or league name                     |
| date       | Match date and time                           |
| market     | Market type (e.g. Home/Away, Over/Under)      |
| home       | Home team or player                           |
| away       | Away team or player                           |
| outcomes   | List of odds and bookmakers for each outcome  |
| allocation | Calculated surebet stakes and profit (if any) |

Example dataset record:

```json
{
  "url": "https://example.com",
  "sport": "Tennis",
  "country": "United Kingdom",
  "league": "ATP Wimbledon",
  "date": "1st Jul 25, 16:50",
  "market": "Home/Away",
  "home": "Jack Draper",
  "away": "Sebastian Baez",
  "outcomes": [
    {
      "outcome": "Home",
      "odd": 2,
      "broker": "tooniebet"
    },
    {
      "outcome": "Away",
      "odd": 34,
      "broker": "boylesports"
    }
  ],
  "allocation": {
    "isSurebet": true,
    "allocation": [
      {
        "outcome": "Home",
        "broker": "tooniebet",
        "odd": 2,
        "stake": 94.44
      },
      {
        "outcome": "Away",
        "broker": "boylesports",
        "odd": 34,
        "stake": 5.56
      }
    ],
    "payout": 188.89,
    "profit": 88.89,
    "surebetPercentage": 52.94
  }
}
```

---

## 🛠 Configuration

The actor logic lives in:

* `main.ts` → Crawler logic and orchestration
* `surebet.ts` → Calculation of surebet allocations
* `routes.ts` → Request routing

---

## Limitations

* Currently supports **2-way markets** only (Home/Away, Over/Under).
* No handling of 3-way surebets (e.g. 1X2 with Draw) yet.
* No built-in actor input schema—modify `main.ts` to change URLs or stake amount.

---

## How to Run

Locally:

```bash
npm install
npm run build
npm start
```

Or deploy to Apify and run as an actor.

---

## Data Export

On Apify, download results as:

* JSON
* CSV
* Excel (XLSX)
* NDJSON

Via API:

```
https://api.apify.com/v2/datasets/<DATASET_ID>/items?format=json
```

---

## License

MIT

