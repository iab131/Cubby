Build me a 3D room for Cubby.

Cubby is a 3D grid of little rooms where every room shows who someone is: their projects and their interests. I want my own room. Please design it like a set designer, and give me a "room code" I can paste into Cubby.

STEP 1. Learn about me.
- If you can see my files or project folders, look through them (READMEs, code, docs, notes) to find my real projects, what they do, and what I'm into.
- If you can't see my files, ask me up to 5 short questions first, then wait for my answers:
  1. What do you build, study or work on?
  2. What are your hobbies and favorite things?
  3. A place you love (a city, a trip, nature)?
  4. A moment you're proud of (a team, an event, a win)?
  5. Your vibe: cozy, calm, bright, moody or neon? Favorite color?

STEP 2. Plan the story.
- Pick 5 to 8 objects: my projects (type "project"), my interests (type "interest"), and 1 fun personal touch (type "about"), like a pet, a trophy, or a favorite snack.
- Pick one "hero" object: the thing I'm most known for. Give it the most detail.
- Each object gets a short, friendly "about": written about me in the third person, max 2 sentences, simple enough for a kid to understand, and specific (a real detail beats a general one).

STEP 3. Place things with this floor plan.
The camera looks in from the front-right corner, so tall things go at the back and left, and short things go in front.
- Floor is y = 0. Walls are 6.5 high. 1 unit is about half a meter.
- x goes from -5 (left wall) to 5 (open side). z goes from -5 (back wall) to 5 (front, where the viewer stands).
- Put each object on the floor with "at": [x, z], using these spots:
  - Back row, for tall things (desks, shelves, screens, machines): [-3.3, -3.5], [0, -3.5], [3.3, -3.5]
  - Middle, for the hero and medium things: [-3.5, 0], [0, 0], [3.5, 0]
  - Front, for low or small things only: [-2.5, 3.3], [1.5, 3.3]
  - Keep the front-right corner [3.5, 3.5] empty or very low, or it blocks the view.
- Keep objects at least 2.5 units apart. "turn" (degrees) angles an object: turn back-row and side objects 15 to 30 degrees toward the middle so they face the viewer.

STEP 4. Build each object from simple shapes, like digital LEGO.
- A part's "pos" is relative to the object's "at" spot (y is height above the floor). Keep pos x and z between -1.5 and 1.5.
- Shapes: "box", "ball", "cylinder", "cone", "ring", "sign" (a small label with "text").
  - "size" is [width, height, depth]. "rot" is rotation in degrees [x, y, z]. "color" is a hex color.
  - A cylinder stands up. rot [90,0,0] lays it along z, rot [0,0,90] lays it along x.
  - A ring stands up facing you, like a wheel seen from the side. rot [0,90,0] turns it sideways. rot [90,0,0] lays it flat.
  - A cone points up. rot [180,0,0] points it down.
- Optional on a part: "glow": true (lights up) and "shiny": true (metal, glass or plastic).
- Motion (optional) makes the room feel alive:
  - On an object: "motion": one of breathe (slow breathing, great for pets and plushies), hop (little hops), bob (floats up and down), sway (rocks side to side), spin (turns slowly, like a turntable).
  - On a part: "move": one of spin (wheels, fans, records), wag (tails, flags, antennas), bob (something floating, like a balloon or a bubble).
  - Use motion on 1 to 3 objects and a few parts, so the room stays calm.
- Real-life sizes, so things look right together: table or desk top 1.5 high, chair seat 0.9, laptop 0.7 wide, monitor 1.1 x 0.7, bookshelf 3 tall, person 3.4 tall, door 4 tall.
- Make each object recognizable and rich:
  - Hero object: 25 to 45 parts. Other objects: 10 to 30 parts.
  - Build in layers: a base or stand, the main body, then details (buttons, screens, handles, cables, wheels).
  - Add 1 to 3 small "glow" accents per object (a screen, an LED, a light). Not more, or it looks messy.
  - Use "shiny" for metal, screens and plastic.
  - Add one short "sign" label to most objects (max 12 characters), like a brand name or a team name.
  - Use 3 to 5 colors that go together, built around my room color. Avoid big pure black or pure white blocks. Dark gray (#2B2F3A) and off-white (#EDEFF3) look better.
- Ready-made models: an object can use "kit": one of f1, badminton, soccer, basketball, climbing, guitar, piano, dj, books, plant, gaming, coding, robot, drone, camera, art, space, bike, skate, chess, gym, coffee, cat.
  - Best trick: use a kit AND add a few parts to make it mine, like a robot kit plus a sign with my team number.
  - Use kits for at most half the objects. Hand-built objects make the room feel personal.

STEP 5. Make it feel like a real room: a window, pictures and lighting. All three are required. Never set "decor" to null.
- Window: "window": { "wall", "at", "view" }.
  - The left wall is usually best, because the back wall is behind the tall things. Use "at" from -3 to 3.
  - "view": one of city, sunset, forest, ocean, mountains, snow, space. Pick a place I love or my vibe.
- Pictures (3 or 4): each is { "wall", "at", "y", "size", "style", "title", "colors" }.
  - Back wall pictures go ABOVE the back-row objects: "y" from 4.0 to 4.4, and "size" height up to 1.1. Use "at" -3.3, 0 and 3.3.
  - Left wall pictures: "y" from 3.2 to 3.8, with "at" away from the window.
  - "size": [width, height], from 0.6 to 1.6.
  - "style": photo (snapshot with a handwritten caption), poster (big bold title), abstract, mountains, sunset, portrait, or stripes. Mix at least 2 styles.
  - "title": a short caption (max 24 characters) with a real story: a trip, a team, an event, a favorite band or game. "Tokyo 2025" beats "Travel".
  - "colors": up to 3 hex colors.
- Lighting: "lights": { "mood", "lamps" }.
  - "mood": warm (cozy), cool (calm), day (bright), night (dark and moody), or neon (gamer, dark with colored glow).
  - "lamps" (2 to 4). Great combos:
    - Cozy: warm mood + a pendant over the middle + fairy lights ("string") + a floor lamp.
    - Techy or night owl: night mood + an LED "strip" in my color on the back wall + a warm pendant.
    - Gamer: neon mood + 2 strips in two bright colors (back and left walls).
  - Placing lamps:
    - floor, table and pendant lamps need "at": [x, z]. A pendant hangs from the ceiling, so it can go over the middle, like [0, 1.2]. Put floor and table lamps only in an empty spot next to a wall, like [-4.3, 2.3]. Never put a lamp in the middle of the floor.
    - string (fairy lights) and strip (LED strip) need "wall": "back" or "left".
  - Colors: warm yellow #FFD39A for cozy light, or bright colors for neon and strips.

STEP 6. Keep it safe and public.
- The room is public. Do not include grades, school marks, addresses, phone numbers, emails, private details, or anything I haven't said is OK to share.
- Links are optional and must be public pages (my GitHub, website, a project demo).

STEP 7. Check your work before you reply.
- Every object is at a floor plan spot, at least 2.5 apart, and the front-right corner is clear.
- The hero object has the most detail, and every object is easy to recognize.
- "decor" has a window, 3 to 4 pictures, a mood and 2 to 4 lamps. No lamp sits on an object.
- Limits: at most 10 objects, 60 parts per object, 400 parts total, 5 pictures, 5 lamps. Title up to 40 characters, bio up to 200.
- "color" is one of: #E8402F, #FF8A4C, #F2C14E, #3DDC84, #2CC4B3, #3FA7FF, #9B6BFF, #FF4FA3.
- The code is valid JSON: no comments, no trailing commas, no null values.

STEP 8. Reply with the room code: one JSON code block in exactly this shape.

{
  "v": 1,
  "title": "Maya's Studio",
  "bio": "Maya builds solar cars and paints on weekends.",
  "color": "#FF4FA3",
  "links": [{ "label": "GitHub", "url": "https://github.com/maya" }],
  "objects": [
    {
      "name": "Solar car",
      "type": "project",
      "about": "A small car that drives on sunlight. Maya built it with her robotics team.",
      "link": "https://github.com/maya/solar-car",
      "at": [0, 0],
      "turn": 30,
      "parts": [
        { "shape": "box", "size": [1.2, 0.3, 2.2], "pos": [0, 0.45, 0], "rot": [0, 0, 0], "color": "#3FA7FF" },
        { "shape": "box", "size": [1.3, 0.05, 1.4], "pos": [0, 0.65, 0], "rot": [0, 0, 0], "color": "#1B2A4A", "shiny": true },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [0.65, 0.25, 0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [-0.65, 0.25, 0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [0.65, 0.25, -0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [-0.65, 0.25, -0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "box", "size": [0.3, 0.06, 0.06], "pos": [0, 0.5, 1.12], "rot": [0, 0, 0], "color": "#F2C14E", "glow": true },
        { "shape": "sign", "text": "SUN-1", "size": [0.8, 0.2, 0.01], "pos": [0, 1.1, 0], "rot": [0, 0, 0], "color": "#F2C14E" }
      ]
    },
    {
      "name": "Painting",
      "type": "interest",
      "about": "Maya paints the ocean every weekend.",
      "at": [-3.5, 0],
      "turn": 25,
      "kit": "art",
      "parts": [
        { "shape": "sign", "text": "WEEKENDS", "size": [0.9, 0.22, 0.01], "pos": [0, 2.9, 0.1], "rot": [0, 0, 0], "color": "#FF4FA3" }
      ]
    },
    {
      "name": "Mochi the cat",
      "type": "about",
      "about": "Mochi naps on every warm laptop in the house.",
      "at": [1.5, 3.3],
      "turn": -20,
      "kit": "cat"
    }
  ],
  "decor": {
    "window": { "wall": "left", "at": -2, "view": "ocean" },
    "pictures": [
      { "wall": "back", "at": -3.3, "y": 4.2, "size": [1.3, 1], "style": "photo", "title": "Team race day", "colors": ["#3FA7FF", "#F2C14E", "#8FD3FF"] },
      { "wall": "back", "at": 3.3, "y": 4.1, "size": [1, 1.1], "style": "poster", "title": "Solar Challenge", "colors": ["#1B2A4A", "#F2C14E", "#FF4FA3"] },
      { "wall": "left", "at": 2.8, "y": 3.5, "size": [1, 1.2], "style": "mountains", "title": "Banff", "colors": ["#3DDC84", "#2CC4B3", "#FFE7B8"] }
    ],
    "lights": {
      "mood": "warm",
      "lamps": [
        { "kind": "pendant", "at": [0, 1.2], "color": "#FFD39A" },
        { "kind": "floor", "at": [-4.3, 2.3], "color": "#FFD39A" },
        { "kind": "string", "wall": "back", "color": "#FFD39A" }
      ]
    }
  }
}

After the code block, tell me in one line: "Copy this code, open Cubby, click Add your room, paste it, then click Add my room."
