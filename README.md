# FitMentor AI

An agentic fitness and nutrition assistant for hostel students and day scholars. It
plans around what a student actually has: a mess menu, a small budget, a hostel room and
an irregular timetable.

Built with the MERN stack (MongoDB, Express, React, Node), LLMs, AI vision and
retrieval-augmented generation.

## Run it

The frontend and backend remain separate: `client/` is React + Vite and `server/`
is the Express API. The `/api` interface remains available for a future mobile client.
This project has not been migrated to Next.js.

You need Node 20 or newer. MongoDB does not need to be installed. On a fresh checkout:

```
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:3100. Keep your existing `.env` if you already configured the app.
Development runs the web app on port 3100 and the separate API on port 5000.

Optionally run `npm run seed` to create/reset the demo account, then log in as
`demo@fitmentor.app` with password `demo12345`. This command resets that account's
data; it is not required to run the app. All demo data is made up.

Add `GROQ_API_KEY` to `.env` for coaching and meal photos. Photos use
`GROQ_VISION_MODEL=qwen/qwen3.8-27b` with `VISION_PROVIDER=groq`.
An optional `GEMINI_API_KEY` provides a backup. Run `npm run check:ai` to test
configured providers. Keys stay in the backend `.env`; never add them to client code.

Groq lists this vision model on its rate-limited free plan (checked 8 November 2026).
See the current [vision documentation](https://console.groq.com/docs/vision) and
[account limits](https://console.groq.com/docs/rate-limits). Its preview model ID
may change. Photo identification and portions are estimates and should be reviewed
before saving. Failed requests or invalid photo-response data try the backup provider.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API on port 5000 and the web app on port 3100 |
| `npm test` | Runs the server test suite |
| `npm run build`, then `npm start` | Serves the built app from port 5000 |
| `npm run seed` | Resets the demo account |
| `npm run check:ai` | Tests your keys and model IDs against the real providers |

## Features

**Responsive experience.** A charcoal, cream, and lime visual system with locally
hosted Inter and Manrope fonts, a CSS 3D landing scene that responds to the pointer,
and reduced-motion support. Navigation adapts to a bottom bar on phones.

**Thoughtful starting states.** Meals, training, progress, and chat each explain
the next action when there is no data. Charts show logged values; zero and missing
entries are distinguished. Loading and error screens include clear recovery actions.

**Photo review before upload.** Choose or drop one JPG, PNG, or WebP under 6 MB,
preview the full image, then explicitly scan it. Replace or remove a photo, retry a
failed scan, adjust portions, and confirm before saving. If vision is unavailable,
typed meal logging remains available. Images and fonts are bundled locally; see
[asset credits](ASSETS.md).

**Food image recognition.** Upload a meal photo. The vision model identifies each item and
its portion, and the student checks the result before saving. The app also suggests
affordable foods that close the day's protein and calorie gap within the budget, diet and
kitchen access of that student.

**Agentic coach.** Agents assess the profile, build a weekly plan from available equipment,
monitor adherence, effort and weight, write a weekly report, and adapt the next week.

**Also included:** typed meal logging, exam-week plans, a chat coach that uses tools, weight
and protein charts, and a visible record of how each agent reached its result.

## How the agents work

| Agent | File | Job |
| --- | --- | --- |
| Assessor | `server/src/agents/assessor.js` | Sets targets and applies safety rules |
| Nutrition | `server/src/agents/nutrition.js` | Reads photos and text, grounds them in the food table, suggests foods |
| Planner | `server/src/agents/planner.js` | Builds a safe plan, then applies validated AI swaps |
| Monitor | `server/src/agents/monitor.js` | Measures the week and decides what changes |
| Coach | `server/src/agents/coach.js` | Runs a tool-calling loop for chat |
| Orchestrator | `server/src/agents/orchestrator.js` | Runs the weekly review pipeline |

The weekly review runs: monitor, nutrition decision, planner, report writer.

**Design rule: the LLM proposes and code decides.** Calorie maths, safety limits and
exercise constraints are deterministic. For example, the planner may suggest swaps, but a
swap is applied only if the new exercise is in that student's allowed list and has the same
movement pattern. Every rejected swap is recorded in the plan's trace.

**RAG.** `server/src/ai/retriever.js` ranks a local knowledge base (`server/src/knowledge/`)
with BM25: 62 Indian foods, 44 exercises and 16 coaching notes. Keyword ranking suits
exact food names such as pesarattu or pappu, and needs no vector database. Dishes found in a
photo use the table's values instead of the model's estimate.

**Without AI keys** everything except photo scanning still works, using rule-based plans,
reports and coaching notes. Each result records whether AI or fixed rules produced it.

## Limits

- Calories and macros are estimates. The food table holds typical values for one serving,
  and mess recipes vary. Food table values and prices should be checked against a source
  such as the Indian Food Composition Tables (IFCT 2017) before any formal accuracy claim.
- Portion sizes from a single photo are approximate, which is why students confirm them.
- Targets use the Mifflin-St Jeor equation, which is a population estimate.
- This is not medical advice. Users must be 16 or older, and people under 18 or underweight
  are not given a calorie deficit. Messages suggesting an eating disorder or self-harm get a
  fixed support reply. That check is keyword-based and will miss some messages.
- The built-in database is for local use. Use MongoDB Atlas for deployment, and move
  uploaded photos to object storage because `server/uploads` is local disk.
