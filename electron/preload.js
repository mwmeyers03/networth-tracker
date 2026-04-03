/**
 * Electron preload – runs in an isolated context before the renderer loads.
 * Exposes a small, safe surface via contextBridge so React can detect whether
 * it is running inside Electron without needing nodeIntegration.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** true when the app is running inside Electron, false in a browser */
  isElectron: true,
  /** Electron version string, e.g. "41.1.1" */
  version: process.versions.electron,
});
