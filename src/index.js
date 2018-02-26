import * as nicovideo from './lib/nicovideo';

const { ipcRenderer } = require('electron');
const form = document.getElementById('form');
const input = document.getElementById('input');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

let comments = [];
let paused = false;
let seeking = null;

function registerComment(json) {
  comments = json
    .map(p => p.chat)
    .filter(Boolean)
    .sort((a, b) => a.vpos - b.vpos);
}

form.addEventListener('submit', e => {
  e.preventDefault();
  if (input.value.trim().length === 0) return;

  video.pause();
  nicovideo
    .fetchNicoVideo(input.value.trim())
    .then(data => {
      video.setAttribute('src', data.url);
      paused = false;
      video.play();
      fetch(
        `${data.ms.url.replace('/api/', '/api.json/')}/thread?thread=${
          data.ms.thread_id
        }&version=20090904&res_from=-1000`
      )
        .then(resp => resp.json())
        .then(json => {
          registerComment(json);
        })
        .catch(e => console.error(e));
    })
    .catch(e => {
      console.error(e);
      alert('動画の読み込みに失敗しました');
    });
});

ipcRenderer.on('pause_or_start', e => {
  if (seeking) clearTimeout(seeking);
  if (paused) {
    video.play();
  } else {
    video.pause();
  }
  paused = !paused;
  ipcRenderer.send('change-play', {
    paused
  });
});

ipcRenderer.on('seek', (e, data) => {
  video.pause();
  video.currentTime = data.position / 100 * video.duration;
  if (paused) return;
  if (seeking) clearTimeout(seeking);
  seeking = setTimeout(() => {
    seeking = null;
    video.play();
  }, 750);
});

setInterval(() => {
  const p = Math.min(
    canvas.width / video.videoWidth,
    canvas.height / video.videoHeight
  );
  const w = video.videoWidth * p;
  const h = video.videoHeight * p;
  const cIndex = comments.findIndex(n => {
    return n.vpos > video.currentTime * 100;
  });

  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    video,
    (canvas.width - w) / 2,
    (canvas.height - h) / 2,
    w,
    h
  );

  ipcRenderer.send('update-video', {
    image: canvas.toDataURL(),
    position: Math.floor(video.currentTime / video.duration * 100),
    comment:
      cIndex === -1 ? comments[comments.length - 1] : comments[cIndex - 1]
  });
}, 16);
