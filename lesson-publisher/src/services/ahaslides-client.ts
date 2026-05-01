import type { AhaSlidesSlide } from './import-mapper.js';

export interface AhaPresentation {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: string;
  thumbnailUrl?: string;
}

export interface AhaPresentationExport {
  title: string;
  slides: AhaSlidesSlide[];
}

export class AhaSlidesClient {
  constructor(
    private baseUrl: string,
    private accessToken: string,
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new AhaSlidesApiError(
        `AhaSlides API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    return response.json() as Promise<T>;
  }

  async listPresentations(): Promise<AhaPresentation[]> {
    return this.request<AhaPresentation[]>('/api/v1/presentations');
  }

  async exportPresentation(presentationId: string): Promise<AhaPresentationExport> {
    return this.request<AhaPresentationExport>(`/api/v1/presentations/${presentationId}/export`);
  }
}

export class AhaSlidesApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AhaSlidesApiError';
  }
}
