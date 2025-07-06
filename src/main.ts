import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { firefox } from 'playwright';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';

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
