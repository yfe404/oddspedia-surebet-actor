import { createPlaywrightRouter, Dataset } from 'crawlee';
import { Actor } from 'apify';
import * as cheerio from 'cheerio';

import type { Input } from './types.js';
import { calculateSurebetAllocation, SportEvent, Outcome } from './surebet.js';

export const router = createPlaywrightRouter();

// Count pushed events across all requests
let eventsPushed = 0;


// ---------------------------------------------------------------------------
// Helper – parse Oddspedia sure-bet table (unchanged)
// ---------------------------------------------------------------------------
export function parseSurebets(html: string): SportEvent[] {
    const $ = cheerio.load(html);

    const events: SportEvent[] = [];

    $('.btools-match').each((_, elem) => {
        const el = $(elem);

        // Sport name (from the first breadcrumb icon link)
        const sport = el.find('.match-breadcrumbs__icon').attr('title') || '';

        // Country
        const country = el.find('.match-breadcrumbs__item .match-breadcrumbs__link').first().text().trim();

        // League
        const league = el
            .find('.match-breadcrumbs__item.t-ellipsis a, .match-breadcrumbs__item.t-ellipsis div')
            .first()
            .text()
            .trim();

        // Date
        const date = el.find('.match-breadcrumbs__date').text().trim();

        // Market (e.g. "Home/Away", "Over/Under")
        const market = el.find('.btools-match-teams span').first().text().trim();

        // Home & Away players/teams
        let home = '';
        let away = '';

        const teamsEl = el.find('.btools-match-teams .match-url').first();
        if (teamsEl.length) {
            const rawText = teamsEl.text().trim();
            const [h, a] = rawText.split(/\s*[\n\r]+\s*/);
            home = h || '';
            away = a || '';
        }

        // Find outcomes
        const outcomes: Outcome[] = [];

        el.find('.btools-odd-mini').each((_, oddBlock) => {
            const oddEl = $(oddBlock);

            const outcomeLabel = oddEl.find('.btools-odd-mini__header span').text().trim();

            const oddValue = parseFloat(oddEl.find('.btools-odd-mini__value span').text().trim());

            const brokerImg = oddEl.find('.btools-odd-mini__logo img');
            let broker = '';
            if (brokerImg.length) {
                broker =
                    brokerImg.attr('alt') ||
                    brokerImg.attr('title') ||
                    brokerImg.attr('data-src')?.split('/').pop()?.replace('.png', '') ||
                    '';
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

// ---------------------------------------------------------------------------
// Default handler
// ---------------------------------------------------------------------------
router.addDefaultHandler(async ({ page, log }) => {
    try {
        // Wait until Oddspedia injects sure-bet rows (15 s max)
        await page.waitForSelector('.btools-match', { timeout: 15_000 });
    } catch {
        log.warning('No .btools-match elements found – skipping page');
        return;
    }

    const html = await page.content();
    const events = parseSurebets(html);

    // Read full input once per request
    const {
        stake = 100,
        minProfitPercentage = 1,
        maxEvents = 0,
    }: Input = (await Actor.getInput()) ?? {};

    log.info(
        `Config → stake €${stake}, minProfit ${minProfitPercentage} %, maxEvents ${maxEvents || '∞'}`,
    );

    for (const event of events) {
        if (maxEvents && eventsPushed >= maxEvents) {
            log.debug('Reached maxEvents limit – further events ignored.');
            break;
        }

        const result = calculateSurebetAllocation(event, stake);

        if (!result.isSurebet) {
            result.message && log.debug(result.message);
            continue;
        }

        const profitPct = (result.profit / stake) * 100;
        if (profitPct < minProfitPercentage) {
            log.debug(`Edge ${profitPct.toFixed(2)} % < ${minProfitPercentage} % – ignored`);
            continue;
        }

        log.info(`✅ ${event.home} vs ${event.away} — edge ${profitPct.toFixed(2)} %`);
        await Dataset.pushData({ ...event, result });
        eventsPushed++;
    }
});
