# Inheritance

`baton child <parent> --task "…"` gives a subagent:

1. **Mission** copied verbatim from the root.
2. **Lineage**: one line per ancestor.
3. **Task**: its own scope.
4. The parent's **Decisions** and **Dead ends**.
5. **Report back**: fill Done / Decisions / Dead ends before the session ends.

The parent runs `baton fold <child>` (or merges by hand). `--agent-id` records the subagent's session id so the orchestrator knows who is who. Reading a Claude Code session registers its `subagents/` transcripts as children; Codex links via `parent_thread_id`.
