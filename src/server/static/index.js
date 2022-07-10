import { StreamSource } from "./StreamSource.js";

const hideAllBtn = document.querySelector(".hide-all");
hideAllBtn.addEventListener("click", (_) => {
  const doHide = hideAllBtn.innerHTML === "-";
  document.querySelectorAll(`.log-and-controls`).forEach((el) => {
    if (doHide) {
      el.classList.add("hidden");
    } else {
      el.classList.remove("hidden");
    }
  });

  hideAllBtn.innerHTML = doHide ? "+" : "-";
});

const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${wsProtocol}://${location.host}/`);

const streamEls = Array.from(document.querySelectorAll(".stream"));
const streamSources = streamEls.map((streamEl) => {
  let streamId = streamEl.getAttribute("id");
  streamId = streamId.substring("stream-".length);
  return new StreamSource(streamId, streamEl, socket);
});
streamSources.forEach((s) => s.start());

let intervalHandle = null;

socket.addEventListener("open", (e) => {
  socket.send(JSON.stringify({ type: "state" }));
  intervalHandle = setInterval(() => {
    socket.send(JSON.stringify({ type: "ping" }));
  }, 5000);
});

socket.addEventListener("close", () => {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
  }
  intervalHandle = null;
});

socket.addEventListener("message", async (event) => {
  const eventText = await event.data.text();
  const eventObject = JSON.parse(eventText);

  if (eventObject.type === "state") {
    eventObject.sourceStates.forEach((s) => {
      const target = streamSources.find((ss) => ss.streamId == s.id);
      s.logMessages
        .map((lm) => lm.content)
        .forEach((lm) => {
          target.appendLog(lm);
        });
    });
    return;
  }

  if (typeof eventObject.id === "string" && eventObject.id.length > 0) {
    const target = streamSources.find((ss) => ss.streamId == eventObject.id);
    target.handleMessage(eventObject);
    return;
  }

  console.warn("unknown message websocket received");
});
