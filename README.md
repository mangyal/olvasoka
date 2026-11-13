# Olvasóka

Hangtalan betű-, szótag- és szógyakorló kisiskolásoknak. A szülő kiválaszt egy listát, a program
egyesével felvillantja a tételeket, a gyerek hangosan kimondja őket, a kör végén a gyerek jutalomjátékot választ: lufipukkasztás vagy panda-ugrálás.
Nincs hang, nincs pontozás; a kiejtést a mellette ülő szülő figyeli.

**Élő oldal:** https://mangyal.github.io/olvasoka/
**Fejlesztői változat:** https://mangyal.github.io/olvasoka/dev/ (piros „DEV” címke a fejlécben; a
`+N` utótag a még ki nem adott commitok száma, pl. `DEV · v1.0.1+5`)

## Listák szerkesztése

A listák egy [Google táblázatban](https://docs.google.com/spreadsheets/d/1j87SRjs4ZvyEJmModdTuNwPdyzgkwzx34yarw3qdCEM/edit) vannak:
minden oszlop egy lista, az első sorban a lista neve, alatta cellánként a tételek. A táblázat
„Közzététel az interneten” CSV-ként van publikálva; a változás kb. 5 percen belül látszik az oldalon
(**Frissítés** gomb vagy újratöltés).

Ha a táblázat nem érhető el, a program a repó [`lists.txt`](lists.txt) fájlját használja tartalékként, és a
listák alatt halványan jelzi: „Tartaléklisták láthatók (a táblázat nem elérhető)”. A `lists.txt` nem frissül magától a táblázatból.

### A `lists.txt` (tartalék)

A GitHubon a fájlt megnyitva a ceruza ikonnal szerkeszthető (mobilon is), majd *Commit changes*.

```
# Magánhangzók
a
á
e

# Szótagok
ma
me
ke-fe
```

- A `#`-tel kezdődő sor egy új lista neve, alatta soronként egy tétel. Az üres sorok nem számítanak.
- A tételek pontosan úgy jelennek meg, ahogy le vannak írva (kis- és nagybetű is).
- Egy tétel legfeljebb 20 karakter. A vessző elválaszt: az `a, á, e` sor három tétel.
- A listanevek egyediek (kis-/nagybetűtől függetlenül).

- Ha egy tétel egy listán belül többször szerepel (pl. egy oldal végi ismétlő sor), a program csak
  egyszer veszi be.

**Ha valami nem stimmel** (túl hosszú tétel, sor a lista neve előtt, üres vagy ismétlődő listanév),
a commit után a GitHub *Actions* fülén piros ✕ jelenik meg, és a GitHub e-mailben elküldi, melyik
sorral van baj. Az oldal közben működik: a hibás részt kihagyja, a többit használja.

A teszt néhány konkrét tételt is keres a listákban (`test/core.test.js`, `SAMPLES`). Ha egy listát
szándékosan átnevezel vagy kiveszel belőle egy ilyen tételt, ott is írd át.

## Használat

| Billentyű | Gyakorlás közben |
|---|---|
| `Space` | következő tétel (az utolsón: jutalom) |
| `←` / `→` | előző / következő tétel |
| `↓` | szótag-takarás léptetése (kötőjeles tételnél) |
| `P` | szünet / folytatás |
| `←` / `→`, `Space` | a kör végén: jutalom kiemelése, majd indítása (`Enter` és `↑` is indít) |
| `Esc` | vissza a szülői felületre |
| `Ctrl`+`Enter` | kör indítása a szülői felületen |

A beállítások a szülői felület jobb oldali paneljén vannak (tableten és telefonon a listák alatt), az
Indítás gomb mindig látszik. A gyakorlás billentyűit a panel **Így játsszátok** gombja mutatja.
A **Keresd meg!** fülön a program 4, 6 vagy 8 kártyát mutat a kijelölt listákból (telefonon legfeljebb 6).
Te kimondod az egyiket, a gyerek rábök; a program csak megjelöli, amire bökött, nem értékel. A nehézség
1–5 (1 = nagyon eltérő, 5 = nagyon hasonló elemek), alapból 1, utána a legutóbbi marad.
Billentyűk: `Space`/`→` következő feladat, `←` előző, kattintás jelöl, `Esc` kilépés. Érintőképernyőn (pl. fekvő iPad) az
oldalsávban koppintással több lista is kijelölhető; telefonon a listák egy lenyíló sorból nyíló lapon
választhatók.

A felvillanási idő 0–25 mp; **0 = kézi léptetés**, a tétel addig látszik, amíg nem lépsz tovább. A tételek közti szünet 0, 0,5, 1, 2 vagy 3 mp.
Kötőjellel tagolt tételnél (`ka-ta`) a szótagok egyenként letakarhatók: kattints vagy koppints a
szótagra, vagy nyomd a `↓`-t (egész → csak az 1. szótag → … → csak az utolsó → egész). Az első takarás
megállítja az időt; a következő tételnél minden szótag újra látszik.

A beállítások az adott böngészőben maradnak meg.

**Haladás** (fejléc): négy csoport (Megy, Még bizonytalan, Még gyakorolni kell, Kevés adat), mindegyik egy
mondattal elmagyarázva; csoportonként az összes tétel, és tételenként a fő ok. Csak a meglévő mozdulatokból
számol (lapozás, visszalépés, takarás, megállítás és ezek ideje), a tempót a gyerek saját tempójához méri; a
helyességet nem tudja, azt a szülő hallja. Az adatok csak az adott eszközön vannak, fiók nélkül. A küszöbök a
[`haladas.json`](haladas.json)-ban (a szülő nem látja); teszteléshez a `DEV_PROGRESS_SKIP_DAY_RULES` változó
kikapcsolja a napszámon alapuló szabályt (`min_nap`, lásd lent). Részletek: [`docs/haladas-specifikacio.md`](docs/haladas-specifikacio.md).

## Felépítés

Statikus oldal, build lépés és függőségek nélkül; natív ES modulok.

```
index.html          markup
lists.txt           a listák
parok.json          Keresd meg!: hasonló betűpárok, költségek, nehézségi görbe (docs/keresd-meg-heurisztika.md)
haladas.json        Haladás: a szűrés és a csoportok küszöbei (docs/haladas-specifikacio.md, 7.)
css/                tokens · szülői felület · gyakorló és jutalom nézet
js/version.js       a program verziója (fejlécben látszik, kiadáskor léptetni)
js/core/            tiszta, DOM-mentes logika (Node-ban tesztelve)
  sequence.js         sorozat-generátor („húzózsák”)
  round.js            a gyakorlókör állapotgépe (időzítés, szünet, navigáció)
  items.js            tételek tisztítása
  lists.js            a lists.txt és a táblázat értelmezése
  csv.js              CSV-olvasó
  source.js           forrás: táblázat, tartalékként lists.txt
  selection.js        listák kijelölése
  drift.js            a jutalom lufijainak mozgása
  hop.js              a panda-ugrálás pályája és mozgása
  choose.js           a jutalomválasztó lépés-logikája (a gyerek választ)
  rewards.js          a jutalomjátékok; ?jutalom=lufi|panda rögzít, a választó kimarad
  cover.js            szótag-takarás
  settings.js         beállítások és a helyi tárolás sémája
  progress.js         a gyakorlás haladásjelzője (pöttysor / sáv)
  grid.js             Keresd meg!: rácsösszeállító heurisztika és kalibrálás
  find.js             Keresd meg!: feladatok és a kör lépés-logikája
  env.js              éles/dev környezet, tárolási nevek
  config.js           a táblázat címei és a Haladás napszabály-kapcsolója környezetenként (kiadáskor repository variable-ökből)
  practice-log.js     Haladás: a Felolvasás kör naplóeseményei a reducer átmeneteiből
  exposures.js        Haladás: mellényomás-szűrés, megjelenések, napi tételösszesítők
  list-identity.js    Haladás: listaazonosság (átnevezett lista felismerése)
  mastery.js          Haladás: csoportok és okok, szokásos tempó, a nézetek adatai
  haladas-texts.js    Haladás: a felület szövegei egy helyen
  haladas-config.js   Haladás: a haladas.json ellenőrzése és alapértékei
js/data/            localStorage, a Haladás naplója (progress-log.js) és a listák letöltése
js/ui/              szülői felület, gyakorlás, Keresd meg!, Haladás nézet, jutalomválasztó, jutalmak (lufi, panda, konfetti)
js/font.js          betűtípus-kapu (Arial, ha nincs: Arimo)
js/main.js          indítás
test/               node --test
```

## Specifikáció

A követelmények, döntések és elfogadási kritériumok: [`docs/specifikacio.md`](docs/specifikacio.md).
A Haladás nézet: [`docs/haladas-specifikacio.md`](docs/haladas-specifikacio.md).

## Fejlesztés

```sh
node --test                 # tesztek (Node 20+)
npm run layout              # elrendezés-teszt headless Chrome-mal (e2e/layout.mjs; előbb: npm i --no-save playwright && npx playwright install chromium)
python3 -m http.server      # helyi futtatás: http://localhost:8000
```

Az oldal csak HTTP-n keresztül fut: fájlként (dupla kattintással) megnyitva a böngésző nem tölti be
a modulokat és a `lists.txt`-t. A tesztek minden pushnál GitHub Actionsben is lefutnak.

## Környezetek és kiadás

| Ág | Cím | Szerep |
|---|---|---|
| `main` | https://mangyal.github.io/olvasoka/ | éles, ezt használják |
| `dev` | https://mangyal.github.io/olvasoka/dev/ | fejlesztői, itt kell kipróbálni |

1. **Fejlesztés:** új ág a `dev`-ből (`feat/…`, `fix/…`), PR a `dev`-be. Összevonás után kb. 1 perc
   múlva a dev oldalon látszik.
2. **Kipróbálás** a dev oldalon, tableten/telefonon is. A dev telepítve „Olvasóka DEV” néven, sötét
   ikonnal jelenik meg, a beállításai az élestől függetlenek.
3. **Kiadás:** Actions → *Kiadás előkészítése* → *Run workflow* (ág: `main`), lépés: `patch` (javítás),
   `minor` (új funkció) vagy `major`. A futás összefoglalójában két link van, kitöltött címmel:
   - **Verzió-PR** (`release/vX.Y.Z` → `dev`): megnyitod, ha zöld, összevonod.
   - **Kiadási PR** (`dev` → `main`): miután a dev oldal az új verziót mutatja, megnyitod, kipipálod a
     listát, és **merge committal** vonod össze (nem squash). A workflow kiteszi az élest és `vX.Y.Z`
     taget készít.

   A PR-okat azért nyitod meg te, mert a `dev`-re és a `main`-re csak olyan változás kerülhet, amelyen
   lefutottak a kötelező ellenőrzések, és ezek a bot által nyitott PR-on nem futnak.
4. **Visszavonás:** a `main`-en a kiadás merge commitjának *Revert*-je; kb. 1 perc múlva a régi változat fut.
5. **Sürgős javítás:** `hotfix/…` ág a `main`-ből, PR a `main`-be (verzióléptetéssel).

**Dev szinkron:** a *Dev szinkron (main → dev)* workflow figyeli, hogy a `main` változásai (hotfix,
infra) bekerültek-e a `dev`-be. Ha nem, issue-t nyit egy linkkel a `main` → `dev` PR-hoz; azt megnyitod
és összevonod, az issue pedig magától lezárul. Sima kiadás után nincs teendő.

**Füstteszt kiadás után:** minden kiadás után az *Kiadás (GitHub Pages)* workflow `smoke` lépése headless
Chrome-mal megnyitja az élő oldalt (`e2e/smoke.mjs`), és ellenőrzi: a `/` éles (nincs DEV címke), a
`/dev` és a `/dev/` a dev oldalra visz (DEV címke, telepített éles service workerrel is), mindkettőn
van verziószám, és a dev verziója ≥ az élesé. Ha piros: a GitHub e-mailt küld; ha a dev régebbi,
nézd meg a *Dev szinkron* issue-t. Helyben: `npm i --no-save playwright && npx playwright install chromium && npm run smoke`.

A main-be csak `dev`, `hotfix/*` vagy `infra/*` ágból mehet PR (`.github/workflows/release-check.yml`).
Az `infra/*` a workflow-k és a kiadási eszközök módosítására való: mivel egy push a saját ágának
`deploy.yml`-jét futtatja, ezek a változtatások közvetlenül a `main`-be menjenek (a `dev`-be a
*Dev szinkron* issue linkjével kerül át).

**A listák táblázata környezetenként** GitHub repository variable-ökből jön: Settings → Secrets and
variables → Actions → *Variables* fül → *New repository variable*.

| Változó | Mire való | Ha nincs beállítva |
|---|---|---|
| `PROD_SHEET_CSV_URL` | az éles táblázat „Közzététel az interneten” CSV címe (`…/pub?output=csv`) | a `js/core/config.js` alapértéke |
| `PROD_SHEET_EDIT_URL` | az éles táblázat szerkesztő címe („Listák szerkesztése” link) | a `js/core/config.js` alapértéke |
| `DEV_SHEET_CSV_URL` | a dev táblázat CSV címe | az éles cím |
| `DEV_SHEET_EDIT_URL` | a dev táblázat szerkesztő címe | az éles cím |
| `DEV_PROGRESS_SKIP_DAY_RULES` | `true`: a Haladás nézet napszabálya (`min_nap`) kimarad (teszteléshez: napvárás nélkül besorol, de a `min_alkalom` alkalomszám ilyenkor is kell) | kikapcsolva |
| `PROD_PROGRESS_SKIP_DAY_RULES` | ugyanez élesben; ha `true`, a kiadás figyelmeztetést ír | kikapcsolva |

A változó módosítása magától nem ad ki új változatot: utána Actions → *Kiadás (GitHub Pages)* →
*Run workflow* (ág: `main`). A futás naplójában az *A táblázat címei* lépés kiírja, melyik cím honnan
jött. A címek nem titkosak (a böngészőben úgyis látszanak), ezért változó, nem secret. Helyi
futtatáskor és a tesztekben a `js/core/config.js` alapértékei érvényesek.

### GitHub beállítások

- Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
- Settings → Branches (vagy Rules → Rulesets) a `main`-re: PR kötelező, a *Kiadás ellenőrzése* és a
  *Tesztek* ellenőrzésnek zöldnek kell lennie, közvetlen push tiltva.
