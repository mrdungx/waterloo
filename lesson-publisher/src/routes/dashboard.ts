import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { trainerAuth } from '../middleware/trainer-auth.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // Aggregate stats across all trainer's lessons
  app.get('/dashboard/stats', { preHandler: [trainerAuth] }, async (request) => {
    const db = request.server.db;
    const trainer = await db
      .selectFrom('trainers')
      .select('id')
      .where('ahaslides_user_id', '=', request.trainer!.userId)
      .executeTakeFirstOrThrow();

    const stats = await db
      .selectFrom('lessons')
      .leftJoin('enrollments', 'enrollments.lesson_id', 'lessons.id')
      .select([
        sql<number>`count(distinct lessons.id) filter (where lessons.status = 'published')`.as('published_lessons'),
        sql<number>`count(distinct enrollments.id)`.as('total_learners'),
        sql<number>`round(100.0 * count(distinct enrollments.id) filter (where enrollments.status = 'completed') / nullif(count(distinct enrollments.id), 0))`.as('avg_completion'),
      ])
      .where('lessons.trainer_id', '=', trainer.id)
      .where('lessons.deleted_at', 'is', null)
      .executeTakeFirstOrThrow();

    const quizStats = await db
      .selectFrom('quiz_responses')
      .innerJoin('enrollments', 'enrollments.id', 'quiz_responses.enrollment_id')
      .innerJoin('lessons', 'lessons.id', 'enrollments.lesson_id')
      .select(sql<number>`round(100.0 * count(*) filter (where quiz_responses.is_correct) / nullif(count(*), 0))`.as('avg_quiz_score'))
      .where('lessons.trainer_id', '=', trainer.id)
      .where('lessons.deleted_at', 'is', null)
      .executeTakeFirstOrThrow();

    return {
      publishedLessons: Number(stats.published_lessons),
      totalLearners: Number(stats.total_learners),
      avgCompletion: Number(stats.avg_completion ?? 0),
      avgQuizScore: Number(quizStats.avg_quiz_score ?? 0),
    };
  });

  // Per-learner table for a specific lesson
  app.get('/lessons/:lessonId/learners', { preHandler: [trainerAuth] }, async (request) => {
    const { lessonId } = request.params as { lessonId: string };
    const query = request.query as { page?: string; pageSize?: string };
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 50)));
    const offset = (page - 1) * pageSize;
    const db = request.server.db;

    const blockCount = await db
      .selectFrom('blocks')
      .select(db.fn.count('id').as('count'))
      .where('lesson_id', '=', lessonId)
      .executeTakeFirstOrThrow();

    const totalBlocks = Number(blockCount.count);

    const totalResult = await db
      .selectFrom('enrollments')
      .select(db.fn.count('id').as('count'))
      .where('lesson_id', '=', lessonId)
      .executeTakeFirstOrThrow();

    const total = Number(totalResult.count);

    const learners = await db
      .selectFrom('enrollments')
      .innerJoin('learners', 'learners.id', 'enrollments.learner_id')
      .leftJoin('block_progress', 'block_progress.enrollment_id', 'enrollments.id')
      .leftJoin('quiz_responses', 'quiz_responses.enrollment_id', 'enrollments.id')
      .select([
        'learners.name',
        'learners.email',
        'enrollments.enrolled_at',
        'enrollments.last_active_at',
        'enrollments.status',
        sql<number>`count(distinct block_progress.id) filter (where block_progress.completed)`.as('blocks_completed'),
        sql<number>`round(100.0 * count(distinct quiz_responses.id) filter (where quiz_responses.is_correct) / nullif(count(distinct quiz_responses.id), 0))`.as('quiz_avg'),
      ])
      .where('enrollments.lesson_id', '=', lessonId)
      .groupBy(['learners.id', 'enrollments.id'])
      .orderBy('enrollments.enrolled_at', 'desc')
      .limit(pageSize)
      .offset(offset)
      .execute();

    return {
      learners: learners.map((l) => ({
        name: l.name,
        email: l.email,
        enrolledAt: l.enrolled_at,
        lastActiveAt: l.last_active_at,
        status: l.status,
        progress: { completed: Number(l.blocks_completed), total: totalBlocks },
        quizAvgPercent: Number(l.quiz_avg ?? 0),
      })),
      pagination: { page, pageSize, total },
    };
  });
}
