const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

const store = new Store();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile('index.html');
  
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

function logToFile(msg) {
  const logPath = path.join(__dirname, 'anonymizer.log');
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
}

ipcMain.handle('anonymize-text', async (event, text) => {
  logToFile(`Запрос: ${JSON.stringify(text)}`);
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['-X', 'utf8', 'python/anonymizer.py']);
    let result = '';
    let error = '';
    let started = false;
    py.stdout.on('data', (data) => {
      const str = data.toString();
      logToFile(`STDOUT: ${JSON.stringify(str)}`);
      if (started) {
        result += str;
      } else if (str.includes('Результат:')) {
        started = true;
        const after = str.split('Результат:')[1];
        if (after !== undefined) result += after;
      }
    });
    py.stderr.on('data', (data) => {
      error += data.toString();
    });
    py.on('close', (code) => {
      logToFile(`Ответ: ${result.trim()}`);
      if (error) logToFile(`Ошибка: ${error}`);
      if (code === 0 && result.trim()) {
        resolve({ success: true, result: result.trim() });
      } else {
        resolve({ success: false, result: error || 'Python error or empty result' });
      }
    });
    py.stdin.write(text + '\n');
    py.stdin.end();
  });
});

ipcMain.handle('anonymize-image', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return { success: false, error: 'Unsupported file format. Please use JPG or PNG.' };
    }

    return new Promise((resolve, reject) => {
      const py = spawn('python', ['-X', 'utf8', 'python/PyTesseract.py']);
      let result = '';
      let error = '';

      py.stdout.on('data', (data) => {
        result += data.toString();
      });

      py.stderr.on('data', (data) => {
        error += data.toString();
        console.error('Python error:', data.toString());
      });

      py.on('close', (code) => {
        if (code === 0 && result) {
          try {
            const processedResult = JSON.parse(result);
            resolve(processedResult);
          } catch (e) {
            console.error('Failed to parse Python output:', e);
            resolve({ success: false, error: 'Failed to parse Python output' });
          }
        } else {
          console.error('Python process failed:', error);
          resolve({ success: false, error: error || 'Python process failed' });
        }
      });

      py.stdin.write(JSON.stringify({ imagePath: filePath }) + '\n');
      py.stdin.end();
    });
  } catch (error) {
    console.error('Error in anonymize-image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('anonymize-document', async (event, documentPath) => {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['-X', 'utf8', 'python/DocumentAnonymizer.py']);
    let result = '';
    let error = '';

    py.stdout.on('data', (data) => {
      result += data.toString();
    });
    py.stderr.on('data', (data) => {
      error += data.toString();
    });
    py.on('close', async (code) => {
      if (code === 0 && result) {
        try {
          const processed = JSON.parse(result);
          if (processed.success && processed.data && processed.ext) {
            const tempFilePath = path.join(os.tmpdir(), `anon_${Date.now()}${processed.ext}`);
            const buffer = Buffer.from(processed.data, 'base64');
            await fs.promises.writeFile(tempFilePath, buffer);
            resolve({ success: true, result: { path: tempFilePath } });
          } else {
            resolve({ success: false, error: processed.error || 'No data from Python' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse Python output' });
        }
      } else {
        resolve({ success: false, error: error || 'Python process failed' });
      }
    });
    py.stdin.write(JSON.stringify({ documentPath }) + '\n');
    py.stdin.end();
  });
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
      { name: 'Text', extensions: ['txt'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('save-file-dialog', async (event, { defaultPath, filters }) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePath;
  }
  return null;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return {
      success: true,
      data: buffer.toString('base64'),
      mimeType: getMimeType(filePath)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('save-file', async (event, { filePath, data }) => {
  try {
    const buffer = Buffer.from(data, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

ipcMain.handle('get-settings', async () => {
  return store.get('settings', {
    outputDir: '',
    language: 'ru',
    theme: 'dark'
  });
});

ipcMain.handle('set-settings', async (event, settings) => {
  store.set('settings', settings);
  return { success: true };
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return '';
});

ipcMain.handle('get-history', async () => {
  return store.get('history', []);
});

ipcMain.handle('set-history', async (event, history) => {
  store.set('history', history);
  return { success: true };
});

ipcMain.handle('window-minimize', (event) => {
  BrowserWindow.getFocusedWindow().minimize();
});

ipcMain.handle('window-maximize', (event) => {
  BrowserWindow.getFocusedWindow().maximize();
});

ipcMain.handle('window-unmaximize', (event) => {
  BrowserWindow.getFocusedWindow().unmaximize();
});

ipcMain.handle('window-close', (event) => {
  BrowserWindow.getFocusedWindow().close();
});

ipcMain.handle('window-is-maximized', (event) => {
  return BrowserWindow.getFocusedWindow().isMaximized();
}); 