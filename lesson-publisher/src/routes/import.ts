import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { trainerAuth } from '../middleware/trainer-auth.js';
import { AhaSlidesClient, AhaSlidesApiError } from '../services/ahaslides-client.js';
import { mapPresentation } from '../services/import-mapper.js';

const importSchema = z.object({
  lessonId: z.string().uuid().optional(),
});

export async function importRoutes(app: FastifyInstance) {
  // List trainer's AhaSlides presentations
  app.get('/import/presentations', { preHandler: [trainerAuth] }, async (request, reply) => {
    const token = request.headers.authorization?.slice(7);
    if (!token) return reply.status(401).send({ error: 'Missing token' });

    try {
      const client = new AhaSlidesClient(request.server.config.AHASLIDES_CORE_URL, token);
      const presentations = await client.listPresentations();
      return { presentations };
    } catch (err) {
      if (err instanceof AhaSlidesApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(502).send({ error: 'Import unavailable. Could not reach AhaSlides.' });
    }
  });

  // Import a presentation into a lesson
  app.post('/import/presentations/:presentationId', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { presentationId } = request.params as { presentationId: string };
    const body = importSchema.parse(request.body ?? {});
    const token = request.headers.authorization?.slice(7);
    if (!token) return reply.status(401).send({ error: 'Missing token' });

    const db = request.server.db;

    // Get trainer
    const trainer = await db
      .selectFrom('trainers')
      .select('id')
      .where('ahaslides_user_id', '=', request.trainer!.userId)
      .executeTakeFirstOrThrow();

    // Fetch presentation from AhaSlides core
    let exportData;
    try {
      const client = new AhaSlidesClient(request.server.config.AHASLIDES_CORE_URL, token);
      exportData = await client.exportPresentation(presentationId);
    } catch (err) {
      if (err instanceof AhaSlidesApiError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(502).send({ error: 'Import unavailable. Could not reach AhaSlides.' });
    }

    // Map slides to blocks
    const { blocks, warnings } = mapPresentation(exportData.slides);

    if (blocks.length === 0) {
      return reply.status(400).send({
        error: 'No importable content found in this presentation.',
        warnings,
      });
    }

    // Create or use existing lesson
    let lessonId = body.lessonId;

    if (!lessonId) {
      const slug = exportData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const lesson = await db
        .insertInto('lessons')
        .values({
          trainer_id: trainer.id,
          title: exportData.title,
          slug,
          source_presentation_id: presentationId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      lessonId = lesson.id;
    } else {
      // Update existing lesson with source reference
      await db
        .updateTable('lessons')
        .set({
          source_presentation_id: presentationId,
          updated_at: new Date(),
        })
        .where('id', '=', lessonId)
        .execute();
    }

    // Insert blocks
    if (blocks.length > 0) {
      await db
        .insertInto('blocks')
        .values(
          blocks.map((b) => ({
            lesson_id: lessonId!,
            type: b.type,
            position: b.position,
            title: b.title,
            content: b.content,
          }))
        )
        .execute();
    }

    return {
      lessonId,
      imported: blocks.length,
      warnings,
    };
  });
}
