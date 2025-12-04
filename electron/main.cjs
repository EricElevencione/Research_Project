const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
    console.log('Creating window...');
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        },
        icon: path.join(__dirname, '../public/favicon.ico'),
        backgroundColor: '#ffffff'
    });

    console.log('Window created');

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load from the dist folder that electron-builder packages
        const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

        // Log to help debug
        mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log('Console:', message);
        });

        mainWindow.webContents.on('did-finish-load', () => {
            console.log('✓ Page finished loading');
            mainWindow.webContents.executeJavaScript('document.getElementById("root") ? "Root div exists" : "Root div NOT found"')
                .then(result => console.log('Root check:', result));
        });

        mainWindow.loadFile(indexPath);
        // Keep DevTools open to see any errors
        mainWindow.webContents.openDevTools();
    } mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Page failed to load:', errorCode, errorDescription);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
