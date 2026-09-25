// Kit items people's rooms can use. Keep ids stable: saved rooms refer to them.
export const KIT = [
  { id: 'f1', label: 'F1 car', hint: 'racing, Formula 1, motorsport, cars, karting' },
  { id: 'badminton', label: 'Badminton', hint: 'badminton, rackets, shuttlecock' },
  { id: 'soccer', label: 'Soccer', hint: 'soccer, football, FIFA' },
  { id: 'basketball', label: 'Basketball', hint: 'basketball, NBA, hoops' },
  { id: 'climbing', label: 'Climbing wall', hint: 'bouldering, rock climbing' },
  { id: 'guitar', label: 'Guitar', hint: 'guitar, band, playing music' },
  { id: 'piano', label: 'Keyboard', hint: 'piano, keyboard, composing' },
  { id: 'dj', label: 'DJ decks', hint: 'DJing, producing, EDM, listening to music' },
  { id: 'books', label: 'Bookshelf', hint: 'reading, books, writing, studying' },
  { id: 'plant', label: 'Plants', hint: 'plants, gardening, nature' },
  { id: 'gaming', label: 'Gaming setup', hint: 'video games, esports, streaming' },
  { id: 'coding', label: 'Coding desk', hint: 'programming, software, startups, AI' },
  { id: 'robot', label: 'Robot', hint: 'robotics, LEGO, hardware, engineering' },
  { id: 'drone', label: 'Drone', hint: 'drones, flying, aerospace' },
  { id: 'camera', label: 'Camera', hint: 'photography, film, video, YouTube' },
  { id: 'art', label: 'Easel', hint: 'painting, drawing, design, art' },
  { id: 'space', label: 'Telescope', hint: 'space, astronomy, physics' },
  { id: 'bike', label: 'Bike', hint: 'cycling, biking' },
  { id: 'skate', label: 'Skateboard', hint: 'skateboarding, snowboarding, surfing' },
  { id: 'chess', label: 'Chess', hint: 'chess, board games, strategy' },
  { id: 'gym', label: 'Gym', hint: 'lifting, fitness, working out' },
  { id: 'coffee', label: 'Coffee bar', hint: 'coffee, cafes, cooking, baking' },
  { id: 'cat', label: 'Cat', hint: 'cats, pets, animals' }
];
export const KIT_IDS = KIT.map(k => k.id);
export const KIT_BY_ID = Object.fromEntries(KIT.map(k => [k.id, k]));
export const COLORS = ['#E8402F', '#FF8A4C', '#F2C14E', '#3DDC84', '#2CC4B3', '#3FA7FF', '#9B6BFF', '#FF4FA3'];
export const GRID_R = 4; // plots run from -4 to 4 on each axis (9 x 9); 0,0 is the home room
export const MAX_ITEMS = 8;

const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

// Clean a room before it is saved or drawn. Everything here is other people's input.
export function cleanRoom(r) {
  const items = Array.isArray(r.items) ? [...new Set(r.items.filter(i => KIT_IDS.includes(i)))].slice(0, MAX_ITEMS) : [];
  const color = /^#[0-9a-fA-F]{6}$/.test(r.color || '') ? r.color : COLORS[4];
  let link = clip(r.link, 200);
  if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
  if (link) { try { const u = new URL(link); if (!/^https?:$/.test(u.protocol)) link = ''; } catch { link = ''; } }
  const px = Math.max(-GRID_R, Math.min(GRID_R, Math.round(Number(r.px) || 0)));
  const pz = Math.max(-GRID_R, Math.min(GRID_R, Math.round(Number(r.pz) || 0)));
  return { ...r, px, pz, title: clip(r.title, 40) || 'New room', bio: clip(r.bio, 200), color, items, link: link || null };
}
