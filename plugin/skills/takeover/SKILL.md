---
name: takeover
description: Take over work from a baton brief, brief name, or session id. Use when the user says take over, resume, continue session X, or names a brief.
---

`baton` below means `node "${CLAUDE_PLUGIN_ROOT}/cli/baton.js"` (the CLI ships with this plugin; it is `../../cli/baton.js` from this skill's base directory). If `baton` is on PATH, that works too.

Argument: `<ref>` (brief name/id or session id).

1. `baton takeover <ref> --name <new-name> --agent claude --model <your exact model id>`. It shows the brief, checks it against git (the sanity check), and only then starts your continuation brief.
2. Exit 2 = git drifted since the brief: report the drift lines to the user and wait. If the output says `verify not run`, read that command; if it is what you expect, rerun with `--run`. Exit 1 = brief unfilled or its verify command failed (or the brief was just created from a session id): fix that, then rerun.
3. Show the user the `--- switch ---` block verbatim (previous vs new model/provider, tokens carried vs saved).
4. Read every file listed under `## Read first` in the brief (mission, curated knowledge) before acting; paths are relative to State's `worktree`/`root`. Working in a different worktree is fine: the check only flags diverged history.
5. Fill Task in the continuation brief and work from the old brief's Next. The Mission is inherited; do not rewrite it.
