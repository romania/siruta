# Licența datelor — SIRUTA

## Distincția dintre licența datelor și licența codului

Acest depozit separă explicit regimul juridic al datelor de cel al codului sursă:

- **Datele** (`data/latest/*`, `sources/current/*` și metadatele asociate din `sources.yml`) sunt derivate din registrul oficial publicat de **Institutul Național de Statistică (INS)** și sunt puse la dispoziție sub licența **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
- **Codul sursă** (`scripts/**`, `test/**`, `schema.json`, `package.json`) este licențiat separat sub **WTFPL** (vezi [`LICENSE-CODE`](./LICENSE-CODE)). Licența WTFPL acoperă **exclusiv codul**, nu și setul de date SIRUTA.

---

## Proveniența oficială a datelor

- **Instituția sursă:** Institutul Național de Statistică (INS) — organizația `institutul-national-de-statistica` pe portalul național `data.gov.ro`
- **Set de date (CKAN `dataset_id`):** `721c9059-5f87-4c79-9854-a1d5c18f58d5` (`SIRUTA_s1 2026`)
- **Pagina setului de date:** https://data.gov.ro/dataset/721c9059-5f87-4c79-9854-a1d5c18f58d5
- **Resursa oficială (CKAN `resource_id`):** `dac903f0-32b5-489a-89e7-2c80d96cf68d`
- **URL oficial al resursei CSV:** https://data.gov.ro/dataset/721c9059-5f87-4c79-9854-a1d5c18f58d5/resource/dac903f0-32b5-489a-89e7-2c80d96cf68d/download/siruta_s1_2026.csv
- **Data modificării în sursă (`modified_at`):** `2026-08-11T11:42:48.571937`
- **Amprenta SHA-256 a sursei brute (`sources/current/siruta.csv`):** `f443e49af2f9c9dce8ea515ae53090a18fb476547466b6cd804051424eaf72c6` (`892897` octeți)
- **Licența declarată de sursă:** Creative Commons Attribution 4.0 International (`CC BY 4.0`)
- **Textul complet al licenței CC BY 4.0:** https://creativecommons.org/licenses/by/4.0/

---

## Cerințe de atribuire (CC BY 4.0)

La reutilizarea sau redistribuirea fișierelor din `data/latest/*` ori `sources/current/*`, includeți următoarea mențiune de atribuire:

> Sursa datelor: **Institutul Național de Statistică (INS)** — *SIRUTA_s1 2026*, publicat pe `data.gov.ro` (https://data.gov.ro/dataset/721c9059-5f87-4c79-9854-a1d5c18f58d5/resource/dac903f0-32b5-489a-89e7-2c80d96cf68d/download/siruta_s1_2026.csv), sub licența [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Conform termenilor CC BY 4.0, utilizatorii trebuie să indice dacă au fost aduse modificări față de fișierul original. Fișierele din `data/latest/*` aplică următoarele transformări tehnice deterministe asupra fișierului original `sources/current/siruta.csv`:

1. Decodare UTF-8 strictă;
2. Normalizare Unicode NFC și înlocuirea diacriticelor cu sedilă (`Ş`/`ş`, `Ţ`/`ţ`) cu variantele standard cu virgulă (`Ș`/`ș`, `Ț`/`ț`), plus compactarea spațiilor;
3. Păstrarea codurilor (`siruta`, `cod_postal`, `judet_cod_numeric`, `siruta_parinte`, `regiune`, `fsj`, `nuts`, `lau`) ca șiruri de caractere și conversia valorilor `LAU` vide la `null` în JSON;
4. Sortare numerică ascendentă după codul `siruta` și partiționare în `judete`, `uat` și `localitati`.
