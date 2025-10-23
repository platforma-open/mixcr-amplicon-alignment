import type { RemoteBlobHandle } from '@platforma-sdk/model';
import { getRawPlatformaInstance } from '@platforma-sdk/model';
import { simpleRetry } from './simpleRetry';

export class ChunkedStreamReader {
  private readonly handle: RemoteBlobHandle;
  private readonly totalSize: number;
  private readonly chunkSize: number;
  private currentPosition: number = 0;

  constructor(handle: RemoteBlobHandle, totalSize: number, chunkSize: number = 16 * 1024 * 1024) {
    if (totalSize < 0) throw new Error('Total size must be non-negative');
    if (chunkSize <= 0) throw new Error('Chunk size must be positive');
    this.handle = handle;
    this.totalSize = totalSize;
    this.chunkSize = chunkSize;
  }

  createStream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: () => {},
      pull: async (controller) => {
        if (this.currentPosition >= this.totalSize) {
          controller.close();
          return;
        }
        const endPosition = Math.min(this.currentPosition + this.chunkSize, this.totalSize);
        const data = await simpleRetry(async () => getRawPlatformaInstance().blobDriver.getContent(
          this.handle,
          { from: this.currentPosition, to: endPosition },
        ), { maxAttempts: 3, delay: 500 });
        controller.enqueue(data);
        this.currentPosition = endPosition;
      },
      cancel: () => {
        this.currentPosition = 0;
      },
    });
  }
}
