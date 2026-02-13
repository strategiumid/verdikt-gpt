export class EncryptionService {
    constructor(app) {
        this.app = app;
    }

    get crypto() {
        return this.app.crypto;
    }

    get state() {
        return this.app.encryptionState;
    }

    async setupEncryption() {
        if (!this.crypto.isSupported()) {
            this.app.showNotification('Ваш браузер не поддерживает шифрование', 'warning');
            return false;
        }
        
        const hasEncryptionSetup = localStorage.getItem('verdikt_encryption_setup');
        
        if (!hasEncryptionSetup) {
            setTimeout(() => this.app.showEncryptionSetupWizard(), 2000);
            return false;
        }
        
        if (hasEncryptionSetup === 'enabled') {
            this.state.enabled = true;
            this.state.isLocked = true;
            setTimeout(() => this.app.showLockScreen(), 500);
        }
        
        return this.state.enabled;
    }
}

