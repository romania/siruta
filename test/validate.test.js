'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Ajv2020 = require('ajv/dist/2020');
const { normalizeSIRUTA } = require('../scripts/update/normalize');
const { validateDataset } = require('../scripts/update/validate');
const schema = require('../schema.json');

const FIXTURE = path.join(__dirname, 'fixtures', 'siruta-small.csv');
const records = normalizeSIRUTA(fs.readFileSync(FIXTURE));
const currentRecords = require('../data/latest/siruta.json');
const fixtureOptions = { profile: 'fixture' };

test('schema.json uses draft 2020-12 and validates fixture records while rejecting invalid nivel or extra properties', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);

  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(schema);

  for (const record of records) {
    assert.equal(validate(record), true, ajv.errorsText(validate.errors));
  }

  assert.equal(validate({ ...records[0], nivel: 4 }), false);
  assert.equal(validate({ ...records[0], extra: 'nope' }), false);

  assert.throws(
    () => validateDataset(
      records.map((row, idx) => (idx === 0 ? { ...row, nivel: 4 } : row)),
      fixtureOptions
    ),
    /nivel/i
  );
  assert.throws(
    () => validateDataset(
      records.map((row, idx) => (idx === 0 ? { ...row, extra: 'x' } : row)),
      fixtureOptions
    ),
    /additional|propriet/i
  );
});

test('reports partitions and sorted domains that exactly cover the fixture', () => {
  const report = validateDataset(records, fixtureOptions);
  assert.deepEqual(report.totaluri, {
    toate: 5,
    judete: 1,
    uat: 2,
    localitati: 2,
  });
  assert.deepEqual(report.domenii, {
    tip: [1, 6, 9, 10, 40],
    nivel: [1, 2, 3],
    mediu: [0, 1],
  });
});

test('rejects a missing parent', () => {
  const broken = records.map((row) =>
    row.siruta === '1026' ? { ...row, siruta_parinte: '999999' } : row
  );
  assert.throws(() => validateDataset(broken, fixtureOptions), /părinte inexistent.*999999/);
});

test('rejects a parent whose level is not strictly lower than child level', () => {
  const sameLevelParent = records.map((row) =>
    row.siruta === '1035' ? { ...row, siruta_parinte: '1026' } : row
  );
  assert.throws(() => validateDataset(sameLevelParent, fixtureOptions), /nivel/i);
});

test('rejects a hierarchy cycle', () => {
  const broken = records.map((row) =>
    row.siruta === '1017' ? { ...row, siruta_parinte: '1026' } : row
  );
  assert.throws(() => validateDataset(broken, fixtureOptions), /ciclu/);
});

test('rejects duplicate SIRUTA codes passed directly to validateDataset', () => {
  const duplicated = [...records, { ...records[0] }];
  assert.throws(() => validateDataset(duplicated, fixtureOptions), /duplicat/i);
});

test('production validation accepts the current complete registry without pinning its total', () => {
  const report = validateDataset(currentRecords);
  assert.equal(report.totaluri.judete, 42);
  assert.ok(report.totaluri.uat >= 3000);
  assert.ok(report.totaluri.localitati >= 13000);
});

test('production validation rejects a coherent two-row subset', () => {
  const coherentSubset = records.filter(row => row.siruta === '10' || row.siruta === '1017');
  assert.throws(() => validateDataset(coherentSubset), /42.*rădăcini|complet/i);
});

test('rejects values outside the official TIP and MEDIU domains', () => {
  const unknownTip = currentRecords.map((row, index) => index === 0 ? { ...row, tip: 999 } : row);
  const unknownMediu = currentRecords.map((row, index) => index === 0 ? { ...row, mediu: 999 } : row);
  assert.throws(() => validateDataset(unknownTip), /TIP.*999/i);
  assert.throws(() => validateDataset(unknownMediu), /MEDIU.*999/i);
});

test('production validation rejects a root count other than exactly 42', () => {
  const extraRoot = { ...currentRecords.find(row => row.nivel === 1), siruta: '999998', nume: 'RĂDĂCINĂ TEST' };
  assert.throws(() => validateDataset([...currentRecords, extraRoot]), /exact 42.*rădăcini/i);
});

test('production validation rejects UAT and locality partitions below conservative bounds', () => {
  const belowLocalityBound = [];
  let localities = 0;
  for (const row of currentRecords) {
    if (row.nivel === 3 && row.tip !== 6) {
      if (localities++ < 12999) belowLocalityBound.push(row);
    } else {
      belowLocalityBound.push(row);
    }
  }
  assert.throws(() => validateDataset(belowLocalityBound), /cel puțin 13000.*localități/i);

  const selectedLevelTwo = new Set(
    currentRecords.filter(row => row.nivel === 2).slice(0, 2993).map(row => row.siruta)
  );
  const belowUatBound = currentRecords.filter(row =>
    row.nivel === 1 ||
    (row.nivel === 2 && selectedLevelTwo.has(row.siruta)) ||
    (row.nivel === 3 && selectedLevelTwo.has(row.siruta_parinte))
  );
  assert.throws(() => validateDataset(belowUatBound), /cel puțin 3000 UAT/i);
});
