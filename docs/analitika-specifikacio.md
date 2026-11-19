# Olvasóka: anonim használati statisztika (Umami)

Verzió: 1.2 · 2026. november 18.

## 1. Cél

A fejlesztő lássa, hogyan használják a programot (hány kör, melyik játék, milyen listák és beállítások), regisztráció, süti és hozzájárulás kérése nélkül. A statisztika platformja az Umami Cloud.

## 2. Alapelvek

- A gyerekről, a tételekről és a haladásról **semmi** nem megy ki. A Haladás adatai továbbra is csak a szülő eszközén vannak.
- A cím `#hash` része nem kerül a statisztikába (`data-exclude-hash`), mert a Haladás nézet tételkulcsokat tesz bele (`#haladas/tetel/<tétel>`). A `?keresés` rész sem (`data-exclude-search`).
- A statisztika nem akaszthatja meg a programot: betöltési hiba, reklámblokkoló vagy offline használat esetén csendben kimarad. Ami a szkript betöltése előtt történik, elvész.
- Éles és dev külön Umami webhely. A dev sosem kapja az éles azonosítóját; ha nincs saját, nem küld semmit. Helyi futtatáskor és a tesztekben nincs statisztika.

## 3. Események

Az oldalmegtekintést az Umami magától rögzíti. Ezen felül:

| Esemény | Mikor | Adatok |
|---|---|---|
| `round-start` | kör indul | `game` (`read` / `find`), `round` (a kör sorszáma az oldal betöltése óta), `lists` (a kijelölt listák nevei ` \| `-vel, vagy `(összes lista)`), `listCount`; Felolvasás: `count`, `flashMs`, `mixed`; Keresd meg!: `cards` (ténylegesen mutatott), `tasks`, `level` |
| `round-end` | kör vége vagy kilépés közben | `game`, `round`, `completed` (`false`: kilépett a kör közben) |
| `reward-pick` | a gyerek jutalomjátékot választ | `reward` (`lufi` / `panda`), `round` |
| `tour-end` | az Első lépések bemutató vége (csak ha a „Mutasd meg”-gel vagy a Súgóból elindult) | `result` (`done` / `skipped`) |
| `welcome-choice` | döntés az üdvözlő ablakban (első indítás, a bemutató előtt) | `choice` (`tour`: „Mutasd meg”, `skip`: „Kihagyom, kezdjük” vagy bezárás), `via` (`button` / `close`: Esc vagy a háttérre kattintás) |
| `progress-open` | a Haladás nézet megnyílik | nincs |
| `first-round` | a készüléken legelőször induló kör, a `round-start` előtt (docs/kartyacsomagok-specifikacio.md, 7.) | `sec` (egész másodperc az oldal betöltésétől az Indításig), `firstVisit` (ez az oldalbetöltés volt a készüléken az első), `welcome` (`tour` / `skip` / `none`: ebben a betöltésben nem jelent meg), `tour` (`done` / `skipped` / `none`, ebben a betöltésben), `game` (`read` / `find`) |

A `first-round` két helyi jelzője a `<storageKey>_elsokor` kulcsban van (`seen`: az első betöltés ideje, `sent`: elment). Ha a készüléken már van Olvasóka adat (beállítás vagy haladás), amikor a jelzők még nincsenek, a `sent` küldés nélkül igazra áll. Tárolás nélkül nincs esemény. Elemzés: a `firstVisit: true` esetek mediánja; a 30 percnél hosszabbak a „később visszatért” csoport.

Bővítés: új esemény a `js/main.js`-ben a `stats.track(név, adatok)` hívással. Az adat csak szám, logikai érték vagy szöveg lehet (a szöveg legfeljebb 500 karakter, a `js/data/analytics.js` vágja). A `test/analytics.test.js` felsorolja a megengedett eseményneveket: új esemény esetén ott is bővíteni kell, és ellenőrizni, hogy tétel nem kerül bele.

## 4. Beállítás

- `js/core/config.js` `ANALYTICS`: az éles azonosító alapértéke a repóban (nem titkos, a böngészőben úgyis látszik); a dev alapértéke üres.
- Kiadáskor a `PROD_UMAMI_WEBSITE_ID` és `DEV_UMAMI_WEBSITE_ID` repository variable felülírja (`.github/scripts/write-sheet-config.mjs`). Hibás formátum vagy azonos éles/dev azonosító esetén a kiadás megáll.

## 5. Tájékoztatás

A Súgó ablak (`#dlgHelp`) **Adatvédelem** része, a telepítési sor alatt. A szöveg szó szerint:

> A program névtelen használati statisztikát küld, például hogy hány kört játszotok, melyik játékkal, melyik csomagokból, és mennyi idő után indul az első kör. Sütit nem használ, regisztráció nincs. A gyerekről, a tételekről és a haladásról semmi nem hagyja el ezt a készüléket.

- A „személyes adat” kifejezés szándékosan nem szerepel: az IP-cím és a böngésző típusa technikailag eljut az Umamihoz, akkor is, ha azt nem tárolja.
- A szöveg akkor is megjelenik, ha az adott környezetben nincs statisztika (helyi futtatás, beállítatlan dev).
- Nincs süti-banner és nincs hozzájárulás kérése. Landing oldal és GYIK még nincs, a Súgó az egyetlen hely.
- Ismert korlát: a `round-start` a listák **nevét** küldi. A nevet a szülő adja a táblázatban; ha a gyerek nevét írja bele (pl. „Dani gyakorló”), az kimegy. A szöveg ennek ellenére marad (2026. november 17-i döntés).
