import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface TrainerPayload {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export async function trainerAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    // Validate with AhaSlides core by calling their user info endpoint
    const response = await fetch(`${request.server.config.AHASLIDES_CORE_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    const user = await response.json() as {
      id: string;
      email: string;
      name: string;
      avatar_url?: string;
    };

    request.trainer = {
      userId: user.id,
      email: user.email,
      displayName: user.name,
      avatarUrl: user.avatar_url,
    };
  } catch {
    return reply.status(401).send({ error: 'Authentication failed' });
  }
}

// Fastify type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    trainer?: TrainerPayload;
  }
  interface FastifyInstance {
    db: import('kysely').Kysely<import('../db/types.js').DB>;
    config: import('../config.js').Env;
  }
}
