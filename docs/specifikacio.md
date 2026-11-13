# Olvasóka – Specifikáció

Verzió: **2.13** · Nyelv: magyar (UI és tartalom) · Célplatform: statikus weboldal GitHub Pagesen

Az 1.x változatok Claude.ai artifactra, egyetlen HTML-fájlra készültek. A 2.0 a GitHubra költözött,
bontott változatot írja le. Ahol egy pont az 1.2-höz képest változott, a 0. fejezet táblázata és a
10. fejezet döntési naplója mondja meg, mi és miért.

---

## 0. Változások

### 2.0 (az 1.2-höz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Név | A program neve **Olvasóka** (korábban: Beszéd- és kiejtésgyakorló). | 1. |
| 2 | Platform | Statikus oldal GitHub Pagesen, natív ES modulokra bontva, build lépés nélkül. Nem egyetlen fájl. | N2, 11. |
| 3 | Listák forrása | A listák a repó `lists.txt` fájljából jönnek, az alkalmazásban **csak olvashatók**. Szerkesztés a GitHubon. Megszűnt: listakezelés, mentés, export/import. | 3., F-A1–F-A10, U-A3–U-A13 |
| 4 | Duplikátum | Az ismétlődő tétel **kimarad** (korábban: megengedett). | F-A3, 4.1 |
| 5 | Tételforrás | Új beállítás: **Kijelölt lista / Összes lista**. | F-A5, 3.2 |
| 6 | Felvillanás | **0–25 mp**, alapérték **10 mp**. A **0 kézi léptetést** jelent. | 3.2, F-P1 |
| 7 | Betűtípus | **Arial** (tartalék: Arimo). Az Andika megszűnt. | 6.1, F-F1, F-F2 |
| 8 | Számláló | A jobb felső sarokban mindig látszik: `3/10`. | F-P9, F-P12, 9.6, U2 |
| 9 | Időjelző | A tétel alatt fogyó csík mutatja a hátralévő időt, szünetben megáll. | F-P9, F-P14 |
| 10 | Vezérlők | A ◀ ⏸/▶ ▶ gyakorlás közben **végig látszik**. A ✕ marad egérmozgásra. | F-P10, 9.7 |
| 11 | → az utolsón | A **→ az utolsó tételen is a jutalomra vált**. | F-P7, 8., 9.5 |
| 12 | Betűméret | A tétel legfeljebb a magasság **62%**-át foglalja (korábban 70%), hogy a csík és a vezérlők elférjenek. | F-P13 |
| 13 | Tesztek | Beépített önteszt helyett `node --test` és GitHub Actions. A kör logikája tiszta állapotgép. | N7 |

### 2.1 (a 2.0-hoz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Listaformátum | `lists.txt` (sima szöveg: `# Lista neve`, alatta soronként egy tétel) a `lists.json` helyett. | 3.1, 3.2, 3.4, 8., 9.13 |
| 2 | Ismétlődő tétel | Az app csendben kihagyja, a teszt csak tájékoztat. A teszt helyette mintatételeket keres a listákban. | F-L5, N7 |

### 2.2 (a 2.1-hez képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Listasorrend | A listák névsorban jelennek meg (magyar ábécé, a számok számként). | F-L2, U-A1 |
| 2 | Több lista | Ctrl/⌘+kattintással több lista, Shift+kattintással tartomány jelölhető ki; a kör ezek uniójából épül. Keskeny nézetben jelölőnégyzetek. | F-S1a, F-S3, U-A1–U-A3, U-A6 |
| 3 | Forrás szinkron | Az „Összes lista” ⇔ minden lista kijelölve. Lásd F-S1b. | F-S1b |
| 4 | Súgó | Üdvözlő/súgó ablak induláskor, „Ne jelenjen meg újra” jelölőnégyzettel; fejlécgomb. | U-A7a, F-S3 |
| 5 | Koppintás | Érintőképernyőn a gyakorlónézetben bárhová koppintva a következő tétel jön. | F-P16 |
| 6 | Jutalom | A lufik felszállnak, egy oldalt álló hőlégfúvó szele sodorja őket; kimenve alul visszajönnek. | F-R8–F-R11, U-R1 |
| 7 | PWA | Telepíthető, offline is induló alkalmazás lufi ikonnal; Arimo a repóból; képernyőzár gyakorlás alatt; a súgó a telepítést is említi. | N2, N8, N9, F-F2, U-A7a |

### 2.13 (a 2.12-höz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Jutalom | **Jutalomválasztó:** a kör végén a gyerek választ a lufipukkasztás és a panda-ugrálás közül (két kártya, szöveg nélkül). A véletlen váltakozás megszűnt; a `?jutalom=` paraméter továbbra is rögzít, és a választó kimarad. | 2., F-R14, 12.5b |
| 2 | Hőlégfúvó | Csökkentett mozgásnál (álló lufik) nem jelenik meg; mozgással a lufik a fúvó mögött szállnak el. | F-R8, F-R11 |

### 2.12 (a 2.11-hez képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Jutalom | Második jutalomjáték: **panda-ugrálás**. Egy szemből látott panda bambuszpadokon ugrál felfelé a nyilakkal (←/↑/→) vagy koppintással; ha két pad közé ugrik, leesik és a játék csendben véget ér. | 2., 5., 5a., 12.5a |
| 2 | Választás | A két jutalom körönként véletlenszerűen jön, de kétszer egymás után nem ugyanaz (két játéknál: váltakozik). Kipróbáláshoz a cím `?jutalom=lufi` vagy `?jutalom=panda` paramétere rögzíti. | F-R14 |
| 3 | Konfetti | A konfettieső közös modul (`js/ui/confetti.js`), a lufi és a panda is ezt használja; viselkedése változatlan. | F-R5, F-J7 |

### 2.11 (a 2.10-hez képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Keresd meg! minta | A minta nem fix 6 oszlopos rács, hanem tördelődő címkesor: minden címke a tétel szélességével, egy sorban (nincs sortörés a szón belül), ha nem fér ki, új sorba kerül. Azonos betűméret (17 px, Arial), `--line` keret, `--field` háttér. Utolsó védőháló: ha egy tétel szélesebb a panelnél, `text-overflow: ellipsis`. | U-A8 |

### 2.10 (a 2.9-hez képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Keresd meg! | Új játék: a rácsból a szülő kimond egy kártyát, a gyerek rábök. A program nem értékel. A fül csak akkor inaktív, ha a `parok.json` nem használható. | 2., 3.3a, 4a., U-A8, 12.4a |
| 2 | Beállítások | Keresd meg! beállítások: kártyák (4 · 6 · 8), feladatok száma, nehézség (1–5, első használatkor 1, utána megmarad). | 3.3a, F-S3 |
| 3 | Telefon | Ha a nézet rövidebb oldala 500 px alatt van, legfeljebb 6 kártya; a tárolt beállítás nem változik. | F-K10, U-A8 |
| 4 | Szóhasználat | A felületen „feladat”: egy feladat egy rács. A heurisztika dokumentumában ugyanez „rács”. | 4a. |
| 5 | Horgony | Két egymást követő feladat horgonya nem lehet azonos. | F-K16 |
| 6 | Konfiguráció | `parok.json` a repó gyökerében; a nehézségi görbét kiadáskor a táblázat listáján kalibrálja a deploy (tartalék: `lists.txt`). | F-K17, F-K18 |

### 2.9 (a 2.8-hoz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Környezetek | Éles (`main` → `/olvasoka/`) és fejlesztői (`dev` → `/olvasoka/dev/`) környezet ugyanazon a GitHub Pages oldalon. A dev külön tárolási nevet, saját service worker tárolót, eltérő nevet és sötét ikont kap. | N10, F-S3 |
| 2 | Programverzió | `js/version.js`, a szülői felület fejlécében látszik; dev-ben „DEV” címkével. Kiadáskor léptetni kell; az éles kiadás `vX.Y.Z` taget kap. | N10, 7.1 |

### 2.8 (a 2.7-hez képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Szótag-takarás | A kötőjellel tagolt tétel szótagjai a szülő műveletére egyenként letakarhatók (kattintás/koppintás a szótagra, vagy `↓`). Alapból minden szótag látszik; a program magától soha nem takar. A takaró egy sárga műanyag vonalzó, a szótag szélességére nyújtva. | 2., 4.5, F-P17–F-P23, 4.4, U-P9 |
| 2 | Koppintás | A tétel területén belüli koppintás többszótagú tételnél takar, nem léptet; azon kívül változatlanul NEXT. | F-P16 |
| 3 | Auto-pause | A takarás megkezdése megállítja az időt. | F-P20 |
| 4 | Betűméret | A tétel kb. 15%-kal kisebb: a legszélesebb tétel a szélesség 72%-án (85% helyett), a tinta-doboz és a betűméret a magasság 53%-án (62% helyett) fér el. | F-P13 |

### 2.7 (a 2.6-hoz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Hőlégfúvó | Animált: a hőhullámok hullámzanak, a test enyhén rezeg, a csőből halvány szélcsíkok indulnak a szél irányába. | F-R8, F-R13 |

### 2.6 (a 2.5-höz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Lufiszámláló | A jutalom alatt a jobb felső sarokban `3/15` mutatja a kipukkasztott és az összes lufit, a gyakorló számlálónál nagyobban. | F-R4, F-R12 |
| 2 | Konfetti | Az utolsó pukkanás után 3 mp konfettieső, majd vissza a szülői felületre; Esc és ✕ közben is kilép. | F-R5, F-R6 |

### 2.5 (a 2.4-hez képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Forrás-kapcsoló | A `?source=` feature toggle megszűnt: mindig a Google táblázat az elsődleges forrás, a tartalék (`lists.txt`, majd a legutóbbi példány) változatlan. A tárolt `listSource` érték figyelmen kívül marad. | F-L12, F-L11, F-L13, F-S3 |
| 2 | Szerkesztő link | Mindig a táblázatra mutat; a GitHub-link megszűnt. | F-L11 |

### 2.4 (a 2.3-hoz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Listák forrása | Elsődleges forrás egy **Google táblázat** (oszloponként egy lista, első sor a név). A repó `lists.txt`-je **tartalék**. | 1., 3.1a, F-L8, F-L9 |
| 2 | Tartalék jelzése | Ha a táblázat nem érhető el, a listák alatt diszkrét „Tartalék lista: lists.txt” jelzés, lenyitva az okkal. | F-L13 |
| 3 | Feature toggle | Ideiglenes `?source=sheet` / `?source=txt` URL-paraméter, a böngésző megjegyzi. Alapérték: `sheet`. | F-L12, F-S3 |
| 4 | Szerkesztés | Táblázat módban a szerkesztő link a táblázatra mutat (a hozzáférést a Google kezeli). | F-L11 |
| 5 | `#`-es tétel | A vessző után álló, `#`-tel kezdődő tétel is kimarad, figyelmeztetéssel (#12). | F-L5 |
| 6 | Frissülés | Táblázat módban a változás ~5 percen belül látszik (a Google gyorsítótára miatt). | 9.16 |

### 2.3 (a 2.2-höz képest)

| # | Terület | Változás | Érintett pontok |
|---|---|---|---|
| 1 | Eszközök | Tablet és telefon is támogatott (érintés, álló és fekvő tájolás). | 1., 12.6 |
| 2 | Teljes képernyő | Telepített PWA-ként teljes képernyőn fut; ez elvárás, nem kizárt. | 1., N8 |
| 3 | Jutalom | Az F-R1 (statikus „helyükre emelkedő” lufik) megszűnt; a háttérváltás az F-R9-be került. | F-R1, F-R9 |
| 4 | Lufik száma | Minden képernyőn 10–15 lufi; a kis képernyős csökkentés (min. 6) megszűnt. | F-R2, 9.10 |
| 5 | Kilépés érintéssel | Érintőképernyőn a ✕ végig látszik (egérmozgás nincs, az Esc nem érhető el). | F-P10, U-P5, 9.7 |

### Korábbi változatok

Az 1.0 (interjú), 1.1 (technikai review) és 1.2 (UX-terv) döntései a 10. fejezetben vannak.
Ami azokból továbbra is érvényes, beépült a lenti fejezetekbe.

---

## 1. Cél és kontextus

Otthoni gyakorlóprogram egy 7 éves gyereknek. A program felvillantja a szülő által összeállított betűket,
szótagokat vagy szavakat, a gyerek hangosan kimondja őket. **A kiejtést a szülő ellenőrzi, aki a gyerek
mellett ül.** A program nem hallgat, nem értékel, nem ad hangot.

A cél a **betűalak rögzítése**, nem a szó–kép asszociáció. Ezért a gyerek képernyőjén soha nem jelenik meg
a tételhez kapcsolódó kép. Ugyanezért a betűalak a kör alatt **nem változik** (azonos font, azonos méret).

A tartalom gyakran változik. A szülő a listákat egy Google táblázatban szerkeszti, telefonról is.

### Nem cél
- Mikrofon, beszédfelismerés, kiejtés-értékelés
- Bármilyen hang (se zene, se effekt, se felolvasás)
- Tételekhez rendelt képek
- Pontszám, hibajelölés, statisztika
- Listaszerkesztés az alkalmazáson belül; visszaírás a repóba
- Bejelentkezés, szerveroldali tárolás, több eszköz közötti szinkron (a listák a repóból mindenhol
  ugyanazok, a beállítások böngészőnként külön tárolódnak)

---

## 2. Szerepkörök és nézetek

| Nézet | Ki használja | Tartalom |
|---|---|---|
| **Szülői felület (admin)** | szülő | lista kiválasztása, beállítások, kör indítása |
| **Gyakorlónézet** | gyerek (a szülő vezérli) | a villantott tétel, időjelző, haladásjelző, vezérlők, dekoráció |
| **Keresd meg! nézet** | gyerek (a szülő mondja ki a kártyát) | N kártyás rács, haladásjelző, vezérlők, dekoráció |
| **Jutalomválasztó** | gyerek | két kártya: lufipukkasztás vagy panda-ugrálás (F-R14, 12.5b) |
| **Jutalomnézet** | gyerek | a választott jutalomjáték: lufipukkasztás vagy panda-ugrálás (F-R14) |

Állapotgép: `ADMIN → PRACTICE → CHOOSE → REWARD → ADMIN`, illetve Keresd meg! módban
`ADMIN → FIND → CHOOSE → REWARD → ADMIN`. A `?jutalom=` paraméterrel a CHOOSE kimarad (F-R14).
Az **Esc** a PRACTICE, FIND, CHOOSE és REWARD állapotból bármikor visszavisz ADMIN-ba.

A PRACTICE állapotot a `js/core/round.js` írja le:
`{ seq, flash, gap, index, phase: 'showing' | 'gap', paused, deadline, remaining, done, covered }`.
A `covered` a látható tétel szótagjainak takarási állapota (F-P21).

---

## 3. Listák és beállítások

### 3.1 A `lists.txt` (tartalék)
- **F-L1** A listák a repó gyökerében lévő `lists.txt`-ben vannak, sima szövegként (UTF-8):
  ```
  # Magánhangzók
  a
  á

  # 45. oldal
  fa
  ke-fe
  ```
  A `#`-tel kezdődő sor új lista neve, alatta soronként egy tétel. Az üres sorok nem számítanak.
  A vessző is elválaszt: az `a, á, e` sor három tétel.
- **F-L2** A listák névsorban jelennek meg: magyar ábécérend, a számok számként (2. oldal < 10. oldal). A fájlbeli sorrend nem számít.
- **F-L3** A listanév **egyedi** (levágva, kis-/nagybetűre nem érzékenyen). A második azonos nevű lista
  kimarad, a szülői felület figyelmeztet a sorszámmal.
- **F-L4** Üres név (`#` magában) esetén a lista a tételeivel együtt kimarad; az első fejléc előtti sorok
  kimaradnak. Mindkettőről figyelmeztetés a sorszámmal. Tétel nélküli lista érvényes, üresként jelenik meg.
- **F-L5** Tételek tisztítása, ebben a sorrendben:
  1. Unicode NFC-normalizálás.
  2. A két végén szóköz levágva.
  3. Üres tétel eldobva.
  4. **Ismétlődő tétel eldobva** a listán belül (pontos egyezés; az `a` és az `A` két külön tétel).
     Az ismétlés szándékos is lehet (oldal végi ismétlő sor), ezért nem hiba: az app csendben kihagyja,
     a teszt csak tájékoztatásként írja ki.
  5. Max. 20 karakter (kódpontban). A hosszabb kimarad, a szülői felület megnevezi a sorszámmal.

  `#`-tel kezdődő tétel nem lehet: a `#`-tel kezdődő sor listanév, a vessző után álló `#`-es tétel pedig
  kimarad, figyelmeztetéssel a sorszámmal.
- **F-L6** A tétel **pontosan úgy jelenik meg, ahogy le van írva**. Tilos a `text-transform` és
  bármilyen kis-/nagybetű konverzió.
- **F-L7** A fájl nem lehet úgy hibás, hogy semmi ne jelenjen meg: a program mindig a helyes részeket
  használja, a többiről figyelmeztet.

### 3.1a A Google táblázat (elsődleges forrás)
- **F-L1a** A listák egy „Közzététel az interneten” CSV-ként publikált Google táblázat első fülén vannak:
  minden oszlop egy lista, az **első sor a lista neve**, alatta cellánként a tételek.
  ```
  | 45. oldal | Á-A-E | 44. oldal |
  | fa        | á     | pá-va     |
  | ke-fe     | pá    | pu-li     |
  ```
  Az üres cellák nem számítanak; a cellán belüli vessző is elválaszt. A név elején álló `#` elhagyható.
- **F-L1b** A szabályok ugyanazok, mint a `lists.txt`-nél (F-L2–F-L7): névsor, egyedi név, tisztítás,
  hosszkorlát. A helymegjelölés a cella: „A táblázat B3 cellája: …”. A név és tétel nélküli oszlop csendben
  kimarad; a név nélküli, de tételes oszlop figyelmeztetéssel.
- **F-L1c** Címek: CSV `…/pub?output=csv`, szerkesztő `…/d/1j87SRjs4ZvyEJmModdTuNwPdyzgkwzx34yarw3qdCEM/edit`
  (`js/core/source.js`).

### 3.2 Betöltés és gyorsítótár
- **F-L8** Induláskor a program azonnal megjeleníti a legutóbb letöltött listákat (ha vannak), és a háttérben
  letölti a listákat `cache: 'no-cache'`-sel, forrásonként 8 mp-es időkorláttal. A sorrend:
  1. a Google táblázat;
  2. ha az nem érhető el (hálózat, HTTP-hiba, időtúllépés), nem CSV-t ad (pl. nincs közzétéve, bejelentkező
     oldal), vagy nincs benne egyetlen lista sem → a repó `lists.txt`-je;
  3. ha az sem → a legutóbb letöltött példány (bármelyik forrásból), F-L9.

  Sikeres letöltés után a listák frissülnek, és az új változat a forrásával együtt a helyi tárolóba kerül.
  A táblázat részleges hibái (egy-egy rossz cella) nem okoznak tartalékra váltást: a jó részek látszanak,
  a többiről figyelmeztetés (F-L7).
- **F-L9** Ha egyik forrásból sem sikerül a letöltés:
  - van korábbi változat → az látszik, mellette figyelmeztetés a hibával és azzal, hogy a legutóbbi listák látszanak;
  - nincs korábbi változat → üres állapot a hibaüzenettel; az „Indítás” inaktív.
- **F-L10** A „Frissítés” gomb újra letölti a listákat (F-L8 sorrendben). Mellette: „Frissítve: 20:49”, illetve
  kapcsolat nélkül „Nincs kapcsolat – a nov. 7. 20:49 állapot látszik”.
- **F-L11** „Listák szerkesztése a táblázatban ↗”: új lapon a táblázat szerkesztőjét nyitja (a hozzáférést a
  Google kezeli); a változás kb. 5 percen belül jön le. A tartalék `lists.txt`-t a szülő kézzel szerkeszti a GitHubon,
  ehhez az alkalmazásban nincs link.
- **F-L12** *(2.5-ben megszűnt: a forrás-kapcsoló.)*
- **F-L13 Tartalék jelzése:** ha a látható listák a `lists.txt`-ből jöttek, a listák alatt,
  a forrássor alatt halvány, összecsukott „Tartalék lista: lists.txt” sor; lenyitva a táblázat hibájának
  oka. Nem figyelmeztető sáv, és a gyerek nézetében semmi nem jelzi.

### 3.3 Beállítások (a kör indítása előtt)

| Beállítás | Tartomány | Alapérték |
|---|---|---|
| Tételek forrása | Kijelölt listák / Összes lista | **Kijelölt listák** |
| Felvillanási idő | 0–25 mp, 0,5 mp lépés; **0 = kézi** | **10 mp** |
| Szünet a tételek között | 0 · 0,5 · 1 · 2 · 3 mp (a régi 1,5 / 2,5 mp tárolt érték 1 / 2 mp-re áll) | **0 mp** |
| Tételszám a körben | 1–50 | **10** |

- **F-S1a Kijelölt listák:** egy vagy több lista jelölhető ki (U-A1). A kör a kijelölt listák
  tételeinek uniójából épül, ismétlődés nélkül, kiegyenlítés nélkül (a nagyobb lista több tételt ad).
  A kijelölt listák és a különböző tételek száma a középső rész fejlécében (U-A3), mobilon a lista-lenyílón látszik.
- **F-S1b A forrásválasztó követi a kijelölést, és fordítva.**
  - Ha kézzel minden lista ki van jelölve, a választón az „Összes lista” aktív; ha legalább egy nincs, a „Kijelölt listák”.
  - Az „Összes lista” megnyomása minden listát kijelöl.
  - A „Kijelölt listák” megnyomása, amikor minden lista ki van jelölve, csak az első listát hagyja kijelölve.
  - „Összes lista” módban frissítés után az újonnan megjelent lista is kijelölődik.
- **F-S1 Összes lista:** a kör az összes lista tételeinek uniójából épül, ismétlődés nélkül.
  Az „Indítás” mellett: „4 lista, 98 különböző tétel”.
- **F-S2 Kézi léptetés (0 mp):** a tétel addig látszik, amíg Space-t vagy →-t nem nyomnak.
  A csúszka mellett „kézi”, a becsült hossz helyén „kézi léptetés” áll.

### 3.3a Keresd meg! beállítások

| Beállítás | Tartomány | Alapérték |
|---|---|---|
| Tételek forrása | közös a Felolvasással (3.3) | **Kijelölt listák** |
| Kártyák | 4 · 6 · 8 (telefonon legfeljebb 6, F-K10) | **4** |
| Feladatok száma | 1–30 | **10** |
| Nehézség | 1–5 | **1** (legkönnyebb) |

- **F-S6 Nehézség.** Az 1–5 fokozat a heurisztika 0 · 0,25 · 0,5 · 0,75 · 1 fokozatának felel meg
  ([keresd-meg-heurisztika.md](keresd-meg-heurisztika.md)): 1 = jól megkülönböztethető, 5 = nagyon hasonló
  elemek. Első használatkor 1, utána a szülő legutóbbi választása marad (F-S3). A felület nem említi,
  hogy a rács szabályok szerint, véletlennel áll össze; csak a hasonlóságról beszél.
- **F-S7** A Keresd meg! módban nincs felvillanási idő és szünet: egy feladat addig látszik, amíg a szülő
  tovább nem lép (F-K5).
- **F-S8** Az Indítás feltétele legalább 2 különböző tétel a kör forrásában. Különben inaktív:
  „Legalább két különböző tétel kell.”

### 3.4 Helyi tárolás
- **F-S3** A beállítások, a legutóbb kijelölt listák neve és a legutóbb letöltött `lists.txt` szövege a
  `localStorage`-ban, `olvasoka` kulcs alatt (a dev környezetben `olvasoka-dev`, N10):
  ```json
  { "v": 4, "mode": "read", "settings": { "flashMs": 10000, "gapMs": 0, "count": 10, "source": "list" },
    "find": { "cards": 4, "tasks": 10, "level": 1 },
    "lastLists": ["44. oldal", "45. oldal"], "hideHelp": false,
    "cache": { "text": "45. oldal,Á-A-E\nfa,á\n…", "fetchedAt": 1794080000000, "kind": "sheet" } }
  ```
  A `cache.kind` a szöveg forrása (`sheet` vagy `txt`); a `kind` nélküli régi cache `lists.txt`.
  A v2 állapot `lastList` neve betöltéskor a `lastLists` egyetlen eleme lesz.
  A `mode` a kiválasztott játék (`read` | `find`); betöltéskor megmarad. Ha a `parok.json` nem használható
  (F-K18), a Keresd meg! fül inaktív és a Felolvasás nyílik, a tárolt `mode` viszont nem íródik felül, így
  a következő betöltés újra próbálja. A v3 állapot `mode` nélkül `read` lesz.
  A `find` a Keresd meg! beállításai (3.3a): `cards` 4 | 6 | 8, `tasks` 1–30, `level` 1–5. Hiányzó vagy
  érvénytelen mezőnél az alapérték; a mező új, de csak hozzáadás, ezért a `v` marad 4. A telefonos
  korlát (F-K10) nem írja át a `cards` értékét.
- **F-S4** Minden hozzáférés `try/catch` között. Sérült adatnál alapállapot. Tárolás nélkül (privát ablak)
  a program fut, figyelmeztetéssel: a beállítások nem maradnak meg, és hálózat nélkül nem lesz lista.
- **F-S5** A tárolás böngészőnként és címenként külön él. A listák a repóból jönnek, ezért nem vesznek el.

---

## 4. Gyakorlókör (PRACTICE)

### 4.1 Sorozat előállítása („húzózsák”)
A kör indulásakor a program **előre legenerálja a teljes sorozatot** a kör tételeinek indexeiből.

1. `N` = kért tételszám, `L` = a kör különböző tételeinek száma.
2. Az indexek véletlen keverése (Fisher–Yates), hozzáfűzés a sorozathoz; ismétlés, amíg `N` hosszú nem lesz.
3. Minden keverésen belül minden index pontosan egyszer szerepel.
4. Az utolsó, részleges keverésből az első `k` elem kerül be.
5. Ha az új keverés első indexe egyezik az előző keverés utolsójával (és `L > 1`), az első elem egy
   véletlen `j ≥ 1` pozícióval cserél, a levágás előtt.

Mivel a tételek egyediek (F-L5), **két azonos tétel soha nem kerül egymás után** (`L = 1` kivételével).
A véletlenszám-forrás paraméter (`buildSequence(L, N, rng)`), a tesztek seedelt `rng`-t használnak.

### 4.2 Lejátszás
- **F-P1** A tétel a beállított ideig látszik, majd magától vált. Kézi léptetésnél nem vált magától.
- **F-P2** Szünet > 0 esetén a lejárat után üres képernyő (csak dekoráció) a szünet idejére, aztán a
  következő tétel. A tételváltás soha nem animált.
- **F-P3** **Space:** azonnal a következő tétel; az utolsón (vagy az utána lévő szünetben) jutalom.
  Pause alatt nincs hatása.
- **F-P4** Az utolsó tétel idejének (és az utána lévő szünetnek) lejárta jutalomra vált.
- **F-P5** **Pause (P vagy ⏸):** az idő megáll, a képernyő marad. Folytatáskor a hátralévő idő fut le.
- **F-P6** **Vissza (←):** `showing` fázisban az előző tétel teljes idővel; `gap` fázisban a most lejárt
  tétel teljes idővel; az első tétel `showing` fázisában nincs hatása.
- **F-P7** **Előre (→):** a következő tétel teljes idővel; **az utolsó tételen (és az utána lévő szünetben)
  jutalomra vált**, mint a Space.
- **F-P7a** ← és → pause alatt is működik, és a kör folytatódik. Ha ← nem lehetséges, a pause megmarad.
- **F-P8** Automatikus pause, ha a fül háttérbe kerül vagy az ablak fókuszt veszt. Visszatéréskor pause marad.

### 4.3 Képernyőtartalom
- **F-P9** A képernyőn: a tétel, az időjelző (F-P14), a haladásjelző (F-P15), a vezérlősor (F-P10),
  a dekoráció, pause alatt a pause-jelző. **Nincs** pontszám, hibajelölés, szöveges felirat.
- **F-P10** **Vezérlősor** (◀ ⏸/▶ ▶) alul középen, **végig látszik**. A **✕ kilépés** a bal felső sarokban
  egeres eszközön csak egérmozgásra (≥ 8 px) jelenik meg, 2,5 mp mozdulatlanság után eltűnik.
  **Érintőképernyőn végig látszik** a gyakorlás és a jutalom alatt: érintőképernyőnek számít, ha
  `(hover: none) and (pointer: coarse)`, vagy ha a nézetben már volt érintéses/tollas `pointerdown`.
  A ✕-re koppintás csak kilép, nem lép tovább (F-P16). A ◀ az első tételen
  halványított; a ▶ mindig aktív. Az ikonok szöveg nélküliek, `aria-label`-lel, `tabindex="-1"`.
- **F-P11** Mozdulatlanságnál a kurzor elrejtődik (a gombok fölött látszik), mozgásra visszajön.
- **F-P12** **Pause-jelző:** pause alatt kis ⏸ jel a jobb felső sarokban.
- **F-P13** **Betűméret:** a kör indulásakor egyetlen méret, amellyel a kör legszélesebb tétele elfér a
  szélesség 72%-án, a tételek közös tinta-doboza a magasság 53%-án, és a betűméret legfeljebb a magasság
  53%-a (2.8-ban 85%, 62%, 62%). Az alapvonal a körön belül állandó; a közös tinta-doboz közepe a magasság 46%-án van.
  Átméretezéskor újraszámolódik.
- **F-P14** **Időjelző:** a tétel alatt 6 px magas, lekerekített csík a kör legszélesebb tételének
  szélességében (min. 160 px, max. a szélesség 70%-a). A kitöltés balról jobbra fogy a hátralévő idő
  arányában. Pause alatt áll, ← és → után tele csíkkal indul újra. A szünetben és kézi léptetésnél nem látszik.
- **F-P15** **Haladásjelző (pöttysor):** felül középen, a kör minden tételéhez egy pötty; a kész tételek
  `--accent`, az aktuális szélesebb `--accent` kapszula, a hátralévők `--line`. 20 tétel fölött pöttyök
  helyett 240 px-es sáv és mellette `index/N` (pl. `12/50`). Egérmozgástól független; `←` a kapszulát
  visszaviszi. A szünetben a most lejárt tételt mutatja. Akadálymentes felirata „4. tétel a 10-ből”.
  A jutalomnál nincs. (Design spec 7.; a modell: `js/core/progress.js`.)
- **F-P16** **Koppintás:** érintőképernyőn (és tollal) egy koppintás a gyakorlónézetben bárhol
  ugyanaz, mint a ▶ (`NEXT`): szünetben is lép, az utolsón jutalomra vált. A vezérlőgombokra koppintás
  csak a gombot működteti; 12 px-nél nagyobb húzás nem lép. Egérkattintásra nincs hatása.
  **Kivétel (2.8):** többszótagú tételnél a tétel takarási területén (F-P19) belüli koppintás nem lép,
  hanem takar (F-P18). Egyszótagú tételnél és a szünetben (`gap`) a koppintás mindenhol NEXT.

### 4.4 Billentyűk

| Billentyű (`e.code`) | Funkció |
|---|---|
| `Space` | következő tétel / utolsón: jutalom |
| `ArrowRight` | következő tétel / utolsón: jutalom |
| `ArrowLeft` | előző tétel (teljes idővel) |
| `KeyP` | pause / folytatás |
| `ArrowDown` | szótag-takarás léptetése (F-P18) |
| `Escape` | kilépés ADMIN-ba |
| `Ctrl`/`Cmd` + `Enter` | kör indítása (ADMIN) |

- Azonosítás `e.code` alapján; `e.repeat` eseményeket eldobjuk; a Space és a nyilak görgetését
  `preventDefault` tiltja; induláskor a fókuszban lévő elem elveszíti a fókuszt.

### 4.5 Szótag-takarás

Az iskolai módszert követi: a gyerek előbb az első szótagot olvassa (a második letakarva), aztán a
másodikat (az első letakarva), végül az egészet. A takarás a szülő eszköze, mint a vonalzó, amit a
könyvön a szótagra tesz: **alapból minden szótag látszik, és a program magától soha nem takar.**

- **F-P17 Szótagok.** A tétel szótagjait a kötőjel (`-`, U+002D) választja el, ahogy a listában le van
  írva (`ka-ta` → `ka`, `ta`). Az üres szakasz (kezdő, záró vagy dupla kötőjel) nem szótag. Legalább két
  szótag kell; egyszótagú tételen a takarásnak nincs hatása. A kötőjel a tétel része marad és látszik
  (F-L6), a takarás soha nem fedi.
- **F-P18 Vezérlés.**
  - **Kattintás vagy koppintás** egy szótag takarási területén (F-P19) az adott szótag takarását
    váltja (letakar ↔ felfed). Bármely kombináció megengedett, az összes szótag letakarása is.
  - **`↓` (`ArrowDown`)** a takarást lépteti ebben a sorrendben: *egész → csak az 1. szótag látszik →
    csak a 2. → … → csak az utolsó → egész*. Ha az aktuális állapot nem e sorozat egy eleme (kézzel
    kevert takarás), a `↓` a „csak az 1. szótag” állapotra ugrik.
  - A szünetben (`gap`) és egyszótagú tételen egyik műveletnek sincs hatása; a koppintás ott F-P16
    szerint NEXT, a kattintás semmi.
- **F-P19 Takarási terület.** A tétel közös tinta-dobozát (F-P13) a kötőjelek közepén függőlegesen
  szeletekre bontjuk; minden szelet egy szótag területe. A tinta-dobozon kívüli kattintásnak nincs
  hatása, a koppintás NEXT (F-P16). 12 px-nél nagyobb húzás nem takar.
- **F-P20 Időzítés.** Ha az idő fut (nem kézi léptetés, nincs pause), az első olyan művelet, amely
  bármelyik szótagot letakarja, **pause-t vált ki** (F-P5), a pause-jelzővel (F-P12) és álló
  időjelzővel. A felfedés nem indítja újra az időt. Folytatás P-vel vagy ⏸-lel; a takarás ekkor
  megmarad, és a hátralévő idő fut le. Továbblépés pause alatt F-P7a szerint (→, ▶, koppintás a
  tételen kívül).
- **F-P21 Visszaállás.** Minden tételváltáskor (időlejárat, Space, →, ←, ▶, ◀, koppintás) a takarás
  megszűnik: az új (vagy visszahozott) tétel mindig egészben jelenik meg. A takarás nem tárolódik.
- **F-P22 Megjelenés: vonalzó.** A takaró egy vízszintes, sárga műanyag vonalzó a szótag fölött.
  Szám, felirat, árnyék, színátmenet és fade nincs rajta.
  - **Test:** `--ruler` kitöltés, 1 px `--ruler-edge` keret, 0,03 em sarok. Egy vékony
    (1 px, `--ruler-bevel`) vízszintes vonal a test magasságának 62%-ánál (a vonalzó éle).
  - **Beosztás:** a felső élről lefelé induló, 1 px vastag, `--ruler-tick` színű vonások. A lépésköz
    0,045 em („mm”). Minden 10. vonás 0,16 em, minden 5. 0,11 em, a többi 0,06 em hosszú. Az első
    vonás 0,05 em-re van a bal végtől (ez egyben 10-es vonás), az utolsó legalább 0,03 em-re a jobb
    végtől. Így bármilyen hosszon ugyanolyan a minta, csak a vonások száma változik.
  - **Vízszintes méret:** a szótag első betűjének bal szélétől az utolsó jobb széléig (az advance-doboz
    szerint). A kötőjel felőli oldalon nincs ráhagyás, a külső oldalon 0,06 em. A szomszédos kötőjel
    tintáját soha nem érheti el.
  - **Függőleges méret:** a kör közös tinta-doboza (F-P13), fent és lent 0,03 em ráhagyással.
    Az alsó él legalább 4 px-re az időjelző teteje fölött marad (U-P3); ha a ráhagyás ezt sértené,
    lent kisebb lesz. Így egy körön belül minden vonalzó azonos magasságú, és nem árulkodik kilógó
    ékezet vagy szár.
  - A geometria (méret, vonások helye és hossza) a `js/core/cover.js`-ben számolódik
    (`rulerGeometry(box, em)`), DOM nélkül; a rajzolás inline SVG.
- **F-P23 Stabil elrendezés.** A takarás a betűméretet, az alapvonalat, a tétel és a kötőjelek
  helyzetét nem változtatja meg; a felfedett szótag pixelre ugyanott van, mint takarás előtt.
  Átméretezéskor a takarók a tétellel együtt újraszámolódnak, az állapot megmarad.
- A takarás logikája (szótagolás, `↓`-sorozat, váltás, visszaállás, auto-pause) a `js/core/cover.js`-ben
  és a `round.js` reducerében van, DOM nélkül, `node --test`-tel tesztelve.

---

## 4a. Keresd meg! kör (FIND)

A szülő a rácsból kimond egy kártyát, a gyerek megkeresi és rábök. A program nem tudja, melyik a jó
válasz, és nem értékel: csak megjelöli, amire a gyerek rábökött. A differenciálást (hasonló alakú
betűk, szótagok, szavak megkülönböztetése) a nehézség adja (F-S6).

Szóhasználat: a felületen **feladat**, egy feladat egy N kártyás rács. A heurisztika dokumentumában
ugyanez **rács**.

A FIND állapot (tervezett, a `round.js`-hez hasonló tiszta állapotgép):
`{ tasks, index, marked, done }`. A `tasks` a kör feladatai, mindegyik a kártyák tételei megjelenítési
sorrendben; a `marked` az aktuális feladatban megjelölt kártya sorszáma vagy `null`.

### 4a.1 Feladatok előállítása
- **F-K1** A kör indulásakor mind a K feladat elkészül (K = feladatok száma). Egy feladatot a heurisztika
  állít össze ([keresd-meg-heurisztika.md](keresd-meg-heurisztika.md)); bemenete a kör tételei (3.3a),
  a kártyaszám (F-K10 után) és a fokozat (F-S6).
- **F-K2** Egy feladat a körön belül nem változik: ← után ugyanaz a rács ugyanabban a sorrendben jön
  vissza, a jelölés törlődik.
- **F-K3** Ha a forrásban N-nél kevesebb különböző tétel van, a feladat az összes elérhető tételből áll,
  kevesebb kártyával (a heurisztika szerint).
- **F-K4** A véletlenforrás paraméter; a tesztek seedelt `rng`-t használnak (mint 4.1).

### 4a.2 Lejátszás
- **F-K5** Nincs idő: a feladat addig látszik, amíg a szülő tovább nem lép. Nincs időjelző, pause és
  pause-jelző; az automatikus pause (F-P8) itt nem kell.
- **F-K6 Jelölés.** Kártyára kattintás vagy koppintás megjelöli. Ugyanarra újra: a jelölés lekerül.
  Másikra: a jelölés átkerül, egyszerre legfeljebb egy kártya jelölt. A jelölés nem léptet; nincs hang
  és nincs jó/rossz visszajelzés.
- **F-K7 Lépés.** →, Space vagy ▶: a következő feladat, jelölés nélkül; az utolsón jutalom (5.).
  ← vagy ◀: az előző feladat (F-K2); az elsőn nincs hatása, a ◀ inaktív.
- **F-K8** Érintőképernyőn a kártyák közé vagy melléjük koppintás nem léptet: a gyerek koppint,
  a lapozás a szülőé. Ez eltér a gyakorlókör koppintásos léptetésétől (F-P16).
- **F-K9** Esc: azonnal ADMIN, jutalom nélkül. A képernyőzár (N9) FIND alatt is él.
- **F-K10 Kártyaszám telefonon.** Ha a kör indulásakor a nézet rövidebb oldala 500 CSS px alatt van,
  a kártyaszám legfeljebb 6 (8 → 6). A tárolt beállítás nem változik, tableten újra 8 lesz. Forgatás a
  körön belül csak az elrendezést változtatja (F-K12), a kártyaszámot nem.
- **F-K11** Szótag-takarás a Keresd meg! módban nincs (10., szótag-takarás döntései).

### 4a.3 Képernyőtartalom
- **F-K12 Elrendezés.** Az oszlopok és sorok száma a nézet alakjától függ:

  | Kártyák | Fekvő (szélesség ≥ magasság) | Álló |
  |---|---|---|
  | 4 | 2 × 2 | 2 × 2 |
  | 6 | 3 oszlop × 2 sor | 2 oszlop × 3 sor |
  | 8 | 4 oszlop × 2 sor | 2 oszlop × 4 sor |

  Kevesebb kártyánál (F-K3) a beállított kártyaszám rácsa marad, az utolsó sor középre igazítva.
- **F-K13 Betűméret.** Egy feladaton belül minden kártyán azonos a betűméret és az alapvonal (Arial,
  F-F1). A méretet a feladat leghosszabb tétele adja: a kártya belső szélességének legfeljebb 80%-át
  és magasságának legfeljebb 55%-át foglalja. Feladatváltáskor és átméretezéskor újraszámolódik.
- **F-K14** A képernyőn: a rács, a haladásjelző a feladatok számával (U-P6), a ◀ ▶ vezérlők, a ✕ és a
  dekoráció. Nincs szöveg, szám, pontszám.
- **F-K15** A feladatok előállítása és a lépés-logika a `js/core/` alatt, DOM nélkül, `node --test`-tel
  tesztelve: `js/core/grid.js` (heurisztika), `js/core/find.js` (feladatok és lépés-logika).
- **F-K16 Horgony.** Két egymást követő feladat horgonya nem lehet azonos, ha a forrásban legalább két
  különböző tétel van. A horgony a többi tétel közül továbbra is egyenletes véletlennel jön.
- **F-K17 Konfiguráció.** A párok, költségek és rácsparaméterek a repó gyökerében lévő `parok.json`-ban
  vannak (a kulcsok jelentése: [keresd-meg-heurisztika.md](keresd-meg-heurisztika.md)). A program
  induláskor letölti; a service worker offline is kiszolgálja. A nehézségi görbét (`racs.csuszka_gorbe`)
  kiadáskor a deploy kártyaszámonként (4, 6, 8) újraszámolja a környezet táblázatának teljes listáján; ha a
  táblázat nem érhető el, a `lists.txt`-n, figyelmeztetéssel. A görbe csak a kiadott példányba kerül, a
  repóba nem; a repó görbéje a helyi futtatás és a tesztek alapértéke.
- **F-K18 Hibás konfiguráció.** Hibás `parok.json` (nem olvasható, hiányzó vagy elavult kulcs, rossz csoport
  vagy görbe) esetén a deploy megáll. Ha futáskor mégsem tölthető be vagy hibás, a Keresd meg! fül inaktív
  („Nem elérhető”), a Felolvasás érintetlen.

### 4a.4 Billentyűk

| Billentyű | Hatás |
|---|---|
| →, Space | következő feladat; az utolsón jutalom |
| ← | előző feladat |
| Tab / Shift+Tab, Enter | lépés a kártyák között, jelölés (akadálymentesség) |
| Esc | ADMIN |
| P, ↓ | nincs hatásuk |

---

## 5. Jutalom (REWARD)

- **F-R2** Minden képernyőn 10–15 lufi, pasztell színekkel, 90–140 px szélességben, lassú lebegéssel (±6 px, ±2°), felszállva (F-R9).
  Kis képernyőn a szélesség a rövidebb képernyőoldal 20–26%-a (legfeljebb 90–140 px). A lufi inkább a szél felőli
  oldalon indul, hogy átsodródjon a képen.
- **F-R3** Pukkasztás `pointerdown`-ra; a pukkanás 120 ms-os zsugorodás és 6–8 apró részecske. Hang nincs.
- **F-R4** Nincs pontszám, időnyomás, felirat (a lufiszámlálón kívül, F-R12). A találati terület a lufinál ~20%-kal nagyobb;
  átfedésnél csak a legfelső pukkan. A ✕ környéke (120 × 120 px) szabadon marad.
- **F-R5** Az utolsó pukkanás után **3 mp konfettieső**: színes papírdarabok hullanak a képernyő teteje
  fölül, lengve és forogva, az utolsó fél mp-ben elhalványulva. Utána a háttér 600 ms alatt vissza, majd ADMIN.
  Csökkentett mozgásnál álló, szétszórt konfetti, ugyanennyi ideig.
- **F-R6** Esc vagy ✕ bármikor kilép, a konfettieső alatt is. A kurzor a jutalom alatt végig látható, 32 px-es nyíl.
- **F-R7** A jutalom független a gyakorolt tételektől.
- **F-R13** **Animált fúvó:**
  - Az SVG-n belüli CSS-animációval (az `<img>`-ben is fut): a két hőhullám 0,7–0,9 mp-es ütemben
    hullámzik és lüktet, a test (cső + ház) 140 ms-onként ~0,7 px-et rezeg; a fogantyú és a kábel áll.
  - Szélcsíkok vásznon, a lufik mögött: a cső végéből (`nozzle()`, `js/core/drift.js`) ±12°-os
    legyezőben, ~22 csík/mp, lassulva, a képernyő szélességének ~55%-áig, közben elhalványulva. Csak
    díszítés, a lufik mozgását nem befolyásolja; iránya egyezik a szélével. A visszaváltáskor elhalványul.
  - Csökkentett mozgásnál egyik sincs.
- **F-R12** **Lufiszámláló:** a jobb felső sarokban `kipukkasztott/összes` (pl. `3/15`), a lufik
  megjelenésétől a jutalom végéig. 34 px-es, félkövér, a gyakorló számlálónál (20 px) nagyobb, hogy a
  gyerek is jól lássa; 600 px alatt 28 px. Minden pukkanásra frissül; a visszaváltáskor elhalványul.
- **F-R8** **Hőlégfúvó:** a jutalom alatt egy 128 px-es hőlégfúvó ikon (`img/hoslegfuvo.svg`) áll
  véletlenszerűen a bal vagy a jobb szélen, az alsó harmad közepén, 12°-kal felfelé fordítva. Jobb
  oldalt balra fúj; bal oldalt a függőleges tengelye körül tükrözve jobbra. Helyben marad, a jutalom végéig látszik; animált (F-R13).
  A lufik a fúvó **mögött** szállnak el (a fúvó takarja őket); a szélcsíkok a lufik mögött vannak.
- **F-R9** **Felszállás:** a kör végén a háttér 1,8 mp alatt papírszínről égkékre vált, a dekoráció
  elhalványul. Utána a lufik a képernyő alja alól úsznak be, 2,5 mp alatt elcsúsztatva, és
  felszállnak: egy lufi 8–12 mp alatt ér fel. A fúvó szele oldalra sodorja őket (átlagosan 20–40 px/s),
  a fúvótól távolodva gyengülve; ehhez kis véletlen lengés és a szél felé dőlés (max. 8°) jön.
  Ütközés nincs. A mozgás modellje `js/core/drift.js`, Node-ban tesztelve.
- **F-R10** A felül vagy oldalt kiment lufi alul, új helyen visszajön; a jutalom akkor ér véget,
  ha mind kipukkadt (F-R5).
- **F-R11** Érintés csak pukkaszt, a lufi mozgását nem befolyásolja. Csökkentett mozgásnál
  (`prefers-reduced-motion`) a lufik helyben lebegnek (F-R2, U-R1), és **nincs fúvó** (szél és szélcsík sincs).
- **F-R14** **Melyik jutalom – a gyerek választ:** két jutalomjáték van, a lufipukkasztás (5.) és a
  panda-ugrálás (5a.). Minden Felolvasás- és Keresd meg!-kör végén megjelenik a **jutalomválasztó**
  (CHOOSE, 12.5b): két kártya, balra (álló telefonon fent) a lufik, jobbra (lent) a panda. A gyerek
  választ, a választott játék indul. Véletlen sorsolás, időkorlát, automatikus választás, szülői beállítás
  és emlékezés az előző választásra nincs: induláskor egyik kártya sincs kiemelve.
  - **Sorrend:** kör vége (a háttér 1,8 mp alatt papír → ég, mint eddig) → a választó két kártyája
    beúszik → választás → a választott játék a saját belépőjével indul (a lufik felszállnak / a padok
    beúsznak), a saját égváltása nélkül, mert a háttér már ég → vissza ADMIN-ba, mint eddig.
  - **Bemenet:** az első 600 ms-ban minden bemenet elnyelődik. Koppintás / kattintás egy kártyára
    `pointerup`-ra azonnal indít, ha a lenyomás is a választón történt (a kör végi koppintás nem számít).
    Billentyű: ← a Lufit, → a Pandát emeli ki; Space, Enter vagy ↑ a kiemeltet indítja, kiemelés nélkül
    semmit (a kör végéről átjött → / Space-sorozat magától nem indít játékot). Egérrel a kártya fölé
    állva ugyanez a kiemelés jelenik meg; mindig egy kártya kiemelt, az utolsó bemenet (egér vagy nyíl) nyer.
  - **Választás után** a választott kártya azonnal kiemelt keretet kap, a másik 300 ms alatt elhalványul,
    utána a választott is (300 ms), majd indul a játék.
  - **Esc / ✕:** vissza ADMIN-ba, játék nélkül (F-R6); a ✕ úgy viselkedik, mint a jutalom alatt.
  - A cím `?jutalom=lufi` / `?jutalom=panda` paramétere rögzíti a játékot, és a választó kimarad
    (kipróbáláshoz, tesztekhez); érvénytelen érték nem számít. Logika: `js/core/choose.js` (választó),
    `js/core/rewards.js` (paraméter). A Haladás naplója a választást nem rögzíti.
  - A F-R6 (Esc, ✕, kurzor) és a F-R7 mindkét játékra és a választóra is érvényes.

---

## 5a. Panda-ugrálás (REWARD)

Gyorsan, kb. 15–30 mp alatt végigjátszható ügyességi játék, a lufipukkasztással azonos bonyolultságú.
Nincs pontszám, idő, felirat (a számlálón kívül), hang, büntetés, újrakezdés.

- **F-J1** **Kezdés:** a háttér 1,8 mp alatt papírszínről égkékre vált (mint F-R9). Utána alulról
  70 ms-onként egymás után beúsznak a bambuszpadok, és a panda felülről a legalsó (kiinduló) padra pottyan.
- **F-J2** **Pálya:** 7–9 ugrás a célig. A padok egy láncot alkotnak: mindegyik egy emelettel (S) feljebb van
  az előzőnél, és vagy egyértelműen balra/jobbra (vízszintesen 1,2–2,2 pandányi távolságra), vagy majdnem
  pontosan fölötte (legfeljebb 0,3 pandányi eltéréssel). Inkább cikcakkban halad, a padok a képernyőn
  belül maradnak. Az utolsó pad a cél (sárga, bambuszszárakkal, U-J4). Minden körben új, véletlen pálya.
- **F-J3** **Irányítás:** ← balra, → jobbra, ↑ (vagy Space) felfelé ugrik. Érintéssel/egérrel: a panda
  bal vagy jobb oldalára koppintva oldalra, a pandára vagy fölé (vízszintesen ±0,6 pandán belül) felfelé.
  Ugrás közben a bemenet nem számít (nincs előre lenyomott ugrás); nyomva tartott billentyű nem ismétel.
- **F-J4** **Segített ugrás:** ha a lenyomott irány a következő pad felé mutat, a panda egy ívben pontosan
  annak a közepére érkezik. Egy ugrás kb. fél másodperc.
- **F-J5** **A ↑ sosem veszélyes:** ha nincs fölötte a következő pad, a panda helyben ugrik egyet.
- **F-J6** **Leesés:** rossz oldalra ugorva a panda egy szokásos ívet ír le. Ha lefelé menet egy lejjebb lévő
  padra ér, ott megáll, és onnan folytatja; egyébként pörögve kiesik a képből. Ilyenkor a játék csendben
  véget ér: nincs szöveg, szomorú kép vagy újrakezdés; 0,5 mp múlva a háttér 600 ms alatt vissza, majd ADMIN.
- **F-J7** **Cél:** a cél padra érve a panda örül (U-J2), és 3 mp konfettieső jön (F-R5), utána a háttér
  600 ms alatt vissza, majd ADMIN.
- **F-J8** **Kamera:** ha a pálya nem fér ki, a nézet a pandával együtt finoman felfelé görget: az álló panda
  a képernyő ~70%-ánál van, a cél sosem kerül a felső margó alá, a kiinduló pad alatt nincs üres rész.
  Leesés közben a kamera megáll. A felhők lassabban mozognak (mélység).
- **F-J9** **Számláló:** a jobb felső sarokban `elért pad/ugrások száma` (pl. `3/8`), a F-R12 stílusában.
- **F-J10** **Irány-tipp:** az első ugrás előtt 0,5 mp múlva a panda mellett (vagy fölött) halvány, lüktető
  nyíl mutatja a jó irányt; az első lenyomásra eltűnik, többet nem jön.
- **F-J11** **Csökkentett mozgás:** nincs ív, pottyanás, guggolás és görgetési animáció: a panda azonnal az
  ugrás végére kerül (vagy leesés esetén eltűnik), a kamera azonnal áll be; a konfetti álló (F-R5).
- **F-J12** **Elforgatás:** álló panda mellett az elrendezés azonnal átméreteződik (a pálya alakja marad);
  ugrás közben a következő földet érés után.
- A pálya és a mozgás modellje `js/core/hop.js` (Node-ban tesztelve: a padok a képen belül, egyértelmű
  irányok, a jó irány a következő pad közepére visz, a ↑ nem ejt le, rossz irány leejt vagy lejjebb megáll).

---

## 6. Vizuális stílus

- Visszafogott, nyugodt, gyerekbarát, nem túldíszített. A tétel a vizuális középpont.
- Gyakorló háttér: sík papírszín (`--paper`) enyhe vignettával, három statikus folt a sarkokban;
  a középső 60% × 60% üres.
- Tokenek, layout és interakció: 12. fejezet.

### 6.1 Betűtípus
- **F-F1** A gyakorló betű **Arial** (`Arial, 'Arimo', Helvetica, sans-serif`). Ugyanez a tétel-előnézetben
  és a betűtesztben, hogy a szülő ugyanazt az alakot lássa, mint a gyerek.
- **F-F2 Betöltés-kapu:** ha a gépen van Arial (canvas-méréssel felismerve), az „Indítás” azonnal aktív.
  Ha nincs, az Ariallal azonos betűalakú **Arimo** töltődik a repóból (`fonts/`, OFL licenc); addig az „Indítás” inaktív,
  legfeljebb 5 mp-ig. Sikertelen betöltésnél aktív, figyelmeztetéssel: „A betűk alakja eltérhet.”
  Ha az Arimo később mégis megjön, a figyelmeztetés eltűnik.
- **F-F3 Betűteszt** (fejléc, jobb oldal): `a á e é i í o ó ö ő u ú ü ű` és nagybetűs párja 32 px-en,
  alatta az ellenőrzés eredménye (Arial / Arimo / nem a gyakorló betű). Feltétel: az `ő` és `ű`
  dupla hosszú ékezettel jelenik meg, nem `ô`/`û` alakban.

---

## 7. Nem funkcionális követelmények

- **N1** Hang semmilyen formában (nincs `Audio`, `AudioContext`, `speechSynthesis`, média).
- **N2** Statikus oldal, natív ES modulok, **build lépés és futásidejű függőség nélkül**. Az egyetlen
  külső kérés a listaforrás. Az oldal HTTP-n keresztül fut
  (GitHub Pages vagy `python3 -m http.server`); fájlként megnyitva nem.
- **N3** Időzítés abszolút határidővel: tételváltáskor `deadline = now + időtartam`, egyetlen
  `setTimeout` a határidőig. Pause-nál `remaining = deadline − now`, folytatáskor új határidő.
- **N4** A gyakorlónézetben fade csak a ✕-en és a pause-jelzőn van. `prefers-reduced-motion: reduce`
  esetén minden fade és lebegés kikapcsol; az időjelző ekkor is frissül (információ, nem díszítés).
- **N5** Hibatűrés: hibás vagy elérhetetlen `lists.txt`, üres lista, hiányzó tárolás, be nem töltött
  font nem okozhat összeomlást.
- **N6** Világos téma, explicit `body` háttérrel.
- **N7 Tesztelhetőség:** a logika a `js/core/` modulokban van, DOM nélkül. Tesztek: `node --test`
  (Node 20+), minden pushnál és PR-nél GitHub Actionsben. A tesztek a repó `lists.txt`-jét is
  ellenőrzik (hibás sor, túl hosszú tétel, és hogy néhány mintatétel megvan-e), így egy hibás commit pirosra vált,
  és a GitHub e-mailben jelzi, melyik sorral van baj. A Google táblázat tartalmát a CI nem ellenőrzi;
  annak hibáit a szülői felület figyelmeztetései mutatják (F-L1b), a tartalékra váltást pedig F-L13.
- **N8 PWA:** telepíthető webalkalmazás (`manifest.webmanifest`, `sw.js`).
  - Megjelenés `fullscreen` (tartalék: `standalone`), tájolás nincs rögzítve. Ikon: a jutalom lufija
    égszínű háttéren (`img/icons/`: 192, 512, maskable 512, apple-touch 180, SVG).
  - A service worker telepítéskor eltárolja a program fájljait (HTML, JS, CSS, betű, képek), és hálózat
    először stratégiával szolgál ki: online mindig a friss fájl jön (`no-cache`, ETag-gel olcsó), 3 mp
    után vagy hálózat nélkül a tárolt példány. Így új verzióhoz nem kell semmit léptetni.
  - Egy oldalbetöltés egy forrásból: a 3 mp-es döntés az oldalon születik, és az oldal többi fájlja
    ugyanonnan jön (hálózatról jött oldalhoz a hálózatról, tárolt példány csak hálózati hibánál; tárolt
    oldalhoz a tárolóból). Így egy kiadás után nem keveredik a régi és az új verzió. Tárolt példány
    nélkül a lassú első betöltés is megvárja a hálózatot.
  - A tárolóba csak az `ASSETS` fájljai kerülnek, query nélkül, és csak a ténylegesen kiszolgált hálózati
    válasz; aktiváláskor a többi bejegyzés törlődik (`test/sw.test.js`).
  - A `lists.txt`-t és a külső címeket (a Google táblázatot) nem kezeli; a listák offline állapotát a program jelzi (F-L8, F-L9).
  - A tárolólistát (`ASSETS`) a `test/pwa.test.js` egyezteti a repó fájljaival.
- **N9 Képernyőzár:** gyakorlás és jutalom alatt Screen Wake Lock, hogy a képernyő ne sötétüljön el;
  lap elrejtésekor a böngésző elengedi, visszatéréskor újrakéri. Ahol nincs ilyen API, nem jelez hibát.
- **N10 Környezetek és kiadás:** az éles a `main` ágból a `/olvasoka/`, a fejlesztői a `dev` ágból a
  `/olvasoka/dev/` címen fut; mindkettőt a `.github/workflows/deploy.yml` rakja össze és teszi ki.
  - A környezetet a cím dönti el (`js/core/env.js`: `/dev/` vagy helyi gép → dev). Nincs ágankénti
    beállítófájl, így a dev → main összevonás nem visz át dev-beállítást.
  - Az azonos origin miatt minden tárolt név környezetfüggő: localStorage `olvasoka` / `olvasoka-dev`,
    service worker tároló `olvasoka` / `olvasoka-dev`; az éles service worker a `/dev/` alatti
    kéréseket nem kezeli. Az éles a régi neveket tartja, így a meglévő beállítások megmaradnak.
  - A listák táblázata környezetenként GitHub repository variable-ökből jön (`PROD_SHEET_CSV_URL`,
    `PROD_SHEET_EDIT_URL`, `DEV_SHEET_CSV_URL`, `DEV_SHEET_EDIT_URL`); a deploy workflow írja a kiadott
    `js/core/config.js`-be. Ami nincs beállítva: az éles a repó alapértéke, a dev az éles címe.
  - A dev telepítve „Olvasóka DEV” néven, sötét hátterű ikonnal jelenik meg; a fejlécben piros „DEV” címke.
    A dev verziója mellett `+N` utótag: a `main`-ben még nem lévő (merge nélküli) commitok száma; csak a
    kiadott fájlba kerül, a repóba nem.
  - A `dev`-re és a `main`-re a bot nem pusholhat (kötelező ellenőrzések), ezért a workflow-k csak
    előkészítenek, a PR-t a tulajdonos nyitja: a kiadás-előkészítő `release/vX.Y.Z` ágat és két linket ad
    (verzió-PR a `dev`-be, kiadási PR a `main`-be); a `sync-dev.yml` issue-t nyit, ha a `main`-en a
    `dev`-ből hiányzó változás van (hotfix, infra), és lezárja, ha a `dev` utolérte.
  - Menet: feature-ág → PR a `dev`-be → kipróbálás a dev oldalon → PR `dev` → `main` (merge commit) →
    automatikus `vX.Y.Z` tag. A main-be csak `dev`, `hotfix/*` vagy `infra/*` ágból mehet PR, és
    (az `infra/*` kivételével) léptetett `js/version.js` verzióval (`release-check.yml`).
  - Kiadás után füstteszt az élő oldalon (`e2e/smoke.mjs`, headless Chrome): a `/` éles, DEV címke
    nélkül; a `/dev` és a `/dev/` a dev oldal DEV címkével, telepített éles service workerrel is;
    mindkettőn van verziószám, és a most kiadott verziót mutatja; a dev verziója ≥ az élesé.

### 7.1 Felépítés

```
index.html          markup
lists.txt           a listák
css/                tokens · szülői felület · gyakorló és jutalom
js/core/            tiszta logika: sequence, round, items, lists, csv, source, selection, settings, drift, hop, rewards, cover, env, config
js/version.js       a program verziója (N10)
js/data/            store (localStorage), remote (lists.txt letöltése)
js/ui/              admin, practice, find, reward (lufi), panda, confetti
js/font.js          betűtípus-kapu
js/main.js          indítás, állapotváltás
test/               node --test
```

Függőségi irány: `core` ← `data` ← `ui` ← `main`. A `core` nem importál a többiből.

---

## 8. Éles esetek

| Eset | Elvárt viselkedés |
|---|---|
| Első megnyitás, a letöltés folyamatban | „Listák töltődnek…”, az „Indítás” inaktív |
| A táblázat nem érhető el / nincs közzétéve / üres | `lists.txt`, a listák alatt „Tartalék lista: lists.txt” (F-L13) |
| A táblázat egy-egy cellája hibás | A táblázat látszik, a hibás cella kimarad, figyelmeztetés a cellával |
| Táblázat és `lists.txt` sem érhető el | A legutóbbi példány, figyelmeztetés mindkét hibával (F-L9) |
| A `lists.txt` nem tölthető le, van korábbi változat | A korábbi listák, figyelmeztetéssel |
| A `lists.txt` nem tölthető le, nincs korábbi | Üres állapot a hibaüzenettel, „Indítás” inaktív |
| Sor az első listanév előtt / üres listanév | Kimarad, figyelmeztetés a sorszámmal |
| Azonos nevű listák | A második kimarad, figyelmeztetés |
| Túl hosszú tétel | Kimarad, a figyelmeztetés megnevezi |
| Ismétlődő tétel egy listán belül | Csendben kimarad; a teszt tájékoztat, de nem bukik |
| A legutóbb kijelölt listák egy része már nincs a fájlban | Az a rész kimarad; ha egy sem marad, az első lista lesz kijelölve |
| Üres lista kiválasztva | „Indítás” inaktív: „A listában nincs tétel.” (több listánál: „A kijelölt listákban nincs tétel.”) |
| Összes lista, mind üres | „Indítás” inaktív: „Egyik listában sincs tétel.” |
| Font még töltődik (nincs Arial) | „Indítás” inaktív, max. 5 mp |
| Tételszám > tételek száma | Több keverés egymás után |
| Lista hossza = 1 | Ugyanaz a tétel ismétlődik, megengedett |
| Felvillanás = 0 | Kézi léptetés, nincs időjelző |
| Space / → a szünetben | Azonnal a következő tétel (az utolsó után: jutalom) |
| ← a szünetben | A most lejárt tétel, teljes idővel |
| Pause alatt Space | Nincs hatása |
| Pause alatt ← / → | Lép és folytat; ← az első tételen: pause marad |
| → az utolsó tételen | Jutalom |
| Nyomva tartott billentyű | Csak az első lenyomás számít |
| Esc közben | Azonnal ADMIN, nincs jutalom |
| Fül háttérbe / fókuszvesztés | Automatikus pause |
| Ablak átméretezése | A betűméret és az időjelző újraszámolódik |
| Tárolás nem elérhető | Működik, figyelmeztetéssel |
| Takarás egyszótagú tételen (`↓`, kattintás) | Nincs hatása; koppintás: NEXT |
| Takarás a szünetben (`gap`) | Nincs hatása |
| Első takarás futó idő alatt | Pause, pause-jelzővel |
| Takarás kézi léptetésnél / pause alatt | Takar, az idő állapota nem változik |
| Minden szótag letakarva | Megengedett |
| `↓` kézzel kevert takarásnál | „Csak az 1. szótag” állapot |
| Tételváltás takarás közben | Az új tétel egészben látszik |
| Átméretezés takarás közben | A takarók a tétellel együtt méreteződnek, az állapot marad |
| `ka--ta`, `-ka`, `ka-` | Üres szakasz nem szótag: rendre 2, 1, 1 szótag |
| Nagyon keskeny szótag (pl. `i`) | Rövid vonalzó, legalább az első 10-es vonással; nem szélesedik a kötőjel felé |
| Vonalzó és időjelző közel | A vonalzó alsó éle min. 4 px-re az időjelző fölött; az időjelzőt nem fedi |
| Két szomszédos szótag letakarva | Két külön vonalzó, köztük a kötőjel látszik |
| Keresd meg!: a forrásban 1 különböző tétel | „Indítás” inaktív: „Legalább két különböző tétel kell.” (F-S8) |
| Keresd meg!: kevesebb tétel, mint a kártyaszám | Kevesebb kártya, az utolsó sor középen (F-K3, F-K12) |
| Keresd meg!: 8 kártya, telefonon indítva | 6 kártya; a tárolt beállítás 8 marad (F-K10) |
| Keresd meg!: forgatás kör közben | A kártyaszám marad, az elrendezés vált (F-K12) |
| Keresd meg!: ← az első feladaton | Nincs hatása, a ◀ inaktív |
| Keresd meg!: koppintás a kártyák közé | Nincs hatása (F-K8) |
| Keresd meg!: tárolt `mode: find`, a `parok.json` nem használható | Felolvasás nyílik, a fül inaktív; a tárolt `mode` marad (F-S3, F-K18) |
| Keresd meg!: a forrásban 2 különböző tétel | A feladatok horgonya váltakozik (F-K16) |

---

## 9. Elfogadási kritériumok

Az „automata” jelölésűeket a `test/` alatti tesztek ellenőrzik.

1. *(automata)* 4 tételes listával és 10-es körrel: az első 4 és a következő 4 tétel mindegyike pontosan
   egyszer szerepel, az utolsó 2 különböző; a 4–5. és a 8–9. tétel nem azonos. 500 seeddel.
2. *(automata)* `L > 1` esetén soha nincs két azonos index egymás után.
3. A felvillanási idő 0 és 25 mp között állítható; az átváltás a beállított idő ±100 ms-on belül történik.
4. *(automata)* Pause megállítja az időt, folytatáskor a hátralévő idő fut le. ← az előző tételt,
   a szünetben a most lejártat hozza, teljes idővel.
5. *(automata)* Pause alatt ← és → lép és folytat. → és Space az utolsó tételen jutalomra vált.
6. *(automata)* Felvillanás = 0 esetén nincs automatikus váltás.
7. Gyakorlás közben egérmozgás nélkül a tétel, az időjelző, a haladásjelző, a vezérlősor és a dekoráció
   látszik (pause alatt + pause-jelző); a ✕ egeres eszközön nem, érintőképernyőn igen.
8. Az időjelző a hátralévő idővel arányosan fogy, pause alatt áll.
9. Egy körön belül minden tétel azonos betűmérettel és alapvonallal jelenik meg; a leghosszabb is egy
   sorban, levágás nélkül elfér, és nem fedi az időjelzőt vagy a vezérlősort.
10. A kör végén átmenet, majd 10–15 lufi; minden kattintás egyet pukkaszt, hang nélkül; az utolsó után
    ADMIN. A kurzor a jutalom alatt végig látható.
11. Esc a gyakorlásból és a jutalomból is ADMIN-ba visz.
12. *(automata)* A tisztítás NFC-normalizál, megtartja a kis-/nagybetűt, eldobja a `#`-es és ismétlődő
    tételt, jelzi a túl hosszút.
13. *(automata)* A `lists.txt` hibatűrő értelmezése; a repó `lists.txt`-je hiba nélkül értelmezhető, és a mintatételek megvannak benne.
14. A betűteszt `ő`, `ű`, `Ő`, `Ű` karakterei dupla ékezettel, Arialban (vagy Arimóban) jelennek meg.
15. A beállítások és a kijelölt lista újratöltés után megmaradnak; hálózat nélkül a legutóbbi listák látszanak.
16. A táblázat módosítása után a Frissítés legfeljebb ~5 percen belül az új listát mutatja.
17. Sehol nincs hanglejátszás.
18. *(automata)* `ka-ta` tételen a `↓` négyszer: egész → csak `ka` → csak `ta` → egész. Háromszótagúnál
    öt lépés zárja a kört. Kevert takarásnál a `↓` a „csak az 1.” állapotra ugrik. Egyszótagú tételen
    és `gap` fázisban nincs hatása.
19. *(automata)* Futó időnél az első takarás pause-t ad; felfedés nem folytat; P után a hátralévő idő
    fut le a takarással együtt. Bármely tételváltás után `covered` üres.
20. Egy szótagra kattintva/koppintva csak az takaródik le, vonalzóval; a kötőjel látszik; a takarás előtti és utáni
    képernyőképen a nem takart betűk pixelre egyeznek. Érintőképernyőn a tételen kívüli koppintás lép.
21. Takarási művelet nélkül a gyakorlónézet pixelre ugyanaz, mint a 2.7-ben, a kisebb betűmérettől (F-P13) eltekintve.
22. *(automata)* `rulerGeometry`: a vonások a vonalzón belül vannak (0,05 em-től a jobb vég − 0,03 em-ig),
    a lépésköz 0,045 em, a hosszminta 10/5/1 szerint 0,16 / 0,11 / 0,06 em; az alsó él az időjelző
    teteje − 4 px fölött van; a kötőjel felőli oldalon nincs ráhagyás.
23. *(automata)* A Keresd meg! kör indulásakor pontosan K feladat készül; mindegyikben a kártyaszámnyi
    (vagy az összes elérhető) különböző tétel, csak a kör forrásából. Seedelt `rng`-vel determinisztikus.
24. *(automata)* ← után ugyanaz a feladat jön vissza, ugyanabban a sorrendben, jelölés nélkül.
25. *(automata)* Kattintás jelöl, ugyanarra újra lekerül, másikra átkerül; egyszerre legfeljebb egy
    kártya jelölt; a jelölés nem léptet.
26. *(automata)* → és Space az utolsó feladaton jutalomra vált; ← az elsőn nincs hatással.
27. Telefonon (390×844 és 844×390) 8-as beállításnál 6 kártya látszik, a beállítás 8 marad; tableten 8.
28. Az elrendezés a 4a.3 táblázata szerinti álló és fekvő nézetben; mobil fekvőben a nyilak a rács két
    oldalán vannak.
29. Egy feladaton belül minden kártyán azonos a betűméret; a leghosszabb tétel is levágás nélkül elfér.
30. A nehézség első indításkor 1, újratöltés után a legutóbb választott; a feladatok száma alapból 10.
31. A Keresd meg! nézetben nincs szöveg, szám, idő- vagy pontjelző; jelöléskor nincs hang és nincs
    jó/rossz szín. Koppintás a kártyák közé nem léptet.
32. *(automata)* Két egymást követő feladat horgonya sosem azonos (F-K16), két tételes forrásnál is.
33. *(automata)* A deploy-kalibrálás kártyaszámonként (4, 6, 8) érvényes görbét ír; a táblázat nélkül a
    `lists.txt`-ből; hibás `parok.json`-nál nem nulla kilépési kóddal megáll (F-K17, F-K18).
34. A Keresd meg! minta 320 px széles nézetben is minden tételt teljes egészében, levágás és kilógás nélkül
    mutat, 8 kártyás beállítással és háromszótagú tételekkel is.
35. *(automata)* Panda-ugrálás: a pálya minden képernyőméreten (320×256-tól 1920×1080-ig) a képen belül van,
    minden lépés iránya egyértelmű, és a jó irány a következő pad közepére visz; a ↑ sosem ejt le; rossz
    oldalra ugorva leesik, vagy egy lejjebb lévő padon megáll (F-J2–F-J6).
36. *(automata)* A kör végén a jutalomválasztó jön, egyik kártya sincs kiemelve; az első 600 ms-ban
    nincs választás; ← → kiemel, Space / Enter / ↑ a kiemeltet indítja, kiemelés nélkül semmit; koppintás
    a kártyára indít; Esc játék nélkül ADMIN-ba visz; a `?jutalom=` paraméterrel a választó kimarad (F-R14).
37. Panda-ugrálás végigjátszva billentyűvel és koppintással is 30 mp alatt; a célnál konfetti, leesésnél
    csendes visszatérés; Esc és ✕ bármikor kilép. Telefon álló és fekvő nézetben is játszható.
38. *(automata)* A jutalomválasztó két kártyája 1280×800-tól 320×256-ig a képen belül, egymást nem fedve
    látszik; álló telefonon egymás alatt (Lufi fent), egyébként egymás mellett (Lufi balra) (12.5b).

---

## 10. Döntési napló

**Interjú (1.0):** csak szöveg, kép nincs; a beírt kis-/nagybetű jelenik meg; több elnevezett lista;
húzózsák elv; automatikus váltás állítható szünettel, Space előrehoz; billentyűk és szöveg nélküli
ikonok; lufipukkasztó jutalom; laptop/asztali gép; hang egyáltalán nincs.

**Technikai review (1.1):** teljes képernyő nem kell; font-betöltés kapuja; billentyű-ismétlés eldobva;
fade csak az ikonokon; pause alatti navigáció lép és folytat; `#`-es tétel kimarad; vágólap-tartalék;
határidő-alapú időzítés.

**UX-terv (1.2):** komponens- és ikon-library nincs, saját tokenréteg és inline SVG; papírszerű,
egyszínű kiemelésű felület (12. fejezet); S1 azonnali indulás; S2 egérrel pukkaszt; S3 sík papír háttér.
Az S4 (explicit mentés) a 2.0-ban tárgytalan, mert az alkalmazásban nincs szerkesztés.

**Használat közbeni visszajelzések és a GitHub-költözés (2.0, 2026-11-07):**

| Döntés | Indok |
|---|---|
| Felvillanás alapértéke 10 mp, tartománya 0–25 mp | A gyereknek több idő kell; a 3 mp kevés volt. |
| 0 mp = kézi léptetés | A szülő diktálja a tempót, ha a gyerek elakad. |
| Arial betűtípus | A szülő döntése; az iskolai anyagokkal egyező betűalak. Az Andika és a Didact Gothic kipróbálva, elvetve. |
| Számláló a sarokban | A szülőnek látnia kell, hol tart a kör. Felülírja az 1.0 „nincs haladásjelző” döntését. |
| Időjelző a tétel alatt | A gyerek látja, mennyi ideje van még. Felülírja az 1.0 „nincs időjelző” döntését. |
| A vezérlősor végig látszik | Egérrel is gyorsan kezelhető, nem kell előbb megmozdítani. |
| → az utolsón jutalomra vált | Az 1.1-es tiltás használatban zavaró volt: a → „nem működött”. |
| Ismétlődő tétel kimarad | Két egyforma tétel egymás után zavaró volt; egy listán belül az ismétlésnek nincs értelme. |
| Összes lista mód | Vegyes ismétlés több leckéből. |
| Több lista kijelölése (Ctrl/Shift, keskeny nézetben jelölőnégyzet) | Vegyes ismétlés néhány kiválasztott leckéből; a listák száma nőni fog, ezért a Shift-tartomány is. |
| Forrásválasztó és kijelölés szinkronban | Ne lehessen ellentmondó állapot (minden kijelölve, de „Kijelölt listák”); a választó gyorsgomb a kijelöléshez. |
| Több listánál nincs kiegyenlítés | Egyszerű, és egyezik az „Összes lista” működésével; később bevezethető. |
| Név: Olvasóka | A szülő választása. |
| GitHub Pages, ES modulok, build nélkül | Hostolt listák; a claude.ai artifact nem tölthet be külső fájlt. |
| Listák a repóban, az appban csak olvashatók (A változat) | Egy adatforrás, nincs bejelentkezés és token. Szerkesztés a GitHubon, telefonról is. A vegyes (B) és a visszaíró (C) változat elvetve. |
| `lists.txt` a `lists.json` helyett | A JSON idézőjelei és vesszői telefonon könnyen elronthatók; a szöveges formátumban egy sor egy tétel. |
| Ismétlődő tétel: az app csendben kihagyja, a teszt csak tájékoztat | Az ismétlés a forrásban szándékos lehet (oldal végi ismétlő sor); a gyakorláshoz elég egyszer. |
| A repó tesztje mintatételeket keres | Ha egy lista véletlenül elveszik vagy csonkul, a commit pirosra vált. Szándékos átírásnál a mintát is frissíteni kell. |
| Publikus repo | Ingyenes Pages; a listák tartalma nem érzékeny. |

**Google táblázat forrás (2.4):**

| Döntés | Indok |
|---|---|
| Elsődleges forrás a közzétett Google táblázat, oszloponként egy lista | Telefonról egyszerűbb szerkeszteni, mint a `lists.txt`-t a GitHubon. |
| Tartalék a repó `lists.txt`-je, nem frissül automatikusan | A szülő kézzel frissíti, ha kell; a tartalék független a táblázattól. |
| Sorrend: táblázat → `lists.txt` → legutóbbi példány | Kiszámítható; a tartalék akkor is a repóé, ha a tárolt táblázat frissebb volna. |
| Diszkrét jelzés a listák alatt | A szülő lássa, de ne zavarja; a gyereknek nem szól. |
| `?source=` URL-paraméter, angol kulcsokkal | Ideiglenes, a felületen nem látszik, telefonon is gyorsan váltható, könnyű kivenni. |
| A kapcsoló kivéve (2.5) | A táblázat bevált; egy forrás, egy szerkesztő link. A tartalék megmarad. |
| A táblázatot a CI nem ellenőrzi | A hibakezelés a programban van (kihagy és jelez, F-L7). |
| Kör-logika tiszta reducerben, `node --test`, GitHub Actions | Az időzítés és a navigáció automatikusan tesztelhető; hibás lista már a commitnál kiderül. |

**Szótag-takarás (2.8, 2026-11-08):**

| Döntés | Indok |
|---|---|
| A szótagokat a listában már meglévő kötőjel jelöli | Nincs új adatformátum; a könyv és az iskola is így írja (`ka-ta`). |
| A kötőjel marad, szótagív nincs | A szülő döntése; a gyerek a könyvben is kötőjellel látja. |
| Alapból minden látszik, a program sosem takar magától | A takarás a szülő és a gyerek közös munkája, a szülő dönti el, mikor és mit. |
| Kattintás/koppintás a szótagra + `↓` léptetés | Közvetlen, mint a vonalzó a könyvön; a `↓` a vakon vezérelhetőséget adja (U-E3), a sorrendje az iskolai módszert követi. |
| Az első takarás pause-t ad | A takarásos olvasás nem fér bele a felvillanási időbe; a gyerek ne kapkodjon. |
| Tételváltáskor visszaáll | Minden új tételnél ugyanaz a kiindulás; nincs rejtett állapot. |
| A takaró a kör közös tinta-dobozát fedi, kis ráhagyással, az időjelző fölött megállva | Ne lógjon ki ékezet vagy szár, ami elárulná a szótagot; minden takaró egyforma; az első prototípusban a nagy ráhagyás belelógott az időjelzőbe. |
| A „Keresd meg!” módban egyelőre nincs takarás | Négy tételnél nem egyértelmű, melyik takarása a cél. |
| A takaró vonalzó | Iskolai tárgy, amit a gyerek ismer, és otthon is ezzel takarnak; a beosztás ismétlődik, ezért bármilyen szótaghosszra természetesen nyújtható; visszafogott, nem viszi el a figyelmet a betűkről. |
| Elvetett takarók | Sima téglalap („random téglalap” hatás), tépett füzetlap, behajtott cetli, felhő, radír, ragasztószalag, tenyér (kipróbálva). A tenyér tetszett, de csak egyenletesen skálázható, keskeny szótagnál apró, és az ingujj fedi az időjelzőt. |
| Nincs szám a vonalzón | A gyerek nézetében nincs szöveg és szám (U-E4); a számok a betűkkel versengenének. |

**Fejlesztői és éles környezet (2.9, 2026-11-09):**

| Döntés | Indok |
|---|---|
| Két környezet (dev, éles), külön QA nincs | Egy fejlesztő, statikus oldal: a dev egyben a tesztkörnyezet. |
| Mindkettő ugyanazon a GitHub Pages oldalon, a dev a `/dev/` almappában | Nincs új hosting szolgáltatás. |
| Minden futás a teljes oldalt rakja össze | A Pages egyszerre egy csomagot tesz ki; az éles a változatlan `main`-ből bájtra azonosan épül újra. |
| A környezetet a cím dönti el, nem ágankénti fájl | Az összevonás nem visz át beállítást a dev-ből az élesbe. |
| Az éles tárolási nevei változatlanok | A meglévő felhasználók beállításai és letöltött listái megmaradnak, migráció nélkül. |
| A táblázat címe repository variable-ből | A cím kódmódosítás és kiadási PR nélkül cserélhető; a repó alapértéke a helyi futtatást és a teszteket szolgálja. |
| Verziószám a fejlécben | Egy eszközön ránézésre látszik, melyik kiadás fut; a service worker hálózat-először stratégiája miatt a frissítéshez nem kell. |

**Keresd meg! (2.10, 2026-11-10):**

| Döntés | Indok |
|---|---|
| A szülő mondja ki a kártyát, a gyerek mutat rá; a program nem tudja a jó választ és nem értékel | A szülő vezeti a tanulást, a program csak eszköz; nincs pontozás és „hibás” állapot. |
| Csak a kijelölt listákból, ugyanazzal a forrásválasztóval | A gyerek azt látja, amit a könyvben már tanult. |
| A szülői felületen egy jobb panel, két fül, egyetlen Indítás | Egy mentális modell; a külön panel két Indítással (A koncepció) zavaró volt. |
| Nehézség: 5 fokozatú csúszka, első használatkor a legkönnyebb, utána megmarad | A Meixner-módszer a hasonló betűket időben távol tanítja; a tájékoztató ezt indokolja, a szülő tudatosan lép feljebb. |
| A felületen „Feladatok száma”, a Nehézség fölött | A „Rácsok a körben” nehezen érthető volt; a kör hosszát ez adja, ezért kiemelt helyen van. |
| Játéknézet: egyszerre látható rács (B koncepció) | A felvillanó tételből nyíló rács (C koncepció) a léptetéssel, takarással, idővel bonyolult állapotot adna. |
| Telefonon legfeljebb 6 kártya, a beállítás megmarad | 8 kártyánál a kártya álló nézetben ~130 px széles, fekvőben ~100 px magas: egy 7 évesnek túl kicsi. |
| Mobil fekvőben a nyilak oldalt | Alul nem maradna elég magasság a kártyáknak. |
| Játékonkénti „Így játsszátok” súgó | A két játék vezérlése eltér; az általános Súgó nem nőhet tovább. |
| Alapértelmezett kártyaszám 4; feladatok száma 1–30; egyszerre egy jelölés; a kártyák közé koppintás nem léptet; a 2–4. fokozat szövege (U-A8) | A 11. fejezet javaslatai, a tartalomgazda megerősítette. |
| Két egymást követő feladat horgonya nem azonos (F-K16) | Ugyanaz a kimondható kártya egymás után unalmas, és a gyerek a helyéből is kitalálhatja. |
| A nehézségi görbe kiadáskor a táblázat listáján, kártyaszámonként (F-K17) | A lépcsők a tényleges listán legyenek egyenletesek; a görbe nem kerül a repóba, mert a lista a táblázatban változik. |
| Kalibrálás tartaléka a `lists.txt`, a deploy nem áll meg | A táblázat átmeneti elérhetetlensége ne akadályozza a kiadást. |
| A mintasor mobil fekvőben (E10) rejtve | Nem fér el; a beállítás e nélkül is érthető. |
| Második jutalom: panda-ugrálás, körönként váltakozva a lufival (2.12) | A gyerek ne unja meg a jutalmat; egyetlen lufis játék sokadszorra már kevésbé motivál. A váltakozás kiszámítható, nincs szülői beállítás. |
| Segített ugrás és veszélytelen ↑ | Egy 7 éves a nyíl irányát könnyen eltalálja, a pontos időzítést nem; a kihívás az irány, nem az ügyesség. |
| Leesésnél csendes vége, nincs újrakezdés | Jutalomról van szó: nincs kudarcélmény, és a kör nem nyúlik meg. |
| A jutalmat a gyerek választja, a véletlen váltakozás helyett (2.13) | A gyerek tudja, mit szeretne; a választás maga is jutalom. Felirat nincs (U-E4), a két kép önmagáért beszél. Nincs szülői beállítás és emlékezés az előző választásra: mindkét játék mindig egyenlő eséllyel indul. |
| Rögzített kártyasorrend, kiemelés nélküli indulás, 600 ms-os bemenetzár | Ugyanazon a helyen van mindig ugyanaz, így a gyerek megtanulja. A kör végi →/Space-sorozat ne indítson játékot magától. |
| A minta tördelődő címkesor, nem fix rács | Keskeny nézetben (360–390 px) a 6 oszlopos rács ~55 px-es cellájából a háromszótagú szavak kilógtak; a betű kicsinyítése 11–12 px-et adna, ami olvashatatlan. |

---

## 11. Nyitott pontok

- Pause alatt a Space nem léptet (F-P3). Takarás után a szülő pause-ban van, ezért a Space nem visz
  tovább, csak a → / ▶ / koppintás. Használat után dönteni: kapjon-e a Space is F-P7a szerinti
  léptetést pause alatt.

- A „44. oldal” listában szereplő `sk` tétel valószínűleg elírás; a tartalomgazda ellenőrzi.
- A 12. fejezet számértékeitől ±20%-on belül indoklás nélkül el lehet térni; a színektől csak a
  kontrasztkövetelmény (12.6) megtartásával.

---

## 12. UX-specifikáció

### 12.1 Tervezési elvek
- **U-E1 Két közönség, két karakter.** A szülői felület eszköz: sűrű, gyors, szöveges. A gyerek nézetei
  szinte üresek, egyetlen fókusszal.
- **U-E2 Rövid fő út.** Megnyitás → a legutóbbi lista kijelölve → „Indítás” (vagy Ctrl+Enter).
- **U-E3 Vakon vezérelhető.** Minden gyakorlás közbeni művelet billentyűvel megy, fókusztól függetlenül.
- **U-E4 A gyerek nézet nem „alkalmazás”.** Nincs fejléc, menü, szöveg, logó. A haladásjelző és a
  vezérlősor visszafogott, a tételnél jóval kisebb vizuális súlyú.
- **U-E5 Tiltott klisék.** Színátmenetes gombok és hátterek, üveghatás, emoji ikonként, árnyékos
  kártyarács, pill badge-ek. Helyette: sík, papírszerű felület, egy kiemelőszín, vékony vonalak.

### 12.2 Design tokenek

| Token | Érték | Használat |
|---|---|---|
| `--paper` | `#F5F0E6` | alap háttér |
| `--paper-2` | `#ECE5D6` | kijelölt lista, hover, dekoráció |
| `--line` | `#D9CFBE` | vonalak, keretek, az időjelző sávja |
| `--ink` | `#1E2A32` | tétel, fő szöveg |
| `--ink-2` | `#5A6670` | másodlagos szöveg |
| `--accent` | `#2E6B66` | elsődleges gomb, kijelölés, fókusz, az időjelző kitöltése (75%) |
| `--warn` | `#94560F` | figyelmeztetés |
| `--error` | `#A23B2A` | hiba |
| `--sky` | `#DCE9EF` | jutalom háttér |
| `--ruler` | `#F4E3A1` | szótag-takaró vonalzó teste |
| `--ruler-edge` | `#C9B26A` | a vonalzó kerete |
| `--ruler-tick` | `#8C7638` | a vonalzó beosztása |
| `--ruler-bevel` | `#E6D18A` | a vonalzó élvonala |

Lufik: `#F2B5A7` · `#F5D58F` · `#B5D5BB` · `#A7C8E0` · `#CBB8DE` · `#EFC2D3`, fehér, 25%-os fényfolttal.

Tipográfia: tétel Arial 400 (F-F1); szülői felület `system-ui`, 13 / 15 / 18 / 24 px, alap 15 px;
számok `tabular-nums`. Térköz 4 px-es rács. Sarok: 6 px vezérlők (`--r-ctl`), 10 px dialógus, módfül, nagy gomb
(`--r-dlg`, `--r-card`), 18 px az alsó lapok felső sarka (`--r-sheet`). A jobb panel szélessége `--panel-w` (360 px).
Időtartamok: 150 ms (hover), 300 ms (fade), 1800 ms (jutalom háttér).

### 12.3 Szülői felület

A részletes design specifikáció (elrendezés, komponensek, reszponzív viselkedés, döntések):
[Olvasóka – design specifikáció: új szülői felület és Felolvasás](https://claude.ai/artifact/VYwYQy3jmn2MCqwWwT7BCd).

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Olvasóka                                                    Súgó   Betűteszt   │
├───────────────────────────────────────────────────────────────────────────────┤
│ ▌ figyelmeztetések (ha vannak)                                               ✕ │
├────────────────┬───────────────────────────────────┬──────────────────────────┤
│ LISTÁK         │ 45. oldal                46 tétel │ [Felolvasás][Keresd meg!]│
│ ▌45. oldal  46 │ [f] [m] [k] [l] [c] [ó] [ú] …     │  leírás   (Így játsszátok)│
│  44. oldal  59 │ ───────────────────────────────── │ Tételek [Kijelölt|Összes]│
│  Á-A-E      27 │ Frissítve: 20:49 [Frissítés] ↗    │ Felvillanás ──●── 10 mp  │
│                │                                   │ Szünet [0|0,5|1|2|3]     │
│                │                                   │ Tételek a körben − 10 +  │
│                │                                   ├──────────────────────────┤
│                │                                   │ 10 tétel · kb. 1 perc…   │
│                │                                   │ [       Indítás        ] │
│                │                                   │ Ctrl+Enter indít         │
└────────────────┴───────────────────────────────────┴──────────────────────────┘
```

Elrendezések: desktop (≥ 900 px) a fenti; álló tablet (601–899 px) a listák pipálható chipekként felül,
alattuk a panel kártyaként, az Indítás a képernyő aljára tapadó sávban; mobil (≤ 600 px) a listák
egy lenyíló sorból nyíló alsó lapon (Mind / Egyik sem, tételszámok, Kész; a listák és alattuk a „Listák
szerkesztése a táblázatban” link együtt görgetnek, a fejléc és a Kész mindig látszik; alacsony fekvő nézetben a lap
szinte a teljes magasságot kapja, a Kész az összesítő mellett, így 256 px-en is legalább két lista látszik); mobil fekvő
(`max-height:500px` és fekvő, desktopon alacsony ablakban is) két oszlop, külön fejlécsor nélkül:
balra a cím, a verziócímke és ikonos Súgó/Betűteszt gomb, alattuk listák, fülek, súgógomb (700 px alatti
szélességen a cím elmarad, a verziócímke marad); jobbra a görgethető beállítások, alattuk az Indítás.
A jobb oszlop a teljes magasságot kapja, a bal oszlop tartalma nem tolhatja le az Indítást: 256 px
magasságig görgetés nélkül látszik (#40). Keskeny fekvő nézetben (568 px-nél keskenyebb, ez valódi telefonon nem fordul elő, csak nagyításnál
vagy összehúzott ablakban, pl. 400% → 320 × 256) az álló mobil elrendezése érvényes: ikonos fejléc, egy
görgethető oszlop, alul tapadó Indítás-sáv (#44).

**Legkisebb támogatott méret (WCAG 1.4.10, Reflow):** 320 CSS px szélesség és 256 CSS px magasság. Ennél
kisebb ablakban a szülői felület helyett teljes képernyős tájékoztató jelenik meg („Túl kicsi a képernyő”):
fekvő érintőképernyőn az elforgatást kéri, máshol nagyobb képernyőt vagy ablakot. Csak CSS; a gyakorlás és
a jutalom közben nem jelenik meg, a nyitott párbeszédablakokat elrejti (elforgatás után visszajönnek), és
számbevitel közben (felugró billentyűzet) sem jelenik meg.

- **U-A1** Listasáv: névsorban (F-L2), név mellett a tételszám. Kijelölt: `--paper-2` háttér +
  3 px `--accent` bal szegély, `aria-pressed`. Kattintás: csak az a lista. Ctrl/⌘+kattintás: hozzáad vagy
  kivesz; az utolsó kijelölt nem vehető ki. Shift+kattintás: tartomány a legutóbb kattintott listától
  (Ctrl/⌘+Shift: a tartomány hozzáadódik). A sáv alján halvány súgósor, ha legalább két lista van.
  Érintős elsődleges mutatón (`pointer:coarse`, pl. fekvő iPad) a koppintás hozzáad vagy kivesz, mintha
  Ctrl lenne lenyomva; egérrel minden a régi. 900 px alatt a lista fölött jelölőnégyzetes chipek
  „2 lista · 38 tétel” összesítővel, 600 px alatt lenyíló sor és alsó lap; ezeken is hozzáad vagy kivesz
  a pipa, az utolsó itt sem vehető ki (a mobil lapon a „Egyik sem” kiürítheti, ekkor az Indítás tilt).
- **U-A2** Megnyitáskor a `lastLists` szerinti listák, amelyik megvan; ha egy sem, az első.
- **U-A3** A kijelölt lista tételei vékony keretes címkékként, Arialban, a fájlbeli sorrendben. Több
  kijelölt listánál a fejléc „3 lista kijelölve · 47 különböző tétel”, alatta listánként csoportosítva
  a név, a tételszám és a címkék.
- **U-A4** Forrássor: frissítési állapot, „Frissítés” gomb, szerkesztő link (F-L11); alatta szükség esetén
  a tartalék jelzése (F-L13), 13 px, `--ink-2`, `--warn` színű nyitójellel.
- **U-A5** Figyelmeztető sáv a fejléc alatt, `--warn` bal szegéllyel, egyenként bezárható.
- **U-A6** Jobb panel (keskeny nézetben a tartalom alatt): módfülek (Felolvasás; Keresd meg!, amely csak
  hibás `parok.json`-nál inaktív, „Nem elérhető” címkével, F-K18; ha bármelyik fül tartalma nem fér el a keretben, mindkét fülön csak az
  ikon látszik, a fül méretéhez igazítva, a név a felolvasónak és súgószövegként megmarad), leírás + „Így játsszátok” súgógomb, a beállítások, alul a mindig látható
  Indítás-blokk: becslés („10 tétel · kb. 40 mp”, kézi léptetésnél „10 tétel · kézi léptetés”), az
  oldal egyetlen elsődleges gombja, alatta csak hiba vagy figyelmeztetés. Állapotai:

  | Állapot | Gomb | Szöveg alatta |
  |---|---|---|
  | kész | aktív | – |
  | listák töltődnek, nincs korábbi | inaktív, „Listák töltődnek…” | – |
  | font töltődik | inaktív, „Betűtípus töltődik…” | – |
  | font nem töltődött be | aktív | `--warn`: „A betűk alakja eltérhet.” |
  | nincs lista | inaktív | „Nincs elérhető lista.” |
  | üres lista / mind üres | inaktív | „A listában nincs tétel.” / „Egyik listában sincs tétel.” |

- **U-A7** Mikroszöveg: tegező, rövid, felkiáltójel nélkül; hibánál a teendőt mondja.
- **U-A7b „Így játsszátok”:** játékonkénti súgó a panel súgógombjáról. Desktopon nem modális popover
  a panel bal szélén (✕, Esc, kívülre kattintás, a gomb újbóli megnyomása zárja; a fókusz a ✕-re, majd
  vissza a gombra); érintőn, 900 px alatt és mobil fekvőben alsó lap „Értem” gombbal. A gyakorlás
  billentyűi itt vannak, az admin alsó sorából kikerültek.
- **U-A7a Súgó:** modális ablak a program céljáról és használatáról (5 lépés). A fejléc „Súgó”
  gombja bármikor megnyitja; induláskor helyette az Első lépések bemutató indul
  ([bemutato-specifikacio.md](bemutato-specifikacio.md)), amit a Súgó „Bemutató újra” gombja újraindít. Billentyűs eszközön a billentyűket,
  érintőképernyőn és 600 px alatt a jelölőnégyzeteket és a gombokat írja le. Telefonon szinte
  teljes képernyős, a gomb teljes szélességű. Egy mondatban említi a szótag-takarást is
  (kattintás/koppintás a szótagra, illetve `↓`).
- **U-A8 Keresd meg! fül** (a tervezői vásznon E4, E5, E7–E10). Leírás: „Te felolvasod az egyiket,
  a gyerek megmutatja a képernyőn.” A Tételek forrása alatt sorrendben:
  1. **Kártyák:** 4 · 6 · 8 szegmens. Telefonon (F-K10) a 8 szürke, `aria-disabled`, a címke
     „Kártyák · telefonon max. 6”.
  2. **Feladatok száma:** stepper (1–30), félkövér címkével.
  3. **Nehézség:** 5 lépéses csúszka; fölötte jobbra az aktuális fokozat: 1 „jól megkülönböztethető”,
     2 „inkább eltérő”, 3 „vegyes”, 4 „inkább hasonló”, 5 „nagyon hasonló”; alatta a skála két vége
     („1 eltérő”, „5 nagyon hasonló”). Közvetlenül alatta tájékoztató doboz (`--paper` háttér,
     információ-ikon, 12,5 px, desktopon legfeljebb 5 sor):
     > A Meixner-módszer szerint a hasonló betűket (pl. b–d, m–n) időben egymástól távol érdemes
     > tanulni, hogy a gyerek ne keverje össze őket. Ezért a legkönnyebb fokozattal kezdjetek.
     > A program megjegyzi a beállítást.
  4. **Minta:** egy lehetséges feladat tételei tördelődő címkesorban („Másik minta” gombbal); minden tétel
     teljes szélességben látszik, a sorok száma a tételek hosszától függ. Beállítás-változásra frissül.
     Mobil fekvőben (`max-height: 500px`) rejtve.

  Az Indítás-blokk becslése: „10 feladat · 4 kártya”. Ha a panel nem fér ki, csak a beállítások
  görgetnek, az Indítás látszik.

  Az „Így játsszátok” (U-A7b) tartalma:
  > **Keresd meg! – így játsszátok**
  > 1. Válassz ki fejben egy kártyát, és mondd ki hangosan – ne mutass rá.
  > 2. A gyerek megkeresi, és rámutat vagy rákoppint.
  > 3. Te döntöd el, hogy jó-e: a program nem értékel, csak megjelöli a koppintott kártyát.
  > 4. Egy feladaton belül többet is kérhetsz, mielőtt továbblépsz.

  Billentyűs eszközön: Space, → következő feladat · ← előző feladat · kattintás: megjelöl, újra
  kattintva leveszi · Esc kilépés. Érintőn: „A gyerek a kártyára koppint, te a lenti nyilakkal lépsz a
  következő feladatra. A kör végén lufipukkasztás a jutalom.” Alsó lapon (E8) a lépések alatt három
  képes magyarázó: koppintás jelöl · újra koppintás leveszi · nyilak lapoznak.

### 12.4 Gyakorlónézet
- **U-P1** Háttér: sík `--paper`, enyhe vignetta, három statikus `--paper-2` folt a sarkokban.
- **U-P2** Tétel: `--ink`, vízszintesen középen, a közös tinta-doboz közepe a magasság 46%-án (F-P13).
- **U-P3** Időjelző: F-P14; sáv `--line`, kitöltés `--accent` 75%, a tinta-doboz alatt
  max(16 px, a magasság 3,5%-a) távolságra, de legalább 110 px-re az alsó széltől.
- **U-P4** Vezérlősor: ◀ ⏸/▶ ▶ alul középen, 24 px-re az aljától, 16 px közzel; 56 px kerek találati
  terület, 28 px ikon, `--ink` 55%; hoverre 8%-os kör háttér és 85%. Inaktív: 20%.
- **U-P5** ✕: bal felső sarok; egeres eszközön egérmozgásra, fade be 150 ms, ki 300 ms; érintőképernyőn végig látszik (F-P10).
- **U-P6** Haladásjelző: felül középen, `42 px + safe area` magasan; pötty 12×12 px, 10 px rés, aktuális
  28×12 px; 600 px alatt 8 px-es pötty, 6 px rés, 20 px-es kapszula. Váltás 150 ms, csökkentett mozgásnál azonnal.
- **U-P7** Pause-jelző: a jobb felső sarokban, 24 px-re a szélektől, 28 px, két lekerekített sáv, `--ink` 35%, fade 300 ms.
- **U-P8** Belépés animáció nélkül, az első tétel azonnal, teljes idővel. Kilépés azonnal.
- **U-P9** Szótag-takaró (vonalzó): F-P22, színei a 12.2 `--ruler*` tokenjei. Megjelenése és eltűnése azonnali. Egeres eszközön a szótag fölött a
  kurzor nem változik (a tétel a gyereké, nem „gomb”); a kurzor elrejtése (F-P11) változatlan.
  A takaró nem kap `aria-label`-t; a szótagok állapota a tétel `aria-label`-jében nem jelenik meg.

### 12.4a Keresd meg! nézet
- **U-K1** Háttér, dekoráció, ✕ és haladásjelző, mint a gyakorlónézetben (U-P1, U-P5, U-P6); a
  haladásjelző pöttyei a feladatok.
- **U-K2 Kártya:** `--field` háttér, 2 px `--line` keret, 24 px sarok (telefonon 16–18 px), a tétel
  `--ink`. Rés: desktopon 28 px, telefonon 12–14 px. A rács a haladásjelző és a vezérlők közti területet
  tölti ki; desktopon legfeljebb 1040 px széles.
- **U-K3 Jelölt kártya:** `--sky` háttér, 4–5 px `--accent` keret, azonnali váltás. Piros és zöld nincs,
  mert a jelölés nem jelent jót vagy rosszat.
- **U-K4 Vezérlők:** ◀ ▶ alul középen (U-P4, ⏸ nélkül). Mobil fekvőben (`max-height: 500px`) a két nyíl
  a rács két oldalán, függőlegesen középen.
- **U-K5 Referenciaméretek** (6 kártya): desktop 1280×800 → ~330×250 px kártya, ~112 px betű; mobil álló
  390×844 → ~173×190 px, ~84 px; mobil fekvő 844×390 → ~192×140 px, ~76 px. A tényleges betűméretet
  F-K13 adja.
- **U-K6** Egeres eszközön a kártya fölött mutató kurzor; külön hover-kiemelés nincs.

### 12.5 Jutalomnézet
- **U-R1** Lufi: tojásdad (sz/m ≈ 0,82), háromszög csomó, 1 px madzag (`--ink` 25%), egy fényfolt;
  nincs arc, szöveg, minta. Csökkentett mozgásnál rács alapú elhelyezés véletlen eltolással, max. 30% átfedés;
  egyébként szabadon szállnak (F-R9).
- **U-R2** Kurzor: 32 px-es nyíl (`--ink` kitöltés, fehér körvonal), lufi fölött sem vált kézre.

### 12.5a Panda-ugrálás nézet
- **U-J1 Méretek:** a panda szélessége a rövidebb képernyőoldal 13%-a, 56–110 px (magassága 1,1×).
  Egy emelet a magasság 21%-a, 1,5–2 panda között. Pad: 1,6 × 0,3 panda.
- **U-J2 Panda:** szemből, nagy kerek fej, fekete fülek és szemfoltok, fehér csillanás a szemben, rózsaszín
  pofi (`#F2B5A7`), kis orr és „w” száj; a fekete helyett lágy sötét (`#2F3A40`). Ugrás közben a karjai
  felemelkednek és tátva a szája (vidám „hú”); a sebesség felé legfeljebb 10°-ot dől. Földet éréskor
  260 ms-os guggolás és 6 apró fehér porszem. A célon mosolygó (^ ^) szem, integető karok, kis ugrálás.
  Leesés közben lassan pörög. Arca mindig barátságos, szomorú vagy ijedt arc nincs.
- **U-J3 Bambuszpad:** pasztellzöld (`#B5D5BB`), két sötétebb ízzel (`#8DBE97`), fényes csík, kis levél.
- **U-J4 Cél:** sárga pad (`#F5D58F`, ízek `#D9B65E`), mögötte három bambuszszár lassan lengő levelekkel.
- **U-J5 Tipp-nyíl:** chevron, `--ink` 45%, 24–40 px, enyhén előre-hátra lüktet.
- **U-J6 Háttér:** a jutalom égkékje (`--sky`), öt fehér felhő 70%-os átlátszósággal. A ✕ (F-R6) felül marad.

### 12.5b Jutalomválasztó nézet
- **U-C1 Méretek:** asztali nézet: négyzetes kártyák, legfeljebb 260 px, 48 px rés, mindkét irányban
  középen. Álló telefon (szélesség ≤ 600 px, álló tájolás): egymás alatt, szélesség min(220 px, 56vw),
  24 px rés. Fekvő telefon / alacsony ablak (`max-height: 500px`): egymás mellett, a kártya a magasság
  52%-a (legfeljebb 200 px), 32 px rés. 320×256-ig a kártyák a rövidebb oldallal együtt zsugorodnak.
- **U-C2 Kártya:** a Keresd meg! kártyája (U-K2): `--field`, 2 px `--line` keret, 24 px sarok (telefonon
  18 px), árnyék nincs. Kiemelve és választva a jelölt kártya kerete (U-K3): 5 px `--accent`, plusz
  −4 px emelés és 1,03-szoros nagyítás (150 ms); a háttér `--field` marad. A kiemelés a fókusz: a kiemelt
  kártya kapja a fókuszt.
- **U-C3 Rajz:** a kártya 82%-a, a játékok saját rajza: három lufi az F-R2 palettájából; a panda (U-J2)
  egy bambuszpadon, a következő pad jobbra fent. Mozgás csak ennyi: a lufik ±6 px / ±2°-ot lebegnek
  (mint F-R2), a panda 3 mp-enként kicsit ugrik. Felirat nincs (U-E4).
- **U-C4 Átmenetek:** a két kártya elhalványulva és 16 px-et emelkedve úszik be (300 ms, a második +80 ms).
  Választás után a másik, majd a választott kártya halványul el (300 + 300 ms).
- **U-C5 Háttér:** csak `--sky`. Felhő, számláló, haladásjelző, vezérlősáv nincs; a ✕ (F-R6) mint a
  jutalom alatt: érintőképernyőn végig, egérrel mozgatásra látszik. A kurzor a 32 px-es gyerekkurzor (U-R2).
- **U-C6 Csökkentett mozgás:** nincs beúszás és lebegés; a kiemelés és az elhalványulás azonnali.

### 12.6 Akadálymentesség
- Kontraszt: tétel ≥ 7:1, admin szöveg ≥ 4,5:1, ikonok és keretek ≥ 3:1.
- Az admin minden funkciója billentyűzettel elérhető; fókuszgyűrű 2 px `--accent`, csak `:focus-visible`.
- Az ikon gombok `aria-label`-t kapnak („Szünet”, „Folytatás”, „Előző”, „Következő”, „Kilépés”).
- Jutalomválasztó: a tároló `role="group"`, `aria-label` „Válassz játékot”; a kártyák `button`-ok,
  `aria-label` „Lufipukkasztás” és „Panda-ugrálás”. Az `--accent` keret a kártyán 5,8:1; a nyugalmi
  keret díszítés.
- Keresd meg!: a kártyák `button`-ok, `aria-label` a tétel, a jelölés `aria-pressed`; a rács `role="group"`,
  `aria-label` „3. feladat a 10-ből”; a nyilak „Előző feladat”, „Következő feladat”.
- Elsődleges képernyő: 1366×768 és 1920×1080; támogatott minimum: 1024×600. Tablet és telefon
  álló és fekvő tájolásban is támogatott; a 9.9-es kritérium ott is teljesül.
