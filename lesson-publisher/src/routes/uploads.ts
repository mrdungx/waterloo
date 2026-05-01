import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { trainerAuth } from '../middleware/trainer-auth.js';
import { UploadService, UploadError } from '../services/upload.js';

const presignSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function uploadRoutes(app: FastifyInstance) {
  const uploadService = new UploadService(app.config);

  app.post('/uploads/presign', { preHandler: [trainerAuth] }, async (request, reply) => {
    const body = presignSchema.parse(request.body);

    const trainer = await request.server.db
      .selectFrom('trainers')
      .select('id')
      .where('ahaslides_user_id', '=', request.trainer!.userId)
      .executeTakeFirstOrThrow();

    try {
      const result = await uploadService.getPresignedUploadUrl(
        trainer.id,
        body.filename,
        body.mimeType,
        body.sizeBytes,
      );
      return result;
    } catch (err) {
      if (err instanceof UploadError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
