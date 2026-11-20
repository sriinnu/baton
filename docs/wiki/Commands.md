# Commands

| Command | Does |
|---|---|
| `init` | create `.baton/` |
| `handover [--name n] [--parent ref]` | new brief (alias of `write`) |
| `takeover [claude\|codex] <ref> [--name n] [--distill]` | show, run the arrival check, start a continuation if clean. `<ref>` may be a session (id, prefix, name, `last`); a session with no brief gets one from the extract, or from one cheap-model pass with `--distill` |
| `gist <ref>` | the brief plus drift since written (alias of `show`) |
| `check <ref> [--no-run]` | arrival check alone |
| `doctor [--limit n]` | run the Claude and Codex readers on your newest real sessions; exit 1 if one comes back empty (transcript format changed) |
| `from <session-id> \| --path f [--agent a]` | brief from a past session (idempotent) |
| `child <ref> --task "…" [--agent-id id]` | brief for a subagent |
| `fold <child>` | fold a finished child into its parent |
| `sync <ref>` | refresh prose from the session's new activity with the cheap model |
| `ls` | lineage tree |

`<ref>` = brief id, name, session id, or id prefix.

Exit codes of `check` / `takeover`: **0** ok, **2** drift (tell the human first), **1** brief unfilled or `verify:` failed.
