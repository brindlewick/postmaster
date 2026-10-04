# Add a task

Add puts a new task, not done, at the end of the list and prints its id.

## Sub-features

- `add-one` stores one task and prints `added <id>`.
- `add-join` joins the words after `add` into one text, with single spaces.
- `add-id` gives the task an id one higher than the highest id in the list.
- `add-persist` keeps the list in the list file, written whole.

## How to get to it (user POV)

Run `todo add <text>` in a terminal. The text may be one quoted argument or several words.

## Driving it with control-todo

Preconditions:

- `control-todo doctor` exits 0.
- The label is new, so its list is empty.

- **Add one.** Run `control-todo run add1 -- add "buy milk"`. stdout is `"added 1\n"`, stderr is empty, the exit code is 0, and `list after` holds one task with id 1, text `buy milk` and done false.
- **Join words.** Run `control-todo run add1 -- add post the letter`. stdout is `"added 2\n"` and the new task's text is `post the letter`.
- **Persistence.** Run `control-todo show add1`. The file holds both tasks in the order they were added, as JSON indented by two spaces, ending in a newline.
- **Proof.** Every `run` appended its block to the proof file for `add1`; confirm that `todo-verify-proof/add1.txt` holds both blocks.

## Gotchas

- Words are joined, then trimmed. `add "  buy milk "` stores `buy milk`; spaces inside one quoted argument stay.
- A blank text is a usage error, not an empty task: see usage.md.
- The id comes from the highest id in the file, so it follows the file, not a counter the app keeps.
