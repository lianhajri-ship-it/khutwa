/* خطوة — shared shell for the PRIVATE admin pages (the admin/ folder is kept out of Git).
   Sign-in gate, admin check, navigation and small helpers. Every report and action is also checked in the
   database (supabase/admin.sql), so these pages show nothing to an account that isn't an admin. */
(function () {
  const ICON = {
    home: '<path d="M3.5 11 12 4l8.5 7v9h-6v-6h-5v6h-6z"/>',
    chart: '<path d="M3 20.5h18M6 17v-5M10.5 17V7M15 17v-7M19.5 17V4"/>',
    users: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.5-4 3-6 5.5-6s5 2 5.5 6M13.5 15.5c1-1.5 2.2-2 3.5-2 2.5 0 4 2 4.5 5.5"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/>',
    out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  };
  const svg = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
  const NAV = [['index', 'الرئيسية', 'home'], ['stats', 'إحصائيات عامة', 'chart'], ['members', 'العضويات', 'users'], ['ideas', 'الأفكار السريعة', 'star'], ['messages', 'طلبات الاتصال', 'mail']];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('ar-SA-u-nu-arab');
  const num = n => nf.format(n || 0);
  const fmtWhen = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', { day: 'numeric', month: 'short' });
  const when = v => (v ? fmtWhen.format(new Date(v)) : '—');
  const dayLabel = v => fmtDay.format(new Date(String(v).length === 10 ? v + 'T00:00:00' : v));
  const TOPIC = { suggestion: 'اقتراح', problem: 'مشكلة في الموقع', account: 'حسابي', other: 'شي ثاني' };
  const ICON_NAME = { water: 'ماء', run: 'رياضة', book: 'قراءة', moon: 'نوم', leaf: 'تأمل', phone: 'بدون جوال', star: 'عادة ثانية' };

  const sb = window.supabase && window.KHUTWA_CONFIG ? window.supabase.createClient(KHUTWA_CONFIG.supabaseUrl, KHUTWA_CONFIG.supabaseKey) : null;

  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function oops(msg) {
    let el = document.getElementById('oops');
    if (!el) { el = document.createElement('p'); el.id = 'oops'; el.className = 'demo'; el.setAttribute('role', 'alert'); document.getElementById('content').prepend(el); }
    el.textContent = msg; el.hidden = false;
  }
  // Supabase returns { data, error }: show the error on the page and return null, or return the data.
  function must(res, what) {
    if (res.error) { oops(`${what}: ${res.error.message}`); return null; }
    return res.data;
  }
  // For actions that return nothing: true when it worked, otherwise shows the error and returns false.
  function ok(res, what) {
    if (res.error) { oops(`${what}: ${res.error.message}`); return false; }
    return true;
  }

  /* Vertical bars for a daily series. rows: [{ label, value }]; the last row is today. */
  function vbars(rows, unit) {
    const max = Math.max(1, ...rows.map(r => r.value));
    const peak = rows.findIndex(r => r.value === max);
    return `<div class="vbars" style="grid-template-columns:repeat(${rows.length},1fr)" role="img" aria-label="${esc(unit)}">
        ${rows.map((r, i) => `<div class="col ${i === rows.length - 1 ? 'today' : ''}" tabindex="0" title="${esc(r.label)}: ${num(r.value)} ${esc(unit)}" aria-label="${esc(r.label)}: ${num(r.value)}">
          ${(i === rows.length - 1 || (i === peak && r.value > 0)) ? `<span class="val">${num(r.value)}</span>` : ''}
          <i style="height:${(r.value / max) * 100}%"></i></div>`).join('')}
      </div>
      <div class="flex justify-between text-sm muted mt-2"><span>${esc(rows[0] ? rows[0].label : '')}</span><span>اليوم</span></div>
      <details class="mt-3"><summary class="text-sm font-bold underline">عرض كجدول</summary>
        <table class="datatable num mt-2"><thead><tr><th>اليوم</th><th>${esc(unit)}</th></tr></thead>
        <tbody>${rows.slice().reverse().map(r => `<tr><td>${esc(r.label)}</td><td>${num(r.value)}</td></tr>`).join('')}</tbody></table></details>`;
  }
  /* Horizontal bars with the value written beside each bar. rows: [{ label, value }] */
  function hbars(rows) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return rows.length ? rows.map(r => `<div class="hbar"><span class="font-bold truncate"><bdi>${esc(r.label)}</bdi></span>
        <div class="track" aria-hidden="true"><i style="width:${(r.value / max) * 100}%"></i></div><span class="num font-bold">${num(r.value)}</span></div>`).join('')
      : '<p class="muted">ما فيه بيانات للحين.</p>';
  }

  async function newMessagesCount() {
    const { count } = await sb.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new');
    return count || 0;
  }
  async function refreshBadge() {
    const n = await newMessagesCount(), b = document.getElementById('nav-badge');
    if (b) { b.textContent = num(n); b.hidden = !n; }
  }

  /* Builds the page frame, signs in, checks admin rights, then calls render(). */
  async function start(page, render) {
    const content = document.getElementById('content');
    content.hidden = true;
    document.body.insertAdjacentHTML('afterbegin', `
      <header class="topbar"><div class="wrap flex items-center justify-between gap-3 py-3">
        <div class="flex items-center gap-3"><span class="logo tilt" style="--r:-3">خطوة</span><span class="font-bold">لوحة التحكم</span></div>
        <div id="who" class="flex items-center gap-2" hidden>
          <span id="who-email" class="text-sm hidden md:inline" dir="ltr"></span>
          <a href="../index.html" class="btn btn-ghost btn-sm">${svg('site', 18)}<span class="hidden sm:inline">الموقع</span></a>
          <button type="button" id="logout" class="btn btn-ghost btn-sm">${svg('out', 18)}<span class="hidden sm:inline">خروج</span></button>
        </div>
      </div></header>`);
    const layout = document.createElement('div');
    layout.className = 'wrap admin-layout';
    layout.innerHTML = `<nav class="side" aria-label="صفحات لوحة التحكم" hidden>
        ${NAV.map(([k, label, ic]) => `<a href="${k}.html"${k === page ? ' aria-current="page"' : ''}>${svg(ic)}<span>${label}</span>${k === 'messages' ? '<span id="nav-badge" class="badge" hidden></span>' : ''}</a>`).join('')}
      </nav>
      <section id="gate" class="max-w-md w-full mx-auto" style="grid-column:1 / -1"></section>`;
    content.replaceWith(layout); layout.appendChild(content);
    const gate = document.getElementById('gate'), nav = layout.querySelector('.side');

    if (!sb) { gate.innerHTML = '<p class="demo" role="alert">ما قدرنا نحمّل مكتبة Supabase. تأكد من الإنترنت وحدّث الصفحة.</p>'; return; }

    const { data } = await sb.auth.getSession();
    const u = data.session && data.session.user;
    if (!u) {
      gate.innerHTML = `<form id="login" class="card p-6 grid gap-4" novalidate>
          <h1 class="h-sec">دخول المدير</h1>
          <div class="field"><label for="l-email">البريد الإلكتروني</label><input id="l-email" name="email" type="email" dir="ltr" autocomplete="username"></div>
          <div class="field"><label for="l-pass">كلمة المرور</label><input id="l-pass" name="password" type="password" dir="ltr" autocomplete="current-password"></div>
          <p id="l-msg" class="err" role="alert"></p>
          <button type="submit" class="btn">دخول</button>
        </form>`;
      const f = document.getElementById('login'); f.elements.email.focus();
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
        const { error } = await sb.auth.signInWithPassword({ email: f.elements.email.value.trim(), password: f.elements.password.value });
        f.elements.password.value = ''; btn.disabled = false;
        if (error) document.getElementById('l-msg').textContent = /invalid/i.test(error.message) ? 'الإيميل أو كلمة المرور غلط.' : 'ما قدرنا نسجّل الدخول: ' + error.message;
        else location.reload();
      });
      return;
    }

    document.getElementById('who').hidden = false;
    document.getElementById('who-email').textContent = u.email;
    document.getElementById('logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });

    const { data: ok, error } = await sb.rpc('is_admin');
    if (error || !ok) {
      gate.innerHTML = `<div class="card p-6 grid gap-3"><h1 class="h-sec">ما عندك صلاحية</h1>
        <p class="muted">هذا الحساب مو مدير. شغّل ملف <code dir="ltr">supabase/admin.sql</code> في Supabase بعد ما تحط فيه إيميل حسابك، أو ادخل بحساب المدير.</p></div>`;
      return;
    }

    gate.remove(); nav.hidden = false; content.hidden = false;
    refreshBadge();
    await render();
  }

  window.Admin = { start, sb, esc, num, when, dayLabel, svg, toast, oops, must, ok, vbars, hbars, refreshBadge, TOPIC, ICON_NAME };
})();
