'use strict';
const assert = require('node:assert/strict');
const YAML = require('yaml');
const { partitionRecords, validateDataset } = require('./validate');

const COLUMNS = [
  'siruta',
  'nume',
  'cod_postal',
  'judet_cod_numeric',
  'siruta_parinte',
  'tip',
  'nivel',
  'mediu',
  'regiune',
  'fsj',
  'nuts',
  'lau',
];

const INSTITUTION = 'Institutul Național de Statistică';
const LICENSE = 'CC BY 4.0';
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const TRANSFORMATIONS = [
  'decodare UTF-8 strictă',
  'Unicode NFC și înlocuire Ș/Ț cu virgulă',
  'eliminare spații marginale și compactare spații repetate',
  'coduri păstrate ca șiruri',
  'sortare numerică după cod SIRUTA',
];

function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(records) {
  const lines = [COLUMNS.join(',')];
  for (const record of records) {
    lines.push(COLUMNS.map(column => csvField(record[column])).join(','));
  }
  return Buffer.from(lines.join('\n') + '\n', 'utf8');
}

function toJson(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function buildSource(provenance) {
  return {
    institutie: INSTITUTION,
    dataset_id: provenance.datasetId,
    resource_id: provenance.resourceId,
    url: provenance.url,
    license: LICENSE,
    license_url: LICENSE_URL,
    modified_at: provenance.modifiedAt,
    downloaded_at: provenance.downloadedAt,
    bytes: provenance.size,
    sha256: provenance.sha256,
  };
}

function buildMetadata(provenance, report) {
  return {
    schema_version: 1,
    dataset: 'SIRUTA S1',
    editie: provenance.title,
    an_referinta: provenance.year,
    sursa: buildSource(provenance),
    transformari: [...TRANSFORMATIONS],
    totaluri: report.totaluri,
    domenii: report.domenii,
  };
}

function buildSourcesYml(provenance, metadata) {
  assert.equal(typeof provenance.sourcesYml, 'string', 'Conținutul curent al sources.yml este obligatoriu.');
  const doc = YAML.parseDocument(provenance.sourcesYml);
  assert.equal(doc.errors.length, 0, `sources.yml invalid: ${doc.errors[0]?.message}`);
  assert.ok(YAML.isMap(doc.get('dataset')), 'sources.yml trebuie să conțină harta dataset.');
  const { sursa } = metadata;
  doc.setIn(['dataset', 'current'], doc.createNode({
    title: metadata.editie,
    year: metadata.an_referinta,
    dataset_id: sursa.dataset_id,
    resource_id: sursa.resource_id,
    url: sursa.url,
    license: sursa.license,
    license_url: sursa.license_url,
    modified_at: sursa.modified_at,
    downloaded_at: sursa.downloaded_at,
    bytes: sursa.bytes,
    sha256: sursa.sha256,
    transformari: metadata.transformari,
  }));
  return Buffer.from(doc.toString({ lineWidth: 0 }).replace(/\n*$/, '\n'), 'utf8');
}

function buildArtifacts(records, provenance) {
  assert.ok(Buffer.isBuffer(provenance?.bytes), 'Octeții sursei sunt obligatorii.');
  const report = provenance.report ?? validateDataset(records);
  const { judete, uat, localitati } = partitionRecords(records);
  const metadata = buildMetadata(provenance, report);

  const artifacts = new Map();
  const addTable = (name, rows) => {
    artifacts.set(`data/latest/${name}.csv`, toCsv(rows));
    artifacts.set(`data/latest/${name}.json`, toJson(rows));
  };
  addTable('judete', judete);
  addTable('localitati', localitati);
  artifacts.set('data/latest/metadata.json', toJson(metadata));
  addTable('siruta', records);
  addTable('uat', uat);
  artifacts.set('sources/current/siruta.csv', Buffer.from(provenance.bytes));
  artifacts.set('sources.yml', buildSourcesYml(provenance, metadata));
  return artifacts;
}

module.exports = { buildArtifacts, COLUMNS };
