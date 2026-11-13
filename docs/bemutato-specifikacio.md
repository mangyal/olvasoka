# Olvasóka: Első lépések (bemutató) specifikáció

Verzió: 1.1 · 2026. november 13. (1.1: a fejlesztés előtti döntések, lásd 9.)
Képernyőtervek: „Olvasóka – Első lépések (bevezető)” vászon (Windows 4 lépés, Mac eltérések, telefon 4 lépés, kihagyás utáni üzenet). A vászon cetlijei ennek a dokumentumnak a rövid kivonatai; eltérés esetén ez a dokumentum az irányadó.

## 1. Cél

Az első indításkor megjelenő súgó dialogot (`#dlgHelp`) egy rövid, 4 lépéses bemutató váltja ki. A bemutató nem nagy ablak, hanem egy kis buborék, ami nyíllal a valódi kezelőelemre mutat. A kezelőelemet kiemelés jelzi, a felület többi része elsötétül.

Alapelvek:
- Rövid, barátságos szöveg. Nincs gondolatjel, nincs kettőspont a folyó szövegben (kivétel a 2. lépés játéknevei), nincsenek sablonmondatok.
- A szülő bármikor kiléphet, és a program megjegyzi, hogy többet ne mutassa.
- Fiók és szerver nincs: minden a böngészőben tárolódik, mint eddig.

## 2. A lépések

Minden buborék felépítése (fentről lefelé):
1. Felirat (kis, nagybetűs): `Első lépések · {n}/4`
2. Cím (h2)
3. Szöveg
4. Lábléc: haladásjelző (4 pötty, az aktuális hosszabb), jobbra `Kihagyom` (szövegesgomb) és `Tovább` (elsődleges gomb). A 4. lépésen `Tovább` helyett `Kész`.

Nincs `Vissza` gomb.

### 2.1 1. lépés: listák

Célelem az aktuális elrendezés szerint: az első **látható** elem a sorból: `#listNav` (széles), `#listChecks` (álló tablet, pipálható chipek), `#listsBtn` (telefon).

Cím: **Válassz listát**

Szöveg a célelem szerint:

| Célelem | Szöveg |
|---|---|
| `#listNav`, billentyűzetes eszköz | Kattints egy listára. A játékban csak a kijelölt listák tételei jönnek elő. Többet is kijelölhetsz `{MOD}` + kattintással. |
| `#listNav`, érintéses eszköz | Koppints egy listára. A játékban csak a kijelölt listák tételei jönnek elő. |
| `#listChecks` | Pipáld be a listákat, amelyekből gyakoroltok. A játékban csak a kijelölt listák tételei jönnek elő. |
| `#listsBtn` | Koppints ide, és pipáld be a listákat. A játékban csak a kijelölt listák tételei jönnek elő. |

`{MOD}` a meglévő `MOD` érték (`admin.js`): Macen, iPhone-on, iPaden `⌘`, máshol `Ctrl`, `<kbd>`-ként megjelenítve. Billentyűzetes vs érintéses: ugyanaz a feltétel, mint a meglévő `.only-keys` / `.only-touch` osztályoké.

### 2.2 2. lépés: játék

Célelem: `#modeTabs`

Cím: **Válassz játékot**

Szöveg (három sor, sortöréssel; a játéknevek félkövérek):

> **Felolvasás**: a gyerek felolvassa a felvillanó tételt, te pedig ellenőrzöd.
> **Keresd meg!**: te mondasz egy tételt, ő megkeresi.
> Alatta beállíthatod a körök számát.

Ha a Keresd meg! fül inaktív (`#findSoon` látszik), a második sor akkor is marad.

### 2.3 3. lépés: haladás

Célelem: `#progressBtn`

Cím: **Itt látod a haladást**

Szöveg:

> Az Olvasóka megjegyzi, mit olvasott a gyerek, és megmutatja, mi megy már és mit érdemes még gyakorolni. Egy tételről akkor tud mondani valamit, ha legalább 3 különböző napon olvasta.

A „3 különböző nap” a `haladas.json` aktuális küszöbéből (`allapot.min_nap`) jöjjön, ne legyen beégetve. A teszteléshez való napszabály-kapcsoló (`DEV_PROGRESS_SKIP_DAY_RULES`) ezt nem írja át: a buborék mindig a beállított értéket mondja.

### 2.4 4. lépés: indítás

Célelem: `#startBtn`

Cím: **Kezdődhet a közös olvasás**

Szöveg:
- billentyűzetes: Üljetek le együtt, és nyomd meg az Indítás gombot. A kör végén jutalomjáték vár a gyerekre.
- érintéses: Üljetek le együtt, és koppints az Indítás gombra. A kör végén jutalomjáték vár a gyerekre.

A buborékban nincs gyorsbillentyű. A panel saját „`{MOD}` + Enter indít” sora változatlan marad.

## 3. Megjelenés és elhelyezés

### 3.1 Kiemelés

A vászon a kiemelést egyetlen `box-shadow`-val rajzolja. A valódi felületen ez nem elég, mert a `#modeTabs` és a `#startBtn` a görgethető `.panel-scroll` / `.panel` belsejében van, és a nagy árnyékot a görgető konténer levágja. Ezért a kiemelés két külön, `position: fixed` réteg a `body` alatt:

1. **Sötétítés** (`.tour-scrim`): teljes képernyős, `background: rgba(30,42,50,.42)`, a célelem helyén lyukkal (`clip-path: path(evenodd, …)`, lekerekített téglalap, a célelem téglalapja minden irányban 6 px-szel nagyobb). A sötétített rész elnyeli a kattintást, a lyukon át a célelem kattintható.
2. **Gyűrű** (`.tour-ring`): a lyuk körüli keret, `box-shadow: 0 0 0 4px var(--field), 0 0 0 7px var(--accent)`, `pointer-events: none`. Opcionálisan lassú pulzálás; `prefers-reduced-motion: reduce` esetén nincs.

A sötétítésre kattintás semmit nem csinál, nem zárja be a bemutatót.

### 3.2 Buborék

- Szélesség: 320 px; 600 px alatti ablakszélességnél teljes szélesség, 16 px margóval.
- Háttér `--field`, lekerekítés 12 px, árnyék `0 10px 30px rgba(30,42,50,.28)`, 14 px-es nyíl a célelem felé.
- Elsődleges oldal:

| Lépés | Széles | Telefon |
|---|---|---|
| 1 | jobbra a célelemtől | alatta |
| 2 | balra | felette |
| 3 | alatta | alatta |
| 4 | balra | felette |

- Ha az elsődleges oldalon nem fér el, a szemközti oldalra fordul, ha ott sem, akkor alá vagy fölé. A buborék mindig az ablakon belül marad, a nyíl a célelem közepére mutat (legalább 20 px-re a buborék szélétől).
- Helyét a célelem `getBoundingClientRect()`-je alapján JS számolja. Újraszámol átméretezéskor, görgetéskor, elforgatáskor és a célelem méretváltozásakor (`ResizeObserver`).
- Ha átméretezéskor az elrendezés vált (pl. a `#listNav` eltűnik és a `#listsBtn` jelenik meg), a lépés célelemét újra kell keresni a 2.1 sorrendje szerint, és a szöveget is ahhoz igazítani.
- Lépésváltáskor a célelem `scrollIntoView({ block: 'nearest' })`.
- Minden gomb legalább 44 px magas.

## 4. Működés

### 4.1 Mikor indul magától

Induláskor, ha mind igaz:
- nincs tárolt `tour` állapot (5.);
- a régi `hideHelp` nem `true` (aki eddig kikapcsolta a súgót, annak nem jelenik meg);
- nem a Haladás nézettel nyílt az app (`#haladas…` cím);
- az ablak legalább 320 × 256 px (a „túl kicsi képernyő” határa). Ha kisebb, a program vár, és ha egy átméretezés után belefér, akkor indul;
- a listák betöltődtek (első `admin.render()` listákkal), vagy 3 másodperc eltelt.

Az eddigi induló `openHelp()` hívás megszűnik.

### 4.2 Lépkedés és interakció

- `Tovább`: következő lépés. Asztalin a `→` is léptet, a `←` vissza, de csak ha a fókusz a buborékban van. A célelemen (pl. a játékfüleken) a nyilak a saját jelentésüket tartják. Az utolsó lépésen a `→` nem fejezi be a bemutatót.
- A kiemelt célelem a bemutató közben is használható: lehet listát kijelölni, játékot váltani.
- Ha a célelem valamit megnyit (a `#listsBtn` alsó lapja, a `#progressBtn` Haladás nézete), a buborék és a sötétítés elrejtőzik. Visszatéréskor a bemutató ugyanazon a lépésen folytatódik. A Haladás nézetből visszatérve a következő lépésre lép.
- Ha a játék elindul (Indítás gomb vagy `{MOD}`+Enter), bármelyik lépésben, az a `Kész` gombbal egyenértékű, és a játék indul.

### 4.3 Kilépés és megjegyzés

| Esemény | Tárolás | Utána |
|---|---|---|
| `Kihagyom` | `how: "skipped"` | egyszeri üzenet (4.4) |
| `Esc` (ha nincs nyitva alsó lap vagy dialog) | mint a `Kihagyom` | mint a `Kihagyom` |
| `Kész` | `how: "done"` | semmi |
| játék indítása a bemutató közben | `how: "done"` | indul a játék |
| a lap bezárása vagy újratöltése a bemutató közben | semmi | legközelebb újra az 1. lépéssel indul |

Tárolás után a bemutató többet nem jelenik meg magától.

### 4.4 Kihagyás utáni üzenet

Csak a `Kihagyom` (vagy `Esc`) után, egyszer. A `#helpBtn` alá mutató sötét buborék (`role="status"`):

> A bemutatót a Súgóban bármikor újra elindíthatod.

Gomb: `Rendben`. 8 másodperc után magától eltűnik. Telefonon a Súgó ikon alá kerül, teljes szélességben.

### 4.5 Újraindítás a Súgóból

A `#dlgHelp` változásai:
- a „Ne jelenjen meg újra” jelölő (`#helpHide`) és a hozzá tartozó kód megszűnik;
- új másodlagos gomb a meglévő `Kezdjük` mellett, attól balra: `Bemutató újra`. Bezárja a súgót, és az 1. lépéstől indítja a bemutatót. A végén a tárolt állapot felülíródik.

## 5. Tárolás

A meglévő helyi állapotba (`normalizeState`, `settings.js`) új mező kerül. A mező csak hozzáadás, ezért a `v` marad 4, ahogy a `find` esetén.

```js
tour: null | { v: 1, how: 'done' | 'skipped', at: number /* Date.now() */ }
```

- `normalizeState`: érvénytelen érték esetén `null`.
- Ha `tour.v` kisebb, mint a kódban lévő `TOUR_VERSION`, a bemutató újra megjelenik. Csak lényeges tartalmi változáskor emeljük.
- A `hideHelp` mező marad, csak olvassuk (4.1), a felületről már nem lehet beállítani.
- Ha a `store.write()` hamisat ad (pl. privát ablak), a program a `sessionStorage`-be írja `olvasoka_tour` kulccsal (devben `olvasoka-dev_tour`, mint minden tárolt név, `js/core/env.js`), hogy a munkameneten belül ne jöjjön újra.

## 6. Akadálymentesség

- A buborék `role="dialog"`, `aria-labelledby` a címre. Lépésváltáskor a fókusz a címre kerül (`tabindex="-1"`).
- A Tab a buborék gombjai és a célelem között körbejár.
- A haladásjelző `role="img"`, `aria-label="2. lépés a 4-ből"`.
- Szöveg és háttér kontrasztja legalább 4,5:1.
- A meglévő „túl kicsi képernyő” lapnál (320 × 256 alatt) a bemutató nem látszik.

## 7. Tesztek

Unit (`node --test`):
- `normalizeState`: a `tour` mező megmarad, ha érvényes; `null` lesz, ha érvénytelen; a régi állapot `tour` nélkül betölthető.
- A megjelenítési feltétel (4.1) tiszta függvényként: `tour`, `hideHelp`, route és `TOUR_VERSION` kombinációi.
- A célelem kiválasztása (2.1) elrendezésenként.

E2E:
- Üres tárolóval az 1. lépés jelenik meg, a buborék az ablakon belül van, a célelem kattintható.
- `Kihagyom` után újratöltve nem jelenik meg; az üzenet egyszer látszik.
- `Kész` után újratöltve nem jelenik meg; üzenet nincs.
- A bemutató közbeni újratöltés után újra az 1. lépés jön.
- `hideHelp: true` állapottal nem jelenik meg.
- `#haladas` címmel indítva nem jelenik meg.
- A Súgó `Bemutató újra` gombja az 1. lépést nyitja.
- Elrendezések: 1280×800, 820×1180 (álló tablet), 390×844, 844×390. Minden lépésben a buborék teljesen látszik, és nem takarja a célelemet.
- `Esc` alsó lap nyitott állapotában csak az alsó lapot zárja be.

## 8. Nem része

- Animált átmenetek a lépések között (a pozícióváltás 200 ms-os áttűnése elég).
- Külön bemutató a Keresd meg! játékhoz, a Haladás nézethez vagy játék közbeni vezérléshez. Ezekre a meglévő „Így játsszátok” gomb és a Haladás nézet saját magyarázatai szolgálnak.
- Használati statisztika a bemutatóról.

## 9. Döntések a fejlesztés előtt (2026-11-13)

1. Az automatikus indítás alsó határa a meglévő 320 × 256 minimum (eredetileg 320 × 400), így fekvő telefonon (pl. 844 × 390) is elindul.
2. A 3. lépés napszáma a `haladas.json` beállított értéke, a napszabály-kapcsolótól függetlenül.
3. A nyilak csak akkor léptetnek, ha a fókusz a buborékban van (4.2).
4. Megvalósítás: `js/core/tour.js` (tiszta logika, `test/tour.test.js`), `js/ui/tour.js`, `css/tour.css`; E2E: `e2e/app.mjs` és `e2e/layout.mjs` „bemutató” tesztjei.

