---
name: experiments
description: Show a project's experiments on an Artifact Shelf page made for a phone, with what is due first. The page is one file with the rows inline, republished to the project's one slug after each change, so its link always shows the newest rows. Use it when the postmaster publishes the page, and after each change to the experiments.
---

# Experiments pages

One page per project: an experiment tests one project's flow, so each project gets its own
page, and one project's rows never go to another's page. The record lives in the project's
private folder on this machine; the page is built from it and carries every row inline, with
the time it was built. `<tool>` below is the postmaster repository: the folder two above this
file once its link is resolved. `<repo>` is the repository the experiments belong to.

The page goes on the Artifact Shelf with its command line, `artifact`, which reads the shelf's
address from `ARTIFACT_SHELF_URL`. When `artifact` is not on PATH, say so and stop: the record
is still current, and `experiments list` reads it.

## Build and publish the page after each change

1. Build it: `<tool>/scripts/run experiments page --project <repo>`. It writes
   `<repo>/.postmaster/experiments-page.html`, which git ignores, and prints that path and the
   project's slug, one per line.
2. Screen the page for anything the Never section forbids: a credential, a key-shaped token, a
   home path, a host name, an email address, or a link to this machine. On any hit, stop and ask
   the user instead of publishing; never publish first and check later.
3. Publish it to the printed slug: `artifact publish <path> --slug <slug>`. It prints
   `Title: <title>` and the page's link on two lines. Publishing to the same slug adds the
   page's next version, and the link shows the newest, so a project never gets a second page.
4. Give the user the title and the link, the first time and whenever they ask.

## Comments

The page is for reading and writes nothing. The user may still comment on it on the shelf. When
they say they have, read them with `artifact comments <slug> --open --json`, answer each in the
chat, and close each one answered with `artifact close <id>`.

## Never

- Publish a page that holds a credential, a home path, a host name, an email address, a link to
  this machine, or a value from `~/.config`, `~/.claude` or `~/.postmaster`.
- Publish one project's rows to another project's slug.
- Delete a page without the user's word.
- Commit a page or its link to a repository.
