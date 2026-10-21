import type { Cheerio, CheerioAPI, CheerioOptions } from "cheerio";
import type { AnyNode } from "domhandler";

export type Data = Record<string, unknown>;

// A DOM node, or the Cheerio-wrapped document root of a freshly loaded page
export type PageNode = AnyNode | Cheerio<AnyNode>;

export interface Page {
  $: CheerioAPI;
  node: PageNode;
  url: string;
  base: string; // Base for relative links (<base href> or the page URL)
}

// State passed along the chain; page fields are present once a page is loaded
export interface Context extends Partial<Page> {
  data: Data;
}

export type Next = (ctx: Context) => Promise<void>;

// Chain step: call next(ctx) zero times to stop the branch, once to continue,
// or several times to branch
export type Step = (ctx: Context, next: Next) => Promise<void>;

// Extraction spec, see pick()
export type Spec = string | string[] | { [key: string]: Spec };
export type Extracted = string | undefined | Extracted[] | { [key: string]: Extracted };

export type Pseudos = NonNullable<CheerioOptions["pseudos"]>;

// Per-slot settings; any field left out falls back to the global option
export interface SlotConfig {
  proxy?: string;
  userAgent?: string;
  delay?: number;
  headers?: Record<string, string>;
}

export interface Slot extends SlotConfig {
  id: number;
}

export interface FetchRequest {
  url: string;
  headers: Record<string, string>;
  slot: Slot;
}

export type FetchNext = (req: FetchRequest) => Promise<Response>;
// Fetch middleware: a function, optionally carrying run hooks. useFetch() registers
// onStart and onEnd automatically, so a middleware can set up and clean up after itself.
export interface FetchMiddleware {
  (req: FetchRequest, next: FetchNext): Promise<Response>;
  onStart?: () => unknown;
  onEnd?: () => unknown;
}

export interface OsmoticOptions {
  concurrency: number; // Ignored when slots is set
  maxPages: number;
  delay: number;
  userAgent: string;
  headers: Record<string, string>;
  pseudos: Pseudos;
  // Optional per-slot settings, one object per concurrent slot, e.g.
  // [{ proxy: "http://p1:8080", userAgent: "UA 1", delay: 500, headers: {...} }, ...]
  slots: SlotConfig[] | null;
  respectRobots: boolean; // Skip URLs disallowed by the site's robots.txt
  respectCrawlDelay: boolean; // Honor Crawl-delay as a per-site minimum interval
  robotsUserAgent: string | null; // User-agent to match in robots.txt (defaults to userAgent)
  resolveUrls: boolean; // set() returns href, src etc. as absolute URLs
}