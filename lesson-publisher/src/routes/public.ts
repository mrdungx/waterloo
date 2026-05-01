import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createLearnerToken } from '../middleware/learner-auth.js';

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
});

export async function publicRoutes(app: FastifyInstance) {
  // Lesson metadata for registration page (no auth)
  app.get('/public/:trainerSlug/:lessonSlug', async (request, reply) => {
    const { trainerSlug, lessonSlug } = request.params as { trainerSlug: string; lessonSlug: string };
    const db = request.server.db;

    const trainer = await db
      .selectFrom('trainers')
      .select(['id', 'display_name', 'avatar_url'])
      .where('slug', '=', trainerSlug)
      .executeTakeFirst();

    if (!trainer) return reply.status(404).send({ error: 'Not found' });

    const lesson = await db
      .selectFrom('lessons')
      .selectAll()
      .where('trainer_id', '=', trainer.id)
      .where('slug', '=', lessonSlug)
      .where('status', '=', 'published')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });

    const blockCount = await db
      .selectFrom('blocks')
      .select(db.fn.count('id').as('count'))
      .where('lesson_id', '=', lesson.id)
      .executeTakeFirstOrThrow();

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimated_minutes,
        blockCount: Number(blockCount.count),
      },
      trainer: {
        displayName: trainer.display_name,
        avatarUrl: trainer.avatar_url,
      },
    };
  });

  // Learner registration (rate limited)
  app.post('/public/:trainerSlug/:lessonSlug/register', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const { trainerSlug, lessonSlug } = request.params as { trainerSlug: string; lessonSlug: string };
    const body = registerSchema.parse(request.body);
    const db = request.server.db;

    // Find lesson
    const trainer = await db
      .selectFrom('trainers')
      .select('id')
      .where('slug', '=', trainerSlug)
      .executeTakeFirst();

    if (!trainer) return reply.status(404).send({ error: 'Not found' });

    const lesson = await db
      .selectFrom('lessons')
      .selectAll()
      .where('trainer_id', '=', trainer.id)
      .where('slug', '=', lessonSlug)
      .where('status', '=', 'published')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!lesson) return reply.status(404).send({ error: 'Lesson not found' });

    // Upsert learner by email
    let learner = await db
      .selectFrom('learners')
      .selectAll()
      .where('email', '=', body.email.toLowerCase())
      .executeTakeFirst();

    if (!learner) {
      learner = await db
        .insertInto('learners')
        .values({ email: body.email.toLowerCase(), name: body.name })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    // Find or create enrollment
    let enrollment = await db
      .selectFrom('enrollments')
      .selectAll()
      .where('learner_id', '=', learner.id)
      .where('lesson_id', '=', lesson.id)
      .executeTakeFirst();

    if (!enrollment) {
      enrollment = await db
        .insertInto('enrollments')
        .values({
          learner_id: learner.id,
          lesson_id: lesson.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    // Fetch blocks
    const blocks = await db
      .selectFrom('blocks')
      .selectAll()
      .where('lesson_id', '=', lesson.id)
      .orderBy('position', 'asc')
      .execute();

    // Fetch existing progress
    const progress = await db
      .selectFrom('block_progress')
      .selectAll()
      .where('enrollment_id', '=', enrollment.id)
      .execute();

    const quizResponses = await db
      .selectFrom('quiz_responses')
      .selectAll()
      .where('enrollment_id', '=', enrollment.id)
      .execute();

    // Issue learner JWT
    const token = createLearnerToken(
      { learnerId: learner.id, enrollmentId: enrollment.id, lessonId: lesson.id },
      request.server.config.LEARNER_JWT_SECRET
    );

    return {
      token,
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
      },
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimated_minutes,
      },
      blocks,
      progress,
      quizResponses,
    };
  });
}
