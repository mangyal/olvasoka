# Olvasóka

Hangtalan betű-, szótag- és szógyakorló kisiskolásoknak. A szülő kiválaszt egy listát, a program
egyesével felvillantja a tételeket, a gyerek hangosan kimondja őket, a kör végén lufipukkasztás a jutalom.
Nincs hang, nincs pontozás; a kiejtést a mellette ülő szülő figyeli.

**Élő oldal:** https://mangyal.github.io/olvasoka/

## Listák szerkesztése

A listák a [`lists.json`](lists.json) fájlban vannak. A GitHubon a fájlt megnyitva a ceruza ikonnal
szerkeszthető (mobilon is), majd *Commit changes*. Kb. egy perc múlva az oldalon a **Frissítés** gomb
vagy egy újratöltés után már az új lista látszik.

```json
{
  "v": 1,
  "lists": [
    { "name": "Magánhangzók", "items": ["a", "á", "e", "é"] },
    { "name": "Szótagok", "items": ["ma", "me", "ke-fe"] }
  ]
}
```

Szabályok:

- A tételek pontosan úgy jelennek meg, ahogy le vannak írva (kis- és nagybetű is).
- Egy tétel legfeljebb 20 karakter. A hosszabbat a program kihagyja és figyelmeztet.
- Az ismétlődő tételek és a `#`-tel kezdődőek kimaradnak.
- A listanevek egyediek (kis-/nagybetűtől függetlenül).
- Vesszőt ne írj tételbe: a program elválasztónak veszi.
- Ha a JSON hibás (pl. hiányzó vessző vagy idézőjel), az oldal a legutóbb letöltött listákkal fut tovább,
  és kiírja a hibát. A tesztek (lent) a hibás `lists.json`-t is jelzik.

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
lists.json          a listák
css/                tokens · szülői felület · gyakorló és jutalom nézet
js/core/            tiszta, DOM-mentes logika (Node-ban tesztelve)
  sequence.js         sorozat-generátor („húzózsák”)
  round.js            a gyakorlókör állapotgépe (időzítés, szünet, navigáció)
  items.js            tételek tisztítása
  lists.js            a lists.json értelmezése
  settings.js         beállítások és a helyi tárolás sémája
js/data/            localStorage és a lists.json letöltése
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
a modulokat és a `lists.json`-t. A tesztek minden pushnál GitHub Actionsben is lefutnak.

## GitHub Pages beállítása

Settings → Pages → *Build and deployment*: **Deploy from a branch**, ág: `main`, mappa: `/ (root)`.
