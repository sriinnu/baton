---
name: switch
description: Switch to another model (or agent) without resending the whole conversation. Writes a baton brief first, then tells the user how to continue cheaply. Use when the user wants to change model mid-task, e.g. Sonnet to Opus.
---

Switching models in place resends the entire history to the new model with a cold cache. Avoid that:

1. Do the `handover` steps now, while this model's cache is warm: `baton handover --name <name>`, fill every `<!-- fill -->`, add `verify: <cmd>` under `dirty:` in State. Include exact outputs the next model will need (failing test text, error messages) under Done or Dead ends, since it will not see this conversation.
2. `baton check <name> --no-run`. It must exit 0 (exit 1 = still unfilled; fix and rerun).
3. Tell the user, verbatim, the three steps (you cannot run them yourself):
   - `/clear`
   - `/model <target model>`
   - `/baton:takeover <name>`
