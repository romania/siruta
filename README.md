# SIRUTA — Registrul unităților administrativ-teritoriale din România

Set de date normalizat, validat și reproductibil pentru **SIRUTA** (*Sistemul Informatic al Registrului Unităților Teritorial-Administrative*), publicat oficial de **Institutul Național de Statistică (INS)** pe portalul național de date deschise `data.gov.ro`.

- **Ediția curentă:** `SIRUTA_s1 2026` (an de referință `2026`)
- **Total înregistrări:** `16.978` (`42` județe + municipiul București, `3.187` UAT-uri, `13.749` localități componente)
- **SHA-256 sursă oficială:** `f443e49af2f9c9dce8ea515ae53090a18fb476547466b6cd804051424eaf72c6` (`892.897` octeți)
- **Licență date:** [CC BY 4.0](./LICENSE-DATA.md) · **Licență cod:** [WTFPL](./LICENSE-CODE)

> **Relația cu `romania/localitati`:** Acest depozit oferă registrul oficial SIRUTA curent (cu ierarhia completă județ → UAT → localitate și metadate de proveniență INS) și **completează, dar nu înlocuiește** depozitul `romania/localitati`. Aplicațiile care depind de structura specifică din `romania/localitati` pot continua să îl folosească neschimbat.

---

## Fișiere publicate

| Fișier | Format | Înregistrări | Descriere |
| --- | --- | ---: | --- |
| `data/latest/siruta.csv` | CSV (RFC 4180, UTF-8, LF) | 16.978 | Toate înregistrările SIRUTA normalizate, sortate numeric după `siruta` |
| `data/latest/siruta.json` | JSON (UTF-8, LF) | 16.978 | Toate înregistrările SIRUTA normalizate |
| `data/latest/judete.csv` | CSV (RFC 4180, UTF-8, LF) | 42 | Nivel 1: cele 41 de județe și Municipiul București (`nivel = 1`) |
| `data/latest/judete.json` | JSON (UTF-8, LF) | 42 | Nivel 1 în format JSON |
| `data/latest/uat.csv` | CSV (RFC 4180, UTF-8, LF) | 3.187 | Unități administrativ-teritoriale (`nivel = 2`) și cele 6 sectoare ale Municipiului București (`nivel = 3, tip = 6`) |
| `data/latest/uat.json` | JSON (UTF-8, LF) | 3.187 | UAT-urile și sectoarele Bucureștiului în format JSON |
| `data/latest/localitati.csv` | CSV (RFC 4180, UTF-8, LF) | 13.749 | Localități componente și sate (`nivel = 3, tip != 6`) |
| `data/latest/localitati.json` | JSON (UTF-8, LF) | 13.749 | Localități componente și sate în format JSON |
| `data/latest/metadata.json` | JSON (UTF-8, LF) | — | Metadate despre ediție, proveniență CKAN/INS, SHA-256, transformări, totaluri și domenii de valori |
| `sources/current/siruta.csv` | CSV brut INS (`;`, CRLF) | 16.978 | Copia exactă, octet cu octet, a fișierului oficial descărcat de la INS |
| `sources.yml` | YAML (UTF-8, LF) | — | Manifestul de descoperire CKAN și amprenta ediției curente (`dataset.current`) |
| `schema.json` | JSON Schema (2020-12) | — | Schema formală de validare a unei înregistrări normalizate |

### Sursa brută vs. exporturile normalizate

- **`sources/current/siruta.csv`** păstrează **exact octeții descărcați** de la INS (separator `;`, terminații de linie CRLF și diacritice cu sedilă `Ş`/`Ţ`), astfel încât suma de control SHA-256 din depozit să corespundă identic cu `data/latest/metadata.json` și `sources.yml`. Fișierul `.gitattributes` marchează `sources/current/**` ca `-text binary` pentru a preveni conversia automată a terminațiilor de linie în Git.
- **`data/latest/*.{csv,json}`** sunt exporturi normalizate deterministe: codificare UTF-8 validată strict, terminații de linie LF (`\n`), diacritice românești standard în Unicode NFC cu virgulă dedesubt (`Ș`/`ș`, `Ț`/`ț`), spații multiple compactate și sortare numerică ascendentă după codul `siruta`.
- Câmpul **`url`** din `data/latest/metadata.json` și `sources.yml` stochează **URL-ul oficial stabil al resursei CKAN** selectate la descoperire (`https://data.gov.ro/dataset/.../resource/.../download/...`), nu o adresă temporară de CDN rezultată în urma unei redirecționări HTTP.

---

## Structura câmpurilor

Fiecare înregistrare din `data/latest/*.{csv,json}` respectă `schema.json`:

| Câmp | Tip JSON | Reprezentare CSV | Coloană INS | Descriere |
| --- | --- | --- | --- | --- |
| `siruta` | `string` | șir nevid | `SIRUTA` | Codul unic SIRUTA al unității (cheie primară) |
| `nume` | `string` | șir nevid | `DENLOC` | Denumirea oficială normalizată (Unicode NFC, `Ș`/`Ț` cu virgulă) |
| `cod_postal` | `string` | șir nevid (`"0"` dacă nu se aplică) | `CODP` | Codul poștal din sursa INS (păstrat ca șir) |
| `judet_cod_numeric` | `string` | șir (`"1"`–`"40"`, `"51"`, `"52"`) | `JUD` | Codul numeric al județului (sau `"40"` pentru București) |
| `siruta_parinte` | `string` | șir nevid | `SIRSUP` | Codul `siruta` al unității ierarhice superioare (`"1"` pentru `nivel = 1`) |
| `tip` | `integer` | întreg | `TIP` | Tipul unității conform nomenclatorului INS (`1, 2, 3, 4, 6, 9, 10, 11, 17, 18, 19, 22, 23, 40`) |
| `nivel` | `integer` | întreg (`1`, `2`, `3`) | `NIV` | Nivelul ierarhic: `1` (județ), `2` (UAT), `3` (localitate / sector) |
| `mediu` | `integer` | întreg (`0`, `1`, `3`) | `MED` | Mediul rezidențial: `0` (nivel județean), `1` (urban), `3` (rural) |
| `regiune` | `string` | șir (`"1"`–`"8"`) | `REGIUNE` | Codul regiunii de dezvoltare |
| `fsj` | `string` | șir | `FSJ` | Codul de sortare județeană din nomenclatorul INS |
| `nuts` | `string` | șir (ex. `"RO121"`, `"RO321"`) | `NUTS` | Codul european NUTS 3 |
| `lau` | `string \| null` | șir (ex. `"RO_1017"`) sau gol `""` | `LAU` | Codul Local Administrative Unit (prezent pe UAT-urile de nivel 2, `null`/gol în rest) |

### Atenție: păstrați codurile ca șiruri (`string` / `TEXT`)

Toate codurile de identificare și clasificare (`siruta`, `siruta_parinte`, `cod_postal`, `judet_cod_numeric`, `regiune`, `fsj`, `nuts`, `lau`) sunt modelate și serializate ca **șiruri de caractere**, nu ca numere.

- **Nu convertiți `cod_postal` sau codurile de identificare la tipuri numerice (`INT` / `Number`).** Conversia la întreg elimină eventualele zerouri semnificative (de exemplu, codurile poștale din București precum `"10013"` în sursa INS sau coduri formatate pe 6 cifre) și poate produce erori la join-uri între sisteme.
- Doar `tip`, `nivel` și `mediu` sunt valori întregi (`integer`).

---

## Semantica ierarhiei și a sectoarelor Municipiului București

Cele trei partiții (`judete`, `uat`, `localitati`) formează o **partiție disjunctă și completă** a tabelului `siruta` (`42 + 3.187 + 13.749 = 16.978`):

1. **Nivelul 1 (`judete`, `nivel = 1`, `tip = 40`):**
   - Conține cele 41 de județe și `MUNICIPIUL BUCUREȘTI` (`siruta: "403"`).
   - Toate înregistrările de nivel 1 au `siruta_parinte: "1"` (valoare santinelă INS pentru rădăcina națională).
2. **Nivelul 2 și sectoarele Bucureștiului (`uat`, 3.187 înregistrări):**
   - Include toate cele `3.181` de unități administrativ-teritoriale de `nivel = 2` (municipii, orașe, comune și `MUNICIPIUL BUCUREȘTI` cu `siruta: "179132"`, `tip: 9`, `siruta_parinte: "403"`, `lau: "RO_179132"`), al căror părinte este întotdeauna o înregistrare de `nivel = 1`.
   - Include de asemenea cele **6 sectoare ale Municipiului București** (`siruta: "179141"` … `"179196"`, `BUCUREȘTI SECTORUL 1` … `6`), care în SIRUTA au `nivel = 3`, `tip = 6` și `siruta_parinte: "179132"`. Deoarece sectoarele funcționează ca subdiviziuni administrativ-teritoriale la nivel de UAT, regula de partiționare le plasează în `uat` (`nivel === 2 || (nivel === 3 && tip === 6)`), nu în `localitati`.
3. **Nivelul 3 (`localitati`, `nivel = 3 && tip != 6`, 13.749 înregistrări):**
   - Conține localitățile componente și satele arondate unui UAT de nivel 2 (`siruta_parinte` indică întotdeauna un UAT de `nivel = 2`).

---

## Exemple de utilizare

### JavaScript (Node.js)

```javascript
const fs = require('node:fs');

const uat = JSON.parse(fs.readFileSync('data/latest/uat.json', 'utf8'));
const albaIulia = uat.find((row) => row.siruta === '1017');
console.log(albaIulia);
// {
//   siruta: '1017',
//   nume: 'MUNICIPIUL ALBA IULIA',
//   cod_postal: '0',
//   judet_cod_numeric: '1',
//   siruta_parinte: '10',
//   tip: 1,
//   nivel: 2,
//   mediu: 1,
//   regiune: '7',
//   fsj: '1',
//   nuts: 'RO121',
//   lau: 'RO_1017'
// }
```

### Python (`csv` / `pandas` cu păstrarea codurilor ca `str`)

```python
import csv

with open("data/latest/siruta.csv", mode="r", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f)
    by_siruta = {row["siruta"]: row for row in reader}

sector1 = by_siruta["179141"]
parent_uat = by_siruta[sector1["siruta_parinte"]]
print(sector1["nume"], "->", parent_uat["nume"])
# BUCUREȘTI SECTORUL 1 -> MUNICIPIUL BUCUREȘTI
```

Dacă folosiți `pandas`, specificați `dtype=str` pentru coloanele de coduri:

```python
import pandas as pd

df = pd.read_csv(
    "data/latest/siruta.csv",
    dtype={
        "siruta": "string",
        "nume": "string",
        "cod_postal": "string",
        "judet_cod_numeric": "string",
        "siruta_parinte": "string",
        "tip": "int64",
        "nivel": "int64",
        "mediu": "int64",
        "regiune": "string",
        "fsj": "string",
        "nuts": "string",
        "lau": "string",
    },
)
```

### SQL (PostgreSQL / SQLite — import CSV cu coduri `TEXT`)

```sql
CREATE TABLE siruta (
  siruta            TEXT PRIMARY KEY,
  nume              TEXT NOT NULL,
  cod_postal        TEXT NOT NULL,
  judet_cod_numeric TEXT NOT NULL,
  siruta_parinte    TEXT NOT NULL,
  tip               INTEGER NOT NULL,
  nivel             INTEGER NOT NULL CHECK (nivel IN (1, 2, 3)),
  mediu             INTEGER NOT NULL,
  regiune           TEXT NOT NULL,
  fsj               TEXT NOT NULL,
  nuts              TEXT NOT NULL,
  lau               TEXT
);

-- PostgreSQL:
-- \copy siruta FROM 'data/latest/siruta.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Interogare: toate localitățile din Municipiul Alba Iulia (SIRUTA '1017')
SELECT siruta, nume, cod_postal
FROM siruta
WHERE siruta_parinte = '1017'
ORDER BY siruta;
```

---

## Comenzi de dezvoltare și verificare

Necesită **Node.js >= 22**.

```bash
# 1. Instalarea dependențelor exacte din package-lock.json
npm ci

# 2. Rularea suitei de teste unitare și de integrare
npm test

# 3. Verificarea sincronizării cu sursa oficială (fără modificarea arborelui de lucru)
npm run check

# 4. Descoperirea, descărcarea, validarea și actualizarea atomică a artefactelor
npm run update
```

### Despre `npm run check` (detecție live a modificărilor în amonte)

Comanda `npm run check` efectuează **detecție live a derivei față de sursa oficială (live upstream drift detection)**:
1. Interoghează API-ul CKAN de pe `data.gov.ro` pentru organizația `institutul-national-de-statistica` și selectează cea mai recentă ediție `SIRUTA_s1`.
2. Descarcă fișierul CSV oficial în memorie, îl normalizează, validează toate invariantele (`schema.json`, unicitate, integritatea ierarhiei părinte-copil, partiții) și regenerează artefactele într-un director temporar (`.tmp/check-<pid>`).
3. Compară octet cu octet fișierele din depozit (`data/latest/*`, `sources/current/siruta.csv`, `sources.yml`) cu cele regenerate, fără a modifica niciun fișier urmărit de Git.

> **Notă importantă:** Deoarece `npm run check` verifică live sursa din amonte, comanda **poate eșua dacă portalul `data.gov.ro` este indisponibil temporar** sau dacă INS a publicat o ediție nouă ori a modificat fișierul CSV oficial (caz în care trebuie rulat `npm run update` și revizuite modificările).

---

## Sursă și licențiere

- **Sursa datelor:** **Institutul Național de Statistică (INS)** — setul de date `SIRUTA_s1 2026` publicat pe `data.gov.ro` (`https://data.gov.ro/dataset/721c9059-5f87-4c79-9854-a1d5c18f58d5/resource/dac903f0-32b5-489a-89e7-2c80d96cf68d/download/siruta_s1_2026.csv`).
- **Licența datelor (`data/latest/*`, `sources/current/*`):** **Creative Commons Attribution 4.0 International (CC BY 4.0)** — consultați [**LICENSE-DATA.md**](./LICENSE-DATA.md) pentru detalii complete privind atribuirea și transformările aplicate.
- **Licența codului sursă (`scripts/*`, `test/*`, `schema.json`):** **WTFPL** — consultați [**LICENSE-CODE**](./LICENSE-CODE).
