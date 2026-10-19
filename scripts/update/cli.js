#!/usr/bin/env node
'use strict';
const path = require('node:path');
const { runCheck, runCheckOffline, runUpdate } = require('./pipeline');

const USAGE = 'Utilizare: node scripts/update/cli.js [update|check|check-offline]';

function formatTotals(report) {
  const { toate, judete, uat, localitati } = report.totaluri;
  return `SIRUTA: ${toate} înregistrări (județe: ${judete}, UAT: ${uat}, localități: ${localitati})`;
}

async function main(argv, deps = {}) {
  const io = deps.io ?? { log: console.log, error: console.error };
  const command = argv.length === 1 ? argv[0] : undefined;
  if (command !== 'update' && command !== 'check' && command !== 'check-offline') {
    io.error(USAGE);
    return 1;
  }

  const options = {
    root: deps.root ?? path.resolve(__dirname, '..', '..'),
    fetchImpl: deps.fetchImpl,
    now: deps.now,
    validate: deps.validate,
    fs: deps.fs,
  };
  try {
    if (command === 'update') {
      const { report } = await runUpdate(options);
      io.log(formatTotals(report));
      return 0;
    }
    const check = command === 'check-offline' ? runCheckOffline : runCheck;
    const { ok, problems, report } = await check(options);
    if (!ok) {
      const lines = problems.map(item => `  - ${item.status}: ${item.path}`);
      io.error(`Artefactele generate nu sunt la zi:\n${lines.join('\n')}`);
      return 1;
    }
    io.log(formatTotals(report));
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}

module.exports = { main, USAGE };
