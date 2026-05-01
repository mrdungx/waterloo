import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface LearnerPayload {
  learnerId: string;
  enrollmentId: string;
  lessonId: string;
}

export function createLearnerToken(payload: LearnerPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: '24h' });
}

export async function learnerAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, request.server.config.LEARNER_JWT_SECRET) as LearnerPayload;
    request.learner = payload;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired learner session. Please register again.' });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    learner?: LearnerPayload;
  }
}
