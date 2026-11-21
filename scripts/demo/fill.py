"""Fills a started brief the way the taking-over agent would (from its Extract), then drops Extract."""
import re, sys
src, out = sys.argv[1:]
s = open(src).read()
fill = {'Mission': 'Fix logout-after-password-reset without breaking SSO.',
        'Task': 'Make token expiry compare in UTC; get the auth tests green.',
        'Decisions': '- Compare in UTC: expiresAt is a UTC timestamp.\n- Leave the SSO path untouched.',
        'Done': '- src/auth.js: isExpired() now compares in UTC (uncommitted).',
        'Next': '- 2 tests fail: test/auth.test.js hard-codes a local date. Make them UTC.\n- Then run the SSO suite and commit.',
        'Dead ends': '- none'}
for k, v in fill.items():
    s = re.sub(r'(## %s\n)<!-- fill -->.*' % re.escape(k), lambda m: m.group(1) + v, s)
open(out, 'w').write(s.split('\n## Extract')[0] + '\n')
