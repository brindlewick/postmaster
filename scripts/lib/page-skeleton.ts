// The document a one-file page is published in. A page's own markup starts at its title and ends with
// its scripts, because the first host that showed these pages put them in a document of its own. A
// host that stores a file and serves it as it is gives the browser no doctype (so it falls back to
// quirks mode), no viewport (so a phone lays the page out 980 px wide) and its own margin round the
// body. This skeleton is the one the render gate puts a page in before it checks it
// (scripts/review-page-gate.ts, wrapSkeleton), so what is published is what the gate saw.
const HEAD =
  '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
const TAIL = "</body></html>";

/** The page, the markup a builder makes, inside a complete document. */
export function inSkeleton(page: string): string {
  return HEAD + page + TAIL;
}
