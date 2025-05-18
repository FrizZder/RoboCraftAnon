const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => {
            const validChannels = [
                'anonymize-text',
                'anonymize-image',
                'anonymize-document',
                'open-file-dialog',
                'save-file-dialog',
                'read-file',
                'save-file',
                'get-settings',
                'set-settings',
                'select-directory',
                'get-history',
                'set-history',
                'window-minimize',
                'window-maximize',
                'window-unmaximize',
                'window-close',
                'window-is-maximized'
            ];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
            throw new Error(`Invalid channel: ${channel}`);
        },
        window: {
            minimize: () => ipcRenderer.invoke('window-minimize'),
            maximize: () => ipcRenderer.invoke('window-maximize'),
            unmaximize: () => ipcRenderer.invoke('window-unmaximize'),
            close: () => ipcRenderer.invoke('window-close'),
            isMaximized: () => ipcRenderer.invoke('window-is-maximized')
        }
    }
}); 