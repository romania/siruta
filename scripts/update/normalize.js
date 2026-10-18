'use strict';
const { parse } = require('csv-parse/sync');
const { OFFICIAL_HEADER } = require('./download');

function normalizeText(value) {
  return value
    .normalize('NFC')
    .replaceAll('Ş', 'Ș')
    .replaceAll('ş', 'ș')
    .replaceAll('Ţ', 'Ț')
    .replaceAll('ţ', 'ț')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseStrictInteger(value, fieldName) {
  const text = String(value ?? '').trim();
  if (text === '') {
    throw new Error(`Câmpul ${fieldName} nu poate fi gol.`);
  }
  if (!/^\d+$/.test(text)) {
    throw new Error(`Câmpul ${fieldName} trebuie să fie un întreg: ${value}`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Câmpul ${fieldName} depășește intervalul sigur: ${value}`);
  }
  return parsed;
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new Error('Fișierul CSV nu este UTF-8 valid.', { cause });
  }
}

function normalizeSIRUTA(bytes) {
  const text = decodeUtf8(bytes);
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, '');
  if (firstLine !== OFFICIAL_HEADER) {
    throw new Error(`Antet CSV neașteptat: ${firstLine}`);
  }

  let rows;
  try {
    rows = parse(text, {
      delimiter: ';',
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_column_count: false,
      cast: false,
    });
  } catch (cause) {
    throw cause;
  }

  const seen = new Set();
  const records = rows.map((row) => {
    const siruta = String(row.SIRUTA);
    if (seen.has(siruta)) {
      throw new Error(`Cod SIRUTA duplicat: ${siruta}`);
    }
    seen.add(siruta);

    const lauRaw = row.LAU;
    return {
      siruta,
      nume: normalizeText(String(row.DENLOC)),
      cod_postal: String(row.CODP),
      judet_cod_numeric: String(row.JUD),
      siruta_parinte: String(row.SIRSUP),
      tip: parseStrictInteger(row.TIP, 'TIP'),
      nivel: parseStrictInteger(row.NIV, 'NIV'),
      mediu: parseStrictInteger(row.MED, 'MED'),
      regiune: String(row.REGIUNE),
      fsj: String(row.FSJ),
      nuts: String(row.NUTS),
      lau: lauRaw == null || String(lauRaw).trim() === '' ? null : String(lauRaw),
    };
  });

  records.sort((left, right) =>
    left.siruta.localeCompare(right.siruta, 'ro', { numeric: true })
  );

  return records;
}

module.exports = { normalizeSIRUTA };
