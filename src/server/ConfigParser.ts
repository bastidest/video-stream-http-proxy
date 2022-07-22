import fs from "fs/promises";

import { JSONSchemaType } from "ajv/dist/2020";
import { default as Ajv2020 } from "ajv/dist/2020";
export const ajv = new Ajv2020();

import { ConnectionString } from "./ConnectionString";
import {
  IOnvifSourceConfig,
  IRootConfig,
  IRtspSourceConfig,
  IStreamSourceConfig,
  RootConfig,
} from "./Config";

export class ParserError extends Error {
  public reason: any;

  constructor(message: string, reason: any) {
    super(message);
    this.reason = reason;
  }
}

const OnvifSourceSchema: JSONSchemaType<IOnvifSourceConfig> = {
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

const RtspSourceSchema: JSONSchemaType<IRtspSourceConfig> = {
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

const StreamSourceSchema: JSONSchemaType<IStreamSourceConfig> = {
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
    target_latency_secs: {
      type: "number",
      nullable: true,
    },
  },
  required: ["id"],
  additionalProperties: true,
};
ajv.addSchema(StreamSourceSchema, "StreamSourceSchema");
export const validateStreamSourceSchema = ajv.compile(StreamSourceSchema);

const ConfigSchema: JSONSchemaType<IRootConfig> = {
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

  public async parse(): Promise<RootConfig> {
    const configFileString: string = await fs.readFile(this.filepath, {
      encoding: "utf8",
    });
    const configObject: Object = JSON.parse(configFileString);
    if (validateConfigSchema(configObject)) {
      return new RootConfig(configObject);
    } else {
      throw new ParserError(
        "invalid config schema",
        validateConfigSchema.errors
      );
    }
  }
}
