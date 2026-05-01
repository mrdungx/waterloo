import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { learnerAuth } from '../middleware/learner-auth.js';

const quizAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionId: z.string(),
});

export async function learnerRoutes(app: FastifyInstance) {
  // Get current progress
  app.get('/learner/progress', { preHandler: [learnerAuth] }, async (request) => {
    const { enrollmentId } = request.learner!;
    const db = request.server.db;

    const enrollment = await db
      .selectFrom('enrollments')
      .selectAll()
      .where('id', '=', enrollmentId)
      .executeTakeFirstOrThrow();

    const progress = await db
      .selectFrom('block_progress')
      .selectAll()
      .where('enrollment_id', '=', enrollmentId)
      .execute();

    const quizResponses = await db
      .selectFrom('quiz_responses')
      .selectAll()
      .where('enrollment_id', '=', enrollmentId)
      .execute();

    return { enrollment, progress, quizResponses };
  });

  // Mark block complete
  app.post('/learner/blocks/:blockId/complete', { preHandler: [learnerAuth] }, async (request) => {
    const { blockId } = request.params as { blockId: string };
    const { enrollmentId } = request.learner!;
    const db = request.server.db;
    const now = new Date();

    // Upsert block progress (idempotent)
    await db
      .insertInto('block_progress')
      .values({
        enrollment_id: enrollmentId,
        block_id: blockId,
        completed: true,
        completed_at: now,
      })
      .onConflict((oc) =>
        oc.columns(['enrollment_id', 'block_id']).doUpdateSet({
          completed: true,
          completed_at: now,
        })
      )
      .execute();

    // Update enrollment status and last_active_at
    await db
      .updateTable('enrollments')
      .set({
        status: 'in_progress',
        started_at: sql`coalesce(started_at, ${now})`,
        last_active_at: now,
      })
      .where('id', '=', enrollmentId)
      .execute();

    return { ok: true };
  });

  // Submit quiz answer
  app.post('/learner/blocks/:blockId/quiz', { preHandler: [learnerAuth] }, async (request, reply) => {
    const { blockId } = request.params as { blockId: string };
    const { enrollmentId } = request.learner!;
    const body = quizAnswerSchema.parse(request.body);
    const db = request.server.db;

    // Get the block to check the answer
    const block = await db
      .selectFrom('blocks')
      .select('content')
      .where('id', '=', blockId)
      .where('type', '=', 'quiz')
      .executeTakeFirst();

    if (!block) return reply.status(404).send({ error: 'Quiz block not found' });

    const content = block.content as { questions: { id: string; options: { id: string; is_correct: boolean }[]; explanation?: string }[] };
    const question = content.questions.find((q) => q.id === body.questionId);
    if (!question) return reply.status(400).send({ error: 'Question not found' });

    const selectedOption = question.options.find((o) => o.id === body.selectedOptionId);
    if (!selectedOption) return reply.status(400).send({ error: 'Option not found' });

    const isCorrect = selectedOption.is_correct;

    // Upsert response (one answer per question, idempotent)
    await db
      .insertInto('quiz_responses')
      .values({
        enrollment_id: enrollmentId,
        block_id: blockId,
        question_id: body.questionId,
        selected_option_id: body.selectedOptionId,
        is_correct: isCorrect,
      })
      .onConflict((oc) =>
        oc.columns(['enrollment_id', 'block_id', 'question_id']).doUpdateSet({
          selected_option_id: body.selectedOptionId,
          is_correct: isCorrect,
          answered_at: new Date(),
        })
      )
      .execute();

    // Update last_active_at
    await db
      .updateTable('enrollments')
      .set({ last_active_at: new Date() })
      .where('id', '=', enrollmentId)
      .execute();

    return {
      isCorrect,
      explanation: question.explanation,
    };
  });

  // Mark lesson complete
  app.post('/learner/complete', { preHandler: [learnerAuth] }, async (request) => {
    const { enrollmentId } = request.learner!;
    const now = new Date();

    await request.server.db
      .updateTable('enrollments')
      .set({
        status: 'completed',
        completed_at: now,
        last_active_at: now,
      })
      .where('id', '=', enrollmentId)
      .execute();

    return { ok: true };
  });
}
