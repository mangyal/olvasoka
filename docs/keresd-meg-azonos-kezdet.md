# Keresd meg! – azonos kezdet súlya

2026-11-10 · @mangyal · Állapot: **tervezet** (pedagógiai egyeztetés előtt)

A [rácsösszeállító heurisztika](keresd-meg-heurisztika.md) bővítése. Ez a dokumentum csak az eltérést írja le; minden, ami itt nem szerepel, változatlan.

## Probléma

A gyerek balról jobbra olvas. Ha kiolvasta egy kártya első 1–2 betűjét, és a rácsban nincs más kártya ugyanezzel a kezdettel, a feladatot már meg is oldotta. Azonos kezdetű kártyák mellett viszont tovább, sokszor a szó végéig kell olvasnia.

A mostani távolság (súlyozott Levenshtein) nem veszi figyelembe, hogy hol van az eltérés: d(`ka-pa`, `ka-pu`) = d(`ka-pa`, `pa-pa`) = 0.8, pedig a `pa-pa` már az első betűnél kiesik, a `ka-pu` csak a negyediknél. Ezért szavaknál még a legnehezebb fokozaton is átlagosan csak a kártya felét kell elolvasni.

## Cél

A nehezebb fokozatokon a rácsban legyenek **azonos kezdetű kártyák**, hogy a gyereknek tovább kelljen olvasnia. Pedagógiai mellékhatás, amit vállalunk: nehéz fokozaton a feladat nem oldható meg az első betűből történő találgatással.

**Nem része:**

- A könnyű vég (0-s fokozat) nem változik; nem kötelező, hogy minden kártya más betűvel kezdődjön.
- A kalibrálás nem változik (lásd Kalibrálás).
- A vizuálisan hasonló kezdőbetűk (b/d, m/n) nem számítanak azonos kezdetnek.
- A betű típusú horgony rácsai: egybetűs tételeknél nincs értelmezhető közös kezdet, így a változás nem hat rájuk.

## Fogalmak

| Fogalom | Jelentés |
| --- | --- |
| Közös kezdet | Két tétel betűsorozatának (tokenize) leghosszabb közös előtagja, betűben. Csak a pontos egyezés számít; a többjegyű betű egy betű (`sz` ≠ `s`, tehát `szép` és `sas` közös kezdete 0). |
| Kezdet-pontszám, M(x) | A jelölt (x) legnagyobb közös kezdete a rács bármelyik eddigi tagjával, x hosszához mérve. 0–1. |
| Olvasási mélység | Egy kártyára: hány betűt kell kiolvasni, mire a rácsban egyedi lesz, a kártya hosszához mérve. Rácsra: a kártyák átlaga. (A pszicholingvisztikában: felismerési pont.) Mérőszám, nem része a súlynak. |
| Kezdet súlya, β | Konfigurációs érték 0–1 között: mekkora arányban számít a közeli pontszámban a kezdet a hasonlósághoz képest. 0 = a mostani viselkedés. |

## Szabály

A heurisztika szabályai (forrás, típus és feltöltés, tokenizálás, távolság, keverés) változatlanok. Egyedül a közeli pontszám változik.

Kezdet-pontszám, ahol `pre` a közös kezdet hossza betűben, |x| a jelölt hossza betűben, r a rács eddigi tagjai (a horgonyt is beleértve):

```math
M(x) = \max_{r} \frac{\mathrm{pre}(x, r)}{|x|}
```

Új közeli pontszám:

```math
K'(x) = (1 - \beta) \cdot e^{-d(x, h)} + \beta \cdot M(x)
```

A súly a régi képlet, K helyett K'-vel:

```math
w(x) = \big( (1 - s) \cdot T(x) + s \cdot K'(x) \big)^{p}
```

Megjegyzések:

- M(x) a rács **minden** eddigi tagjához mér, nem csak a horgonyhoz. Így a horgonytól független azonos kezdetű csoportok is kialakulhatnak (pl. `ka-pa` horgony mellett `pa-ta`, `pa-ca`). Ez szándékos: a szülő bármelyik kártyát kimondhatja.
- M(x) minden húzás után frissül, mint a távoli pontszám minimuma. Az összes készletre (elsődleges és feltöltés) érvényes.
- A 0-s fokozaton a belső arány 0, így K' nem hat: a könnyű rácsok β-tól függetlenek.
- Egybetűs jelöltnél (|x| = 1) K' = K. A képlet szerint itt M = 0, így K' = (1 − β)·K lenne, ami a közepes fokozatokon a betűrácsokat könnyítené; ez ellentmondana annak, hogy a változás a betű horgonyú rácsokra nem hat (lásd Megvalósítási megjegyzések).

## Konfiguráció

Új kulcs a `parok.json` `racs` objektumában:

| Kulcs | Jelentés | Használat |
| --- | --- | --- |
| `kezdet_suly` | β, a kezdet súlya a közeli pontszámban | Szám 0 és 1 között. **Opcionális; hiányzó kulcs = 0**, vagyis a mostani viselkedés. Hibás érték (nem szám, tartományon kívül) esetén a deploy megáll. |

A kulcs opcionális, így a meglévő `test/fixtures/parok.json` és a régi konfigurációk módosítás nélkül érvényesek maradnak.

Kezdőérték: a dev környezetben **0.5**, élesben **0**, amíg a pedagógiai egyeztetés le nem zárul.

## Kalibrálás

A kalibrálás módszere és mutatója (a rács tételeinek átlagos távolsága a horgonytól) **nem változik**. A deploy-kalibrálás a `parok.json`-ból olvasott β-val építi a rácsokat, így a görbe automatikusan a β-hoz igazodik.

Következmény: a csúszka az átlagos távolságban egyenletesen nehezedik; az olvasási mélység a fokozattal nő, de lépcsői nem garantáltan egyenlők. Ezt elfogadjuk.

## Várt hatás (prototípus-mérés)

A mérés a repóbeli `lists.txt`-n (124 egyedi tétel: 18 betű, 56 szótag, 50 szó) készült, 6 kártyával, horgonyonként 20 ráccsal. A görbe a horgonyok felén lett kalibrálva, a mérés a másik felén futott.

| Fokozat | Szó: mélység β = 0 | Szó: mélység β = 0.5 | Szótag: mélység β = 0 | Szótag: mélység β = 0.5 | Közeli pár a horgonnyal (d ≤ 0.5) / rács, β = 0 → 0.5 |
| --- | --- | --- | --- | --- | --- |
| 0 | 35% | 35% | 54% | 54% | 0.00 → 0.00 |
| 0.25 | 37% | 43% | 64% | 78% | 0.16 → 0.10 |
| 0.5 | 41% | 53% | 70% | 91% | 0.41 → 0.29 |
| 0.75 | 45% | 63% | 74% | 96% | 0.65 → 0.50 |
| 1 | 51% | 70% | 77% | 99% | 0.87 → 0.66 |

β = 0.8 mellett a szavak mélysége nem nő tovább (69% a legnehezebb fokozaton), a hasonló betűpárok viszont tovább ritkulnak; ezért a javasolt érték 0.5.

Példák a legnehezebb fokozaton, azonos véletlenmaggal:

| Horgony | β = 0 | β = 0.5 |
| --- | --- | --- |
| ka-pa | ka-pa · ma-ma · ka-ta · ka-pu · pa-pa · a-pa | ka-pa · pa-pa · ka-pu · ka-ta · pa-ta · pa-ca |
| ma-ci | ma-ci · ma-ma · ma-ki · ma-mi · mi-si · fo-ci | ma-ci · ma-ma · ma-mi · ma-ki · mi-ki · mi-si |
| pi-pa | pi-pa · li-la · pi-pi · pá-pa · pa-pa · si-ma | pi-pa · pa-pa · pi-pi · pa-ca · pi-ci · pá-pa |

## Elfogadási kritériumok és tesztvektorok

**Visszafelé kompatibilitás:**

- `kezdet_suly` nélkül, illetve 0 értékkel azonos seed mellett a rácsok pontosan megegyeznek a mostaniakkal.
- A 0-s fokozat rácsai β-tól függetlenek (azonos seed → azonos rács).
- A meglévő tesztek változtatás nélkül zöldek.

**Konfiguráció:**

- `kezdet_suly`: -0.1, 1.5, `"0.5"` → validációs hiba, a deploy megáll.
- Hiányzó `kezdet_suly` → érvényes, β = 0.

**Determinisztikus tesztvektorok:**

| Bemenet | Elvárt |
| --- | --- |
| pre(`ka-pa`, `ka-pu`) | 3 |
| pre(`ka-pa`, `pa-pa`) | 0 |
| pre(`szép`, `sas`) | 0 |
| pre(`sza`, `szi`) | 1 |
| M(`ka-pu`), rács: {`ka-pa`} | 0.75 |
| M(`ma`), rács: {`mi`} | 0.5 |
| M(`pa-ta`), rács: {`ka-pa`, `pa-pa`} | 0.5 |
| M(`b`), rács: {`d`} | 0 |

**Statisztikai tesztek (rögzített seed, a fixture-listán, N = 8, β = 0.5, a fixture-listán kalibrált görbével):**

- Szó horgonynál az olvasási mélység szigorúan monoton nő a fokozattal.
- A legnehezebb fokozaton a szavak olvasási mélysége legalább 10 százalékponttal nagyobb, mint β = 0 mellett.
- A meglévő elfogadási feltételek (átlagos távolság monoton, 0-s fokozaton legfeljebb 0.1 közeli pár, lépcsők ±0.05) β = 0.5 mellett is teljesülnek.

## Ismert korlátok és kockázatok

- **A lista tartalma szab határt.** Azonos első szótagú szóból kevés van (legnagyobb csoport: `ma-ma`, `ma-ci`, `ma-ki`, `ma-mi`), így 6 kártyából jellemzően legfeljebb 4 kezdődik ugyanúgy.
- **Szótagoknál telítődik.** β = 0.5 mellett a 0.5-ös fokozattól szinte minden szótagrács azonos mássalhangzóval kezdődik (ma · mi · mó · me); a feladat ilyenkor főleg a magánhangzó megkülönböztetése.
- **Kevesebb hasonló betűpár a horgonnyal.** A legnehezebb fokozaton rácsonként 0.87-ről 0.66-ra csökken a horgonnyal hasonló (d ≤ 0.5) kártyák száma. A rács **összes** párját nézve a közeli párok száma viszont nő (lásd Megvalósítási megjegyzések): a b/d, m/n típusú (eltérő kezdetű) párok ritkulnak, a rövid/hosszú magánhangzós azonos kezdetű párok (`ma`/`má`) szaporodnak.

## Nyitott kérdések (pedagógiai egyeztetésre)

1. A nehéz szótagfeladat a kezdetről (azonos mássalhangzó, eltérő magánhangzó) vagy a hasonló betűkről szóljon? Ha mindkettő fontos: legyen-e külön β szótagra és szóra?
2. Megfelelő-e a β = 0.5, vagy a hasonló betűpárok ritkulása miatt kisebb érték kell?
3. Mikor kerüljön élesbe a nem nulla β?

## Kiadás

1. Implementáció és tesztek a dev ágon; a dev `parok.json`-ban `kezdet_suly: 0.5`.
2. Kipróbálás a dev környezetben, pedagógiai egyeztetés.
3. Döntés β-ról; élesítés a `parok.json` módosításával, kódváltozás nélkül.
## Megvalósítási megjegyzések

2026-11-10, az implementáció (`js/core/grid.js`, tesztek: `test/kezdet.test.js`) során.

- **Betű horgony.** A Szabály képlete szerint egybetűs jelöltnél M = 0, így K' = (1 − β)·K; ez a közepes fokozatokon gyengíti a horgonyhoz kötést, és a betűrácsok könnyebbek lennének (fixture-lista, N = 6, 0.5-ös fokozat: átlagos távolság 0.84 → 0.92). A „Nem része” pont szerint a változás a betűrácsokra nem hat, ezért egybetűs jelöltnél K' = K. Teszt: betű horgonynál a rács minden fokozaton β-tól független.
- **Közeli párok.** A prototípus-mérés utolsó oszlopa a horgonnyal közeli kártyákat számolja. A rács összes párján (a heurisztika közeli pár mutatója, `closePairs`) a lists.txt-n, N = 6 mellett:

  | Fokozat | Összes közeli pár, β = 0 → 0.5 | Ebből eltérő kezdetű (b/d, m/n típus), β = 0 → 0.5 |
  | --- | --- | --- |
  | 0 | 0.01 → 0.01 | 0.01 → 0.01 |
  | 0.25 | 0.17 → 0.13 | 0.13 → 0.05 |
  | 0.5 | 0.52 → 0.40 | 0.32 → 0.09 |
  | 0.75 | 0.85 → 0.96 | 0.48 → 0.20 |
  | 1 | 1.34 → 1.76 | 0.72 → 0.39 |

  A vizuálisan hasonló kezdőbetűk (b/d, m/n) tehát kb. a felükre ritkulnak; ez a 2. nyitott kérdéshez fontos.
- **Olvasási mélység** (`readingDepth`): kártyánként min(|x|, 1 + max_r pre(x, r)) / |x|, a rácsra átlag. Az implementációval visszamérve a Várt hatás táblázat mélységei ±1 százalékponton belül egyeznek.
- **Lépcsők β = 0.5 mellett.** A fixture-listán (N = 8) a lépcsők eltérése az átlagtól legfeljebb 0.048, a ±0.05-os határon belül, de szorosan (β = 0 mellett 0.036).
