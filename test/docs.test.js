'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const CURRENT_FACTS = [
  '721c9059-5f87-4c79-9854-a1d5c18f58d5',
  'dac903f0-32b5-489a-89e7-2c80d96cf68d',
  'f443e49af2f9c9dce8ea515ae53090a18fb476547466b6cd804051424eaf72c6',
];

for (const name of ['README.md', 'LICENSE-DATA.md']) {
  test(`${name} delegates volatile current source facts to generated metadata`, () => {
    const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
    for (const fact of CURRENT_FACTS) {
      assert.equal(text.includes(fact), false, `${name} conține faptul volatil ${fact}`);
    }
    assert.match(text, /\]\(\.\/data\/latest\/metadata\.json\)/);
    assert.match(text, /\]\(\.\/sources\.yml\)/);
  });
}
