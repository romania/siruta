'use strict';
const nodeFs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { buildArtifacts } = require('./artifacts');
const { discoverLatest } = require('./discover');
const { downloadCSV } = require('./download');
const { loadManifest } = require('./manifest');
const { normalizeSIRUTA } = require('./normalize');
const { validateDataset } = require('./validate');

const GENERATED_DIRS = ['data/latest', 'sources/current'];
const SOURCES_FILE = 'sources.yml';

function resolveOptions(options = {}) {
  if (!options.root) throw new Error('Rădăcina depozitului este obligatorie.');
  return {
    root: options.root,
    fetchImpl: options.fetchImpl ?? fetch,
    now: options.now ?? (() => new Date()),
    validate: options.validate ?? validateDataset,
    fs: options.fs ?? nodeFs,
  };
}

function existingCurrent(sourcesText) {
  const current = YAML.parse(sourcesText)?.dataset?.current;
  return current && typeof current === 'object' ? current : null;
}

// Everything that can fail (network, parsing, validation, serialization) happens
// here, in memory, before any file is written.
async function prepare({ root, fetchImpl, now, validate, fs }) {
  const manifest = loadManifest(root);
  const sourcesYml = fs.readFileSync(path.join(root, SOURCES_FILE), 'utf8');

  const source = await discoverLatest(manifest, fetchImpl);
  const { bytes, sha256 } = await downloadCSV(source, fetchImpl);
  const records = normalizeSIRUTA(bytes);
  const report = validate(records);

  const previous = existingCurrent(sourcesYml);
  const downloadedAt =
    previous?.sha256 === sha256 && typeof previous.downloaded_at === 'string'
      ? previous.downloaded_at
      : now().toISOString();

  const artifacts = buildArtifacts(records, {
    title: source.title,
    year: source.year,
    datasetId: source.datasetId,
    resourceId: source.resourceId,
    url: source.url,
    modifiedAt: source.modifiedAt,
    downloadedAt,
    size: bytes.length,
    sha256,
    bytes,
    report,
    sourcesYml,
  });
  return { artifacts, report };
}

function stageArtifacts(fs, stageRoot, artifacts) {
  for (const [relative, buffer] of artifacts) {
    const target = path.join(stageRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
  }
}

function removeStage(fs, root, stage) {
  fs.rmSync(stage, { recursive: true, force: true });
  try {
    fs.rmdirSync(path.join(root, '.tmp')); // only succeeds when empty
  } catch {
    // .tmp is shared or already absent; leave it alone.
  }
}

function installDirectories(fs, root, staged, backups) {
  const done = [];
  try {
    for (const relative of GENERATED_DIRS) {
      const target = path.join(root, relative);
      const backup = path.join(backups, relative);
      const entry = { target, backup, hadPrevious: false, installed: false };
      done.push(entry);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.renameSync(target, backup);
        entry.hadPrevious = true;
      }
      fs.renameSync(path.join(staged, relative), target);
      entry.installed = true;
    }
    fs.renameSync(path.join(staged, SOURCES_FILE), path.join(root, SOURCES_FILE));
  } catch (error) {
    for (const entry of done.reverse()) {
      if (entry.installed) fs.rmSync(entry.target, { recursive: true, force: true });
      if (entry.hadPrevious) fs.renameSync(entry.backup, entry.target);
    }
    throw error;
  }
}

async function runUpdate(options) {
  const resolved = resolveOptions(options);
  const { root, fs } = resolved;
  const { artifacts, report } = await prepare(resolved);

  const stage = path.join(root, '.tmp', `update-${process.pid}`);
  try {
    fs.rmSync(stage, { recursive: true, force: true });
    const staged = path.join(stage, 'new');
    stageArtifacts(fs, staged, artifacts);
    installDirectories(fs, root, staged, path.join(stage, 'previous'));
  } finally {
    removeStage(fs, root, stage);
  }
  return { report };
}

function listFiles(fs, root, relativeDir) {
  const base = path.join(root, relativeDir);
  if (!fs.existsSync(base)) return [];
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(base);
  return found;
}

async function runCheck(options) {
  const resolved = resolveOptions(options);
  const { root, fs } = resolved;
  const { artifacts, report } = await prepare(resolved);

  const stage = path.join(root, '.tmp', `check-${process.pid}`);
  const problems = [];
  try {
    fs.rmSync(stage, { recursive: true, force: true });
    stageArtifacts(fs, stage, artifacts);

    for (const relative of artifacts.keys()) {
      const actual = path.join(root, relative);
      if (!fs.existsSync(actual)) {
        problems.push({ path: relative, status: 'missing' });
      } else if (!fs.readFileSync(actual).equals(fs.readFileSync(path.join(stage, relative)))) {
        problems.push({ path: relative, status: 'stale' });
      }
    }
    for (const dir of GENERATED_DIRS) {
      for (const relative of listFiles(fs, root, dir)) {
        if (!artifacts.has(relative)) problems.push({ path: relative, status: 'extra' });
      }
    }
  } finally {
    removeStage(fs, root, stage);
  }
  problems.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return { ok: problems.length === 0, problems, report };
}

module.exports = { runUpdate, runCheck };
