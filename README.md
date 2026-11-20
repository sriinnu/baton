<p align="center"><img src="assets/logo.svg" width="120" alt="baton logo"></p>

<h1 align="center">baton</h1>

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

## How to use it

| | **CLI (terminal)** | **Desktop app** (Claude Code tab / uploaded plugin) |
|---|---|---|
| Install | `npm i -g @sriinnu/baton`, then `claude plugin marketplace add` + `claude plugin install` (see [Install](#install)) | Upload `dist/baton-plugin.zip` (Settings, Customize, Plugins). Nothing else to install: Node 20+ only |
| Leave | `/baton:handover` or `/baton:switch` | same |
| Switch model | `/clear`, then `/model <target>`, then `/baton:takeover <name>` | Start a **new task** with the target model selected, then `/baton:takeover <name>` |
| Don't | | Use the model picker on the same task: it re-reads the whole history |

Handing off to another agent (for example Codex) works the same way: write the brief with `baton handover`, then run `baton takeover <name>` in the other agent.

## Install

Needs **Node >= 20** and **git**. No dependencies. Reading archived Codex threads needs Node >= 22.15.

**Only using the Claude plugin?** It bundles the CLI, so you need just Node >= 20 and can skip step 1. Step 1 is for running `baton` in a terminal or with Codex.

### 1. CLI (required)

```sh
npm i -g @sriinnu/baton
```

The Claude plugin and the Codex skills below install from a clone, so clone too if you want them:

```sh
git clone https://github.com/sriinnu/baton.git ~/code/baton         # Windows: "$HOME\code\baton"
```

Hacking on baton itself? Run `npm link` in the clone instead of the npm install, so `baton` runs your checkout.

Open a **new** terminal, then check: `baton --help` prints the command list. If it is not found, add npm's global bin to PATH (`npm prefix -g`; on Windows that is `%APPDATA%\npm`) and restart the terminal.

Then, once per repo:

```sh
cd your-repo && baton init      # creates .baton/ (ignored via .git/info/exclude)
```

### 2. Claude Code (CLI, and the Code tab in Claude Desktop)

```sh
claude plugin marketplace add ~/code/baton      # Windows: "$HOME\code\baton"
claude plugin install baton@sriinnu-baton
claude plugin list                              # baton@sriinnu-baton should show "enabled"
```

Or upload it in claude.ai (Settings, Customize, Plugins): run `npm run pack:plugin`, then upload `dist/baton-plugin.zip`.

Restart Claude Code / Claude Desktop. You get `/baton:handover`, `/baton:takeover` and `/baton:switch`. The plugin installs no hooks: baton runs only when you, or the agent on your behalf, call it.

- The CLI and the Desktop **Code** tab share `~/.claude` (`%USERPROFILE%\.claude` on Windows), so one install covers both. Desktop's chat/Cowork mode does not load these plugins.
- WSL has its own `~/.claude`: install again inside WSL if you use Claude there.

### 3. Codex (CLI and Codex app; both use `~/.codex`)

Skills (current Codex):

```sh
for s in handover takeover switch; do
  mkdir -p ~/.codex/skills/baton-$s
  sed "s/^name: $s/name: baton-$s/" ~/code/baton/plugin/skills/$s/SKILL.md > ~/.codex/skills/baton-$s/SKILL.md
done
```

```powershell
foreach ($s in 'handover','takeover','switch') {
  $d = "$HOME\.codex\skills\baton-$s"; New-Item -ItemType Directory -Force $d | Out-Null
  (Get-Content "$HOME\code\baton\plugin\skills\$s\SKILL.md" -Raw) -replace "name: $s", "name: baton-$s" | Set-Content "$d\SKILL.md"
}
```

Older Codex (custom prompts): copy `codex/*.md` into `~/.codex/prompts/` (create the folder first).

Restart Codex. No `notify` line is needed (baton ≤ 0.1 used one; if you still have `notify = ["baton", "sync", "--hook"]`, remove it: it now does nothing).

### 4. Any other agent

Paste [`rules/AGENTS.snippet.md`](rules/AGENTS.snippet.md) into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`. Reading a brief needs no plugin.

### Update / uninstall

```sh
npm i -g @sriinnu/baton@latest     # the CLI
cd ~/code/baton && git pull        # the plugin and skills; then rerun the Codex skills loop above
```

In Claude Code run `claude plugin marketplace update sriinnu-baton`, then `/reload-plugins` (or restart). Uninstall: `claude plugin uninstall baton@sriinnu-baton`, `npm uninstall -g @sriinnu/baton` and delete `~/.codex/skills/baton-*`.

Note: Windows works but has had less testing.

## Use

**Leaving** (handing off, context nearly full, changing model):

```sh
baton handover --name auth-fix     # writes the brief; the agent fills the prose
```

**Arriving** (any agent, any model):

```sh
baton takeover auth-fix --name auth-fix-2
```

**Picking up a session nobody handed over** (the old agent is gone, or ran out of context):

```sh
baton takeover codex "Guardian review"     # a Codex thread by name (exact first, newest wins)
baton takeover claude 7e8a8b31             # a Claude Code session by id or id prefix
baton takeover claude last                 # the newest Claude session in this repo
baton takeover codex last --distill        # …and have the cheap model write the brief once
```

Names are Codex thread names and Claude Code session titles; a partial name that matches several sessions lists them. Archived Codex threads (`~/.codex/archived_sessions`, zstd) are found too (Node ≥ 22.15). Without `--distill` you get the free mechanical extract to fill; with it, one cheap-model pass reads the whole session (a long one in parts, one call per ~60k chars, about seven at most).

`takeover` shows the brief, then **checks it against reality before you touch anything**: has git moved, is the working tree what the brief says, does the brief's `verify:` command still pass (shown, and run only with `--run`). Clean → your continuation brief is created (same mission, parent recorded). Drift → exit 2; report to the human first. Even family washes their feet before entering.

Both `gist` and `takeover` end with a measured token line, for example:

```
tokens: session context ≈ 74.0k · cache reads (all turns) 29.6M · writes 722.8k | brief ≈ 3.0k → a fresh session starts ~25x smaller
```

On takeover you also get a `--- switch ---` block: who handed over to whom, and what the switch saved.

```
--- switch ---
from: Anthropic · claude-opus-5-5 (claude)
to:   OpenAI · gpt-5-codex (codex)
context: old session ≈ 180k → brief ≈ 1.3k; ~179k not re-sent cold (est.)
cache: old session read 2.1M, wrote 300k; caches do not carry to a new model, so it starts empty
```

The previous model comes from the brief (or the old transcript); the new one is the `--model` the taking-over agent passes. Token counts come from the old transcript; the brief size is chars ÷ 4 and "not re-sent cold" is an estimate.

**Changing model mid-task** (`/baton:switch`):

```
/baton:switch        # Sonnet writes the brief while its cache is warm
/clear
/model opus
/baton:takeover <name>
```

The new model reads a few thousand tokens instead of the whole conversation. baton cannot intercept `/model` itself; switching in place still resends everything. In the **desktop app**, do not use the model picker on the same task (it warns that the full history gets re-read): start a **new task** with the target model selected, then run `/baton:takeover <name>`.

**From a past session**, by id (for names and `last`, use `takeover` above):

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
## State        branch, worktree, HEAD, dirty files, verify command, the uncommitted diff (bounded): measured from git, never by a model
```

Soft cap 150 lines. Briefs are distillations, never transcripts.

## Only when asked

baton never runs on a turn. The agent that did the work writes the brief at handover, while its cache is warm: that is the cheapest and best brief there is. A model is only called when you ask:

- `baton takeover … --distill`: once, for a session that ended without a handover.
- `baton sync <ref>`: refresh a brief from the new activity in its session since the last sync. A brief written with `handover` inside Claude Code or Codex is bound to that session (`CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`), so `sync` knows where to read.

The model is called through the agent's own CLI, so **no API keys**. Configure in `.baton/config.json`:

```json
{ "runner": "claude", "model": "haiku" }
```

or `{ "runner": "codex", "model": "<mini model>" }`. The model can never change Mission or State (its edits to them are ignored, State is re-measured from git), and a failing model leaves the brief as it was.

## Commands

| | |
|---|---|
| `handover [--name n] [--parent ref]` | leaving: new brief (alias `write`) |
| `takeover [claude\|codex] <ref> [--name n] [--distill]` | arriving: show, check, start continuation. `<ref>` may also be a session id, id prefix, name or `last` |
| `gist <ref>` | the distilled brief + drift since written (alias `show`) |
| `check <ref> [--run]` | the sanity check alone; exit 0 ok, 2 drift, 1 unfilled / verify failed. `verify:` runs only with `--run` (a brief can come from anywhere) |
| `from <session-id> \| --path f` | brief from a past session |
| `child <ref> --task "…" [--agent-id id]` | brief for a subagent / new session |
| `fold <child>` | fold a finished child into its parent |
| `sync <ref>` | refresh prose from the session's new activity with the cheap model |
| `doctor [--limit n]` | run the readers on your newest real sessions; exit 1 if one comes back empty |
| `ls` | lineage tree |

`<ref>` is a brief id or name, or a session id. `takeover` also accepts a session id prefix, a session name, or `last`.

## Worktrees

All worktrees of a repo share the main checkout's `.baton/` (a fresh worktree has none of its own). `takeover` in a new worktree on a new branch is fine: the check only flags history that diverged from the brief's HEAD. The brief's `## Read first` lists mission/knowledge files (`MISSION.md`, `docs/knowledge.md`, plus `readFirst` paths from `.baton/config.json`) for the next agent to read before acting. Cache reads and writes in the `tokens:` line come from the transcript; Codex reports no cache writes, and cache misses are not recorded, so none are claimed.

## Safety

- Transcripts are untrusted data: never executed. API keys, tokens and private keys are redacted before anything is written or sent to a model.
- The model call runs with `BATON_SYNC=1`, so your own agent hooks can recognise and skip it.
- `.baton/` is ignored through `.git/info/exclude`, so `init` never edits your tracked `.gitignore`. To share briefs, commit them deliberately (`git add -f .baton/`).

## Status

v0.2.0 on npm (`@sriinnu/baton`). Session readers: Claude Code (`~/.claude/projects`), Codex (`~/.codex/sessions`), generic `--path`. Another agent is a ~30-line reader in `plugin/src/readers/`. Covered by 60 tests against fixture transcripts and a fake model, plus `baton doctor` against real sessions. Live-tested: Claude Code ↔ Codex handover and takeover, and `--distill` with `claude -p --model haiku` on a real 2 MB Codex session; `codex exec` as the runner has not been exercised yet.

## Playground

Open `playground/index.html` in a browser (no install, nothing uploaded). Docs: `docs/wiki/`.

## Develop

```sh
npm test    # node --test, no dependencies
```

MIT
