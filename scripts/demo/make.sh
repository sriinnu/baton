#!/bin/sh
# Rebuilds assets/demo.gif: a real `baton takeover` from a Claude Code session to Codex.
# Needs vhs (brew install vhs). It runs this checkout's CLI, not an installed baton. Everything runs in /private/tmp/baton-demo
# with a fake HOME, so your own ~/.claude is never read. The session is synthetic
# (its token usage is illustrative), which the GIF says on screen.
set -eu
REPO=$(cd "$(dirname "$0")/../.." && pwd)
D=/private/tmp/baton-demo S=c0ffee00-1234-4abc-8def-000000000042
rm -rf "$D" && mkdir -p "$D/shop/src" "$D/bin" && cd "$D/shop"
ln -s "$REPO/plugin/cli/baton.js" "$D/bin/baton" && export PATH="$D/bin:$PATH"
git init -q -b main && git config user.name demo && git config user.email demo@example.com && git config commit.gpgsign false
printf 'export function isExpired(token, now = new Date()) {\n  return token.expiresAt < now.getTime();\n}\n' > src/auth.js
printf '{ "name": "shop", "type": "module", "scripts": { "test": "node --test" } }\n' > package.json
git add -A && git -c core.hooksPath=/dev/null commit -q -m "auth: token expiry"
printf 'export function isExpired(token, now = new Date()) {\n  // compare in UTC: expiresAt is a UTC timestamp\n  return token.expiresAt < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes());\n}\n' > src/auth.js
P="$D/home/.claude/projects/-private-tmp-baton-demo-shop" && mkdir -p "$P"
python3 "$REPO/scripts/demo/session.py" "$P/$S.jsonl" "$D/shop" "$S"
export HOME="$D/home"
# The brief the taking-over agent would write: start it for real, then fill it the way an agent does.
baton init >/dev/null && baton takeover claude last >/dev/null 2>&1 || true
python3 "$REPO/scripts/demo/fill.py" ".baton/briefs/$S.md" "$D/filled-brief.md"
cat > "$D/reset.sh" <<'R'
#!/bin/sh
cd /private/tmp/baton-demo/shop && rm -rf .baton && sed -i '' '/^\.baton\/$/d' .git/info/exclude && HOME=/private/tmp/baton-demo/home /private/tmp/baton-demo/bin/baton init >/dev/null
R
chmod +x "$D/reset.sh"
cd "$D" && vhs "$REPO/scripts/demo/demo.tape" && cp "$D/demo.gif" "$REPO/assets/demo.gif"
echo "assets/demo.gif ($(wc -c < "$REPO/assets/demo.gif") bytes)"
