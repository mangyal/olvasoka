# Kártyák oszlop: egységes fejlécek, összecsukható Megjelenés

Állapot: elfogadva, megvalósítva (2026-11-26). Alap: `dev` 1d6ed57 (a spec írásakor 76e1fed). Artboardok: https://claude.ai/artifact/4NR5zyGyZULtRT3uj9LTP3
Kapcsolódik: `docs/megjelenes-specifikacio.md` (L-1–L-6, D-8, D-9 módosul), `docs/kartya-szo-specifikacio.md` („tétel” → „kártya”; a `#previewH` szövege ott már „Kártyák” lett).

## Cél

1. A három oszlopnak egyforma fejléce legyen: **Kártyacsomagok → Kártyák → Játékok**. Ma a középső oszlop a Megjelenés kártyával kezdődik, a címe („Ezekkel játszotok”) középen áll.
2. A Megjelenés asztalon se foglaljon sok helyet: minden nézetben egy összecsukott sor, mint ma telefonon.

## Fejlécek

- **FK-1** A középső oszlop címe „Kártyák” (a mai `#previewH`, „Ezekkel játszotok” helyett). Ugyanaz az `h2.col-title`, mint a két szélső oszlopé (asztalon 18/26 px, 600, `--ink`).
- **FK-2** Asztalon a „Kártyák” a középső oszlop legelső eleme, a Megjelenés fölött. A három oszlopcím azonos magasságban áll (mindhárom oszlop 20 px felső belső margóval kezd). A D-8 szerinti 15 px-es eltérés megszűnik.
- **FK-3** A számláló a cím sorában marad, jobbra, alapvonalra igazítva, változatlan formában (SZR-8): `90 kártya · 3 csomag`, szűréssel `34 / 90 kártya · 3 csomag`.
- **FK-4** Keskeny nézetben (álló tablet, telefon álló és fekvő) a „Kártyák” cím + számláló a Megjelenés sora **fölé** kerül (ma alatta van). Sorrend: Kártyacsomagok (chipek vagy csomaggomb) → Kártyák + számláló → Megjelenés sor → szűrő chipek → előnézet → Játékok.
- **FK-5** A Megjelenés nem oszlopcím többé: a kártyán belüli `h2#lookH` megszűnik, a `section.look` neve a sor feliratából jön (`aria-labelledby` a sor „Megjelenés” feliratára).
- **FK-6** Új sorrend mindenhol: Kártyacsomagok → Kártyák (cím, számláló) → Megjelenés → „csak ezek” mondat és szűrő → előnézet → Játékok. Ez felváltja a megjelenes-specifikacio „Elrendezés” bevezető mondatát. A mondat és a szűrő egymáshoz képesti sorrendje keskeny nézetben a mai marad (D-13).

## Megjelenés: összecsukható sor minden nézetben

- **ÖM-1** A Megjelenés minden szélességben a mai telefonos összecsukott sor (L-4): felül kis felirat „Megjelenés” (12 px, `--ink-2`), alatta az összegzés (600): „Színezés: hangok szerint, nagybetű-jelölés: körvonalas” (a négy változat: D-18; `lookSummary`); jobbra a mini minta (L-4 szabálya: a jelölt kártya, ha nincs, az első szó), majd ▾.
- **ÖM-2** A sor a kártya teteje: `--field` háttér, `--line` keret, `--r-card` sarok, legalább 52 px magas, a teljes sor egy `button` (`aria-expanded`, `aria-controls="lookBody"`). Asztalon is ez a kártya-keret marad, nem egy keret nélküli sor.
- **ÖM-3** Alapállapot: összecsukva. Minden betöltéskor összecsukva indul, a nyitott állapotot nem tároljuk (mint ma telefonon). A Megjelenés beállításai továbbra is tárolódnak.
- **ÖM-4** Kattintásra / koppintásra / Enter vagy Space billentyűre helyben kinyílik, újabb kattintásra becsukódik. A fókusz a soron marad. Animáció nincs (vagy legfeljebb a mai `--d-fast`).
- **ÖM-5** Kinyitva a sor a kártya fejléce lesz: a „Megjelenés” felirat 15 px / 600 / `--ink` (telefonon 16 px, mint ma), az összegzés és a mini minta eltűnik, a ▾ megfordul (▴). Alatta a mai vezérlők, nyitott állapotban változatlanul:
  - asztalon a mai L-1 rács (140 px felirat + 260 px vezérlő), keskeny középső oszlopban (pl. 1024 px-es ablak) a D-8 szerinti egymás alatti elrendezés;
  - álló tableten a mai L-3 elrendezés (két vezérlő egymás mellett, alattuk a Minta);
  - telefonon a mai L-4 elrendezés.
- **ÖM-6** Az összegzés és a mini minta a beállítás változásakor azonnal frissül (becsukva is, pl. ha a csomagválasztás miatt változik a mini minta).
- **ÖM-7** Ha nincs kijelölt kártya (nincs minta), a sor akkor is látszik, a mini minta helye üres (mint ma).
- **ÖM-8** Érintőképernyőn a sor legalább 44 px magas (52 px-es, tehát rendben).

## Tapadás asztalon (módosítja: L-2, D-9)

- **TA-1** A „Kártyák” cím + számláló nem tapad, a Megjelenés sem. Görgetéskor csak a „A játékban csak ezek a kártyák jöhetnek elő, semmi más.” mondat és a szűrő chipek tapadnak a lista tetejére (a mai `.play-head` sticky szabályaival).
- **TA-2** Indok: a cím és a chipek közé került a Megjelenés, a kinyitott kártyát nem lehet letapasztani. A chipek a típusonkénti darabszámot mutatják, így letapadva is látszik, mennyi kártya van.
- **TA-3** Alacsony fekvő asztali ablakban (≤ 500 px magas) nincs tapadás, mint ma.

## Megvalósítási megjegyzés

- A mai `.play-head` két részre válik: (a) címsor: `h2#previewH` „Kártyák” + `#listCount`; (b) tapadó rész: `.only-note`, `#typeFilter`, `#tfNote`.
- A `placeLook()` / `placeHead()` logika: a címsor mindig a Megjelenés előtt áll (asztalon az `edInner` elején, keskeny nézetben a csomagválasztó után), a tapadó rész mindig közvetlenül a Megjelenés után.
- A `.look-row` asztalon és tableten is látszik; a `.look-body` alapból rejtett, `.look.open` nyitja. A telefonos CSS-szabályok (L-4, L-6) általánossá válnak, a szélesség szerinti eltérés csak a nyitott tartalom rácsában marad.
- A bemutató (tour) célelemei nem változnak. Ha egy lépés a `#previewH`-ra vagy a `#look`-ra mutat, a buborék a régi helyett az új helyére kerül; szövege marad. (Megvalósításkor egyik lépés sem mutat rájuk: `sidebar` / `listChecks` / `listsBtn`, `modeTabs`, `progressBtn`, `startBtn`.)
- Megvalósítva: a címsor `div.ed-head.cards-head#cardsHead` (`h2#previewH` + `#listCount`), a tapadó rész a megmaradt `#playHead`; a `section.look` neve `aria-labelledby="lookRowL"` (a sor „Megjelenés” felirata). A `placeLook()` és `placeHead()` helyett egy `placeCards()` rendezi a hármat.

## Elfogadási tesztek

- **T-1** Asztalon (1440×900) a három oszlopcím szövege sorban „Kártyacsomagok”, „Kártyák”, „Játékok”, a tetejük legfeljebb 1 px-re van egymástól. A felületen nincs „Ezekkel játszotok” és nincs `h2` „Megjelenés”.
- **T-2** Betöltés után a Megjelenés minden nézetben (1440×900, 1024×768, 768×1024, 390×844, 844×390) össze van csukva: `#lookRow[aria-expanded=false]`, a `#lookBody` nem látszik, az összegzés és a mini minta látszik.
- **T-3** Kattintásra kinyílik, újabb kattintásra becsukódik; Enter és Space ugyanígy működik a soron.
- **T-4** Kinyitás, majd újratöltés után megint összecsukva indul, a beállítás (pl. Hangok szerint) megmarad.
- **T-5** Keskeny nézetben a sorrend: csomagválasztó < „Kártyák” cím < Megjelenés sor < szűrő chipek < előnézet (a függőleges pozíciók szerint).
- **T-6** Asztalon a lista végéig görgetve a szűrő chipek és a „csak ezek” mondat látszik a középső oszlop tetején, a „Kártyák” cím és a Megjelenés nem.
- **T-7** Becsukott állapotban a csomagválasztás változása frissíti a mini mintát (ÖM-6).
- A régi e2e-tesztek frissüljenek: `e2e/layout.mjs` 873–881 (új címsor: `['Kártyacsomagok', 'Kártyák', 'Játékok']`), 1652, 1678 (új sorrend). Az `e2e/app.mjs` 144 a kartya-szo PR-ral már „Kártyák”-ot vár.

## Döntések

- **D-10** A Megjelenés minden nézetben összecsukható, álló tableten is (eddig csak telefonon). (2026-11-26)
- **D-11** Mindig összecsukva indul, a nyitott állapot nem tárolódik. (2026-11-26)
- **D-12** Asztalon csak a „csak ezek” mondat és a szűrő chipek tapadnak; a cím és a számláló nem (TA-1). Ez felváltja a D-9 utolsó mondatát. (2026-11-26)
- **D-13** Keskeny nézetben a „csak ezek” mondatok maradnak, ahogy ma: telefonon a chipek alatt „A játékban csak ezek a kártyák jöhetnek elő, semmi más:”, majd az előnézet; álló tableten a chipek alatt „A játékban csak a bekapcsolt típusok kártyái jöhetnek elő.” (előnézet nélkül, L-3). Az FK-6 „mondat, majd szűrő” sorrendje asztalra vonatkozik. (2026-11-26)
- **D-14** Álló tableten a kinyitott sor „Megjelenés” felirata 15 px (mint asztalon); 16 px csak telefonon (álló és fekvő). (2026-11-26)
- **D-15** A nyitott állapot a nézetváltást túléli (pl. tablet elforgatása, ablak átméretezése); csak újratöltéskor csukódik (ÖM-3). (2026-11-26)
- **D-16** A mini minta: az első jelölt nagybetűs kártya, ha nincs, az első szó, ha az sincs, az első kártya (szűrés után, csomagsorrendben, nem véletlenszerűen); kártya nélkül üres. A mondatokat nem szűrjük ki (a hosszú mondat a sor 40%-ánál levágódik), ez külön döntés. (2026-11-26)
- **D-17** Telefonon a „Kártyák” cím ugyanúgy 16 px, mint a „Kártyacsomagok” (eddig az `.ed-head` szabálya miatt 18 px maradt). (2026-11-26)
- **D-18** Az összegzés szövege a beállítások neveit követi, vesszővel (a régi „Hangok szerint · Nagybetű: körvonal” helyett): „Színezés: nincs, nagybetű-jelölés: nincs”, „Színezés: hangok szerint, nagybetű-jelölés: nincs”, „Színezés: nincs, nagybetű-jelölés: körvonalas”, „Színezés: hangok szerint, nagybetű-jelölés: körvonalas”. A „nagybetű-jelölés” kötőjeles (háromtagú, hat szótagnál hosszabb összetétel). Telefonon két sorba tördelődhet (D-8). (2026-11-26)
