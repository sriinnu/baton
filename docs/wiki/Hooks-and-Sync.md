# Hooks and sync

Claude Code `Stop`, `PreCompact`, `SubagentStop` run `baton sync --hook`. Codex uses `notify`.

Sync asks a cheap model, through the agent's own CLI (`claude -p --model haiku` or `codex exec -m`; no API keys), to refresh Task/Decisions/Done/Next/Dead ends/Open questions.

- Mission changes are rejected; State is re-measured from git.
- `BATON_SYNC=1` stops hooks from recursing.
- A per-brief lock prevents concurrent syncs.
- Hook mode always exits 0; errors go to `.baton/sync.log`.
- A brief written without `--id` is adopted by the next hook session, so continuations get synced.

Config `.baton/config.json`: `{ "runner": "claude", "model": "haiku" }`. `BATON_RUNNER` overrides the runner.
