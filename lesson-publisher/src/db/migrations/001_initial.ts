import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create enum types
  await sql`CREATE TYPE lesson_status AS ENUM ('draft', 'published', 'archived')`.execute(db);
  await sql`CREATE TYPE block_type AS ENUM ('text', 'image', 'video', 'quiz', 'file')`.execute(db);
  await sql`CREATE TYPE enrollment_status AS ENUM ('not_started', 'in_progress', 'completed', 'idle')`.execute(db);

  // Trainers
  await db.schema
    .createTable('trainers')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('ahaslides_user_id', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('slug', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('display_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('avatar_url', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Lessons
  await db.schema
    .createTable('lessons')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trainer_id', 'uuid', (col) => col.notNull().references('trainers.id'))
    .addColumn('title', 'varchar(500)', (col) => col.notNull())
    .addColumn('slug', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('estimated_minutes', 'int2')
    .addColumn('status', sql`lesson_status`, (col) => col.notNull().defaultTo('draft'))
    .addColumn('published_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('source_presentation_id', 'varchar(64)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('lessons_trainer_id_slug_unique', ['trainer_id', 'slug'])
    .execute();

  await db.schema.createIndex('idx_lessons_trainer_id').on('lessons').column('trainer_id').execute();
  await db.schema.createIndex('idx_lessons_status').on('lessons').column('status').execute();

  // Blocks
  await db.schema
    .createTable('blocks')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('lesson_id', 'uuid', (col) => col.notNull().references('lessons.id').onDelete('cascade'))
    .addColumn('type', sql`block_type`, (col) => col.notNull())
    .addColumn('position', 'int2', (col) => col.notNull())
    .addColumn('title', 'varchar(500)')
    .addColumn('content', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_blocks_lesson_position').on('blocks').columns(['lesson_id', 'position']).execute();

  // Learners
  await db.schema
    .createTable('learners')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Enrollments
  await db.schema
    .createTable('enrollments')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('learner_id', 'uuid', (col) => col.notNull().references('learners.id'))
    .addColumn('lesson_id', 'uuid', (col) => col.notNull().references('lessons.id'))
    .addColumn('status', sql`enrollment_status`, (col) => col.notNull().defaultTo('not_started'))
    .addColumn('enrolled_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('started_at', 'timestamptz')
    .addColumn('completed_at', 'timestamptz')
    .addColumn('last_active_at', 'timestamptz')
    .addUniqueConstraint('enrollments_learner_lesson_unique', ['learner_id', 'lesson_id'])
    .execute();

  await db.schema.createIndex('idx_enrollments_lesson_id').on('enrollments').column('lesson_id').execute();
  await db.schema.createIndex('idx_enrollments_learner_id').on('enrollments').column('learner_id').execute();
  await db.schema.createIndex('idx_enrollments_status').on('enrollments').column('status').execute();

  // Block Progress
  await db.schema
    .createTable('block_progress')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('enrollment_id', 'uuid', (col) => col.notNull().references('enrollments.id').onDelete('cascade'))
    .addColumn('block_id', 'uuid', (col) => col.notNull().references('blocks.id').onDelete('cascade'))
    .addColumn('completed', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('completed_at', 'timestamptz')
    .addUniqueConstraint('block_progress_enrollment_block_unique', ['enrollment_id', 'block_id'])
    .execute();

  await db.schema.createIndex('idx_block_progress_enrollment_id').on('block_progress').column('enrollment_id').execute();

  // Quiz Responses
  await db.schema
    .createTable('quiz_responses')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('enrollment_id', 'uuid', (col) => col.notNull().references('enrollments.id').onDelete('cascade'))
    .addColumn('block_id', 'uuid', (col) => col.notNull().references('blocks.id').onDelete('cascade'))
    .addColumn('question_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('selected_option_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('is_correct', 'boolean', (col) => col.notNull())
    .addColumn('answered_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('quiz_responses_enrollment_block_question_unique', ['enrollment_id', 'block_id', 'question_id'])
    .execute();

  await db.schema.createIndex('idx_quiz_responses_enrollment_id').on('quiz_responses').column('enrollment_id').execute();
  await db.schema.createIndex('idx_quiz_responses_block_id').on('quiz_responses').column('block_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('quiz_responses').ifExists().execute();
  await db.schema.dropTable('block_progress').ifExists().execute();
  await db.schema.dropTable('enrollments').ifExists().execute();
  await db.schema.dropTable('learners').ifExists().execute();
  await db.schema.dropTable('blocks').ifExists().execute();
  await db.schema.dropTable('lessons').ifExists().execute();
  await db.schema.dropTable('trainers').ifExists().execute();
  await sql`DROP TYPE IF EXISTS enrollment_status`.execute(db);
  await sql`DROP TYPE IF EXISTS block_type`.execute(db);
  await sql`DROP TYPE IF EXISTS lesson_status`.execute(db);
}
