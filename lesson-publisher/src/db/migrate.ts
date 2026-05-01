import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDb } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migration "${it.migrationName}" executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`Migration "${it.migrationName}" failed`);
    }
  });

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await db.destroy();
  console.log('Migrations complete');
}

main();
