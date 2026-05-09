const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile('index.html');
  win.webContents.openDevTools();
}

ipcMain.handle('run-ffmpeg', async (event, payload) => {
  return new Promise((resolve) => {

    const ffmpeg = payload.ffmpeg;
    const args = payload.args;

    console.log("\n===== FFMPEG START =====\n");
    console.log(ffmpeg);
    console.log(args);
    console.log("\n========================\n");

    const proc = spawn(ffmpeg, args, {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => stdout += d.toString());
    proc.stderr.on("data", d => stderr += d.toString());

    proc.on("close", code => {
      resolve({ code, stdout, stderr });
    });
  });
});

app.whenReady().then(createWindow);