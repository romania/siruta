'use strict';

function renderErrorChain(error) {
  const details = [];
  const seen = new Set();
  let current = error;

  while (current != null && !seen.has(current)) {
    if (typeof current !== 'object') {
      details.push(String(current));
      break;
    }
    seen.add(current);

    const code = typeof current.code === 'string' ? current.code : '';
    const message = typeof current.message === 'string' ? current.message : '';
    const detail = code && message ? `${code}: ${message}` : code || message;
    if (detail) details.push(detail);

    current = current.cause;
  }

  return details.length ? details.join('; cauză: ') : 'eroare de rețea fără detalii';
}

async function fetchWithDiagnostics(fetchImpl, url, operation) {
  try {
    return await fetchImpl(url);
  } catch (cause) {
    throw new Error(`${operation} pentru ${url}: ${renderErrorChain(cause)}`, { cause });
  }
}

module.exports = { fetchWithDiagnostics };
