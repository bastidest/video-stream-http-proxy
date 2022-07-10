import fs from "fs/promises";

import { JSONSchemaType } from "ajv/dist/2020";
import { default as Ajv2020 } from "ajv/dist/2020";
export const ajv = new Ajv2020();

import { ConnectionString } from './ConnectionString';

export interface IOnvifSource {
  url: string;
  profile?: string;
  protocol?: string;
}

export interface IRtspSource {
  url: string;
}

export interface IStreamSource {
  id: string;
  target_latency?: number;
  onvif?: IOnvifSource;
  rtsp?: IRtspSource;
}

export interface IConfig {
  output_path: string;
  sources: IStreamSource[];
}

export class ParserError extends Error {
  public reason: any;

  constructor(message: string, reason: any) {
    super(message);
    this.reason = reason;
  }
}

const OnvifSourceSchema: JSONSchemaType<IOnvifSource> = {
  $id: "https://github.com/bastidest/video-stream-http-proxy/schemas/config/OnvifSource.json",
  type: "object",
  properties: {
    url: {
      type: "string",
      pattern: ConnectionString.REGEX.source,
    },
    profile: {
      type: "string",
      nullable: true,
    },
    protocol: {
      type: "string",
      nullable: true,
    },
  },
  required: ["url"],
  additionalProperties: true,
};
ajv.addSchema(OnvifSourceSchema, "OnvifSourceSchema");
export const validateOnvifSourceSchema = ajv.compile(OnvifSourceSchema);

const RtspSourceSchema: JSONSchemaType<IRtspSource> = {
  $id: "https://github.com/bastidest/video-stream-http-proxy/schemas/config/RtspSource.json",
  type: "object",
  properties: {
    url: {
      type: "string",
      pattern: ConnectionString.REGEX.source,
    },
  },
  required: ["url"],
  additionalProperties: true,
};
ajv.addSchema(RtspSourceSchema, "RtspSourceSchema");
export const validateRtspSourceSchema = ajv.compile(RtspSourceSchema);

const StreamSourceSchema: JSONSchemaType<IStreamSource> = {
  $id: "https://github.com/bastidest/video-stream-http-proxy/schemas/config/StreamSource.json",
  type: "object",
  properties: {
    id: {
      type: "string",
    },
    onvif: {
      type: "object",
      $ref: "./OnvifSource.json",
    },
    rtsp: {
      type: "object",
      $ref: "./RtspSource.json",
    },
    target_latency: {
      type: "number",
      nullable: true,
    },
  },
  required: ["id"],
  additionalProperties: true,
};
ajv.addSchema(StreamSourceSchema, "StreamSourceSchema");
export const validateStreamSourceSchema = ajv.compile(StreamSourceSchema);

const ConfigSchema: JSONSchemaType<IConfig> = {
  $id: "https://github.com/bastidest/video-stream-http-proxy/schemas/config/Config.json",
  type: "object",
  properties: {
    output_path: {
      type: "string",
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        $ref: "./StreamSource.json",
        required: [],
      },
    },
  },
  required: ["output_path", "sources"],
  additionalProperties: true,
};
ajv.addSchema(ConfigSchema, "ConfigSchema");
export const validateConfigSchema = ajv.compile(ConfigSchema);

export class ConfigParser {
  private filepath: string;

  public constructor(filepath: string) {
    this.filepath = filepath;
  }

  public async parse(): Promise<IConfig> {
    const configFileString: string = await fs.readFile(this.filepath, {
      encoding: "utf8",
    });
    const configObject: Object = JSON.parse(configFileString);
    if (validateConfigSchema(configObject)) {
      return configObject;
    } else {
      throw new ParserError(
        "invalid config schema",
        validateConfigSchema.errors
      );
    }
  }
}
