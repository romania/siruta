'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { discoverLatest } = require('../scripts/update/discover');

const manifest = {
  dataset: {
    discoveryUrl: 'https://data.gov.ro/api/3/action/package_search',
    organization: 'institutul-national-de-statistica',
    titlePattern: '^SIRUTA_s1[ _-](?<year>\\d{4})$',
    resourceFormat: 'CSV',
    license: 'CC-BY-4.0',
  },
};

function dataset(year, suffix = 'a', license = 'CC-BY-4.0', modifiedAt = `${year}-08-11T11:42:48.571937`) {
  return {
    id: `dataset-${year}-${suffix}`,
    title: `SIRUTA_s1 ${year}`,
    license_id: license,
    metadata_modified: modifiedAt,
    resources: [
      {
        id: `resource-${year}-${suffix}`,
        format: 'csv',
        state: 'active',
        url: `https://example.test/siruta_s1_${year}_${suffix}.csv`,
        size: 892897,
      },
      {
        id: `doc-${year}-${suffix}`,
        format: 'DOC',
        state: 'active',
        url: `https://example.test/metodologie_${year}.doc`,
        size: 160768,
      },
    ],
  };
}

function ckanResponse(results) {
  return new Response(
    JSON.stringify({
      success: true,
      result: { results },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }
  );
}

function fakeFetch(response) {
  return async () => response;
}

test('selects the newest SIRUTA S1 dataset from CKAN', async () => {
  const response = ckanResponse([
    dataset(2025, 'a'),
    dataset(2026, 'a'),
    {
      id: 'unrelated',
      title: 'SIRUTA_an 2026',
      license_id: 'uk-ogl',
      metadata_modified: '2026-09-01T00:00:00',
      resources: [],
    },
  ]);
  const selected = await discoverLatest(manifest, fakeFetch(response));
  assert.deepEqual(selected, {
    datasetId: 'dataset-2026-a',
    resourceId: 'resource-2026-a',
    title: 'SIRUTA_s1 2026',
    year: 2026,
    modifiedAt: '2026-08-11T11:42:48.571937',
    url: 'https://example.test/siruta_s1_2026_a.csv',
    license: 'CC-BY-4.0',
    size: 892897,
  });
});

test('rejects two equally current matching datasets', async () => {
  const response = ckanResponse([dataset(2026, 'a'), dataset(2026, 'b')]);
  await assert.rejects(
    discoverLatest(manifest, fakeFetch(response)),
    /Selecție ambiguă.*2026/
  );
});

test('rejects a non-CC-BY dataset', async () => {
  await assert.rejects(
    discoverLatest(manifest, fakeFetch(ckanResponse([dataset(2026, 'a', 'other')]))),
    /licență/
  );
});

test('rejects when a matching dataset lacks a single active CSV resource', async () => {
  const broken = dataset(2026, 'a');
  broken.resources = [];
  await assert.rejects(
    discoverLatest(manifest, fakeFetch(ckanResponse([broken]))),
    /exact un CSV activ/
  );
});
