import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type { Env } from '../config.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export class UploadService {
  private s3: S3Client;
  private bucket: string;

  constructor(config: Env) {
    this.bucket = config.S3_BUCKET;
    this.s3 = new S3Client({
      region: config.S3_REGION,
      ...(config.S3_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
        },
      }),
    });
  }

  async getPresignedUploadUrl(
    trainerId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new UploadError(`File type "${mimeType}" is not allowed`);
    }

    if (sizeBytes > MAX_FILE_SIZE) {
      throw new UploadError(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const ext = filename.split('.').pop() ?? '';
    const key = `uploads/${trainerId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    const fileUrl = `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, fileUrl, key };
  }
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}
