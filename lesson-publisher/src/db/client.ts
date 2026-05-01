import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './types.js';

export function createDb(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString,
        max: 10,
      }),
    }),
  });
}
