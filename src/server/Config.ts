export interface IOnvifSourceConfig {
  url: string;
  profile?: string;
  protocol?: string;
}

export interface IRtspSourceConfig {
  url: string;
}

export interface IStreamSourceConfig {
  id: string;
  target_latency_secs?: number;
  onvif?: IOnvifSourceConfig;
  rtsp?: IRtspSourceConfig;
}

export interface IRootConfig {
  output_path: string;
  sources: IStreamSourceConfig[];
}

export class OnvifSourceConfig implements IOnvifSourceConfig {
  url: string;
  profile?: string | undefined;
  protocol?: string | undefined;

  constructor(c: IOnvifSourceConfig) {
    this.url = c.url;
    this.profile = c.profile;
    this.protocol = c.protocol;
  }
}

export class RtspSourceConfig implements IRtspSourceConfig {
  url: string;

  constructor(c: IRtspSourceConfig) {
    this.url = c.url;
  }
}

export class StreamSourceConfig implements IStreamSourceConfig {
  id: string;
  target_latency_secs: number;
  onvif?: OnvifSourceConfig | undefined;
  rtsp?: RtspSourceConfig | undefined;

  constructor(c: IStreamSourceConfig) {
    this.id = c.id;
    this.target_latency_secs = c.target_latency_secs || 4;
    this.onvif = c.onvif ? new OnvifSourceConfig(c.onvif) : undefined;
    this.rtsp = c.rtsp ? new RtspSourceConfig(c.rtsp) : undefined;
  }
}

export class RootConfig implements IRootConfig {
  output_path: string;
  sources: StreamSourceConfig[];

  constructor(c: IRootConfig) {
    this.output_path = c.output_path;
    this.sources = c.sources.map((s) => new StreamSourceConfig(s));
  }
}
