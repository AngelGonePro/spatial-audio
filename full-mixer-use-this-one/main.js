const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
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

// Windows' spawn() has a real, fairly low effective command-line length
// limit — ENAMETOOLONG shows up well before any file NAME is actually too
// long, because the whole argument list has to fit in one command line.
// Two things in this app can produce arguments long enough to trip it:
//   1. -filter_complex — some directions (Stereo->7.1 upmix especially)
//      generate long filter graphs (~1-2K characters).
//   2. -metadata:s:a:0 METADATA_BLOCK_PICTURE=<base64> — cover art embedding
//      for Opus/Vorbis. This is the bigger risk by far: a typical album
//      art JPEG becomes a base64 string in the hundreds of KB to low-MB
//      range as a single argument — over 1000x longer than the filter
//      graph case above.
// Both get routed through temp files instead of the command line. Verified
// byte-for-byte identical output vs the direct-argument method for both.
function routeArgsThroughTempFiles(rawArgs) {
  const args = rawArgs.slice();
  const tempPaths = [];

  // -filter_complex -> -filter_complex_script <tempfile>
  const fcIndex = args.indexOf('-filter_complex');
  if (fcIndex !== -1 && args[fcIndex + 1] !== undefined) {
    const filterContent = args[fcIndex + 1];
    const tempFilterPath = path.join(
      os.tmpdir(),
      `ffmpeg-filter-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    );
    fs.writeFileSync(tempFilterPath, filterContent, 'utf8');
    args[fcIndex] = '-filter_complex_script';
    args[fcIndex + 1] = tempFilterPath;
    tempPaths.push(tempFilterPath);
  }

  // -metadata:s:a:0 KEY=VALUE -> extra ffmetadata input + precise stream mapping.
  // Scans all -metadata* flags (not just :s:a:0) so this stays correct if
  // the stream index or track selector ever changes.
  const extraInputs = [];  // { flagIndexToRemove, valueIndexToRemove, inputArgs, mapMetadataArgs }
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string' && args[i].startsWith('-metadata') && args[i + 1] !== undefined) {
      const value = args[i + 1];
      // Only bother routing this through a file if it's actually long enough
      // to matter — no reason to add complexity for short tags like artist/title.
      if (value.length > 4000) {
        const streamSpec = args[i].includes(':') ? args[i].slice('-metadata'.length) : ''; // e.g. ':s:a:0'
        const tempMetaPath = path.join(
          os.tmpdir(),
          `ffmpeg-meta-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
        );
        fs.writeFileSync(tempMetaPath, `;FFMETADATA1\n[STREAM]\n${value}\n`, 'utf8');
        tempPaths.push(tempMetaPath);

        extraInputs.push({
          removeFrom: i,
          removeCount: 2,
          insertInputArgs: ['-i', tempMetaPath],
          // streamSpec is like ':s:a:0' — reuse it so this stays correct
          // even if the target stream index isn't always a:0.
          mapMetadataFlag: `-map_metadata${streamSpec}`
        });
      }
    }
  }

  // Apply removals back-to-front so earlier indices don't shift.
  let finalArgs = args.slice();
  for (const ei of extraInputs.reverse()) {
    finalArgs.splice(ei.removeFrom, ei.removeCount);
  }

  // Insert each temp metadata file as an additional -i input right after
  // the primary -i, and add the matching -map_metadata:s:a:N pointing at
  // its [STREAM] section (input index N = its position among all inputs).
  if (extraInputs.length > 0) {
    const firstIIndex = finalArgs.indexOf('-i');
    let insertAt = firstIIndex !== -1 ? firstIIndex + 2 : 0;
    let nextInputIndex = 1; // input 0 is the primary source
    for (const ei of extraInputs.reverse()) {
      finalArgs.splice(insertAt, 0, ...ei.insertInputArgs);
      insertAt += ei.insertInputArgs.length;
      finalArgs.splice(insertAt, 0, ei.mapMetadataFlag, `${nextInputIndex}:s:0`);
      insertAt += 2;
      nextInputIndex++;
    }
  }

  return { args: finalArgs, tempPaths };
}

// Detects the actual channel count of a loaded file via ffprobe, so the
// UI can warn/auto-correct when the selected Input Channel Layout doesn't
// match reality. This directly prevents a real, confirmed failure mode:
// selecting "7.1" for a genuinely 5.1 file silently routes through the
// wrong downmix coefficients (the 7.1-specific back-channel coefficient,
// correct only when real side+back surrounds both exist, gets misapplied
// to a 5.1 file's only surround pair) — channel routing itself isn't
// broken, but content gets measurably under-preserved as a result.
ipcMain.handle('get-channel-count', async (event, payload) => {
  return new Promise((resolve) => {
    const ffmpegPath = payload.ffmpeg;
    const filePath = payload.filePath;
    // ffprobe ships alongside ffmpeg in the same bin directory in every
    // standard distribution (gyan.dev, BtbN, etc.) — derive its path rather
    // than requiring a second manually-configured field.
    const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/i, (m, ext) => 'ffprobe' + (ext || ''));

    const args = ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', filePath];
    let proc;
    try {
      proc = spawn(ffprobePath, args, { windowsHide: true });
    } catch (err) {
      resolve({ error: String(err && err.message || err) });
      return;
    }
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => stdout += d.toString());
    proc.stderr.on("data", d => stderr += d.toString());
    proc.on("close", code => {
      if (code !== 0) {
        resolve({ error: stderr || `ffprobe exited with code ${code}` });
        return;
      }
      const channels = parseInt(stdout.trim(), 10);
      resolve({ channels: Number.isNaN(channels) ? null : channels });
    });
    proc.on("error", err => {
      resolve({ error: err.message });
    });
  });
});

ipcMain.handle('run-ffmpeg', async (event, payload) => {
  return new Promise((resolve) => {

    const ffmpeg = payload.ffmpeg;
    const { args, tempPaths } = routeArgsThroughTempFiles(payload.args);

    console.log("\n===== FFMPEG START =====\n");
    console.log(ffmpeg);
    console.log(args);
    console.log("\n========================\n");

    const cleanup = () => {
      for (const p of tempPaths) fs.unlink(p, () => {});
    };

    let proc;
    try {
      proc = spawn(ffmpeg, args, { windowsHide: true });
    } catch (err) {
      cleanup();
      resolve({ code: -1, stdout: "", stderr: String(err && err.message || err) });
      return;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => stdout += d.toString());
    proc.stderr.on("data", d => stderr += d.toString());

    proc.on("close", code => {
      cleanup();
      resolve({ code, stdout, stderr });
    });

    proc.on("error", err => {
      cleanup();
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
});

app.whenReady().then(createWindow);
