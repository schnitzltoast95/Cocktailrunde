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
  let dragStartX = 0;
  let dragStartY = 0;
  let positionX = 0;
  let positionY = 0;
  let targetX = 0;
  let targetY = 0;
  let velocityX = 0;
  let velocityY = 0;
  let frame = 0;
  let lastFrameTime = 0;
  let positioned = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function limits() {
    const width = button.offsetWidth;
    const height = button.offsetHeight;
    const margin = compact ? 0 : 12;
    const minY = Math.max(margin, $('.app-header').getBoundingClientRect().bottom + margin);
    const maxY = Math.max(minY, $('.bottom-nav').getBoundingClientRect().top - height - margin);
    return { minX: margin, maxX: Math.max(margin, innerWidth - width - margin), minY, maxY };
  }

  function renderPosition() {
    button.style.transform = `translate3d(${positionX}px, ${positionY}px, 0)`;
  }

  function animatePosition(time) {
    const seconds = Math.min((time - (lastFrameTime || time)) / 1000, .032);
    lastFrameTime = time;
    const stiffness = 200;
    const damping = 2 * .82 * Math.sqrt(stiffness);
    velocityX += ((targetX - positionX) * stiffness - velocityX * damping) * seconds;
    velocityY += ((targetY - positionY) * stiffness - velocityY * damping) * seconds;
    positionX += velocityX * seconds;
    positionY += velocityY * seconds;
    if (Math.hypot(targetX - positionX, targetY - positionY) < .15 && Math.hypot(velocityX, velocityY) < 1) {
      positionX = targetX;
      positionY = targetY;
      velocityX = velocityY = 0;
      frame = 0;
      lastFrameTime = 0;
    } else {
      frame = requestAnimationFrame(animatePosition);
    }
    renderPosition();
  }

  function moveTo(x, y, immediate = false) {
    targetX = x;
    targetY = y;
    if (immediate || reducedMotion.matches) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrameTime = 0;
      positionX = x;
      positionY = y;
      velocityX = velocityY = 0;
      renderPosition();
    } else if (!frame) {
      frame = requestAnimationFrame(animatePosition);
    }
  }

  function place(immediate = false) {
    const { minX, maxX, minY, maxY } = limits();
    const x = edge === 'left' ? minX : edge === 'right' ? maxX : minX + (maxX - minX) * fraction;
    const y = edge === 'top' ? minY : edge === 'bottom' ? maxY : minY + (maxY - minY) * fraction;
    button.dataset.edge = edge;
    moveTo(x, y, immediate || !positioned);
    positioned = true;
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
    dragStartX = targetX;
    dragStartY = targetY;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', (event) => {
    if (!moving) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 6) moved = true;
    if (!moved) return;
    button.classList.add('dragging');
    const { minX, maxX, minY, maxY } = limits();
    moveTo(
      Math.max(minX, Math.min(maxX, dragStartX + event.clientX - startX)),
      Math.max(minY, Math.min(maxY, dragStartY + event.clientY - startY)),
    );
  });
  button.addEventListener('pointerup', () => {
    if (!moving) return;
    moving = false;
    button.classList.remove('dragging');
    if (!moved) return;
    const { minX, maxX, minY, maxY } = limits();
    const x = targetX;
    const y = targetY;
    const distances = { left: x - minX, right: maxX - x, top: y - minY, bottom: maxY - y };
    edge = Object.keys(distances).sort((a, b) => distances[a] - distances[b])[0];
    fraction = edge === 'left' || edge === 'right' ? (y - minY) / Math.max(1, maxY - minY) : (x - minX) / Math.max(1, maxX - minX);
    fraction = Math.max(0, Math.min(1, fraction));
    place();
    save();
  });
  button.addEventListener('pointercancel', () => { moving = false; button.classList.remove('dragging'); place(); });
  button.addEventListener('click', (event) => {
    if (moved) { event.preventDefault(); moved = false; return; }
    open();
  });
  $('#bug-from-rating').addEventListener('click', open);
  $('#close-bug').addEventListener('click', () => modal.close());
  sizeButton.addEventListener('click', () => setCompact(!compact));
  window.addEventListener('resize', () => place(true));

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
      if (!data?.created && !data?.url) throw new Error('missing confirmation');
      message.textContent = 'Danke! Dein Fehlerbericht wurde als GitHub-Issue erstellt.';
      form.reset();
    } catch (error) {
      const status = /GitHub antwortete mit HTTP (\d+)/.exec(String(error?.message || ''));
      message.textContent = status
        ? `GitHub hat den Bericht nicht angenommen (HTTP ${status[1]}). Dein Text bleibt hier stehen.`
        : 'Ob der Bericht angekommen ist, konnte nicht bestätigt werden. Bitte prüfe zuerst die GitHub-Issues, bevor du erneut sendest. Dein Text bleibt hier stehen.';
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
