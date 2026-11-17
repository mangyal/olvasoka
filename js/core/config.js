// A listák Google táblázata környezetenként (N10).
//
// Ezek az alapértékek (helyi futtatás, tesztek). Kiadáskor a deploy workflow ezt a fájlt felülírja a
// GitHub repository variable-ökből, ha be vannak állítva (Settings → Secrets and variables → Actions →
// Variables): PROD_SHEET_CSV_URL, PROD_SHEET_EDIT_URL, DEV_SHEET_CSV_URL, DEV_SHEET_EDIT_URL.
// A dev, ha nincs saját változója, az éles táblázatot olvassa.

export const SHEETS = Object.freeze({
  prod: Object.freeze({
    csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTC1LeDZKtyeoWqy57jz7dUOsfY3FoutvTl3S5ogBvSKFWOWLbyxCjO2IISlCHXxMdCHSjrOM-T2Dq6/pub?output=csv',
    edit: 'https://docs.google.com/spreadsheets/d/1j87SRjs4ZvyEJmModdTuNwPdyzgkwzx34yarw3qdCEM/edit?gid=0#gid=0',
  }),
  dev: Object.freeze({
    csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTC1LeDZKtyeoWqy57jz7dUOsfY3FoutvTl3S5ogBvSKFWOWLbyxCjO2IISlCHXxMdCHSjrOM-T2Dq6/pub?output=csv',
    edit: 'https://docs.google.com/spreadsheets/d/1j87SRjs4ZvyEJmModdTuNwPdyzgkwzx34yarw3qdCEM/edit?gid=0#gid=0',
  }),
});

// Haladás nézet: a napszámon alapuló szabályok kihagyása teszteléshez (docs/haladas-specifikacio.md, 10.).
// Kiadáskor a DEV_PROGRESS_SKIP_DAY_RULES és PROD_PROGRESS_SKIP_DAY_RULES változókból („true” vagy üres).
export const PROGRESS = Object.freeze({
  prod: Object.freeze({ skipDayRules: false }),
  dev: Object.freeze({ skipDayRules: false }),
});

// Anonim használati statisztika (Umami, docs/analitika-specifikacio.md): webhely-azonosító környezetenként.
// Kiadáskor a PROD_UMAMI_WEBSITE_ID és DEV_UMAMI_WEBSITE_ID változókból. A dev sosem kapja az élesét:
// ha nincs saját változója, a dev nem küld statisztikát (helyben és a tesztekben sem).
export const ANALYTICS = Object.freeze({
  prod: Object.freeze({ websiteId: 'dfd4a0f2-55e0-4d83-9667-91c91302ca27' }),
  dev: Object.freeze({ websiteId: '' }),
});
