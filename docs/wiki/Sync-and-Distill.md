# Sync and distill

baton runs only when called. No hooks, no `notify`, nothing per turn: even a cheap model on every turn is cost and noise for a brief nobody reads until handover.

- **Handover** (the agent is alive): the agent writes the brief itself from its warm cache. No extra model.
- **Takeover of a session nobody handed over**: `baton takeover [claude|codex] <id|prefix|name|last>` starts a brief from the mechanical extract (free). Add `--distill` and a cheap model reads the whole session once and fills it. A long session is read in parts (about 60k chars each, about seven calls at most); past the budget, the first goal and the most recent activity are kept.
- **`baton sync <ref>`**: refresh a brief from what happened in its session since the last sync. A handover written inside Claude Code or Codex is bound to that session through `CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`.

The model is called through the agent's own CLI (`claude -p --model haiku` or `codex exec -m`; no API keys) and may update Task, Decisions, Done, Next, Dead ends, Open questions.

- Mission changes are rejected (a placeholder Mission may be written once); State is re-measured from git.
- A per-brief lock prevents concurrent syncs.
- A failing model leaves the brief as it was; the command exits 1.
- `sync --hook` (baton ≤ 0.1) is kept as a silent no-op so an old hook or `notify` line never breaks an agent. Remove it.

Config `.baton/config.json`: `{ "runner": "claude", "model": "haiku" }`. `BATON_RUNNER` overrides the runner.
