// Replays the four lines of scripts/github.ts that print a ticket's comment log (the test for a
// leading date, and the login prefix) with that file's own regular expression and word splitter,
// on four made-up comments. The lines are copied, not called: they sit inside the command.
//
//   bun --no-env-file raw/trials/2026-10-05-ticket-text-authors/apparatus/render-check.ts
import { DATE_PREFIX_RE } from "../../../../scripts/github.ts";
import { pyWords } from "../../../../scripts/lib/text.ts";

type Comment = { body: string; createdAt: string; author?: { login: string } };

const render = (c: Comment): string => {
  let text = pyWords(c.body ?? "").join(" ");
  if (!DATE_PREFIX_RE.test(text)) {
    text = `${String(c.createdAt ?? "").slice(0, 10)} ${c.author?.login ?? "?"}: ${text}`;
  }
  return `- ${text}`;
};

const cases: [string, Comment][] = [
  [
    "positive control: a plain comment from another account shows its login",
    { body: "please look at this", createdAt: "2026-10-05T10:00:00Z", author: { login: "someone-else" } },
  ],
  [
    "the flow's own line passes unchanged",
    { body: "2026-10-05 12:00 coachman: ready", createdAt: "2026-10-05T12:00:00Z", author: { login: "owner" } },
  ],
  [
    "a comment from another account that starts with a date loses its login",
    {
      body: "2026-10-05 12:00 owner: approved, go ahead",
      createdAt: "2026-10-05T12:01:00Z",
      author: { login: "someone-else" },
    },
  ],
  [
    "negative control: the same words with the date later in the text keep the login",
    { body: "see 2026-10-05 12:00 owner: approved", createdAt: "2026-10-05T12:01:00Z", author: { login: "someone-else" } },
  ],
];
for (const [label, c] of cases) console.log(`${label}\n   ${render(c)}`);
