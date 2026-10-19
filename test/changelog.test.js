'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { updateChangelog } = require('../scripts/update/changelog');

const OLD_SHA = 'f443e49af2f9c9dce8ea515ae53090a18fb476547466b6cd804051424eaf72c6';
const NEW_SHA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function metadata({ editie, sha256, modifiedAt, toate, judete, uat, localitati }) {
  return {
    editie,
    sursa: { sha256, modified_at: modifiedAt },
    totaluri: { toate, judete, uat, localitati },
  };
}

const before = metadata({
  editie: 'SIRUTA_s1 2026',
  sha256: OLD_SHA,
  modifiedAt: '2026-08-11T11:42:48.571937',
  toate: 16978,
  judete: 42,
  uat: 3187,
  localitati: 13749,
});
const after = metadata({
  editie: 'SIRUTA_s1 2027',
  sha256: NEW_SHA,
  modifiedAt: '2027-02-03T09:10:11.000001',
  toate: 16980,
  judete: 42,
  uat: 3185,
  localitati: 13753,
});

function tempChangelog(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siruta-changelog-'));
  const file = path.join(dir, 'CHANGELOG.md');
  fs.writeFileSync(file, body);
  return file;
}

const SEED = '# Changelog\n\n## 2026-08-11 — SIRUTA_s1 2026\n\nPrima captură.\n';

test('inserts one entry with edition, checksum prefixes and total deltas', () => {
  const file = tempChangelog(SEED);
  assert.equal(updateChangelog(file, before, after), true);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(
    text,
    [
      '# Changelog',
      '',
      '## 2027-02-03 — SIRUTA_s1 2027',
      '',
      `- **Ediție:** \`SIRUTA_s1 2027\``,
      '- **Modificat în sursă (`modified_at`):** `2027-02-03T09:10:11.000001`',
      '- **SHA-256 anterior:** `f443e49af2f9…`',
      '- **SHA-256 nou:** `0123456789ab…`',
      `- **SHA-256 sursă (complet):** \`${NEW_SHA}\``,
      '- **Variație totaluri:** total `+2` (`16978` → `16980`), județe `0` (`42` → `42`), UAT `-2` (`3187` → `3185`), localități `+4` (`13749` → `13753`)',
      '',
      '## 2026-08-11 — SIRUTA_s1 2026',
      '',
      'Prima captură.',
      '',
    ].join('\n'),
  );
});

test('is idempotent when run twice for the same source SHA', () => {
  const file = tempChangelog(SEED);
  assert.equal(updateChangelog(file, before, after), true);
  const once = fs.readFileSync(file, 'utf8');
  assert.equal(updateChangelog(file, before, after), false);
  assert.equal(fs.readFileSync(file, 'utf8'), once);
  assert.equal(once.split(NEW_SHA).length - 1, 1);
});

test('does nothing when the new SHA is already recorded by an existing entry', () => {
  const file = tempChangelog(`${SEED}\n- sha \`${NEW_SHA}\`\n`);
  const original = fs.readFileSync(file, 'utf8');
  assert.equal(updateChangelog(file, before, after), false);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('is deterministic: the date comes from modified_at, not the wall clock', () => {
  const a = tempChangelog(SEED);
  const b = tempChangelog(SEED);
  updateChangelog(a, before, after);
  updateChangelog(b, before, after);
  assert.equal(fs.readFileSync(a, 'utf8'), fs.readFileSync(b, 'utf8'));
  assert.match(fs.readFileSync(a, 'utf8'), /^# Changelog\n\n## 2027-02-03 — /);
});

test('rejects a changelog without the # Changelog heading', () => {
  const file = tempChangelog('no heading\n');
  assert.throws(() => updateChangelog(file, before, after), /# Changelog/);
});

test('rejects metadata without a valid source SHA-256', () => {
  const file = tempChangelog(SEED);
  const bad = { ...after, sursa: { ...after.sursa, sha256: 'abc' } };
  assert.throws(() => updateChangelog(file, before, bad), /sha256/);
});

test('CLI entrypoint updates the changelog from two metadata files', () => {
  const { spawnSync } = require('node:child_process');
  const file = tempChangelog(SEED);
  const dir = path.dirname(file);
  fs.writeFileSync(path.join(dir, 'before.json'), JSON.stringify(before));
  fs.writeFileSync(path.join(dir, 'after.json'), JSON.stringify(after));
  const script = path.join(__dirname, '..', 'scripts', 'update', 'changelog.js');
  const args = [script, file, path.join(dir, 'before.json'), path.join(dir, 'after.json')];
  const first = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.match(fs.readFileSync(file, 'utf8'), /^# Changelog\n\n## 2027-02-03 — /);
  const once = fs.readFileSync(file, 'utf8');
  const second = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), once);
  const usage = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(usage.status, 1);
});
