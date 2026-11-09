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
