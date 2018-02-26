const {
  app,
  BrowserWindow,
  Menu,
  TouchBar,
  nativeImage,
  ipcMain
} = require('electron');
const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
const path = require('path');
const url = require('url');

let win;

function initMenu() {
  const template = [
    {
      label: 'Application',
      submenu: [
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          selector: 'selectAll:'
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  function initTouchBar(options = {}) {
    const touchBar = new TouchBar({
      items: [options.paused ? volumeBar : commentArea],
      escapeItem: videoButton
    });
    win.setTouchBar(touchBar);
  }

  let seeking = false;

  const videoButton = new TouchBarButton({
    iconPosition: 'center',
    click: () => {
      win.webContents.send('pause_or_start');
      initTouchBar({ paused: false });
    }
  });

  const commentArea = new TouchBar.TouchBarLabel({
    label: '再生したい動画を選択してください'
  });

  const volumeBar = new TouchBar.TouchBarSlider({
    value: 0,
    minValue: 0,
    maxValue: 100,
    change: n => {
      win.webContents.send('seek', {
        position: n
      });
    }
  });

  ipcMain.on('change-play', (e, data) => {
    if (data.paused) {
      initTouchBar({ paused: true });
    } else {
      initTouchBar({ paused: false });
    }
  });

  ipcMain.on('update-video', (e, data) => {
    videoButton.icon = nativeImage.createFromDataURL(data.image);
    volumeBar.value = data.position;
    if (data.comment) {
      commentArea.label = data.comment.content;
    } else {
      commentArea.label = '';
    }
  });

  win = new BrowserWindow({ width: 320, height: 320 });

  win.loadURL(
    url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    })
  );
  initTouchBar({ paused: false });
  initMenu();

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  win.on('closed', () => {
    win = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
