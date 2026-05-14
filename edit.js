/**
 * Sider edit-modus — wysiwyg tekst-redigering + seksjons-kontroll + pin-annotasjoner
 *
 * Bruk: legg `?edit` på slutten av URL-en (eks. /30-dager/?edit).
 *
 * Du kan:
 *  - klikke på tekst og endre den (lagres per side i localStorage)
 *  - hover over en seksjon → toolbar dukker opp øverst til høyre med
 *    ↑ flytt opp, ↓ flytt ned, 👁 skjul, 🎨 endre bakgrunnsfarge
 *  - aktivere pin-modus → klikk hvor som helst for å legge igjen en notat
 *
 * Klikk "Kopier endringer" for å eksportere ALT (tekst-endringer +
 * seksjons-operasjoner + pin-notater) som markdown til utklippstavlen.
 *
 * Inkluderes via:  <script defer src="/edit.js"></script>
 * Aktiveres kun når ?edit er i URL-en — null kostnad for normale besøkere.
 */
(function() {
  if (!new URLSearchParams(location.search).has('edit')) return;

  // ===== STORAGE KEYS (per-page) =====
  const TEXT_KEY     = 'sider-edits-'    + location.pathname;
  const SECTION_KEY  = 'sider-sections-' + location.pathname;
  const PINS_KEY     = 'sider-pins-'     + location.pathname;

  const saved = JSON.parse(localStorage.getItem(TEXT_KEY) || '{}');

  // ===== BRAND BACKGROUND PALETTE =====
  const BG_OPTIONS = {
    cream:  '#EFE6D4',
    sand:   '#F0D9A8',
    sage:   '#AFBEA0',
    olive:  '#5E5F4C',
    rust:   '#C5522C',
    ink:    '#2E3230',
  };
  const BG_TEXT_OVERRIDES = { ink: '#EFE6D4', olive: '#EFE6D4', rust: '#EFE6D4' };

  // ===== EDITABLE CONTENT (text fields) =====
  const EDIT_SELECTORS = [
    // Semantic content
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p',
    'li',
    'blockquote',
    'figcaption',
    // Brand-mønster klasser
    '.eyebrow',
    '.section-title',
    '.section-lead',
    '.footer-tagline',
    '.footer-col-label',
    // Spesifikke labels/numbers fra Hege's sider
    '.hero-partner-chip-text', '.hero-photo-tag', '.hero-tagline-quote',
    '.hero-meta', '.hero-lead',
    '.bridge-eyebrow',
    '.feature-label', '.feature-title', '.feature-desc',
    '.tier-label', '.tier-name', '.tier-price', '.tier-price-sub', '.tier-cta',
    '.partner-badge-note', '.footer-partner-text',
    '.disclosure-text',
    '.about-meta', '.about-name', '.about-tagline',
    '.faq-q', '.faq-a',
    '.transform-from', '.transform-to',
    '.stat-num', '.stat-label',
    '.day-num', '.day-title',
    '.premise-headline', '.premise-quote', '.premise-body',
    '.cta-primary', '.cta-secondary', '.header-cta',
    '.who-list li', '.notfor-list li', '.reasons-list li',
    '.tier-badge',
    '.final-lead', '.ps-label', '.ps-body',
    // ALT C/D/E + 100k-tilbud-challenge — editorial / Cochrane-rammeverk
    '.hero-headline', '.hero-lede', '.hero-eyebrow-strip', '.hero-date-line',
    '.masthead-edition', '.masthead-title', '.masthead-date',
    '.header-date', '.section-sub',
    '.promise-eyebrow', '.promise-num', '.promise-title', '.promise-desc', '.promise-outcome',
    '.how-label', '.how-value', '.how-detail',
    '.spots-eyebrow', '.spots-title', '.spots-body', '.spots-kicker',
    '.bonus-visual-eyebrow', '.bonus-visual-amount', '.bonus-visual-label',
    '.bonus-eyebrow', '.bonus-title', '.bonus-text',
    '.tier-eyebrow', '.tier-flag', '.tier-price-detail', '.tier-includes-label',
    '.testimonial-quote', '.testimonial-attr',
    '.video-caption',
    '.final-headline', '.final-sub', '.final-cta',
    '.footer-brand', '.footer-meta', '.footer-disclaimer',
    '.walkaway-list li',
    '.ai-quote-eyebrow', '.ai-quote-text',
    '.signup-eyebrow', '.signup-title', '.signup-lead', '.signup-fineprint', '.signup-flag',
    '.signup-card-flag', '.signup-card-title', '.signup-card-lede', '.signup-card-fineprint',
    '.info-label', '.info-value',
    '.about-card-meta', '.about-card-name', '.about-quote', '.about-signature',
    '.about-byline', '.about-name', '.about-role',
    '.day-desc',
    '.modal-eyebrow',
    // altC editorial brev
    '.letter-mark', '.letter-body',
    '.shift-num', '.shift-headline', '.shift-from', '.shift-body',
    '.pullquote-text', '.pullquote-eyebrow', '.pullquote-attribution',
    '.manifesto-aside', '.manifesto-text',
    '.practical-label', '.practical-value',
    '.signature-text', '.signature-mark',
    // Opt-in via attribute hvis du vil markere noe spesifikt
    '[data-editable]'
  ];

  let editCount = 0;
  const seenElements = new Set();

  EDIT_SELECTORS.forEach(sel => {
    let nodes;
    try { nodes = document.querySelectorAll(sel); }
    catch (e) { return; }
    nodes.forEach(el => {
      if (seenElements.has(el)) return;
      if (el.closest('.edit-toolbar, .edit-section-toolbar, .edit-pin, .edit-pin-popup, .edit-pin-mode-banner')) return;
      if (Array.from(el.querySelectorAll('*')).some(child => seenElements.has(child))) return;
      seenElements.add(el);

      const id = 'e' + (++editCount);
      el.dataset.editId = id;
      el.dataset.editOriginal = el.innerText;
      el.contentEditable = 'true';
      el.spellcheck = true;

      if (saved[id] != null && saved[id] !== el.innerText) {
        el.innerText = saved[id];
      }

      el.addEventListener('input', () => {
        const current = JSON.parse(localStorage.getItem(TEXT_KEY) || '{}');
        if (el.innerText === el.dataset.editOriginal) {
          delete current[id];
        } else {
          current[id] = el.innerText;
        }
        localStorage.setItem(TEXT_KEY, JSON.stringify(current));
        updateStatus();
      });
    });
  });

  // ===== SECTIONS (top-level body children) =====
  const allSections = [...document.querySelectorAll('body > section, body > footer')];
  allSections.forEach((s, i) => { s.dataset.editSection = 's' + i; });

  let sectionState = JSON.parse(localStorage.getItem(SECTION_KEY) || '{}');
  sectionState.hidden = sectionState.hidden || {};
  sectionState.bg     = sectionState.bg     || {};
  sectionState.order  = sectionState.order  || [];

  // Apply saved order
  if (sectionState.order.length && allSections.length) {
    const parent = allSections[0].parentElement;
    sectionState.order.forEach(id => {
      const el = parent.querySelector(':scope > [data-edit-section="' + id + '"]');
      if (el) parent.appendChild(el);
    });
  }

  // Apply saved visibility
  Object.keys(sectionState.hidden).forEach(id => {
    if (!sectionState.hidden[id]) return;
    const el = document.querySelector('[data-edit-section="' + id + '"]');
    if (el) el.classList.add('edit-section-hidden');
  });

  // Apply saved background
  Object.keys(sectionState.bg).forEach(id => {
    const bg = sectionState.bg[id];
    const el = document.querySelector('[data-edit-section="' + id + '"]');
    if (!el || !bg) return;
    el.style.backgroundColor = BG_OPTIONS[bg] || bg;
    if (BG_TEXT_OVERRIDES[bg]) el.style.color = BG_TEXT_OVERRIDES[bg];
  });

  function saveSectionState() {
    localStorage.setItem(SECTION_KEY, JSON.stringify(sectionState));
    updateStatus();
  }

  function sectionLabel(s) {
    const heading = s.querySelector('h1, h2, h3, .section-title, .hero-headline');
    if (heading) return heading.dataset.editOriginal || heading.innerText.slice(0, 60).trim();
    const eyebrow = s.querySelector('.eyebrow, .section-eyebrow');
    if (eyebrow) return eyebrow.innerText.slice(0, 60).trim();
    return s.tagName.toLowerCase() + (s.className ? '.' + s.className.split(' ').filter(c => c && !c.startsWith('edit-')).slice(0,2).join('.') : '');
  }

  // Build per-section toolbar
  allSections.forEach(section => {
    const id = section.dataset.editSection;
    const bar = document.createElement('div');
    bar.className = 'edit-section-toolbar';
    bar.contentEditable = 'false';
    bar.innerHTML =
      '<button data-act="up"   title="Flytt opp">↑</button>' +
      '<button data-act="down" title="Flytt ned">↓</button>' +
      '<button data-act="hide" title="Skjul / vis seksjon">' + (sectionState.hidden[id] ? '◳' : '👁') + '</button>' +
      '<div class="edit-bg-picker">' +
        '<button data-act="bg" title="Bakgrunnsfarge">🎨</button>' +
        '<div class="edit-bg-options">' +
          Object.entries(BG_OPTIONS).map(([k,v]) =>
            '<button data-bg="' + k + '" style="background:' + v + '" title="' + k + '"></button>'
          ).join('') +
          '<button data-bg="" class="edit-bg-reset" title="Tilbakestill">×</button>' +
        '</div>' +
      '</div>' +
      '<span class="edit-section-label">' + sectionLabel(section).slice(0, 36) + '</span>';

    // Position bar absolutely inside the section
    section.style.position = section.style.position || 'relative';
    section.appendChild(bar);

    bar.addEventListener('click', e => {
      const act = e.target.dataset.act;
      const bg  = e.target.dataset.bg;

      if (act === 'up') {
        const prev = section.previousElementSibling;
        if (prev && prev.dataset.editSection) section.parentElement.insertBefore(section, prev);
        saveOrder();
      } else if (act === 'down') {
        const next = section.nextElementSibling;
        if (next && next.dataset.editSection) section.parentElement.insertBefore(next, section);
        saveOrder();
      } else if (act === 'hide') {
        section.classList.toggle('edit-section-hidden');
        const hid = section.classList.contains('edit-section-hidden');
        if (hid) sectionState.hidden[id] = true;
        else     delete sectionState.hidden[id];
        e.target.textContent = hid ? '◳' : '👁';
        saveSectionState();
      } else if (act === 'bg') {
        bar.querySelector('.edit-bg-options').classList.toggle('open');
      } else if (bg !== undefined) {
        if (bg) {
          section.style.backgroundColor = BG_OPTIONS[bg];
          if (BG_TEXT_OVERRIDES[bg]) section.style.color = BG_TEXT_OVERRIDES[bg];
          else section.style.color = '';
          sectionState.bg[id] = bg;
        } else {
          section.style.backgroundColor = '';
          section.style.color = '';
          delete sectionState.bg[id];
        }
        bar.querySelector('.edit-bg-options').classList.remove('open');
        saveSectionState();
      }
    });
  });

  function saveOrder() {
    const parent = allSections[0]?.parentElement;
    if (!parent) return;
    sectionState.order = [...parent.children]
      .filter(c => c.dataset && c.dataset.editSection)
      .map(c => c.dataset.editSection);
    saveSectionState();
  }

  // ===== PIN-MODE / ANNOTATIONS =====
  let pinMode = false;
  let pins = JSON.parse(localStorage.getItem(PINS_KEY) || '[]');

  function savePins() {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
    updateStatus();
  }

  function pinAnchor(target) {
    if (!target) return 'side';
    const section = target.closest('[data-edit-section]');
    let sectionPart = '';
    if (section) sectionPart = sectionLabel(section).slice(0, 40);

    let elPart = target.tagName.toLowerCase();
    if (target.id) elPart += '#' + target.id;
    else if (target.className && typeof target.className === 'string') {
      const cls = target.className.split(' ').filter(c => c && !c.startsWith('edit-')).slice(0,2).join('.');
      if (cls) elPart += '.' + cls;
    }
    if (target.dataset.editOriginal) {
      elPart += ' "' + target.dataset.editOriginal.slice(0, 32) + (target.dataset.editOriginal.length > 32 ? '…' : '') + '"';
    } else if (target.innerText) {
      const t = target.innerText.slice(0, 32).trim();
      if (t) elPart += ' "' + t + (target.innerText.length > 32 ? '…' : '') + '"';
    }
    return sectionPart ? sectionPart + ' → ' + elPart : elPart;
  }

  function renderPin(pin) {
    const el = document.createElement('div');
    el.className = 'edit-pin';
    el.dataset.pinId = pin.id;
    el.style.left = pin.pageX + 'px';
    el.style.top  = pin.pageY + 'px';
    el.contentEditable = 'false';
    el.innerHTML = '<span class="edit-pin-num">' + pin.id.replace('p','') + '</span>' +
                   '<div class="edit-pin-tooltip">' + escapeHtml(pin.note || '(tom notat)') + '</div>';
    el.addEventListener('click', e => {
      e.stopPropagation();
      openPinPopup(pin, el);
    });
    document.body.appendChild(el);
  }

  function openPinPopup(pin, anchorEl) {
    closePinPopup();
    const pop = document.createElement('div');
    pop.className = 'edit-pin-popup';
    pop.contentEditable = 'false';
    const rect = anchorEl.getBoundingClientRect();
    pop.style.left = (window.scrollX + rect.left + 24) + 'px';
    pop.style.top  = (window.scrollY + rect.top) + 'px';
    pop.innerHTML =
      '<div class="edit-pin-popup-header">Pin #' + pin.id.replace('p','') + ' — ' + escapeHtml(pin.anchor || '') + '</div>' +
      '<textarea class="edit-pin-popup-input" placeholder="Skriv notat...">' + escapeHtml(pin.note || '') + '</textarea>' +
      '<div class="edit-pin-popup-row">' +
        '<button class="edit-pin-save">Lagre</button>' +
        '<button class="edit-pin-delete">Slett</button>' +
        '<button class="edit-pin-cancel">Avbryt</button>' +
      '</div>';
    document.body.appendChild(pop);
    const ta = pop.querySelector('textarea');
    ta.focus();
    pop.querySelector('.edit-pin-save').addEventListener('click', () => {
      pin.note = ta.value;
      savePins();
      anchorEl.querySelector('.edit-pin-tooltip').textContent = pin.note || '(tom notat)';
      closePinPopup();
    });
    pop.querySelector('.edit-pin-delete').addEventListener('click', () => {
      pins = pins.filter(p => p.id !== pin.id);
      savePins();
      anchorEl.remove();
      closePinPopup();
    });
    pop.querySelector('.edit-pin-cancel').addEventListener('click', closePinPopup);
  }

  function closePinPopup() {
    document.querySelectorAll('.edit-pin-popup').forEach(p => p.remove());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Restore existing pins
  pins.forEach(renderPin);

  // Click handler for pin-mode
  document.addEventListener('click', e => {
    if (!pinMode) return;
    if (e.target.closest('.edit-toolbar, .edit-section-toolbar, .edit-pin, .edit-pin-popup, .edit-pin-mode-banner')) return;
    e.preventDefault();
    e.stopPropagation();

    const newPin = {
      id: 'p' + (Date.now()),
      pageX: e.pageX,
      pageY: e.pageY,
      anchor: pinAnchor(e.target),
      note: '',
      time: new Date().toISOString().slice(0,16).replace('T',' ')
    };
    // Use sequential numbering for display
    pins.push(newPin);
    // Re-number after push: easiest is to keep original ID and display index = position in array
    // But we use Date-based IDs for uniqueness. Display number = index+1 will be computed at render time.
    // Simpler approach: re-render all pins
    document.querySelectorAll('.edit-pin').forEach(n => n.remove());
    pins.forEach((p, i) => {
      // Override displayed number to be sequential
      p._displayNum = i + 1;
      renderPin(p);
    });
    // Rewrite num spans
    document.querySelectorAll('.edit-pin').forEach((n, i) => {
      const span = n.querySelector('.edit-pin-num');
      if (span) span.textContent = String(i + 1);
    });
    savePins();
    // Open the popup for the new pin
    const newEl = document.querySelector('[data-pin-id="' + newPin.id + '"]');
    if (newEl) openPinPopup(newPin, newEl);
  }, true);

  // Re-render existing pins with sequential numbers
  document.querySelectorAll('.edit-pin').forEach((n, i) => {
    const span = n.querySelector('.edit-pin-num');
    if (span) span.textContent = String(i + 1);
  });

  // ===== STYLES =====
  const style = document.createElement('style');
  style.textContent = `
    [contenteditable="true"] { cursor: text; transition: outline 0.15s ease, background 0.15s ease; }
    [contenteditable="true"]:hover { outline: 2px dashed rgba(197, 82, 44, 0.5); outline-offset: 4px; border-radius: 2px; }
    [contenteditable="true"]:focus { outline: 2px solid rgba(197, 82, 44, 0.9); outline-offset: 4px; background: rgba(251, 248, 240, 0.6); border-radius: 2px; }

    .edit-section-hidden { display: none !important; }

    body.edit-pin-mode * { cursor: crosshair !important; }
    body.edit-pin-mode .edit-toolbar, body.edit-pin-mode .edit-toolbar * { cursor: default !important; }
    body.edit-pin-mode .edit-section-toolbar, body.edit-pin-mode .edit-section-toolbar * { cursor: pointer !important; }
    body.edit-pin-mode [contenteditable="true"] { pointer-events: none; }

    /* SECTION TOOLBAR */
    .edit-section-toolbar {
      position: absolute; top: 12px; right: 12px; z-index: 99996;
      background: rgba(46,50,48,0.92); color: #EFE6D4;
      border-radius: 8px; padding: 6px 8px;
      display: flex; gap: 4px; align-items: center;
      font-family: 'JetBrains Mono', monospace;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      opacity: 0; transition: opacity 0.2s ease;
      pointer-events: none;
    }
    [data-edit-section]:hover > .edit-section-toolbar,
    .edit-section-toolbar:hover,
    .edit-section-toolbar:focus-within {
      opacity: 1; pointer-events: auto;
    }
    .edit-section-toolbar button {
      background: transparent; color: #EFE6D4;
      border: 1px solid rgba(239,230,212,0.3); border-radius: 4px;
      padding: 5px 9px; cursor: pointer;
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .edit-section-toolbar button:hover { background: rgba(197,82,44,0.9); border-color: #C5522C; }
    .edit-section-label {
      color: rgba(239,230,212,0.7); font-size: 10px;
      letter-spacing: 0.08em; padding: 0 6px;
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .edit-bg-picker { position: relative; }
    .edit-bg-options {
      display: none; position: absolute; top: calc(100% + 6px); right: 0;
      background: #2E3230; border: 1px solid rgba(239,230,212,0.3);
      border-radius: 6px; padding: 6px; gap: 4px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
    }
    .edit-bg-options.open { display: flex; }
    .edit-bg-options button {
      width: 24px; height: 24px; padding: 0;
      border: 1.5px solid rgba(239,230,212,0.5);
      border-radius: 50%;
    }
    .edit-bg-options button.edit-bg-reset {
      background: transparent;
      color: #EFE6D4; font-size: 14px;
      width: 24px; height: 24px;
    }

    /* PINS */
    .edit-pin {
      position: absolute; z-index: 99997;
      width: 28px; height: 28px;
      background: #C5522C; color: #EFE6D4;
      border: 2px solid #EFE6D4; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      transform: translate(-50%, -50%);
      transition: transform 0.15s ease;
    }
    .edit-pin:hover { transform: translate(-50%, -50%) scale(1.15); }
    .edit-pin-num {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700; font-size: 12px; letter-spacing: 0.02em;
    }
    .edit-pin-tooltip {
      position: absolute; left: 24px; top: -8px;
      background: #2E3230; color: #EFE6D4;
      padding: 8px 12px; border-radius: 6px;
      font-family: 'Archivo', sans-serif; font-size: 12px;
      max-width: 240px; min-width: 100px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.25);
      opacity: 0; pointer-events: none;
      transition: opacity 0.15s ease;
      white-space: pre-wrap; line-height: 1.4;
    }
    .edit-pin:hover .edit-pin-tooltip { opacity: 1; }

    .edit-pin-popup {
      position: absolute; z-index: 99998;
      background: #EFE6D4; color: #2E3230;
      border: 1.5px solid #2E3230; border-radius: 8px;
      padding: 14px; width: 320px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      font-family: 'Archivo', sans-serif;
    }
    .edit-pin-popup-header {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: rgba(46,50,48,0.65); margin-bottom: 8px;
      word-break: break-word;
    }
    .edit-pin-popup-input {
      width: 100%; min-height: 80px;
      border: 1px solid rgba(46,50,48,0.3); border-radius: 4px;
      padding: 8px 10px; font-family: 'Archivo', sans-serif;
      font-size: 13px; line-height: 1.5; resize: vertical;
      background: #FBF8F0;
    }
    .edit-pin-popup-input:focus { outline: 2px solid #C5522C; border-color: #C5522C; }
    .edit-pin-popup-row { display: flex; gap: 6px; margin-top: 10px; }
    .edit-pin-popup-row button {
      padding: 7px 12px; border-radius: 4px; cursor: pointer;
      font-family: 'Archivo', sans-serif; font-weight: 700;
      font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
      border: 1px solid #2E3230;
    }
    .edit-pin-save { background: #C5522C; color: #EFE6D4; border-color: #C5522C; }
    .edit-pin-save:hover { background: #2E3230; border-color: #2E3230; }
    .edit-pin-delete { background: transparent; color: #2E3230; }
    .edit-pin-delete:hover { background: #2E3230; color: #EFE6D4; }
    .edit-pin-cancel { background: transparent; color: rgba(46,50,48,0.6); border-color: rgba(46,50,48,0.3); }
    .edit-pin-cancel:hover { background: rgba(46,50,48,0.1); }

    .edit-pin-mode-banner {
      position: fixed; top: 88px; left: 50%; transform: translateX(-50%);
      background: #C5522C; color: #EFE6D4;
      padding: 10px 18px; border-radius: 999px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
      z-index: 99999; pointer-events: none;
    }

    /* MAIN TOOLBAR */
    .edit-toolbar {
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      background: #2E3230; color: #EFE6D4;
      border-radius: 12px; padding: 16px; min-width: 300px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.15);
      font-family: 'Archivo', sans-serif; font-size: 13px;
      border: 1.5px solid #C5522C;
    }
    .edit-toolbar-title {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
      color: #C5522C; margin-bottom: 4px;
    }
    .edit-toolbar-page {
      font-family: 'JetBrains Mono', monospace; font-weight: 500;
      font-size: 10px; letter-spacing: 0.06em;
      color: rgba(239,230,212,0.5); margin-bottom: 12px;
      word-break: break-all;
    }
    .edit-toolbar-status {
      font-size: 12px; color: #F0D9A8; margin-bottom: 14px;
      font-family: 'Archivo', sans-serif; line-height: 1.4;
    }
    .edit-toolbar-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .edit-btn {
      flex: 1; min-width: 0;
      background: #C5522C; color: #EFE6D4; border: none;
      padding: 10px 14px; border-radius: 6px;
      font-family: 'Archivo', sans-serif; font-weight: 700;
      font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
      cursor: pointer; transition: background 0.15s ease, transform 0.1s ease;
    }
    .edit-btn:hover { background: #d96340; transform: translateY(-1px); }
    .edit-btn.edit-btn-secondary { background: transparent; border: 1px solid rgba(239,230,212,0.3); color: #EFE6D4; }
    .edit-btn.edit-btn-secondary:hover { background: rgba(239,230,212,0.1); }
    .edit-btn.edit-btn-tiny { padding: 6px 10px; font-size: 10px; flex: 0 1 auto; }
    .edit-btn.is-active { background: #F0D9A8; color: #2E3230; }
    .edit-btn.is-active:hover { background: #f5e0b6; }

    .edit-toast {
      position: fixed; bottom: 220px; right: 20px; z-index: 99998;
      background: #5E5F4C; color: #EFE6D4;
      padding: 12px 18px; border-radius: 8px;
      font-family: 'Archivo', sans-serif; font-size: 13px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      transform: translateY(20px); opacity: 0;
      transition: transform 0.25s ease, opacity 0.25s ease;
      pointer-events: none;
    }
    .edit-toast.show { transform: translateY(0); opacity: 1; }
  `;
  document.head.appendChild(style);

  // ===== MAIN TOOLBAR =====
  const bar = document.createElement('div');
  bar.className = 'edit-toolbar';
  bar.contentEditable = 'false';
  bar.innerHTML = `
    <div class="edit-toolbar-title">Edit-modus</div>
    <div class="edit-toolbar-page">${location.pathname}</div>
    <div class="edit-toolbar-status" id="edit-status"></div>
    <div class="edit-toolbar-row">
      <button class="edit-btn" id="edit-copy">Kopier endringer</button>
      <button class="edit-btn edit-btn-secondary" id="edit-pin-toggle">📍 Pin-modus</button>
    </div>
    <div class="edit-toolbar-row" style="margin-top: 8px;">
      <button class="edit-btn edit-btn-secondary" id="edit-reset">Tilbakestill alt</button>
    </div>
    <div class="edit-toolbar-row" style="margin-top: 8px;">
      <button class="edit-btn edit-btn-tiny edit-btn-secondary" id="edit-toggle">Skjul</button>
      <button class="edit-btn edit-btn-tiny edit-btn-secondary" id="edit-exit">Avslutt</button>
    </div>
  `;
  document.body.appendChild(bar);

  const toast = document.createElement('div');
  toast.className = 'edit-toast';
  toast.contentEditable = 'false';
  document.body.appendChild(toast);
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function updateStatus() {
    const textCurrent = JSON.parse(localStorage.getItem(TEXT_KEY) || '{}');
    const txtN = Object.keys(textCurrent).length;
    const hidN = Object.values(sectionState.hidden).filter(Boolean).length;
    const bgN  = Object.keys(sectionState.bg).length;
    const ordN = sectionState.order.length ? 1 : 0;  // 1 if any reorder
    const secOps = hidN + bgN + ordN;
    const pinN = pins.length;
    document.getElementById('edit-status').innerHTML =
      txtN + ' tekst-endring' + (txtN === 1 ? '' : 'er') + ' · ' +
      secOps + ' seksjon-op · ' +
      pinN + ' pin' + (pinN === 1 ? '' : 's');
  }
  updateStatus();

  // ===== PIN TOGGLE BUTTON =====
  let pinBanner = null;
  const pinBtn = document.getElementById('edit-pin-toggle');
  pinBtn.addEventListener('click', () => {
    pinMode = !pinMode;
    pinBtn.classList.toggle('is-active', pinMode);
    document.body.classList.toggle('edit-pin-mode', pinMode);
    if (pinMode) {
      pinBanner = document.createElement('div');
      pinBanner.className = 'edit-pin-mode-banner';
      pinBanner.textContent = 'Pin-modus · Klikk hvor som helst for å legge igjen et notat';
      document.body.appendChild(pinBanner);
    } else if (pinBanner) {
      pinBanner.remove();
      pinBanner = null;
    }
  });

  // ===== EXPORT =====
  function buildExport() {
    const textCurrent = JSON.parse(localStorage.getItem(TEXT_KEY) || '{}');

    let out = '# Endringer fra ' + location.pathname + ' — ' + new Date().toISOString().slice(0,16).replace('T',' ') + '\n\n';

    // --- Section operations ---
    const hidIds = Object.keys(sectionState.hidden).filter(k => sectionState.hidden[k]);
    const bgIds = Object.keys(sectionState.bg);
    const hasOrder = sectionState.order && sectionState.order.length > 0;

    if (hidIds.length || bgIds.length || hasOrder) {
      out += '## Seksjons-endringer\n\n';
      if (hidIds.length) {
        out += '**Skjult:**\n';
        hidIds.forEach(id => {
          const el = document.querySelector('[data-edit-section="' + id + '"]');
          out += '- ' + (el ? sectionLabel(el) : id) + '\n';
        });
        out += '\n';
      }
      if (bgIds.length) {
        out += '**Bakgrunnsfarge:**\n';
        bgIds.forEach(id => {
          const el = document.querySelector('[data-edit-section="' + id + '"]');
          out += '- ' + (el ? sectionLabel(el) : id) + ' → `' + sectionState.bg[id] + '`\n';
        });
        out += '\n';
      }
      if (hasOrder) {
        out += '**Ny rekkefølge:**\n';
        sectionState.order.forEach((id, i) => {
          const el = document.querySelector('[data-edit-section="' + id + '"]');
          out += (i + 1) + '. ' + (el ? sectionLabel(el) : id) + '\n';
        });
        out += '\n';
      }
    }

    // --- Pin annotations ---
    if (pins.length) {
      out += '## Pin-notater\n\n';
      pins.forEach((p, i) => {
        out += '### Pin #' + (i + 1) + ' — ' + (p.anchor || '?') + '\n\n';
        out += (p.note || '_(tom notat)_') + '\n\n';
        out += '---\n\n';
      });
    }

    // --- Text changes ---
    const changes = [];
    Object.keys(textCurrent).forEach(id => {
      const el = document.querySelector('[data-edit-id="' + id + '"]');
      if (!el) return;
      const sectionEl = el.closest('section, footer, header');
      let section = '?';
      if (sectionEl) {
        const heading = sectionEl.querySelector('.section-title, h1, h2, h3, .hero-headline');
        section = heading?.dataset?.editOriginal || heading?.innerText?.slice(0, 50) || sectionEl.tagName.toLowerCase();
      }
      changes.push({
        section: section.trim(),
        selector: getElementPath(el),
        oldText: el.dataset.editOriginal || '',
        newText: textCurrent[id]
      });
    });

    if (changes.length) {
      out += '## Tekst-endringer\n';
      let lastSection = null;
      changes.forEach(c => {
        if (c.section !== lastSection) {
          out += `\n### ${c.section}\n\n`;
          lastSection = c.section;
        }
        out += `**${c.selector}**\n\n`;
        out += `_FØR:_\n${c.oldText}\n\n`;
        out += `_ETTER:_\n${c.newText}\n\n`;
        out += '---\n\n';
      });
    }

    if (!hidIds.length && !bgIds.length && !hasOrder && !pins.length && !changes.length) {
      return 'Ingen endringer enda. Klikk på tekst, hover over seksjoner, eller aktiver pin-modus for å starte.';
    }

    return out;
  }

  function getElementPath(el) {
    const tag = el.tagName.toLowerCase();
    const cls = (el.className || '').toString().split(' ').filter(c => c && !c.startsWith('edit-')).slice(0,2).join('.');
    return cls ? `${tag}.${cls}` : tag;
  }

  // Copy button
  document.getElementById('edit-copy').addEventListener('click', async () => {
    const txt = buildExport();
    try {
      await navigator.clipboard.writeText(txt);
      showToast('Kopiert! Lim inn til Claude.');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90vw;height:60vh;z-index:999999;padding:20px;font-family:monospace;';
      document.body.appendChild(ta);
      ta.select();
      showToast('Velg + kopier manuelt (Cmd+C)');
    }
  });

  // Reset
  document.getElementById('edit-reset').addEventListener('click', () => {
    if (!confirm('Tilbakestill ALT på denne siden? (tekst, seksjons-endringer, pins) Dette kan ikke angres.')) return;
    localStorage.removeItem(TEXT_KEY);
    localStorage.removeItem(SECTION_KEY);
    localStorage.removeItem(PINS_KEY);
    location.reload();
  });

  // Toggle visibility
  let hidden = false;
  document.getElementById('edit-toggle').addEventListener('click', () => {
    hidden = !hidden;
    bar.style.opacity = hidden ? '0.2' : '1';
    bar.style.pointerEvents = hidden ? 'none' : 'auto';
    if (hidden) {
      const showBtn = document.createElement('button');
      showBtn.textContent = 'Vis edit';
      showBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;padding:10px 14px;background:#C5522C;color:#EFE6D4;border:none;border-radius:6px;font-family:Archivo,sans-serif;font-weight:700;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;';
      showBtn.onclick = () => {
        hidden = false;
        bar.style.opacity = '1';
        bar.style.pointerEvents = 'auto';
        showBtn.remove();
      };
      document.body.appendChild(showBtn);
    }
  });

  // Exit
  document.getElementById('edit-exit').addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('edit');
    location.href = url.toString();
  });

  // Prevent Enter from creating new paragraphs in single-line fields
  const singleLineSelectors = 'h1, h2, h3, .eyebrow, .feature-label, .tier-name, .tier-price, .tier-price-sub, .tier-price-detail, .tier-includes-label, .tier-eyebrow, .tier-flag, .stat-num, .stat-label, .footer-col-label, .partner-badge-note, .footer-partner-text, .hero-photo-tag, .hero-partner-chip-text, .bridge-eyebrow, .about-meta, .disclosure-text, .day-num, .tier-badge, .promise-eyebrow, .promise-num, .promise-outcome, .how-label, .how-value, .spots-eyebrow, .bonus-visual-eyebrow, .bonus-visual-amount, .bonus-visual-label, .bonus-eyebrow, .footer-brand, .footer-meta, .masthead-edition, .masthead-title, .masthead-date, .info-label, .info-value, .signup-eyebrow, .signup-flag, .signup-card-flag, .about-byline, .about-role, .about-card-meta, .about-card-name, .modal-eyebrow, .header-date, .hero-eyebrow-strip, .hero-date-line, .ai-quote-eyebrow, .letter-mark, .shift-from, .pullquote-eyebrow, .pullquote-attribution, .manifesto-aside, .practical-label, .practical-value, .signature-mark, .signature-text';
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    if (el.matches(singleLineSelectors)) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
    }
  });

  console.log('[Edit-modus] Aktiv på ' + location.pathname + ' — ' + editCount + ' tekst-felter, ' + allSections.length + ' seksjoner, ' + pins.length + ' pins.');
})();
