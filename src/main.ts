import { Actor } from 'apify';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';
import { PlaywrightCrawler } from 'crawlee';
import { firefox } from 'playwright';

import { router } from './routes.js';
import type { Input } from './types.js';

// ────────────────────────────────────────────────────────────
//  1. Init & read input
// ────────────────────────────────────────────────────────────
await Actor.init();
const input: Input = (await Actor.getInput()) ?? {};

// Defaults make the actor run even with an empty input box
const {
    startUrls = [{ url: 'https://oddspedia.com/surebets' }],
    proxyConfiguration: proxyCfgInput,
    crawlerOptions = {},
} = input;

// ────────────────────────────────────────────────────────────
//  2. Proxy configuration
// ────────────────────────────────────────────────────────────
let proxyConfiguration;
if (proxyCfgInput && !Actor.isAtHome()) {
    // User provided explicit settings
    proxyConfiguration = await Actor.createProxyConfiguration(proxyCfgInput);
} else {
    proxyConfiguration = await Actor.createProxyConfiguration({});
}

// ────────────────────────────────────────────────────────────
//  3. Crawler
// ────────────────────────────────────────────────────────────
const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,
    maxConcurrency: crawlerOptions.maxConcurrency ?? 10,
    navigationTimeoutSecs: crawlerOptions.pageTimeoutSecs ?? 60,
    preNavigationHooks: [
        async ({ page, request }) => {
            // Figure out which domain to scope the cookie to:
            const { hostname: domain } = new URL(request.url);

            await page.context().addCookies([
                {
                    name: 'user_odds_format',
                    value: 'decimal',
                    domain, // e.g. "www.example.com"
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Lax', // Plays nicely with most servers
                },
            ]);
        },
    ],
    launchContext: {
        launcher: firefox,
        launchOptions: await camoufoxLaunchOptions({
            headless: true,
            proxy: await proxyConfiguration?.newUrl(),
            geoip: true,
        }),
    },
});

// ────────────────────────────────────────────────────────────
//  4. Go! (all URLs come from the input form)
// ────────────────────────────────────────────────────────────
await crawler.run(startUrls);

// ────────────────────────────────────────────────────────────
await Actor.exit();
