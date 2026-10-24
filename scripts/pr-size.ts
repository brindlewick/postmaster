// The size of a pull request meant for a person to review, against the budget its project sets.
//
//   run pr-size <base> <head> [--repo <repo>]   count the change from <base> to <head>
//   run pr-size --limits [--repo <repo>]        the waybill's line with the aim and the cap
//
// The change is `git diff --numstat -z -M <base>...<head>`, the range a pull request shows: lines
// added plus lines removed, tests included, as scripts/lib/pr-size.ts counts them. A file deleted
// whole counts as one line and a binary file none. Left out are the files the project's
// `generated_files` names, the ones `footprint` calls generated (lock files, `.gen.` files, `dist/`
// and `build/`), and translation catalogs and vector images. <repo> is the project's root, where
// its settings are (default: here). The budget is the project's `pr_size_aim` and `pr_size_cap`
// where its runs open draft pull requests or it names a number for `pr_size_cap`, and none
// otherwise: then nothing is printed.
//
//   exit 0  at or under the cap, or the project has no budget
//   exit 1  usage, a revision git cannot read, or settings that cannot be read or hold a wrong
//           value (a draft_pull_requests other than "on" or "off", an aim above the cap)
//   exit 2  over the cap
import { classify } from "./footprint.ts";
import { generatedFilesOf, isDie, prSizeBudgetOf } from "./lib/effective-config.ts";
import { limitsLine, overCap, parseNumstat, sizeLine, sizeOf, standing } from "./lib/pr-size.ts";
import { run } from "./lib/proc.ts";
import { generatedMatcher } from "./lib/switch-offs.ts";

const USAGE = "usage: run pr-size <base> <head> [--repo <repo>] | --limits [--repo <repo>]";
const UNREAD = /\.(?:po|pot|svg)$/u;

const usage = (): number => {
  console.error(USAGE);
  return 1;
};

function main(argv: string[]): number {
  let repo = ".";
  let limits = false;
  const revs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--limits") limits = true;
    else if (arg === "--repo" && i + 1 < argv.length) repo = argv[++i] as string;
    else if (arg.startsWith("-")) return usage();
    else revs.push(arg);
  }
  if (revs.length !== (limits ? 0 : 2)) return usage();
  try {
    const budget = prSizeBudgetOf(repo);
    if (budget === null) return 0;
    if (limits) {
      console.log(limitsLine(budget));
      return 0;
    }
    const range = `${revs[0]}...${revs[1]}`;
    const diff = (...flags: string[]) =>
      run("git", ["-C", repo, "diff", ...flags, "-z", "-M", range]);
    const counted = diff("--numstat");
    const deleted = diff("--name-only", "--diff-filter=D");
    if (counted.code !== 0 || deleted.code !== 0) {
      console.error(`pr-size: git cannot read ${range} in ${repo}`);
      return 1;
    }
    const generated = generatedMatcher(generatedFilesOf(repo));
    const size = sizeOf(
      parseNumstat(counted.out),
      new Set(deleted.out.split("\0")),
      (path) => generated(path) || UNREAD.test(path) || classify(path) === "generated",
    );
    console.log(sizeLine(size, budget));
    console.log(`files: ${size.files}`);
    console.log(standing(size, budget));
    return overCap(size, budget) ? 2 : 0;
  } catch (e) {
    if (!isDie(e)) throw e;
    console.error(`pr-size: ${e.message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
