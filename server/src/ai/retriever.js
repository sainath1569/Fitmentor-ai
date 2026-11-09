import { exercises } from '../knowledge/exercises.js';
import { foods } from '../knowledge/foods.js';
import { guides } from '../knowledge/guides.js';

// Retrieval for RAG: BM25 ranking over the app's own knowledge base. The corpus is
// small and full of exact Indian food terms (pesarattu, pappu), which keyword
// ranking handles well, and it needs no embedding service or vector store.
const STOP = new Set('a an and are as at be but by can do does for from how i in is it me my of on or should so that the this to was what when which will with you your'.split(' '));

export const tokenize = (text) =>
  String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));

function buildIndex(docs) {
  const df = new Map();
  const indexed = docs.map((doc) => {
    const tokens = tokenize(doc.text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return { doc, tf, length: tokens.length };
  });
  const avgLength = indexed.reduce((sum, d) => sum + d.length, 0) / indexed.length;
  return { indexed, df, avgLength, size: docs.length };
}

function bm25(index, query, limit, k1 = 1.4, b = 0.75) {
  const terms = [...new Set(tokenize(query))];
  return index.indexed
    .map(({ doc, tf, length }) => {
      let score = 0;
      for (const term of terms) {
        const freq = tf.get(term);
        if (!freq) continue;
        const n = index.df.get(term);
        const idf = Math.log(1 + (index.size - n + 0.5) / (n + 0.5));
        score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + (b * length) / index.avgLength)));
      }
      return { doc, score };
    })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

const corpus = buildIndex([
  ...guides.map((g) => ({ kind: 'guide', id: g.id, title: g.title, text: `${g.title} ${g.title} ${g.text}`, body: g.text })),
  ...foods.map((x) => ({
    kind: 'food', id: x.id, title: x.name,
    text: `${x.name} ${x.aliases.join(' ')}`,
    body: `${x.name}, ${x.serving}: ${x.kcal} kcal, ${x.protein} g protein, ${x.carbs} g carbs, ${x.fat} g fat, about Rs ${x.priceInr} extra.`,
  })),
  ...exercises.map((x) => ({
    kind: 'exercise', id: x.id, title: x.name,
    text: `${x.name} ${x.pattern} exercise workout ${x.equipment.join(' ')}`,
    body: `${x.name} (${x.pattern}, ${x.reps}): ${x.cue}`,
  })),
]);

/** Top knowledge passages for a question. */
export const searchKnowledge = (query, limit = 5) =>
  bm25(corpus, query, limit).map(({ doc, score }) => ({
    kind: doc.kind, id: doc.id, title: doc.title, text: doc.body, score: Number(score.toFixed(2)),
  }));

const foodNames = foods.map((food) => ({
  food,
  names: [food.name, ...food.aliases].map((n) => ({ raw: n.toLowerCase(), tokens: tokenize(n) })),
}));

/**
 * Best food match for a label such as "yellow dal" or "2 rotis". At least half of the
 * label must be explained by the known name, so "egg fried rice" is left unmatched
 * instead of quietly resolving to plain rice with the wrong calories.
 */
export function matchFood(label) {
  const queryTokens = tokenize(label);
  if (!queryTokens.length) return null;
  const q = new Set(queryTokens);
  let best = null;
  for (const { food, names } of foodNames) {
    for (const { raw, tokens } of names) {
      if (!tokens.length) continue;
      const hits = tokens.filter((t) => q.has(t)).length;
      const coverName = hits / tokens.length;
      const coverQuery = hits / q.size;
      let score = (coverName + coverQuery) / 2;
      if (raw === String(label).toLowerCase().trim()) score = 1.1;
      if (coverQuery < 0.5 || (coverName < 1 && coverQuery < 0.6)) continue;
      if (!best || score > best.score) best = { food, score };
    }
  }
  return best && best.score >= 0.5 ? best : null;
}

export const foodById = (id) => foods.find((x) => x.id === id);
export const searchFoods = (query, limit = 8) => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return foods
    .filter((x) => [x.name, ...x.aliases].some((n) => n.toLowerCase().includes(q)))
    .slice(0, limit);
};
