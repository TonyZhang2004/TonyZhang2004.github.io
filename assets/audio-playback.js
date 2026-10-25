// Media play events do not bubble, so listen during capture.
document.addEventListener("play", (event) => {
  if (!(event.target instanceof HTMLAudioElement)) {
    return;
  }

  for (const audio of document.querySelectorAll("audio")) {
    if (audio !== event.target && !audio.paused) {
      audio.pause();
    }
  }
}, true);
