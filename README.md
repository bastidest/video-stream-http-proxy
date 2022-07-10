# Video Stream (ONVIF/RTSP/...) to HTTP/DASH Proxy
This project reads multiple video streams (e.g. RTSP) and outputs low-latency DASH streams, accessible via a HTTP connection, viewable via a simple web interface.
It handles many (>10) video streams with little without high CPU load if no video conversion is desired (e.g 4K -> 1080p or H265 -> H264).

**Features**
- ✅ Extensibile and flexible video encoding architecture to allow arbitrary stream conversions with FFMPEG
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
Commands (PTZ, Pan Tilt Zoom) issued from your browser are forwared to the Node.js Manager and sent to the camera.

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

