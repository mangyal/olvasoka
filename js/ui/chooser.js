// Jutalomválasztó nézet (spec F-R14, 12.5b): két kártya, balra (álló telefonon fent) a lufik,
// jobbra (lent) a panda. Szöveg nincs. A döntési logika a core/choose.js reducerében van;
// ez a modul rajzol, időzít és eseményeket fordít le.

import { CHOICES, startChoose, chooseStep } from '../core/choose.js';
import { balloonArt } from './reward.js';
import { PANDA_SVG, padSVG } from './panda.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FADE_MS = 300;                // U-C4: a másik kártya, majd a választott elhalványul
const ENTER_MS = 400;               // a beúszás (300 ms + 80 ms) után a kiemelés már átmenettel vált
const KEYS = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Space: 'START', Enter: 'START', NumpadEnter: 'START', ArrowUp: 'START' };
const LABELS = { lufi: 'Lufipukkasztás', panda: 'Panda-ugrálás' };

// U-C3: a játékok saját rajza; a helyek a kártya rajzterületének (82%) százalékában
const ART = {
  lufi:
    `<span class="cb-bob b1" style="left:14.1%;top:22.1%;width:27.2%;height:51.2%">${balloonArt('#A7C8E0')}</span>` +
    `<span class="cb-bob b2" style="left:39.9%;top:6.1%;width:29.1%;height:55.4%">${balloonArt('#F5D58F')}</span>` +
    `<span class="cb-bob b3" style="left:62%;top:25.8%;width:27.2%;height:51.2%">${balloonArt('#EFC2D3')}</span>`,
  panda:
    `<span class="cb-pad next" style="left:54%;top:20.1%;width:42.3%;height:7.9%">${padSVG(false)}</span>` +
    `<span class="cb-pad" style="left:6.1%;top:75.6%;width:62%;height:11.6%">${padSVG(false)}</span>` +
    `<span class="hopper" style="left:16%;top:31%;width:42.3%;height:46%">${PANDA_SVG}</span>`,
};

/**
 * @param {{ root: HTMLElement, onPick: (name: string) => void }} o
 *   root: a választó tárolója (role="group"); onPick: a választás és az elhalványulás után hívódik
 */
export function createChooser({ root, onPick }) {
  let s = null, timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const cards = {};
  for (const name of CHOICES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'choice'; b.dataset.game = name;
    b.setAttribute('aria-label', LABELS[name]);
    b.innerHTML = `<span class="choice-art ${name}" aria-hidden="true">${ART[name]}</span>`;
    b.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dispatch('DOWN', name);
    });
    // egérrel a fölé vitt kártya kiemelődik (és fókuszt kap), mint a nyilakkal: az utolsó bemenet nyer
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') dispatch('HOVER', name); });
    b.addEventListener('focus', () => dispatch('HOVER', name));
    // képernyőolvasó / natív aktiválás (detail 0); egérrel és érintéssel a pointerup dönt
    b.addEventListener('click', (e) => { if (e.detail === 0) dispatch('PICK', name); });
    b.addEventListener('mousedown', (e) => e.preventDefault());   // a kattintás ne hagyjon fókuszkeretet
    cards[name] = b;
  }
  root.replaceChildren(...CHOICES.map((n) => cards[n]));
  // Érintésnél a pointerup a lenyomás elemén jön (implicit capture): a felengedés helye dönt.
  root.addEventListener('pointerup', (e) => {
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const card = hit && hit.closest && hit.closest('.choice');
    dispatch('UP', card && root.contains(card) ? card.dataset.game : null);
  });
  root.addEventListener('pointercancel', () => dispatch('CANCEL'));

  function show() {
    clear();
    s = startChoose(performance.now());
    root.hidden = false;
    root.classList.remove('enter'); void root.offsetWidth;
    if (!reduced()) { root.classList.add('enter'); later(ENTER_MS, () => root.classList.remove('enter')); }
    render();
  }

  function hide() {
    clear();
    s = null;
    if (root.contains(document.activeElement)) document.activeElement.blur();
    root.hidden = true;
    root.classList.remove('enter');
    render();
  }

  function clear() { timers.forEach(clearTimeout); timers = []; }

  function dispatch(ev, arg) {
    if (!s) return;
    const prev = s;
    s = chooseStep(s, ev, performance.now(), arg);
    if (s === prev) return;
    render();
    if (s.picked && !prev.picked) picked(s.picked);
  }

  // F-R14: a választott kártya azonnal kiemelt; előbb a másik, majd ez is elhalványul, aztán a játék
  function picked(name) {
    const other = CHOICES.find((n) => n !== name);
    const fade = reduced() ? 0 : FADE_MS;
    cards[other].classList.add('is-out');
    later(fade, () => {
      cards[name].classList.add('is-out');
      later(fade, () => onPick(name));
    });
  }

  function render() {
    for (const name of CHOICES) {
      const c = cards[name];
      c.classList.toggle('is-hi', !!s && s.hi === name && !s.picked);
      c.classList.toggle('is-picked', !!s && s.picked === name);
      if (!s) c.classList.remove('is-out');
    }
    // a kiemelés a fókusz (12.5b): a kiemelt kártya kapja a fókuszt
    if (s && s.hi && !s.picked && document.activeElement !== cards[s.hi]) cards[s.hi].focus({ preventScroll: true });
  }

  /** @returns {boolean} a választó kezelte-e a billentyűt (Esc-et nem: az a gyakorló dolga) */
  function key(e) {
    const ev = KEYS[e.code];
    if (!ev) return false;
    if (!e.repeat) dispatch(ev);
    return true;
  }

  return {
    show, hide, key,
    get state() { return s; },
  };
}
