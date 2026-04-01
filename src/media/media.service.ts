import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { randomBytes } from 'crypto';

const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
const NUMERIC_ID_RE = /^\d{1,20}$/;
const FILENAME_RE = /^(?!.*\.\.)(?!.*[/\\])[\s\S]{1,255}$/;

type UploadTicketPayload = {
  orgid: string;
  productId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  expiresAt: number;
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly workerUrl: string;
  private readonly uploadSecret: string;
  private readonly publicDomain: string;
  private readonly uploadTicketSecret: string;

  constructor(private readonly config: ConfigService) {
    this.workerUrl = this.config.get<string>('R2_WORKER_URL') || '';
    this.uploadSecret = this.config.get<string>('R2_UPLOAD_SECRET') || '';
    this.publicDomain = this.config.get<string>('R2_PUBLIC_DOMAIN') || '';
    this.uploadTicketSecret =
      this.config.get<string>('PUBLIC_UPLOAD_TICKET_SECRET') ||
      this.uploadSecret ||
      this.config.get<string>('HRV_CLIENT_SECRET') ||
      '';
  }

  validateProductId(productId: string): string {
    if (!NUMERIC_ID_RE.test(productId)) {
      throw new BadRequestException('Invalid productId');
    }
    return productId;
  }

  validateFilename(filename: string): string {
    if (!FILENAME_RE.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
    return filename;
  }

  validateUploadInput(
    contentType: string,
    fileSize: number,
  ): 'image' | 'video' {
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new BadRequestException('Unsupported file type');
    }

    const isVideo = contentType.startsWith('video/');
    const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
    if (fileSize > maxSize) {
      throw new BadRequestException(
        `File too large. Max ${isVideo ? '50MB' : '5MB'} for ${isVideo ? 'video' : 'image'}`,
      );
    }

    return isVideo ? 'video' : 'image';
  }

  createUploadTicket(input: {
    orgid: string;
    productId: string;
    filename: string;
    contentType: string;
    fileSize: number;
    ttlMs?: number;
  }): { ticket: string; expiresAt: number } {
    if (!this.uploadTicketSecret) {
      throw new BadRequestException('Upload ticket secret is not configured');
    }

    const productId = this.validateProductId(input.productId);
    const filename = this.validateFilename(input.filename);
    this.validateUploadInput(input.contentType, input.fileSize);

    const expiresAt = Date.now() + (input.ttlMs ?? 2 * 60 * 1000);
    const payload: UploadTicketPayload = {
      orgid: input.orgid,
      productId,
      filename,
      contentType: input.contentType,
      fileSize: input.fileSize,
      expiresAt,
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.uploadTicketSecret)
      .update(encoded)
      .digest('base64url');

    return { ticket: `${encoded}.${signature}`, expiresAt };
  }

  verifyUploadTicket(
    ticket: string,
    expected: {
      orgid: string;
      productId: string;
      filename: string;
      contentType: string;
      fileSize: number;
    },
  ): UploadTicketPayload {
    if (!this.uploadTicketSecret) {
      throw new BadRequestException('Upload ticket secret is not configured');
    }

    const [encoded, signature] = String(ticket || '').split('.');
    if (!encoded || !signature) {
      throw new BadRequestException('Missing upload ticket');
    }

    const computed = crypto
      .createHmac('sha256', this.uploadTicketSecret)
      .update(encoded)
      .digest('base64url');

    if (
      computed.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
    ) {
      throw new BadRequestException('Invalid upload ticket');
    }

    let payload: UploadTicketPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as UploadTicketPayload;
    } catch {
      throw new BadRequestException('Invalid upload ticket');
    }

    if (!payload || payload.expiresAt <= Date.now()) {
      throw new BadRequestException('Upload ticket expired');
    }

    if (
      payload.orgid !== expected.orgid ||
      payload.productId !== this.validateProductId(expected.productId) ||
      payload.filename !== this.validateFilename(expected.filename) ||
      payload.contentType !== expected.contentType ||
      payload.fileSize !== expected.fileSize
    ) {
      throw new BadRequestException('Upload ticket mismatch');
    }

    this.validateUploadInput(payload.contentType, payload.fileSize);
    return payload;
  }

  async uploadFile(
    orgid: string,
    productId: string,
    filename: string,
    contentType: string,
    buffer: Buffer,
  ): Promise<{ cdnUrl: string; type: string }> {
    const mediaType = this.validateUploadInput(contentType, buffer.length);
    const safeName = this
      .validateFilename(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeProductId = this.validateProductId(productId);
    const uniqueId = randomBytes(8).toString('base64url');
    const key = `reviews/${orgid}/${safeProductId}/${uniqueId}/${safeName}`;

    // Upload via Cloudflare Worker proxy (bypasses TLS issue with R2 S3 endpoint)
    const response = await fetch(`${this.workerUrl}/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'X-Upload-Token': this.uploadSecret,
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Worker upload failed: ${response.status} ${errorText}`);
      throw new BadRequestException('Upload failed');
    }

    return {
      cdnUrl: `https://${this.publicDomain}/${key}`,
      type: mediaType,
    };
  }
}
