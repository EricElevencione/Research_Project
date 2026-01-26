const { app, BrowserWindow, ipcMain } = require('electron');
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

// IPC Handlers for Printing

// Print the current window with print dialog (preview)
ipcMain.handle('print', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Window not found' };

    return new Promise((resolve) => {
        win.webContents.print(
            {
                silent: false, // Show print dialog with preview
                printBackground: true,
                ...options
            },
            (success, failureReason) => {
                resolve({ success, error: failureReason });
            }
        );
    });
});

// Generate PDF from current window
ipcMain.handle('print-to-pdf', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Window not found' };

    try {
        const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            ...options
        });
        return { success: true, data: pdfData.toString('base64') };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Print HTML content in a new window with print preview
ipcMain.handle('print-content', async (event, htmlContent, options = {}) => {
    return new Promise((resolve) => {
        // Create a visible window for print preview
        const printWindow = new BrowserWindow({
            width: 900,
            height: 700,
            show: true,
            title: 'Print Preview - Active Farmers List',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // Remove menu bar for cleaner look
        printWindow.setMenuBarVisibility(false);

        // Load the HTML content
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        // The window now has its own Print/Close buttons in the toolbar
        // User can preview the document and click Print when ready

        printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            if (printWindow && !printWindow.isDestroyed()) {
                printWindow.close();
            }
            resolve({ success: false, error: errorDescription });
        });

        // Handle window being closed by user (via Close button or X)
        printWindow.on('closed', () => {
            resolve({ success: true, error: null });
        });
    });
});
