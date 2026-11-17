# Olvasóka – Mondatok

2026-11-17 · mangyal · Elfogadva, megvalósítva (a fő spec 2.16-os változatának alapja, [specifikacio.md](specifikacio.md))

## Cél

Az újabb listákban már mondatok is vannak (`a ló húz.`, `a fi-ú fát hoz.`, `a há-zi-kó pi-ci.`,
`a ke-fe pu-ha.`). A program ma ezeket szónak tekinti, és több helyen rosszul kezeli. A cél, hogy a
mondat önálló tételtípus legyen, a Meixner-módszer szerint a szavak és szótagok után, külön blokkban
gyakorolva.

**Nem része:**
- Mondatok a Keresd meg! játékban (M-9).
- Több soros megjelenítés (sortörés a mondaton belül). Lásd D-3.
- A Haladás csoportjainak, küszöbeinek és felületének átalakítása (csak a tempó típusa változik, M-10).

## Mai viselkedés (mért, dev @ 1.4.5)

| Tétel | `typeOf` | `groupOf` | Takarás szótagjai (`cover.syllables`) |
|---|---|---|---|
| `a ló húz.` | szó | W:3 | `a ló húz.` (1 egység, nem takarható) |
| `a fi-ú fát hoz.` | szó | W:5 | `a fi` · `ú fát hoz.` |
| `a há-zi-kó pi-ci.` | szó | W:6 | `a há` · `zi` · `kó pi` · `ci.` |
| `a ke-fe pu-ha.` | szó | W:5 | `a ke` · `fe pu` · `ha.` |

Problémák:

1. **Csoport:** a `tokenize()` a szóközt és a pontot mássalhangzónak veszi. Az `a ló húz.` a 3 szótagú
   szavakkal (`pi-ló-ta`) kerül egy blokkba, a többi mondat az 5–6 szótagú szavakkal.
2. **Takarás:** a vonalzó szavakon át vág (`a fi` | `ú fát hoz.`), ez módszertanilag hibás.
3. **Betűméret (F-P13):** egy méret az egész körre, a legszélesebb tételhez. Egy mondat a kör minden
   betűjét és szótagját összenyomja.
4. **Hossz (F-L5, `MAXLEN = 20`):** hosszabb mondat (`a ma-ma ma-dár-ra mu-tat.`, 25 karakter)
   figyelmeztetéssel kimarad.
5. **Haladás:** a mondat a szavak típusonkénti tempójába számít. A szavak közti szünet miatt egy mondat
   szótagonként lassabb, ezért a mondatok indokolatlanul „Még gyakorolni kell” felé csúsznak, és
   közben a szavak tempóját is lassítják.
6. **Keresd meg!:** a mondatok a szavakkal azonos csoportba kerülnek, széles kártyákon, a szóközt is
   betűként mérő távolsággal.

## Fogalmak

| Fogalom | Jelentés |
|---|---|
| Mondat | Olyan tétel, amelyben (levágás után) szóköz van. |
| Szó (a mondatban) | A mondat szóközzel elválasztott része, az írásjellel együtt (`húz.`). |
| Írásjel | `.` `?` `!` `,` a szó végén. Látszik, de nem betű. |

## Követelmények

### Felismerés és csoport

- **M-1** Egy tétel mondat, ha szóközt tartalmaz. A listán semmit nem kell jelölni. (Szülőnek egy
  mondatban: „Ami több szóból áll, az mondat.”)
- **M-2** A `typeOf()` új értéke: `mondat` (a `betű`, `szótag`, `szó` mellett). Mondatra a szóközök és
  az írásjelek nem kerülnek a `tokenize()` kimenetébe; a szótagszám továbbra is a magánhangzók száma.
- **M-3** Új, 7. csoport a szavak után: **Mondat**, szószámonként külön csoport (`M:<szószám>`),
  növekvő szószámmal. Felolvasásban a blokkok sorrendje így: … szavak (szótagszám szerint), mondatok
  (szószám szerint). A súlyozás és a szomszédsági szabály változatlanul érvényes.
- **M-4** A kis- és nagybetű, az írásjel és a kötőjel a tétel része (`a ló húz.` ≠ `A ló húz.` ≠
  `a ló húz`), mint eddig.

### Lista

- **M-5** A hosszkorlát mondatra 40 karakter, minden másra marad 20. A figyelmeztetés szövege a
  vonatkozó korlátot mutatja.
- **M-6** A mondat elején és végén levágjuk a szóközt; a mondaton belüli többszörös szóköz egynek számít
  (a tételkulcsban is). A nem törő szóköz (a táblázatba másolva gyakori) is szóköznek számít.
- **M-6a** A mondaton belül nem lehet vessző: a lista a vesszőnél tételt bont (F-L1), így a
  `Jaj, a ló húz.` két tétel lesz (`Jaj` és `a ló húz.`). Lásd D-6.

### Felolvasás: megjelenítés

- **M-7** Betűméret: a kör két méretet használ. Egyet a nem-mondat tételekre (a mai F-P13 szabály
  szerint, csak ezekből számolva), egyet a mondatokra (ugyanazzal a 72% / 53% szabállyal, csak a
  mondatokból számolva). Csoportosított sorrendben a méret egyszer vált, a mondatblokk elején. Kevert
  sorrendben tételenként válthat; ez elfogadott.
- **M-8** Szótag-takarás mondaton: a takarás egysége **a szó**, nem a szótag.
  - Kattintás/koppintás egy szóra: annak takarása vált.
  - `↓`: egész → csak az 1. szó → csak a 2. szó → … → csak az utolsó → egész (az F-P18 mintája).
  - A takarási terület határa a két szó közti szóköz közepe. A vonalzó a szó tintáját fedi, az
    írásjelet is.
  - A szón belüli kötőjelek látszanak, de mondatban nem takarási határok.
  - Minden más (F-P20 auto-pause, F-P21 visszaállás, F-P22 megjelenés) változatlan.

### Keresd meg!

- **M-9** Mondat nem kerül Keresd meg! feladatba (kiszűrjük a jelöltek közül, mint az 1 tételes
  csoportot). Ha a kijelölt listákban csak mondat van, a Keresd meg! nem indítható, és a gomb alatt saját
  üzenet áll: „A Keresd meg!-ben mondatok nem szerepelnek. Válassz betűt, szótagot vagy szót is.” (D-7).
  Ha mondat mellett van más tétel is, de egyik csoportban sincs legalább két különböző, a meglévő
  „legalább két különböző tétel kell” üzenet marad.

### Haladás

- **M-10** A mondat saját típusonkénti tempót kap (`mondat`), a szavakéba nem számít bele. A tétel
  sebessége továbbra is szótagonként mérődik. A besorolás szabályai és a felület szövegei nem
  változnak; a tételrészletben a típus neve „mondat”.
- **M-11** Nincs adatmigráció: a típus a tétel szövegéből számolódik, így a már gyűjtött mondatos
  olvasások az új verzióban automatikusan a mondat-tempóba kerülnek.

### Kapcsolódó tervezett funkció

- **M-12** Ha elkészül a tételtípus-szűrő (betűk, szótagok, szavak), negyedik opciója a **mondatok**.

## Elfogadási kritériumok

1. `typeOf('a ló húz.') === 'mondat'`, `groupOf('a ló húz.').key === 'M:3'`, `groupOf('a ke-fe pu-ha.').key === 'M:3'`.
2. `typeOf('pi-ló-ta') === 'szó'`, `groupOf('pi-ló-ta').key === 'W:3'` (változatlan).
3. Egy `ma`, `pi-ló-ta`, `a ló húz.`, `a há-zi-kó pi-ci.` listából csoportosított körben a mondatok a
   kör végén, a szavak után jönnek, a kevesebb szavas előbb. (A példa két mondata egyaránt 3 szavas, M:3,
   így egy blokkban, véletlen sorrendben jönnek; lásd D-8.)
4. Ugyanebben a körben a `ma` betűmérete megegyezik azzal, amit mondat nélkül kapna.
5. `a fi-ú fát hoz.` takarási egységei: `a`, `fi-ú`, `fát`, `hoz.`; `↓` négy lépésben ér végig, ötödikre
   visszaáll az egészre.
6. 21–40 karakteres mondat bekerül, 41 karakteres figyelmeztetéssel kimarad; 21 karakteres szó
   továbbra is kimarad.
7. Keresd meg! feladatban mondat nem jelenik meg.
8. A Haladás tételrészletében a mondat típusa „mondat”, és a szavak tipikus tempója a mondatok
   nélkül számolódik.
9. Egységtesztek a fentiekre a `test/` alatt; a meglévő tesztek zöldek.

## Döntések (2026-11-17, mangyal)

| # | Kérdés | Döntés |
|---|---|---|
| D-1 | Mondat-e a pont nélküli többszavas tétel (`a ló`, névelő + szó)? | Igen: minden szóközt tartalmazó tétel mondat (M-1). |
| D-2 | Takarás mondaton: szavanként egyenként, vagy balról jobbra haladó felfedés? | Szavanként egyenként (M-8). |
| D-3 | Telefon álló nézetben egy 30+ karakteres mondat kicsi lesz. Kell-e sortörés? | Most nem; ha a használatban gond, 2. fázis. |
| D-4 | Mondatok a Keresd meg!-ben? | Nem most (M-9). |
| D-5 | A tervezet többi javaslata (M-1–M-12) | Elfogadva. |
| D-6 | Vessző a mondatban (a lista vesszőnél bont) | Marad a bontás; mondaton belül nem lehet vessző (M-6a). |
| D-7 | Csak mondatos kijelölésnél a Keresd meg! üzenete | Saját üzenet (M-9). |
| D-8 | Az elfogadás 3. pontja „rövidebb előbb”, de a példa két mondata egyformán 3 szavas | Az M-3 dönt: a szószám a csoport, azonos szószámnál a blokkon belül véletlen sorrend. |
| D-9 | Mondatban a szóhatáron összeállhat-e többjegyű betű (`ház sarka` → `zs`)? | Nem: a `tokenize()` szavanként bont. |

## Nyitott pontok

Nincs.