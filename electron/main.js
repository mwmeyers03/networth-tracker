/**
 * Electron main process – loads the React app either from the CRA dev server
 * (when ELECTRON_START_URL is set) or from the production build folder.
 *
 * Usage:
 *   Dev  : npm run electron:dev    (starts CRA dev server + Electron)
 *   Build: npm run electron:build  (builds CRA, then packages to dist/.exe)
 */

const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const isDev = process.env.ELECTRON_START_URL !== undefined ||
  !app.isPackaged;

const OLLAMA_HEALTH_URL = 'http://127.0.0.1:11434/api/tags';
const OLLAMA_STARTUP_WAIT_MS = 30000;

let ollamaStartInFlight = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isOllamaReachable(timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OLLAMA_HEALTH_URL, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildOllamaCommandCandidates() {
  const candidates = [];

  if (process.env.OLLAMA_EXECUTABLE) {
    candidates.push(process.env.OLLAMA_EXECUTABLE);
  }

  candidates.push('ollama');

  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'));
    }
    candidates.push('C:\\Program Files\\Ollama\\ollama.exe');
  }

  return [...new Set(candidates.filter(Boolean))];
}

function spawnOllamaServe(command) {
  const spawnOptions = {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  };

  try {
    const child = command === 'ollama'
      ? spawn(command, ['serve'], { ...spawnOptions, shell: true })
      : spawn(command, ['serve'], spawnOptions);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function ensureOllamaRunning() {
  if (await isOllamaReachable()) {
    return {
      ok: true,
      alreadyRunning: true,
      message: 'Ollama already running.',
    };
  }

  if (ollamaStartInFlight) return ollamaStartInFlight;

  ollamaStartInFlight = (async () => {
    const candidates = buildOllamaCommandCandidates();
    let started = false;
    let usedCommand = null;

    for (const command of candidates) {
      if (command !== 'ollama' && !fs.existsSync(command)) continue;
      if (spawnOllamaServe(command)) {
        started = true;
        usedCommand = command;
        break;
      }
    }

    if (!started) {
      return {
        ok: false,
        alreadyRunning: false,
        started: false,
        message:
          'Ollama executable not found. Install Ollama or set OLLAMA_EXECUTABLE.',
      };
    }

    const deadline = Date.now() + OLLAMA_STARTUP_WAIT_MS;
    while (Date.now() < deadline) {
      await delay(1000);
      if (await isOllamaReachable()) {
        return {
          ok: true,
          alreadyRunning: false,
          started: true,
          command: usedCommand,
          message: 'Ollama started successfully.',
        };
      }
    }

    return {
      ok: false,
      alreadyRunning: false,
      started: true,
      command: usedCommand,
      message: 'Ollama did not become ready in time.',
    };
  })();

  try {
    return await ollamaStartInFlight;
  } finally {
    ollamaStartInFlight = null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#020617', // slate-950 – prevents white flash on load
    title: 'Net Worth Tracker',
    icon: path.join(__dirname, '..', 'public', 'logo512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // webSecurity is left at its default (true) to keep the sandbox intact.
      // Ollama runs on localhost so the same-origin policy does not block it.
      webSecurity: true,
    },
  });

  // ── Load the app ──────────────────────────────────────────────────────────
  if (isDev) {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }

  // Open external links in the system browser, not inside Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── Application menu (minimal – removes the default Electron template) ────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Fire-and-forget startup so AI features work without manual Ollama launch.
  ensureOllamaRunning().catch(() => null);

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('ollama:ensure-running', async () => {
  return ensureOllamaRunning();
});

ipcMain.handle('app:get-install-info', () => {
  return {
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    homePath: os.homedir(),
    platform: process.platform,
  };
});
