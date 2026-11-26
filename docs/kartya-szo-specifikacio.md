# „tétel” → „kártya” a felületen

Állapot: elfogadva (2026-11-26). Alap: `dev` 76e1fed.

## Cél

A szülői felületen és a gyerek nézetben a „tétel” szó helyett mindenhol „kártya” áll. A csomagok neve már „kártyacsomag”, a középső oszlop címe „Kártyák” lesz (külön spec: összecsukható Megjelenés), így a szülő egy szót lát ugyanarra a dologra.

## Hatókör

- **KE-1** Csak a felhasználónak látható és a képernyőolvasónak szóló szövegek változnak (HTML szöveg, `aria-label`, js-ből írt szövegek).
- **KE-2** Nem változik: a kód (változó- és függvénynevek, kommentek), a `docs/` specifikációk, a Google táblázat szerkezete, a haladásnapló és a localStorage kulcsai és mezői, az Umami eseményei és mezői. A meglévő haladásadat érintetlen marad; régi verzióra visszaállva is olvasható.
- **KE-3** Fejlesztői hibaüzenet marad „tétel”: `js/core/haladas-config.js` 90. sor (konfiguráció-ellenőrzés, a szülő nem látja).
- **KE-4** Helyes magyar ragozás kötelező. Szóvégre ragasztott toldalék („${…}nél”) nem maradhat: a „kártya” tő a toldalék előtt „kártyá-” lesz (kártyát, kártyából, kártyáról, kártyánál).
- **KE-5** A felületi szövegekben továbbra sincs gondolatjel.

## Haladás: a `TERM` szókészlet (`js/core/haladas-texts.js`)

- **KE-6** Új alakok:
  `TERM = { nom: 'kártya', acc: 'kártyát', from: 'kártyából', about: 'kártyáról', at: 'kártyánál', pl: 'kártyák', plAt: 'kártyáknál' }`
- **KE-7** A ragasztott toldalékok cseréje:
  - 19. sor: `egy-egy ${TERM.nom}nél` → `egy-egy ${TERM.at}` → „egy-egy kártyánál”
  - 29. sor: `A hosszabb ${TERM.pl}nél` → `A hosszabb ${TERM.plAt}` → „A hosszabb kártyáknál”
  - 44. sor: `ennél a ${TERM.nom}nél` → `ennél a ${TERM.at}` → „ennél a kártyánál”
- **KE-8** A többi `TERM` használat így helyes marad, nem kell hozzányúlni („Egy kártyáról csak akkor…”, „Eddig 12 kártyát olvasott a 20-ból.”, „Megy: 5 kártya”, „Még nincs ilyen kártya.”, „Az első kártyák legkorábban…”).
- **KE-9** A 2. sori komment („A „tétel” szó ideiglenes…”) frissüljön: a szó most „kártya”, és új toldalékos alak csak `TERM` mezőként kerülhet be.

## Szövegcserék

### Kártyák oszlop, csomagválasztó (`index.html`, `js/ui/admin.js`, `js/core/type-filter.js`)

| Hol | Régi | Új |
|---|---|---|
| index.html 147 (`#previewH`) | Ezekkel játszotok | Kártyák |
| index.html 97, 152 | A játékban csak ezek a tételek jöhetnek elő, semmi más(.:) | A játékban csak ezek a kártyák jöhetnek elő, semmi más(.:) |
| index.html 158 | A játékban csak a bekapcsolt típusok tételei jöhetnek elő. | A játékban csak a bekapcsolt típusok kártyái jöhetnek elő. |
| index.html 98, 161 (aria) | A kijelölt csomagok tételei | A kijelölt csomagok kártyái |
| index.html 155 (aria) | Tételszűrő | Típusszűrő |
| admin.js 219, 230, 243, 271 | `${n} tétel` | `${n} kártya` |
| type-filter.js 87 | `… tétel · ${packs} csomag` | `… kártya · ${packs} csomag` |
| admin.js 310 | Mind a ${n} tétel megtekintése | Mind a ${n} kártya megtekintése |
| admin.js 146 | Egyik csomagban sincs tétel. / A kijelölt csomagokban nincs tétel. / A csomagban nincs tétel. | Egyik csomagban sincs kártya. / A kijelölt csomagokban nincs kártya. / A csomagban nincs kártya. |
| admin.js 276 | A szűrő minden tételt kizárt. Kapcsolj be legalább egy típust. | A szűrő minden kártyát kizárt. Kapcsolj be legalább egy típust. |
| admin.js 366 | Nincs tétel a szűrőben | Nincs kártya a szűrőben |

### Játékok oszlop (`index.html`, `js/ui/admin.js`, `js/core/settings.js`)

| Hol | Régi | Új |
|---|---|---|
| index.html 195, admin.js 23 | …felolvassa a felvillanó tételt… | …felolvassa a felvillanó kártyát… |
| index.html 206 | 0 = te lépteted a tételeket | 0 = te lépteted a kártyákat |
| index.html 209 | Szünet a tételek között (mp) | Szünet a kártyák között (mp) |
| index.html 213 | Tételek a körben | Kártyák a körben |
| index.html 215, 217 (aria) | Kevesebb tétel / Több tétel | Kevesebb kártya / Több kártya |
| settings.js 120 | `${s.count} tétel` | `${s.count} kártya` |
| admin.js 155 | A Keresd meg!-hez legalább két különböző tétel kell. | A Keresd meg!-hez legalább két különböző kártya kell. |

A Keresd meg! „Kártyák a képernyőn” és „Te kimondasz egy kártyát…” szövege már így jó, nem változik.

### Így játsszátok (`index.html`)

| Hol | Régi | Új |
|---|---|---|
| 275 | …nem kell minden tételt értékelned. | …nem kell minden kártyát értékelned. |
| 277, 278 | következő tétel / előző tétel | következő kártya / előző kártya |
| 284 | Kötőjeles tételnél a szótagra koppintva letakarod. | Kötőjeles szónál a szótagra koppintva letakarod. |

### Súgó (`index.html`)

| Hol | Régi | Új |
|---|---|---|
| 385 | …felolvassa a felvillanó tételt. Keresd meg!: te mondasz egy tételt… | …felolvassa a felvillanó kártyát. Keresd meg!: te mondasz egy kártyát… |
| 390 | …hány tétel legyen… | …hány kártya legyen… |
| 392 | …a következő tétel… / …a következő tételhez… / Kötőjeles tételnél… | …a következő kártya… / …a következő kártyához… / Kötőjeles szónál… |
| 397 | A gyerekről, a tételekről és a haladásról… | A gyerekről, a kártyákról és a haladásról… |

### Bemutató (`js/core/tour.js`)

| Hol | Régi | Új |
|---|---|---|
| 55 | A játékban csak ezek tételei jöhetnek elő. | A játékban csak ezek kártyái jöhetnek elő. |
| 56, 57, 58 | …mely tételek jöhetnek elő a játékban. | …mely kártyák jöhetnek elő a játékban. |
| 62 | …felolvassa a felvillanó tételt, te pedig ellenőrzöd. | …felolvassa a felvillanó kártyát, te pedig ellenőrzöd. |
| 63 | …te mondasz egy tételt, ő megkeresi. | …te mondasz egy kártyát, ő megkeresi. |
| 69 | Egy tételről akkor tud mondani valamit… | Egy kártyáról akkor tud mondani valamit… |

### Egyéb

| Hol | Régi | Új |
|---|---|---|
| progress.js 12 (képernyőolvasó: „3. tétel a 20-ból”) | `noun = 'tétel'` | `noun = 'kártya'` → „3. kártya a 20-ból” |
| lists.js 165 (táblázat hibaüzenet) | …alá a tételek, oszloponként. | …alá a kártyák, oszloponként. |

## Tesztek

- **KE-10** A szövegre építő unit- és e2e-tesztek frissüljenek (pl. `test/settings.test.js`, `test/progress.test.js`, `test/tour.test.js`, a haladás-tesztek, `e2e/app.mjs` 144, `e2e/layout.mjs` 873–881, 1652, 1678). A tesztadatok és a tesztnevek belső „tétel” szava maradhat.
- **KE-11** Új teszt: a `haladas-texts.js` egyik kimenetében sem szerepel „kártyanél”, „kártyaból”, „kártyat”, „kártyaról”, „kártyanál” (ragasztott, rossz tő).
- **KE-12** Új teszt: a kész szülői felület látható szövegében és `aria-label`-jeiben nincs „tétel” (e2e, a Súgóval, a bemutatóval és a Haladással együtt).

## Kiadás

Egy PR a `dev` ágra. Az adatformátum nem változik, ezért a visszaállításhoz nem kell semmi külön.