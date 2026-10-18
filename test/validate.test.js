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
    () => validateDataset(records.map((row, idx) => (idx === 0 ? { ...row, nivel: 4 } : row))),
    /nivel/i
  );
  assert.throws(
    () => validateDataset(records.map((row, idx) => (idx === 0 ? { ...row, extra: 'x' } : row))),
    /additional|propriet/i
  );
});

test('reports partitions and sorted domains that exactly cover the fixture', () => {
  const report = validateDataset(records);
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
  assert.throws(() => validateDataset(broken), /părinte inexistent.*999999/);
});

test('rejects a parent whose level is not strictly lower than child level', () => {
  const sameLevelParent = records.map((row) =>
    row.siruta === '1035' ? { ...row, siruta_parinte: '1026' } : row
  );
  assert.throws(() => validateDataset(sameLevelParent), /nivel/i);
});

test('rejects a hierarchy cycle', () => {
  const broken = records.map((row) =>
    row.siruta === '1017' ? { ...row, siruta_parinte: '1026' } : row
  );
  assert.throws(() => validateDataset(broken), /ciclu/);
});

test('rejects duplicate SIRUTA codes passed directly to validateDataset', () => {
  const duplicated = [...records, { ...records[0] }];
  assert.throws(() => validateDataset(duplicated), /duplicat/i);
});
