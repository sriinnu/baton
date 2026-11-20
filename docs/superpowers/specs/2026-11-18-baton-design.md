# baton: design

Name: `baton` (the relay baton passed between agents).

## Intent

Work moves between agents: GPT-6.2 Astra (Codex) → Opus (Claude Code), or to Antigravity, Kimi, DeepSeek, whatever is next. Today the receiving agent either re-reads everything or gets re-explained by the human. Same waste inside one agent: an orchestrator spawning sessions/subagents makes each re-discover the mission.

baton makes context **distilled, portable, and inherited**:

- Give a session id or name → the next agent reads a brief and continues.
- An orchestrator spawning a child passes a brief, not the history.
- Briefs inherit: every child knows the mission, its lineage, and its own slice.

## Goals

1. One agent-neutral brief format (markdown) any agent can read with no plugin.
2. Create briefs two ways: the outgoing agent writes it (works everywhere via a rules file), or a CLI distills a past session transcript by id/name.
3. Resume by session id or user-given name.
4. Inheritance: child briefs = inherited mission + distilled lineage + own task.
5. Git is ground truth: branch, HEAD, diff stat, dirty files are captured by the tool, not recalled by the model.

## Non-goals

- Storing or replaying raw transcripts. Distill or nothing.
- Running agents, launching sessions, or being an orchestrator. baton feeds orchestrators; it isn't one.
- Syncing across machines/cloud (v1 is local repo + local transcripts).
- A statusline / context-% monitor (marcj has one; out of scope).

## Anti-goals (fails even if it works)

- Briefs that grow into transcripts. If a brief is longer than the work it describes, it failed.
- Claude-only in practice. If any agent needs our plugin to *read* a brief, it failed.
- The brief contradicting git. Recalled state never overrides measured state.
- Dependency sprawl. Per omit: stdlib first.

## The brief

Location: `.baton/briefs/<id>.md` in the repo. Names map to ids in `.baton/index.json` (`{"name": "auth-fix", "id": "...", "agent": "codex", "parent": "...", "updated": "..."}`).

```markdown
---
id: 019e032c-…           # source session id
name: auth-fix           # optional human label
agent: codex/gpt-6.2-astra
parent: <brief id> | null
mission: <brief id of root>
generated: 2026-11-18T10:00Z
source_offset: 1842      # transcript line distilled up to (for incremental refresh)
---
## Mission        (inherited verbatim from root; one paragraph)
## Lineage        (one line per ancestor: id — what it did/decided)
## Task           (this brief's own scope)
## Decisions      (with why; settled, don't relitigate)
## Done
## Next
## Dead ends      (tried, failed, why)
## Open questions
## State          (generated from git, never by the model)
branch, HEAD, `git diff --stat`, dirty/untracked files
```

Soft caps: whole brief ≲ 150 lines; Lineage ≤ 1 line per ancestor.

## Inheritance

- **Mission** is set once at the root and copied verbatim down the tree. Children cannot edit it; only the root can.
- **Lineage** is the distilled chain root → parent: one line each. Deeper ancestors compress further, never expand.
- **Task** is the child's own slice. The parent writes it when delegating.
- Child briefs carry only what is relevant to their task (the parent filters Decisions/Dead ends to the task), plus Mission + Lineage always.
- **Return path:** when a child finishes, it writes its own brief; the parent folds the child's Decisions/Done/Dead ends into its brief as one Lineage-style line plus any decisions that affect siblings.

## Components

1. **Spec + rules snippet** (`AGENTS.md` block, also copyable into `CLAUDE.md`, `GEMINI.md`, etc.): tells any agent how to write a brief on baton, how to read one on baton, and how to brief a child. This is the zero-install path.
2. **CLI `baton`** (Node, stdlib only, single package):
   - `baton write [--name n] [--parent id]`: scaffold brief + fill `State` from git; agent fills the rest.
   - `baton from <session-id|name|path> [--agent codex|claude|…]`: locate transcript, extract, distill to brief.
   - `baton show <id|name>`: print the brief (what the next agent reads).
   - `baton child <parent> --task "…"`: create child brief with inherited Mission + Lineage.
   - `baton ls`: briefs and lineage tree.
3. **Readers**, one per agent, each converting a transcript to a common turn list (`{role, text, tool, files}`):
   - Claude Code: `~/.claude/projects/<project-slug>/<id>.jsonl` (v1)
   - Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl` (v1, confirmed present on this machine)
   - Gemini/Antigravity: `~/.gemini/…` (v2; location to verify)
   - DeepSeek: `~/.deepseek/sessions` (v2; dir exists, empty, format unknown)
   - Kimi: not installed; later.
   - Unknown agent: `--path` to a file + generic reader (plain text/jsonl best effort).
4. **Distillation**: the CLI extracts mechanically (files touched, commands run, errors, last N user turns), then hands that skeleton to the *current* agent to write the prose sections. The CLI does not call an LLM itself.
5. **Agent integrations** (thin): Claude Code plugin (`/baton:pass`, `/baton:resume <id|name>` skills calling the CLI), Codex skill/prompt equivalent. Others use the rules snippet.

## Constraints

- Stdlib only (Node built-ins). No LLM API keys.
- Readers isolated: a broken reader for one agent never breaks another.
- Transcripts are untrusted data: never execute anything from them; strip secrets patterns (`sk-…`, tokens) from extracted text before writing briefs. (load-bearing)
- `.baton/` committed or gitignored is the user's choice; default: gitignored.

## Decided by the user

- Separate plugin, not part of omit.
- Any agent, not just Claude/Codex.
- Resume by session id or name.
- Subagents get a distilled brief with mission + inheritance, not the full history.

## Settled after builder check (mine, flagged)

- **Two-step `from`:** CLI writes a partial brief file (frontmatter + State + mechanical extract under `<!-- fill -->` markers) and prints its path; the running agent fills prose and removes markers. `show` warns if markers remain.
- **Identity:** brief id = source session id when known, else a generated short id. Re-running `from` on the same session overwrites (no incremental refresh in v1; `source_offset` dropped). Names unique; `name` reassigns.
- **Takeover = continuation:** `from` / `/baton` creates a brief with `parent` = the previous brief (if one exists) and the same Mission. No previous brief → new root; the agent drafts Mission from the transcript's first user goal, the user can edit it.
- **Return path:** no command in v1. Rules snippet tells the parent agent to fold the child's brief in by hand.
- **Readers v1:** Claude Code + Codex; skip sidechain/subagent and compaction records, keep user/assistant text, tool names, touched files. Locate by globbing all project/date dirs for the id. Fixtures: one real redacted transcript each.
- **State:** stored at generation; `show` re-measures and prints a drift line if HEAD/dirty files changed. Not a git repo → State says so. `from` uses the session's recorded cwd when present.

## Round 2: user decisions (supersede the above where they conflict)

- *(Superseded 2026-11-20: no hooks. baton runs only when called; see docs/wiki/Sync-and-Distill.md.)* **Brief is always up to date.** A cheap model refreshes it incrementally (`source_offset` restored): triggered by agent hooks (Claude Code `Stop`/`PreCompact`/`SubagentStop`; Codex `notify`) or `gist sync`. The CLI calls the cheap model through the agent's own CLI (`claude -p --model haiku`, `codex exec -m <mini>`), so still no API keys. Model configurable.
- **Report back is explicit.** Every child brief ends with a `## Report back` instruction: write your return brief before the session ends. Enforced by `SubagentStop` hook where the agent has one; the rules snippet covers the rest.
- **Orchestrator knows its children.** Children are registered in `index.json` with their agent's subagent/session id (Claude Code subagent transcripts carry agent ids; Codex's equivalent to verify), so the parent can `gist show <child>` and the fold-in can be automatic.
- **Takeover = continuation, always, after a sanity check ("wash your feet before entering").** Before continuing, the arriving agent, whoever it is, must: re-measure git vs the brief's State, run the brief's verification command, confirm Next steps still make sense, and write a one-line check result into the brief. Drift is reported to the user before work resumes.
- **Name:** `gist` or `baton`, repo `sriinnu/<name>` (both free on GitHub; both taken on npm → publish scoped `@sriinnu/<name>`).

## Builder's calls (mine, flagged)

- Node CLI, markdown briefs, `.baton/` dir, frontmatter fields above.
- No built-in LLM call; distillation prose is written by whichever agent is running.
- v1 readers: Claude Code + Codex only.
- Default gitignored `.baton/`.
