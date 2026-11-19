## baton: passing work between agents

Briefs live in `.baton/briefs/<id>.md`: distilled, never transcripts. Any agent can read and write them by hand; the `baton` CLI (github.com/sriinnu/baton: clone, `npm link`) only automates it.

**Leaving (handing off, context nearly full, switching model):**
1. `baton handover --name <name> [--parent <ref>]`, then fill every `<!-- fill -->` from your own context: Task, Decisions (with why), Done, Next, Dead ends, Open questions. Root briefs also get a one-paragraph Mission.
2. Add `verify: <command>` under `dirty:` in State (the command that proves the work is healthy).
3. Keep it under 150 lines. No secrets. Tell the user the name.

**Arriving (given a brief name, brief id or session id):**
1. `baton takeover <ref> --name <new>`: shows the brief, checks it against git (the sanity check), then starts your continuation brief. Session id with no brief yet? It creates one to fill, then rerun.
2. Exit 2 = drift (git moved): report it to the user before touching anything. Exit 1 = brief unfilled or verify failed: fix that first.
3. Read every file under `## Read first` (mission, curated knowledge) before acting. A different worktree is fine; the check only flags diverged history.
4. Work from Next. Same mission; you inherit it.

**Delegating to a subagent or new session:** `baton child <ref> --task "<its slice>" [--agent-id <id>]`, then give the agent only that brief's path. Do not paste history.

**Subagents:** the brief's `## Report back` is an order. Before you finish, fill Done, Decisions, Dead ends in your brief. The parent runs `baton fold <id>`.

Never edit `## Mission` (root only) or `## State` (generated from git).
