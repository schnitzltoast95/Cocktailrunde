import { cloud, signUp, signIn, getGroups, pushRating, pullRatings, createInvite, joinByCode, getMembers, setMemberName, leaveGroup } from './sync.js';
import { initBugReport, trackBugView } from './bug-report.js?v=2';

const $ = (selector) => document.querySelector(selector);
const catalogContent = $('#catalog-content');
const ratingsContent = $('#ratings-content');
const dialog = $('#rating-dialog');
const form = $('#rating-form');

let catalog = { bars: [], cocktails: [] };
let ratings = [];
let activeCocktail = null;
let editingRating = null;
let activeTag = '';
const notesFilter = '__notes__';
let session = null;
let activeGroup = null;
let groupRatings = [];
let groupMembers = [];
let syncRunning = false;

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cocktails-local', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('ratings')) {
        const store = db.createObjectStore('ratings', { keyPath: 'id' });
        store.createIndex('cocktailId', 'cocktailId');
      }
      if (!db.objectStoreNames.contains('groupRatings')) db.createObjectStore('groupRatings', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allRatings() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('ratings').objectStore('ratings').getAll();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function putRating(rating) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('ratings', 'readwrite');
    transaction.objectStore('ratings').put(rating);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function cachedGroupRatings(groupId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('groupRatings').objectStore('groupRatings').getAll();
    request.onsuccess = () => { db.close(); resolve(request.result.filter((row) => row.group_id === groupId)); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function cacheGroupRatings(groupId, rows) {
  const db = await openDb();
  const existing = await cachedGroupRatings(groupId);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('groupRatings', 'readwrite');
    const store = transaction.objectStore('groupRatings');
    existing.forEach((row) => store.delete(row.id));
    rows.forEach((row) => store.put(row));
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

function currentBar(drink) {
  return catalog.bars.find((bar) => bar.id === drink.barId)?.name || 'Bar';
}

function drinkFor(rating) {
  return catalog.cocktails.find((drink) => drink.id === rating.cocktailId);
}

function emptyState(title, copy) {
  const box = el('div', 'empty-state');
  const mark = el('div', 'empty-mark');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<svg viewBox="0 0 64 64"><path d="M13 13h38L32 35 13 13ZM32 35v16m-13 0h26"/><path d="M17 22h30"/></svg>';
  box.append(mark, el('h2', '', title), el('p', '', copy));
  return box;
}

function showView(name) {
  trackBugView(name);
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  document.querySelectorAll('.nav-item').forEach((button) => {
    const selected = button.dataset.view === name;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  $('#main').focus({ preventScroll: true });
}

function renderFilters() {
  const counts = new Map();
  for (const drink of catalog.cocktails) {
    for (const tag of drink.ingredientTags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const pinned = ['Alkoholfrei', 'Gin', 'Rum', 'Vodka'].filter((tag) => counts.has(tag));
  const popular = [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag).filter((tag) => !pinned.includes(tag)).slice(0, 7);
  const container = $('#filters');
  container.replaceChildren();
  for (const tag of ['', notesFilter, ...pinned, ...popular]) {
    const button = el('button', `filter-chip${activeTag === tag ? ' selected' : ''}`, tag === notesFilter ? 'Mit Notizen' : tag || 'Alle');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(activeTag === tag));
    button.addEventListener('click', () => { activeTag = tag; renderFilters(); renderCatalog(); });
    container.append(button);
  }
}

function annotationsFor(drink) {
  const shared = groupRatings.filter((row) => row.cocktail_id === drink.id).map((row) => ({
    id: row.id, author: row.author_name, liked: row.liked, note: row.note,
    createdAt: row.created_at, status: '', private: false,
  }));
  const sharedIds = new Set(shared.map((row) => row.id));
  const local = ratings.filter((row) => row.cocktailId === drink.id && !sharedIds.has(row.id)).map((row) => ({
    id: row.id, author: 'Du', liked: row.liked, note: row.note,
    createdAt: row.createdAt, status: row.groupId ? 'noch nicht geteilt' : 'nur hier', private: true,
  }));
  return [...shared, ...local].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function renderCatalog() {
  catalogContent.replaceChildren();
  $('#catalog-controls').hidden = !catalog.cocktails.length;
  if (!catalog.cocktails.length) {
    catalogContent.append(emptyState('Die erste Karte kommt bald', 'Sobald die Cocktailkarte eingepflegt ist, findest du hier alle Drinks und kannst sie bewerten.'));
    return;
  }
  const query = $('#search').value.trim().toLocaleLowerCase('de');
  const matching = catalog.cocktails.filter((drink) => {
    const text = [drink.name, drink.description, currentBar(drink), ...drink.ingredientTags].join(' ').toLocaleLowerCase('de');
    const tagMatches = !activeTag || (activeTag === notesFilter ? annotationsFor(drink).length > 0 : drink.ingredientTags.includes(activeTag));
    return tagMatches && (!query || text.includes(query));
  });
  const count = el('p', 'results-count', `${matching.length} ${matching.length === 1 ? 'Drink' : 'Drinks'}`);
  catalogContent.append(count);
  if (!matching.length) {
    catalogContent.append(emptyState('Kein Drink gefunden', 'Versuch einen anderen Namen, eine Zutat oder entferne den Filter.'));
    return;
  }
  const groups = new Map();
  for (const drink of matching) {
    const key = `${drink.barId}::${drink.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(drink);
  }
  for (const drinks of groups.values()) {
    const section = el('section', 'drink-group');
    const heading = el('h2', 'group-heading', `${currentBar(drinks[0])} · ${drinks[0].category}`);
    section.append(heading);
    for (const drink of drinks) {
      const button = el('button', 'drink-row');
      button.type = 'button';
      const info = el('span', 'drink-info');
      info.append(el('strong', '', drink.name));
      if (drink.description) info.append(el('span', 'drink-description', drink.description));
      const annotations = annotationsFor(drink);
      if (annotations.length) {
        const notes = el('span', 'drink-annotations');
        for (const entry of annotations.slice(0, 2)) {
          const verdict = { yes: 'Hat geschmeckt', mixed: 'War okay', no: 'Nicht mein Fall' }[entry.liked] || '';
          const annotation = el('span', `drink-annotation${entry.private ? ' private' : ''}`);
          annotation.append(el('span', 'annotation-author', `${entry.author}${entry.status ? ` · ${entry.status}` : ''} · ${verdict}`));
          if (entry.note) annotation.append(el('span', 'annotation-note', entry.note));
          notes.append(annotation);
        }
        if (annotations.length > 2) notes.append(el('span', 'annotation-more', `${annotations.length - 2} weitere ${annotations.length - 2 === 1 ? 'Notiz' : 'Notizen'} beim Öffnen`));
        info.append(notes);
      }
      const side = el('span', 'drink-side');
      if (drink.priceEuro != null) side.append(el('span', 'drink-price', `${drink.priceEuro.toFixed(2).replace('.', ',')} €`));
      if (annotations.length) side.append(el('span', 'rated-indicator', `${annotations.length} ${annotations.length === 1 ? 'Notiz' : 'Notizen'}`));
      side.append(el('span', 'drink-action', 'Bewerten →'));
      button.append(info, side);
      button.addEventListener('click', () => openRating(drink));
      section.append(button);
    }
    catalogContent.append(section);
  }
}

const dimensions = [
  ['sweetness', 'Süße'],
  ['fruitiness', 'Fruchtigkeit'],
  ['sourness', 'Säure'],
];

function renderDimensions() {
  const container = $('#dimensions');
  for (const [key, label] of dimensions) {
    const row = el('div', 'dimension-row');
    const top = el('div', 'dimension-top');
    const name = el('label', 'field-label', label);
    name.htmlFor = key;
    const value = el('output', 'dimension-value', 'Keine Angabe');
    value.htmlFor = key;
    value.id = `${key}-value`;
    const slider = el('input', 'dimension-slider');
    slider.type = 'range'; slider.id = key; slider.name = key;
    slider.min = '0'; slider.max = '5'; slider.step = '1'; slider.value = '0';
    slider.addEventListener('input', () => { value.textContent = slider.value === '0' ? 'Keine Angabe' : `${slider.value} / 5`; });
    top.append(name, value);
    row.append(top, slider);
    container.append(row);
  }
}

function openRating(drink, existing = null) {
  activeCocktail = drink;
  editingRating = existing;
  form.reset();
  $('#form-error').hidden = true;
  $('#rating-title').textContent = drink.name;
  $('#rating-bar').textContent = `${currentBar(drink)} · ${drink.category}`;
  const annotations = annotationsFor(drink);
  $('#drink-notes').hidden = !annotations.length;
  const noteList = $('#drink-notes-list');
  noteList.replaceChildren();
  for (const entry of annotations) {
    const verdict = { yes: 'Hat geschmeckt', mixed: 'War okay', no: 'Nicht mein Fall' }[entry.liked] || '';
    const note = el('div', 'dialog-note');
    note.append(el('strong', '', `${entry.author}${entry.status ? ` · ${entry.status}` : ''} · ${verdict}`));
    if (entry.note) note.append(el('p', '', entry.note));
    noteList.append(note);
  }
  $('#liked').value = existing?.liked || '';
  const hasVariant = drink.description.includes('nach Frucht Eurer Wahl');
  $('#variant-field').hidden = !hasVariant;
  $('#variant').required = hasVariant;
  $('#variant').value = existing?.variant || '';
  $('#note').value = existing?.note || '';
  for (const [key] of dimensions) {
    $(`#${key}`).value = String(existing?.[key] || 0);
    $(`#${key}-value`).textContent = existing?.[key] ? `${existing[key]} / 5` : 'Keine Angabe';
  }
  $('.primary-button').textContent = existing ? 'Änderungen speichern' : 'Bewertung speichern';
  dialog.showModal();
}

function renderRatings() {
  ratingsContent.replaceChildren();
  if (!ratings.length) {
    ratingsContent.append(emptyState('Noch nichts bewertet', 'Wähle einen Cocktail aus der Karte und halte fest, wie er dir geschmeckt hat.'));
    return;
  }
  for (const rating of [...ratings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const drink = drinkFor(rating);
    if (!drink) continue;
    const button = el('button', 'rating-row');
    button.type = 'button';
    const date = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rating.createdAt));
    const verdict = { yes: 'Hat geschmeckt', mixed: 'War okay', no: 'Nicht mein Fall' }[rating.liked];
    const top = el('span', 'rating-top');
    top.append(el('strong', '', drink.name), el('span', 'rating-date', date));
    button.append(top, el('span', 'rating-meta', `${currentBar(drink)} · ${verdict}${rating.variant ? ` · ${rating.variant}` : ''}`));
    if (rating.note) button.append(el('span', 'rating-note', rating.note));
    button.addEventListener('click', () => openRating(drink, rating));
    ratingsContent.append(button);
  }
}

function renderGroup() {
  $('#group-unconfigured').hidden = Boolean(cloud);
  $('#group-auth').hidden = !cloud || Boolean(session);
  $('#group-signed-in').hidden = !session;
  if (!cloud) {
    $('#group-unconfigured').replaceChildren(emptyState('Gruppe noch nicht eingerichtet', 'Der Supabase Anschluss wird gerade vorbereitet. Deine Bewertungen bleiben auf diesem Gerät gespeichert.'));
    return;
  }
  if (!session) return;
  $('#account-email').textContent = session.user.email || 'Angemeldet';
  $('#author-name').value = localStorage.getItem('cocktail-author-name') || '';
  const unshared = ratings.filter((rating) => !rating.userId);
  $('#share-local').hidden = !activeGroup || !unshared.length;
  $('#share-local').textContent = `${unshared.length} bisherige ${unshared.length === 1 ? 'Bewertung' : 'Bewertungen'} mit der Gruppe teilen`;
  $('#join-form').hidden = Boolean(activeGroup);
  $('#member-panel').hidden = !activeGroup;
  const feed = $('#group-feed');
  feed.replaceChildren();
  if (!activeGroup) {
    $('#group-message').textContent = navigator.onLine
      ? 'Du bist noch in keiner Freundesgruppe. Gib einen Einladungscode ein, um beizutreten.'
      : 'Offline. Die Gruppenzuordnung wird geprüft, sobald du wieder online bist.';
    return;
  }
  const members = $('#member-list');
  members.replaceChildren();
  for (const member of groupMembers) {
    const mine = member.user_id === session.user.id;
    const ratingName = groupRatings.find((rating) => rating.user_id === member.user_id)?.author_name;
    members.append(el('li', '', `${member.display_name || ratingName || (mine ? 'Du' : 'Mitglied ohne Namen')}${mine ? ' · du' : ''}`));
  }
  if (!groupMembers.length) members.append(el('li', '', navigator.onLine ? 'Mitglieder werden geladen …' : 'Mitgliederliste ist offline nicht verfügbar.'));
  const pending = ratings.filter((rating) => rating.groupId === activeGroup.id && rating.syncState === 'pending').map((rating) => ({
    id: rating.id, group_id: activeGroup.id, user_id: session.user.id,
    author_name: localStorage.getItem('cocktail-author-name') || 'Du', cocktail_id: rating.cocktailId,
    liked: rating.liked, variant: rating.variant, note: rating.note, created_at: rating.createdAt,
    updated_at: rating.updatedAt, pending: true,
  }));
  const rows = new Map(groupRatings.map((rating) => [rating.id, rating]));
  pending.forEach((rating) => rows.set(rating.id, rating));
  const sorted = [...rows.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  feed.append(el('h2', 'group-feed-heading', `${activeGroup.name} · ${sorted.length} ${sorted.length === 1 ? 'Bewertung' : 'Bewertungen'}`));
  if (!sorted.length) {
    feed.append(emptyState('Noch keine Gruppenbewertungen', 'Eure ersten geteilten Drinks erscheinen hier nach dem Abgleich.'));
    return;
  }
  for (const rating of sorted) {
    const drink = catalog.cocktails.find((item) => item.id === rating.cocktail_id);
    if (!drink) continue;
    const row = el('div', 'rating-row');
    const date = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(rating.created_at));
    const verdict = { yes: 'Hat geschmeckt', mixed: 'War okay', no: 'Nicht mein Fall' }[rating.liked] || '';
    const top = el('span', 'rating-top');
    top.append(el('strong', '', drink.name), el('span', 'rating-date', date));
    row.append(top, el('span', 'group-author', `${rating.author_name}${rating.pending ? ' · noch nicht geteilt' : ''}`));
    row.append(el('span', 'rating-meta', `${currentBar(drink)} · ${verdict}${rating.variant ? ` · ${rating.variant}` : ''}`));
    if (rating.note) row.append(el('span', 'rating-note', rating.note));
    feed.append(row);
  }
}

async function loadGroup() {
  if (!session || !cloud) return;
  const saved = JSON.parse(localStorage.getItem('cocktail-group') || 'null');
  activeGroup = saved;
  if (navigator.onLine) {
    const groups = await getGroups();
    activeGroup = groups.find((group) => group.id === saved?.id) || groups[0] || null;
    if (activeGroup) localStorage.setItem('cocktail-group', JSON.stringify(activeGroup));
    else localStorage.removeItem('cocktail-group');
  }
  groupRatings = activeGroup ? await cachedGroupRatings(activeGroup.id) : [];
  renderCatalog();
  groupMembers = [];
  let membersError = null;
  if (activeGroup && navigator.onLine) {
    try { groupMembers = await getMembers(activeGroup.id); }
    catch (error) { membersError = error; }
  }
  updateConnection();
  renderGroup();
  if (membersError) $('#group-message').textContent = 'Mitglieder konnten nicht geladen werden. Bitte später erneut abgleichen.';
  if (activeGroup && navigator.onLine) await syncRatings();
}

async function syncRatings() {
  if (syncRunning || !cloud || !session || !activeGroup || !navigator.onLine) return;
  const authorName = $('#author-name').value.trim();
  if (!authorName) {
    $('#group-message').textContent = 'Gib zuerst deinen Namen für die Gruppe ein.';
    return;
  }
  localStorage.setItem('cocktail-author-name', authorName);
  syncRunning = true;
  $('#sync-now').disabled = true;
  $('#group-message').textContent = 'Bewertungen werden abgeglichen …';
  try {
    await setMemberName(activeGroup.id, session.user.id, authorName);
    groupMembers = await getMembers(activeGroup.id);
    let uploaded = 0;
    for (const rating of ratings.filter((item) => item.syncState === 'pending' && item.userId === session.user.id && item.groupId === activeGroup.id)) {
      await pushRating(rating, activeGroup.id, session.user.id, authorName);
      const current = (await allRatings()).find((item) => item.id === rating.id);
      if (current?.updatedAt === rating.updatedAt) await putRating({ ...current, syncState: 'synced' });
      uploaded += 1;
    }
    ratings = await allRatings();
    groupRatings = await pullRatings(activeGroup.id);
    await cacheGroupRatings(activeGroup.id, groupRatings);
    $('#group-message').textContent = uploaded
      ? `${uploaded} ${uploaded === 1 ? 'Bewertung' : 'Bewertungen'} geteilt. Gruppe auf dem neuesten Stand.`
      : 'Gruppe auf dem neuesten Stand.';
    renderRatings();
    renderCatalog();
    renderGroup();
    $('#group-message').textContent = uploaded
      ? `${uploaded} ${uploaded === 1 ? 'Bewertung' : 'Bewertungen'} geteilt. Gruppe auf dem neuesten Stand.`
      : 'Gruppe auf dem neuesten Stand.';
  } catch (error) {
    $('#group-message').textContent = `Abgleich fehlgeschlagen: ${error.message || 'Bitte später erneut versuchen.'} Deine Bewertungen bleiben lokal gespeichert.`;
  } finally {
    syncRunning = false;
    $('#sync-now').disabled = false;
  }
}

async function initGroup() {
  renderGroup();
  if (!cloud) return;
  $('#email-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#auth-error').hidden = true;
    const email = $('#auth-email').value.trim();
    try {
      session = await signIn(email, $('#auth-password').value);
      $('#auth-password').value = '';
      $('#auth-info').textContent = '';
      updateConnection();
      renderGroup();
      await loadGroup();
    } catch (error) {
      $('#auth-error').textContent = error.message || 'Anmeldung fehlgeschlagen.';
      $('#auth-error').hidden = false;
    }
  });
  $('#sign-up').addEventListener('click', async () => {
    $('#auth-error').hidden = true;
    if (!$('#email-form').reportValidity()) return;
    try {
      const email = $('#auth-email').value.trim();
      session = await signUp(email, $('#auth-password').value);
      $('#auth-password').value = '';
      if (session) {
        updateConnection();
        renderGroup();
        await loadGroup();
      } else {
        $('#auth-info').textContent = `Konto für ${email} erstellt. Bitte melde dich an.`;
      }
    } catch (error) {
      $('#auth-error').textContent = error.message || 'Konto konnte nicht erstellt werden.';
      $('#auth-error').hidden = false;
    }
  });
  $('#author-name').addEventListener('change', () => {
    localStorage.setItem('cocktail-author-name', $('#author-name').value.trim());
    if (activeGroup) syncRatings();
  });
  $('#join-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!navigator.onLine) { $('#group-message').textContent = 'Zum Beitreten brauchst du kurz Internet.'; return; }
    const button = $('#join-form button[type="submit"]');
    button.disabled = true;
    try {
      await joinByCode($('#invite-input').value.trim());
      $('#invite-input').value = '';
      await loadGroup();
      $('#group-message').textContent = 'Du bist der Gruppe beigetreten.';
    } catch (error) {
      $('#group-message').textContent = error.message || 'Beitritt fehlgeschlagen. Prüfe den Code und versuche es erneut.';
    } finally { button.disabled = false; }
  });
  $('#create-invite').addEventListener('click', async () => {
    if (!navigator.onLine) { $('#group-message').textContent = 'Für einen Einladungscode brauchst du Internet.'; return; }
    const button = $('#create-invite');
    button.disabled = true;
    try {
      const code = await createInvite(activeGroup.id);
      $('#invite-code').textContent = code.match(/.{1,4}/g).join('-');
      $('#invite-result').hidden = false;
      $('#group-message').textContent = 'Einladungscode erstellt. Teile ihn persönlich mit deinem Freund.';
    } catch (error) {
      $('#group-message').textContent = error.message || 'Einladungscode konnte nicht erstellt werden.';
    } finally { button.disabled = false; }
  });
  $('#copy-invite').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#invite-code').textContent);
      $('#group-message').textContent = 'Einladungscode kopiert.';
    } catch { $('#group-message').textContent = 'Kopieren fehlgeschlagen. Du kannst den Code markieren und selbst kopieren.'; }
  });
  $('#leave-group').addEventListener('click', async () => {
    if (!navigator.onLine) { $('#group-message').textContent = 'Zum Verlassen der Gruppe brauchst du Internet.'; return; }
    if (!confirm(`Möchtest du ${activeGroup.name} wirklich verlassen? Deine eigenen Bewertungen auf diesem Gerät bleiben erhalten.`)) return;
    try {
      const oldId = activeGroup.id;
      await leaveGroup(oldId, session.user.id);
      await cacheGroupRatings(oldId, []);
      groupRatings = []; groupMembers = []; activeGroup = null;
      renderCatalog();
      $('#invite-result').hidden = true;
      localStorage.removeItem('cocktail-group');
      await loadGroup();
      $('#group-message').textContent = 'Du hast die Gruppe verlassen.';
    } catch (error) { $('#group-message').textContent = error.message || 'Austritt fehlgeschlagen.'; }
  });
  $('#sync-now').addEventListener('click', async () => {
    try { await loadGroup(); } catch (error) { $('#group-message').textContent = error.message || 'Abgleich fehlgeschlagen.'; }
  });
  $('#share-local').addEventListener('click', async () => {
    const authorName = $('#author-name').value.trim();
    if (!authorName) { $('#group-message').textContent = 'Gib zuerst deinen Namen für die Gruppe ein.'; return; }
    localStorage.setItem('cocktail-author-name', authorName);
    for (const rating of ratings.filter((item) => !item.userId)) {
      await putRating({ ...rating, userId: session.user.id, groupId: activeGroup.id, syncState: 'pending' });
    }
    ratings = await allRatings();
    renderGroup();
    await syncRatings();
  });
  $('#sign-out').addEventListener('click', async () => {
    await cloud.auth.signOut();
    session = null; activeGroup = null; groupRatings = []; groupMembers = [];
    renderCatalog();
    localStorage.removeItem('cocktail-group');
    updateConnection();
    renderGroup();
  });
  const { data } = await cloud.auth.getSession();
  session = data.session;
  updateConnection();
  renderGroup();
  if (session) {
    try { await loadGroup(); } catch (error) { $('#group-message').textContent = error.message || 'Gruppe konnte nicht geladen werden.'; }
  }
}

function updateConnection() {
  const node = $('#connection');
  const offline = !navigator.onLine;
  node.textContent = offline ? 'Offline' : activeGroup && session ? 'Gruppe verbunden' : 'Auf diesem Gerät';
  node.classList.toggle('offline', offline);
  node.title = offline ? 'Neue Bewertungen werden auf diesem Gerät gespeichert und später abgeglichen.'
    : activeGroup && session ? 'Bewertungen können mit deiner Gruppe abgeglichen werden.'
      : 'Deine Bewertungen werden auf diesem Gerät gespeichert.';
}

async function init() {
  initBugReport(() => activeCocktail?.name || null);
  renderDimensions();
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
  $('#search').addEventListener('input', renderCatalog);
  $('#close-dialog').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || !activeCocktail) return;
    const now = new Date().toISOString();
    const rating = {
      id: editingRating?.id || crypto.randomUUID(),
      cocktailId: activeCocktail.id,
      liked: $('#liked').value,
      variant: $('#variant-field').hidden ? null : $('#variant').value,
      sweetness: Number($('#sweetness').value) || null,
      fruitiness: Number($('#fruitiness').value) || null,
      sourness: Number($('#sourness').value) || null,
      note: $('#note').value.trim(),
      createdAt: editingRating?.createdAt || now,
      updatedAt: now,
      userId: editingRating?.userId || (session && activeGroup ? session.user.id : null),
      groupId: editingRating?.groupId || (session && activeGroup ? activeGroup.id : null),
      syncState: editingRating?.userId || (session && activeGroup) ? 'pending' : 'local',
    };
    try {
      await putRating(rating);
      ratings = await allRatings();
      dialog.close();
      renderRatings();
      renderCatalog();
      showView('ratings');
      if (rating.syncState === 'pending') syncRatings();
    } catch {
      $('#form-error').textContent = 'Die Bewertung konnte auf diesem Gerät nicht gespeichert werden. Bitte versuch es erneut.';
      $('#form-error').hidden = false;
    }
  });
  window.addEventListener('online', () => { updateConnection(); if (session) loadGroup().catch(() => {}); });
  window.addEventListener('offline', updateConnection);
  updateConnection();
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error('catalog unavailable');
    catalog = await response.json();
    ratings = await allRatings();
    renderFilters();
    renderCatalog();
    renderRatings();
    await initGroup();
  } catch {
    catalogContent.replaceChildren(emptyState('Karte nicht verfügbar', 'Bitte öffne die App erneut. Bereits gespeicherte Bewertungen bleiben auf deinem Gerät.'));
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
