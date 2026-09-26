# Cubby

Cubby is a glowing grid of little 3D rooms, with Enhe’s room (the home room) in the middle. Anyone can add their own room:

1. Click **Add your room**, then **Copy the prompt**.
2. Paste the prompt into your own Claude. It looks through your projects (or asks you a few questions) and gives back a **room code**.
3. Paste the room code into the site and click **Add my room**. It goes on the nearest empty square, or click an empty square first to choose one.

Rooms save to a shared database, so everyone sees everyone's rooms right away. Anyone can look around without an account. Adding a room needs a Google sign-in, which gives one room per Google account and makes spam hard. It's free: visitors use their own Claude, and Supabase and Vercel have free plans.

The grid starts 7 x 7 and grows by one ring whenever rooms reach the edge, so there is always a ring of empty squares to add to.

## Try it on your computer

You need Node.js 18 or newer (check with `node -v`). Open a terminal **inside this folder**, then:

```bash
npm install
npm run dev
```

`npm install` only needs to run once. It downloads the 3D and database libraries into a `node_modules` folder; without it, `npm run dev` fails with "vite is not recognized".

On Windows, if PowerShell says "running scripts is disabled on this system", use **Command Prompt** instead, or type `npm.cmd install` and `npm.cmd run dev`.

Open the address it prints (usually http://localhost:5173). Until you connect Supabase, the site runs in **demo mode**: rooms you save stay in your browser only.

## Put it online (about 30 minutes)

### 1. Supabase: stores the rooms

1. Make a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, click **New query**, paste all of `supabase/schema.sql`, and click **Run**. (Running it again later is safe.)
3. Open **Authentication > Sign In / Providers** and make sure **Allow anonymous sign-ins** is **off**.
4. Open **Project Settings > API Keys** and copy two things: the **Project URL** and the **publishable** key (starts with `sb_publishable_`; older projects call it the **anon public** key). Never use the **secret** / `service_role` key in the site.

### 2. Google sign-in

1. In Supabase, open **Authentication > Sign In / Providers > Google**. Turn it on and copy the **Callback URL** it shows (it ends in `/auth/v1/callback`). Leave this tab open.
2. Go to [console.cloud.google.com](https://console.cloud.google.com) and make a new project called Cubby.
3. Open **APIs & Services > OAuth consent screen** (Google may call it **Google Auth Platform**). Choose **External**, app name **Cubby**, your email for support and contact. Save. Then **publish** the app (Audience > Publish app) so anyone can sign in, not just test users.
4. Open **Credentials > Create credentials > OAuth client ID**. Pick **Web application**.
   - **Authorized JavaScript origins:** your site, for example `https://cubby.vercel.app`, and `http://localhost:5173` for testing.
   - **Authorized redirect URIs:** the Supabase Callback URL from step 1.
5. Copy the **Client ID** and **Client secret** into the Supabase Google page from step 1. Save.
6. In Supabase, open **Authentication > URL Configuration**:
   - **Site URL:** your Vercel address, like `https://cubby.vercel.app`.
   - **Redirect URLs:** add `https://cubby.vercel.app/**` and `http://localhost:5173/**`.

### Link the home room to your Google account

The home room is built in code, so it isn't a row in the `rooms` table. To have the site know it's yours when you sign in:

1. Run the latest `supabase/schema.sql` (it adds a private `home_owner` table).
2. In **SQL Editor**, run this with the Gmail address you sign in with:

   ```sql
   insert into public.home_owner (email) values ('you@gmail.com') on conflict do nothing;
   ```

3. On the site, open **Add your room**, click **Sign in**, and pick that Google account. The button now says **Your room** and takes you to the home room.

Your email only lives in that table. Nobody can read it from the site.

### 3. Vercel: puts the site on the internet

1. Put this folder in a new GitHub repo.
2. At [vercel.com](https://vercel.com), click **Add New > Project** and import the repo. Vercel detects Vite by itself.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key (or `VITE_SUPABASE_ANON_KEY` = your anon key)
4. Click **Deploy** and share the link. If the address is different from the one you used in step 2, add it in both Google (origins) and Supabase (Site URL and Redirect URLs).

To test the live version on your computer, copy `.env.example` to `.env.local` and fill in the same two values.

### 4. Keep Supabase awake

Supabase's free plan pauses a project after 7 days with no visits. The file `setup/keep-awake.yml` pings it every 3 days. To turn it on:

1. Move it to `.github/workflows/keep-awake.yml` (make the two folders if they don't exist).
2. Add two secrets to the GitHub repo (**Settings > Secrets and variables > Actions > New repository secret**):

   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your publishable (or anon) key

GitHub stops scheduled jobs in repos with no commits for 60 days. If that happens, open the **Actions** tab and turn it back on.

## Looking after the grid

- **Hiding a room:** Supabase > **Table Editor** > `rooms` > set `hidden` to `true`. Only its owner still sees it, and they can't change it. Set it back to `false` to bring it back.
- **Removing a room for good:** delete its row in the same table.
- **Reports:** signed-in visitors can press **Report it** on a room card. Reports land in the `reports` table (only you can read it). A room with reports from 3 different people hides itself until you look at it.
- **Spam:** one room per Google account, and new rooms can only go one ring past the farthest room, so nobody can scatter rooms across the whole grid.
- **Room codes are checked twice:** once in the browser (only shapes, sizes, colors and text get through, never code) and once by the database (size and shape limits).

## Staying smooth

- **Sharpness adjusts itself.** If frames get slow (under about 40 per second), the site draws fewer pixels, then turns off shadows. It remembers the level that works for each browser.
- **Every room has a far version.** It's a baked copy: the room's solid parts merged into one mesh with their colours kept, round shapes simplified, plus its lamp glows and name sign. That's about 7 draw calls instead of ~170, so you can look over the whole grid and still see what's in every room. Pictures and window views show as their average colour until you get close.
- **Only the nearest rooms get full detail,** the 6 closest to the camera and the one you're in. Their detail is built in the background in small steps (build, compile shaders, upload pictures) and swapped in only once it's ready. Heavy steps wait until the camera is still. Detail for rooms far down the list is freed again.
- **The heavy work happens behind the loading screen.** Every room's far version is made (with a progress bar) and every shader compiled before the grid appears, so the fly-in is smooth. If the database is slow, the grid shows after 8 seconds and the rooms fade in as they arrive.
- **Return visits are near-instant.** Far versions are cached in the visitor's browser (IndexedDB): about 0.4 ms a room instead of about 16 ms. The cache is keyed by the room code and a fingerprint of the room-building code (`vite.config.js`), so changing either one re-bakes. The cache is off in `npm run dev`.
- **Zooming out has a limit:** well past the whole-grid view on the grid (2 times), and a little past the starting view inside a room.
- **Rooms lost in the fog are not drawn at all.**
- **Shadows are redrawn only when needed:** every frame while the camera flies, every 2nd frame inside a room, every 8th frame on the grid.
- **Lamp light is faked** with glows instead of real lights, so lamps in every room do not slow the grid down.

## Files

| File | What it does |
| --- | --- |
| `src/main.js` | The world: camera, glowing floor, rain, focus effect, picking, panels, add-your-room flow |
| `src/homeRoom.js` | The detailed home room in the centre and the text for each clickable thing in it |
| `src/recipe.js` | The room code format: checking a pasted code, building a room from it, and the prompt people copy |
| `src/decor.js` | The window, pictures on the walls and lamps a room code can ask for (the lamp light is faked with glows, so many rooms stay fast) |
| `src/kit.js` | Ready-made models a room code can use (F1 car, guitar, cat, and more) and the room shell |
| `src/kitList.js` | Kit names and colors |
| `src/farView.js` | A room's far version: bakes a built room into small cacheable data, and turns that data back into meshes |
| `src/roomCache.js` | Keeps far versions in the visitor's browser (IndexedDB) so return visits skip building |
| `src/backend.js` | Talks to Supabase (live) or browser storage (demo) |
| `supabase/schema.sql` | The database table and its safety rules |
| `public/favicon.svg` | The tab icon (plus `favicon.ico` and `apple-touch-icon.png` for older browsers and phones) |
| `setup/keep-awake.yml` | Keeps the free Supabase project from pausing (move it into `.github/workflows/`) |
