---
name: handover
description: Hand the current work to another agent, model or session by writing a distilled baton brief. Use when the user says hand over, pass the baton, switch agent/model, or context is nearly full.
---

`baton` below is the baton CLI from npm. If `command -v baton` finds nothing, stop and tell the user to install the `@sriinnu/baton` package globally with npm (Node >= 20; see https://www.npmjs.com/package/@sriinnu/baton), then retry.

Run `baton init` if `.baton/` is missing. Then:

1. `baton handover --name <name> --model <your exact model id> [--parent <ref>]` (name from the user's argument, else a short slug of the task; `--parent` only if this session itself continues an earlier brief).
2. Fill every `<!-- fill -->` in the printed file from this conversation: Mission (root briefs only, one paragraph), Task, Decisions (with why), Done, Next, Dead ends, Open questions.
3. If the work depends on files that carry the mission or curated knowledge, list them under `## Read first` (or set `readFirst` in `.baton/config.json`). Under `dirty:` in State add `verify: <command that proves the work is healthy>`.
4. Under 150 lines, no secrets. Never edit Mission of a child brief or State's git lines.

Tell the user the brief name; the next agent starts with `baton takeover <name>`.
