/**
 * Streaming utilities for real-time LLM response processing
 */

export interface StreamChunk {
  content: string;
  delta: string;
  isComplete: boolean;
  metadata?: {
    model?: string;
    finishReason?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
    };
  };
}

/**
 * Stream processor that accumulates content and provides hooks
 */
export class StreamProcessor {
  private fullContent = '';
  private onChunkCallbacks: Array<(chunk: StreamChunk) => void> = [];
  private onCompleteCallbacks: Array<(content: string) => void> = [];
  private onErrorCallbacks: Array<(error: Error) => void> = [];

  /**
   * Register a callback for each chunk
   */
  onChunk(callback: (chunk: StreamChunk) => void): this {
    this.onChunkCallbacks.push(callback);
    return this;
  }

  /**
   * Register a callback for stream completion
   */
  onComplete(callback: (content: string) => void): this {
    this.onCompleteCallbacks.push(callback);
    return this;
  }

  /**
   * Register a callback for errors
   */
  onError(callback: (error: Error) => void): this {
    this.onErrorCallbacks.push(callback);
    return this;
  }

  /**
   * Process a stream chunk
   */
  async processChunk(delta: string, metadata?: StreamChunk['metadata']): Promise<void> {
    this.fullContent += delta;

    const chunk: StreamChunk = {
      content: this.fullContent,
      delta,
      isComplete: false,
      metadata,
    };

    for (const callback of this.onChunkCallbacks) {
      try {
        callback(chunk);
      } catch (error) {
        console.error('[StreamProcessor] Chunk callback error:', error);
      }
    }
  }

  /**
   * Mark stream as complete
   */
  async complete(metadata?: StreamChunk['metadata']): Promise<void> {
    const chunk: StreamChunk = {
      content: this.fullContent,
      delta: '',
      isComplete: true,
      metadata,
    };

    for (const callback of this.onChunkCallbacks) {
      try {
        callback(chunk);
      } catch (error) {
        console.error('[StreamProcessor] Chunk callback error:', error);
      }
    }

    for (const callback of this.onCompleteCallbacks) {
      try {
        callback(this.fullContent);
      } catch (error) {
        console.error('[StreamProcessor] Complete callback error:', error);
      }
    }
  }

  /**
   * Handle stream error
   */
  async error(error: Error): Promise<void> {
    for (const callback of this.onErrorCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error('[StreamProcessor] Error callback error:', err);
      }
    }
  }

  /**
   * Get accumulated content
   */
  getContent(): string {
    return this.fullContent;
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.fullContent = '';
  }
}

/**
 * Buffer stream chunks to reduce callback frequency
 */
export class StreamBuffer {
  private buffer = '';
  private flushIntervalMs: number;
  private minChunkSize: number;
  private lastFlushTime = Date.now();
  private onFlush: (content: string) => void;

  constructor(options: {
    flushIntervalMs?: number;
    minChunkSize?: number;
    onFlush: (content: string) => void;
  }) {
    this.flushIntervalMs = options.flushIntervalMs ?? 100;
    this.minChunkSize = options.minChunkSize ?? 10;
    this.onFlush = options.onFlush;
  }

  /**
   * Add content to buffer
   */
  add(content: string): void {
    this.buffer += content;

    const now = Date.now();
    const timeSinceFlush = now - this.lastFlushTime;

    if (
      this.buffer.length >= this.minChunkSize ||
      timeSinceFlush >= this.flushIntervalMs
    ) {
      this.flush();
    }
  }

  /**
   * Flush buffer immediately
   */
  flush(): void {
    if (this.buffer.length > 0) {
      this.onFlush(this.buffer);
      this.buffer = '';
      this.lastFlushTime = Date.now();
    }
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }
}
