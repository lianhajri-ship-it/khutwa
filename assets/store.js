/* خطوة — data layer on Supabase (tables and rules: supabase/schema.sql).
   Pages only ever talk to window.KhutwaStore. Each page loads the signed-in person's own habits and
   completions once, scores them here, and writes back their weekly points and streak so group mates
   can see them on the leaderboard. */
(function () {
  const C = window.KHUTWA_CONFIG;
  const RULES = { pointsPerHabit: 10, allDoneBonus: 20, pointsPerLevel: 500 };

  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const weekStart = d => addDays(d, -d.getDay());           // week starts on Sunday

  /* The Supabase library comes from a CDN. If it (or the config) didn't load, usually because the connection
     dropped, show a banner and hand pages a store whose every call fails with 'network', so each page shows
     its usual "couldn't reach the server" message instead of breaking silently. */
  if (!window.supabase || !C) {
    const t = window.KhutwaI18n ? window.KhutwaI18n.t : k => k;
    const banner = () => document.body.insertAdjacentHTML('afterbegin',
      `<p class="demo" role="alert">${t('err.offline')} <a class="underline font-bold" href="">${t('err.retry')}</a></p>`);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
    const fail = async () => { throw new Error('network'); };
    window.KhutwaStore = new Proxy({ mode: 'offline', unavailable: true, RULES, dayKey, today, onRecovery() {} },
      { get: (base, key) => (key in base ? base[key] : fail) });
    return;
  }
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);

  /* Supabase answers { data, error }; turn errors into thrown Errors with a short code the pages can map to text. */
  function must({ data, error }) {
    if (error) {
      const m = `${error.code || ''} ${error.message || ''}`;
      const code = /bad_code/.test(m) ? 'bad_code' : /too_many/.test(m) ? 'too_many' : /Failed to fetch|NetworkError|network/i.test(m) ? 'network' : 'generic';
      const e = new Error(code); e.cause = error; throw e;
    }
    return data;
  }

  /* ---------- the signed-in person's own data, loaded once per page ---------- */
  let cache = null;
  async function user() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; }
  async function load() {
    if (cache) return cache;
    const u = await user(); if (!u) throw new Error('not_signed_in');
    const since = dayKey(addDays(today(), -400));
    const [p, h, c] = await Promise.all([
      sb.from('profiles').select('name, hide_from_board, created_at').eq('id', u.id).maybeSingle(),
      sb.from('habits').select('id, name, target, icon').order('created_at'),
      sb.from('completions').select('habit_id, day, count').gte('day', since),
    ]);
    let profile = must(p);
    if (!profile) {                                          // account made before the schema existed
      profile = { name: (u.user_metadata && u.user_metadata.name) || u.email.split('@')[0], hide_from_board: false, created_at: u.created_at };
      must(await sb.from('profiles').insert({ id: u.id, name: profile.name }));
    }
    const done = {};
    must(c).forEach(r => { (done[r.day] = done[r.day] || {})[r.habit_id] = r.count; });
    cache = {
      uid: u.id,
      profile: { name: profile.name, email: u.email, hideFromBoard: profile.hide_from_board, joined: String(profile.created_at).slice(0, 10) },
      habits: must(h), done,
    };
    syncStats();                                             // keep this week's numbers fresh for the leaderboard
    return cache;
  }

  /* ---------- scoring ---------- */
  const isDone = (h, map) => ((map || {})[h.id] || 0) >= h.target;
  function dayStats(s, k) {
    const n = s.habits.filter(h => isDone(h, s.done[k])).length, total = s.habits.length;
    const complete = total > 0 && n === total;
    return { date: k, done: n, total, complete, pts: n * RULES.pointsPerHabit + (complete ? RULES.allDoneBonus : 0) };
  }
  const totalPoints = s => Object.keys(s.done).reduce((a, k) => a + dayStats(s, k).pts, 0);
  function weekPoints(s, weeksAgo) {
    const start = addDays(weekStart(today()), -7 * weeksAgo); let p = 0;
    for (let i = 0; i < 7; i++) { const d = addDays(start, i); if (d > today()) break; p += dayStats(s, dayKey(d)).pts; }
    return p;
  }
  // A streak day = every habit done. Today only counts once finished. One missed day per week is forgiven (rest day).
  function streak(s) {
    let d = today(), n = 0; const rested = new Set();
    if (!dayStats(s, dayKey(d)).complete) d = addDays(d, -1);
    for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
      if (dayStats(s, dayKey(d)).complete) { n++; continue; }
      const wk = dayKey(weekStart(d));
      if (n > 0 && !rested.has(wk)) { rested.add(wk); continue; }
      break;
    }
    return n;
  }
  function bestStreak(s) {
    let best = 0, run = 0;
    for (let i = 400; i >= 1; i--) { if (dayStats(s, dayKey(addDays(today(), -i))).complete) best = Math.max(best, ++run); else run = 0; }
    return Math.max(best, streak(s));
  }
  async function syncStats() {
    const s = cache; if (!s) return;
    await sb.from('profiles').update({ week_points: weekPoints(s, 0), week_start: dayKey(weekStart(today())), streak: streak(s) }).eq('id', s.uid);
  }

  /* ---------- auth ---------- */
  const here = page => (location.protocol.startsWith('http') ? new URL(page, location.href).href : undefined);
  async function session() {
    const u = await user(); if (!u) return null;
    const s = await load();
    return { email: u.email, name: s.profile.name };
  }
  async function signIn({ email, password }) {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(/confirm/i.test(error.message) ? 'unconfirmed' : /invalid/i.test(error.message) ? 'invalid' : /fetch|network/i.test(error.message) ? 'network' : 'generic');
  }
  // Resolves { confirm: true } when the project asks new accounts to confirm their email first.
  async function signUp({ email, password, name }) {
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: here('index.html') } });
    if (error) throw new Error(/already|exists/i.test(error.message) ? 'exists' : /password/i.test(error.message) ? 'weak' : /fetch|network/i.test(error.message) ? 'network' : 'generic');
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('exists');
    return { confirm: !data.session };
  }
  async function resetPassword(email) { must(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: here('index.html') })); }
  async function updatePassword(password) { must(await sb.auth.updateUser({ password })); }
  function onRecovery(fn) { sb.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') fn(); }); }
  async function signOut() { await sb.auth.signOut(); cache = null; }
  async function deleteAccount() { must(await sb.rpc('delete_me')); await sb.auth.signOut(); cache = null; }

  /* ---------- habits ---------- */
  const clampTarget = t => Math.max(1, Math.min(20, Math.round(Number(t) || 1)));
  async function habits() { return (await load()).habits.map(h => ({ ...h })); }
  async function addHabit({ name, target, icon }) {
    const s = await load();
    const h = must(await sb.from('habits').insert({ name: name.trim().slice(0, 40), target: clampTarget(target), icon: icon || 'star' }).select('id, name, target, icon').single());
    s.habits.push(h); syncStats(); return h;
  }
  async function updateHabit(id, patch) {
    const s = await load(), row = {};
    if (patch.name != null) row.name = patch.name.trim().slice(0, 40);
    if (patch.target != null) row.target = clampTarget(patch.target);
    if (patch.icon) row.icon = patch.icon;
    must(await sb.from('habits').update(row).eq('id', id));
    Object.assign(s.habits.find(h => h.id === id) || {}, row); syncStats();
  }
  async function deleteHabit(id) {
    const s = await load();
    must(await sb.from('habits').delete().eq('id', id));     // its completions go with it
    s.habits = s.habits.filter(h => h.id !== id);
    Object.values(s.done).forEach(m => delete m[id]); syncStats();
  }
  async function dayMap(k = dayKey(today())) { return { ...((await load()).done[k] || {}) }; }
  async function setCount(id, count, k = dayKey(today())) {
    const s = await load(), h = s.habits.find(x => x.id === id); if (!h) return;
    const c = Math.max(0, Math.min(h.target, count));
    if (c) must(await sb.from('completions').upsert({ habit_id: id, day: k, count: c }));
    else must(await sb.from('completions').delete().eq('habit_id', id).eq('day', k));
    s.done[k] = s.done[k] || {};
    if (c) s.done[k][id] = c; else delete s.done[k][id];
    await syncStats();
  }

  /* ---------- summaries ---------- */
  async function summary() {
    const s = await load(), pts = totalPoints(s), into = pts % RULES.pointsPerLevel;
    return {
      points: pts, level: Math.floor(pts / RULES.pointsPerLevel) + 1,
      levelProgress: into / RULES.pointsPerLevel, toNext: RULES.pointsPerLevel - into,
      streak: streak(s), bestStreak: bestStreak(s),
      today: dayStats(s, dayKey(today())), weekPoints: weekPoints(s, 0), lastWeekPoints: weekPoints(s, 1),
    };
  }
  async function history(days) {
    const s = await load();
    return Array.from({ length: days }, (_, i) => dayStats(s, dayKey(addDays(today(), i - days + 1))));
  }
  async function habitHistory(days) {
    const s = await load();
    return s.habits.map(h => {
      let n = 0; for (let i = 0; i < days; i++) if (isDone(h, s.done[dayKey(addDays(today(), -i))])) n++;
      return { ...h, doneDays: n, days };
    });
  }

  /* ---------- group & challenges ---------- */
  async function myGroupId(s) {
    const m = must(await sb.from('group_members').select('group_id').eq('user_id', s.uid).maybeSingle());
    return m ? m.group_id : null;
  }
  async function group() {
    const s = await load(), gid = await myGroupId(s); if (!gid) return null;
    const [g, members, ch] = await Promise.all([
      sb.from('groups').select('name, code').eq('id', gid).single(),
      sb.from('group_members').select('user_id').eq('group_id', gid),
      sb.from('challenges').select('id, habit_name, days, start_day').eq('group_id', gid).order('created_at'),
    ]);
    const ids = must(members).map(m => m.user_id);
    const people = must(await sb.from('profiles').select('id, name, week_points, week_start, streak').in('id', ids));
    const wk = dayKey(weekStart(today()));
    const board = people.filter(p => p.id !== s.uid).map(p => ({ id: p.id, name: p.name, week: p.week_start === wk ? p.week_points : 0, streak: p.streak }));
    board.push({ id: s.uid, name: s.profile.name, week: weekPoints(s, 0), streak: streak(s), me: true, hidden: s.profile.hideFromBoard });
    board.sort((a, b) => b.week - a.week);
    const others = board.filter(m => !m.me).map(m => m.name);
    return {
      name: must(g).name, code: must(g).code, board,
      challenges: must(ch).map(c => {
        const h = s.habits.find(x => x.name === c.habit_name), start = new Date(c.start_day + 'T00:00:00');
        let mine = 0, elapsed = 0;
        for (let i = 0; i < c.days; i++) { const d = addDays(start, i); if (d > today()) break; elapsed++; if (h && isDone(h, s.done[dayKey(d)])) mine++; }
        return { id: c.id, habit: c.habit_name, days: c.days, elapsed, mine, members: others };
      }),
    };
  }
  async function createGroup(name) { await load(); must(await sb.rpc('create_group', { p_name: name.trim().slice(0, 30) })); }
  async function joinGroup(code) {
    code = code.replace(/\s+/g, '').toUpperCase();
    if (!/^KH-[A-Z0-9]{4}(-[A-Z0-9]{4})?$/.test(code)) throw new Error('bad_code');   // KH-XXXX-XXXX (older groups: KH-XXXX)
    await load(); must(await sb.rpc('join_group', { p_code: code }));
  }
  async function leaveGroup() { const s = await load(); must(await sb.from('group_members').delete().eq('user_id', s.uid)); }
  async function addChallenge({ habitId, days }) {
    const s = await load(), h = s.habits.find(x => x.id === habitId), gid = await myGroupId(s);
    if (!h || !gid) return;
    must(await sb.from('challenges').insert({ group_id: gid, habit_name: h.name, days: Number(days) }));
  }

  /* ---------- profile & data rights ---------- */
  async function profile() { return { ...(await load()).profile }; }
  async function updateProfile(patch) {
    const s = await load(), row = {};
    if (patch.name != null) row.name = patch.name.trim().slice(0, 30);
    if (patch.hideFromBoard != null) row.hide_from_board = !!patch.hideFromBoard;
    must(await sb.from('profiles').update(row).eq('id', s.uid));
    if (row.name) s.profile.name = row.name;
    if ('hide_from_board' in row) s.profile.hideFromBoard = row.hide_from_board;
  }
  /* ---------- quick habit ideas ---------- */
  async function habitIdeas() {
    const rows = must(await sb.from('habit_ideas').select('name_ar, name_en, target, icon').eq('active', true).order('sort'));
    const en = window.KhutwaI18n && window.KhutwaI18n.lang === 'en';
    return rows.map(r => ({ name: en ? r.name_en : r.name_ar, target: r.target, icon: r.icon }));
  }

  /* ---------- contact form (works signed in or not) ---------- */
  async function sendContact({ name, email, topic, message }) {
    must(await sb.from('contact_messages').insert({
      name: name.trim().slice(0, 60), email: email.trim().slice(0, 120), topic, message: message.trim().slice(0, 2000),
    }));
  }
  // Name and email of the signed-in visitor, to prefill the contact form; null when signed out.
  async function contactDefaults() {
    const u = await user(); if (!u) return null;
    const p = must(await sb.from('profiles').select('name').eq('id', u.id).maybeSingle());
    return { name: p ? p.name : '', email: u.email };
  }

  async function exportData() {
    const s = await load(), g = await group();
    return { exportedAt: new Date().toISOString(), profile: s.profile, habits: s.habits, completions: s.done, group: g && { name: g.name, code: g.code } };
  }

  window.KhutwaStore = {
    mode: 'live', RULES, dayKey, today,
    session, signIn, signUp, resetPassword, updatePassword, onRecovery, signOut, deleteAccount,
    habits, addHabit, updateHabit, deleteHabit, dayMap, setCount,
    summary, history, habitHistory,
    group, createGroup, joinGroup, leaveGroup, addChallenge,
    profile, updateProfile, exportData, sendContact, contactDefaults, habitIdeas,
  };
})();
