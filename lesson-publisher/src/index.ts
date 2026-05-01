import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { lessonRoutes } from './routes/lessons.js';
import { blockRoutes } from './routes/blocks.js';
import { publicRoutes } from './routes/public.js';
import { learnerRoutes } from './routes/learner.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { authRoutes } from './routes/auth.js';
import { importRoutes } from './routes/import.js';
import { uploadRoutes } from './routes/uploads.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

await app.register(cors, { origin: true });
await app.register(rateLimit, { global: false });

// Decorate with shared dependencies
app.decorate('db', db);
app.decorate('config', config);

// Routes
await app.register(authRoutes, { prefix: '/api/v1' });
await app.register(lessonRoutes, { prefix: '/api/v1' });
await app.register(blockRoutes, { prefix: '/api/v1' });
await app.register(publicRoutes, { prefix: '/api/v1' });
await app.register(learnerRoutes, { prefix: '/api/v1' });
await app.register(dashboardRoutes, { prefix: '/api/v1' });
await app.register(importRoutes, { prefix: '/api/v1' });
await app.register(uploadRoutes, { prefix: '/api/v1' });

// Health check
app.get('/health', async () => ({ status: 'ok' }));

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(`Lesson Publisher running on port ${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down`);
    await app.close();
    await db.destroy();
    process.exit(0);
  });
}
