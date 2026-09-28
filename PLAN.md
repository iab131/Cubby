# Plan

Ideas for later, and when they're worth doing.

## Floors: stack grids into a building

**When:** not yet (7 rooms on 2026-09-28). Worth doing once the grid is too big to take in, around 100 to 150 rooms (an 11 x 11 grid), or once first visits start loading slowly.

**Why:** the grid grows one ring at a time and can reach 121 x 121 squares. A few rings out, it gets hard to find anyone. Every visit also loads every room and makes its far version before the grid shows: about 15 ms a room on a first visit, with an 8 second cap before the rest load in the background. Floors keep each view small, and only the floors near you need loading.

**Decided:**
- **Every floor is 9 x 9.** That's 81 squares, or 80 on the ground floor, where Enhe's room sits in the middle like a lobby. Every room that exists today stays on the ground floor.
- **People choose their floor.** When adding a room, you pick a floor, then a square on it, the same way you pick a square today. Once the top floor is full, a new empty floor opens above it, so there's always somewhere to go.
- **The floor you're on is in the middle, and the floors above and below fade out in a straight line.** The closest floors are almost fully there, each floor further away is dimmer, and past a few floors they're gone. For example, with 3 floors of reach: 1 floor away is 2/3 bright, 2 away is 1/3, and 3 or more away isn't drawn at all. On the ground floor, only the floors above show.

**How it could work:**
- Fading: rooms already fade to black when you open one (the dim in `main.js`), so floors can use that same dim, set by how far the floor is from yours. That avoids see-through rooms, which are slow to draw and look muddy when stacked. Each floor's glowing grid fades the same way.
- Drawing: floors that have faded out aren't drawn, like rooms lost in the fog today, so a tall building costs no more than the few floors you can see.
- Loading: fetch the rooms on floors within reach (plus the room a link points to), not every room at once. Their far versions are cached in the browser like today.
- Moving: floor buttons (like an elevator) move you up and down, and the fade slides along as the camera rises or drops. The dock lists the rooms on your floor, with a search for rooms on other floors.
- Links: room links don't change. They already don't depend on where a room sits, so `/mayas-studio` keeps working when floors arrive, and opening one takes you to that room's floor.
- Database: a `floor` column (0 for every room today), one room per square per floor, and a check that a new room goes on a floor that exists (or on the new top one).

**Still to decide:** how many floors the fade reaches (start with 3 and see how it looks); how much space goes between floors; whether the camera can look at the whole building from outside or always sits at one floor.
