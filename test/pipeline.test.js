'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');
const { runCheck, runUpdate } = require('../scripts/update/pipeline');

const FIXTURE_BYTES = fs.readFileSync(path.join(__dirname, 'fixtures', 'siruta-small.csv'));
const CLI = path.join(__dirname, '..', 'scripts', 'update', 'cli.js');
const SOURCES_YML = [
  '# Surse editabile; câmpul dataset.current este generat.',
  'dataset:',
  '  discovery_url: https://data.gov.ro/api/3/action/package_search',
  '  organization: institutul-national-de-statistica',
  '  title_pattern: ^SIRUTA_s1[ _-](?<year>\\d{4})$',
  '  resource_format: CSV',
  '  license: CC-BY-4.0',
  '',
].join('\n');
const MODIFIED_AT = '2026-08-11T11:42:48.571937';
const CSV_URL = 'https://example.test/siruta_s1_2026.csv';

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'siruta-pipeline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'sources.yml'), SOURCES_YML);
  return root;
}

function makeFetch(state) {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url).includes('package_search')) {
      return new Response(JSON.stringify({
        success: true,
        result: {
          results: [{
            id: 'dataset-2026',
            title: 'SIRUTA_s1 2026',
            license_id: 'CC-BY-4.0',
            metadata_modified: state.modifiedAt ?? MODIFIED_AT,
            resources: [{ id: 'resource-2026', format: 'CSV', state: 'active', url: CSV_URL, size: 1 }],
          }],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(state.bytes ?? FIXTURE_BYTES, { status: 200, headers: { 'content-type': 'text/csv' } });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const clock = iso => () => new Date(iso);

function snapshot(root) {
  const out = new Map();
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const stat = fs.statSync(full);
        out.set(path.relative(root, full), { mtimeMs: stat.mtimeMs, bytes: fs.readFileSync(full).toString('base64') });
      }
    }
  };
  walk(root);
  return out;
}

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative));
}

function seedExisting(root) {
  fs.mkdirSync(path.join(root, 'data', 'latest'), { recursive: true });
  fs.mkdirSync(path.join(root, 'sources', 'current'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'latest', 'siruta.json'), 'EXISTING-JSON\n');
  fs.writeFileSync(path.join(root, 'sources', 'current', 'siruta.csv'), 'EXISTING-CSV\n');
}

test('update writes every artifact, sources.yml last, and leaves no temporary paths', async t => {
  const root = makeRoot(t);
  const renames = [];
  const fsImpl = {
    ...fs,
    renameSync(from, to) {
      renames.push(path.relative(root, to));
      return fs.renameSync(from, to);
    },
  };
  const result = await runUpdate({
    root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z'), fs: fsImpl,
  });

  assert.deepEqual(result.report.totaluri, { toate: 5, judete: 1, uat: 2, localitati: 2 });
  const tracked = renames.filter(name => !name.startsWith('.tmp'));
  assert.deepEqual(tracked, [path.join('data', 'latest'), path.join('sources', 'current'), 'sources.yml']);
  assert.deepEqual(read(root, 'sources/current/siruta.csv'), FIXTURE_BYTES);
  const metadata = JSON.parse(read(root, 'data/latest/metadata.json'));
  assert.equal(metadata.sursa.sha256, crypto.createHash('sha256').update(FIXTURE_BYTES).digest('hex'));
  assert.equal(metadata.sursa.downloaded_at, '2026-10-19T00:00:00.000Z');
  assert.equal(metadata.sursa.bytes, FIXTURE_BYTES.length);
  const sources = YAML.parse(read(root, 'sources.yml').toString('utf8'));
  assert.equal(sources.dataset.current.sha256, metadata.sursa.sha256);
  assert.equal(sources.dataset.organization, 'institutul-national-de-statistica');
  assert.equal(fs.existsSync(path.join(root, '.tmp')), false);
});

test('an unchanged source checksum reuses the previous downloaded_at and is byte-stable', async t => {
  const root = makeRoot(t);
  await runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z') });
  const before = snapshot(root);
  await runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2027-01-01T00:00:00.000Z') });
  const after = snapshot(root);
  for (const [name, entry] of before) assert.equal(after.get(name).bytes, entry.bytes, name);
  assert.equal(JSON.parse(read(root, 'data/latest/metadata.json')).sursa.downloaded_at, '2026-10-19T00:00:00.000Z');
});

test('changed source bytes with a fixed modifiedAt change metadata and set a new downloaded_at', async t => {
  const root = makeRoot(t);
  await runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z') });
  const before = JSON.parse(read(root, 'data/latest/metadata.json'));
  const changed = Buffer.concat([FIXTURE_BYTES, Buffer.from('1100;SATUL NOU;0;1;1017;10;3;1;7;1;RO121;\n')]);
  await runUpdate({ root, fetchImpl: makeFetch({ bytes: changed }), now: clock('2026-11-01T08:00:00.000Z') });
  const after = JSON.parse(read(root, 'data/latest/metadata.json'));
  assert.equal(after.sursa.modified_at, before.sursa.modified_at);
  assert.notEqual(after.sursa.sha256, before.sursa.sha256);
  assert.equal(after.sursa.downloaded_at, '2026-11-01T08:00:00.000Z');
  assert.equal(after.totaluri.toate, 6);
  assert.equal(YAML.parse(read(root, 'sources.yml').toString('utf8')).dataset.current.sha256, after.sursa.sha256);
});

test('a throwing validator leaves existing artifacts untouched and cleans temporary paths', async t => {
  const root = makeRoot(t);
  seedExisting(root);
  const before = snapshot(root);
  await assert.rejects(
    runUpdate({
      root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z'),
      validate() { throw new Error('validare eșuată'); },
    }),
    /validare eșuată/
  );
  assert.deepEqual(snapshot(root), before);
  assert.equal(read(root, 'data/latest/siruta.json').toString(), 'EXISTING-JSON\n');
  assert.equal(fs.existsSync(path.join(root, '.tmp')), false);
});

test('an invalid hierarchy from the real validator leaves existing artifacts untouched', async t => {
  const root = makeRoot(t);
  seedExisting(root);
  const before = snapshot(root);
  const original = FIXTURE_BYTES.toString('utf8');
  const broken = Buffer.from(original.replace('510005;1;1017;9;', '510005;1;999999;9;'));
  assert.notEqual(broken.toString('utf8'), original);
  await assert.rejects(
    runUpdate({ root, fetchImpl: makeFetch({ bytes: broken }), now: clock('2026-10-19T00:00:00.000Z') }),
    /părinte inexistent/
  );
  assert.deepEqual(snapshot(root), before);
});

test('a non-official header is rejected before any tracked write', async t => {
  const root = makeRoot(t);
  seedExisting(root);
  const before = snapshot(root);
  await assert.rejects(
    runUpdate({
      root,
      fetchImpl: makeFetch({ bytes: Buffer.from('SIRUTA;DENLOC\n10;ALBA\n') }),
      now: clock('2026-10-19T00:00:00.000Z'),
    }),
    /antet/i
  );
  assert.deepEqual(snapshot(root), before);
});

test('a failure while replacing sources.yml rolls data/latest and sources/current back', async t => {
  const root = makeRoot(t);
  seedExisting(root);
  const before = snapshot(root);
  const fsImpl = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(root, 'sources.yml')) throw new Error('rename eșuat');
      return fs.renameSync(from, to);
    },
  };
  await assert.rejects(
    runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z'), fs: fsImpl }),
    /rename eșuat/
  );
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(path.join(root, '.tmp')), false);
});

test('check passes on an up-to-date repository without changing any file', async t => {
  const root = makeRoot(t);
  await runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z') });
  const before = snapshot(root);
  const writes = [];
  const fsImpl = {
    ...fs,
    mkdirSync(target, ...rest) { writes.push(target); return fs.mkdirSync(target, ...rest); },
    writeFileSync(target, ...rest) { writes.push(target); return fs.writeFileSync(target, ...rest); },
    renameSync() { throw new Error('check nu are voie să redenumească'); },
  };
  const result = await runCheck({
    root, fetchImpl: makeFetch({}), now: clock('2027-01-01T00:00:00.000Z'), fs: fsImpl,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(snapshot(root), before);
  assert.ok(writes.length > 0);
  for (const target of writes) {
    assert.ok(target.startsWith(path.join(root, '.tmp') + path.sep), `scriere în afara .tmp: ${target}`);
  }
  assert.equal(fs.existsSync(path.join(root, '.tmp')), false);
});

test('check reports changed upstream bytes even when modifiedAt is fixed, and does not write', async t => {
  const root = makeRoot(t);
  await runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z') });
  const before = snapshot(root);
  const changed = Buffer.concat([FIXTURE_BYTES, Buffer.from('1100;SATUL NOU;0;1;1017;10;3;1;7;1;RO121;\n')]);
  const result = await runCheck({
    root, fetchImpl: makeFetch({ bytes: changed }), now: clock('2026-11-01T08:00:00.000Z'),
  });
  assert.equal(result.ok, false);
  const stale = result.problems.filter(item => item.status === 'stale').map(item => item.path);
  assert.ok(stale.includes('data/latest/metadata.json'));
  assert.ok(stale.includes('sources/current/siruta.csv'));
  assert.ok(stale.includes('sources.yml'));
  assert.deepEqual(snapshot(root), before);
});

test('check reports every missing, stale and extra generated file', async t => {
  const root = makeRoot(t);
  await runUpdate({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z') });
  fs.rmSync(path.join(root, 'data/latest/uat.csv'));
  fs.writeFileSync(path.join(root, 'data/latest/judete.json'), 'STALE\n');
  fs.writeFileSync(path.join(root, 'data/latest/extra.txt'), 'extra\n');
  fs.writeFileSync(path.join(root, 'sources/current/old.csv'), 'old\n');
  const before = snapshot(root);
  const result = await runCheck({ root, fetchImpl: makeFetch({}), now: clock('2027-01-01T00:00:00.000Z') });
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, [
    { path: 'data/latest/extra.txt', status: 'extra' },
    { path: 'data/latest/judete.json', status: 'stale' },
    { path: 'data/latest/uat.csv', status: 'missing' },
    { path: 'sources/current/old.csv', status: 'extra' },
  ]);
  assert.deepEqual(snapshot(root), before);
});

test('check on a repository with no generated files reports all of them missing', async t => {
  const root = makeRoot(t);
  const result = await runCheck({ root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z') });
  assert.equal(result.ok, false);
  assert.ok(result.problems.every(item => item.status === 'missing' || item.path === 'sources.yml'));
  assert.equal(result.problems.filter(item => item.status === 'missing').length, 10);
});

test('cli rejects unsupported arguments with usage and exit code 1', () => {
  for (const args of [['update', '--help'], [], ['bogus'], ['update', 'check']]) {
    const run = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 1, args.join(' '));
    assert.match(run.stderr, /Utilizare: node scripts\/update\/cli\.js \[update\|check\]/);
    assert.equal(run.stdout, '');
  }
});

test('cli main prints totals on success and one error message on failure', async t => {
  const { main } = require('../scripts/update/cli');
  const root = makeRoot(t);
  const out = [];
  const err = [];
  const io = { log: line => out.push(line), error: line => err.push(line) };

  const okCode = await main(['update'], {
    root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z'), io,
  });
  assert.equal(okCode, 0);
  assert.equal(err.length, 0);
  assert.match(out.join('\n'), /5/);

  fs.writeFileSync(path.join(root, 'data/latest/judete.json'), 'STALE\n');
  out.length = 0;
  const failCode = await main(['check'], {
    root, fetchImpl: makeFetch({}), now: clock('2026-10-19T00:00:00.000Z'), io,
  });
  assert.equal(failCode, 1);
  assert.equal(err.length, 1);
  assert.match(err[0], /data\/latest\/judete\.json/);
  assert.equal(out.length, 0);
});
