'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { normalizeSIRUTA } = require('../scripts/update/normalize');

const FIXTURE = path.join(__dirname, 'fixtures', 'siruta-small.csv');

function readFixtureBytes() {
  return fs.readFileSync(FIXTURE);
}

function withDataRows(mutator) {
  const lines = readFixtureBytes().toString('utf8').split(/\r?\n/);
  const header = lines[0];
  const data = lines.slice(1).filter((line) => line.length > 0);
  mutator(data);
  return Buffer.from(`${header}\r\n${data.join('\r\n')}\r\n`, 'utf8');
}

test('normalizes the small fixture into canonical sorted records', () => {
  const records = normalizeSIRUTA(readFixtureBytes());
  assert.deepEqual(records[0], {
    siruta: '10',
    nume: 'JUDEȚUL ALBA',
    cod_postal: '0',
    judet_cod_numeric: '1',
    siruta_parinte: '1',
    tip: 40,
    nivel: 1,
    mediu: 0,
    regiune: '7',
    fsj: '1',
    nuts: 'RO121',
    lau: null,
  });
  assert.equal(records.find((row) => row.siruta === '1026').nume, 'ALBA IULIA');
  assert.ok(
    records.every(
      (row, index, all) => index === 0 || Number(all[index - 1].siruta) <= Number(row.siruta)
    )
  );

  const sector = records.find((row) => row.siruta === '179141');
  assert.equal(sector.tip, 6);
  assert.equal(sector.nivel, 3);
  assert.equal(sector.nume, 'BUCUREȘTI SECTORUL 1');
});

test('rejects duplicate SIRUTA codes', () => {
  const bytes = withDataRows((rows) => {
    rows.push(rows.find((line) => line.startsWith('1026;')));
  });
  assert.throws(() => normalizeSIRUTA(bytes), /duplicat/i);
});

test('rejects rows with an extra column', () => {
  const bytes = withDataRows((rows) => {
    const index = rows.findIndex((line) => line.startsWith('1026;'));
    rows[index] = `${rows[index]};extra`;
  });
  assert.throws(() => normalizeSIRUTA(bytes));
});

test('rejects invalid integer fields', () => {
  const bytes = withDataRows((rows) => {
    const index = rows.findIndex((line) => line.startsWith('1026;'));
    rows[index] = rows[index].replace(';9;3;', ';x;3;');
  });
  assert.throws(() => normalizeSIRUTA(bytes), /întreg/i);
});

test('rejects invalid UTF-8 bytes', () => {
  assert.throws(() => normalizeSIRUTA(Buffer.from([0xff, 0xfe, 0x00, 0x0a])), /UTF-8/i);
});
