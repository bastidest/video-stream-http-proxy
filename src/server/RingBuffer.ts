import { EventEmitter } from "node:events";

export interface IBufferEntry {
  isErr: boolean;
  timestamp: string;
  content: string;
}

interface IBuffer {
  buf: Buffer;
  len: number;
}

export class DualRingBuffer extends EventEmitter {
  private capacity: number;
  private _ring: IBufferEntry[];
  private stdout: IBuffer;
  private stderr: IBuffer;

  constructor(capacity: number) {
    super();
    this.capacity = capacity;
    this._ring = [];
    this.stdout = {
      buf: Buffer.alloc(2 * 1024 * 1024),
      len: 0,
    };
    this.stderr = {
      buf: Buffer.alloc(2 * 1024 * 1024),
      len: 0,
    };
  }

  private pushLine(entry: IBufferEntry): void {
    this._ring.push(entry);
    if (this._ring.length > this.capacity) {
      this._ring.splice(0, this._ring.length - this.capacity);
    }

    if (entry.isErr) {
      this.emit("stderr", entry.content);
    } else {
      this.emit("stdout", entry.content);
    }
    this.emit("entry", entry);
  }

  private completeLine(std: IBuffer): void {
    const content = std.buf.toString("utf8", 0, std.len);
    this.pushLine({
      isErr: std === this.stderr,
      timestamp: new Date().toUTCString(),
      content,
    });

    // reset the buffer length
    std.len = 0;
  }

  public pushChunk(isErr: boolean, chunk: Buffer): void {
    const std: IBuffer = isErr ? this.stderr : this.stdout;

    let currentIdx = 0;
    let lineBreakPos = chunk.indexOf("\n", currentIdx, "utf8");
    while (lineBreakPos >= 0) {
      // include the line break
      chunk.copy(std.buf, std.len, currentIdx, lineBreakPos + 1);
      std.len += lineBreakPos + 1 - currentIdx;
      currentIdx += lineBreakPos + 1 - currentIdx;
      this.completeLine(std);

      lineBreakPos = chunk.indexOf("\n", currentIdx, "utf8");
    }

    // copy the leftover buffer content
    chunk.copy(std.buf, std.len, currentIdx, chunk.length);
    std.len = chunk.length - currentIdx;
  }

  public get ring(): IBufferEntry[] {
    return this._ring;
  }
}
