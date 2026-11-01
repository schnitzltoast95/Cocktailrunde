import { Capacitor, registerPlugin } from './supabase-sdk.js';

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'cocktail-bug-button';
const labels = { discover: 'Cocktailkarte', ratings: 'Meine Notizen', group: 'Gruppe' };
const bugReport = registerPlugin('BugReport');
const recentViews = ['discover'];
let currentView = 'discover';

export function trackBugView(view) {
  if (!labels[view]) return;
  currentView = view;
  if (recentViews.at(-1) !== view) recentViews.push(view);
  if (recentViews.length > 6) recentViews.shift();
}

export function initBugReport(getDrinkName) {
  const button = $('#bug-button');
  const modal = $('#bug-dialog');
  const form = $('#bug-form');
  const message = $('#bug-message');
  const sizeButton = $('#bug-button-size');
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { saved = {}; }
  let compact = saved.compact !== false;
  let edge = ['left', 'right', 'top', 'bottom'].includes(saved.edge) ? saved.edge : 'right';
  let fraction = Number.isFinite(saved.fraction) ? Math.max(0, Math.min(1, saved.fraction)) : .5;
  let activeContext;
  let moving = false;
  let moved = false;
  let startX = 0;
  let startY = 0;

  function limits() {
    const width = button.offsetWidth;
    const height = button.offsetHeight;
    return { minX: 8, maxX: Math.max(8, innerWidth - width - 8), minY: 72, maxY: Math.max(72, innerHeight - height - 98) };
  }

  function place() {
    const { minX, maxX, minY, maxY } = limits();
    const x = edge === 'left' ? minX : edge === 'right' ? maxX : minX + (maxX - minX) * fraction;
    const y = edge === 'top' ? minY : edge === 'bottom' ? maxY : minY + (maxY - minY) * fraction;
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ edge, fraction, compact }));
  }

  function setCompact(value) {
    compact = value;
    button.classList.toggle('compact', compact);
    sizeButton.textContent = compact ? 'Button mit Text anzeigen' : 'Nur Symbol anzeigen';
    place();
    save();
  }

  function reportContext() {
    return {
      screen: labels[currentView],
      recentScreens: recentViews.map((view) => labels[view]),
      drink: $('#rating-dialog').open ? getDrinkName() : null,
    };
  }

  function open() {
    activeContext = reportContext();
    form.reset();
    message.textContent = '';
    $('#send-bug').disabled = false;
    $('#bug-context').textContent = `Mitgesendet: ${activeContext.screen}${activeContext.drink ? ` · ${activeContext.drink}` : ''}, letzte Ansichten, Android-Version und Gerät.`;
    modal.showModal();
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    moving = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', (event) => {
    if (!moving) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 6) moved = true;
    if (!moved) return;
    const { minX, maxX, minY, maxY } = limits();
    button.style.left = `${Math.max(minX, Math.min(maxX, event.clientX - button.offsetWidth / 2))}px`;
    button.style.top = `${Math.max(minY, Math.min(maxY, event.clientY - button.offsetHeight / 2))}px`;
  });
  button.addEventListener('pointerup', () => {
    if (!moving) return;
    moving = false;
    if (!moved) return;
    const { minX, maxX, minY, maxY } = limits();
    const x = button.offsetLeft;
    const y = button.offsetTop;
    const distances = { left: x - minX, right: maxX - x, top: y - minY, bottom: maxY - y };
    edge = Object.keys(distances).sort((a, b) => distances[a] - distances[b])[0];
    fraction = edge === 'left' || edge === 'right' ? (y - minY) / Math.max(1, maxY - minY) : (x - minX) / Math.max(1, maxX - minX);
    fraction = Math.max(0, Math.min(1, fraction));
    place();
    save();
  });
  button.addEventListener('pointercancel', () => { moving = false; place(); });
  button.addEventListener('click', (event) => {
    if (moved) { event.preventDefault(); moved = false; return; }
    open();
  });
  $('#bug-from-rating').addEventListener('click', open);
  $('#close-bug').addEventListener('click', () => modal.close());
  sizeButton.addEventListener('click', () => setCompact(!compact));
  window.addEventListener('resize', place);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!navigator.onLine) { message.textContent = 'Zum Senden brauchst du kurz Internet. Dein Text bleibt hier stehen.'; return; }
    if (!Capacitor.isNativePlatform()) { message.textContent = 'Das direkte Melden funktioniert in der Android-App. Dein Text bleibt hier stehen.'; return; }
    const submit = $('#send-bug');
    submit.disabled = true;
    message.textContent = 'Bericht wird gesendet …';
    try {
      const data = await bugReport.submit({ title: $('#bug-summary').value.trim(), description: $('#bug-description').value.trim(), context: activeContext });
      if (!data?.url) throw new Error('missing issue URL');
      message.textContent = 'Danke! Dein Fehlerbericht wurde als GitHub-Issue erstellt.';
      form.reset();
    } catch {
      message.textContent = 'Senden fehlgeschlagen. Bitte versuch es später erneut; dein Text bleibt hier stehen.';
    } finally {
      submit.disabled = false;
    }
  });

  setCompact(compact);
  if (Capacitor.isNativePlatform()) {
    bugReport.isConfigured().then(({ configured }) => {
      button.hidden = !configured;
      $('#bug-from-rating').hidden = !configured;
    }).catch(() => { button.hidden = true; $('#bug-from-rating').hidden = true; });
  }
}
