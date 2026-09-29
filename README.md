# Cubby

A glowing grid of little 3D rooms, one per person. Each room shows who someone is: what they build, what they love, and a personal touch or two. Enhe’s room sits in the middle.

**Visit it: [cubbyroom.vercel.app](https://cubbyroom.vercel.app)**

## Add your room

1. Open Cubby, click **Add your room**, then **Copy the prompt**.
2. Paste the prompt into your own Claude. It looks through your projects (or asks you a few questions), designs your room like a set designer, and gives back a **room code**.
3. Paste the room code into Cubby and click **Add my room**. Sign in with Google, pick a glowing empty square (or take the nearest one), and the camera flies you into your new room.

Looking around never needs an account.

## What's in it

- **Rooms designed by your own Claude.** A room code is plain data: things built from simple shapes or picked from a kit of ready-made models (F1 car, guitar, climbing wall, telescope, cat, and more), plus pictures on the walls, a window view, lamps and motion. Pets can breathe, fans can spin, and a robot can climb the wall.
- **A link for every room.** [cubbyroom.vercel.app/enhe](https://cubbyroom.vercel.app/enhe) flies straight into Enhe’s room. Every room card has a **Copy link** button (**Share** on phones), and the address bar follows the room you're in, so you can send anyone's room to a friend.
- **Live for everyone.** Rooms save to a shared database, and new or changed rooms show up for every visitor right away.
- **A grid that grows.** It starts at 7 x 7 and grows by a ring whenever rooms reach the edge, so there's always an empty ring to add to.
- **Safe by design.** Room codes are checked in the browser (only shapes, sizes, colours and text get through, never code) and again by the database. Google sign-in means one room per Google account, and a room reported by 3 different people hides itself.
- **Free to run.** Visitors design their rooms with their own Claude, and Supabase and Vercel have free plans.

## How it stays smooth

Every room is full of detail, so the grid is built to stay smooth as it fills up, even on a phone:

- **Every room has a far version,** a baked copy with its solid parts merged into one mesh: about 7 draw calls instead of about 170. Only the 6 rooms nearest the camera, and the one you're in, get full detail, which is built in the background in small steps and swapped in once it's ready.
- **Return visits are near-instant.** Far versions are cached in the browser, about 0.4 ms a room instead of about 16 ms. The cache knows when a room or the room-building code changes, and re-bakes.
- **Quality adjusts itself.** When frames get slow, the site draws fewer pixels, turns off shadows and shows fewer rooms in full detail, and remembers what works on each device.
- **Heavy work hides behind the loading screen.** Rooms are baked and shaders compiled before the grid appears, so the fly-in is smooth.
- **Cheap tricks where they count.** Lamp light is faked with glows, rooms lost in the fog aren't drawn, and shadows are redrawn only when something moves.

## Built with

- [Three.js](https://threejs.org) for the 3D, and [Vite](https://vite.dev) for the build
- [Supabase](https://supabase.com): Postgres with row-level security, live updates, and Google sign-in
- [Vercel](https://vercel.com) for hosting and analytics
- Claude, which visitors use to design their rooms (the prompt lives in `src/recipe.js`)

## Run it on your computer

You need Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). Without Supabase keys, Cubby runs in **demo mode**, and rooms you save stay in your browser. On Windows, if PowerShell says running scripts is disabled, use Command Prompt, or `npm.cmd install` and `npm.cmd run dev`.

To put your own copy online (Supabase, Google sign-in, Vercel) and look after the grid, see [SETUP.md](SETUP.md).

## Project layout

| File | What it does |
| --- | --- |
| `src/main.js` | The world: camera, glowing floor, rain, focus effect, picking, panels, room links, add-your-room flow |
| `src/homeRoom.js` | Enhe’s hand-built room in the middle, and the text for each clickable thing in it |
| `src/recipe.js` | The room code format: checking a pasted code, building a room from it, and the prompt people copy |
| `src/decor.js` | The window, pictures on the walls and lamps a room code can ask for |
| `src/kit.js` | Ready-made models a room code can use, and the room shell |
| `src/kitList.js` | Kit names, the words each one stands for, and colours |
| `src/farView.js` | A room's far version: bakes a built room into small cacheable data, and turns that data back into meshes |
| `src/roomCache.js` | Keeps far versions in the visitor's browser (IndexedDB) so return visits skip building |
| `src/backend.js` | Talks to Supabase (live) or browser storage (demo) |
| `supabase/schema.sql` | The database tables, their safety rules, and how room links are made |
| `vercel.json` | Sends room links (`/mayas-studio`) to the site |
| `setup/keep-awake.yml` | Keeps the free Supabase project from pausing (see [SETUP.md](SETUP.md)) |

## What's next

Ideas for later are in [PLAN.md](PLAN.md): stacking the grid into floors of a building once it fills up, and a search that raises the rooms matching a skill, hobby or name.
