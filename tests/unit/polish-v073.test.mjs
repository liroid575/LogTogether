import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

test('stale cloud hiking badges are pruned instead of remaining visible to family', () => {
  assert.match(main, /pruneStaleCloudHikeBadges/);
  assert.match(main, /badge\.badgeType === "hike" && !desiredCloudIds\.has\(badge\.id\)/);
  assert.match(main, /await deleteCloudBadge\(user, membership, badgeId\)/);
  assert.match(main, /this\.cloudOwnBadges = snapshot\.ownBadges/);
});

test('completed water month uses the same faded fill treatment as history gold month', () => {
  assert.match(css, /\.water-calendar\.perfect-water-month[\s\S]*background:\s*linear-gradient/);
  assert.match(css, /#42a5f5 10%/);
});
