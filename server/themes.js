const fs = require('fs');
const path = require('path');

const THEMES_DIR = path.join(__dirname, '..', 'themes');

let themes = [];
let themesById = new Map();

function loadThemes() {
  themes = [];
  themesById = new Map();
  const files = fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(THEMES_DIR, file), 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error(`[themes] failed to parse ${file}:`, err.message);
      continue;
    }
    if (!data.id || !data.name || !Array.isArray(data.pairs) || data.pairs.length === 0) {
      console.error(`[themes] ${file} is missing id/name/pairs`);
      continue;
    }
    themes.push(data);
    themesById.set(data.id, data);
  }
  themes.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[themes] loaded ${themes.length}: ${themes.map((t) => t.name).join(', ')}`);
}

function list() {
  return themes.map((t) => ({ id: t.id, name: t.name, pairCount: t.pairs.length }));
}

function getById(id) {
  return themesById.get(id) || null;
}

function pickPair(themeId, usedIndices = new Set()) {
  const theme = themesById.get(themeId);
  if (!theme) return null;
  const available = theme.pairs
    .map((_, i) => i)
    .filter((i) => !usedIndices.has(i));
  const pool = available.length > 0 ? available : theme.pairs.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  const pair = theme.pairs[idx];
  const [w1, w2] = Array.isArray(pair) ? pair : [pair.civilian, pair.undercover];
  const flip = Math.random() < 0.5;
  return {
    index: idx,
    civilian: flip ? w2 : w1,
    undercover: flip ? w1 : w2,
  };
}

loadThemes();

module.exports = { list, getById, pickPair, loadThemes };
