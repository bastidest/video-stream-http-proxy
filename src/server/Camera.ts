import { promisify } from "util";
import { Cam as OnvifCam } from "onvif";

import { IOnvifSource, IStreamSource } from "./ConfigParser";
import { ConnectionString } from "./ConnectionString";
import { IPtzArgs } from "./IPtzArgs";

export class Camera {
  private static readonly CONNECTION_TIMEOUT = 5000;

  public readonly config: IStreamSource;
  private _streamUrl: string | null = null;
  private onvifConnection: OnvifCam | null = null;

  constructor(config: IStreamSource) {
    this.config = config;
  }

  private async setupOnvif(onvif: IOnvifSource) {
    const onvifConString = ConnectionString.from(onvif.url);

    const waitForConnect = new Promise((resolve, reject) => {
      this.onvifConnection = new OnvifCam(
        {
          hostname: onvifConString.host,
          username: onvifConString.username,
          password: onvifConString.password,
          port: onvifConString.port,
        },
        (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        }
      );
    });

    const didConnectPromise = Promise.race([
      waitForConnect,
      new Promise((res, _) =>
        setTimeout(res, Camera.CONNECTION_TIMEOUT, false)
      ),
    ]);

    const connectionSuccessful = await didConnectPromise;
    if (!connectionSuccessful || !this.onvifConnection) {
      throw new Error(
        "failed to connect to onvif interface after ${Camera.CONNECTION_TIMEOUT} milliseconds"
      );
    }

    let { uri: rtspConUrl } = await promisify(
      this.onvifConnection.getStreamUri
    ).bind(this.onvifConnection)({
      protocol: onvif.protocol,
      profileToken: onvif.profile,
    });

    const rtspConString = ConnectionString.from(rtspConUrl);
    rtspConString.username = onvifConString.username;
    rtspConString.password = onvifConString.password;

    this._streamUrl = rtspConString.toString();
  }

  public async setup() {
    if (!this.config.onvif && !this.config.rtsp) {
      throw new Error(
        "a valid camera configuration must contain at least a onvif or a rtsp configuration"
      );
    }

    if (this.config.onvif) {
      await this.setupOnvif(this.config.onvif);
    }

    if (this.config.rtsp) {
      this._streamUrl = this.config.rtsp.url;
    }
  }

  public async relativeMove(ptzArgs: IPtzArgs) {
    if (!this.onvifConnection) {
      return;
    }

    await promisify(this.onvifConnection.relativeMove).bind(
      this.onvifConnection
    )({
      x: ptzArgs.x,
      y: ptzArgs.y,
      zoom: ptzArgs.zoom,
    });
  }

  public async gotoHomePosition() {
    if (!this.onvifConnection) {
      return;
    }

    await promisify(this.onvifConnection.gotoHomePosition).bind(
      this.onvifConnection
    )({});
  }

  public get streamUrl(): string | null {
    return this._streamUrl;
  }

  public get id(): string {
    return this.config.id;
  }
}
