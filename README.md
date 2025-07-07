# Surebet Arbitrage Scraper

**Apify Actor** that finds **2‑ or 3‑way** _sure‑bet_ (arbitrage) opportunities **on Oddspedia**, calculates risk‑free stake splits and saves everything to an Apify Dataset ready for export (JSON / CSV / XLSX).

---

## 🚀 Features

| ✔                                  | Capability                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Crawl Oddspedia sure‑bet tables** | Works with the global and country-specific _Surebets_ lists on Oddspedia. Other sites are not supported.                               |
| **Camouflaged browser**             | Uses Playwright + Crawlee with Camoufox fingerprints & residential proxy by default.                                                   |
| **Stake allocation**                | Splits your chosen **Total Stake** across outcomes in **2‑ or 3‑way markets** to lock in a _guaranteed profit_ and reports the edge %. |
| **Fully configurable**              | Profit filter, page concurrency, per‑page timeout, dataset size cap, custom proxy etc.                                                 |
| **One‑click export**                | Download results in JSON, CSV, Excel or NDJSON, or stream via the Apify API.                                                           |

---

## 🛠 Input

All settings are defined in the actor’s **input form** (or `INPUT.json` when you run locally). Default values make the actor runnable out‑of‑the‑box.

| Key                   | Type                                | Default                                                      | Description                                                                            |
| --------------------- | ----------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `startUrls`           | `array` (📄 _Request List Sources_) | `["https://oddspedia.com/surebets"]`                         | Oddspedia URLs that list sure‑bet opportunities (global or regional).                  |
| `stake`               | `integer`                           | `100`                                                        | Total money (in your currency) to distribute across outcomes when a sure‑bet is found. |
| `minProfitPercentage` | `integer`                           | `5`                                                          | Ignore sure‑bets whose edge is below this % of the total stake.                        |
| `maxEvents`           | `integer`                           | `0` (unlimited)                                              | Stop after this many events — handy for dev & testing.                                 |
| `proxyConfiguration`  | `object` (🛡 Proxy editor)          | `{ useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }` | Use Apify proxy or supply custom proxy URLs.                                           |
| `crawlerOptions`      | `object` (📝 JSON editor)           | `{ maxConcurrency: 10, pageTimeoutSecs: 60 }`                | Advanced Crawlee / Playwright knobs.                                                   |

### Example `INPUT.json`

```json
{
    "startUrls": [
        { "url": "https://oddspedia.com/surebets", "userData": { "tag": "global" } },
        { "url": "https://oddspedia.com/au/surebets" }
    ],
    "stake": 250,
    "minProfitPercentage": 3,
    "maxEvents": 50,
    "proxyConfiguration": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"]
    },
    "crawlerOptions": {
        "maxConcurrency": 5,
        "pageTimeoutSecs": 45
    }
}
```

---

## 📤 Output

Each dataset item has two layers:

1. **Event Info** – sport, league, date, teams, raw odds.
2. **Allocation** – stake split, edge %, profit €.

| Field                          | Example                                                        | Notes                                          |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------- |
| `sport`                        | `Tennis`                                                       | Parsed from sure‑bet row.                      |
| `league`                       | `ATP Wimbledon`                                                |                                                |
| `date`                         | `2025-07-01T14:50:00.000Z`                                     | ISO 8601.                                      |
| `outcomes`                     | `[ { "outcome": "Home", "odd": 2.1, "broker": "bet365" }, … ]` | Raw odds list. Works for 2‑ and 3‑way markets. |
| `allocation.isSurebet`         | `true`                                                         | `false` if edge < `minProfitPercentage`.       |
| `allocation.allocation`        | `[ { "outcome": "Home", "stake": 94.44 }, … ]`                 | Stake per leg.                                 |
| `allocation.profit`            | `8.89`                                                         | Guaranteed profit in _same units_ as `stake`.  |
| `allocation.surebetPercentage` | `3.56`                                                         | Edge %.                                        |

> **Tip:** In the Apify UI click **Dataset → Preview → Export** to download in your favourite format, or call:
>
> ```
> https://api.apify.com/v2/datasets/<DATASET_ID>/items?format=json
> ```

---

## ⚙️ Internals

| File         | Purpose                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `main.ts`    | Boots PlaywrightCrawler, handles proxy, concurrency, input parsing.            |
| `routes.ts`  | Parses sure‑bet rows, applies filters, pushes events to dataset.               |
| `surebet.ts` | Math helper – calculates stake split & profit (supports 2‑ and 3‑way markets). |
| `types.ts`   | Type‑safe mapping of `input_schema.json`.                                      |

---

## 🏃‍♀️ Quick Start

### In the Apify UI

1. Click **Use Actor** → _Accept defaults_ → **Run**.
2. Results appear in **Dataset** in a few seconds.

### Locally (Node 18 +)

```bash
# 1. Install deps & compile TypeScript
npm install
npm run build

# 2. Run with defaults (uses Oddspedia & Apify residential proxy)
apify run --purge

# 3. Custom run via INPUT.json
cp examples/INPUT.sample.json INPUT.json   # or craft your own
apify run --purge
```

---

## 🧪 Testing Tips

- Set `maxEvents` to a low number (e.g. `3`) and `maxConcurrency` to `1` to iterate quickly.
- Use `datasetPreview` in the Apify console to inspect live records.
- Disable proxy (`useApifyProxy: false`) only if your IP isn’t blocked by the target site.

---

## 📜 License

MIT
