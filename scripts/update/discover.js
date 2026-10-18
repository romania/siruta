'use strict';
const assert = require('node:assert/strict');

async function discoverLatest(manifest, fetchImpl = fetch) {
  const config = manifest?.dataset;
  assert.ok(config, 'Configurația dataset lipsește din manifest.');
  const url = new URL(config.discoveryUrl);
  url.searchParams.set('fq', `organization:${config.organization}`);

  const response = await fetchImpl(url.toString());
  assert.ok(response.ok, `Descoperirea CKAN a eșuat cu status ${response.status}.`);
  const payload = await response.json();
  assert.equal(payload?.success, true, 'Răspunsul CKAN nu indică succes.');
  const results = payload?.result?.results;
  assert.ok(Array.isArray(results), 'Răspunsul CKAN nu conține lista de seturi de date.');

  const matching = results.flatMap(pkg => {
    const match = new RegExp(config.titlePattern, 'i').exec(pkg.title);
    if (!match) return [];
    assert.equal(pkg.license_id, config.license, `${pkg.title}: licență neașteptată.`);
    const resources = (pkg.resources || []).filter(item =>
      item.state === 'active' && String(item.format || '').toUpperCase() === config.resourceFormat
    );
    assert.equal(resources.length, 1, `${pkg.title}: trebuie să aibă exact un CSV activ.`);
    return [{ pkg, resource: resources[0], year: Number(match.groups.year) }];
  });
  matching.sort((a, b) =>
    b.year - a.year ||
    b.pkg.metadata_modified.localeCompare(a.pkg.metadata_modified)
  );
  assert.ok(matching.length, 'Nu a fost găsită nicio ediție SIRUTA S1.');
  if (matching[1]?.year === matching[0].year &&
      matching[1].pkg.metadata_modified === matching[0].pkg.metadata_modified) {
    throw new Error(`Selecție ambiguă pentru SIRUTA S1 ${matching[0].year}.`);
  }

  const selected = matching[0];
  assert.ok(selected.resource.url, `${selected.pkg.title}: URL-ul resursei CSV lipsește.`);
  return {
    datasetId: selected.pkg.id,
    resourceId: selected.resource.id,
    title: selected.pkg.title,
    year: selected.year,
    modifiedAt: selected.pkg.metadata_modified,
    url: selected.resource.url,
    license: selected.pkg.license_id,
    size: selected.resource.size ?? null,
  };
}

module.exports = { discoverLatest };
