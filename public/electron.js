// electron.js
import { app, BrowserWindow, ipcMain, desktopCapturer, dialog } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Readable, Writable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';
import psList from 'ps-list';
import pkg from 'audify';
import { activeWindow } from 'active-win';
import fs from 'fs';
const { RtAudio, RtAudioApi, RtAudioFormat } = pkg;

console.log("ELECTRON DETECTED");

ffmpeg.setFfmpegPath(ffmpegPath.path);

let mainWindow = null;
let rtAudio = null;
let isCapturing = false;
let ffmpegProcess = null;
let audioInputStream = null;

// App tracking variables
let isTracking = false;
let trackingInterval = null;
let appUsageData = {};
let browserUsageData = {};

// List of common browser process names
const browserNames = ['Google Chrome', 'Firefox', 'Microsoft Edge', 'Safari', 'Opera', 'Brave'];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
    });

    mainWindow.loadURL(
      isDev
        ? 'http://localhost:3000'
        : `file://${path.join(__dirname, '../build/index.html')}`
    );

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    setupIpcHandlers();
  } catch (error) {
    console.error('Error creating window:', error);
    app.quit();
  }
}

function setupIpcHandlers() {
  ipcMain.handle('get-audio-devices', async () => {
    try {
      if (!rtAudio) {
        rtAudio = new RtAudio(RtAudioApi.WINDOWS_WASAPI);
      }
      const devices = rtAudio.getDevices();
      return devices.map(device => ({
        name: device.name,
        id: device.id,
        isDefault: device.isDefault,
        sampleRates: device.sampleRates,
        inputChannels: device.inputChannels,
        outputChannels: device.outputChannels,
        isInput: device.inputChannels > 0,
        isOutput: device.outputChannels > 0
      }));
    } catch (error) {
      console.error('Error getting audio devices:', error);
      throw error;
    }
  });

  ipcMain.on('start-audio-capture', (event, { deviceId }) => {
    if (isCapturing) {
      console.log('Already capturing audio');
      return;
    }

    try {
      if (!rtAudio) {
        rtAudio = new RtAudio(RtAudioApi.WINDOWS_WASAPI);
      }

      const device = rtAudio.getDevices().find(d => d.id === parseInt(deviceId));
      if (!device) {
        throw new Error('Device not found');
      }

      const sampleRate = 22050;
      const channels = device.outputChannels;
      const frameSize = 1920;

      audioInputStream = new Readable({ read() { } });

      ffmpegProcess = ffmpeg(audioInputStream)
        .inputFormat('s16le')
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          mainWindow.webContents.send('audio-capture-error', err.message);
          stopAudioCapture();
        })
        .on('end', () => {
          console.log('FFmpeg processing finished');
        });

      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          mainWindow.webContents.send('audio-data', chunk);
          callback();
        }
      });

      ffmpegProcess.pipe(outputStream);

      rtAudio.openStream(
        null,
        {
          deviceId: device.id,
          nChannels: channels,
          firstChannel: 0
        },
        RtAudioFormat.RTAUDIO_SINT16,
        sampleRate,
        frameSize,
        'MyStream',
        (pcm) => {
          audioInputStream.push(Buffer.from(pcm.buffer));
        }
      );

      rtAudio.start();
      isCapturing = true;
      mainWindow.webContents.send('audio-capture-started', { sampleRate, channels, frameSize });
    } catch (error) {
      console.error('Error starting audio capture:', error);
      mainWindow.webContents.send('audio-capture-error', error.message);
      stopAudioCapture();
    }
  });

  ipcMain.on('stop-audio-capture', stopAudioCapture);

  ipcMain.handle('get-running-apps', async () => {
    try {
      const processes = await psList();
      return processes.map(process => ({
        name: process.name,
        pid: process.pid
      }));
    } catch (error) {
      console.error('Error getting running apps:', error);
      return [];
    }
  });

  ipcMain.on('start-app-tracking', () => {
    console.log('App tracking started');
    startAppTracking();
  });

  ipcMain.on('stop-app-tracking', () => {
    console.log('App tracking stopped');
    stopAppTracking();
  });

  ipcMain.handle('get-app-usage', () => {
    return appUsageData;
  });

  ipcMain.handle('get-browser-usage', () => {
    return browserUsageData;
  });

  ipcMain.on('start-browser-tracking', () => {
    console.log('Browser tracking started');
    startAppTracking();
  });

  ipcMain.on('stop-browser-tracking', () => {
    console.log('Browser tracking stopped');
    stopAppTracking();
  });

  // FOR ScreenCapture.jsx
  ipcMain.handle('get-sources', async () => {
    return await desktopCapturer.getSources({ types: ['window', 'screen'] });
  });

  ipcMain.handle('show-source-selection', async (event, sources) => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: sources.map(source => source.name),
      message: 'Select the screen you want to capture'
    });
    return sources[result.response];
  });

  ipcMain.handle('save-file-dialog', async (event, defaultPath) => {
    const result = await dialog.showSaveDialog({
      buttonLabel: 'Save video',
      defaultPath: defaultPath
    });
    return result.filePath;
  });

  ipcMain.handle('save-file', async (event, filePath, buffer) => {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, Buffer.from(buffer), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  ipcMain.handle('capture-all-screens', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });

      // Capture and return base64 screenshots
      const screenshots = sources.map(source => source.thumbnail.toDataURL());
      return screenshots;
    } catch (error) {
      console.error('Error capturing screens:', error);
      throw error;
    }
  });
}


function stopAudioCapture() {
  try {
    if (rtAudio && isCapturing) {
      rtAudio.stop();
      rtAudio.closeStream();
      isCapturing = false;

      if (audioInputStream) {
        audioInputStream.push(null);
        audioInputStream = null;
      }

      if (ffmpegProcess) {
        ffmpegProcess.on('end', () => {
          console.log('FFmpeg process ended');
          ffmpegProcess = null;
          mainWindow.webContents.send('audio-capture-stopped');
        });

        ffmpegProcess.on('error', (err) => {
          // console.error('Error ending FFmpeg process:', err);
          ffmpegProcess = null;
          mainWindow.webContents.send('audio-capture-error', err.message);
        });

        ffmpegProcess.kill('SIGTERM');
      } else {
        mainWindow.webContents.send('audio-capture-stopped');
      }
      mainWindow.webContents.send('audio-capture-stopped');
    }
  } catch (error) {
    console.error('Error stopping audio capture:', error);
    mainWindow.webContents.send('audio-capture-error', error.message);
  }
}

async function getActiveWindow() {
  try {
    const activeWdw = await activeWindow();
    if (activeWdw) {
      const isBrowser = browserNames.some(browserName =>
        activeWdw.owner.name.toLowerCase().includes(browserName.toLowerCase())
      );

      return {
        name: activeWdw.owner.name,
        title: activeWdw.title,
        isBrowser: isBrowser
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting active window:', error);
    return null;
  }
}

function updateAppUsage(app) {
  if (app) {
    if (app.isBrowser) {
      browserUsageData[app.title] = (browserUsageData[app.title] || 0) + 1;
    } else {
      appUsageData[app.name] = (appUsageData[app.name] || 0) + 1;
    }
    if (mainWindow) {
      mainWindow.webContents.send('active-app-update', app);
    }
  }
}

function startAppTracking() {
  if (isTracking) return;

  isTracking = true;
  trackingInterval = setInterval(async () => {
    try {
      const activeApp = await getActiveWindow();
      updateAppUsage(activeApp);
      if (mainWindow) {
        mainWindow.webContents.send('app-usage-update', appUsageData);
        mainWindow.webContents.send('browser-usage-update', browserUsageData);
      }
    } catch (error) {
      console.error('Error in app tracking interval:', error);
    }
  }, 1000);
}

function stopAppTracking() {
  if (!isTracking) return;

  isTracking = false;
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

function cleanup() {
  try {
    stopAudioCapture();
    stopAppTracking();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

app.on('before-quit', cleanup);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((error) => {
  console.error('Error in app.whenReady():', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  app.quit();
});