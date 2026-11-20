# baton (Claude Code plugin)

Pass work between AI coding agents without re-explaining it and without resending the whole conversation. baton writes a short, git-checked **brief** (mission, decisions, done, next, dead ends, git state) that the next agent, model or session reads before it continues.

## Skills

- `/baton:handover` writes a brief for the current work, so another agent, model or session can pick it up.
- `/baton:takeover` continues from a brief, or from a Claude Code or Codex session by id, name or `last`. It checks the brief against git first.
- `/baton:switch` writes a brief, then tells you how to continue on another model cheaply.

The plugin bundles the `baton` CLI (`cli/`, `src/`), so it needs only Node >= 20 and git. It has no dependencies.

## Data and network

- baton runs only when you, or the agent on your behalf, call it. It installs no hooks.
- It reads local session transcripts (`~/.claude/projects`, `~/.codex/sessions`) and runs `git` in your repo. Transcripts are treated as data and never executed.
- It writes briefs to `.baton/` in your repo, which `baton init` ignores through `.git/info/exclude`.
- API keys, tokens and private keys are redacted before anything is written or sent to a model.
- baton makes no network calls of its own. Only `baton sync` and `takeover --distill` call a model, and they do it through your own `claude` or `codex` CLI, using that CLI's account and settings.

Docs: https://github.com/sriinnu/baton · Licence: MIT (see `LICENSE`).
