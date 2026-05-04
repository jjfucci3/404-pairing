import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the project directory regardless of cwd
const _require = createRequire(import.meta.url);
const dotenv = _require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import basicAuth from 'express-basic-auth';

const app = express();
const PORT = process.env.PORT || 3002;
const RELATIONSHIPS_FILE = process.env.RELATIONSHIPS_FILE || path.join(__dirname, 'relationships.json');

const client = new Anthropic();

// In-memory profile cache
let profilesCache = [];

app.use(cors());
app.use(express.json());

if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS) {
  app.use(basicAuth({
    users: { [process.env.BASIC_AUTH_USER]: process.env.BASIC_AUTH_PASS },
    challenge: true,
  }));
}

app.use(express.static(path.join(__dirname, 'dist')));

// --- Helpers ---

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth)) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// Column mapping (0-indexed, matches Google Form export order):
// 0:Timestamp 1:FirstName 2:LastName 3:Phone 4:Instagram 5:DOB
// 6:Sex 7:Sexuality 8:RelStatus 9:City 10:From 11:Ethnicity
// 12:CulturalPref 13:Industry 14:Does 15:Excited
// 16:ShortGoals 17:LongGoals 18:Hidden 19:Seriousness 20:Openness
// 21:Energy 22:LookingFor 23:IdealPerson 24:Space 25:Availability
// 26:OppositeSexComfort 27:SameSexComfort 28:AgeGapComfort
// 29:Dealbreakers 30:ContactPref 31:ReferredBy 32:Agreement
function parseRow(cols) {
  const firstName = cols[1]?.trim() || '';
  const lastName = cols[2]?.trim() || '';
  const name = `${firstName} ${lastName}`.trim();
  if (!name) return null;

  const lookingForRaw = cols[22]?.trim() || '';
  const lookingFor = lookingForRaw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    name,
    instagram: (cols[4]?.trim() || '').replace('@', ''),
    phone: cols[3]?.trim() || '',
    age: calcAge(cols[5]?.trim()),
    sex: cols[6]?.trim() || '',
    sexuality: cols[7]?.trim() || '',
    relationshipStatus: cols[8]?.trim() || '',
    city: cols[9]?.trim() || '',
    from: cols[10]?.trim() || '',
    industries: cols[13]?.trim() || '',
    does: cols[14]?.trim() || '',
    excited: cols[15]?.trim() || '',
    shortGoals: cols[16]?.trim() || '',
    longGoals: cols[17]?.trim() || '',
    hidden: cols[18]?.trim() || '',
    seriousness: parseInt(cols[19]) || null,
    openness: parseInt(cols[20]) || null,
    energy: cols[21]?.trim() || '',
    lookingFor,
    idealPerson: cols[23]?.trim() || '',
    space: cols[24]?.trim() || '',
    availability: cols[25]?.trim() || '',
    oppositeSexComfort: parseInt(cols[26]) || null,
    sameSexComfort: parseInt(cols[27]) || null,
    ageGapComfort: parseInt(cols[28]) || null,
    dealbreakers: cols[29]?.trim() || '',
  };
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') {
        row.push(field); field = '';
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
      } else if (ch !== '\r') { field += ch; }
    }
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

const SHEET_ID = '1_sm-krnTzxukUaABf5P3ArBLYbiJ1PSmkonLctfegJA';

async function fetchProfilesFromSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} — is the sheet set to "anyone with the link can view"?`);
  const text = await res.text();
  const rows = parseCSV(text);
  return rows
    .slice(1) // skip header row
    .filter(r => r[1])
    .map(parseRow)
    .filter(Boolean);
}

// Fallback hardcoded profiles used when Sheet credentials aren't configured yet
const FALLBACK_PROFILES = [
  {"name":"Jake Fucci","instagram":"jake.fucci","phone":"9546146641","age":22,"sex":"M","sexuality":"Straight","relationshipStatus":"Taken","city":"NYC","from":"Fort Lauderdale, FL","industries":"Arts & Design, Entrepreneurship","does":"Independent music artist and entrepreneur building 404","excited":"People, building systems, music, deep intellectual discussion","longGoals":"Marry girlfriend, financial independence, impact on world","hidden":"Loves Pokemon, colorblind, bipolar","seriousness":3,"openness":5,"energy":"Ball of lightning. Best in flow state.","lookingFor":["friend","collaborator"],"idealPerson":"World-changer who lights his fire while keeping him grounded","space":"A lot","availability":"Both","dealbreakers":"None"},
  {"name":"Jackson Wells","instagram":"l.jackson.16","phone":"9728974137","age":20,"sex":"M","sexuality":"All","relationshipStatus":"Taken","city":"NYC","from":"Dallas, TX","industries":"Film & Media, Music Journalism","does":"College student in content creation, news reporting and music journalism","excited":"Meeting cool people, new unique experiences","longGoals":"Leave the world better, never compromise integrity","hidden":"Loves ARGs, analog horror, deciphering codes","seriousness":2,"openness":3,"energy":"Adaptable, independent, positive, constant","lookingFor":["friend","collaborator"],"idealPerson":"Whoever is destined to be in his circle","space":"Some","availability":"Both","dealbreakers":"Hatred — racism, homophobia"},
  {"name":"Nicky Lombardo","instagram":"nicky.lom","phone":"7543048671","age":18,"sex":"M","sexuality":"Straight","relationshipStatus":"Taken","city":"NYC","from":"Pompano Beach, FL","industries":"Film & Media, Baseball","does":"Baseball player and filmmaker","excited":"Music, people, art","longGoals":"Make it big in baseball, make music, make a film","hidden":"Has a really cute funny dog","seriousness":4,"openness":3,"energy":"","lookingFor":["friend"],"idealPerson":"","space":"Some","availability":"Weekends only","dealbreakers":"Significant age gap"},
  {"name":"Hideo Lathan","instagram":"h_jj_l","phone":"6263163317","age":19,"sex":"M","sexuality":"Straight","relationshipStatus":"Taken","city":"NYC","from":"Pasadena, CA","industries":"Arts & Design, Fashion, Acting","does":"Actor, learning to sew, designs through sketching","excited":"Testing self by learning new crafts — anything is possible if you break out","longGoals":"Live comfortably, figure out how","hidden":"Massive Star Wars nerd, low-key knows ball, minimal online presence","seriousness":3,"openness":4,"energy":"","lookingFor":["collaborator"],"idealPerson":"","space":"Some","availability":"Both","dealbreakers":"Large age gaps (context-dependent)"},
  {"name":"Daniel Pearson","instagram":"Daniel.k.Pearson","phone":"6193794974","age":25,"sex":"M","sexuality":"Straight","relationshipStatus":"Single","city":"NYC","from":"Israel","industries":"Music (Producer)","does":"Music producer","excited":"Music, people, community","longGoals":"Grammy, house in Jamaica, 6 dogs","hidden":"Shy","seriousness":3,"openness":5,"energy":"No filters, positive, very open minded","lookingFor":["friend","collaborator","romantic"],"idealPerson":"A woman","space":"Some","availability":"Weekdays","dealbreakers":"None"},
  {"name":"Shaul Levy","instagram":"5haul","phone":"3054408034","age":24,"sex":"M","sexuality":"Straight","relationshipStatus":"Single","city":"NYC","from":"NYC","industries":"Fashion (Brand Owner)","does":"Runs a fashion brand","excited":"People, experience, love, taste","longGoals":"Retire mom, split time NYC/Europe, inner peace, amazing friend group","hidden":"Everything about him","seriousness":3,"openness":2,"energy":"Calm but chaotic. Mood-dependent. Drifts because of work.","lookingFor":["romantic"],"idealPerson":"Similar goals, escape from day-to-day, passionate about life","space":"Some","availability":"Weekdays","dealbreakers":"Significant age gap, no interests"},
  {"name":"Alex Freedman","instagram":"alexfreedman","phone":"6312522712","age":23,"sex":"M","sexuality":"Straight","relationshipStatus":"Taken","city":"NYC","from":"Long Island","industries":"Education, Finance, Tech","does":"Makes AI education content. Starting sales job post-graduation.","excited":"New tech, building things, entrepreneurship, connecting with people","longGoals":"Start own company, financial independence, happy family","hidden":"Speaks Russian, loves cooking, plays guitar and piano","seriousness":4,"openness":4,"energy":"Very fast","lookingFor":["friend","collaborator"],"idealPerson":"Co-founder, friend, cool people","space":"Some","availability":"Weekends only","dealbreakers":"Anti-Semite"},
  {"name":"Leo Torres","instagram":"Ltxrrres","phone":"2013640596","age":21,"sex":"M","sexuality":"Straight","relationshipStatus":"It's complicated","city":"NJ","from":"NJ","industries":"Arts & Design, Film & Media, Music, Events","does":"Multi-faceted creative — music, media, arts, events","excited":"Money. Building something that lasts.","longGoals":"Multi-faceted creative brand. Platform to bring creatives together.","hidden":"Biggest fear is wasted potential by own hands","seriousness":4,"openness":3,"energy":"That Hispanic guy who looks like a drug dealer but isn't","lookingFor":["friend","collaborator"],"idealPerson":"Creative, humorous, good music taste, business-minded","space":"Some","availability":"Weekdays","dealbreakers":"Actually racist"},
  {"name":"Ronnie Torres","instagram":"ronnieitorres","phone":"9736923422","age":19,"sex":"M","sexuality":"N/A","relationshipStatus":"Single","city":"NYC","from":"New Jersey","industries":"Arts & Design, Fashion, Film & Media","does":"Fashion designer, artist","excited":"Constant improvement and development","longGoals":"Ultimate freedom — financial, creative, health, time, love","hidden":"Says everything vocally. Not afraid to stand out.","seriousness":3,"openness":3,"energy":"Speaks from heart without influence from society. Not afraid to stand out.","lookingFor":["friend","collaborator"],"idealPerson":"Anyone who knows more than them — always in student mode","space":"Not much, but will make room","availability":"Both","dealbreakers":"None"},
  {"name":"Isaiah Walsh","instagram":"Isaiahwalsh1","phone":"4243168321","age":20,"sex":"M","sexuality":"Straight","relationshipStatus":"Single","city":"NYC","from":"Los Angeles","industries":"Finance, Human Connection","does":"Thinks deeply, trades stocks, learns. 404 co-founder.","excited":"Opportunity to grow, laughter, connection, challenges","longGoals":"Start a business he believes in. Be kinder to himself.","hidden":"Wants to start making music","seriousness":3,"openness":4,"energy":"Empathetic","lookingFor":["friend","collaborator","romantic"],"idealPerson":"A mentor","space":"Some","availability":"Both","dealbreakers":"Rigid thinking"},
  {"name":"Arya Jhala","instagram":"aryajhala","phone":"6504304499","age":20,"sex":"M","sexuality":"Straight","relationshipStatus":"Single","city":"NYC","from":"California","industries":"Arts & Design (product, fine art, AV)","does":"Product designer, fine art, audio visual design. 404 contractor.","excited":"Nature, music, creating, humor, food, good people","longGoals":"Healthy, sober, learn music, have a home, partner, contribute to community","hidden":"Thinks too much. Believes networking is a plague. Connection through experiences over initial spark.","seriousness":3,"openness":2,"energy":"Sagely, bouncy, fluid","lookingFor":["friend","collaborator"],"idealPerson":"Someone who gushes about what they love. Curious. Good vocabulary. Humor is the X factor.","space":"Some","availability":"Both","dealbreakers":"Egotistical"},
  {"name":"Zach Kyle","instagram":"zachkyle","phone":"2016796778","age":20,"sex":"M","sexuality":"Straight","relationshipStatus":"Single","city":"NYC","from":"Tenafly, NJ","industries":"Arts & Design, Fashion, Film & Media, Music","does":"Rapper","excited":"New experiences, growth, free slate every day","longGoals":"Record label, shoot first feature film, find love","hidden":"Very easy going and nice — Instagram makes him look like an asshole but he's working on it","seriousness":3,"openness":4,"energy":"Young, wild, free","lookingFor":["friend","collaborator","romantic"],"idealPerson":"People who chill and take it easy","space":"A lot","availability":"Both","dealbreakers":"Boring — won't force conversation"},
  {"name":"Brooke Marsico","instagram":"Brooke.jpg","phone":"3129613680","age":20,"sex":"F","sexuality":"Straight","relationshipStatus":"Taken","city":"NYC","from":"Chicago","industries":"Arts & Design, Film & Media","does":"Designer and painter","excited":"Travel, friends, family, animals, art, movies","longGoals":"Get a job, have cats, travel","hidden":"Close with family. Had bunnies. Likes food. Pretty shy.","seriousness":4,"openness":1,"energy":"Shy, sarcastic, a little stupid (self-described)","lookingFor":["friend","collaborator"],"idealPerson":"Literally anyone nice","space":"Some","availability":"Weekends only","dealbreakers":"None"}
];

function readRelationships() {
  if (!fs.existsSync(RELATIONSHIPS_FILE)) {
    return { knownPairs: [], notes: {} };
  }
  return JSON.parse(fs.readFileSync(RELATIONSHIPS_FILE, 'utf8'));
}

function writeRelationships(data) {
  fs.writeFileSync(RELATIONSHIPS_FILE, JSON.stringify(data, null, 2));
}

function pairKey(a, b) {
  return [a, b].sort().join('|||');
}

function isKnown(relationships, a, b) {
  const key = pairKey(a, b);
  return relationships.knownPairs.some(pair => pairKey(pair[0], pair[1]) === key);
}

// --- Routes ---

app.get('/api/profiles', (_req, res) => {
  res.json(profilesCache);
});

app.get('/api/reload', async (_req, res) => {
  try {
    profilesCache = await fetchProfilesFromSheet();
    res.json({ count: profilesCache.length, profiles: profilesCache });
  } catch (err) {
    console.error('Reload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/relationships', (_req, res) => {
  res.json(readRelationships());
});

app.post('/api/relationships', (req, res) => {
  const { personA, personB } = req.body;
  if (!personA || !personB) return res.status(400).json({ error: 'personA and personB required' });

  const data = readRelationships();
  if (!isKnown(data, personA, personB)) {
    data.knownPairs.push([personA, personB]);
    writeRelationships(data);
  }
  res.json(data);
});

app.delete('/api/relationships', (req, res) => {
  const { personA, personB } = req.body;
  if (!personA || !personB) return res.status(400).json({ error: 'personA and personB required' });

  const data = readRelationships();
  const key = pairKey(personA, personB);
  data.knownPairs = data.knownPairs.filter(pair => pairKey(pair[0], pair[1]) !== key);
  writeRelationships(data);
  res.json(data);
});

app.post('/api/notes', (req, res) => {
  const { name, note } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const data = readRelationships();
  if (note === '' || note == null) {
    delete data.notes[name];
  } else {
    data.notes[name] = note;
  }
  writeRelationships(data);
  res.json(data);
});

const SYSTEM_PROMPT = `You are the pairing engine for 404, a human connection service. Pair people with intention and genuine reasoning — not algorithmically.

Given a target person and available profiles, return 3-5 ranked pairings.

HARD FILTERS — never suggest:
1. Anyone in the excluded list (they already know each other)
2. Direct dealbreaker conflicts in either direction (e.g. A's dealbreaker is "egotistical" and B reads that way; age gap dealbreaker where the actual gap is 5+ years)

Everything else is reasoning material, not a filter. Pool is small — lean toward inclusion. Flag concerns in output.

SCALE INTERPRETATION — read these scores correctly:
- seriousness: 1 = "Not at all — life's funny", 5 = "Very — I'm intentional about everything"
- openness: 1 = "I have to really know them", 5 = "Immediately"
- oppositeSexComfort: 1 = "Not interested at all", 5 = "Very open to it"
- sameSexComfort: 1 = "Not interested at all", 5 = "Very open to it"
- ageGapComfort: 1 = "Not interested at all", 5 = "Very open to it"
Higher always means more of that quality.

PRIORITIES:
1. Intent alignment — romantic only if both are open to it
2. Energy and openness fit — enough surface area to actually connect?
3. Values and goals resonance
4. Industry: overlap = collaboration potential, adjacent = new perspective
5. Availability overlap

Return ONLY a valid JSON array. No markdown, no preamble.
[{"rank":1,"name":"Full Name","type":"friend | collaborator | romantic | friend + collaborator","reasoning":"2-3 sentences referencing both people's actual profile details.","flag":"optional concern, omit key entirely if none"}]`;

app.post('/api/pair', async (req, res) => {
  const { personName, context, notes } = req.body;

  // Re-fetch on every pairing run to catch new survey responses
  try {
    profilesCache = await fetchProfilesFromSheet();
  } catch (err) {
    console.warn('Could not refresh profiles from Sheet:', err.message, '— using cached data');
  }

  const relationships = readRelationships();
  const target = profilesCache.find(p => p.name === personName);
  if (!target) {
    return res.status(404).json({ error: `Profile not found: ${personName}` });
  }

  const excluded = relationships.knownPairs
    .filter(pair => pair[0] === personName || pair[1] === personName)
    .map(pair => pair[0] === personName ? pair[1] : pair[0]);

  // Jake knows everyone — always exclude him from the pool
  const pool = profilesCache.filter(p =>
    p.name !== personName &&
    p.name !== 'Jake Fucci' &&
    !excluded.includes(p.name)
  );

  if (pool.length === 0) {
    return res.status(400).json({ error: 'No available pairings — everyone is already known.' });
  }

  const excludedNames = excluded.length ? excluded.join(', ') : 'None';
  const userMessage = `Target person:
${JSON.stringify(target, null, 2)}

Excluded (already know each other): ${excludedNames}
Operator notes on this person: ${notes || 'None'}
Additional context: ${context || 'None'}

Available pool:
${JSON.stringify(pool, null, 2)}

Return 3-5 ranked pairings.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    const pairings = JSON.parse(text);
    res.json({ pairings });
  } catch (err) {
    console.error('Pairing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// --- Start ---

async function start() {
  try {
    profilesCache = await fetchProfilesFromSheet();
    console.log(`Loaded ${profilesCache.length} profiles from Google Sheet`);
  } catch (err) {
    console.warn('Google Sheet not configured — using hardcoded fallback profiles');
    console.warn('Set GOOGLE_SERVICE_ACCOUNT_KEY and SHEET_ID in .env to use live data');
    profilesCache = FALLBACK_PROFILES;
  }

  app.listen(PORT, () => {
    console.log(`404 pairing engine → http://localhost:${PORT}`);
  });
}

start();
