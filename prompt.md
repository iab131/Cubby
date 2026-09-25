Build me a 3D room for Cubby.

Cubby is a 3D grid of little rooms where every room shows who someone is: their projects and their interests. I want my own room. Please design it and give me a "room code" I can paste into Cubby.

STEP 1. Learn about me.
- If you can see my files or project folders, look through them (READMEs, code, docs, notes) to find my real projects, what they do, and what I'm into.
- If you can't see my files, ask me up to 5 short questions first (what I build, what I study or work on, my hobbies, my favorite things). Wait for my answers.

STEP 2. Choose 5 to 8 objects for my room.
- Mix my projects (type "project") and my interests or hobbies (type "interest").
- Each object gets a short, friendly description ("about"), written about me in the third person, max 2 sentences. Keep it simple enough for a kid to understand.

STEP 3. Build each object from simple shapes, like digital LEGO.
Room layout (1 unit is about half a meter):
- Floor is y = 0. Walls are 6.5 high.
- x goes from -5 (left wall) to 5 (right side, open).
- z goes from -5 (back wall) to 5 (front, open, where the viewer stands).
- Put each object on the floor with "at": [x, z]. Keep x and z between -4.5 and 4.5, and keep objects about 2.5 units apart so they don't overlap.
- Each object is made of "parts". A part's "pos" is relative to the object's "at" spot (y is height above the floor). Keep pos x and z between -1.5 and 1.5.
- Shapes: "box", "ball", "cylinder", "cone", "ring" (a donut standing up, like a wheel), "sign" (a small label with "text").
- "size" is [width, height, depth] of the shape. "rot" is rotation in degrees [x, y, z]. "color" is a hex color.
- Optional on a part: "glow": true (it lights up), "shiny": true (metal or plastic look).
- Use 5 to 40 parts per object. Make it recognizable: a guitar needs a body, neck and head; a robot needs a body, wheels and a sensor.
- Instead of parts, an object can use a ready-made model with "kit": one of f1, badminton, soccer, basketball, climbing, guitar, piano, dj, books, plant, gaming, coding, robot, drone, camera, art, space, bike, skate, chess, gym, coffee, cat.

STEP 4. Make it feel like a real room: a window, pictures on the walls, and lighting. Always include all three, in "decor".
- Window (required): "window": { "wall": "back" or "left", "at": spot along that wall from -3 to 3, "view": one of city, sunset, forest, ocean, mountains, snow, space }. Pick a view that fits me (where I live, a place I love, or my vibe).
- Pictures (2 to 4): each is { "wall": "back" or "left", "at": spot along the wall from -4 to 4, "y": height of its center from 1.6 to 4.4, "size": [width, height] from 0.5 to 2, "style", "title", "colors" }.
  - "style": photo (a snapshot with a handwritten caption), poster (big bold title), abstract, mountains, sunset, portrait, or stripes.
  - "title": a short caption (max 24 characters) that means something to me: a trip, a team, an event, a favorite band or game.
  - "colors": up to 3 hex colors for the art.
  - Spread them out along the walls. Leave the middle top of the back wall free (my room's name sign is there), and keep them away from the window.
- Lighting (required): "lights": { "mood", "lamps" }.
  - "mood": warm (cozy), cool (calm), day (bright), night (dark and moody), or neon (gamer, dark with colored glow).
  - "lamps" (2 to 4): each is { "kind", "color" } plus a spot.
    - floor (standing lamp), table (lamp on a small side table) or pendant (hangs from the ceiling) need "at": [x, z] on the floor. Put floor and table lamps in empty corners, not on top of objects.
    - string (fairy lights) or strip (LED strip) need "wall": "back" or "left" instead.
  - Use warm yellow like #FFD39A for cozy light, or bright colors for neon. Match the lighting to my personality.

STEP 5. Keep it safe and public.
- The room is public. Do not include grades, school marks, addresses, phone numbers, emails, private details, or anything I haven't said is OK to share.
- Links are optional and must be public pages (my GitHub, website, a project demo).

STEP 6. Reply with the room code: one JSON code block in exactly this shape.

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
      "at": [2, 2],
      "turn": 30,
      "parts": [
        { "shape": "box", "size": [1.2, 0.3, 2.2], "pos": [0, 0.45, 0], "rot": [0, 0, 0], "color": "#3FA7FF" },
        { "shape": "box", "size": [1.3, 0.05, 1.4], "pos": [0, 0.65, 0], "rot": [0, 0, 0], "color": "#1B2A4A", "shiny": true },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [0.65, 0.25, 0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [-0.65, 0.25, 0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [0.65, 0.25, -0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "ring", "size": [0.5, 0.5, 0.2], "pos": [-0.65, 0.25, -0.7], "rot": [0, 90, 0], "color": "#222222" },
        { "shape": "sign", "text": "SUN-1", "size": [0.8, 0.2, 0.01], "pos": [0, 1.1, 0], "rot": [0, 0, 0], "color": "#F2C14E" }
      ]
    },
    { "name": "Painting", "type": "interest", "about": "Maya paints landscapes every weekend.", "kit": "art" }
  ],
  "decor": {
    "window": { "wall": "left", "at": -1.5, "view": "ocean" },
    "pictures": [
      { "wall": "back", "at": -3, "y": 3.2, "size": [1.4, 1.1], "style": "photo", "title": "Team race day", "colors": ["#3FA7FF", "#F2C14E", "#8FD3FF"] },
      { "wall": "back", "at": 3, "y": 3.4, "size": [1.2, 1.6], "style": "poster", "title": "Solar Challenge", "colors": ["#1B2A4A", "#F2C14E", "#FF4FA3"] },
      { "wall": "left", "at": 2.8, "y": 3.4, "size": [1, 1.2], "style": "mountains", "title": "Banff", "colors": ["#3DDC84", "#2CC4B3", "#FFE7B8"] }
    ],
    "lights": {
      "mood": "warm",
      "lamps": [
        { "kind": "pendant", "at": [0.5, 1], "color": "#FFD39A" },
        { "kind": "floor", "at": [-4, -4], "color": "#FFD39A" },
        { "kind": "string", "wall": "back", "color": "#FFD39A" }
      ]
    }
  }
}

Rules for the code: at most 10 objects, 60 parts per object, 400 parts total, 5 pictures, 5 lamps. Titles up to 40 characters, bio up to 200. Pick "color" from: #E8402F, #FF8A4C, #F2C14E, #3DDC84, #2CC4B3, #3FA7FF, #9B6BFF, #FF4FA3.

After the code block, tell me in one line: "Copy this code, open Cubby, click Add your room, paste it, then click Add my room."