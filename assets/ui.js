/* خطوة — shared UI helpers: icon sprite, app shell (top bar + bottom nav), ransom letters, toasts. */
(function () {
  const S = window.KhutwaStore, L = window.KhutwaI18n, t = L.t;

  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 13c2 1.5 3.5 3.5 5 6 3-7 6.5-11 11-14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-box" viewBox="0 0 24 24"><path d="M4 5c5-.6 11-.8 16 .3.5 5 .4 10-.2 14.5-5 .6-10 .5-15.3-.2C4 14.5 3.8 9.5 4 5z" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
    <symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z" fill="currentColor"/></symbol>
    <symbol id="i-go" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 80 44"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 34C18 8 46 4 70 20"/><path d="M57 16l14 5-6 12"/></g></symbol>
    <symbol id="i-circle" viewBox="0 0 120 60"><path d="M14 34C10 12 104 4 112 26 118 48 26 58 10 40 4 30 22 14 44 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 4.5c.3 5 .2 10-.2 15M4.5 12c5-.3 10-.2 15 .2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></symbol>
    <symbol id="i-minus" viewBox="0 0 24 24"><path d="M4.5 12c5-.3 10-.2 15 .2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M3.5 11 12 4l8.5 7v9h-6v-6h-5v6h-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-list" viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h12M4 6h.5M4 12h.5M4 18h.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.5-4 3-6 5.5-6s5 2 5.5 6M13.5 15.5c1-1.5 2.2-2 3.5-2 2.5 0 4 2 4.5 5.5"/></g></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 20.5h18M6 17v-5M10.5 17V7M15 17v-7M19.5 17V4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-gear" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></g></symbol>
    <symbol id="i-logout" viewBox="0 0 24 24"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-water" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-run" viewBox="0 0 24 24"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-book" viewBox="0 0 24 24"><path d="M3.5 5.5c3-1 6-1 8.5 1 2.5-2 5.5-2 8.5-1v13c-3-1-6-1-8.5 1-2.5-2-5.5-2-8.5-1zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="3" width="10" height="18" rx="1.5"/><path d="M4 4l16 16"/></g></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></g></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
    <symbol id="i-copy" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/></g></symbol>
    <symbol id="i-crown" viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g></symbol>
    <symbol id="i-lock" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10.5" width="16" height="10.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></g></symbol>
    <symbol id="i-globe" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></g></symbol>
  </defs></svg>`;

  const HABIT_ICONS = ['water', 'run', 'book', 'moon', 'leaf', 'phone', 'star'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bdi = s => `<bdi>${esc(s)}</bdi>`;              // isolates user text so English and Arabic both read in the right order
  const dirOf = s => (/^[^A-Za-zÀ-ɏ֐-ࣿ]*[A-Za-zÀ-ɏ]/.test(s) ? 'ltr' : 'rtl');
  const icon = (id, size = 22, cls = '') => `<svg width="${size}" height="${size}" class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  let spriteIn = false;
  function injectSprite() { if (!spriteIn) { document.body.insertAdjacentHTML('afterbegin', SPRITE); spriteIn = true; } }

  /* Ransom-note letters. Zero-width joiners keep Arabic letters in their connected forms;
     the direction follows the word's first letter so English words read left-to-right. */
  function ransomize(root = document) {
    const NON_LEFT = 'اأإآدذرزوؤةىء';
    const isAr = c => /[ء-ي]/.test(c), ZWJ = '‍';
    const styles = [
      { f: 'var(--f3)', bg: 'var(--ink)',  c: 'var(--paper)', r: -6 },
      { f: 'var(--f1)', bg: 'var(--news)', c: 'var(--red)',   r: 5, s: 1.2 },
      { f: 'var(--f2)', bg: 'var(--clip)', c: 'var(--ink)',   r: -3 },
      { f: 'var(--f3)', bg: 'var(--red)',  c: 'var(--paper)', r: 7, s: 1.15 },
    ];
    root.querySelectorAll('[data-ransom]').forEach(el => {
      const word = el.dataset.ransom, chars = [...word];
      el.setAttribute('aria-hidden', 'true');
      el.dir = dirOf(word);
      el.innerHTML = chars.map((ch, i) => {
        const before = i > 0 && isAr(ch) && isAr(chars[i - 1]) && !NON_LEFT.includes(chars[i - 1]) ? ZWJ : '';
        const after = i < chars.length - 1 && isAr(ch) && isAr(chars[i + 1]) && !NON_LEFT.includes(ch) ? ZWJ : '';
        const s = styles[i % styles.length];
        return `<span class="ltr tilt" style="--r:${s.r};font-family:${s.f};background:${s.bg};color:${s.c};font-size:${s.s || 1.05}em">${before}${esc(ch)}${after}</span>`;
      }).join('');
    });
  }

  const langButton = (cls = 'btn btn-ghost btn-sm') =>
    `<button type="button" data-lang-toggle class="${cls}" lang="${L.other}">${icon('globe', 18)}<span>${t('lang.switch')}</span></button>`;

  const NAV = [['app', 'home', 'app.html'], ['habits', 'list', 'habits.html'], ['group', 'users', 'group.html'], ['stats', 'chart', 'stats.html'], ['settings', 'gear', 'settings.html']];

  /* Renders the signed-in shell. Returns the session, or null after redirecting a signed-out visitor to the login. */
  async function shell(active) {
    L.apply();
    injectSprite();
    let me;
    try { me = await S.session(); }
    catch (e) {
      if (!S.unavailable)                                    // store.js already shows its own banner when the library is missing
        document.body.insertAdjacentHTML('afterbegin', `<p class="demo" role="alert">${t('err.network')} <a class="underline font-bold" href="">${t('err.retry')}</a></p>`);
      return null;
    }
    if (!me) { location.replace('index.html#login'); return null; }
    document.body.classList.add('app');
    const cur = k => (k === active ? ' aria-current="page"' : '');
    document.body.insertAdjacentHTML('afterbegin', `
      <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 btn">${t('shell.skip')}</a>
      <header class="topbar">
        <div class="wrap flex items-center justify-between gap-3 py-3">
          <a href="app.html" class="logo tilt" style="--r:-3">${t('brand')}</a>
          <nav class="hidden lg:flex items-center gap-1" aria-label="${t('shell.navLabel')}">
            ${NAV.map(([k, , href]) => `<a class="navlink" href="${href}"${cur(k)}>${t('nav.' + k)}</a>`).join('')}
          </nav>
          <div class="flex items-center gap-2 sm:gap-3">
            <span class="text-sm hidden xl:inline">${t('shell.hello')} <bdi data-me-name class="font-bold">${esc(me.name)}</bdi></span>
            ${langButton()}
            <button type="button" data-signout class="btn btn-ghost btn-sm">${icon('logout', 18, 'flip-x')}<span class="hidden sm:inline">${t('shell.signout')}</span><span class="sr-only sm:hidden">${t('shell.signout')}</span></button>
          </div>
        </div>
      </header>
      ${S.mode === 'demo' ? `<p class="demo">${t('shell.demo')}</p>` : ''}
      <nav class="bottomnav" aria-label="${t('shell.navLabel')}">
        ${NAV.map(([k, ic, href]) => `<a href="${href}"${cur(k)}>${icon(ic, 24)}<span>${t('nav.' + k)}</span></a>`).join('')}
      </nav>`);
    document.querySelector('[data-signout]').addEventListener('click', async () => { await S.signOut(); location.href = 'index.html'; });
    return me;
  }

  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // Any save that fails (usually no internet) tells the person instead of failing silently.
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); toast(t('err.network')); });

  window.KhutwaUI = { shell, toast, esc, bdi, dirOf, num: L.num, t, icon, ransomize, injectSprite, langButton, HABIT_ICONS };
})();
