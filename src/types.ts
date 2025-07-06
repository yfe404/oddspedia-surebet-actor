export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'OPTIONS' | 'CONNECT' | 'PATCH';

export interface StartUrl {
    url: string;
    method?: HttpMethod;
    headers?: Record<string, string>;
    userData?: Record<string, unknown>;
}

export interface ProxyConfigurationInput {
    /** Use Apify proxy? (default true) */
    useApifyProxy?: boolean;
    /** Apify proxy groups, e.g. ["RESIDENTIAL"] */
    apifyProxyGroups?: string[];
    /** Custom proxy URLs */
    proxyUrls?: string[];
}

export interface CrawlerOptionsInput {
    /** Maximum concurrent pages (Playwright) */
    maxConcurrency?: number;
    /** Per-page timeout in seconds */
    pageTimeoutSecs?: number;
}

export interface Input {
    /** Pages that list surebets */
    startUrls?: StartUrl[];

    /** Total stake to split between outcomes (€, £, …) */
    stake?: number;

    /** Ignore arbitrages below this edge (%) */
    minProfitPercentage?: number;

    /** Stop after N events (0 = unlimited) */
    maxEvents?: number;

    /** Proxy or Apify proxy settings */
    proxyConfiguration?: ProxyConfigurationInput;

    /** Advanced Crawlee / Playwright knobs */
    crawlerOptions?: CrawlerOptionsInput;
}
