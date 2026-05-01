import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { trainerAuth } from '../middleware/trainer-auth.js';
import type { BlockContent, BlockType } from '../db/types.js';

const blockContentSchema = z.union([
  z.object({ html: z.string() }),
  z.object({ url: z.string(), alt: z.string().optional(), caption: z.string().optional() }),
  z.object({ provider: z.enum(['youtube', 'loom', 'vimeo']), embed_url: z.string(), thumbnail_url: z.string().optional(), duration_seconds: z.number().optional() }),
  z.object({ questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string(), is_correct: z.boolean() })),
    explanation: z.string().optional(),
  })) }),
  z.object({ url: z.string(), filename: z.string(), size_bytes: z.number(), mime_type: z.string() }),
]);

const createBlockSchema = z.object({
  type: z.enum(['text', 'image', 'video', 'quiz', 'file']),
  position: z.number().int().min(0),
  title: z.string().max(500).optional(),
  content: blockContentSchema,
});

const updateBlockSchema = z.object({
  title: z.string().max(500).optional(),
  content: blockContentSchema.optional(),
});

const reorderSchema = z.object({
  blockIds: z.array(z.string().uuid()),
});

function sanitizeBlockContent(type: BlockType, content: BlockContent): BlockContent {
  if (type === 'text' && 'html' in content) {
    return { html: sanitizeHtml(content.html) };
  }
  return content;
}

export async function blockRoutes(app: FastifyInstance) {
  // List blocks
  app.get('/lessons/:lessonId/blocks', { preHandler: [trainerAuth] }, async (request) => {
    const { lessonId } = request.params as { lessonId: string };
    const blocks = await request.server.db
      .selectFrom('blocks')
      .selectAll()
      .where('lesson_id', '=', lessonId)
      .orderBy('position', 'asc')
      .execute();

    return { blocks };
  });

  // Add block
  app.post('/lessons/:lessonId/blocks', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const body = createBlockSchema.parse(request.body);
    const db = request.server.db;

    const content = sanitizeBlockContent(body.type, body.content as BlockContent);

    const block = await db
      .insertInto('blocks')
      .values({
        lesson_id: lessonId,
        type: body.type,
        position: body.position,
        title: body.title ?? null,
        content,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.status(201).send({ block });
  });

  // Update block
  app.put('/lessons/:lessonId/blocks/:blockId', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { blockId } = request.params as { lessonId: string; blockId: string };
    const body = updateBlockSchema.parse(request.body);
    const db = request.server.db;

    const existing = await db
      .selectFrom('blocks')
      .select(['id', 'type'])
      .where('id', '=', blockId)
      .executeTakeFirst();

    if (!existing) return reply.status(404).send({ error: 'Block not found' });

    const updates: Record<string, any> = { updated_at: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.content) updates.content = sanitizeBlockContent(existing.type, body.content as BlockContent);

    const block = await db
      .updateTable('blocks')
      .set(updates)
      .where('id', '=', blockId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { block };
  });

  // Delete block
  app.delete('/lessons/:lessonId/blocks/:blockId', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { blockId } = request.params as { lessonId: string; blockId: string };
    const result = await request.server.db
      .deleteFrom('blocks')
      .where('id', '=', blockId)
      .executeTakeFirst();

    if (!result.numDeletedRows) return reply.status(404).send({ error: 'Block not found' });

    return reply.status(204).send();
  });

  // Reorder blocks (array-index update)
  app.put('/lessons/:lessonId/blocks/reorder', { preHandler: [trainerAuth] }, async (request) => {
    const { lessonId } = request.params as { lessonId: string };
    const { blockIds } = reorderSchema.parse(request.body);
    const db = request.server.db;

    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < blockIds.length; i++) {
        await trx
          .updateTable('blocks')
          .set({ position: i, updated_at: new Date() })
          .where('id', '=', blockIds[i])
          .where('lesson_id', '=', lessonId)
          .execute();
      }
    });

    return { ok: true };
  });
}
