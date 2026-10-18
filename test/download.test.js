'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { downloadCSV } = require('../scripts/update/download');

function fakeBinaryFetch(bytes, contentType, status = 200) {
  return async () =>
    new Response(bytes, {
      status,
      headers: { 'content-type': contentType },
    });
}

test('downloads CSV and hashes the exact bytes', async () => {
  const bytes = Buffer.from(
    'SIRUTA;DENLOC;CODP;JUD;SIRSUP;TIP;NIV;MED;REGIUNE;FSJ;NUTS;LAU\r\n10;JUDEŢUL ALBA;0;1;1;40;1;0;7;1;RO121;\r\n'
  );
  const result = await downloadCSV(
    { url: 'https://example.test/siruta.csv' },
    fakeBinaryFetch(bytes, 'text/csv')
  );
  assert.equal(result.sha256, '0e14f9e2b5bc697609a3662e38a48dde6edf15c1661e76397fc832bbe9d369e4');
  assert.deepEqual(result.bytes, bytes);
});

test('accepts the official 12-column header with BOM and application/octet-stream', async () => {
  const bytes = Buffer.from(
    '\uFEFFSIRUTA;DENLOC;CODP;JUD;SIRSUP;TIP;NIV;MED;REGIUNE;FSJ;NUTS;LAU\r\n10;JUDEŢUL ALBA;0;1;1;40;1;0;7;1;RO121;\r\n',
    'utf8'
  );
  const result = await downloadCSV(
    { url: 'https://example.test/siruta.csv' },
    fakeBinaryFetch(bytes, 'application/octet-stream')
  );
  assert.equal(result.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(result.bytes, bytes);
});

test('rejects a 200 HTML response before parsing', async () => {
  await assert.rejects(
    downloadCSV(
      { url: 'https://example.test/siruta.csv' },
      fakeBinaryFetch(Buffer.from('<html>error</html>'), 'text/html')
    ),
    /nu este CSV/
  );
});

test('rejects a CSV response with a two-column header', async () => {
  await assert.rejects(
    downloadCSV(
      { url: 'https://example.test/siruta.csv' },
      fakeBinaryFetch(Buffer.from('SIRUTA;DENLOC\r\n10;JUDEŢUL ALBA\r\n'), 'text/csv')
    ),
    /antet/i
  );
});

test('rejects invalid UTF-8 bytes', async () => {
  const invalidUtf8 = Buffer.from([0xff, 0xfe, 0x00, 0x0a]);
  await assert.rejects(
    downloadCSV(
      { url: 'https://example.test/siruta.csv' },
      fakeBinaryFetch(invalidUtf8, 'text/csv')
    ),
    /UTF-8/i
  );
});
