import { createPlaywrightRouter, Dataset } from 'crawlee';
import { SportEvent, Outcome, calculateSurebetAllocation } from './surebet.js';
export const router = createPlaywrightRouter();
import * as cheerio from "cheerio";


export function parseSurebets(html: string): SportEvent[] {
  const $ = cheerio.load(html);

  const events: SportEvent[] = [];

  $(".btools-match").each((_, elem) => {
    const el = $(elem);

    // Sport name (from the first breadcrumb icon link)
    const sport = el
      .find(".match-breadcrumbs__icon")
      .attr("title") || "";

    // Country
    const country = el
      .find(".match-breadcrumbs__item .match-breadcrumbs__link")
      .first()
      .text()
      .trim();

    // League
    const league = el
      .find(".match-breadcrumbs__item.t-ellipsis a, .match-breadcrumbs__item.t-ellipsis div")
      .first()
      .text()
      .trim();

    // Date
    const date = el
      .find(".match-breadcrumbs__date")
      .text()
      .trim();

    // Market (e.g. "Home/Away", "Over/Under")
    const market = el
      .find(".btools-match-teams span")
      .first()
      .text()
      .trim();

    // Home & Away players/teams
    let home = "";
    let away = "";

    const teamsEl = el.find(".btools-match-teams .match-url").first();
    if (teamsEl.length) {
      const rawText = teamsEl.text().trim();
      const [h, a] = rawText.split(/\s*[\n\r]+\s*/);
      home = h || "";
      away = a || "";
    }

    // Find outcomes
    const outcomes: Outcome[] = [];

    el.find(".btools-odd-mini").each((_, oddBlock) => {
      const oddEl = $(oddBlock);

      const outcomeLabel = oddEl
        .find(".btools-odd-mini__header span")
        .text()
        .trim();

      const oddValue = parseFloat(
        oddEl.find(".btools-odd-mini__value span").text().trim()
      );

      const brokerImg = oddEl.find(".btools-odd-mini__logo img");
      let broker = "";
      if (brokerImg.length) {
        broker =
          brokerImg.attr("alt") ||
          brokerImg.attr("title") ||
          brokerImg.attr("src")?.split("/").pop()?.replace(".png", "") ||
          "";
      }

      outcomes.push({
        outcome: outcomeLabel,
        odd: oddValue,
        broker: broker,
      });
    });

    // Create event only if we have at least 2 outcomes
    if (outcomes.length >= 2) {
      events.push({
        sport,
        country,
        league,
        date,
        market,
        home,
        away,
        outcomes,
      });
    }
  });

  return events;
}


router.addDefaultHandler(async ({ page }) => {


    // 1) make sure the logo <img> elements exist
await page.waitForSelector('.btools-odd-mini__logo img');

// 2) scroll them into view so lazy-loading kicks in
await page.evaluate(() => {
  document
    .querySelectorAll('.btools-odd-mini__logo img')
    .forEach(img => img.scrollIntoView({ block: 'center' }));
});

// 3) wait until EVERY logo image is completely loaded
await page.waitForFunction(() => {
  const imgs = Array.from(
    document.querySelectorAll<HTMLImageElement>('.btools-odd-mini__logo img')
  );
  return (
    imgs.length > 0 &&
    imgs.every(img => img.complete && img.naturalWidth > 0)
  );
}, { timeout: 15_000 });   // ← options are last

  // 4 – now scrape
  const html = await page.content();
  const events = parseSurebets(html);


    for (const event of events) {
      console.log("─────────────");
      console.log(`Sport   : ${event.sport}`);
      console.log(`League  : ${event.league}`);
      console.log(`Date    : ${event.date}`);
      console.log(`Home    : ${event.home}`);
      console.log(`Away    : ${event.away}`);
      console.log(`Market  : ${event.market}`);
      console.log("Outcomes:");
      for (const o of event.outcomes) {
        console.log(`  - ${o.outcome}: ${o.odd} @ ${o.broker}`);
      }



  // Only handle 2-way markets for surebet allocation
  if (event.outcomes.length === 2) {
    const allocation = calculateSurebetAllocation(event, 100);

    if (allocation.isSurebet) {
      console.log(`✅ SUREBET FOUND!`);
      console.log(`Surebet %: ${allocation.surebetPercentage}%`);
      console.log(`Total payout: $${allocation.payout}`);
      console.log(`Guaranteed profit: $${allocation.profit}`);
      console.log(`Recommended stakes:`);

      for (const alloc of allocation.allocation!) {
        console.log(
          `→ Bet $${alloc.stake} on [${alloc.outcome}] at ${alloc.odd} with ${alloc.broker}`
        );
      }

      const result = {
        sport: event.sport,
        country: event.country,
        league: event.league,
        date: event.date,
        market: event.market,
        home: event.home,
        away: event.away,
        outcomes: event.outcomes,
        allocation
      };

      await Dataset.pushData(result);
      console.log(`✅ Saved event: ${event.home} vs ${event.away}`);

    } else {
      console.log(`❌ No surebet found.`);
    }
  } else {
    console.log(`ℹ️ Skipped surebet calculation (more than 2 outcomes).`);
  }


      console.log("─────────────\n");
    }
});
