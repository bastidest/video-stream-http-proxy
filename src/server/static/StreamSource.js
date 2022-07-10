export class StreamSource {
  constructor(streamId, streamEl, socket) {
    this.streamId = streamId;
    this.streamEl = streamEl;
    this.videoEl = this.streamEl.querySelector("video");
    this.logEl = this.streamEl.querySelector(".log");
    this.switcherBtnLog = this.streamEl.querySelector(
      ".switcher > button[data-id='log']"
    );
    this.switcherBtnCtrl = this.streamEl.querySelector(
      ".switcher > button[data-id='ctrl']"
    );
    this.tabLog = this.streamEl.querySelector(".wrapper > .log");
    this.tabCtrl = this.streamEl.querySelector(".wrapper > .controls");
    this.targetLatencyEl = this.streamEl.querySelector(
      ".controls .latency select"
    );
    this.controlButtons = this.streamEl.querySelectorAll(".controls button");
    this.scrollLock = true;
    this.latency = 5;
    this.socket = socket;
    this.url = `/stream/${this.streamId}/manifest.mpd`;
    this.playerResetter = null;

    const latencyStringMaybe = this.streamEl.getAttribute("data-latency");
    if (
      typeof latencyStringMaybe === "string" &&
      latencyStringMaybe.length > 0
    ) {
      const parsed = parseInt(latencyStringMaybe, 10);
      if (parsed !== NaN) {
        this.setTargetLatency(parsed);
      }
    }

    this.switcherBtnLog.addEventListener("click", () => {
      this.enableTab("log");
    });
    this.switcherBtnCtrl.addEventListener("click", () => {
      this.enableTab("ctrl");
    });
    this.targetLatencyEl.addEventListener("change", () => {
      this.onTargetLatencyChange(this.targetLatencyEl.value);
    });
    this.controlButtons.forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const action = e.target.getAttribute("data-action");
        ((
          {
            home: () => this.cameraControl("home"),
            left: () => this.cameraControl("left"),
            right: () => this.cameraControl("right"),
            up: () => this.cameraControl("up"),
            down: () => this.cameraControl("down"),
            restart: () => this.restartStreamer(),
          }[action] || (() => {})
        )());
      })
    );
  }

  enablePlayerResetter() {
    let linearBackoffSeconds = 0;

    this.playerResetter = setTimeout(
      function doReset() {
        console.log(
          `${this.streamId}: did not begin streaming, resetting player`
        );
        this.player.reset();
        this.player.initialize(this.videoEl, this.url, true);

        // simulate a linear backoff by waiting a second more each time
        linearBackoffSeconds += 1;
        this.playerResetter = setTimeout(
          doReset.bind(this),
          linearBackoffSeconds * 1000
        );
      }.bind(this),
      /* estimated startup time = latency + 2 seconds */ (this.latency + 2) *
        1000
    );
  }

  start() {
    this.player = dashjs.MediaPlayer().create();

    this.enablePlayerResetter();

    this.player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
      console.log(e);
      if (e.error.code === 25) {
        console.log(
          `${this.streamId}: .mpd file not available, resetting player`
        );
        this.player.attachSource(this.url);
      }
    });

    this.player.on(dashjs.MediaPlayer.events.CAN_PLAY, (e) => {
      console.log(e);
      if (this.playerResetter) {
        clearInterval(this.playerResetter);
        this.playerResetter = null;
      }
    });

    this.player.initialize(this.videoEl, this.url, true);

    const graceArea = 10;

    this.logEl.addEventListener(
      "scroll",
      (_) => {
        if (
          this.logEl.scrollHeight - this.logEl.scrollTop <=
          this.logEl.clientHeight + graceArea
        ) {
          this.scrollLock = true;
        } else {
          this.scrollLock = false;
        }
      },
      { passive: true }
    );
  }

  appendLog(lineString) {
    const logLineEl = document.createElement("span");
    logLineEl.innerText = lineString;
    this.logEl.appendChild(logLineEl);

    const maxLength = 100;
    const currentLength = this.logEl.childNodes.length;

    for (let i = 0; i < currentLength - maxLength; i++) {
      this.logEl.childNodes[0].remove();
    }

    if (this.scrollLock) {
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
  }

  handleMessage(eventObject) {
    if (eventObject.type === "log") {
      this.appendLog(eventObject.entry.content);
      return;
    }
    if (eventObject.type === "target_latency_secs") {
      this.onTargetLatencyUpdate(eventObject.value);
    }
  }

  setTargetLatency(newLatency) {
    this.latency = newLatency;
    this.player &&
      this.player.updateSettings({
        streaming: {
          delay: {
            liveDelay: this.latency,
          },
        },
      });
  }

  onTargetLatencyChange(newLatency) {
    this.setTargetLatency(newLatency);

    // only local target latency change for now
    // this.socket.send(
    //   JSON.stringify({
    //     type: "target_latency_secs",
    //     stream_id: this.streamId,
    //     value: newLatency,
    //   })
    // );
  }

  onTargetLatencyUpdate(newLatency) {
    console.log("onTargetLatencyUpdate");
    this.setTargetLatency(newLatency);
    this.targetLatencyEl.value = newLatency;
  }

  restartStreamer() {
    this.socket.send(
      JSON.stringify({
        type: "restart",
        stream_id: this.streamId,
      })
    );
    this.enablePlayerResetter();
  }

  cameraControl(command) {
    if (command === "home") {
      this.socket.send(
        JSON.stringify({
          type: "ptz_home",
          stream_id: this.streamId,
        })
      );
      return;
    }

    let x = 0;
    let y = 0;
    let zoom = 0;

    const magnitude = 0.15;

    if (command === "right") {
      x = magnitude;
    }
    if (command === "left") {
      x = -magnitude;
    }
    if (command === "up") {
      y = magnitude;
    }
    if (command === "down") {
      y = -magnitude;
    }

    this.socket.send(
      JSON.stringify({
        type: "ptz_relative",
        stream_id: this.streamId,
        value: {
          x,
          y,
          zoom,
        },
      })
    );
  }

  enableTab(tabId) {
    var btnEnable = null;
    var btnDisable = null;
    var tabEnable = null;
    var tabDisable = null;
    if (tabId === "log") {
      btnEnable = this.switcherBtnLog;
      btnDisable = this.switcherBtnCtrl;
      tabEnable = this.tabLog;
      tabDisable = this.tabCtrl;
    } else {
      btnEnable = this.switcherBtnCtrl;
      btnDisable = this.switcherBtnLog;
      tabEnable = this.tabCtrl;
      tabDisable = this.tabLog;
    }

    btnEnable.classList = ["active"];
    btnDisable.classList = [];
    tabEnable.style = "";
    tabDisable.style = "display: none;";
  }
}
