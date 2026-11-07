# Olvasóka

Hangtalan betű-, szótag- és szógyakorló kisiskolásoknak. A szülő kiválaszt egy listát, a program
egyesével felvillantja a tételeket, a gyerek hangosan kimondja őket, a kör végén lufipukkasztás a jutalom.
Nincs hang, nincs pontozás; a kiejtést a mellette ülő szülő figyeli.

**Élő oldal:** https://mangyal.github.io/olvasoka/

## Listák szerkesztése

A listák a [`lists.txt`](lists.txt) fájlban vannak. A GitHubon a fájlt megnyitva a ceruza ikonnal
szerkeszthető (mobilon is), majd *Commit changes*. Kb. egy perc múlva az oldalon a **Frissítés** gomb
vagy egy újratöltés után már az új lista látszik.

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
| `P` | szünet / folytatás |
| `Esc` | vissza a szülői felületre |
| `Ctrl`+`Enter` | kör indítása a szülői felületen |

A felvillanási idő 0–25 mp; **0 = kézi léptetés**, a tétel addig látszik, amíg nem lépsz tovább.
A beállítások az adott böngészőben maradnak meg.

## Felépítés

Statikus oldal, build lépés és függőségek nélkül; natív ES modulok.

```
index.html          markup
lists.txt           a listák
css/                tokens · szülői felület · gyakorló és jutalom nézet
js/core/            tiszta, DOM-mentes logika (Node-ban tesztelve)
  sequence.js         sorozat-generátor („húzózsák”)
  round.js            a gyakorlókör állapotgépe (időzítés, szünet, navigáció)
  items.js            tételek tisztítása
  lists.js            a lists.txt értelmezése
  settings.js         beállítások és a helyi tárolás sémája
js/data/            localStorage és a lists.txt letöltése
js/ui/              szülői felület, gyakorlás, jutalom
js/font.js          betűtípus-kapu (Arial, ha nincs: Arimo)
js/main.js          indítás
test/               node --test
```

## Specifikáció

A követelmények, döntések és elfogadási kritériumok: [`docs/specifikacio.md`](docs/specifikacio.md).

## Fejlesztés

```sh
node --test                 # tesztek (Node 20+)
python3 -m http.server      # helyi futtatás: http://localhost:8000
```

Az oldal csak HTTP-n keresztül fut: fájlként (dupla kattintással) megnyitva a böngésző nem tölti be
a modulokat és a `lists.txt`-t. A tesztek minden pushnál GitHub Actionsben is lefutnak.

## GitHub Pages beállítása

Settings → Pages → *Build and deployment*: **Deploy from a branch**, ág: `main`, mappa: `/ (root)`.
