'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const OFFICIAL_HEADER = 'SIRUTA;DENLOC;CODP;JUD;SIRSUP;TIP;NIV;MED;REGIUNE;FSJ;NUTS;LAU';
const FIXTURE_HEADER = 'SIRUTA;DENLOC';
const ALLOWED_CONTENT_TYPES = new Set(['text/csv', 'application/octet-stream']);

async function downloadCSV(source, fetchImpl = fetch) {
  assert.ok(source?.url, 'URL-ul sursei CSV este obligatoriu.');
  const response = await fetchImpl(source.url);
  assert.ok(response.ok, `Descărcarea CSV a eșuat cu status ${response.status}.`);

  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  assert.ok(
    ALLOWED_CONTENT_TYPES.has(contentType),
    `Răspunsul de la ${source.url} nu este CSV (content-type: ${contentType || 'necunoscut'}).`
  );

  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new Error('Fișierul CSV descărcat nu este UTF-8 valid.', { cause });
  }

  const firstLine = text.split(/\r?\n/, 1)[0];
  assert.ok(
    firstLine === OFFICIAL_HEADER || firstLine === FIXTURE_HEADER,
    `Antet CSV neașteptat: ${firstLine}`
  );

  return { bytes, sha256 };
}

module.exports = { downloadCSV, OFFICIAL_HEADER };
