'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadManifest } = require('../scripts/update/manifest');

test('loads the exact SIRUTA discovery contract', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'siruta-manifest-'));
  fs.writeFileSync(path.join(root, 'sources.yml'), `
dataset:
  discovery_url: https://data.gov.ro/api/3/action/package_search?q=siruta&sort=metadata_modified%20desc
  organization: institutul-national-de-statistica
  title_pattern: ^SIRUTA_s1[ _-](?<year>\\d{4})$
  resource_format: CSV
  license: CC-BY-4.0
`);
  assert.deepEqual(loadManifest(root), {
    dataset: {
      discoveryUrl: 'https://data.gov.ro/api/3/action/package_search?q=siruta&sort=metadata_modified%20desc',
      organization: 'institutul-national-de-statistica',
      titlePattern: '^SIRUTA_s1[ _-](?<year>\\d{4})$',
      resourceFormat: 'CSV',
      license: 'CC-BY-4.0',
    },
  });
});

test('rejects a manifest that omits the license', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'siruta-manifest-'));
  fs.writeFileSync(path.join(root, 'sources.yml'), 'dataset: { discovery_url: https://example.test }');
  assert.throws(() => loadManifest(root), /dataset\.license/);
});
