'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

function required(value, name) {
  assert.equal(typeof value, 'string', `${name} trebuie să fie text.`);
  assert.ok(value.trim(), `${name} este obligatoriu.`);
  return value.trim();
}

function loadManifest(root) {
  const raw = YAML.parse(fs.readFileSync(path.join(root, 'sources.yml'), 'utf8'));
  const source = raw?.dataset || {};
  const discoveryUrl = required(source.discovery_url, 'dataset.discovery_url');
  const license = required(source.license, 'dataset.license');
  const organization = required(source.organization, 'dataset.organization');
  const titlePattern = required(source.title_pattern, 'dataset.title_pattern');
  const resourceFormat = required(source.resource_format, 'dataset.resource_format');
  return {
    dataset: {
      discoveryUrl,
      organization,
      titlePattern,
      resourceFormat,
      license,
    },
  };
}

module.exports = { loadManifest };
