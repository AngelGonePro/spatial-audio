const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPath: (file) => file.path,
  runFFmpeg: (payload) => ipcRenderer.invoke('run-ffmpeg', payload)
});