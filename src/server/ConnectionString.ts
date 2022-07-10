export class ConnectionString {
  static readonly REGEX =
    /^((?<protocol>[^:\s]+?):\/\/)?((?<username>[^:\s]+?)(:(?<password>[^@\s]+?))?@)?(?<host>(\[.+\]|[^\[][^:\s]+)?)(:(?<port>\d+?))?((?<path>)\/[^?\s]+)?(\?(?<query>[^\s]+))?$/;

  public host: string;
  public protocol: string | null = null;
  public username: string | null = null;
  public password: string | null = null;
  public port: string | null = null;
  public path: string | null = null;
  public query: string | null = null;

  constructor(
    host: string,
    rest?: {
      protocol?: string;
      username?: string;
      password?: string;
      port?: string;
      path?: string;
      query?: string;
    }
  ) {
    this.host = host;
    this.protocol = (rest || {}).protocol || null;
    this.username = (rest || {}).username || null;
    this.password = (rest || {}).password || null;
    this.port = (rest || {}).port || null;
    this.path = (rest || {}).path || null;
    this.query = (rest || {}).query || null;
  }

  public static from(connectionString: string): ConnectionString {
    const match = connectionString.match(this.REGEX);
    if (!match || !match.groups) {
      throw new Error("invalid connection string");
    }

    const host = match.groups["host"];
    const protocol = match.groups["protocol"];
    const usernameEncoded = match.groups["username"];
    const passwordEncoded = match.groups["password"];
    const port = match.groups["port"];
    const path = match.groups["path"];
    const query = match.groups["query"];

    const username = decodeURIComponent(usernameEncoded);
    const password = decodeURIComponent(passwordEncoded);

    return new ConnectionString(host, {
      protocol,
      username,
      password,
      port,
      path,
      query,
    });
  }

  public toString(): string {
    let ret = this.host;
    if (this.port) {
      ret = `${ret}:${this.port}`;
    }

    if (this.username) {
      let usernamePw = encodeURIComponent(this.username);
      if (this.password) {
        usernamePw = `${usernamePw}:${encodeURIComponent(this.password)}`;
      }
      ret = `${usernamePw}@${ret}`;
    }

    if (this.protocol) {
      ret = `${this.protocol}://${ret}`;
    }

    if (this.path) {
      ret = `${ret}${this.path}`;
    }

    if (this.query) {
      ret = `${ret}?{this.query}`;
    }

    return ret;
  }
}
