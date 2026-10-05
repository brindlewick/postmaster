// Counts who wrote the issues, pull requests and comments of a repository, from two files made by
//   gh issue list --state all --limit 500 --json number,author,comments
//   gh pr list --state all --limit 300 --json number,author,comments,reviews,state,mergedAt
// Any login other than the owner's is printed as "other-<n>", in order of first appearance, so the
// record names no third party. Bodies are never read.
//
//   bun --no-env-file count-authors.ts <owner-login> <issues.json> <prs.json>
import { readFileSync } from "node:fs";

const [owner, issuesFile, prsFile] = process.argv.slice(2);
if (!owner || !issuesFile || !prsFile) {
  console.error("usage: count-authors.ts <owner-login> <issues.json> <prs.json>");
  process.exit(1);
}
type Person = { login?: string } | null | undefined;
type Item = {
  number: number;
  author: Person;
  comments?: { author: Person }[];
  reviews?: { author: Person }[];
  state?: string;
  mergedAt?: string | null;
};
const issues: Item[] = JSON.parse(readFileSync(issuesFile, "utf8"));
const prs: Item[] = JSON.parse(readFileSync(prsFile, "utf8"));
const alias = new Map<string, string>();
const name = (p: Person): string => {
  const login = p?.login ?? "?";
  if (login === owner) return "owner";
  if (!alias.has(login)) alias.set(login, `other-${alias.size + 1}`);
  return alias.get(login) as string;
};
const tally = (items: Item[], pick: (i: Item) => Person[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const it of items) for (const p of pick(it)) out[name(p)] = (out[name(p)] ?? 0) + 1;
  return out;
};
console.log(`issues ${issues.length}, pull requests ${prs.length}, highest number ${Math.max(...issues.map((i) => i.number), ...prs.map((p) => p.number))}`);
console.log("issue authors", JSON.stringify(tally(issues, (i) => [i.author])));
console.log("issue comment authors", JSON.stringify(tally(issues, (i) => (i.comments ?? []).map((c) => c.author))));
console.log("pull request authors", JSON.stringify(tally(prs, (i) => [i.author])));
console.log("pull request comment authors", JSON.stringify(tally(prs, (i) => (i.comments ?? []).map((c) => c.author))));
console.log("pull request review authors", JSON.stringify(tally(prs, (i) => (i.reviews ?? []).map((c) => c.author))));
console.log(
  "pull requests by someone other than the owner",
  JSON.stringify(
    prs
      .filter((p) => name(p.author) !== "owner")
      .map((p) => `${name(p.author)}: ${p.mergedAt ? "merged" : String(p.state).toLowerCase()}`),
  ),
);
console.log(`most comments on one issue ${Math.max(...issues.map((i) => (i.comments ?? []).length))}`);
console.log(`control: items by a login that is not in the data ${[...issues, ...prs].filter((i) => i.author?.login === "zzqxv309nonsense").length}`);
