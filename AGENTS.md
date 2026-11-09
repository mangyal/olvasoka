# Útmutató AI-ágenseknek

Olvasóka: statikus PWA (GitHub Pages, natív ES modulok, build nélkül). Követelmények:
[`docs/specifikacio.md`](docs/specifikacio.md). Tesztek: `node --test`.

**Az ágazási és kiadási szabályok: [`docs/agazasi-strategia.md`](docs/agazasi-strategia.md) – munka
előtt olvasd el.** A legfontosabbak:

- Új munka friss `dev`-ből, `feat/…` vagy `fix/…` ágon; a PR célja **`dev`** (nem `main`).
- A `main` az éles oldal: közvetlen push, force push, ágtörlés tilos. A `main`-be menő PR-t a
  tulajdonos vonja össze.
- `.github/` módosítása csak `infra/*` ágon, a `main`-ből.
- Tárolt adat neve mindig környezetfüggő (`js/core/env.js`), új program-fájl az `sw.js` `ASSETS`
  listájára kerül.
- Commit üzenetek és PR-leírások magyarul.
