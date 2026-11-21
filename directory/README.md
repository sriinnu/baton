# agent-baton

Pass work between AI coding agents without re-explaining it and without resending the whole conversation. baton writes a short, git-checked **brief** (mission, decisions, done, next, dead ends, git state). The next agent, model or session reads it before it continues.

## Skills

- `/agent-baton:handover` writes a brief for the current work, so another agent, model or session can pick it up.
- `/agent-baton:takeover` continues from a brief, or from a Claude Code or Codex session by id, name or `last`. It checks the brief against git first.
- `/agent-baton:switch` writes a brief, then tells you how to continue on another model cheaply.

## Requires the baton CLI

These skills run the `baton` command. Install the [`@sriinnu/baton`](https://www.npmjs.com/package/@sriinnu/baton) package globally with npm (Node >= 20, git). If it is missing, the skills tell you so and stop.

## Data and network

- baton runs only when you, or the agent on your behalf, call it. This plugin has no hooks, scripts or MCP servers.
- The CLI reads local session transcripts (`~/.claude/projects`, `~/.codex/sessions`) and runs `git` in your repo. Transcripts are treated as data and never executed.
- It writes briefs to `.baton/` in your repo, which `baton init` ignores through `.git/info/exclude`.
- API keys, tokens and private keys are redacted before anything is written or sent to a model.
- The CLI makes no network calls of its own. Only `baton sync` and `takeover --distill` call a model, through your own `claude` or `codex` CLI and that CLI's account.

Privacy policy: https://github.com/sriinnu/baton/blob/master/PRIVACY.md

Source, docs and issues: https://github.com/sriinnu/baton · Licence: MIT (see `LICENSE`).
