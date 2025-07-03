/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

// For more information, see https://docs.apify.com/sdk/js
import { Actor } from 'apify';
import { launchOptions as camoufoxLaunchOptions } from 'camoufox-js';
// For more information, see https://crawlee.dev
import { PlaywrightCrawler } from 'crawlee';
import { firefox } from 'playwright';

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
import { router } from './routes.js';


interface Input {
    startUrls: {
        url: string;
        method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT' | 'PATCH';
        headers?: Record<string, string>;
        userData: Record<string, unknown>;
    }[];
    maxRequestsPerCrawl: number;
}

// Initialize the Apify SDK
await Actor.init();


let proxyConfiguration = undefined;

if (Actor.isAtHome()) {
        proxyConfiguration = await Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
        countryCode: 'FR'
    });
}

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,
    launchContext: {
        launcher: firefox,
        launchOptions: await camoufoxLaunchOptions({
            headless: false,
            proxy: await proxyConfiguration?.newUrl(),
            geoip: true,
            // fonts: ['Times New Roman'] // <- custom Camoufox options
        }),
    },
});

await crawler.run(['https://oddspedia.com/surebets']);

// Exit successfully
await Actor.exit();
