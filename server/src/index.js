import { aiStatus } from './ai/llm.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { startDigestScheduler } from './mail/dailyDigest.js';
import { mailStatus } from './mail/mailer.js';

await connectDb();
const server = createApp().listen(config.port, () => {
  const ai = aiStatus();
  console.log(`FitMentor API on http://localhost:${config.port}`);
  console.log(`Daily emails: ${mailStatus()}`);
  console.log(`AI text: ${ai.text ?? 'off (rule-based replies)'}; photo scan: ${ai.vision ?? 'off (add GEMINI_API_KEY)'}`);
});

startDigestScheduler();

async function shutdown() {
  server.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
