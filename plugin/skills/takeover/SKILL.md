---
name: takeover
description: Take over work from a baton brief, or from a Claude Code or Codex session by id, name or "last". Use when the user says take over, resume, continue session X, pick up the codex/claude session, or names a brief.
---

`baton` below means `node "${CLAUDE_PLUGIN_ROOT}/cli/baton.js"` (the CLI ships with this plugin; it is `../../cli/baton.js` from this skill's base directory). If `baton` is on PATH, that works too.

Argument: `[claude|codex] <ref>`: a brief name/id, or a session id, id prefix, session name, or `last` (newest session in this repo). Pass `claude`/`codex` when the user names the agent.

1. `baton takeover [claude|codex] <ref> --name <new-name> --model <your exact model id>`. If it prints `brief started from … session`, nobody handed that session over: fill the brief's `<!-- fill -->` sections from its `## Extract` (then delete Extract) and rerun, or, if the user prefers, rerun with `--distill` (one cheap-model pass over the whole session). If it says a name matches several sessions, show the list and ask which. It shows the brief, checks it against git (the sanity check), and only then starts your continuation brief.
2. Exit 2 = git drifted since the brief: report the drift lines to the user and wait. If the output says `verify not run`, read that command; if it is what you expect, rerun with `--run`. Exit 1 = brief unfilled or its verify command failed (or the brief was just created from a session id): fix that, then rerun.
3. Show the user the `--- switch ---` block verbatim (previous vs new model/provider, tokens carried vs saved).
4. Read every file listed under `## Read first` in the brief (mission, curated knowledge) before acting; paths are relative to State's `worktree`/`root`. Working in a different worktree is fine: the check only flags diverged history.
5. Fill Task in the continuation brief and work from the old brief's Next. The Mission is inherited; do not rewrite it.
