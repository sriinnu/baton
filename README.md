# baton

**Pass work between AI coding agents without re-explaining, and without resending 200k tokens.**

Claude, Codex, Antigravity, Kimi, DeepSeek, or anything that can read a file. You switch models, hand a task to a subagent, or come back tomorrow, and the next agent starts from a short, git-verified brief instead of the whole history.

```
Sonnet (200k context)  ──/baton:handover──▶  brief (~150 lines)  ──/baton:takeover──▶  Opus (fresh, ~3k tokens)
```

## Why

- Switching model in place resends the entire conversation to a cold cache. That is the expensive part.
- Auto-compact is lossy, in-session, and tied to one agent.
- Subagents and new sessions re-discover the mission every time.

baton keeps one small markdown **brief** per piece of work. Any agent can read it; no plugin is needed to *read* one.

## Install

```sh
npm i -g @sriinnu/baton      # Node >= 20, zero dependencies
cd your-repo && baton init   # creates .baton/ (gitignored)
```

Then wire up your agent (all optional; the CLI works alone):

| Agent | Setup |
|---|---|
| Any | paste [`rules/AGENTS.snippet.md`](rules/AGENTS.snippet.md) into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` |
| Claude Code | install `plugin/`: skills `/baton:handover`, `/baton:takeover`, `/baton:switch`, plus hooks |
| Codex | copy `codex/*.md` to `~/.codex/prompts/`; in `~/.codex/config.toml` set `notify = ["baton", "sync", "--hook"]` |

## Use

**Leaving** (handing off, context nearly full, changing model):

```sh
baton handover --name auth-fix     # writes the brief; the agent fills the prose
```

**Arriving** (any agent, any model):

```sh
baton takeover auth-fix --name auth-fix-2
```

`takeover` shows the brief, then **checks it against reality before you touch anything**: has git moved, is the working tree what the brief says, does the brief's `verify:` command still pass. Clean → your continuation brief is created (same mission, parent recorded). Drift → exit 2; report to the human first. Even family washes their feet before entering.

**Changing model mid-task** (`/baton:switch`):

```
/baton:switch        # Sonnet writes the brief while its cache is warm
/clear
/model opus
/baton:takeover <name>
```

The new model reads a few thousand tokens instead of the whole conversation. baton cannot intercept `/model` itself; switching in place still resends everything.

**From a past session**, by id or name:

```sh
baton from <session-id>                       # Claude Code or Codex transcript → brief to fill
baton from --path notes.jsonl --agent generic
```

## Orchestrators and subagents

```sh
baton child root --task "write the parser tests" --agent-id <subagent-id>
```

The child gets **Mission (verbatim, root-only) + Lineage (one line per ancestor) + its own Task**, plus the parent's decisions and dead ends. Its brief ends with `## Report back`: fill Done / Decisions / Dead ends before the session ends. The parent runs `baton fold <child>`. Reading a Claude Code session registers its subagents as children automatically; Codex subagents link to their parent through the thread id.

## The brief

```markdown
---
id: 019e032c-…   name: auth-fix   agent: codex   parent: null   mission: 019e032c-…
---
## Mission      one paragraph, set once at the root, copied verbatim down the tree
## Lineage      one line per ancestor
## Task         this brief's own scope
## Decisions    with why: settled, don't relitigate
## Done / Next / Dead ends / Open questions
## Report back  (child briefs) what to fill before finishing
## Check        result of the last arrival check
## State        branch, HEAD, dirty files, verify command: measured from git, never by a model
```

Soft cap 150 lines. Briefs are distillations, never transcripts.

## Always current

Hooks run `baton sync --hook` on Claude Code `Stop`, `PreCompact`, `SubagentStop` (or Codex `notify`). A cheap model refreshes the prose, called through the agent's own CLI, so **no API keys**. Configure in `.baton/config.json`:

```json
{ "runner": "claude", "model": "haiku" }
```

or `{ "runner": "codex", "model": "<mini model>" }`. The model can never change Mission or State (such output is rejected). A failing model never blocks your agent: errors go to `.baton/sync.log` and the hook exits 0. Hooks only act in repos where you ran `baton init`.

## Commands

| | |
|---|---|
| `handover [--name n] [--parent ref]` | leaving: new brief (alias `write`) |
| `takeover <ref> [--name n]` | arriving: show, check, start continuation |
| `gist <ref>` | the distilled brief + drift since written (alias `show`) |
| `check <ref> [--no-run]` | the sanity check alone; exit 0 ok, 2 drift, 1 unfilled / verify failed |
| `from <session-id> \| --path f` | brief from a past session |
| `child <ref> --task "…" [--agent-id id]` | brief for a subagent / new session |
| `fold <child>` | fold a finished child into its parent |
| `sync <ref>` / `sync --hook` | refresh prose with the cheap model |
| `ls` | lineage tree |

`<ref>` is a brief id, a name, or a session id.

## Safety

- Transcripts are untrusted data: never executed. API keys, tokens and private keys are redacted before anything is written or sent to a model.
- The sync model runs with `BATON_SYNC=1` so agent hooks cannot recurse.
- `.baton/` is gitignored by default; commit it deliberately if you want to share briefs.

## Status

v0.1. Session readers: Claude Code (`~/.claude/projects`), Codex (`~/.codex/sessions`), generic `--path`. Another agent is a ~30-line reader in `src/readers/`. Covered by 40 tests against fixture transcripts and a fake model; the live Claude Code plugin, hooks and Codex `notify` wiring are still being exercised.

## Develop

```sh
npm test    # node --test, no dependencies
```

MIT
