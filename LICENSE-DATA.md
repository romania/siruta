# Licența datelor — SIRUTA

## Distincția dintre licența datelor și licența codului

Acest depozit separă explicit regimul juridic al datelor de cel al codului sursă:

- **Datele** (`data/latest/*`, `sources/current/*` și metadatele asociate din `sources.yml`) sunt derivate din registrul oficial publicat de **Institutul Național de Statistică (INS)** și sunt puse la dispoziție sub licența **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
- **Codul sursă** (`scripts/**`, `test/**`, `schema.json`, `package.json`) este licențiat separat sub **WTFPL** (vezi [`LICENSE-CODE`](./LICENSE-CODE)). Licența WTFPL acoperă **exclusiv codul**, nu și setul de date SIRUTA.

---

## Proveniența oficială a datelor

- **Instituția sursă:** Institutul Național de Statistică (INS) — organizația `institutul-national-de-statistica` pe portalul național `data.gov.ro`
- **Descoperire:** fluxul CKAN stabil `package_search?q=siruta&sort=metadata_modified desc`; fiecare candidat SIRUTA este verificat explicit ca aparținând organizației INS, conform regulilor din [`sources.yml`](./sources.yml)
- **Versiunea și resursa oficială curente:** identificatorii CKAN, URL-ul resursei, data modificării, dimensiunea și SHA-256 sunt în [`data/latest/metadata.json`](./data/latest/metadata.json); sursa rezolvată este oglindită în [`sources.yml`](./sources.yml)
- **Licența declarată de sursă:** Creative Commons Attribution 4.0 International (`CC BY 4.0`)
- **Textul complet al licenței CC BY 4.0:** https://creativecommons.org/licenses/by/4.0/

---

## Cerințe de atribuire (CC BY 4.0)

La reutilizarea sau redistribuirea fișierelor din `data/latest/*` ori `sources/current/*`, includeți următoarea mențiune de atribuire:

> Sursa datelor: **Institutul Național de Statistică (INS)** — registrul *SIRUTA S1*, publicat pe `data.gov.ro`; versiunea și resursa oficială sunt identificate în [`data/latest/metadata.json`](./data/latest/metadata.json) și [`sources.yml`](./sources.yml), sub licența [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Conform termenilor CC BY 4.0, utilizatorii trebuie să indice dacă au fost aduse modificări față de fișierul original. Fișierele din `data/latest/*` aplică următoarele transformări tehnice deterministe asupra fișierului original `sources/current/siruta.csv`:

1. Decodare UTF-8 strictă;
2. Normalizare Unicode NFC și înlocuirea diacriticelor cu sedilă (`Ş`/`ş`, `Ţ`/`ţ`) cu variantele standard cu virgulă (`Ș`/`ș`, `Ț`/`ț`), plus compactarea spațiilor;
3. Păstrarea codurilor (`siruta`, `cod_postal`, `judet_cod_numeric`, `siruta_parinte`, `regiune`, `fsj`, `nuts`, `lau`) ca șiruri de caractere și conversia valorilor `LAU` vide la `null` în JSON;
4. Sortare numerică ascendentă după codul `siruta` și partiționare în `judete`, `uat` și `localitati`.
