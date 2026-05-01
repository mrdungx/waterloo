import type { BlockType, BlockContent } from '../db/types.js';

export interface AhaSlidesSlide {
  type: string;
  content: Record<string, any>;
  position: number;
}

export interface MappedBlock {
  type: BlockType;
  position: number;
  title: string | null;
  content: BlockContent;
}

export interface ImportResult {
  blocks: MappedBlock[];
  warnings: string[];
}

const SKIPPED_TYPES = new Set(['spinner_wheel', 'leaderboard']);

const LIVE_ONLY_TYPES = new Set(['poll', 'word_cloud', 'scale', 'open_ended']);

export function mapPresentation(slides: AhaSlidesSlide[]): ImportResult {
  const blocks: MappedBlock[] = [];
  const warnings: string[] = [];
  let position = 0;

  for (const slide of slides) {
    if (SKIPPED_TYPES.has(slide.type)) {
      warnings.push(`Skipped "${slide.type}" slide (position ${slide.position}) -- no async equivalent.`);
      continue;
    }

    if (LIVE_ONLY_TYPES.has(slide.type)) {
      blocks.push({
        type: 'text',
        position: position++,
        title: slide.content.title ?? null,
        content: {
          html: `<p>${slide.content.text ?? slide.content.title ?? ''}</p><p><em>This was a live "${slide.type}" activity. Consider replacing with a quiz or removing.</em></p>`,
        },
      });
      warnings.push(`Converted "${slide.type}" slide (position ${slide.position}) to text block -- live-only activity.`);
      continue;
    }

    const mapped = mapSlide(slide, position);
    if (mapped) {
      blocks.push(mapped);
      position++;
    }
  }

  return { blocks, warnings };
}

function mapSlide(slide: AhaSlidesSlide, position: number): MappedBlock | null {
  switch (slide.type) {
    case 'heading':
      return {
        type: 'text',
        position,
        title: null,
        content: { html: `<h2>${slide.content.text ?? ''}</h2>` },
      };

    case 'paragraph':
      return {
        type: 'text',
        position,
        title: slide.content.title ?? null,
        content: { html: `<p>${slide.content.text ?? ''}</p>` },
      };

    case 'image':
      return {
        type: 'image',
        position,
        title: slide.content.caption ?? null,
        content: {
          url: slide.content.url ?? '',
          alt: slide.content.alt ?? '',
          caption: slide.content.caption ?? '',
        },
      };

    case 'video':
      return {
        type: 'video',
        position,
        title: slide.content.title ?? null,
        content: {
          provider: detectVideoProvider(slide.content.url ?? ''),
          embed_url: slide.content.url ?? '',
          thumbnail_url: slide.content.thumbnail ?? undefined,
          duration_seconds: slide.content.duration ?? undefined,
        },
      };

    case 'multiple_choice':
    case 'quiz':
      return {
        type: 'quiz',
        position,
        title: slide.content.title ?? null,
        content: {
          questions: [{
            id: `q${position}`,
            text: slide.content.question ?? slide.content.title ?? '',
            options: (slide.content.options ?? []).map((opt: any, i: number) => ({
              id: `o${i}`,
              text: opt.text ?? opt,
              is_correct: opt.is_correct ?? opt.correct ?? false,
            })),
            explanation: slide.content.explanation ?? undefined,
          }],
        },
      };

    default:
      return null;
  }
}

function detectVideoProvider(url: string): 'youtube' | 'loom' | 'vimeo' {
  if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('loom.com')) return 'loom';
  if (url.includes('vimeo')) return 'vimeo';
  return 'youtube';
}
