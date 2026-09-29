# Setting up Cubby

How to put your own copy of Cubby online (about 30 minutes) and look after it. For what Cubby is and how to run it on your computer, see the [README](README.md).

## 1. Supabase: stores the rooms

1. Make a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, click **New query**, paste all of `supabase/schema.sql`, and click **Run**. (Running it again later is safe.)
3. Open **Authentication > Sign In / Providers** and make sure **Allow anonymous sign-ins** is **off**.
4. Open **Project Settings > API Keys** and copy two things: the **Project URL** and the **publishable** key (starts with `sb_publishable_`; older projects call it the **anon public** key). Never use the **secret** / `service_role` key in the site.

## 2. Google sign-in

1. In Supabase, open **Authentication > Sign In / Providers > Google**. Turn it on and copy the **Callback URL** it shows (it ends in `/auth/v1/callback`). Leave this tab open.
2. Go to [console.cloud.google.com](https://console.cloud.google.com) and make a new project called Cubby.
3. Open **APIs & Services > OAuth consent screen** (Google may call it **Google Auth Platform**). Choose **External**, app name **Cubby**, your email for support and contact. Save. Then **publish** the app (Audience > Publish app) so anyone can sign in, not just test users.
4. Open **Credentials > Create credentials > OAuth client ID**. Pick **Web application**.
   - **Authorized JavaScript origins:** your site, for example `https://cubby.vercel.app`, and `http://localhost:5173` for testing.
   - **Authorized redirect URIs:** the Supabase Callback URL from step 1, plus Cubby's own sign-in page on your site and for testing: `https://cubby.vercel.app/google-callback.html` and `http://localhost:5173/google-callback.html`.
5. Copy the **Client ID** and **Client secret** into the Supabase Google page from step 1. Save.
6. In Supabase, open **Authentication > URL Configuration**:
   - **Site URL:** your Vercel address, like `https://cubby.vercel.app`.
   - **Redirect URLs:** add `https://cubby.vercel.app/**` and `http://localhost:5173/**`. The `/**` matters: it lets people who sign in from a room's link land back in that room.
7. Keep the **Client ID** handy for Vercel (`VITE_GOOGLE_CLIENT_ID`, step 3 below). With it, clicking sign-in opens Google's sign-in straight away in a popup, and Google's screen says your site instead of the long `supabase.co` address. It's safe to share: it isn't a secret.

## 3. Vercel: puts the site on the internet

1. Put this folder in a new GitHub repo.
2. At [vercel.com](https://vercel.com), click **Add New > Project** and import the repo. Vercel detects Vite by itself, and `vercel.json` makes room links like `/mayas-studio` work.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key (or `VITE_SUPABASE_ANON_KEY` = your anon key)
   - `VITE_GOOGLE_CLIENT_ID` = the Google **Client ID** from step 2 (optional, but it makes Google's sign-in screen show your site)
4. Click **Deploy** and share the link. If the address is different from the one you used in step 2, add it in both Google (origins) and Supabase (Site URL and Redirect URLs).

To test the live version on your computer, copy `.env.example` to `.env.local` and fill in the same values.

## 4. Keep Supabase awake

Supabase's free plan pauses a project after 7 days with no visits. The file `setup/keep-awake.yml` pings it every 3 days. To turn it on:

1. Move it to `.github/workflows/keep-awake.yml` (make the two folders if they don't exist).
2. Add two secrets to the GitHub repo (**Settings > Secrets and variables > Actions > New repository secret**):

   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your publishable (or anon) key

GitHub stops scheduled jobs in repos with no commits for 60 days. If that happens, open the **Actions** tab and turn it back on.

## 5. Link the home room to your Google account

The home room is built in code, so it isn't a row in the `rooms` table. To have the site know it's yours when you sign in:

1. Run the latest `supabase/schema.sql` (it adds a private `home_owner` table).
2. In **SQL Editor**, run this with the Gmail address you sign in with:

   ```sql
   insert into public.home_owner (email) values ('you@gmail.com') on conflict do nothing;
   ```

3. On the site, open **Add your room**, click **Sign in**, and pick that Google account. The button now says **Your room** and takes you to the home room.

Your email only lives in that table. Nobody can read it from the site.

## Looking after the grid

- **Hiding a room:** Supabase > **Table Editor** > `rooms` > set `hidden` to `true`. Only its owner still sees it, and they can't change it. Set it back to `false` to bring it back.
- **Removing a room for good:** delete its row in the same table.
- **Room links:** they're in the `slug` column. Only you can change one there (lowercase letters, numbers and dashes); nobody can change theirs from the site. Titles with no English letters, like Chinese ones, get `room`, `room-2` and so on, so you may want to give those a better one. Rooms added before links existed got theirs when you ran `schema.sql`, oldest room first.
- **Reports:** signed-in visitors can press **Report it** on a room card. Reports land in the `reports` table (only you can read it). A room with reports from 3 different people hides itself until you look at it.
- **Spam:** one room per Google account, and new rooms can only go one ring past the farthest room, so nobody can scatter rooms across the whole grid.
- **Updating the database:** after pulling changes to `supabase/schema.sql`, run the whole file again in **SQL Editor**. It only adds or replaces things.
