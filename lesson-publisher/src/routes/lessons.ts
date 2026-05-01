import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { trainerAuth } from '../middleware/trainer-auth.js';

const createLessonSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
});

const updateLessonSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
});

export async function lessonRoutes(app: FastifyInstance) {
  // List trainer's lessons with stats
  app.get('/lessons', { preHandler: [trainerAuth] }, async (request) => {
    const db = request.server.db;
    const trainer = await db
      .selectFrom('trainers')
      .select('id')
      .where('ahaslides_user_id', '=', request.trainer!.userId)
      .executeTakeFirstOrThrow();

    const lessons = await db
      .selectFrom('lessons')
      .selectAll('lessons')
      .where('trainer_id', '=', trainer.id)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute();

    // Fetch stats for each lesson
    const lessonsWithStats = await Promise.all(
      lessons.map(async (lesson) => {
        const stats = await db
          .selectFrom('enrollments')
          .select([
            sql<number>`count(distinct enrollments.id)`.as('learner_count'),
            sql<number>`round(100.0 * count(distinct enrollments.id) filter (where enrollments.status = 'completed') / nullif(count(distinct enrollments.id), 0))`.as('completion_percent'),
          ])
          .where('lesson_id', '=', lesson.id)
          .executeTakeFirst();

        const quizStats = await db
          .selectFrom('quiz_responses')
          .innerJoin('enrollments', 'enrollments.id', 'quiz_responses.enrollment_id')
          .select(sql<number>`round(100.0 * count(*) filter (where quiz_responses.is_correct) / nullif(count(*), 0))`.as('avg_quiz_score'))
          .where('enrollments.lesson_id', '=', lesson.id)
          .executeTakeFirst();

        return {
          ...lesson,
          stats: {
            learnerCount: Number(stats?.learner_count ?? 0),
            completionPercent: Number(stats?.completion_percent ?? 0),
            avgQuizScore: Number(quizStats?.avg_quiz_score ?? 0),
          },
        };
      })
    );

    return { lessons: lessonsWithStats };
  });

  // Create lesson
  app.post('/lessons', { preHandler: [trainerAuth] }, async (request, reply) => {
    const body = createLessonSchema.parse(request.body);
    const db = request.server.db;

    const trainer = await db
      .selectFrom('trainers')
      .select('id')
      .where('ahaslides_user_id', '=', request.trainer!.userId)
      .executeTakeFirstOrThrow();

    const slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const lesson = await db
      .insertInto('lessons')
      .values({
        trainer_id: trainer.id,
        title: body.title,
        slug,
        description: body.description ?? null,
        estimated_minutes: body.estimatedMinutes ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.status(201).send({ lesson });
  });

  // Get lesson with blocks
  app.get('/lessons/:lessonId', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const db = request.server.db;

    const lesson = await db
      .selectFrom('lessons')
      .selectAll()
      .where('id', '=', lessonId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });

    const blocks = await db
      .selectFrom('blocks')
      .selectAll()
      .where('lesson_id', '=', lessonId)
      .orderBy('position', 'asc')
      .execute();

    return { lesson, blocks };
  });

  // Update lesson
  app.put('/lessons/:lessonId', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const body = updateLessonSchema.parse(request.body);
    const db = request.server.db;

    const lesson = await db
      .updateTable('lessons')
      .set({
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.estimatedMinutes !== undefined && { estimated_minutes: body.estimatedMinutes }),
        updated_at: new Date(),
      })
      .where('id', '=', lessonId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });

    return { lesson };
  });

  // Soft delete
  app.delete('/lessons/:lessonId', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const db = request.server.db;

    const result = await db
      .updateTable('lessons')
      .set({ deleted_at: new Date() })
      .where('id', '=', lessonId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!result.numUpdatedRows) return reply.status(404).send({ error: 'Lesson not found' });

    return reply.status(204).send();
  });

  // Publish
  app.post('/lessons/:lessonId/publish', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const db = request.server.db;

    const lesson = await db
      .updateTable('lessons')
      .set({ status: 'published', published_at: new Date(), updated_at: new Date() })
      .where('id', '=', lessonId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });

    return { lesson };
  });

  // Unpublish
  app.post('/lessons/:lessonId/unpublish', { preHandler: [trainerAuth] }, async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };
    const db = request.server.db;

    const lesson = await db
      .updateTable('lessons')
      .set({ status: 'draft', updated_at: new Date() })
      .where('id', '=', lessonId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();

    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });

    return { lesson };
  });
}
