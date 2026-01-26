const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    // Add any APIs you want to expose to the renderer process here
    platform: process.platform,

    // Printing APIs
    print: (options) => ipcRenderer.invoke('print', options),
    printToPDF: (options) => ipcRenderer.invoke('print-to-pdf', options),
    printContent: (htmlContent, options) => ipcRenderer.invoke('print-content', htmlContent, options)
});
