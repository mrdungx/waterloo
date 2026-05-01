import type { FastifyInstance } from 'fastify';
import { trainerAuth } from '../middleware/trainer-auth.js';

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/me', { preHandler: [trainerAuth] }, async (request) => {
    const trainer = request.trainer!;
    const db = request.server.db;

    // Upsert trainer record
    const slug = trainer.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await db
      .selectFrom('trainers')
      .selectAll()
      .where('ahaslides_user_id', '=', trainer.userId)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable('trainers')
        .set({
          display_name: trainer.displayName,
          email: trainer.email,
          avatar_url: trainer.avatarUrl ?? null,
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();

      return { trainer: { ...existing, display_name: trainer.displayName, email: trainer.email } };
    }

    const inserted = await db
      .insertInto('trainers')
      .values({
        ahaslides_user_id: trainer.userId,
        slug,
        display_name: trainer.displayName,
        email: trainer.email,
        avatar_url: trainer.avatarUrl ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { trainer: inserted };
  });
}
