---
name: switch
description: Switch to another model (or agent) without resending the whole conversation. Writes a baton brief first, then tells the user how to continue cheaply. Use when the user wants to change model mid-task, e.g. Sonnet to Opus.
---

`baton` below is the baton CLI from npm. If `command -v baton` finds nothing, stop and tell the user to install the `@sriinnu/baton` package globally with npm (Node >= 20; see https://www.npmjs.com/package/@sriinnu/baton), then retry.

Switching models in place resends the entire history to the new model with a cold cache. Avoid that:

1. Do the `handover` steps now, while this model's cache is warm: `baton handover --name <name> --model <your exact model id>`, fill every `<!-- fill -->`, add `verify: <cmd>` under `dirty:` in State. Include exact outputs the next model will need (failing test text, error messages) under Done or Dead ends, since it will not see this conversation.
2. `baton check <name>`. It must exit 0 (exit 1 = still unfilled; fix and rerun).
3. Tell the user, verbatim, the steps (you cannot run them yourself):
   - CLI: `/clear`, then `/model <target model>`, then `/agent-baton:takeover <name>`
   - Desktop app: start a **new task** with the target model selected, then `/agent-baton:takeover <name>`. Do not use the model picker on this task: it re-reads the whole history, which defeats the switch.
   - Codex: start a **new session** with the target model, then ask it to take over `<name>` (the `baton:takeover` skill).
