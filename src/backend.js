import { createClient } from '@supabase/supabase-js';
import { cleanRecipe } from './recipe.js';
import { hasGooglePopup, askGoogle } from './googleSignIn.js';

/* Two backends with the same shape:
   - Supabase (live, shared): used when VITE_SUPABASE_URL and the publishable (anon) key are set.
     Anyone can look without signing in. Adding, changing or reporting a room needs Google sign-in.
   - Demo (this browser only): used before you connect Supabase, so the site still runs. */

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAX_CODE_CHARS = 60000;
const PAGE = 1000;

// what gets stored: the recipe only, never the square or the owner
function toStored(recipe) {
  const r = cleanRecipe(recipe);
  const stored = { v: 1, title: r.title, bio: r.bio, color: r.color, links: r.links, objects: r.objects };
  if (r.decor) stored.decor = r.decor;
  if (JSON.stringify(stored).length > MAX_CODE_CHARS) throw { code: 'too_big', message: 'This room code is too big. Ask your Claude for fewer parts.' };
  return stored;
}
// what the page draws: cleaned again, because everything in the database is other people's input
function fromRow(row) {
  try {
    const r = cleanRecipe({ ...(row.recipe || {}), id: row.owner });
    return { ...r, owner: row.owner, px: row.px, pz: row.pz, hidden: !!row.hidden, createdAt: row.created_at, slug: row.slug || null };
  } catch { return null; }
}
// a room's link, made the way the database makes it (supabase/schema.sql): "Maya's Studio" -> mayas-studio
function slugify(title) {
  const s = String(title || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
  return s.length < 2 ? 'room' : s;
}
function userOf(u) {
  if (!u || u.is_anonymous) return null;
  const m = u.user_metadata || {};
  return { id: u.id, name: m.full_name || m.name || (u.email || '').split('@')[0] || 'you', email: u.email || '' };
}

export async function createBackend() {
  if (URL_ && KEY_) {
    try { return await supabaseBackend(); } catch (e) { console.warn('Supabase unavailable, using demo mode', e); }
  }
  return demoBackend();
}

async function supabaseBackend() {
  const sb = createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  // coming back from Google: supabase-js swaps the ?code= for a session while it starts up
  const params = new URLSearchParams(location.search);
  let authError = params.get('error_description') || null;
  const { data: { session } } = await sb.auth.getSession();
  if (params.has('code') || params.has('error')) history.replaceState(null, '', location.pathname + location.hash);

  const api = { mode: 'live', user: userOf(session?.user), authError, homeOwner: false };
  Object.defineProperty(api, 'me', { get: () => api.user?.id || null });
  // is this Google account the owner of the home room? The owner's email stays in the database, never in the site.
  const checkHomeOwner = async () => {
    if (!api.user) { api.homeOwner = false; return; }
    try { const { data, error } = await sb.rpc('is_home_owner'); api.homeOwner = !error && data === true; } catch { api.homeOwner = false; }
  };
  await checkHomeOwner();
  const authListeners = [];
  sb.auth.onAuthStateChange((_ev, s) => {
    const u = userOf(s?.user);
    if ((u?.id || null) === (api.user?.id || null)) return;
    api.user = u; checkHomeOwner().finally(() => authListeners.forEach(cb => cb(u)));
  });
  api.onAuth = cb => authListeners.push(cb);

  // Google's sign-in in a popup when VITE_GOOGLE_CLIENT_ID is set (Google then names this site, not supabase.co),
  // otherwise Supabase's redirect to Google and back. Resolves true once signed in, false if the popup
  // was closed, and 'redirect' when the page is leaving for Google.
  api.signIn = async () => {
    if (hasGooglePopup()) {
      let got;
      try { got = await askGoogle(); } catch (e) { console.warn(e); got = undefined; }   // the popup was blocked: use the redirect
      if (got === null) return false;
      if (got) {
        const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: got.token, nonce: got.nonce });
        if (error) throw { code: 'signin_failed', message: 'Could not sign in with Google: ' + error.message };
        const u = userOf(data?.user);
        if (u && u.id !== api.me) { api.user = u; await checkHomeOwner(); authListeners.forEach(cb => cb(u)); }
        return true;
      }
    }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) throw { code: 'signin_failed', message: 'Could not start Google sign-in: ' + error.message };
    return 'redirect';
  };
  api.signOut = async () => { await sb.auth.signOut(); };

  api.listRooms = async () => {
    const out = [];
    for (let from = 0; from < 20000; from += PAGE) {
      // every column, so the rooms still load on a database that doesn't have the slug column yet
      const { data, error } = await sb.from('rooms').select('*').order('created_at', { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...data.map(fromRow).filter(Boolean));
      if (data.length < PAGE) break;
    }
    return out;
  };
  api.subscribe = (cb) => {
    let t = null; // many changes in a row only reload once
    const ch = sb.channel('rooms-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => { clearTimeout(t); t = setTimeout(async () => { try { cb(await api.listRooms()); } catch {} }, 400); })
      .subscribe();
    return () => sb.removeChannel(ch);
  };
  api.saveRoom = async (recipe, px, pz) => {
    if (!api.me) throw { code: 'signin', message: 'Sign in with Google first.' };
    const row = { owner: api.me, px, pz, recipe: toStored(recipe) };
    const { error } = await sb.from('rooms').upsert(row, { onConflict: 'owner' });
    if (error) {
      if (error.code === '23505' && /slug/.test(error.message)) throw { code: 'slug_taken', message: 'Someone just saved a room with the same name. Try again.' };
      if (error.code === '23505') throw { code: 'taken', message: 'Someone just took that square. Click another glowing square and try again.' };
      if (error.code === '23514') throw { code: 'invalid', message: 'The database said no to this room code. Ask your Claude for a smaller room.' };
      if (error.code === 'P0001') throw { code: 'too_far', message: error.message };
      if (error.code === '42501') throw { code: 'not_allowed', message: 'This room can\'t be changed right now. It may have been hidden after reports.' };
      throw { code: 'save_failed', message: 'Could not save: ' + error.message };
    }
  };
  api.deleteRoom = async () => {
    if (!api.me) return;
    const { error } = await sb.from('rooms').delete().eq('owner', api.me);
    if (error) throw { code: 'delete_failed', message: 'Could not delete: ' + error.message };
  };
  api.report = async (owner, reason) => {
    if (!api.me) throw { code: 'signin', message: 'Sign in with Google to report a room.' };
    const { error } = await sb.from('reports').insert({ room_owner: owner, reason: String(reason || '').slice(0, 200) });
    if (error && error.code !== '23505') throw { code: 'report_failed', message: 'Could not send the report: ' + error.message };
  };
  return api;
}

function demoBackend() {
  const KEY = 'room-grid-web-demo-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const write = rows => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {} };
  let me = 'demo-me';
  try { me = localStorage.getItem(KEY + ':me') || ('demo-' + Math.random().toString(36).slice(2, 10)); localStorage.setItem(KEY + ':me', me); } catch {}
  let listeners = [];
  const listRooms = async () => read().map(fromRow).filter(Boolean);
  const emit = async () => { const list = await listRooms(); listeners.forEach(cb => cb(list)); };
  return {
    mode: 'demo', me, user: { id: me, name: 'Demo', email: '' }, authError: null, homeOwner: false, listRooms,
    onAuth() {}, async signIn() {}, async signOut() {},
    subscribe(cb) { listeners.push(cb); return () => { listeners = listeners.filter(l => l !== cb); }; },
    async saveRoom(recipe, px, pz) {
      const rows = read();
      if (rows.some(r => r.owner !== me && r.px === px && r.pz === pz)) throw { code: 'taken', message: 'That square is taken. Click another glowing square.' };
      const old = rows.find(r => r.owner === me), stored = toStored(recipe);
      let slug = old?.slug;
      if (!slug) { const base = slugify(stored.title); slug = base; for (let n = 2; rows.some(r => r.owner !== me && r.slug === slug); n++) slug = `${base}-${n}`; }
      const next = rows.filter(r => r.owner !== me).concat([{ owner: me, px, pz, recipe: stored, slug, created_at: old?.created_at || new Date().toISOString() }]);
      write(next); emit();
    },
    async deleteRoom() { write(read().filter(r => r.owner !== me)); emit(); },
    async report() {}
  };
}
