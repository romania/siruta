#!/usr/bin/env node
'use strict';
const fs = require('node:fs');

const HEADING = '# Changelog';
const SHA256 = /^[0-9a-f]{64}$/;
const PREFIX_LENGTH = 12;
const USAGE = 'Utilizare: node scripts/update/changelog.js <CHANGELOG.md> <metadata-veche.json> <metadata-nou.json>';

function sourceOf(metadata, label) {
  const sursa = metadata?.sursa;
  if (!sursa || typeof sursa.sha256 !== 'string' || !SHA256.test(sursa.sha256)) {
    throw new Error(`${label}: sursa.sha256 trebuie să fie un SHA-256 hexazecimal de 64 de caractere.`);
  }
  if (typeof sursa.modified_at !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(sursa.modified_at)) {
    throw new Error(`${label}: sursa.modified_at trebuie să înceapă cu o dată ISO.`);
  }
  return sursa;
}

function totalsOf(metadata, label) {
  const totals = metadata.totaluri;
  for (const key of ['toate', 'judete', 'uat', 'localitati']) {
    if (!Number.isInteger(totals?.[key])) throw new Error(`${label}: totaluri.${key} lipsește.`);
  }
  return totals;
}

function delta(oldValue, newValue) {
  const diff = newValue - oldValue;
  const sign = diff > 0 ? '+' : '';
  return `\`${sign}${diff}\` (\`${oldValue}\` → \`${newValue}\`)`;
}

function buildEntry(before, after) {
  const oldSource = sourceOf(before, 'metadata veche');
  const newSource = sourceOf(after, 'metadata nouă');
  const oldTotals = totalsOf(before, 'metadata veche');
  const newTotals = totalsOf(after, 'metadata nouă');
  const date = newSource.modified_at.slice(0, 10);
  return [
    `## ${date} — ${after.editie}`,
    '',
    `- **Ediție:** \`${after.editie}\``,
    `- **Modificat în sursă (\`modified_at\`):** \`${newSource.modified_at}\``,
    `- **SHA-256 anterior:** \`${oldSource.sha256.slice(0, PREFIX_LENGTH)}…\``,
    `- **SHA-256 nou:** \`${newSource.sha256.slice(0, PREFIX_LENGTH)}…\``,
    `- **SHA-256 sursă (complet):** \`${newSource.sha256}\``,
    `- **Variație totaluri:** total ${delta(oldTotals.toate, newTotals.toate)}, ` +
      `județe ${delta(oldTotals.judete, newTotals.judete)}, ` +
      `UAT ${delta(oldTotals.uat, newTotals.uat)}, ` +
      `localități ${delta(oldTotals.localitati, newTotals.localitati)}`,
  ].join('\n');
}

// Inserts one entry right after "# Changelog". Entries are keyed by the full
// source SHA-256: if it already appears in the file, nothing is written.
// Returns true when the file was modified.
function updateChangelog(path, beforeMetadata, afterMetadata) {
  const entry = buildEntry(beforeMetadata, afterMetadata);
  const text = fs.readFileSync(path, 'utf8');
  if (text.includes(afterMetadata.sursa.sha256)) return false;
  if (!text.startsWith(`${HEADING}\n`)) {
    throw new Error(`${path} trebuie să înceapă cu „${HEADING}”.`);
  }
  const rest = text.slice(HEADING.length).replace(/^\n+/, '');
  fs.writeFileSync(path, `${HEADING}\n\n${entry}\n\n${rest}`);
  return true;
}

function main(argv) {
  if (argv.length !== 3) {
    console.error(USAGE);
    return 1;
  }
  try {
    const [file, beforePath, afterPath] = argv;
    const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
    const after = JSON.parse(fs.readFileSync(afterPath, 'utf8'));
    console.log(updateChangelog(file, before, after) ? 'CHANGELOG actualizat.' : 'CHANGELOG deja la zi.');
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { updateChangelog };
