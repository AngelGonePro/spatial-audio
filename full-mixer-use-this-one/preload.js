const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPath: (file) => file.path,
  runFFmpeg: (payload) => ipcRenderer.invoke('run-ffmpeg', payload),
  runFFmpegWithProgress: (payload) => ipcRenderer.invoke('run-ffmpeg-with-progress', payload),
  onFFmpegProgress: (callback) => ipcRenderer.on('ffmpeg-progress', (event, data) => callback(data)),
  getChannelCount: (payload) => ipcRenderer.invoke('get-channel-count', payload),
  getDuration: (payload) => ipcRenderer.invoke('get-duration', payload)
});
