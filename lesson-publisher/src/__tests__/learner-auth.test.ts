import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { createLearnerToken, type LearnerPayload } from '../middleware/learner-auth.js';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

describe('createLearnerToken', () => {
  it('creates a valid JWT with correct payload', () => {
    const payload: LearnerPayload = {
      learnerId: 'learner-123',
      enrollmentId: 'enrollment-456',
      lessonId: 'lesson-789',
    };

    const token = createLearnerToken(payload, SECRET);
    const decoded = jwt.verify(token, SECRET) as LearnerPayload & { exp: number; iat: number };

    expect(decoded.learnerId).toBe('learner-123');
    expect(decoded.enrollmentId).toBe('enrollment-456');
    expect(decoded.lessonId).toBe('lesson-789');
    expect(decoded.exp).toBeDefined();
  });

  it('creates a token that expires in 24 hours', () => {
    const payload: LearnerPayload = {
      learnerId: 'learner-123',
      enrollmentId: 'enrollment-456',
      lessonId: 'lesson-789',
    };

    const token = createLearnerToken(payload, SECRET);
    const decoded = jwt.verify(token, SECRET) as { exp: number; iat: number };

    const ttl = decoded.exp - decoded.iat;
    expect(ttl).toBe(86400); // 24 hours in seconds
  });

  it('rejects tokens signed with wrong secret', () => {
    const payload: LearnerPayload = {
      learnerId: 'learner-123',
      enrollmentId: 'enrollment-456',
      lessonId: 'lesson-789',
    };

    const token = createLearnerToken(payload, SECRET);

    expect(() => jwt.verify(token, 'wrong-secret-wrong-secret-wrong-secret')).toThrow();
  });

  it('rejects expired tokens', () => {
    const token = jwt.sign(
      { learnerId: 'x', enrollmentId: 'y', lessonId: 'z' },
      SECRET,
      { expiresIn: '-1s' },
    );

    expect(() => jwt.verify(token, SECRET)).toThrow('jwt expired');
  });
});
