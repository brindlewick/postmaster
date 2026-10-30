// An invented sample repository for the review page: a small shop, "Orchard shop", with a base
// commit and a head commit that adds gift wrapping to the cart. The page builder's tests and its
// public demo page build the same repository, so everything in it is made up. It names no real
// company, product, person or address, and the only address-like text anywhere is the reserved
// example.invalid of the git identity.
//
// The commit ids are the same on every machine, in every run and in every folder: the identity, the
// dates and the messages are fixed, the files carry no executable bit, and every git call ignores
// the settings of the machine it runs on.
//
// The core is pure: sampleFiles returns the text of every file at a stage, from the sources at the
// bottom of this file. createSampleRepo is the edge, where a folder is made and git is run.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { run } from "./proc.ts";

export interface SampleRepo {
  /** The folder of the repository, made fresh under the parent that was given. */
  dir: string;
  /** The first commit: the shop before gift wrapping. */
  base: string;
  /** The second commit, the child of base: the shop with gift wrapping. */
  head: string;
}

/** A place in a head file that a ruling points at. */
export interface SampleLink {
  /** A head path. */
  path: string;
  /** Text that occurs on exactly one line of that file: the line the link starts on. */
  match: string;
  /** With this, the link runs from the matched line to the first line at or after it that holds this text. */
  to_match?: string;
  /** With this instead, the link ends this many lines after the matched line, so it covers span + 1 lines. */
  span?: number;
  label: string;
}

export interface SampleRuling {
  n: number;
  state: "open" | "decided";
  /** The title sentence, which also opens this ruling's item in SAMPLE_SUMMARY. */
  title: string;
  links: SampleLink[];
}

/** A layout override, in the shape the page builder reads. */
export interface SampleLayout {
  /** One plain sentence for each key file, by path. A removed file is keyed by the path it had. */
  purposes: Record<string, string>;
  /** Paths, or globs with *, to look at first, in order. */
  first: string[];
  rulings: SampleRuling[];
}

type Stage = "base" | "head";
type Files = Record<string, string>;

const TITLES = {
  tax: "Should the wrapping fee be taxed?",
  flat: "The wrapping fee stays a flat amount.",
} as const;

const RULING_TEXT = {
  tax: [
    `${TITLES.tax} Open.`,
    "For now it is taxed at the same rate as the goods, which is the cautious choice.",
    "Nobody has confirmed what the rules say for a service charge.",
    "If the answer is no, the change is one line in the tax file.",
  ],
  flat: [
    `${TITLES.flat} Decided.`,
    "Every wrapped box costs the same $3.50, however many boxes are in the cart.",
    "A cheaper rate for big orders was considered and left out, so the price is easy to explain at checkout.",
  ],
} as const;

/** The markdown the page shows as the change summary. */
export const SAMPLE_SUMMARY: string = `### What the change does

This change adds gift wrapping to the cart of a small, invented fruit shop. A shopper can switch
wrapping on for any box. Each wrapped box adds the same fee, $3.50, to the cart and to the order,
and an order with a wrapped box leaves the warehouse one working day later. The old free gift note
is removed, because its small job now lives in the cart code itself.

### How the files are grouped

The shop app holds the cart page, the checkout page and the new wrapping switch. The pricing
package, a shared folder of money rules, holds the wrapping fee, the discounts for buying many
boxes, and the tax. The shared package of screen parts gets a reusable on and off switch and two
small icons. The admin app can export a wrapped boxes column. Many of the changed lines are tests,
and the rest is notes for readers and settings: the list of exact package versions, the setup of
the automatic checks, and a file that the test server reads.

### Where to look first

Start with \`apps/shop/src/features/cart/components/GiftWrapToggle.tsx\`, the switch a shopper sees.
Then read \`packages/pricing/src/rules/volume/tiers/wrap.ts\`, which sets the fee. The cart tests next
to the cart code show what the shop promises.

### The two rulings

1. ${RULING_TEXT.tax.join(" ")}
2. ${RULING_TEXT.flat.join(" ")}
`;

/** The layout override for the sample: purposes, the files to read first, and the rulings. */
export const SAMPLE_LAYOUT: SampleLayout = {
  purposes: {
    "apps/shop/src/features/cart/components/GiftWrapToggle.tsx":
      "A switch under each cart line that wraps its boxes and shows the fee.",
    "apps/shop/src/features/cart/cart.ts":
      "Cart rules: the new wrapping flag on a line, and the old gift note folded in.",
    "apps/shop/src/features/cart/cartTotals.ts":
      "Adds the wrapping fee to the cart total; renamed from totals.ts.",
    "apps/shop/src/features/cart/giftNote.ts":
      "Removed: the free gift note, whose job now lives in the cart code.",
    "apps/shop/src/features/checkout/checkout.ts":
      "Sends the wrapping choice and the wrapped box count with the order.",
    "apps/shop/src/features/checkout/shipping.ts":
      "Adds one working day of dispatch when any box is wrapped.",
    "apps/shop/src/routeTree.gen.ts":
      "Written by a tool, not by hand; it lists the pages and the settings each reads.",
    "apps/shop/.env.ci":
      "Settings for the test build; this change switches gift wrapping on there.",
    "packages/pricing/src/rules/volume/tiers/wrap.ts":
      "Sets the flat wrapping fee of 3.50 for each wrapped box.",
    "packages/pricing/src/tax.ts":
      "Decides whether the wrapping fee is taxed, which is still an open question.",
    "packages/ui/src/Toggle.tsx":
      "A reusable on and off switch that screen readers announce as one.",
    "packages/ui/src/icons/outline/gift.tsx": "The gift icon shown beside the wrapping switch.",
    "apps/admin/src/orders/export/formats/csv.ts":
      "Writes the order export as CSV, now with a wrapped boxes column.",
    "docs/gift-wrap.md":
      "Explains the feature, the flat fee, and the one open and one settled question.",
  },
  first: [
    "apps/shop/src/features/cart/components/GiftWrapToggle.tsx",
    "packages/pricing/src/rules/volume/tiers/wrap.ts",
    "apps/shop/src/features/cart/*.test.ts",
  ],
  rulings: [
    {
      n: 1,
      state: "open",
      title: TITLES.tax,
      links: [
        {
          path: "packages/pricing/src/tax.ts",
          match: "Whether the gift wrapping fee is taxed",
          span: 3,
          label: "Where the fee is taxed",
        },
        {
          path: "apps/shop/src/features/cart/cartTotals.ts",
          match: "taxFor(taxableCents(goods, wrapCents))",
          label: "Where the total uses it",
        },
        {
          path: "docs/gift-wrap.md",
          match: "## Open question: is the fee taxed?",
          to_match: "update the totals test that expects the fee to be taxed.",
          label: "What the notes say",
        },
      ],
    },
    {
      n: 2,
      state: "decided",
      title: TITLES.flat,
      links: [
        {
          path: "packages/pricing/src/rules/volume/tiers/wrap.ts",
          match: "One tier on purpose",
          span: 1,
          label: "The one flat tier",
        },
        {
          path: "packages/pricing/src/rules/volume/tiers/wrap.test.ts",
          match: "keeps the fee flat for large orders",
          to_match: "toBe(40 * 350)",
          label: "The test that holds it flat",
        },
        {
          path: "docs/gift-wrap.md",
          match: "## Decided: the fee stays flat",
          to_match: "fails if a second tier is added",
          label: "Why it stays flat",
        },
      ],
    },
  ],
};

// ---- The edge: a folder, and git ---------------------------------------------------------------

const COMMITS: Record<Stage, { readonly message: string; readonly date: string }> = {
  base: { message: "Base: the shop before gift wrapping", date: "2026-01-05T10:00:00+0000" },
  head: { message: "Add gift wrapping to the cart", date: "2026-01-06T10:00:00+0000" },
};

const IDENTITY = {
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
};

// Nothing the machine sets may reach the commits: no user or system settings, no settings passed
// through the environment, and none of the variables that make git ignore -C and work in another
// repository.
const ISOLATION: Record<string, string | undefined> = {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_COUNT: undefined,
  GIT_CONFIG_PARAMETERS: undefined,
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_COMMON_DIR: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
  GIT_NAMESPACE: undefined,
  GIT_TEMPLATE_DIR: undefined,
  GIT_DEFAULT_HASH: undefined,
};

// Settings given on the command line of every git call, which win over any file. Together with the
// isolation above they leave nothing that can change a byte of a commit: the signing, the line
// endings, the ignore and attribute files, the file mode, the message encoding and the hooks.
const CONFIG_FLAGS = [
  "commit.gpgsign=false",
  "core.autocrlf=false",
  "core.fileMode=false",
  "core.hooksPath=/dev/null",
  "core.excludesFile=/dev/null",
  "core.attributesFile=/dev/null",
  "i18n.commitEncoding=UTF-8",
  "user.useConfigOnly=false",
].flatMap((setting) => ["-c", setting]);

/** Run git in a folder, with the fixed identity and the given date; the output without its end. */
function git(dir: string, args: readonly string[], date: string): string {
  const env = {
    ...ISOLATION,
    ...IDENTITY,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  };
  const result = run("git", [...CONFIG_FLAGS, "-C", dir, ...args], { env });
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.err.trim()}`);
  return result.out.trim();
}

interface Change {
  readonly remove: readonly string[];
  readonly write: ReadonlyArray<readonly [string, string]>;
}

/** What turns the files `from` into the files `to`: a rename is a removal and a write. */
function plan(from: Files, to: Files): Change {
  return {
    remove: Object.keys(from).filter((path) => !(path in to)),
    write: Object.entries(to).filter(([path, text]) => from[path] !== text),
  };
}

function apply(dir: string, change: Change): void {
  for (const path of change.remove) rmSync(join(dir, path));
  for (const [path, text] of change.write) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text, { mode: 0o644 });
  }
}

/** Bring the folder from the files `from` to the files of a stage, commit, and name the commit. */
function commitStage(dir: string, from: Files, stage: Stage): string {
  const { message, date } = COMMITS[stage];
  apply(dir, plan(from, sampleFiles(stage)));
  git(dir, ["add", "--force", "--all"], date);
  git(dir, ["commit", "-q", "--no-verify", "--no-gpg-sign", "-m", message], date);
  return git(dir, ["rev-parse", "HEAD"], date);
}

/** Make a fresh folder under parent with the two commits. The caller removes the parent. */
export function createSampleRepo(parent: string): SampleRepo {
  const dir = mkdtempSync(join(parent, "review-sample-"));
  git(dir, ["init", "-q", "-b", "main", "--template="], COMMITS.base.date);
  const base = commitStage(dir, {}, "base");
  const head = commitStage(dir, sampleFiles("base"), "head");
  return { dir, base, head };
}

// ---- The core: the files of each stage ---------------------------------------------------------

/** One file of the project, with its path at each stage (absent where it does not exist). */
interface Entry {
  readonly base?: string;
  readonly head?: string;
  /**
   * The text of the file. A line that starts with [+] is only at head, and one that starts with
   * [-] only at base; the rest of such a line is its text, indentation included, and [+] or [-]
   * alone is an empty line. Every other line is at both. A newline right after the opening quote
   * is dropped.
   */
  readonly text: string;
}

const both = (path: string, text: string): Entry => ({ base: path, head: path, text });
const added = (path: string, text: string): Entry => ({ head: path, text });
const removed = (path: string, text: string): Entry => ({ base: path, text });
const renamed = (from: string, to: string, text: string): Entry => ({ base: from, head: to, text });

const MARKED = /^\[([+-])\](.*)$/u;

/** The text of a file at a stage: its marked lines kept or dropped, the marks taken off. */
function textAt(source: string, stage: Stage): string {
  return source
    .replace(/^\n/u, "")
    .split("\n")
    .flatMap((line) => {
      const marked = MARKED.exec(line);
      if (marked === null) return [line];
      const only: Stage = marked[1] === "+" ? "head" : "base";
      return only === stage ? [marked[2]!] : [];
    })
    .join("\n");
}

/** The text of every file of the invented project at a stage, by path. A new object each call. */
export function sampleFiles(stage: Stage): Record<string, string> {
  return Object.fromEntries(
    ENTRIES.flatMap((entry) => {
      const path = entry[stage];
      return path === undefined ? [] : [[path, textAt(entry.text, stage)] as const];
    }),
  );
}

// ---- The invented project: Orchard shop --------------------------------------------------------
// Plain TypeScript and TSX in a small monorepo: two apps (shop, admin) and two packages (pricing,
// ui). The text of a file may hold no backtick (write \`), no dollar-brace and no backslash, because
// it sits in a template literal; the files that need a backslash use String.raw.

const ENTRIES: readonly Entry[] = [
  // Root files, workflow and docs
  both(
    "package.json",
    `
{
  "name": "orchard-shop-workspace",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
[-]    "test:e2e": "vitest run e2e"
[+]    "test:e2e": "pnpm --filter orchard-shop build --mode ci && vitest run e2e",
[+]    "test:wrap": "vitest run apps/shop/src/features/cart packages/pricing/src/rules"
  },
  "devDependencies": {
    "playwright": "1.48.2",
    "typescript": "5.6.3",
[-]    "vitest": "2.1.4"
[+]    "vitest": "2.1.5"
  },
  "engines": {
    "node": ">=20"
  }
}
`,
  ),
  both(
    "pnpm-lock.yaml",
    `
lockfileVersion: 5.4

importers:

  .:
    specifiers:
      playwright: 1.48.2
      typescript: 5.6.3
[-]      vitest: 2.1.4
[+]      vitest: 2.1.5
    devDependencies:
      playwright: 1.48.2
      typescript: 5.6.3
[-]      vitest: 2.1.4
[+]      vitest: 2.1.5

  apps/admin:
    specifiers:
      orchard-pricing: workspace:*
    dependencies:
      orchard-pricing: link:../../packages/pricing

  apps/shop:
    specifiers:
      orchard-pricing: workspace:*
      orchard-ui: workspace:*
      react: 18.3.1
      react-dom: 18.3.1
      vite: 5.4.10
    dependencies:
      orchard-pricing: link:../../packages/pricing
      orchard-ui: link:../../packages/ui
      react: 18.3.1
      react-dom: 18.3.1
    devDependencies:
      vite: 5.4.10

  packages/pricing:
    specifiers: {}

  packages/ui:
    specifiers:
      react: 18.3.1
    dependencies:
      react: 18.3.1

packages:

  /playwright/1.48.2:
    resolution: {integrity: sha512-0SNNDt2YJtmJtjgUq9UG0jzcFGc9aTlTM3T1E6C46NxvsTfNufwk4QoSBoRGxWCBxil3a/jwO8dMc2ULalQcjw==}
    engines: {node: '>=18'}
    hasBin: true
    dev: true

  /react-dom/18.3.1:
    resolution: {integrity: sha512-FTUoyieo6x5ukpVO8V8VWaUz/uf3L9ICeZF0LipHzEoutqJVV63kaOqR52+nQ45m9yhoMSmduXtOo3AxQSl8qw==}
    peerDependencies:
      react: ^18.3.1
    dev: false

  /react/18.3.1:
    resolution: {integrity: sha512-8B6txUisVMR6+to7flRXjQ0yxMVkBMXKUqUvOyMhbGX+dcOsScKPvINGad4N7BxwBSeRhiPWuTq6GhDth1Rwkg==}
    engines: {node: '>=0.10.0'}
    dev: false

  /typescript/5.6.3:
    resolution: {integrity: sha512-ArTcQOK0jMt2C5ssObqdR9W6SGd7pHw55BL2LY40GjSo3KHXgYjPUzR23SegETkqzcJM78BsiR7w3U1bBR+bfA==}
    engines: {node: '>=14.17'}
    hasBin: true
    dev: true

  /vite/5.4.10:
    resolution: {integrity: sha512-EavrrAiL/lbJhTtSChPmyLhHSkGSPsvllt8nxi7erhnmX3s6VQZpCpuaiXIJ3XcWna09DBntQMmp0lfiM/SoOg==}
    engines: {node: ^18.0.0 || >=20.0.0}
    hasBin: true
    dev: true

[-]  /vitest/2.1.4:
[-]    resolution: {integrity: sha512-+gdlBUK17Nmcvb5M3ZD2mT94TcjF5jhB1XsXo80/UqVcOr5PYxIIJIUEX4IlWZBXM4C0u3PNUT90GiWi+Xii1g==}
[+]  /vitest/2.1.5:
[+]    resolution: {integrity: sha512-mkpe/cF/pxcxBATrISu21G1VlgyFZnOwK9Ibe/uFO3W30o299clbcVeFIK7jFwKBark5js4gBipk8VmXobY4rA==}
    engines: {node: ^18.0.0 || >=20.0.0}
    hasBin: true
    dev: true
`,
  ),
  both(
    "README.md",
    `
# Orchard shop

A small online shop for boxes of fruit, kept as one repository with several packages. The shop is
invented: this repository exists to show how a change is reviewed.

## What is in it

- \`apps/shop\`: the storefront, with the cart and checkout pages.
- \`apps/admin\`: the order list and the order export for the packing team.
- \`packages/pricing\`: prices, discounts and tax, in whole cents.
- \`packages/ui\`: buttons and other parts that look the same in every app.
[+]
[+]## Features
[+]
[+]- Gift wrapping: a shopper can wrap any box in the cart for a flat fee. See \`docs/gift-wrap.md\`.
[+]
[+]## Settings
[+]
[+]The shop reads its settings from an environment file. The test build uses \`apps/shop/.env.ci\`.
[+]\`PUBLIC_GIFT_WRAP=on\` shows the gift wrapping switch on the cart page.

## Commands

Install once, then run the checks:

    pnpm install
    pnpm typecheck
    pnpm test

[-]The end to end tests start the shop and drive it in a real browser:
[+]The end to end tests build the shop with the settings in \`apps/shop/.env.ci\`, start it, and
[+]drive it in a real browser:

    pnpm test:e2e

## Contributing

Open a pull request against the main branch. Every pull request runs the checks above.
`,
  ),
  both(
    ".github/workflows/ci.yml",
    `
name: ci

# The shop runs its checks on its own runner, which already holds a checkout of the repository.
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: self-hosted
    steps:
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Typecheck
        run: pnpm typecheck
      - name: Unit tests
        run: pnpm test
[+]
[+]  e2e:
[+]    needs: check
[+]    runs-on: self-hosted
[+]    steps:
[+]      - name: Install
[+]        run: pnpm install --frozen-lockfile
[+]      - name: Install the browser
[+]        run: pnpm exec playwright install chromium
[+]      - name: End to end tests
[+]        run: pnpm test:e2e
`,
  ),
  both(
    "docs/architecture.md",
    `
# Architecture

Orchard shop has two apps and two shared packages. Apps are things that run; packages hold code
that the apps share.

## Apps

The shop (\`apps/shop\`) draws its pages in the browser. A page is a route, and the list of routes
is written by a tool into \`routeTree.gen.ts\`. Each feature keeps its code in one folder under
\`src/features\`, with its tests beside it.

The admin app (\`apps/admin\`) lists orders for the packing team and exports them as CSV or JSON.

## Packages

The pricing package (\`packages/pricing\`) is the only place money rules live. It works in whole
cents and rounds before it returns a number.
[-]Its rules sit under \`src/rules\`, one folder for each family of rules.
[+]Its rules sit under \`src/rules\`, grouped by what they price: volume tiers for the goods, and
[+]the flat fee for gift wrapping.

[-]The interface package (\`packages/ui\`) holds buttons and other parts that look the same in every
[-]app.
[+]The interface package (\`packages/ui\`) holds buttons, switches and other parts that look the same
[+]in every app. Icons are drawn as outlines and live under \`src/icons\`.

## How a price is made

1. Each line costs its unit price times its quantity.
2. The volume discount for the line is taken off.
[-]3. Tax is added to what is left.
[+]3. The wrapping fee is added for every wrapped box.
[+]4. Tax is added to the goods and the fee together. Whether the fee should be taxed is an open
[+]   question, see \`docs/gift-wrap.md\`.
[+]
[+]## Settings
[+]
[+]The shop reads its settings from names that start with PUBLIC_ in an environment file. A route
[+]that reads one is listed with it in \`routeTree.gen.ts\`, so the build can check the file.

## Where tests live

Unit tests sit beside the code they test. End to end tests live in \`e2e\`; they build the shop and
drive it in a real browser.
`,
  ),
  added(
    "docs/gift-wrap.md",
    `
# Gift wrapping

A shopper can ask for any box in the cart to be wrapped. This page says how it works and records
the two questions that came up while building it.

## What the shopper sees

Each cart line has a switch labelled "Gift wrap" with the fee beside it. Turning the switch on wraps
every box on that line. The cart and the checkout page show the fee as a row of its own.

The switch is a real switch for keyboards and screen readers, with the fee read out as part of its
name. While at least one box is wrapped, a short line under the list says how many, and screen
readers announce the line politely when the number changes.

The switch appears only where the setting \`PUBLIC_GIFT_WRAP\` is \`on\`. The settings for the test
build (\`apps/shop/.env.ci\`) turn it on.

## The fee

Wrapping costs a flat 3.50 for each wrapped box. The amount is set in
\`packages/pricing/src/rules/volume/tiers/wrap.ts\`. It does not change with the number of boxes in
the cart, and volume discounts never apply to it.

## Dispatch

Wrapping by hand takes time. An order with at least one wrapped box leaves the warehouse one working
day later than a plain order. The rule is in \`apps/shop/src/features/checkout/shipping.ts\`.

## The admin export

The order export has a new column that counts the wrapped boxes in each order, so the packing team
knows which orders need paper and ribbon. The CSV and the JSON formats both carry it.

## How it was tested

- Unit tests cover the fee (\`wrap.test.ts\`), the totals (\`cartTotals.test.ts\`) and the dispatch
  rule (\`shipping.test.ts\`).
- A component test draws the switch to text and checks the fee it shows.
- End to end tests wrap a box in a real browser and follow it through to the order that the server
  receives.

## Rollout

The setting \`PUBLIC_GIFT_WRAP\` is \`off\` everywhere except the test build, so merging this change
shows shoppers nothing. Turning it on in production is a separate step. Before that step, the
packing team needs the new export column, and the open tax question below needs an answer.

Carts saved in a shopper's browser before this change have no wrapping flag on their lines. They
are read as not wrapped, so nobody loses a cart.

## Decided: the fee stays flat

A cheaper rate for large orders was suggested, with the fee falling as the number of wrapped boxes
grows. We decided against it for three reasons:

- A flat fee is easy to say out loud at checkout.
- Wrapping a box takes the same effort for the fiftieth as for the first.
- The volume tiers stay about the goods, not about services.

The fee table has one tier on purpose. A test (\`wrap.test.ts\`) fails if a second tier is added.

## Open question: is the fee taxed?

Right now the fee is taxed at the same rate as the goods. That is the cautious choice, because
charging too little tax is worse than charging too much and refunding it. But a charge for a service
is sometimes taxed differently from a charge for goods, and nobody has checked the rule for the
shop's region yet.

If the answer is that the fee is not taxed, the change is one line: set \`TAX_WRAP_FEE\` to \`false\`
in \`packages/pricing/src/tax.ts\`, and update the totals test that expects the fee to be taxed.
`,
  ),

  // apps/shop: settings and entry points
  both(
    "apps/shop/package.json",
    `
{
  "name": "orchard-shop",
  "version": "0.8.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "orchard-pricing": "workspace:*",
    "orchard-ui": "workspace:*",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "vite": "5.4.10"
  }
}
`,
  ),
  both(
    "apps/shop/vite.config.ts",
    `
// Build settings for the shop. Only names that start with PUBLIC_ in the environment file reach
// the page; every other name stays out of the built files.
// The preview server is the one the end to end tests start, on a port they choose.
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: "PUBLIC_",
  build: { target: "es2022", sourcemap: true },
  preview: { host: "localhost", strictPort: true },
});
`,
  ),
  both(
    "apps/shop/.env.ci",
    `
# Settings for the build that the end to end tests start.
# Only harmless values belong here: every PUBLIC_ name can be read by the page.

# The shop and its prices.
PUBLIC_SHOP_MODE=ci
PUBLIC_SHOP_NAME=Orchard shop
PUBLIC_CURRENCY=USD
PUBLIC_FREE_SHIPPING_CENTS=6000
PUBLIC_DISPATCH_DAYS=2

# Where the page sends orders.
PUBLIC_API_BASE=/api
[+]
[+]# Features. Each one is "on" or "off".
[+]PUBLIC_GIFT_WRAP=on
`,
  ),
  both(
    "apps/shop/src/main.tsx",
    `
// Entry point: find the page for the current address and draw it.
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";

const root = document.getElementById("root");
if (!root) throw new Error("The page has no root element");

// An address with no route of its own shows the first page, the cart.
const route = routeTree.find((r) => r.path === window.location.pathname) ?? routeTree[0]!;
const Page = route.component;

createRoot(root).render(<Page />);
`,
  ),
  both(
    "apps/shop/src/routeTree.gen.ts",
    `
/* eslint-disable */
// This file is written by the route scanner (pnpm routes). Do not edit it by hand.
[-]// Source hash: 5e2b91a4
[+]// Source hash: c07d36f2
import type { ComponentType } from "react";
import { CartRoute } from "./routes/cart";
import { CheckoutRoute } from "./routes/checkout";

export interface RouteEntry {
  readonly id: string;
  readonly path: string;
  readonly component: ComponentType;
  /** Settings from the environment file that the route reads. */
  readonly flags: readonly string[];
}

export const routeTree: readonly RouteEntry[] = [
  {
    id: "/cart",
    path: "/cart",
    component: CartRoute,
[-]    flags: [],
[+]    flags: ["PUBLIC_GIFT_WRAP"],
  },
  {
    id: "/checkout",
    path: "/checkout",
    component: CheckoutRoute,
    flags: [],
  },
];

/** Every setting some route reads, so the build can check them against .env.ci. */
export const readFlags: readonly string[] = routeTree.flatMap((route) => route.flags);

export type RoutePath = (typeof routeTree)[number]["path"];
`,
  ),

  // apps/shop: routes
  both(
    "apps/shop/src/routes/cart.tsx",
    `
// The cart page: the lines, their quantities, and the way on to checkout.
import { formatCents } from "orchard-pricing";
import { useState } from "react";
[-]import { CartList } from "../features/cart/components/CartList";
[-]import { loadCart, removeLine, saveCart, setQuantity, type Cart } from "../features/cart/cart";
[-]import { totalsFor } from "../features/cart/totals";
[+]import {
[+]  countWrapped,
[+]  loadCart,
[+]  removeLine,
[+]  saveCart,
[+]  setGiftWrap,
[+]  setQuantity,
[+]  type Cart,
[+]} from "../features/cart/cart";
[+]import { totalsFor } from "../features/cart/cartTotals";
[+]import { CartList } from "../features/cart/components/CartList";
[+]
[+]/** The wrapping switch is shown only where the setting is on. */
[+]const WRAP_ON = import.meta.env.PUBLIC_GIFT_WRAP === "on";

export function CartRoute() {
  const [cart, setCart] = useState<Cart>(() => loadCart(window.localStorage));
  const totals = totalsFor(cart);
[+]  const wrapped = countWrapped(cart);

  // Keep the page and the saved copy in step.
  const update = (next: Cart) => {
    saveCart(window.localStorage, next);
    setCart(next);
  };

  return (
    <main className="page cart-page">
      <h1>Your cart</h1>
      <CartList
        cart={cart}
[+]        showWrap={WRAP_ON}
        onQuantity={(sku, quantity) => update(setQuantity(cart, sku, quantity))}
[+]        onGiftWrap={(sku, giftWrap) => update(setGiftWrap(cart, sku, giftWrap))}
        onRemove={(sku) => update(removeLine(cart, sku))}
      />
[+]      {wrapped > 0 ? (
[+]        <p className="wrap-note" aria-live="polite">
[+]          {wrapped} {wrapped === 1 ? "box" : "boxes"} will be gift wrapped.
[+]        </p>
[+]      ) : null}
      <dl className="totals">
        <dt>Subtotal</dt>
        <dd>{formatCents(totals.subtotalCents)}</dd>
        <dt>Volume discount</dt>
        <dd>{formatCents(-totals.discountCents)}</dd>
[+]        {totals.wrapCents > 0 ? (
[+]          <>
[+]            <dt>Gift wrapping</dt>
[+]            <dd>{formatCents(totals.wrapCents)}</dd>
[+]          </>
[+]        ) : null}
        <dt>Tax</dt>
        <dd>{formatCents(totals.taxCents)}</dd>
        <dt>Total</dt>
        <dd>{formatCents(totals.totalCents)}</dd>
      </dl>
      <a className="btn btn-primary" href="/checkout">
        Go to checkout
      </a>
    </main>
  );
}
`,
  ),
  both(
    "apps/shop/src/routes/checkout.tsx",
    `
// The checkout page: a last look at the order, then place it.
import { formatCents } from "orchard-pricing";
import { useState } from "react";
[-]import { loadCart, withNote } from "../features/cart/cart";
[-]import { charactersLeft } from "../features/cart/giftNote";
[-]import { goodsCents } from "../features/cart/totals";
[+]import { charactersLeft, countWrapped, loadCart, withNote } from "../features/cart/cart";
[+]import { goodsCents } from "../features/cart/cartTotals";
import { buildOrder } from "../features/checkout/checkout";
import { shippingCents } from "../features/checkout/shipping";

type Progress = "editing" | "sending" | "placed" | "failed";

export function CheckoutRoute() {
  const [cart, setCart] = useState(() => loadCart(window.localStorage));
  const [progress, setProgress] = useState<Progress>("editing");
  const order = buildOrder(cart);
  const { totals } = order;
  const goods = goodsCents(totals);
  const shipping = shippingCents(cart, goods);
[+]  const wrapped = countWrapped(cart);

  async function place() {
    setProgress("sending");
    const reply = await fetch(import.meta.env.PUBLIC_API_BASE + "/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(order),
    });
    setProgress(reply.ok ? "placed" : "failed");
  }

  if (progress === "placed") {
    return (
      <main className="page">
        <h1>Thank you</h1>
        <p>Your order is on its way to the packing team.</p>
      </main>
    );
  }

  return (
    <main className="page checkout-page">
      <h1>Checkout</h1>
      <label className="note">
[-]        Add a note to the parcel
[+]        {wrapped > 0 ? "Add a note for the card" : "Add a note to the parcel"}
        <textarea
          value={cart.note ?? ""}
          onChange={(e) => setCart(withNote(cart, e.target.value))}
        />
        <small>{charactersLeft(cart.note ?? "")} characters left</small>
      </label>
      <dl className="totals">
        <dt>Goods</dt>
        <dd>{formatCents(goods)}</dd>
[+]        {wrapped > 0 ? (
[+]          <>
[+]            <dt>Gift wrapping ({wrapped})</dt>
[+]            <dd>{formatCents(totals.wrapCents)}</dd>
[+]          </>
[+]        ) : null}
        <dt>Shipping</dt>
        <dd>{formatCents(shipping)}</dd>
        <dt>Tax</dt>
        <dd>{formatCents(totals.taxCents)}</dd>
        <dt>Total</dt>
        <dd>{formatCents(totals.totalCents + shipping)}</dd>
      </dl>
[-]      <p>Leaves the warehouse in {order.dispatchDays} working days.</p>
[+]      <p>
[+]        Leaves the warehouse in {order.dispatchDays} working days
[+]        {wrapped > 0 ? ", one of them for wrapping" : ""}.
[+]      </p>
      {progress === "failed" ? <p role="alert">The order could not be sent. Try again.</p> : null}
      <button type="button" onClick={place} disabled={progress === "sending"}>
        Place order
      </button>
    </main>
  );
}
`,
  ),

  // apps/shop: the cart feature
  both(
    "apps/shop/src/features/cart/cart.ts",
    `
// Cart rules. Every function is pure: a cart goes in and a new cart comes out.
[-]import { attachNote } from "./giftNote";

export interface CartLine {
  readonly sku: string;
  readonly name: string;
  readonly unitCents: number;
  readonly quantity: number;
[+]  /** True when every box on the line is gift wrapped. */
[+]  readonly giftWrap: boolean;
}

export interface Cart {
  readonly lines: readonly CartLine[];
  readonly note: string | null;
}

export const emptyCart: Cart = { lines: [], note: null };

/** Where the cart is kept between pages. */
const CART_STORE = "orchard.cart";
[+]
[+]/** The longest note the card has room for. */
[+]export const NOTE_LIMIT = 140;

export function addLine(cart: Cart, line: CartLine): Cart {
  const existing = cart.lines.find((l) => l.sku === line.sku);
  if (!existing) return { ...cart, lines: [...cart.lines, line] };
  return setQuantity(cart, line.sku, existing.quantity + line.quantity);
}

export function removeLine(cart: Cart, sku: string): Cart {
  return { ...cart, lines: cart.lines.filter((l) => l.sku !== sku) };
}

export function setQuantity(cart: Cart, sku: string, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, sku);
  return { ...cart, lines: cart.lines.map((l) => (l.sku === sku ? { ...l, quantity } : l)) };
}
[+]
[+]/** Turn gift wrapping on or off for every box of one product. */
[+]export function setGiftWrap(cart: Cart, sku: string, giftWrap: boolean): Cart {
[+]  return { ...cart, lines: cart.lines.map((l) => (l.sku === sku ? { ...l, giftWrap } : l)) };
[+]}

export function withNote(cart: Cart, text: string): Cart {
[-]  return { ...cart, note: attachNote(text) };
[+]  return { ...cart, note: tidyNote(text) };
}
[+]
[+]/** Tidy a note before it is stored: single spaces only, and never longer than the card. */
[+]function tidyNote(text: string): string | null {
[+]  const tidy = text.trim().split(/ +/).join(" ");
[+]  return tidy === "" ? null : tidy.slice(0, NOTE_LIMIT);
[+]}
[+]
[+]/** How many characters are left on the card for a note as typed so far. */
[+]export function charactersLeft(text: string): number {
[+]  return Math.max(0, NOTE_LIMIT - text.trim().length);
[+]}

export function countBoxes(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
}
[+]
[+]/** How many boxes will be wrapped. */
[+]export function countWrapped(cart: Cart): number {
[+]  return cart.lines.filter((l) => l.giftWrap).reduce((sum, l) => sum + l.quantity, 0);
[+]}
[+]
[+]/** A cart as an older version of the shop saved it: its lines may lack the wrapping flag. */
[+]interface StoredCart {
[+]  readonly lines: ReadonlyArray<Omit<CartLine, "giftWrap"> & { readonly giftWrap?: boolean }>;
[+]  readonly note: string | null;
[+]}

export function loadCart(storage: Pick<Storage, "getItem">): Cart {
  const stored = storage.getItem(CART_STORE);
  if (stored === null) return emptyCart;
[-]  return JSON.parse(stored) as Cart;
[+]  const parsed = JSON.parse(stored) as StoredCart;
[+]  return { ...parsed, lines: parsed.lines.map((l) => ({ ...l, giftWrap: l.giftWrap === true })) };
}

export function saveCart(storage: Pick<Storage, "setItem">, cart: Cart): void {
  storage.setItem(CART_STORE, JSON.stringify(cart));
}
`,
  ),
  removed(
    "apps/shop/src/features/cart/giftNote.ts",
    `
// The gift note: a short message the shopper can add to a whole cart. It is free, and it is
// printed on a plain card that goes in the parcel.

/** The longest note the card has room for. */
export const NOTE_LIMIT = 140;

/** Tidy a note before it is stored: single spaces only, and never longer than the card. */
export function attachNote(text: string): string | null {
  const tidy = text.trim().split(/ +/).join(" ");
  if (tidy === "") return null;
  return tidy.length > NOTE_LIMIT ? tidy.slice(0, NOTE_LIMIT) : tidy;
}

/** How many characters are left on the card for a note as typed so far. */
export function charactersLeft(text: string): number {
  return Math.max(0, NOTE_LIMIT - text.trim().length);
}
`,
  ),
  renamed(
    "apps/shop/src/features/cart/totals.ts",
    "apps/shop/src/features/cart/cartTotals.ts",
    `
// Totals for a cart, in whole cents. The pricing package owns the rules; this file adds them up.
[-]import { taxFor, volumeDiscountCents } from "orchard-pricing";
[-]import type { Cart } from "./cart";
[+]import { taxableCents, taxFor, volumeDiscountCents, wrapFeeCents } from "orchard-pricing";
[+]import { countWrapped, type Cart } from "./cart";

export interface Totals {
  readonly subtotalCents: number;
  readonly discountCents: number;
[+]  readonly wrapCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
}

/** What one line costs before any discount. */
export function lineCents(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}

/** What the shopper pays for the goods alone: the subtotal less the volume discount. */
export function goodsCents(totals: Pick<Totals, "subtotalCents" | "discountCents">): number {
  return totals.subtotalCents - totals.discountCents;
}

/** All the money figures for a cart. */
export function totalsFor(cart: Cart): Totals {
  const subtotalCents = cart.lines.reduce((sum, l) => sum + lineCents(l.unitCents, l.quantity), 0);
  const discountCents = cart.lines.reduce(
    (sum, l) => sum + volumeDiscountCents(l.unitCents, l.quantity),
    0,
  );
  const goods = goodsCents({ subtotalCents, discountCents });
[-]  const taxCents = taxFor(goods);
[-]  return { subtotalCents, discountCents, taxCents, totalCents: goods + taxCents };
[+]  const wrapCents = wrapFeeCents(countWrapped(cart));
[+]  const taxCents = taxFor(taxableCents(goods, wrapCents));
[+]  return {
[+]    subtotalCents,
[+]    discountCents,
[+]    wrapCents,
[+]    taxCents,
[+]    totalCents: goods + wrapCents + taxCents,
[+]  };
}
`,
  ),
  both(
    "apps/shop/src/features/cart/cart.test.ts",
    `
import { describe, expect, test } from "vitest";
import {
  addLine,
  countBoxes,
[+]  countWrapped,
  emptyCart,
[+]  loadCart,
[+]  NOTE_LIMIT,
  removeLine,
[+]  saveCart,
[+]  setGiftWrap,
  setQuantity,
  withNote,
  type CartLine,
} from "./cart";
[-]import { NOTE_LIMIT } from "./giftNote";

[-]const pear: CartLine = { sku: "box-pear", name: "Pear box", unitCents: 2400, quantity: 1 };
[-]const apple: CartLine = { sku: "box-apple", name: "Apple box", unitCents: 1800, quantity: 2 };
[+]const pear: CartLine = {
[+]  sku: "box-pear",
[+]  name: "Pear box",
[+]  unitCents: 2400,
[+]  quantity: 1,
[+]  giftWrap: false,
[+]};
[+]const apple: CartLine = {
[+]  sku: "box-apple",
[+]  name: "Apple box",
[+]  unitCents: 1800,
[+]  quantity: 2,
[+]  giftWrap: false,
[+]};

describe("addLine", () => {
  test("puts a new product in the cart", () => {
    const cart = addLine(emptyCart, pear);
    expect(cart.lines).toEqual([pear]);
  });

  test("adds to the quantity of a product that is already there", () => {
    const cart = addLine(addLine(emptyCart, pear), pear);
    expect(cart.lines).toEqual([{ ...pear, quantity: 2 }]);
  });
});

describe("setQuantity", () => {
  test("changes the quantity of one product", () => {
    const cart = setQuantity(addLine(emptyCart, apple), "box-apple", 5);
    expect(countBoxes(cart)).toBe(5);
  });

  test("removes the product when the quantity reaches zero", () => {
    const cart = setQuantity(addLine(emptyCart, apple), "box-apple", 0);
    expect(cart.lines).toEqual([]);
  });
});

describe("removeLine", () => {
  test("leaves the other products alone", () => {
    const cart = removeLine(addLine(addLine(emptyCart, pear), apple), "box-pear");
    expect(cart.lines).toEqual([apple]);
  });
});

describe("withNote", () => {
  test("keeps a short note as it is", () => {
    expect(withNote(emptyCart, "Happy day").note).toBe("Happy day");
  });

  test("drops a note that is only spaces", () => {
    expect(withNote(emptyCart, "   ").note).toBeNull();
  });

  test("cuts a long note to the size of the card", () => {
    const note = withNote(emptyCart, "x".repeat(NOTE_LIMIT + 20)).note;
    expect(note?.length).toBe(NOTE_LIMIT);
  });
});
[+]
[+]describe("setGiftWrap", () => {
[+]  test("turns wrapping on for one product only", () => {
[+]    const cart = setGiftWrap(addLine(addLine(emptyCart, pear), apple), "box-pear", true);
[+]    expect(cart.lines.map((l) => l.giftWrap)).toEqual([true, false]);
[+]  });
[+]
[+]  test("turns it off again", () => {
[+]    const wrapped = setGiftWrap(addLine(emptyCart, pear), "box-pear", true);
[+]    expect(setGiftWrap(wrapped, "box-pear", false).lines[0]?.giftWrap).toBe(false);
[+]  });
[+]});
[+]
[+]describe("countWrapped", () => {
[+]  test("counts every box on a wrapped line", () => {
[+]    const cart = setGiftWrap(addLine(addLine(emptyCart, pear), apple), "box-apple", true);
[+]    expect(countWrapped(cart)).toBe(2);
[+]  });
[+]});
[+]
[+]describe("loadCart", () => {
[+]  const storing = (value: string | null) => ({ getItem: () => value });
[+]
[+]  test("starts empty when nothing is saved", () => {
[+]    expect(loadCart(storing(null))).toEqual(emptyCart);
[+]  });
[+]
[+]  test("gives a cart saved before gift wrapping a flag of false on every line", () => {
[+]    const { giftWrap, ...older } = pear;
[+]    const saved = JSON.stringify({ lines: [older], note: null });
[+]    expect(giftWrap).toBe(false);
[+]    expect(loadCart(storing(saved)).lines[0]?.giftWrap).toBe(false);
[+]  });
[+]
[+]  test("keeps the flag of a cart saved with wrapping on", () => {
[+]    const writes: string[] = [];
[+]    const wrapped = setGiftWrap(addLine(emptyCart, pear), "box-pear", true);
[+]    saveCart({ setItem: (_name, value) => void writes.push(value) }, wrapped);
[+]    expect(loadCart(storing(writes[0] ?? null)).lines[0]?.giftWrap).toBe(true);
[+]  });
[+]});
`,
  ),
  added(
    "apps/shop/src/features/cart/cartTotals.test.ts",
    `
import { describe, expect, test } from "vitest";
import type { Cart, CartLine } from "./cart";
import { goodsCents, lineCents, totalsFor } from "./cartTotals";

const pear: CartLine = {
  sku: "box-pear",
  name: "Pear box",
  unitCents: 2400,
  quantity: 1,
  giftWrap: false,
};

const cartOf = (...lines: CartLine[]): Cart => ({ lines, note: null });

describe("lineCents", () => {
  test("is the unit price times the quantity", () => {
    expect(lineCents(2400, 3)).toBe(7200);
  });
});

describe("goodsCents", () => {
  test("is the subtotal less the volume discount", () => {
    expect(goodsCents({ subtotalCents: 12000, discountCents: 600 })).toBe(11400);
  });
});

describe("totalsFor", () => {
  test("adds tax to one plain box", () => {
    expect(totalsFor(cartOf(pear))).toEqual({
      subtotalCents: 2400,
      discountCents: 0,
      wrapCents: 0,
      taxCents: 192,
      totalCents: 2592,
    });
  });

  test("takes the volume discount off five boxes", () => {
    const totals = totalsFor(cartOf({ ...pear, quantity: 5 }));
    expect(totals.discountCents).toBe(600);
    expect(totals.totalCents).toBe(12312);
  });

  test("adds the flat fee for a wrapped box", () => {
    const totals = totalsFor(cartOf({ ...pear, giftWrap: true }));
    expect(totals.wrapCents).toBe(350);
  });

  test("charges the fee for each wrapped box, not once for the cart", () => {
    const totals = totalsFor(cartOf({ ...pear, quantity: 3, giftWrap: true }));
    expect(totals.wrapCents).toBe(1050);
  });

  test("leaves a line that is switched off unwrapped", () => {
    const wrapped = { ...pear, sku: "box-plum", giftWrap: true };
    expect(totalsFor(cartOf(pear, wrapped)).wrapCents).toBe(350);
  });

  test("taxes the wrapping fee like the goods", () => {
    const totals = totalsFor(cartOf({ ...pear, giftWrap: true }));
    expect(totals.taxCents).toBe(220);
    expect(totals.totalCents).toBe(2970);
  });

  test("gives the volume discount on the goods but never on the fee", () => {
    const totals = totalsFor(cartOf({ ...pear, quantity: 10, giftWrap: true }));
    expect(totals.discountCents).toBe(2400);
    expect(totals.wrapCents).toBe(3500);
  });

  test("rounds the tax to whole cents when the amount does not divide evenly", () => {
    const totals = totalsFor(cartOf({ ...pear, unitCents: 1999, giftWrap: true }));
    expect(totals.taxCents).toBe(188);
  });

  test("adds up several lines, wrapped and plain", () => {
    const plum = { ...pear, sku: "box-plum", name: "Plum box", unitCents: 2100, quantity: 2 };
    const totals = totalsFor(cartOf({ ...pear, giftWrap: true }, plum));
    expect(totals.subtotalCents).toBe(6600);
    expect(totals.wrapCents).toBe(350);
  });

  test("is zero all through for an empty cart", () => {
    expect(totalsFor(cartOf())).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      wrapCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });
});
`,
  ),
  both(
    "apps/shop/src/features/cart/components/CartList.tsx",
    `
// The lines of a cart, one row each, with a quantity box and a remove button.
import { formatCents } from "orchard-pricing";
import { Button } from "orchard-ui";
import type { Cart } from "../cart";
[-]import { lineCents } from "../totals";
[+]import { lineCents } from "../cartTotals";
[+]import { GiftWrapToggle } from "./GiftWrapToggle";

export interface CartListProps {
  readonly cart: Cart;
[+]  /** Show the gift wrapping switch under each line. */
[+]  readonly showWrap: boolean;
  readonly onQuantity: (sku: string, quantity: number) => void;
[+]  readonly onGiftWrap: (sku: string, wrapped: boolean) => void;
  readonly onRemove: (sku: string) => void;
}

[-]export function CartList({ cart, onQuantity, onRemove }: CartListProps) {
[+]export function CartList({ cart, showWrap, onQuantity, onGiftWrap, onRemove }: CartListProps) {
  if (cart.lines.length === 0) return <p className="empty">Your cart is empty.</p>;
  return (
    <ul className="cart-list">
      {cart.lines.map((line) => (
        <li key={line.sku} className="cart-line">
          <span className="cart-name">{line.name}</span>
          <input
            type="number"
            min={1}
            value={line.quantity}
            aria-label={"Quantity of " + line.name}
            onChange={(e) => onQuantity(line.sku, Number(e.target.value))}
          />
          <span className="cart-price">
            {formatCents(lineCents(line.unitCents, line.quantity))}
          </span>
[-]          <Button tone="plain" onClick={() => onRemove(line.sku)}>
[+]          <Button tone="quiet" onClick={() => onRemove(line.sku)}>
            Remove
          </Button>
[+]          {showWrap ? <GiftWrapToggle line={line} onChange={onGiftWrap} /> : null}
        </li>
      ))}
    </ul>
  );
}
`,
  ),
  added(
    "apps/shop/src/features/cart/components/GiftWrapToggle.tsx",
    `
// The gift wrapping switch shown under a cart line.
import { formatCents, wrapFeeCents } from "orchard-pricing";
import { GiftIcon, Toggle } from "orchard-ui";
import type { CartLine } from "../cart";

export interface GiftWrapToggleProps {
  readonly line: CartLine;
  readonly onChange: (sku: string, wrapped: boolean) => void;
}

/** A switch that wraps every box on the line, with the fee for those boxes beside it. */
export function GiftWrapToggle({ line, onChange }: GiftWrapToggleProps) {
  const fee = wrapFeeCents(line.quantity);
  return (
    <Toggle
      id={"wrap-" + line.sku}
      checked={line.giftWrap}
      onChange={(wrapped) => onChange(line.sku, wrapped)}
      icon={<GiftIcon size={18} />}
      label="Gift wrap"
      hint={"+" + formatCents(fee)}
    />
  );
}
`,
  ),
  added(
    "apps/shop/src/features/cart/components/GiftWrapToggle.test.tsx",
    `
// The switch is drawn to text on the server here, so the test needs no browser.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CartLine } from "../cart";
import { GiftWrapToggle } from "./GiftWrapToggle";

const pear: CartLine = {
  sku: "box-pear",
  name: "Pear box",
  unitCents: 2400,
  quantity: 2,
  giftWrap: false,
};

function draw(line: CartLine): string {
  return renderToStaticMarkup(<GiftWrapToggle line={line} onChange={() => {}} />);
}

describe("GiftWrapToggle", () => {
  test("shows the fee for every box on the line", () => {
    expect(draw(pear)).toContain("+$7.00");
  });

  test("is off for a plain line and on for a wrapped one", () => {
    expect(draw(pear)).toContain('aria-checked="false"');
    expect(draw({ ...pear, giftWrap: true })).toContain('aria-checked="true"');
  });

  test("is named after the product it belongs to", () => {
    expect(draw(pear)).toContain('id="wrap-box-pear"');
  });

  test("grows the fee with the quantity", () => {
    expect(draw({ ...pear, quantity: 1 })).toContain("+$3.50");
    expect(draw({ ...pear, quantity: 4 })).toContain("+$14.00");
  });

  test("labels the switch Gift wrap", () => {
    expect(draw(pear)).toContain("Gift wrap");
  });
});
`,
  ),

  // apps/shop: the checkout feature
  both(
    "apps/shop/src/features/checkout/checkout.ts",
    `
// Turns a cart into the order the server receives.
[-]import type { Cart } from "../cart/cart";
[-]import { totalsFor, type Totals } from "../cart/totals";
[+]import { countWrapped, type Cart } from "../cart/cart";
[+]import { totalsFor, type Totals } from "../cart/cartTotals";
import { dispatchDays } from "./shipping";

export interface OrderLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitCents: number;
[+]  readonly giftWrap: boolean;
}

export interface OrderPayload {
  readonly lines: readonly OrderLine[];
  readonly note: string | null;
  readonly totals: Totals;
[+]  readonly wrappedBoxes: number;
  readonly dispatchDays: number;
}

/** The order for a cart, with only what the server needs. */
export function buildOrder(cart: Cart): OrderPayload {
  return {
[-]    lines: cart.lines.map(({ sku, quantity, unitCents }) => ({ sku, quantity, unitCents })),
[+]    lines: cart.lines.map(({ sku, quantity, unitCents, giftWrap }) => ({
[+]      sku,
[+]      quantity,
[+]      unitCents,
[+]      giftWrap,
[+]    })),
    note: cart.note,
    totals: totalsFor(cart),
[+]    wrappedBoxes: countWrapped(cart),
    dispatchDays: dispatchDays(cart),
  };
}
`,
  ),
  both(
    "apps/shop/src/features/checkout/checkout.test.ts",
    `
import { describe, expect, test } from "vitest";
[-]import { addLine, emptyCart, withNote, type CartLine } from "../cart/cart";
[+]import { addLine, emptyCart, setGiftWrap, withNote, type CartLine } from "../cart/cart";
import { buildOrder } from "./checkout";

[-]const pear: CartLine = { sku: "box-pear", name: "Pear box", unitCents: 2400, quantity: 2 };
[+]const pear: CartLine = {
[+]  sku: "box-pear",
[+]  name: "Pear box",
[+]  unitCents: 2400,
[+]  quantity: 2,
[+]  giftWrap: false,
[+]};

describe("buildOrder", () => {
  test("lists the lines without their names", () => {
    const order = buildOrder(addLine(emptyCart, pear));
[-]    expect(order.lines).toEqual([{ sku: "box-pear", quantity: 2, unitCents: 2400 }]);
[+]    expect(order.lines).toEqual([
[+]      { sku: "box-pear", quantity: 2, unitCents: 2400, giftWrap: false },
[+]    ]);
  });

  test("carries the note through", () => {
    const order = buildOrder(withNote(addLine(emptyCart, pear), "Enjoy"));
    expect(order.note).toBe("Enjoy");
  });

  test("includes the totals for the cart", () => {
    expect(buildOrder(addLine(emptyCart, pear)).totals.subtotalCents).toBe(4800);
  });

  test("promises dispatch in two working days", () => {
    expect(buildOrder(addLine(emptyCart, pear)).dispatchDays).toBe(2);
  });
[+]
[+]  test("counts the wrapped boxes and adds the fee to the totals", () => {
[+]    const order = buildOrder(setGiftWrap(addLine(emptyCart, pear), "box-pear", true));
[+]    expect(order.wrappedBoxes).toBe(2);
[+]    expect(order.totals.wrapCents).toBe(700);
[+]  });
[+]
[+]  test("promises dispatch a day later for a wrapped order", () => {
[+]    const order = buildOrder(setGiftWrap(addLine(emptyCart, pear), "box-pear", true));
[+]    expect(order.dispatchDays).toBe(3);
[+]  });
});
`,
  ),
  both(
    "apps/shop/src/features/checkout/shipping.ts",
    `
// Shipping rules. Dispatch time and the shipping charge both depend on the cart.
[-]import { countBoxes, type Cart } from "../cart/cart";
[+]import { countBoxes, countWrapped, type Cart } from "../cart/cart";

/** Orders whose goods cost this much or more ship free. */
const FREE_SHIPPING_CENTS = 6000;
/** Working days before a plain order leaves the warehouse. */
const BASE_DISPATCH_DAYS = 2;
[+]/** Wrapping by hand takes a working day. */
[+]const WRAP_EXTRA_DAYS = 1;

/** The shipping charge: a base rate, and a dollar for each box past the second. */
export function shippingCents(cart: Cart, goodsCents: number): number {
  if (goodsCents >= FREE_SHIPPING_CENTS) return 0;
  return 495 + 100 * Math.max(0, countBoxes(cart) - 2);
}

[-]/** Working days before the parcel leaves the warehouse. */
[-]export function dispatchDays(_cart: Cart): number {
[-]  return BASE_DISPATCH_DAYS;
[+]/** Working days before the parcel leaves the warehouse: one more if any box is wrapped. */
[+]export function dispatchDays(cart: Cart): number {
[+]  return BASE_DISPATCH_DAYS + (countWrapped(cart) > 0 ? WRAP_EXTRA_DAYS : 0);
}
`,
  ),
  added(
    "apps/shop/src/features/checkout/shipping.test.ts",
    `
import { describe, expect, test } from "vitest";
import type { Cart, CartLine } from "../cart/cart";
import { dispatchDays, shippingCents } from "./shipping";

const pear: CartLine = {
  sku: "box-pear",
  name: "Pear box",
  unitCents: 2400,
  quantity: 2,
  giftWrap: false,
};

const cartOf = (...lines: CartLine[]): Cart => ({ lines, note: null });

describe("shippingCents", () => {
  test("is free once the goods reach 60 dollars", () => {
    expect(shippingCents(cartOf(pear), 6000)).toBe(0);
  });

  test("charges the base rate for two boxes", () => {
    expect(shippingCents(cartOf(pear), 4800)).toBe(495);
  });

  test("adds a dollar for each box past the second", () => {
    expect(shippingCents(cartOf({ ...pear, quantity: 4 }), 5000)).toBe(695);
  });

  test("charges nothing extra for wrapping", () => {
    expect(shippingCents(cartOf({ ...pear, giftWrap: true }), 4800)).toBe(495);
  });
});

describe("dispatchDays", () => {
  test("is two working days for a plain order", () => {
    expect(dispatchDays(cartOf(pear))).toBe(2);
  });

  test("adds a day when a box is wrapped", () => {
    expect(dispatchDays(cartOf({ ...pear, giftWrap: true }))).toBe(3);
  });

  test("adds only one day however many boxes are wrapped", () => {
    const wrapped = { ...pear, quantity: 9, giftWrap: true };
    expect(dispatchDays(cartOf(wrapped))).toBe(3);
  });
});
`,
  ),

  // apps/admin
  both(
    "apps/admin/package.json",
    `
{
  "name": "orchard-admin",
  "version": "0.5.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "orchard-pricing": "workspace:*"
  }
}
`,
  ),
  both(
    "apps/admin/src/orders/orderList.ts",
    `
// The order list in the admin app: filtering and sorting only. Drawing it is done elsewhere.
import type { PriceLine } from "orchard-pricing";

export interface OrderRow {
  readonly id: string;
  readonly placedOn: string;
  readonly lines: readonly PriceLine[];
[+]  /** The gift wrapping fee inside the total, in whole cents. */
[+]  readonly wrapCents: number;
  readonly totalCents: number;
  readonly status: "new" | "packed" | "shipped";
}

/** The orders with one status. */
export function byStatus(rows: readonly OrderRow[], status: OrderRow["status"]): OrderRow[] {
  return rows.filter((row) => row.status === status);
}

/** The newest orders first; orders placed on the same day keep their order. */
export function newestFirst(rows: readonly OrderRow[]): OrderRow[] {
  return [...rows].sort((a, b) => b.placedOn.localeCompare(a.placedOn));
}

/** How many boxes an order holds. */
export function countBoxes(row: OrderRow): number {
  return row.lines.reduce((sum, line) => sum + line.quantity, 0);
}
[+]
[+]/** How many boxes of an order need wrapping, which is what the packing team counts. */
[+]export function wrappedBoxes(row: OrderRow): number {
[+]  return row.lines.filter((line) => line.giftWrap).reduce((sum, line) => sum + line.quantity, 0);
[+]}
[+]
[+]/** New orders that still need paper and ribbon, oldest first so that none waits. */
[+]export function toWrap(rows: readonly OrderRow[]): OrderRow[] {
[+]  return newestFirst(byStatus(rows, "new").filter((row) => wrappedBoxes(row) > 0)).reverse();
[+]}
`,
  ),
  added(
    "apps/admin/src/orders/export/formats/csv.ts",
    String.raw`
// The order export as CSV, for the accounts spreadsheet.
import { formatCents } from "orchard-pricing";
import { countBoxes, wrappedBoxes, type OrderRow } from "../../orderList";

const HEADER = ["order", "placed_on", "boxes", "wrapped_boxes", "wrap_fee", "total"];

/** Quote a cell when it holds a comma, a quote or a line break. */
function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function rowCells(row: OrderRow): string[] {
  return [
    row.id,
    row.placedOn,
    countBoxes(row),
    wrappedBoxes(row),
    formatCents(row.wrapCents),
    formatCents(row.totalCents),
  ].map(cell);
}

/** One line for the header and one for each order, each ending in a line break. */
export function toCsv(rows: readonly OrderRow[]): string {
  const lines = [HEADER.map(cell), ...rows.map(rowCells)];
  return lines.map((cells) => cells.join(",")).join("\n") + "\n";
}
`,
  ),
  added(
    "apps/admin/src/orders/export/formats/json.ts",
    String.raw`
// The order export as JSON, for the accounts system. Money stays in whole cents.
import { countBoxes, wrappedBoxes, type OrderRow } from "../../orderList";

export interface ExportedOrder {
  readonly order: string;
  readonly placedOn: string;
  readonly boxes: number;
  readonly wrappedBoxes: number;
  readonly wrapCents: number;
  readonly totalCents: number;
}

/** The fields the accounts system reads, in the order it expects them. */
export function toExported(row: OrderRow): ExportedOrder {
  return {
    order: row.id,
    placedOn: row.placedOn,
    boxes: countBoxes(row),
    wrappedBoxes: wrappedBoxes(row),
    wrapCents: row.wrapCents,
    totalCents: row.totalCents,
  };
}

/** The orders as indented JSON, ending in a line break. */
export function toJson(rows: readonly OrderRow[]): string {
  return JSON.stringify(rows.map(toExported), null, 2) + "\n";
}
`,
  ),

  both(
    "apps/admin/src/orders/orderList.test.ts",
    `
import type { PriceLine } from "orchard-pricing";
import { describe, expect, test } from "vitest";
[-]import { byStatus, countBoxes, newestFirst, type OrderRow } from "./orderList";
[+]import {
[+]  byStatus,
[+]  countBoxes,
[+]  newestFirst,
[+]  toWrap,
[+]  wrappedBoxes,
[+]  type OrderRow,
[+]} from "./orderList";

[-]const line = (quantity: number): PriceLine => ({ sku: "box-pear", unitCents: 2400, quantity });
[+]const line = (quantity: number, giftWrap = false): PriceLine => ({
[+]  sku: "box-pear",
[+]  unitCents: 2400,
[+]  quantity,
[+]  giftWrap,
[+]});

[-]function order(id: string, placedOn: string, status: OrderRow["status"], quantity = 1): OrderRow {
[-]  return { id, placedOn, status, lines: [line(quantity)], totalCents: 2400 * quantity };
[-]}
[+]function order(
[+]  id: string,
[+]  placedOn: string,
[+]  status: OrderRow["status"],
[+]  { quantity = 1, giftWrap = false } = {},
[+]): OrderRow {
[+]  const wrapCents = giftWrap ? 350 * quantity : 0;
[+]  const lines = [line(quantity, giftWrap)];
[+]  return { id, placedOn, status, lines, wrapCents, totalCents: 2400 * quantity + wrapCents };
[+]}

describe("byStatus", () => {
  test("keeps only the orders with that status", () => {
    const rows = [order("o-a", "2026-01-02", "new"), order("o-b", "2026-01-03", "packed")];
    expect(byStatus(rows, "packed").map((row) => row.id)).toEqual(["o-b"]);
  });
});

describe("newestFirst", () => {
  test("sorts by the day the order was placed", () => {
    const rows = [order("o-a", "2026-01-02", "new"), order("o-b", "2026-01-04", "new")];
    expect(newestFirst(rows).map((row) => row.id)).toEqual(["o-b", "o-a"]);
  });

  test("does not change the list it is given", () => {
    const rows = [order("o-a", "2026-01-02", "new"), order("o-b", "2026-01-04", "new")];
    newestFirst(rows);
    expect(rows.map((row) => row.id)).toEqual(["o-a", "o-b"]);
  });
});

describe("countBoxes", () => {
  test("adds up the quantities on all lines", () => {
    const row = { ...order("o-a", "2026-01-02", "new"), lines: [line(2), line(3)] };
    expect(countBoxes(row)).toBe(5);
  });
});
[+]
[+]describe("wrappedBoxes", () => {
[+]  test("counts the boxes on wrapped lines only", () => {
[+]    const row = { ...order("o-a", "2026-01-02", "new"), lines: [line(2, true), line(3)] };
[+]    expect(wrappedBoxes(row)).toBe(2);
[+]  });
[+]
[+]  test("is zero for an order with no wrapping", () => {
[+]    expect(wrappedBoxes(order("o-a", "2026-01-02", "new"))).toBe(0);
[+]  });
[+]});
[+]
[+]describe("toWrap", () => {
[+]  const rows = [
[+]    order("o-a", "2026-01-04", "new", { giftWrap: true }),
[+]    order("o-b", "2026-01-02", "new", { giftWrap: true }),
[+]    order("o-c", "2026-01-03", "new"),
[+]    order("o-d", "2026-01-01", "packed", { giftWrap: true }),
[+]  ];
[+]
[+]  test("lists new orders with wrapped boxes, oldest first", () => {
[+]    expect(toWrap(rows).map((row) => row.id)).toEqual(["o-b", "o-a"]);
[+]  });
[+]
[+]  test("leaves out orders that are packed already", () => {
[+]    expect(toWrap(rows).some((row) => row.status !== "new")).toBe(false);
[+]  });
[+]});
`,
  ),
  added(
    "apps/admin/src/orders/export/formats/formats.test.ts",
    String.raw`
// Both export formats carry the same facts, so they are tested side by side.
import { describe, expect, test } from "vitest";
import type { OrderRow } from "../../orderList";
import { toCsv } from "./csv";
import { toExported, toJson } from "./json";

const rows: OrderRow[] = [
  {
    id: "o-a",
    placedOn: "2026-01-02",
    lines: [{ sku: "box-pear", unitCents: 2400, quantity: 2, giftWrap: true }],
    wrapCents: 700,
    totalCents: 5500,
    status: "new",
  },
  {
    id: "o-b",
    placedOn: "2026-01-03",
    lines: [
      { sku: "box-apple", unitCents: 1800, quantity: 1, giftWrap: false },
      { sku: "box-plum", unitCents: 2100, quantity: 3, giftWrap: false },
    ],
    wrapCents: 0,
    totalCents: 8100,
    status: "packed",
  },
];

describe("toCsv", () => {
  test("starts with a header line and has one line for each order", () => {
    const lines = toCsv(rows).trimEnd().split("\n");
    expect(lines[0]).toBe("order,placed_on,boxes,wrapped_boxes,wrap_fee,total");
    expect(lines).toHaveLength(3);
  });

  test("counts the wrapped boxes and shows money in dollars", () => {
    expect(toCsv(rows).split("\n")[1]).toBe("o-a,2026-01-02,2,2,$7.00,$55.00");
  });

  test("ends with exactly one line break", () => {
    expect(toCsv(rows).endsWith("\n")).toBe(true);
    expect(toCsv(rows).endsWith("\n\n")).toBe(false);
  });
});

describe("toJson", () => {
  test("lists the same orders with money in whole cents", () => {
    expect(JSON.parse(toJson(rows))).toEqual([
      {
        order: "o-a",
        placedOn: "2026-01-02",
        boxes: 2,
        wrappedBoxes: 2,
        wrapCents: 700,
        totalCents: 5500,
      },
      {
        order: "o-b",
        placedOn: "2026-01-03",
        boxes: 4,
        wrappedBoxes: 0,
        wrapCents: 0,
        totalCents: 8100,
      },
    ]);
  });

  test("ends with exactly one line break", () => {
    expect(toJson(rows).endsWith("]\n")).toBe(true);
    expect(toJson(rows).endsWith("\n\n")).toBe(false);
  });
});

describe("both formats", () => {
  test("agree on the wrapped boxes of every order", () => {
    const fromCsv = toCsv(rows)
      .trimEnd()
      .split("\n")
      .slice(1)
      .map((line) => Number(line.split(",")[3]));
    expect(fromCsv).toEqual(rows.map((row) => toExported(row).wrappedBoxes));
  });
});
`,
  ),

  // packages/pricing
  both(
    "packages/pricing/package.json",
    `
{
  "name": "orchard-pricing",
[-]  "version": "0.3.0",
[+]  "version": "0.4.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
[-]    "./testing": "./src/testing/fixtures.ts"
[+]    "./testing": "./src/testing/fixtures.ts",
[+]    "./wrap": "./src/rules/volume/tiers/wrap.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
`,
  ),
  both(
    "packages/pricing/src/index.ts",
    `
// The public surface of the pricing package. Apps import from here, never from a deeper file.

// Money in, money out: rounding and display.
export { formatCents, roundHalfUp } from "./rounding";

// Discounts for buying more of one product.
export { volumeDiscountCents } from "./discount";
export { STANDARD_TIERS, tierFor } from "./rules/volume/tiers/standard";
export type { VolumeTier } from "./rules/volume/tiers/standard";
[+]
[+]// Gift wrapping.
[+]export { WRAP_TIERS, wrapFeeCents } from "./rules/volume/tiers/wrap";
[+]export type { WrapTier } from "./rules/volume/tiers/wrap";

// Sales tax.
[-]export { TAX_RATE_BP, taxFor, withTax } from "./tax";
[+]export { TAX_RATE_BP, TAX_WRAP_FEE, taxableCents, taxFor, withTax } from "./tax";

// The shapes the rules work on.
export type { Cents, PriceLine } from "./types";
`,
  ),
  both(
    "packages/pricing/src/types.ts",
    `
// Shapes shared by every pricing rule. Money is always whole cents.

/** An amount of money in whole cents: 2400 is 24 dollars. */
export type Cents = number;

/** One line of an order, as the rules see it. */
export interface PriceLine {
  readonly sku: string;
  readonly unitCents: Cents;
  readonly quantity: number;
[+]  /** True when every box on the line is gift wrapped. */
[+]  readonly giftWrap: boolean;
}
`,
  ),
  both(
    "packages/pricing/src/rounding.ts",
    `
// Rounding and showing money. All prices are whole cents, so every rule rounds before it returns.

/** Round half up: 2.5 becomes 3, and 2.4 becomes 2. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** Show cents as a price: 1250 becomes "$12.50", and a negative amount keeps its sign in front. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(cents) / 100);
  const part = String(Math.abs(cents) % 100).padStart(2, "0");
  return sign + "$" + whole + "." + part;
}
`,
  ),
  both(
    "packages/pricing/src/discount.ts",
    `
// The volume discount for one order line.
import { roundHalfUp } from "./rounding";
import { tierFor } from "./rules/volume/tiers/standard";

/** The discount, in cents, for buying a quantity of boxes at a unit price. */
export function volumeDiscountCents(unitCents: number, quantity: number): number {
  const tier = tierFor(quantity);
  return roundHalfUp((unitCents * quantity * tier.percentOff) / 100);
}

/** The price of one box after the discount, for showing beside the quantity. */
export function discountedUnitCents(unitCents: number, quantity: number): number {
  return unitCents - roundHalfUp(volumeDiscountCents(unitCents, quantity) / quantity);
}
`,
  ),
  both(
    "packages/pricing/src/tax.ts",
    `
// Sales tax. One standard rate applies to every product.
import { roundHalfUp } from "./rounding";

/** The tax rate in basis points, where 100 basis points are one percent: 800 is 8 percent. */
export const TAX_RATE_BP = 800;
[+]
[+]/**
[+] * Whether the gift wrapping fee is taxed like the goods. This is still an open question, see
[+] * docs/gift-wrap.md. Until it is settled the fee is taxed, which is the cautious choice.
[+] */
[+]export const TAX_WRAP_FEE = true;

/** Tax on an amount of cents, rounded to whole cents. */
export function taxFor(taxableCents: number): number {
  return roundHalfUp((taxableCents * TAX_RATE_BP) / 10000);
}
[+]
[+]/** The part of an order that tax applies to. */
[+]export function taxableCents(goodsCents: number, wrapCents: number): number {
[+]  return TAX_WRAP_FEE ? goodsCents + wrapCents : goodsCents;
[+]}

/** The price with tax added. */
export function withTax(cents: number): number {
  return cents + taxFor(cents);
}
`,
  ),
  both(
    "packages/pricing/src/rules/volume/tiers/standard.ts",
    `
// The standard volume tiers: the more boxes of one product, the bigger the discount.

export interface VolumeTier {
  /** The smallest quantity that earns this tier. */
  readonly minQuantity: number;
  /** The discount, as a percentage of the line. */
  readonly percentOff: number;
}

export const STANDARD_TIERS: readonly VolumeTier[] = [
  { minQuantity: 1, percentOff: 0 },
  { minQuantity: 5, percentOff: 5 },
  { minQuantity: 10, percentOff: 10 },
];
[+]
[+]/**
[+] * The best tier of any table that a quantity qualifies for. Tables list their tiers smallest
[+] * first.
[+] */
[+]export function pickTier<T extends { readonly minQuantity: number }>(
[+]  tiers: readonly T[],
[+]  quantity: number,
[+]): T {
[+]  const earned = tiers.filter((tier) => quantity >= tier.minQuantity);
[+]  return earned[earned.length - 1] ?? tiers[0]!;
[+]}

/** The best tier a quantity qualifies for. */
export function tierFor(quantity: number): VolumeTier {
[-]  const earned = STANDARD_TIERS.filter((tier) => quantity >= tier.minQuantity);
[-]  return earned[earned.length - 1] ?? STANDARD_TIERS[0]!;
[+]  return pickTier(STANDARD_TIERS, quantity);
}
`,
  ),
  added(
    "packages/pricing/src/rules/volume/tiers/wrap.ts",
    `
// The gift wrapping fee. It is the same for every box, and no volume tier lowers it: see
// docs/gift-wrap.md for why the fee stays flat.
import { pickTier } from "./standard";

export interface WrapTier {
  /** The smallest number of wrapped boxes that earns this tier. */
  readonly minQuantity: number;
  /** The fee for each wrapped box, in whole cents. */
  readonly feeCents: number;
}

/** One tier on purpose: the fee stays flat however many boxes are wrapped. */
export const WRAP_TIERS: readonly WrapTier[] = [{ minQuantity: 1, feeCents: 350 }];

/** The fee for wrapping a number of boxes. Wrapping none costs nothing. */
export function wrapFeeCents(boxes: number): number {
  if (boxes <= 0) return 0;
  return pickTier(WRAP_TIERS, boxes).feeCents * boxes;
}
`,
  ),
  added(
    "packages/pricing/src/rules/volume/tiers/wrap.test.ts",
    `
import { describe, expect, test } from "vitest";
import { pear, times, wrapped } from "../../../testing/fixtures";
import { WRAP_TIERS, wrapFeeCents } from "./wrap";

describe("wrapFeeCents", () => {
  test("costs nothing when no box is wrapped", () => {
    expect(wrapFeeCents(0)).toBe(0);
  });

  test("charges the flat fee for one box", () => {
    expect(wrapFeeCents(1)).toBe(350);
  });

  test("keeps the fee flat for large orders", () => {
    expect(wrapFeeCents(40)).toBe(40 * 350);
  });

  test("has a single tier, so no volume break can lower it", () => {
    expect(WRAP_TIERS).toHaveLength(1);
  });

  test("prices a wrapped fixture line by its quantity", () => {
    const line = wrapped(times(pear, 3));
    expect(line.giftWrap).toBe(true);
    expect(wrapFeeCents(line.quantity)).toBe(1050);
  });

  test("starts the one tier at the first box", () => {
    expect(WRAP_TIERS[0]?.minQuantity).toBe(1);
  });

  test("never charges a negative fee", () => {
    expect(wrapFeeCents(-2)).toBe(0);
  });
});
`,
  ),
  both(
    "packages/pricing/src/testing/fixtures.ts",
    `
// Order lines shared by the pricing tests and by the shop's tests.
import type { PriceLine } from "../types";

[-]export const pear: PriceLine = { sku: "box-pear", unitCents: 2400, quantity: 1 };
[-]export const apple: PriceLine = { sku: "box-apple", unitCents: 1800, quantity: 1 };
[-]export const plum: PriceLine = { sku: "box-plum", unitCents: 2100, quantity: 1 };
[+]export const pear: PriceLine = { sku: "box-pear", unitCents: 2400, quantity: 1, giftWrap: false };
[+]export const apple: PriceLine = { sku: "box-apple", unitCents: 1800, quantity: 1, giftWrap: false };
[+]export const plum: PriceLine = { sku: "box-plum", unitCents: 2100, quantity: 1, giftWrap: false };

/** The same line, bought in a different quantity. */
export function times(line: PriceLine, quantity: number): PriceLine {
  return { ...line, quantity };
}
[+]
[+]/** The same line, with gift wrapping switched on. */
[+]export function wrapped(line: PriceLine): PriceLine {
[+]  return { ...line, giftWrap: true };
[+]}

/** A basket of the three boxes, one of each. */
export function oneOfEach(): PriceLine[] {
  return [pear, apple, plum];
}
`,
  ),

  // packages/ui
  both(
    "packages/ui/package.json",
    `
{
  "name": "orchard-ui",
  "version": "0.6.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "sideEffects": ["*.css"],
  "dependencies": {
    "react": "18.3.1"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
`,
  ),
  both(
    "packages/ui/src/index.ts",
    `
// The public surface of the interface package. Apps import from here, never from a deeper file.
// The style sheet is loaded once, here, so that no app has to import it.
import "./styles.css";

// Buttons.
export { Button } from "./Button";
export type { ButtonProps } from "./Button";
[+]
[+]// Switches.
[+]export { Toggle } from "./Toggle";
[+]export type { ToggleProps } from "./Toggle";
[+]
[+]// Outline icons, 20 pixels square unless a size is given.
[+]export { BoxIcon } from "./icons/outline/box";
[+]export { GiftIcon } from "./icons/outline/gift";
[+]export type { IconProps } from "./icons/outline/types";

// Nothing else is exported: the files behind these names may change without notice.
// Keep this list short, and add a line only when a second app needs the part.
`,
  ),
  both(
    "packages/ui/src/Button.tsx",
    `
// A plain button. The look comes from the class names in styles.css.
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
[-]  /** Primary is the one main action on a page; plain is for everything else. */
[-]  readonly tone?: "primary" | "plain";
[+]  /** Primary is the one main action on a page, plain is for the rest, quiet is for small links. */
[+]  readonly tone?: "primary" | "plain" | "quiet";
  readonly children: ReactNode;
}

export function Button({ tone = "primary", children, className, ...rest }: ButtonProps) {
  const classes = ["btn", "btn-" + tone, className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
`,
  ),
  added(
    "packages/ui/src/Toggle.tsx",
    `
// An on and off switch. It is a button with the role "switch", so a keyboard and a screen reader
// treat it as a switch, and the label beside it names it.
import type { ReactNode } from "react";

export interface ToggleProps {
  /** Ties the switch to its label. Must be unique on the page. */
  readonly id: string;
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly label: ReactNode;
  /** A small picture shown between the switch and the label. */
  readonly icon?: ReactNode;
  /** Extra words shown after the label, such as a price. */
  readonly hint?: string;
  readonly disabled?: boolean;
}

export function Toggle({
  id,
  checked,
  onChange,
  label,
  icon,
  hint,
  disabled = false,
}: ToggleProps) {
  const labelId = id + "-label";
  return (
    <div className={disabled ? "toggle toggle-disabled" : "toggle"}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        className="toggle-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
      {icon}
      <span id={labelId} className="toggle-label">
        {label}
      </span>
      {hint ? <span className="toggle-hint">{hint}</span> : null}
    </div>
  );
}
`,
  ),
  added(
    "packages/ui/src/Toggle.test.tsx",
    `
// The switch is drawn to text on the server here, so the test needs no browser.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Toggle, type ToggleProps } from "./Toggle";

function draw(props: Partial<ToggleProps> = {}): string {
  return renderToStaticMarkup(
    <Toggle id="wrap" checked={false} onChange={() => {}} label="Gift wrap" {...props} />,
  );
}

describe("Toggle", () => {
  test("is a switch that is named by its label", () => {
    const html = draw();
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-labelledby="wrap-label"');
    expect(html).toContain('id="wrap-label"');
  });

  test("says whether it is on", () => {
    expect(draw({ checked: false })).toContain('aria-checked="false"');
    expect(draw({ checked: true })).toContain('aria-checked="true"');
  });

  test("shows the icon, then the label, then the hint", () => {
    const html = draw({ hint: "+$3.50", icon: <span className="pic" /> });
    expect(html.indexOf("pic")).toBeLessThan(html.indexOf("Gift wrap"));
    expect(html.indexOf("Gift wrap")).toBeLessThan(html.indexOf("+$3.50"));
  });

  test("leaves the hint out when there is none", () => {
    expect(draw()).not.toContain("toggle-hint");
  });

  test("can be disabled", () => {
    const html = draw({ disabled: true });
    expect(html).toContain("disabled");
    expect(html).toContain("toggle-disabled");
  });
});
`,
  ),
  both(
    "packages/ui/src/styles.css",
    `
/* Styles for the interface package. Colours are set here once and used by every app. */

.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: 1px solid #2f5d3a;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}

.btn-primary {
  background: #2f5d3a;
  color: #ffffff;
}

.btn-plain {
  background: #ffffff;
  color: #2f5d3a;
}
[+]
[+].btn-quiet {
[+]  border-color: transparent;
[+]  background: transparent;
[+]  color: #2f5d3a;
[+]  text-decoration: underline;
[+]}

.btn:focus-visible {
  outline: 3px solid #f2b705;
  outline-offset: 2px;
}
[+]
[+].toggle {
[+]  display: flex;
[+]  align-items: center;
[+]  gap: 0.5rem;
[+]}
[+]
[+].toggle-switch {
[+]  position: relative;
[+]  width: 2.5rem;
[+]  height: 1.4rem;
[+]  padding: 0;
[+]  border: 1px solid #2f5d3a;
[+]  border-radius: 999px;
[+]  background: #ffffff;
[+]  cursor: pointer;
[+]}
[+]
[+].toggle-switch[aria-checked="true"] {
[+]  background: #2f5d3a;
[+]}
[+]
[+].toggle-knob {
[+]  position: absolute;
[+]  top: 2px;
[+]  left: 2px;
[+]  width: 1rem;
[+]  height: 1rem;
[+]  border-radius: 50%;
[+]  background: #f2b705;
[+]}
[+]
[+].toggle-switch[aria-checked="true"] .toggle-knob {
[+]  left: calc(100% - 1rem - 2px);
[+]}
[+]
[+].toggle-disabled {
[+]  opacity: 0.5;
[+]}
[+]
[+].toggle-hint {
[+]  margin-left: auto;
[+]  color: #5b6b5f;
[+]}
`,
  ),
  added(
    "packages/ui/src/icons/outline/types.ts",
    `
// Props shared by every outline icon. An icon draws one picture, so it takes no children, and it
// is hidden from screen readers by default: the words beside it say what it means.
import type { SVGProps } from "react";

/** The attributes of an svg element, minus children, plus a size. */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Width and height in pixels. */
  readonly size?: number;
}

/** The pixel size an icon has when none is given. */
export const DEFAULT_ICON_SIZE = 20;
`,
  ),
  added(
    "packages/ui/src/icons/outline/gift.tsx",
    `
// A gift box with a ribbon, drawn as an outline.
import { DEFAULT_ICON_SIZE, type IconProps } from "./types";

export function GiftIcon({ size = DEFAULT_ICON_SIZE, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8h14v-8" />
      <path d="M12 8v12" />
      <path d="M12 8c-1.5-3-5-3-5-1s3 1 5 1z" />
      <path d="M12 8c1.5-3 5-3 5-1s-3 1-5 1z" />
    </svg>
  );
}
`,
  ),
  added(
    "packages/ui/src/icons/outline/box.tsx",
    `
// A closed parcel box, drawn as an outline.
import { DEFAULT_ICON_SIZE, type IconProps } from "./types";

export function BoxIcon({ size = DEFAULT_ICON_SIZE, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="M3 8l9-5 9 5v9l-9 5-9-5z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v9" />
    </svg>
  );
}
`,
  ),

  // e2e: the end to end tests and their helper
  both(
    "e2e/helpers/server.ts",
    `
// Starts the built shop on a free port for the end to end tests, and stops it afterwards.
import { spawn } from "node:child_process";
import { createServer } from "node:net";

export interface Server {
  /** The address the browser opens, without a trailing slash. */
  readonly url: string;
  stop(): Promise<void>;
}

/** The preview server speaks plain HTTP, and only on this machine. */
const SCHEME = "http";

/** Ask the system for a port nobody is using. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer(() => {});
    probe.listen(0, "localhost", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => (port === 0 ? reject(new Error("No free port")) : resolve(port)));
    });
  });
}

[-]/** Poll until the cart page answers, or give up after ten seconds. */
[+]/** Poll until the cart page answers, or give up after twenty seconds. */
async function waitUntilUp(url: string): Promise<void> {
[-]  for (let attempt = 0; attempt < 50; attempt++) {
[+]  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url + "/cart")).ok) return;
    } catch {
      // Not listening yet; try again shortly.
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("The shop did not start in time");
}

/** Start the built shop. The server it returns stops it again. */
export async function startServer(env: Record<string, string> = {}): Promise<Server> {
  const port = await freePort();
  const child = spawn("pnpm", ["--filter", "orchard-shop", "preview", "--port", String(port)], {
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
  const url = SCHEME + "://localhost:" + port;
  await waitUntilUp(url);
  return {
    url,
    stop: async () => {
      child.kill();
[+]      // Wait for it to go, so the next spec file never meets a port that is still held.
[+]      await new Promise((done) => child.once("exit", () => done(undefined)));
    },
  };
}
`,
  ),
  both(
    "e2e/cart.spec.ts",
    `
// End to end: the cart page in a real browser, against the built shop.
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { startServer, type Server } from "./helpers/server";

/** Where the shop keeps the cart in the browser. */
const CART_STORE = "orchard.cart";

[-]const PEARS = { sku: "box-pear", name: "Pear box", unitCents: 2400, quantity: 2 };
[+]const PEARS = { sku: "box-pear", name: "Pear box", unitCents: 2400, quantity: 2, giftWrap: false };

let server: Server;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await startServer();
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  await browser.close();
  await server.stop();
});

beforeEach(async () => {
  page = await browser.newPage();
  const saved = JSON.stringify({ lines: [PEARS], note: null });
  // Save the cart only when the browser has none, so a reload keeps what the test did.
  await page.addInitScript(
    ([store, value]) => {
      if (localStorage.getItem(store!) === null) localStorage.setItem(store!, value!);
    },
    [CART_STORE, saved],
  );
  await page.goto(server.url + "/cart");
});

afterEach(async () => {
  await page.close();
});

describe("the cart page", () => {
  test("lists the saved line with its price", async () => {
    const line = await page.locator(".cart-line").innerText();
    expect(line).toContain("Pear box");
    expect(line).toContain("$48.00");
  });

  test("shows the total with tax", async () => {
    expect(await page.locator(".totals").innerText()).toContain("$51.84");
  });

  test("empties the cart when the line is removed", async () => {
    await page.getByRole("button", { name: "Remove" }).click();
    expect(await page.locator("main").innerText()).toContain("Your cart is empty.");
  });
[+]
[+]  test("adds the wrapping fee to the total when a line is wrapped", async () => {
[+]    await page.getByRole("switch", { name: "Gift wrap" }).click();
[+]    const totals = await page.locator(".totals").innerText();
[+]    expect(totals).toContain("Gift wrapping");
[+]    expect(totals).toContain("$7.00");
[+]    expect(totals).toContain("$59.40");
[+]  });
[+]
[+]  test("says how many boxes will be wrapped", async () => {
[+]    await page.getByRole("switch", { name: "Gift wrap" }).click();
[+]    expect(await page.locator(".wrap-note").innerText()).toBe("2 boxes will be gift wrapped.");
[+]  });
[+]
[+]  test("shows the fee beside the switch before it is turned on", async () => {
[+]    expect(await page.locator(".toggle-hint").innerText()).toBe("+$7.00");
[+]  });
[+]
[+]  test("takes the fee away again when the switch is turned off", async () => {
[+]    const wrap = page.getByRole("switch", { name: "Gift wrap" });
[+]    await wrap.click();
[+]    await wrap.click();
[+]    expect(await page.locator(".totals").innerText()).not.toContain("Gift wrapping");
[+]  });
[+]
[+]  test("keeps a wrapped line wrapped after the page is reloaded", async () => {
[+]    await page.getByRole("switch", { name: "Gift wrap" }).click();
[+]    await page.reload();
[+]    const wrap = page.getByRole("switch", { name: "Gift wrap" });
[+]    expect(await wrap.getAttribute("aria-checked")).toBe("true");
[+]  });
});
`,
  ),
  both(
    "e2e/checkout.spec.ts",
    `
// End to end: the checkout page in a real browser, against the built shop.
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { startServer, type Server } from "./helpers/server";

/** Where the shop keeps the cart in the browser. */
const CART_STORE = "orchard.cart";

[-]const PEARS = { sku: "box-pear", name: "Pear box", unitCents: 2400, quantity: 2 };
[+]const PEARS = { sku: "box-pear", name: "Pear box", unitCents: 2400, quantity: 2, giftWrap: false };
[+]const WRAPPED = { ...PEARS, giftWrap: true };

let server: Server;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await startServer();
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  await browser.close();
  await server.stop();
});

beforeEach(async () => {
  page = await browser.newPage();
});

afterEach(async () => {
  await page.close();
});

/** Open the checkout page with one line in the cart. */
async function openWith(line: object): Promise<void> {
  const saved = JSON.stringify({ lines: [line], note: null });
  await page.addInitScript(([store, value]) => localStorage.setItem(store!, value!), [
    CART_STORE,
    saved,
  ]);
  await page.goto(server.url + "/checkout");
}

/** Answer the order request the page makes, and keep what it sent. */
async function answerOrders(status: number): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route("**/api/orders", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status, body: "{}" });
  });
  return bodies;
}

describe("the checkout page", () => {
  test("shows the goods, the shipping and the total", async () => {
    await openWith(PEARS);
    const totals = await page.locator(".totals").innerText();
    expect(totals).toContain("$48.00");
    expect(totals).toContain("$4.95");
    expect(totals).toContain("$56.79");
  });

  test("places the order and thanks the shopper", async () => {
    const bodies = await answerOrders(200);
    await openWith(PEARS);
    await page.getByRole("button", { name: "Place order" }).click();
    await page.getByText("Thank you").waitFor();
    expect(bodies).toHaveLength(1);
  });

  test("tells the shopper when the order could not be sent", async () => {
    await answerOrders(500);
    await openWith(PEARS);
    await page.getByRole("button", { name: "Place order" }).click();
    await page.getByRole("alert").waitFor();
    expect(await page.getByRole("alert").innerText()).toContain("could not be sent");
  });
[+]
[+]  test("lists the wrapping fee and the extra day of dispatch", async () => {
[+]    await openWith(WRAPPED);
[+]    const text = await page.locator("main").innerText();
[+]    expect(text).toContain("Gift wrapping (2)");
[+]    expect(text).toContain("$7.00");
[+]    expect(text).toContain("3 working days, one of them for wrapping");
[+]  });
[+]
[+]  test("adds the fee to the total, tax included", async () => {
[+]    await openWith(WRAPPED);
[+]    expect(await page.locator(".totals").innerText()).toContain("$64.35");
[+]  });
[+]
[+]  test("sends the wrapping choice with the order", async () => {
[+]    const bodies = await answerOrders(200);
[+]    await openWith(WRAPPED);
[+]    await page.getByRole("button", { name: "Place order" }).click();
[+]    await page.getByText("Thank you").waitFor();
[+]    expect(bodies[0]).toMatchObject({ wrappedBoxes: 2, dispatchDays: 3 });
[+]  });
});
`,
  ),
];
