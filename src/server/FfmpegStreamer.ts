import cp from "node:child_process";
import path from "node:path";
import { Camera } from "./Camera";

import { DualRingBuffer } from "./RingBuffer";

export class FfmpegStreamer {
  private _camera: Camera;
  private childProcess: cp.ChildProcessWithoutNullStreams | null = null;
  private outputPath: string;
  private _outputBuffer: DualRingBuffer;

  constructor(outputPath: string, camera: Camera) {
    this._camera = camera;

    if (!/^[a-zA-Z0-9_-]+$/.test(camera.id)) {
      throw new Error(
        `invalid source id '${camera.id}', use only [a-zA-Z0-9_-]`
      );
    }

    this.outputPath = path.resolve(outputPath, camera.id);

    // keep 1000 lines of stdout+sterr combined
    this._outputBuffer = new DualRingBuffer(1000);
  }

  async start(): Promise<void> {
    if (this.childProcess !== null) {
      throw new Error("start() can only be called once");
    }

    console.log(`FfmpegStreamer(${this._camera.id}): starting...`);

    const args = ["--mkdir", "--clean-on-exit"];

    if (this._camera.config.target_latency) {
      args.push("--target-latency");
      args.push(`${this._camera.config.target_latency}`);
    }

    const streamUrl = this._camera.streamUrl;

    if (!streamUrl) {
      throw new Error("camera does not have a valid stream url");
    }

    this.childProcess = cp.spawn("bash", [
      "ffmpeg-wrapper.sh",
      ...args,
      streamUrl,
      this.outputPath,
    ]);

    this.childProcess.stdout.on("data", (chunk) => {
      this._outputBuffer.pushChunk(false, chunk);
    });

    this.childProcess.stderr.on("data", (chunk) => {
      this._outputBuffer.pushChunk(true, chunk);
    });
  }

  async stop(): Promise<void> {
    const proc = this.childProcess;
    if (proc === null) {
      throw new Error("start() must be called before stop()");
    }

    console.log(`FfmpegStreamer(${this._camera.id}): stopping...`);

    const waitForExit = new Promise((res, _) => {
      proc.on("exit", () => res(true));
    });

    proc.kill("SIGTERM");

    const didExitPromise = Promise.race([
      waitForExit,
      new Promise((res, _) => setTimeout(res, 5000, false)),
    ]);

    const didExit = await didExitPromise;

    if (!didExit) {
      console.log(
        `FfmpegStreamer(${this._camera.id}): ffmpeg cp did not exit gracefully, sending SIGKILL`
      );
      proc.kill("SIGKILL");
    } else {
      // kind of redundant..
      await waitForExit;
    }

    console.log(`FfmpegStreamer(${this._camera.id}): stopped.`);

    this.childProcess = null;
  }

  public get outputBuffer(): DualRingBuffer {
    return this._outputBuffer;
  }

  public get camera(): Camera {
    return this._camera;
  }
}
