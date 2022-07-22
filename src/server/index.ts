import express from "express";
import { resolve } from "path";
import WebSocket, { WebSocketServer } from "ws";
import { Camera } from "./Camera";

import { ConfigParser } from "./ConfigParser";
import { FfmpegStreamer } from "./FfmpegStreamer";
import { IBufferEntry } from "./RingBuffer";
import { isPtzArgs } from "./IPtzArgs";
import { RootConfig } from "./Config";

const cp = new ConfigParser("config.json");

let streamsStarted = false;

async function startStopStreams(
  start: boolean,
  streamers: FfmpegStreamer[]
): Promise<void> {
  const startPromises = streamers.map((streamer) => {
    if (start) {
      return streamer.start();
    } else {
      return streamer.stop();
    }
  });
  await Promise.all(startPromises);
  streamsStarted = start;
}

let lastClientSeenAt = Date.now();
let startStopJob: Promise<void> | null = null;
async function reportNumClients(
  numClients: number,
  streamers: FfmpegStreamer[]
): Promise<void> {
  const now = Date.now();

  if (numClients > 0) {
    lastClientSeenAt = now;
  }

  const disableAfterSeconds = 60;
  const shouldBeInStartedState =
    now - lastClientSeenAt < disableAfterSeconds * 1000;

  if (startStopJob == null && shouldBeInStartedState != streamsStarted) {
    console.log(
      `shouldBeInStartedState=${shouldBeInStartedState}, streamsStarted=${streamsStarted}`
    );
    startStopJob = startStopStreams(shouldBeInStartedState, streamers);
    await startStopJob;
    startStopJob = null;
  }
}

interface ISourceState {
  id: string;
  logMessages: IBufferEntry[];
  status: string;
}

interface IStateForClient {
  type: "state";
  sourceStates: ISourceState[];
}

function getStateForClient(streamers: FfmpegStreamer[]): IStateForClient {
  const sourceStates = streamers.map((s) => ({
    id: s.camera.id,
    logMessages: s.outputBuffer.ring,
    status: "ok",
  }));

  return {
    type: "state",
    sourceStates,
  };
}

(async () => {
  const config: RootConfig = await cp.parse();
  console.log(config);

  const sourceIds = config.sources.map((s) => s.id);
  if (new Set(sourceIds).size != sourceIds.length) {
    console.error("configuration error: source ids must be unique");
    process.exit(1);
  }

  const cameras = config.sources.map((src) => new Camera(src));

  await Promise.all(cameras.map((c) => c.setup()));

  const streamers = cameras.map(
    (cam) => new FfmpegStreamer(config.output_path, cam)
  );
  await startStopStreams(true, streamers);

  const app = express();

  // disable "X-powered-by: express" header
  app.set("x-powered-by", false);

  app.set("views", resolve("src/server/views"));
  app.set("view engine", "pug");

  const sources = () =>
    streamers.map((s) => ({
      id: s.camera.id,
      latency: s.camera.config.target_latency_secs,
    }));

  app.get("/", (_req, res) => {
    res.render(
      "index",
      {
        sources: sources(),
      },
      (err: Error, html: string) => {
        if (!err) {
          return res.send(html);
        }
        console.log(err);
        res.sendStatus(500);
      }
    );
  });

  app.use("/static", express.static(resolve("src/server/static")));
  app.use(
    "/vendor/dash.all.debug.js",
    express.static(resolve("node_modules/dashjs/dist/dash.all.debug.js"))
  );

  const listenPort = 3000;
  const rawHttpServer = app.listen(listenPort);
  console.log(`express listening on port ${3000}`);

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket: WebSocket) => {
    socket.on("message", (message: Buffer) => {
      const msg: any = JSON.parse(message.toString("utf8"));
      switch (msg.type) {
        case "ping":
          // do nothing
          break;
        case "state":
          const state: IStateForClient = getStateForClient(streamers);
          const stateJson: string = JSON.stringify(state);
          socket.send(Buffer.from(stateJson, "utf8"));
          break;
        case "target_latency_secs": {
          const streamer: FfmpegStreamer | undefined = streamers.find(
            (s) => s.camera.id === msg.stream_id
          );
          if (streamer) {
            streamer.camera.config.target_latency_secs = msg.value;
            console.log(
              `set ${streamer.camera.id} latency = ${streamer.camera.config.target_latency_secs}`
            );

            wss.clients.forEach((client) => {
              if (client === socket) return;
              const msg = {
                type: "target_latency_secs",
                id: streamer.camera.id,
                value: streamer.camera.config.target_latency_secs,
              };
              client.send(Buffer.from(JSON.stringify(msg), "utf8"));
            });
          }
          break;
        }
        case "restart": {
          const streamer: FfmpegStreamer | undefined = streamers.find(
            (s) => s.camera.id === msg.stream_id
          );
          if (streamer) {
            streamer
              .stop()
              .then(() => streamer.start())
              .catch((_e) =>
                console.error(
                  `failed to restart streamer ${streamer.camera.id}`
                )
              );
          }
          break;
        }
        case "ptz_relative": {
          const streamer: FfmpegStreamer | undefined = streamers.find(
            (s) => s.camera.id === msg.stream_id
          );
          if (streamer && isPtzArgs(msg.value)) {
            streamer.camera.relativeMove(msg.value);
          }
          break;
        }
        case "ptz_home": {
          const streamer: FfmpegStreamer | undefined = streamers.find(
            (s) => s.camera.id === msg.stream_id
          );
          if (streamer) {
            streamer.camera.gotoHomePosition();
          }
          break;
        }
        default:
          console.log(`WebSocket client sent unexpected message: ${msg}`);
      }
    });
  });

  streamers.forEach((streamer) => {
    streamer.outputBuffer.on("entry", (entry: IBufferEntry) => {
      wss.clients.forEach((client) => {
        const msg = {
          type: "log",
          id: streamer.camera.id,
          entry,
        };
        client.send(Buffer.from(JSON.stringify(msg), "utf8"));
      });
    });
  });

  rawHttpServer.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (socket: WebSocket) => {
      wss.emit("connection", socket, request);
    });
  });

  setInterval(() => {
    reportNumClients(wss.clients.size, streamers);
  }, 1000);
})();
