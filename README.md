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

Needs Node >= 20 and git. No dependencies. Not on npm yet (the package `@sriinnu/baton` is unpublished), so clone and link:

```sh
git clone git@github.com:sriinnu/baton.git ~/code/baton
cd ~/code/baton && npm link          # puts `baton` on PATH (same in PowerShell)
cd your-repo && baton init           # once per repo: creates .baton/ (gitignored)
```

Then wire up your agent (all optional; the CLI works alone):

| Agent | Setup |
|---|---|
| Any | paste [`rules/AGENTS.snippet.md`](rules/AGENTS.snippet.md) into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` |
| Claude Code (CLI and Desktop) | `claude plugin marketplace add ~/code/baton` then `claude plugin install baton@sriinnu-baton`. Gives skills `/baton:handover`, `/baton:takeover`, `/baton:switch` and hooks. Restart the app. After `git pull`, run `/reload-plugins` |
| Codex | copy `codex/*.md` to `~/.codex/prompts/`; in `~/.codex/config.toml` set `notify = ["baton", "sync", "--hook"]` |

Notes:

- macOS and Linux: the Claude CLI and the Desktop app share `~/.claude`, so one plugin install covers both. On Windows, Desktop has its own config (`%USERPROFILE%\.claude`): run the two `claude plugin` commands with Desktop's `claude.exe`. WSL has its own `~/.claude` again.
- Hooks do nothing unless `baton` is on PATH and the repo has `.baton/`.
- Windows is untested end to end.

## Use

**Leaving** (handing off, context nearly full, changing model):

```sh
baton handover --name auth-fix     # writes the brief; the agent fills the prose
```

**Arriving** (any agent, any model):

```sh
baton takeover auth-fix --name auth-fix-2
```

`takeover` shows the brief, then **checks it against reality before you touch anything**: has git moved, is the working tree what the brief says, does the brief's `verify:` command still pass (shown, and run only with `--run`). Clean → your continuation brief is created (same mission, parent recorded). Drift → exit 2; report to the human first. Even family washes their feet before entering.

Both `gist` and `takeover` end with a measured token line, for example:

```
tokens: session context ≈ 74.0k · cache reads (all turns) 29.6M · writes 722.8k | brief ≈ 3.0k → a fresh session starts ~25x smaller
```

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
## Read first   mission / knowledge files for the next agent to read before acting
## Lineage      one line per ancestor
## Task         this brief's own scope
## Decisions    with why: settled, don't relitigate
## Done / Next / Dead ends / Open questions
## Report back  (child briefs) what to fill before finishing
## Check        result of the last arrival check
## State        branch, worktree, HEAD, dirty files, verify command: measured from git, never by a model
```

Soft cap 150 lines. Briefs are distillations, never transcripts.

## Always current

Hooks run `baton sync --hook` on Claude Code `Stop`, `PreCompact`, `SubagentStop` (or Codex `notify`). A cheap model refreshes the prose, called through the agent's own CLI, so **no API keys**. Configure in `.baton/config.json`:

```json
{ "runner": "claude", "model": "haiku" }
```

or `{ "runner": "codex", "model": "<mini model>" }`. The model can never change Mission or State (its edits to them are ignored). Sync runs in the background, so your agent never waits on it, and a failing model never blocks anything: errors go to `.baton/sync.log` and the hook exits 0. Hooks only act in repos where you ran `baton init`.

**Cost:** each sync is one small model call (Haiku by default), made when a turn ends. To stop it, remove the hooks (disable the plugin's hooks, or unset `notify` for Codex) and refresh by hand with `baton sync <ref>`.

## Commands

| | |
|---|---|
| `handover [--name n] [--parent ref]` | leaving: new brief (alias `write`) |
| `takeover <ref> [--name n]` | arriving: show, check, start continuation |
| `gist <ref>` | the distilled brief + drift since written (alias `show`) |
| `check <ref> [--run]` | the sanity check alone; exit 0 ok, 2 drift, 1 unfilled / verify failed. `verify:` runs only with `--run` (a brief can come from anywhere) |
| `from <session-id> \| --path f` | brief from a past session |
| `child <ref> --task "…" [--agent-id id]` | brief for a subagent / new session |
| `fold <child>` | fold a finished child into its parent |
| `sync <ref>` / `sync --hook` | refresh prose with the cheap model |
| `ls` | lineage tree |

`<ref>` is a brief id, a name, or a session id.

## Worktrees

All worktrees of a repo share the main checkout's `.baton/` (a fresh worktree has none of its own). `takeover` in a new worktree on a new branch is fine: the check only flags history that diverged from the brief's HEAD. The brief's `## Read first` lists mission/knowledge files (`MISSION.md`, `docs/knowledge.md`, plus `readFirst` paths from `.baton/config.json`) for the next agent to read before acting. Cache reads and writes in the `tokens:` line come from the transcript; Codex reports no cache writes, and cache misses are not recorded, so none are claimed.

## Safety

- Transcripts are untrusted data: never executed. API keys, tokens and private keys are redacted before anything is written or sent to a model.
- The sync model runs with `BATON_SYNC=1` so agent hooks cannot recurse.
- `.baton/` is gitignored by default; commit it deliberately if you want to share briefs.

## Status

v0.1, private. Session readers: Claude Code (`~/.claude/projects`), Codex (`~/.codex/sessions`), generic `--path`. Another agent is a ~30-line reader in `src/readers/`. Covered by 47 tests against fixture transcripts and a fake model; the live Claude Code plugin, hooks and Codex `notify` wiring are still being exercised, and nothing has run against a real `claude -p` or `codex exec` yet.

## Playground

Open `playground/index.html` in a browser (no install, nothing uploaded). Docs: `docs/wiki/`.

## Develop

```sh
npm test    # node --test, no dependencies
```

MIT
