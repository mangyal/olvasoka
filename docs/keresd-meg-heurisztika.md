# Keresd meg! – rácsösszeállító heurisztika

2026-11-09 · @mangyal

## Cél és hatókör

A heurisztika a Keresd meg! módhoz állít össze egy N kártyás rácsot a kijelölt listákból, a szülő által választott nehézségi fokozat szerint. A szülő bármelyik kártyát kimondhatja, a gyerek rábök arra, amit hall.

A feature leírása (mit lát a szülő és a gyerek) a fő specben van ([specifikacio.md](specifikacio.md)); ez a dokumentum csak a rács összeállításának szabályait rögzíti.

**Nem része a heurisztikának:**

- A program nem tudja, melyik kártya a helyes, és nem értékel.
- Nincs AI-hívás és nincs hálózati függés: a számítás az eszközön, determinisztikus szabályokkal fut.
- A UI (csúszka megjelenése, elhelyezése) a UX döntése.

## Fogalmak

| Fogalom | Jelentés |
| --- | --- |
| Tétel | Egy cella a listában (pl. `ma`, `ka-pa`). Normalizálva: kisbetű, kötőjel nélkül; ismétlődés egyszer számít. |
| Betű | Magyar betű, a többjegyűek egynek számítanak: `dzs`, `cs`, `dz`, `gy`, `ly`, `ny`, `sz`, `ty`, `zs`. |
| Típus | **betű** = 1 betű; **szótag** = 1 magánhangzó, több betű; **szó** = legalább 2 magánhangzó. Automatikusan, a tételből számolva. |
| Horgony | A rács első, véletlenül húzott tétele; a nehéz oldal ehhez méri a hasonlóságot. |
| Rács | A horgony és N−1 további tétel, véletlen sorrendben. |
| Távolság | Súlyozott szerkesztési távolság két tétel betűsorozata között (lásd Szabályok). |
| Fokozat | Nehézség 0 és 1 között, 5 lépésben: 0 · 0.25 · 0.5 · 0.75 · 1. A 0 a legkönnyebb. |

## Bemenet és kimenet

| | Elem | Leírás |
| --- | --- | --- |
| Be | Kijelölt listák | A szülő által kijelölt lista-oszlopok összes tétele. |
| Be | Kártyaszám (N) | 4, 6 vagy 8. |
| Be | Fokozat | 0–1, alapértelmezetten 0. |
| Be | Konfiguráció | `parok.json` a repóban (párok, költségek, görbe). |
| Ki | Rács | N különböző tétel, mind a kijelölt listákból, véletlen sorrendben. |

Ha a kijelölt listákban összesen N-nél kevesebb egyedi tétel van, a rács az összes elérhető tételből áll.

## Szabályok

A rács tételenként épül: horgony, majd N−1 súlyozott véletlen húzás visszatevés nélkül.

1. **Forrás.** Minden tétel, a horgonyt is beleértve, csak a kijelölt listákból jöhet. A horgonyt a program húzza, egyenletes véletlennel. Egy körön belül két egymást követő rács horgonya nem lehet azonos (ha legalább két egyedi tétel van): az előző horgony ilyenkor kimarad a húzásból.
2. **Típus és feltöltés.** Elsődleges készlet: a horgonnyal azonos típusú tételek; szónál a szótagszám is egyezik. Ha ez elfogy, a feltöltés más típusból jön, ebben a sorrendben:
   - betű → szótag → szó
   - szótag → betű → szó
   - szó → szótag → betű

   Szónál az eltérő szótagszámú szavak a szótagok előtt jönnek: azonos szótagszámú szó → más szótagszámú szó → szótag → betű.
3. **Tokenizálás.** Normalizálás után mohó leghosszabb egyezés: előbb `dzs`, majd a kétjegyűek, végül az egyes karakterek.
4. **Távolság.** Súlyozott Levenshtein a betűsorozatokon. Beszúrás, törlés, csere költsége a konfigurációból jön (lásd Konfiguráció); ha egy pár több kategóriában is szerepel, a legkisebb költség érvényes.
5. **Súly.** Minden jelölt két 0–1 közötti pontszámot kap, ezeket a fokozat keveri (képletek lent).
6. **Kalibrált fokozat.** A fokozat nem közvetlenül keveri a pontszámokat: előbb a kiegyenlítő görbén át belső aránnyá alakul (darabonként lineáris, töréspontok a fokozatoknál).
7. **Keverés.** A kész rács sorrendje egyenletes véletlen.

Távoli pontszám — mennyire tér el a jelölt (x) a rács minden eddigi tagjától (r):

```math
T(x) = 1 - e^{-\min_{r} d(x, r)}
```

Közeli pontszám — mennyire hasonlít a horgonyhoz (h); a horgonyhoz kötés akadályozza, hogy a nehéz rács elsodródjon:

```math
K(x) = e^{-d(x, h)}
```

Súly a belső arány (s) és az élesítés (p, a `csuszka_elesites` kulcs) mellett:

```math
w(x) = \big( (1 - s) \cdot T(x) + s \cdot K(x) \big)^{p}
```

## Konfiguráció

A repóbeli `parok.json` az egyetlen forrás minden párra, költségre és rácsparaméterre. Ez a fejezet csak azt írja le, mit jelentenek a kulcsok és hogyan kell használni őket; az aktuális értékek a fájlban vannak.

### Csereköltségek

- `kategoriak`: kategóriák listája; mindegyiknek van `nev`, `koltseg` és `csoportok` mezője. Kisebb költség = hasonlóbb pár.
- Csoport: kötőjellel elválasztott betűk; a csoport minden tagja minden taggal párt alkot. Például `b-d-p` → b–d, b–p, d–p. Többjegyű betű is lehet tag (`dzs-cs`).
- Ha egy pár több kategóriában is szerepel, a legkisebb költség érvényes.
- A párok a listától függetlenül definiáltak; egy pár akkor hat, amikor mindkét betűje előfordul a kijelölt listákban.
- Konfigurálatlan csere: `egyeb_maganhangzo`, `egyeb_massalhangzo`, `magan_massal_csere`. Beszúrás és törlés: `beszuras_torles`.
- Egy kategória költsége legyen kisebb a konfigurálatlan cserék költségénél, különben a pár nem számít hasonlónak.

### Rácsparaméterek (`racs`)

| Kulcs | Jelentés | Használat |
| --- | --- | --- |
| `csuszka_szintek` | A választható fokozatok, 0 és 1 között, növekvő sorrendben | A UI ezekből kínál választást |
| `csuszka_alapertelmezett` | A kezdő fokozat | A `csuszka_szintek` egyik eleme |
| `csuszka_elesites` | A súlyképlet p kitevője; nagyobb = markánsabb végletek | Nem fokozat; csak a heurisztika hangolásához |
| `csuszka_gorbe` | A kiegyenlítő görbe töréspontjai: egy közös lista, vagy kártyaszámonként külön lista, az N értékével kulcsolva | Annyi elem, ahány fokozat; 0-val kezdődik, 1-gyel végződik, monoton nő. A deploy-kalibrálás írja (kártyaszámonként), kézzel nem szerkesztendő; a repóbeli érték csak a helyi futtatás alapértéke. Hiányzó kártyaszámnál a legközelebbi N görbéje érvényes |

### Betöltés

- Hibás konfiguráció (nem olvasható fájl, hiányzó kulcs, rossz csoport vagy görbe) esetén a deploy megáll; az app nem fut hibás konfigurációval.
- A prototípus korábbi kulcsai (`nehez_elesseg`, `nehez_disztraktor_esely`, `konnyu_min_tav_betunkent`, `konnyu_min_tav_also_hatar`) elavultak, a végleges fájlból kimaradnak.

## Kalibrálás deploy-kor

A kiegyenlítő görbe deploy-kor készül a teljes listára, hogy a fokozatok közel egyenlő lépésekben nehezedjenek. A görbe kártyaszámonként (N = 4, 6, 8) a kiadott `parok.json` `racs.csuszka_gorbe` kulcsába kerül; a repóba nem.

A teljes lista a környezet Google táblázatából jön (ugyanaz a cím, amit az app is olvas). Ha a táblázat nem érhető el, nem CSV-t ad vagy nincs benne lista, a repó `lists.txt`-je a tartalék, figyelmeztetéssel; a deploy ilyenkor nem áll meg. A szkript: `.github/scripts/calibrate.mjs`.

1. **Mutató:** a rács tételeinek átlagos távolsága a horgonytól (kisebb = nehezebb).
2. **Mintavétel:** a teljes lista minden tétele egyszer horgony (ez pontosan típusarányos); horgonyonként 20 rács, kártyaszámonként külön.
3. **Mérés:** a mutató a belső arány 21 pontján (0, 0.05 … 1).
4. **Lépcsők:** a két végponti érték közti tartományt a fokozatok számának megfelelő egyenlő részre osztjuk.
5. **Visszakeresés:** lineáris interpolációval megkeressük, milyen belső arány adja az egyes lépcsőket; ezek a töréspontok.

A prototípusban, a mostani listán (165 egyedi tétel) a lépcsők a kalibrálásból kihagyott ellenőrző horgonyokon is egyenletesek voltak (0.26–0.31 egység).

Szűk kijelölésnél a teljes listára készült görbe egyenetlenebb lépcsőket ad, de a sorrend mindig helyes. Ezt elfogadtuk.

## Elfogadási kritériumok és tesztvektorok

A tesztek egy rögzített teszt-konfigurációval (fixture) és teszt-listával futnak, nem az éles `parok.json` fájllal; így a párok hangolása nem töri el őket. A fixture: `test/fixtures/parok.json` (a prototípus konfigurációja, az elavult kulcsokkal együtt) és `test/fixtures/lista.txt` (a repó `lists.txt`-jének 2026-11-10-i pillanatképe, 124 egyedi tétel; a prototípus 165 tételes listája nem maradt meg).

**Szabálytesztek (minden rácsra igaz):**

- A rács minden tétele, a horgonyt is beleértve, szerepel a kijelölt listákban.
- A rács N különböző tételből áll, ha a kijelölt listákban legalább N egyedi tétel van.
- Ha az azonos típusú készletben legalább N tétel van, a rácsban nincs idegen típusú tétel.
- Egy kis készlet (pl. 3 szótag és 6 betű) mellett, N = 4-nél és szótag horgonnyal a rács 3 szótagból és 1 betűből áll.
- A rács sorrendje fokozattól függetlenül véletlen.

**Determinisztikus tesztvektorok (unit teszt):**

| Bemenet | Elvárt |
| --- | --- |
| tokenize(`szép`) | sz · é · p |
| tokenize(`dzsungel`) | dzs · u · n · g · e · l |
| tokenize(`Ka-Pa`) | k · a · p · a |
| típus(`sz`) · típus(`al`) · típus(`ka-pa`) | betű · szótag · szó |
| d(`pá`, `pa`) | 0.3 |
| d(`pá`, `bá`) · d(`fa`, `va`) · d(`b`, `d`) · d(`i`, `l`) | 0.5 |
| d(`ka-pa`, `ka-pu`) · d(`ka-pa`, `pa-pa`) | 0.8 |
| d(`pá`, `ta`) | 1.1 |
| d(`ma`, `al`) | 2.0 |

**Statisztikai tesztek (rögzített seed, a fixture-listán, N = 8):**

Az alábbi táblázat a prototípus mérése a 165 tételes listán, tájékoztatásul. A fixture-listán (124 tétel, a prototípus görbéjével) a mért értékek: 1.92 · 1.67 · 1.51 · 1.31 · 1.06, illetve 0.03 · 0.29 · 0.72 · 1.13 · 1.80 közeli pár rácsonként. A tesztek az elfogadási feltételeket ellenőrzik, nem a pontos számokat; a lépcsők egyenletességét a fixture-listán kalibrált görbével, a kalibrálásból kihagyott (más seedű) horgonyokon.

| Fokozat | Átl. távolság a horgonytól | Közeli párok (≤ 0.5) / rács |
| --- | --- | --- |
| 0 | 1.87 | 0.0 |
| 0.25 | 1.61 | 0.3 |
| 0.5 | 1.31 | 0.9 |
| 0.75 | 1.06 | 1.6 |
| 1 | 0.79 | 2.6 |

Elfogadás: mindkét mutató szigorúan monoton a fokozattal; a 0-s fokozaton átlagosan legfeljebb 0.1 közeli pár van rácsonként; a lépcsők eltérése egymástól legfeljebb ±0.05.

## Ismert korlátok

- A csúszka akkor ad érdemi különbséget, ha az azonos típusú készlet legalább a kártyaszám 3–4-szerese. 10 betűnél N = 8 mellett a fokozat gyakorlatilag hatástalan.
- Kis készletnél a csúszka állítható marad, se letiltás, se figyelmeztetés nincs; a rács a lehető legközelebb kerül a kért nehézséghez.
- Ha a horgonynak nincs közeli párja a listában (pl. `pó` mellett nincs `po`, `bó`), a nehéz rács a 0.8-as sávból épül.
- A mutató helyettesítő: a valódi nehézséget az app nem méri, mert nem tudja a helyes választ.
