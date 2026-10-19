'use strict';
const Ajv2020 = require('ajv/dist/2020');
const schema = require('../../schema.json');

const ajv = new Ajv2020({ allErrors: true });
const validateRecord = ajv.compile(schema);
const OFFICIAL_TIP = new Set([1, 2, 3, 4, 6, 9, 10, 11, 17, 18, 19, 22, 23, 40]);
const OFFICIAL_MEDIU = new Set([0, 1, 3]);
const PROFILES = new Set(['production', 'fixture']);

function isCountyRecord(record) {
  return record.nivel === 1;
}

function isUatRecord(record) {
  return record.nivel === 2 || (record.nivel === 3 && record.tip === 6);
}

function isLocalityRecord(record) {
  return record.nivel === 3 && record.tip !== 6;
}

function partitionRecords(records) {
  const judete = [];
  const uat = [];
  const localitati = [];

  for (const record of records) {
    const inJudete = isCountyRecord(record);
    const inUat = isUatRecord(record);
    const inLocalitati = isLocalityRecord(record);
    const matchCount = Number(inJudete) + Number(inUat) + Number(inLocalitati);

    if (matchCount !== 1) {
      throw new Error(
        `Înregistrarea ${record.siruta} nu aparține exact unei singure partiții (potriviri: ${matchCount}).`
      );
    }

    if (inJudete) {
      judete.push(record);
    } else if (inUat) {
      uat.push(record);
    } else {
      localitati.push(record);
    }
  }

  if (judete.length + uat.length + localitati.length !== records.length) {
    throw new Error('Partițiile nu acoperă exact toate înregistrările.');
  }

  return { judete, uat, localitati };
}

function validateDataset(records, options = {}) {
  const profile = options.profile ?? 'production';
  if (!PROFILES.has(profile)) {
    throw new Error(`Profil de validare necunoscut: ${profile}`);
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Setul de date SIRUTA trebuie să fie o listă nevidă.');
  }

  const bySiruta = new Map();
  const tipSet = new Set();
  const nivelSet = new Set();
  const mediuSet = new Set();

  for (const record of records) {
    if (!validateRecord(record)) {
      const id = record && typeof record.siruta === 'string' ? record.siruta : '<necunoscut>';
      throw new Error(
        `Înregistrare SIRUTA invalidă (${id}): ${ajv.errorsText(validateRecord.errors)}`
      );
    }

    if (bySiruta.has(record.siruta)) {
      throw new Error(`Cod SIRUTA duplicat: ${record.siruta}`);
    }
    if (!OFFICIAL_TIP.has(record.tip)) {
      throw new Error(`Domeniu TIP oficial invalid pentru ${record.siruta}: ${record.tip}.`);
    }
    if (!OFFICIAL_MEDIU.has(record.mediu)) {
      throw new Error(`Domeniu MEDIU oficial invalid pentru ${record.siruta}: ${record.mediu}.`);
    }
    bySiruta.set(record.siruta, record);

    tipSet.add(record.tip);
    nivelSet.add(record.nivel);
    mediuSet.add(record.mediu);
  }

  if (profile === 'production') {
    const rootCount = records.filter(isCountyRecord).length;
    if (rootCount !== 42) {
      throw new Error(
        `Registrul SIRUTA complet trebuie să conțină exact 42 de rădăcini județ/București; găsite ${rootCount}.`
      );
    }
  }

  for (const record of records) {
    const visited = new Set([record.siruta]);
    let current = record;

    while (current.nivel !== 1) {
      const parentCode = current.siruta_parinte;
      const parent = bySiruta.get(parentCode);

      if (!parent) {
        throw new Error(
          `Codul ${current.siruta} referențiază un părinte inexistent: ${parentCode}`
        );
      }

      if (visited.has(parent.siruta)) {
        throw new Error(
          `Ierarhia conține un ciclu care implică codul ${parent.siruta}.`
        );
      }
      visited.add(parent.siruta);

      current = parent;
    }
  }

  for (const record of records) {
    if (record.nivel === 1) {
      continue;
    }
    const parent = bySiruta.get(record.siruta_parinte);
    if (!(parent.nivel < record.nivel)) {
      throw new Error(
        `Nivel invalid pentru părintele ${parent.siruta} (nivel ${parent.nivel}) al înregistrării ${record.siruta} (nivel ${record.nivel}).`
      );
    }
  }

  const { judete, uat, localitati } = partitionRecords(records);
  if (judete.length === 0 || uat.length === 0 || localitati.length === 0) {
    throw new Error(
      `Partițiile SIRUTA trebuie să fie nevide (județe: ${judete.length}, UAT: ${uat.length}, localități: ${localitati.length}).`
    );
  }
  if (profile === 'production') {
    if (uat.length < 3000) {
      throw new Error(`Registrul SIRUTA complet trebuie să conțină cel puțin 3000 UAT; găsite ${uat.length}.`);
    }
    if (localitati.length < 13000) {
      throw new Error(
        `Registrul SIRUTA complet trebuie să conțină cel puțin 13000 localități componente; găsite ${localitati.length}.`
      );
    }
  }

  const sortAsc = (left, right) => left - right;

  return {
    totaluri: {
      toate: records.length,
      judete: judete.length,
      uat: uat.length,
      localitati: localitati.length,
    },
    domenii: {
      tip: [...tipSet].sort(sortAsc),
      nivel: [...nivelSet].sort(sortAsc),
      mediu: [...mediuSet].sort(sortAsc),
    },
  };
}

module.exports = {
  validateDataset,
  partitionRecords,
  isCountyRecord,
  isUatRecord,
  isLocalityRecord,
};
