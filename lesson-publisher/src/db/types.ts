import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// Enum types matching PostgreSQL
export type LessonStatus = 'draft' | 'published' | 'archived';
export type BlockType = 'text' | 'image' | 'video' | 'quiz' | 'file';
export type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'idle';

// Block content discriminated union
export type TextContent = { html: string };
export type ImageContent = { url: string; alt?: string; caption?: string };
export type VideoContent = { provider: 'youtube' | 'loom' | 'vimeo'; embed_url: string; thumbnail_url?: string; duration_seconds?: number };
export type QuizQuestion = {
  id: string;
  text: string;
  options: { id: string; text: string; is_correct: boolean }[];
  explanation?: string;
};
export type QuizContent = { questions: QuizQuestion[] };
export type FileContent = { url: string; filename: string; size_bytes: number; mime_type: string };
export type BlockContent = TextContent | ImageContent | VideoContent | QuizContent | FileContent;

// Table definitions
export interface TrainerTable {
  id: Generated<string>;
  ahaslides_user_id: string;
  slug: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LessonTable {
  id: Generated<string>;
  trainer_id: string;
  title: string;
  slug: string;
  description: string | null;
  estimated_minutes: number | null;
  status: Generated<LessonStatus>;
  published_at: Date | null;
  deleted_at: Date | null;
  source_presentation_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface BlockTable {
  id: Generated<string>;
  lesson_id: string;
  type: BlockType;
  position: number;
  title: string | null;
  content: BlockContent;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LearnerTable {
  id: Generated<string>;
  email: string;
  name: string;
  created_at: Generated<Date>;
}

export interface EnrollmentTable {
  id: Generated<string>;
  learner_id: string;
  lesson_id: string;
  status: Generated<EnrollmentStatus>;
  enrolled_at: Generated<Date>;
  started_at: Date | null;
  completed_at: Date | null;
  last_active_at: Date | null;
}

export interface BlockProgressTable {
  id: Generated<string>;
  enrollment_id: string;
  block_id: string;
  completed: Generated<boolean>;
  completed_at: Date | null;
}

export interface QuizResponseTable {
  id: Generated<string>;
  enrollment_id: string;
  block_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
  answered_at: Generated<Date>;
}

// Database interface
export interface DB {
  trainers: TrainerTable;
  lessons: LessonTable;
  blocks: BlockTable;
  learners: LearnerTable;
  enrollments: EnrollmentTable;
  block_progress: BlockProgressTable;
  quiz_responses: QuizResponseTable;
}

// Helper types for each table
export type Trainer = Selectable<TrainerTable>;
export type NewTrainer = Insertable<TrainerTable>;
export type TrainerUpdate = Updateable<TrainerTable>;

export type Lesson = Selectable<LessonTable>;
export type NewLesson = Insertable<LessonTable>;
export type LessonUpdate = Updateable<LessonTable>;

export type Block = Selectable<BlockTable>;
export type NewBlock = Insertable<BlockTable>;
export type BlockUpdate = Updateable<BlockTable>;

export type Learner = Selectable<LearnerTable>;
export type NewLearner = Insertable<LearnerTable>;

export type Enrollment = Selectable<EnrollmentTable>;
export type NewEnrollment = Insertable<EnrollmentTable>;
export type EnrollmentUpdate = Updateable<EnrollmentTable>;

export type BlockProgress = Selectable<BlockProgressTable>;
export type QuizResponse = Selectable<QuizResponseTable>;
