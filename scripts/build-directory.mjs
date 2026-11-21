#!/usr/bin/env node
// Builds directory/, the skills-only "agent-baton" plugin for Anthropic's plugin directory.
//
// Why a second plugin: the directory accepts scripts only from Verified organizations, and
// plugin/ bundles the CLI (JavaScript). This folder holds only Markdown, JSON, a licence and a
// PNG icon. Its skills call the `baton` CLI from npm instead of the bundled one. The name
// differs because "baton" is taken in the directory.
//
// directory/ is generated, never edited by hand: test/directory.test.js fails when it drifts
// from plugin/ (run `npm run build:directory` to regenerate).
//   node scripts/build-directory.mjs          write directory/
//   import { expected } from here             what directory/ should contain (for the test)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
export const NAME = 'agent-baton';
export const DIR = 'directory';
const SKILLS = ['handover', 'takeover', 'switch'];
const NPM = 'https://www.npmjs.com/package/@sriinnu/baton';
export const PRIVACY = 'https://github.com/sriinnu/baton/blob/master/PRIVACY.md'; // the directory's privacy-policy field

// The bundled-CLI sentence in each skill, swapped for the npm CLI.
const BUNDLED = /^`baton` below means `node "\$\{CLAUDE_PLUGIN_ROOT\}\/cli\/baton\.js"`.*$/m;
const FROM_NPM = `\`baton\` below is the baton CLI from npm. If \`command -v baton\` finds nothing, stop and tell the user to install the \`@sriinnu/baton\` package globally with npm (Node >= 20; see ${NPM}), then retry.`;

function skill(s) {
  const src = rd(`plugin/skills/${s}/SKILL.md`);
  if (!BUNDLED.test(src)) throw new Error(`plugin/skills/${s}/SKILL.md: bundled-CLI line not found; update build-directory.mjs`);
  return src.replace(BUNDLED, FROM_NPM).replaceAll('/baton:', `/${NAME}:`);
}

function manifest() {
  const p = JSON.parse(rd('plugin/.claude-plugin/plugin.json'));
  return JSON.stringify({
    name: NAME,
    version: p.version,
    description: 'Pass work between AI coding agents through short, git-checked handover briefs. Skills for the baton CLI (npm @sriinnu/baton, Node 20+).',
    author: p.author, homepage: p.homepage, repository: p.repository, license: p.license, keywords: p.keywords,
    privacyPolicyUrl: PRIVACY,
  }, null, 2) + '\n';
}

const README = `# agent-baton

Pass work between AI coding agents without re-explaining it and without resending the whole conversation. baton writes a short, git-checked **brief** (mission, decisions, done, next, dead ends, git state). The next agent, model or session reads it before it continues.

## Skills

- \`/${NAME}:handover\` writes a brief for the current work, so another agent, model or session can pick it up.
- \`/${NAME}:takeover\` continues from a brief, or from a Claude Code or Codex session by id, name or \`last\`. It checks the brief against git first.
- \`/${NAME}:switch\` writes a brief, then tells you how to continue on another model cheaply.

## Requires the baton CLI

These skills run the \`baton\` command. Install the [\`@sriinnu/baton\`](${NPM}) package globally with npm (Node >= 20, git). If it is missing, the skills tell you so and stop.

## Data and network

- baton runs only when you, or the agent on your behalf, call it. This plugin has no hooks, scripts or MCP servers.
- The CLI reads local session transcripts (\`~/.claude/projects\`, \`~/.codex/sessions\`) and runs \`git\` in your repo. Transcripts are treated as data and never executed.
- It writes briefs to \`.baton/\` in your repo, which \`baton init\` ignores through \`.git/info/exclude\`.
- API keys, tokens and private keys are redacted before anything is written or sent to a model.
- The CLI makes no network calls of its own. Only \`baton sync\` and \`takeover --distill\` call a model, through your own \`claude\` or \`codex\` CLI and that CLI's account.

Privacy policy: ${PRIVACY}

Source, docs and issues: https://github.com/sriinnu/baton · Licence: MIT (see \`LICENSE\`).
`;

// Path → contents (string, or Buffer for the icon). The icon is rendered once from assets/logo.svg
// and committed as assets/icon-1024.png, so this build needs no image tools.
export function expected() {
  const files = {
    '.claude-plugin/plugin.json': manifest(),
    '.claude-plugin/icon.png': fs.readFileSync(path.join(root, 'assets/icon-1024.png')),
    'README.md': README,
    'LICENSE': rd('LICENSE'),
  };
  for (const s of SKILLS) files[`skills/${s}/SKILL.md`] = skill(s);
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = path.join(root, DIR);
  fs.rmSync(out, { recursive: true, force: true });
  for (const [p, c] of Object.entries(expected())) {
    fs.mkdirSync(path.dirname(path.join(out, p)), { recursive: true });
    fs.writeFileSync(path.join(out, p), c);
  }
  console.log(`${DIR}/ (${NAME}): ${Object.keys(expected()).length} files`);
}
