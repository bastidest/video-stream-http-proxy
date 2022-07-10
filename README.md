# Video Stream (ONVIF/RTSP/...) to HTTP/DASH Proxy
This project reads multiple video streams (e.g. RTSP) and outputs low-latency DASH streams, accessible via a HTTP connection, viewable via a simple web interface.
It handles many (>10) video streams with little without high CPU load if no video conversion is desired (e.g 4K -> 1080p or H265 -> H264).

**Features**
- ✅ Extensible and flexible video encoding architecture to allow arbitrary stream conversions with FFMPEG
- ✅ Low CPU load when no re-encoding is performed
- ✅ Automatically stops streaming from sources after the last client disconnects
- ✅ End-to-end latency ~2s for fast connections
- ✅ Simple Pan Tilt Zoom (PTZ) commands can be sent to ONVIF capable IP cameras
- ✅ No frontend framework
- ℹ️ Ugly UI design (PRs welcome)

https://user-images.githubusercontent.com/1242917/178140875-1ed84e04-7654-4b87-99cf-374d834dbd03.mov

## What is it for? / Why would I need this?
- You have a insecure IP camera which provides a RTSP stream and you want to make the stream securely accessible via a simple website
- You want to aggregate multiple different stream sources on a single web page
- You want to share your slow IP camera which can only handle a few clients with many people at once
- You want to limit the upload bandwidth of your local IP camera but allow many simultaneous users
- You want to access a RTSP stream/camera in a public WIFI which disallows traffic other than HTTP(S)
- You want to convert your HQ video stream to a low quality one to view it with limited bandwidth availability (adaptive quality)


## What does it do?
When a client connects to the website, the Node.js manager starts streaming from all video stream sources which you define in a configuration file.
Using FFMPEG, the source streams are converted into DASH streams and temporarily stored in shared memory.
NGINX serves the DASH files in the shared memory directly to your browser.
Commands (PTZ, Pan Tilt Zoom) issued from your browser are forwarded to the Node.js Manager and sent to the camera.

```text

                +-------------------+   +-------------------+
                | Docker Container  |   | Docker Container  |
+----------+    |   +--------+   +----------+   +--------+  |   +-----------+
| Camera 1 +----|-->| FFMPEG +-->|          |   |        |<-|---+ Browser 1 |
+----------+    |   +--------+   |          |   |        |  |   +-----------+
                |        |       |          |   |        |  |
+----------+    |   +--------+   |          |   |        |  |   +-----------+
| Camera 2 +----|-->| FFMPEG +-->| /dev/shm |<--+        |<-|---+ Browser 2 |
+----------+    |   +--------+   |          |   |        |  |   +-----------+
                |        |       |          |   | NGINX  |  |
+----------+    |   +--------+   |          |   |        |  |   +-----------+
| Camera 3 +----|-->| FFMPEG +-->|          |   |        |<-|---+ Browser . |
+----------+    |   +--------+   +----------+   |        |  |   +-----------+
     ^          |        |          |   |       |        |  |
     |          |  +-----------+  Ctrl Cmds     |        |  |   +-----------+
     |   PTZ    |  |  Node.js  |<---|---|-------+        |<-|---+ Browser N |
     +----------+--+  Manager  |    |   |       |        |  |   +-----------+
        ONVIF   |  +-----------+    |   |       +--------+  |
                +-------------------+   +-------------------+

```

## Installation / Getting Started
1. Copy the `docker-compose.prod.yml` template to wherever you want to deploy the application
1. Replace the `${DOCKER_NGINX_VERSION}` variable with your desired nginx version
1. Create the `config.json` configuration file
1. Copy the nginx configuration template from `nginx/nginx.conf` and configure to your liking
1. `docker-compose up -d`

### Custom Encoding
If you want to re-encode video streams, modify the `ffmpeg-wrapper.sh` script to your requirements and bind-mount it into the backend container.

### Configuration
The application is configured using a `.json` configuration file (see example configuration in `config.json`).
The configuration file must be mounted at `/app/config.json` in the backend docker container (see `docker-compose.prod.yml`).
A complete description of the JSON schema can be found in `src/server/ConfigParser.ts`.

**`.output_path`**
- description: Path to the directory storing the temporary DASH media files.
- type: `string`
- required: `true`

**`.sources[]`**
- description: Ordered list of all stream sources.
- type: `array`
- required: `true`

**`.sources[].id`**
- description: Unique identifier for the stream source.
- type: `string`
- required: `true`

**`.sources[].target_latency_secs`**
- description: Total end to end latency that the browser tries to maintain. If set too low the browser buffers often. Can be changed temporarily in the fronted.
- type: `number`
- required: `false`
- default: `4`

**`.sources[].rtsp{}`**
- description: Configuration of the rtsp source stream.
- type: `object`
- required: `anyOf(.sources[].rtsp{}, .sources[].onvif{})`

**`.sources[].rtsp{}.url`**
- description: The connection string used to connect (and authenticate with) the RTSP stream source. If the RTSP stream URL is determined using the ONVIF interface, this property overrides the ONVIF URL.
- type: `string` ([see Connection Strings](#connection-strings))
- required: `true`

**`.sources[].onvif{}`**
- description: Configuration for a ONVIF connection.
- type: `object`
- required: `anyOf(.sources[].rtsp{}, .sources[].onvif{})`

**`.sources[].onvif{}.url`**
- description: The connection string used to connect (and authenticate with) the ONVIF. Used to control the camera (PTZ) and retrieve the RTSP streaming URL.
- type: `string` ([see Connection Strings](#connection-strings))
- required: `true`

**`.sources[].onvif{}.profile`**
- description: The ONVIF profile name to use.
- type: `string`
- required: `false`

**`.sources[].onvif{}.protocol`**
- description: The preferred protocol when retrieving the RTSP streaming URL from the ONVIF.
- type: `string`, `"UDP" | "TCP" | "RTSP" | "HTTP"`
- required: `false`


#### Connection Strings
- Format: [protocol `://`] [username [`:` password] `@`] hostname [`:` port] [`/` path] [`?` query]
- Examples
  - `mydomain.com`
  - `myproto://michael@mydomain.com`
  - `myproto://michael:secret%20password@mydomain.com:4634/some/path?some=args&more=args`


## Development
1. Clone repository
1. `./start.sh dev` -> Wait for the bash prompt
1. Access the dev command by pressing the "up" arrow
1. Visit `http://localhost`

### Release Workflow with `git-conventional-commits`
1. Determine version by `git-conventional-commits version`
1. Update version in project files
   * Commit version bump `git commit -am'build(release): bump project version to <version>'`
1. Generate change log by `git-conventional-commits changelog --release  <version> --file 'CHANGELOG.md'`
   * Commit change log `git commit -am'doc(release): create <version> change log entry'`
1. Tag commit with version `git tag -a -m'build(release): <version>' '<version-prefix><version>'`
1. Push all changes `git push`
1. Build and upload artifacts
