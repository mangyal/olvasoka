# Olvasóka – Megjelenés (betűszínezés, nagybetűk jelölése) és tételszűrő

2026-11-25 · mangyal · Elfogadva (2. változat) (alap: dev @ 1.4.11, [specifikacio.md](specifikacio.md))

Tervek (artboardok): https://claude.ai/artifact/9Ptm8RqSQAKqUotM5L8x5s
(asztali, tablet álló, telefon álló összecsukva és nyitva, telefon fekvő, Felolvasás, Keresd meg!)

## Cél

1. **Betűk színezése:** a betűk a Meixner-féle színkódolással jelenjenek meg (magánhangzó, zöngés, zöngétlen).
2. **Nagybetűk jelölése:** a listában megjelölt betű (pl. a `{m}i-ki` m-je) körvonalasan jelenjen meg. Ez egyben a tanítói kérés (kitöltés nélküli első betű) megoldása.
3. **Tételszűrő:** a szülő kiválaszthatja, mely tételtípusok (betűk, szótagok, szavak, mondatok, és ezek altípusai) jöhetnek elő a kijelölt csomagokból.

**Nem része:**
- Valódi nagybetűs megjelenítés a jelölt betű helyén (a `{m}i-ki` sosem `Mi-ki`).
- Színes (nem körvonalas) nagybetűjelölés. Elvetve.
- A Haladás nézet tételeinek színezése (ott minden marad, ahogy ma van).
- A szótagtakarás (vonalzó) változása.

## Fogalmak

| Fogalom | Jelentés |
|---|---|
| Megjelenés | A két megjelenési beállítás együtt: Betűk színezése és Nagybetűk jelölése. Mindkét játékra érvényes. |
| Jelölt betű | A listában kapcsos zárójelbe tett betű: `{m}i-ki`. Azt jelenti: itt nagybetű állna. |
| Tételtípus | A meglévő csoportok (`groups.js`) családjai: V, C, VC, CV, egyéb szótag (S:*), szó (W:*), mondat (M:*). |
| Minta | Kis tételsor a Megjelenés blokkban, a beállítás hatását mutatja. |

## Követelmények

### Jelölés a listában (adat)

- **NB-1** Jelölés: kapcsos zárójel egy betű körül: `{m}i-ki`, `{e}-mi`. Többjegyű betűnél a teljes betű kerül a zárójelbe: `{sz}é-ke`, `{gy}ö-mölcs`, `{dzs}…`.
- **NB-2** Egy tételben több jelölt betű is lehet (pl. mondatban: `{l}a-li {m}a-mi.`).
- **NB-3** Érvénytelen jelölés (le nem zárt `{`, magányos `}`, üres `{}`, egymásba ágyazás, a zárójelben nem egy betű vagy többjegyű betű áll, a többjegyű betű fele (`{s}zó`), nagybetű a zárójelben (`{M}i-ki`), a jelölt betű nem szó elején áll (`mi-{k}i`, kötőjel után sem)): a tétel a többi hibás tételhez hasonlóan, figyelmeztetéssel kimarad. A figyelmeztetés a szülői felület tetején, a többi csomaghiba között jelenik meg: „A 3. sor: a „{mi}-ki” jelölése hibás (a kapcsos zárójelbe egy szó első betűje kerülhet, kisbetűvel), kimaradt.” (táblázatnál „A táblázat B3 cellája: …”).
- **NB-4** A jelölés csak megjelenítési információ, nem változtat a tételen: `{m}i-ki` és `mi-ki` **ugyanaz a tétel** (egy tétel az előnézetben, a számlálóban, a súlyozásban, a naplóban és a Haladásban). A `Mi-ki` továbbra is külön tétel (kis/nagybetű-elv).
- **NB-5** A tétel kulcsa a zárójelek nélküli alak (`{m}i-ki` → `mi-ki`). Betöltéskor a zárójeleket le kell választani, és a jelölést a tételhez kell rendelni, különben a meglévő kód a `{` és `}` jelet betűnek venné (rossz csoport, szótagszám, takarás és Keresd meg! hasonlóság).
- **NB-5a** Ha a kijelölt csomagokban ugyanaz a tétel jelölve és jelöletlenül is szerepel, mindenhol a jelölt alak látszik (a súlyozás továbbra is az összes sort számolja).

### Megjelenés: beállítások

- **MJ-1** **Betűk színezése:** `Nincs` | `Hangok szerint`. Alapérték: `Nincs`.
- **MJ-2** **Nagybetűk jelölése:** `Nincs` | `Körvonal`. Alapérték: `Nincs`.
- **MJ-3** Mindkét beállítás globális: mindkét játékra és a szülői felület előnézetére is érvényes. A program megjegyzi őket (mint a Nehézséget), új munkamenetben az utolsó választás él.
- **MJ-4** A Keresd meg!-ben is érvényes a színezés, akkor is, ha egyes betűpárokat (b–p, d–t, g–k) könnyebb így megkülönböztetni. Ez elfogadott, a napló alapján később felülvizsgáljuk.

### Színezés szabályai

- **SZ-1** Színek (Meixner-kódolás, rögzített, nem állítható; `tokens.css`):

  | Hangcsoport | Szín | Token |
  |---|---|---|
  | magánhangzó | kék `#1E4FA3` | `--c-vowel` |
  | zöngés mássalhangzó | piros `#C62828` | `--c-voiced` |
  | zöngétlen mássalhangzó | zöld `#1B5E20` | `--c-unvoiced` |

  A piros–zöld pár a módszer része, akadálymentességi okból sem cseréljük.
- **SZ-2** Besorolás (betűnként, a többjegyű betű egy egység). A párnélküli zöngés mássalhangzók (j, l, ly, m, n, ny, r) is pirosak (pedagógus jóváhagyta):
  - magánhangzó: a á e é i í o ó ö ő u ú ü ű
  - zöngés: b d dz dzs g gy j l ly m n ny r v z zs
  - zöngétlen: c cs f h k p s sz t ty
- **SZ-3** A besorolás a `parok.json`-hoz hasonlóan egy repóbeli JSON fájlban él (`hangok.json`), hogy pedagógus kérésére kód nélkül módosítható legyen. A nem besorolt karakter (kötőjel, szóköz, írásjel, idegen betű) tintaszínű (`--ink`).
- **SZ-4** A nagybetű ugyanazt a színt kapja, mint a kisbetű párja (`Ma`: M piros, a kék).

### Nagybetűk jelölése: megjelenítés

- **NB-6** `Nincs`: a jelölt betű sima kisbetűként jelenik meg, a zárójelek nélkül (`{m}i-ki` → `mi-ki`), pontosan úgy, mint egy jelöletlen betű: színezéssel teli, a hangcsoportja színével.
- **NB-7** `Körvonal`: a jelölt betű kitöltés nélkül, csak körvonallal jelenik meg. Vonalvastagság: a betűméret 2,5%-a, legalább 0,8 px. Felolvasásban (SVG) `fill:none` + `stroke`, HTML-ben `-webkit-text-stroke` és átlátszó szín.
- **NB-8** A körvonal színe: színezés nélkül `--ink`, színezéssel a betű hangcsoportjának színe (SZ-1).

### Tételszűrő

- **SZR-1** Fő típusok, kapcsolható chipként: **Betűk**, **Szótagok**, **Szavak**, **Mondatok**. Mind a négy alapból be van kapcsolva.
- **SZR-2** Altípusok a chip ▾ gombjával nyíló listában:
  - Betűk: Magánhangzók (V), Mássalhangzók (C)
  - Szótagok: CV (pl. ma), VC (pl. am), Egyéb (S:*)
  - Szavak és Mondatok: nincs altípus, nincs ▾.
- **SZR-3** Csak az a chip és altípus látszik, amelyből a kijelölt csomagokban van tétel. Ha egy chipnek csak egy altípusa van jelen, nincs ▾.
- **SZR-4** A chip állapota: be (minden jelen lévő altípus be), részben (`Betűk · 1/2`), ki. A chipre koppintás az összes altípust egyszerre kapcsolja. A chipen a bekapcsolt tételek darabszáma látszik (különböző tételek, mint a csomagszámláló).
- **SZR-5** A szűrő mindkét játékra érvényes, a csomagválasztás után, a húzás előtt szűr. A súlyozás (ismétlések) és a csoportsorrend változatlan, csak a kiszűrt csoportok maradnak ki. A Keresd meg! a mondatokat továbbra is kihagyja.
- **SZR-6** A szűrő állapota tárolódik (mint a Megjelenés). Ha egy tárolt altípus a mostani csomagokban nincs jelen, az állapota megmarad, de nem látszik.
- **SZR-7** Ha a szűrő után nem marad tétel: az Indítás inaktív, a lista helyén ez áll: „A szűrő minden tételt kizárt. Kapcsolj be legalább egy típust.” A becslés helyén: „Nincs tétel a szűrőben”.
- **SZR-8** Számláló az „Ezekkel játszotok” fejlécben: szűrés nélkül `62 tétel · 3 csomag`, szűréssel `34 / 62 tétel · 3 csomag`. (Ragozott alak, pl. „62-ből”, nem kell.)

### Elrendezés

A meglévő töréspontok maradnak (admin.css). Sorrend minden nézetben: Kártyacsomagok → Megjelenés → Ezekkel játszotok (szűrő, előnézet) → Játékok.

- **L-1 Asztali (≥ 900 px):** a középső oszlop tetején a **Megjelenés** kártya (`--field` háttér, `--line` keret, `--r-card`), alatta az „Ezekkel játszotok”. A Megjelenés kétoszlopos rács: bal oszlop a felirat (140 px), jobb oszlop a szegmensvezérlő (260 px széles). A három felirat („Betűk színezése”, „Nagybetűk jelölése”, „Minta”) azonos stílusú (14 px, `--ink`), és alapvonalra igazodik a mellette lévő gomb- vagy mintaszöveghez.
  - Színezés bekapcsolva: a vezérlő mellett jelmagyarázat: **a** magánhangzó · **m** zöngés · **t** zöngétlen (a betűk a saját színükkel).
  - Színezés és Körvonal együtt: a Nagybetűk jelölése mellett: „Színezésnél a körvonal a betű színét kapja.”
- **L-2 Asztali előnézet:** a szűrő chipsora az „A játékban csak ezek…” mondat alatt, a lista fölött; görgetéskor a lista tetejére tapad (sticky), a számlálóval együtt. Az előnézet chipjei a Megjelenés szerint rajzolódnak.
- **L-3 Tablet álló (600–899 px):** Kártyacsomagok (chipek), alatta a Megjelenés (a két vezérlő egymás mellett, alattuk a Minta), majd „Ezekkel játszotok”: számláló, szűrő chipek (tördelve), egy mondat: „A játékban csak a bekapcsolt típusok tételei jöhetnek elő.” Tételelőnézet itt sincs, mint ma; a Megjelenést a Minta mutatja.
- **L-4 Telefon álló (≤ 600 px):** a csomaggomb alatt a Megjelenés **összecsukott sora** (a csomaggomb stílusa): felső kis felirat „Megjelenés”, alatta az összegzés: „Hangok szerint · Nagybetű: körvonal” (vagy „Nincs színezés · Nagybetű: nincs”), jobbra egy mini minta (a jelölt tétel, vagy ha nincs, az első szó) és ▾. Koppintásra helyben kinyílik (a vezérlők egymás alatt, 44 px magasak, a Minta alattuk), ▴ csukja. Alatta „Ezekkel játszotok” + számláló, a szűrő chipek egy vízszintesen görgethető sorban (44 px), majd a meglévő kétsoros előnézet.
- **L-5 Telefon álló, altípusok:** a ▾ egy lebegő listát nyit a chipsor alatt, 48 px-es pipálható sorokkal, a háttér enyhén elsötétül; kívülre koppintás bezárja.
- **L-6 Telefon fekvő (≥ 568 px széles, ≤ 500 px magas):** a bal oszlopban: fejléc, csomaggomb, Megjelenés összecsukott sora, „Ezekkel játszotok” + számláló, szűrő chipsor (görgethető), előnézet. A jobb oszlop (Játékok) változatlan. Kinyitva a Megjelenés a bal oszlopban görgethető.
- **L-7** Érintési célok: minden új vezérlő legalább 44 px magas érintőképernyőn (a meglévő 9. pont szerint).

### Minta

- **MI-1** A Minta a kijelölt csomagok **szűrés utáni** tételeiből áll, típusonként legfeljebb egy, ebben a sorrendben: magánhangzó, mássalhangzó, többjegyű mássalhangzó, szótag (CV, ha nincs: VC, ha nincs: egyéb), szó, jelölt betűs tétel, mondat.
- **MI-2** A hiányzó típus kimarad. Mindig a lista szerinti első előfordulás (stabil, nem véletlen, hogy ne ugráljon).
- **MI-3** Ha nincs tétel, a Minta sor nem látszik.

### Játékok

- **J-1 Felolvasás:** a tétel a Megjelenés szerint rajzolódik (tspan-onként színezve, NB-7 szerinti körvonal). A takarás vonalzója, a betűméret-számítás és a felvillanás változatlan.
- **J-2 Keresd meg!:** a kártyák a Megjelenés szerint rajzolódnak. A megjelölt (koppintott) kártya stílusa változatlan.

### Napló és statisztika

- **N-1** *(Módosítva 2026-11-25, D-6: a Haladás naplójába nem kerül; csak az N-3 Umami-esemény viszi.)* A kör indulásakor a körhöz tárolódik: `colorMode: 'none' | 'sound'`, `markMode: 'none' | 'outline'`, `typeFilter`: a kikapcsolt típuskulcsok listája (V, C, VC, CV, S, W, M; üres = nincs szűrés). Hiányzó mező (régi adat): `none`, illetve nincs szűrés.
- **N-2** Csak adatgyűjtés: a Haladás állapotai, küszöbei és felülete nem változnak.
- **N-3** Umami: a kör indításakor küldött `round-start` eseményhez (mindkét játéknál) kerüljön `colorMode`, `markMode` és `filtered: true/false`. A játékot a meglévő `game` mező mondja meg (`read` = Felolvasás, `find` = Keresd meg!).

### Szövegek (pontosan így)

| Hely | Szöveg |
|---|---|
| Blokk címe | Megjelenés |
| Felirat | Betűk színezése |
| Opciók | Nincs · Hangok szerint |
| Felirat | Nagybetűk jelölése |
| Opciók | Nincs · Körvonal |
| Felirat | Minta |
| Jelmagyarázat | magánhangzó · zöngés · zöngétlen |
| Tipp | Színezésnél a körvonal a betű színét kapja. |
| Szűrő chipek | Betűk · Szótagok · Szavak · Mondatok |
| Altípusok | Magánhangzók · Mássalhangzók · CV (pl. ma) · VC (pl. am) · Egyéb |
| Üres szűrő | A szűrő minden tételt kizárt. Kapcsolj be legalább egy típust. |
| Becslés üres szűrőnél | Nincs tétel a szűrőben |
| Tablet mondat | A játékban csak a bekapcsolt típusok tételei jöhetnek elő. |

## Elfogadási tesztek

1. `{m}i-ki` a listában, a négy kombináció:

   | Betűk színezése | Nagybetűk jelölése | Az m megjelenése |
   |---|---|---|
   | Nincs | Nincs | teli, tintaszínű (`mi-ki`) |
   | Hangok szerint | Nincs | teli, piros (mint bármely más m) |
   | Nincs | Körvonal | körvonalas, tintaszínű |
   | Hangok szerint | Körvonal | körvonalas, piros |

   Az i és a k mind a négy esetben teli: színezés nélkül tintaszínű, színezéssel az i kék, a k zöld.
2. `{m}i-ki` és `mi-ki` ugyanabban a csomagban: az előnézetben egy tétel (jelölt alakban), a Haladásban egy tétel (`mi-ki`); a `Mi-ki` külön tétel.
3. `{sz}é-ke`: a teljes sz körvonalas, színezéssel zöld.
4. `{m`, `{}`, `{mi}-ki`: a tétel figyelmeztetéssel kimarad.
5. Színezés be: `ma-ma` → m piros, a kék, kötőjel tinta; `tó` → t zöld; `Ma` → M piros.
6. Csak magánhangzók bekapcsolva: Felolvasásban csak V csoportú tétel jön, a kör hossza a beállított marad.
7. Minden típus kikapcsolva: Indítás inaktív, az üres szűrő szövege látszik.
8. Mondat nélküli csomagok: nincs Mondatok chip; mondatos csomagot hozzáadva megjelenik.
9. Csak CV szótagok a csomagokban: a Szótagok chipen nincs ▾.
10. Újratöltés után a Megjelenés és a szűrő állapota megmarad.
11. Súgó: a lépések között szerepel a Megjelenés és a szűrő mondata.
12. A kör naplójában ott van a `colorMode`, `markMode`, `typeFilter`; régi körök hiba nélkül töltődnek be.
13. Telefon álló 390×844 és fekvő 844×390, valamint 320×256: a Megjelenés sor és a chipsor nem lóg ki, nincs vízszintes görgetés az oldalon (a chipsor saját görgetése megengedett).

### Súgó

- **S-1** A Súgó „Így használd” lépései közé, a 2. helyre (a csomagválasztás után) új lépés kerül:
  „A Megjelenés résznél színezheted a betűket és jelölheted a nagybetűket, a Betűk, Szótagok, Szavak, Mondatok gombokkal pedig kiválaszthatod, mit gyakoroljatok.”
- **S-2** A bemutató (onboarding) változatlan.

## Lezárt kérdések

- **D-1** A párnélküli zöngés mássalhangzók pirosak (SZ-2). Lezárva.
- **D-2** A Súgó egy mondatot kap (S-1). Lezárva.
- **D-3** Szűrésnél az előnézetben csak a szűrés utáni tételek látszanak, és minden számláló (csomagonkénti tételszám, telefonos csomaggomb, csomaglap) a szűrés utáni különböző tételeket számolja. Lezárva (2026-11-25).
- **D-4** A zárójelben csak kisbetű állhat, és csak szó elején: `{M}i-ki` és `mi-{k}i` érvénytelen (NB-3). Így ugyanannak a tételnek nem lehet két eltérő jelölése; ha mégis több jelölt sor van, a csomagsorrendben az első számít. Lezárva (2026-11-25).
- **D-5** Ha a `hangok.json` nem tölthető be vagy hibás, a program a beépített (SZ-2 szerinti) besorolással színez. Lezárva (2026-11-25).
- **D-6** A Megjelenés és a szűrő a Haladás naplójába nem kerül, csak az Umami `round-start` eseménybe (mindkét játéknál). Lezárva (2026-11-25).
- **D-7** A Keresd meg! panel Mintája is a Megjelenés szerint rajzolódik. A szűrő chipjére koppintás csak a mostani csomagokban jelen lévő altípusokat kapcsolja; a nem látszó altípus tárolt állapota marad. A hosszkorlát a zárójelek nélküli alakra vonatkozik. Lezárva (2026-11-25).
- **D-8** Az asztali Megjelenés kártyában a „Megjelenés” cím a kártyán belül áll (az artboard szerint), ezért 15 px-szel lejjebb van, mint a két szélső oszlopcím. Ha a középső oszlop keskenyebb, mint a 140 + 260 px-es sor (pl. 1024 px-es ablak), a felirat a vezérlő fölé kerül, a vezérlő kitölti a kártyát. Álló tableten a két vezérlő egymás mellett áll (L-3; az artboard egymás alatt mutatja), a Minta felirata „Minta”. Telefonon az összegzés két sorba tördelődhet, nem vágódik le. (2026-11-25)
- **D-9** A szűrés utáni számlálás (D-3) a csomaglista tételszámaira is vonatkozik (oldalsáv, tablet chipek, telefonos lap), és a csomaglap összegzése „N tétel” lett („különböző” nélkül, mint az SZR-8 számláló). A részben bekapcsolt chipre koppintás mindet kikapcsolja (az artboard szerint), a kikapcsoltra koppintás mindet bekapcsolja. Asztalon a teljes „Ezekkel játszotok” fejléc (cím, számláló, mondat, chipek) tapad. (2026-11-25)
