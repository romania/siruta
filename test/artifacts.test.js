'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { parse } = require('csv-parse/sync');
const YAML = require('yaml');
const { buildArtifacts } = require('../scripts/update/artifacts');
const { normalizeSIRUTA } = require('../scripts/update/normalize');
const { validateDataset } = require('../scripts/update/validate');

const FIXTURE = path.join(__dirname, 'fixtures', 'siruta-small.csv');
const SOURCES_YML = [
  '# Surse editabile; câmpul dataset.current este generat.',
  'dataset:',
  '  discovery_url: https://data.gov.ro/api/3/action/package_search?q=siruta&sort=metadata_modified%20desc',
  '  organization: institutul-national-de-statistica',
  '  title_pattern: ^SIRUTA_s1[ _-](?<year>\\d{4})$',
  '  resource_format: CSV',
  '  license: CC-BY-4.0',
  '',
].join('\n');

const EXPECTED_KEYS = [
  'data/latest/judete.csv',
  'data/latest/judete.json',
  'data/latest/localitati.csv',
  'data/latest/localitati.json',
  'data/latest/metadata.json',
  'data/latest/siruta.csv',
  'data/latest/siruta.json',
  'data/latest/uat.csv',
  'data/latest/uat.json',
  'sources/current/siruta.csv',
  'sources.yml',
];

function setup(bytes = fs.readFileSync(FIXTURE), overrides = {}) {
  const records = normalizeSIRUTA(bytes);
  const provenance = {
    title: 'SIRUTA_s1 2026',
    year: 2026,
    datasetId: 'dataset-2026',
    resourceId: 'resource-2026',
    url: 'https://example.test/siruta_s1_2026.csv',
    modifiedAt: '2026-08-11T11:42:48.571937',
    downloadedAt: '2026-10-19T00:00:00.000Z',
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes,
    report: validateDataset(records, { profile: 'fixture' }),
    sourcesYml: SOURCES_YML,
    ...overrides,
  };
  return { records, provenance };
}

function csvToRecords(buffer) {
  return parse(buffer.toString('utf8'), { columns: true, skip_empty_lines: true }).map(row => ({
    siruta: row.siruta,
    nume: row.nume,
    cod_postal: row.cod_postal,
    judet_cod_numeric: row.judet_cod_numeric,
    siruta_parinte: row.siruta_parinte,
    tip: Number(row.tip),
    nivel: Number(row.nivel),
    mediu: Number(row.mediu),
    regiune: row.regiune,
    fsj: row.fsj,
    nuts: row.nuts,
    lau: row.lau === '' ? null : row.lau,
  }));
}

test('produces exactly the documented artifact names in order', () => {
  const { records, provenance } = setup();
  assert.deepEqual([...buildArtifacts(records, provenance).keys()], EXPECTED_KEYS);
});

test('every text artifact is a UTF-8 Buffer ending in exactly one LF and two calls are byte-identical', () => {
  const { records, provenance } = setup();
  const first = buildArtifacts(records, provenance);
  const second = buildArtifacts(records, provenance);
  for (const [name, buffer] of first) {
    assert.ok(Buffer.isBuffer(buffer), name);
    assert.deepEqual(buffer, second.get(name), name);
    const text = buffer.toString('utf8');
    assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'), `${name} trebuie să se încheie cu un singur LF`);
    if (name !== 'sources/current/siruta.csv') {
      assert.ok(!text.includes('\r'), `${name} nu trebuie să conțină CR`);
    }
  }
});

test('JSON artifacts use two-space indentation and CSV artifacts round-trip to the JSON records', () => {
  const { records, provenance } = setup();
  const artifacts = buildArtifacts(records, provenance);
  for (const name of ['judete', 'uat', 'localitati', 'siruta']) {
    const json = artifacts.get(`data/latest/${name}.json`);
    const parsed = JSON.parse(json.toString('utf8'));
    assert.equal(json.toString('utf8'), JSON.stringify(parsed, null, 2) + '\n');
    assert.deepEqual(csvToRecords(artifacts.get(`data/latest/${name}.csv`)), parsed);
  }
  assert.deepEqual(JSON.parse(artifacts.get('data/latest/siruta.json')), records);
  assert.equal(
    artifacts.get('data/latest/siruta.csv').toString('utf8').split('\n')[0],
    'siruta,nume,cod_postal,judet_cod_numeric,siruta_parinte,tip,nivel,mediu,regiune,fsj,nuts,lau'
  );
});

test('CSV serialization quotes commas, quotes and newlines (RFC 4180) and keeps null LAU empty', () => {
  const { records, provenance } = setup();
  const tricky = records.map(row =>
    row.siruta === '1026' ? { ...row, nume: 'ALBA, "VECHE"\nNOUĂ' } : row
  );
  const artifacts = buildArtifacts(tricky, provenance);
  const text = artifacts.get('data/latest/siruta.csv').toString('utf8');
  assert.ok(text.includes('"ALBA, ""VECHE""\nNOUĂ"'));
  assert.deepEqual(
    csvToRecords(artifacts.get('data/latest/localitati.csv')).find(row => row.siruta === '1026').nume,
    'ALBA, "VECHE"\nNOUĂ'
  );
});

test('level-3 TIP=6 sectors belong to uat and are excluded from localitati', () => {
  const { records, provenance } = setup();
  const artifacts = buildArtifacts(records, provenance);
  const codes = name => JSON.parse(artifacts.get(`data/latest/${name}.json`)).map(row => row.siruta);
  assert.deepEqual(codes('judete'), ['10']);
  assert.deepEqual(codes('uat'), ['1017', '101790']);
  assert.deepEqual(codes('localitati'), ['1026', '1035']);
  assert.deepEqual(codes('siruta'), ['10', '1017', '1026', '1035', '101790']);
});

test('metadata carries provenance, the exact download checksum, and validation report', () => {
  const { records, provenance } = setup();
  const metadata = JSON.parse(buildArtifacts(records, provenance).get('data/latest/metadata.json'));
  assert.deepEqual(Object.keys(metadata), [
    'schema_version', 'dataset', 'editie', 'an_referinta', 'sursa', 'transformari', 'totaluri', 'domenii',
  ]);
  assert.equal(metadata.schema_version, 1);
  assert.equal(metadata.dataset, 'SIRUTA S1');
  assert.equal(metadata.editie, 'SIRUTA_s1 2026');
  assert.equal(metadata.an_referinta, 2026);
  assert.deepEqual(metadata.sursa, {
    institutie: 'Institutul Național de Statistică',
    dataset_id: 'dataset-2026',
    resource_id: 'resource-2026',
    url: 'https://example.test/siruta_s1_2026.csv',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    modified_at: '2026-08-11T11:42:48.571937',
    downloaded_at: '2026-10-19T00:00:00.000Z',
    bytes: provenance.bytes.length,
    sha256: provenance.sha256,
  });
  assert.equal(metadata.sursa.sha256, crypto.createHash('sha256').update(provenance.bytes).digest('hex'));
  assert.deepEqual(metadata.transformari, [
    'decodare UTF-8 strictă',
    'Unicode NFC și înlocuire Ș/Ț cu virgulă',
    'eliminare spații marginale și compactare spații repetate',
    'coduri păstrate ca șiruri',
    'sortare numerică după cod SIRUTA',
  ]);
  assert.deepEqual(metadata.totaluri, { toate: 5, judete: 1, uat: 2, localitati: 2 });
  assert.deepEqual(metadata.domenii, { tip: [1, 6, 9, 10, 40], nivel: [1, 2, 3], mediu: [0, 1] });
});

test('transformari in metadata.json and sources.yml include trimming and repeated-whitespace collapse', () => {
  const { records, provenance } = setup();
  const artifacts = buildArtifacts(records, provenance);
  const metadata = JSON.parse(artifacts.get('data/latest/metadata.json'));
  const sources = YAML.parse(artifacts.get('sources.yml').toString('utf8'));
  const expected = 'eliminare spații marginale și compactare spații repetate';
  assert.ok(metadata.transformari.includes(expected));
  assert.ok(sources.dataset.current.transformari.includes(expected));
});

test('committed source copy is the exact downloaded bytes', () => {
  const { records, provenance } = setup();
  assert.deepEqual(buildArtifacts(records, provenance).get('sources/current/siruta.csv'), provenance.bytes);
});

test('sources.yml preserves discovery fields and gets deterministic dataset.current mirroring metadata', () => {
  const { records, provenance } = setup();
  const artifacts = buildArtifacts(records, provenance);
  const text = artifacts.get('sources.yml').toString('utf8');
  assert.ok(text.startsWith('# Surse editabile; câmpul dataset.current este generat.\n'));
  const parsed = YAML.parse(text);
  const original = YAML.parse(SOURCES_YML);
  for (const [key, value] of Object.entries(original.dataset)) {
    assert.equal(parsed.dataset[key], value, key);
  }
  const metadata = JSON.parse(artifacts.get('data/latest/metadata.json'));
  assert.deepEqual(parsed.dataset.current, {
    title: metadata.editie,
    year: metadata.an_referinta,
    dataset_id: metadata.sursa.dataset_id,
    resource_id: metadata.sursa.resource_id,
    url: metadata.sursa.url,
    license: metadata.sursa.license,
    license_url: metadata.sursa.license_url,
    modified_at: metadata.sursa.modified_at,
    downloaded_at: metadata.sursa.downloaded_at,
    bytes: metadata.sursa.bytes,
    sha256: metadata.sursa.sha256,
    transformari: metadata.transformari,
  });
});

test('regenerating from its own sources.yml is byte-identical (idempotent ownership of dataset.current)', () => {
  const { records, provenance } = setup();
  const first = buildArtifacts(records, provenance);
  const again = buildArtifacts(records, { ...provenance, sourcesYml: first.get('sources.yml').toString('utf8') });
  assert.deepEqual(again.get('sources.yml'), first.get('sources.yml'));
});

test('changed source bytes change metadata and sources.yml even when modifiedAt is fixed', () => {
  const original = setup();
  const changedBytes = Buffer.concat([fs.readFileSync(FIXTURE), Buffer.from('1100;SATUL NOU;0;1;1017;10;3;1;7;1;RO121;\n')]);
  const changed = setup(changedBytes);
  assert.equal(changed.provenance.modifiedAt, original.provenance.modifiedAt);
  const before = buildArtifacts(original.records, original.provenance);
  const after = buildArtifacts(changed.records, changed.provenance);
  assert.notDeepEqual(after.get('data/latest/metadata.json'), before.get('data/latest/metadata.json'));
  assert.notDeepEqual(after.get('sources.yml'), before.get('sources.yml'));
  assert.equal(JSON.parse(after.get('data/latest/metadata.json')).sursa.sha256, changed.provenance.sha256);
});
