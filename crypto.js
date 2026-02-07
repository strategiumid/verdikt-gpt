// crypto.js - Шифрование данных Web Crypto API
class VerdiktCrypto {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.iterations = 100000;
        this.saltLength = 16;
        this.ivLength = 12;
    }

    async deriveKey(password, salt) {
        try {
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            
            const baseKey = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: this.iterations,
                    hash: 'SHA-256'
                },
                baseKey,
                { name: this.algorithm, length: this.keyLength },
                false,
                ['encrypt', 'decrypt']
            );
            
            return key;
        } catch (error) {
            console.error('Error deriving key:', error);
            throw error;
        }
    }

    async encrypt(data, password) {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
            const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
            
            const key = await this.deriveKey(password, salt);
            
            const encryptedContent = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                dataBuffer
            );
            
            const encryptedArray = new Uint8Array(
                salt.byteLength + iv.byteLength + encryptedContent.byteLength
            );
            
            encryptedArray.set(salt, 0);
            encryptedArray.set(iv, salt.byteLength);
            encryptedArray.set(new Uint8Array(encryptedContent), salt.byteLength + iv.byteLength);
            
            return btoa(String.fromCharCode(...encryptedArray));
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    }

    async decrypt(encryptedData, password) {
        try {
            const encryptedBuffer = Uint8Array.from(
                atob(encryptedData),
                c => c.charCodeAt(0)
            );
            
            const salt = encryptedBuffer.slice(0, this.saltLength);
            const iv = encryptedBuffer.slice(this.saltLength, this.saltLength + this.ivLength);
            const encryptedContent = encryptedBuffer.slice(this.saltLength + this.ivLength);
            
            const key = await this.deriveKey(password, salt);
            
            const decryptedContent = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                encryptedContent
            );
            
            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decryptedContent));
        } catch (error) {
            console.error('Decryption error:', error);
            
            if (error.name === 'OperationError') {
                throw new Error('Неверный пароль или поврежденные данные');
            }
            throw error;
        }
    }

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    isSupported() {
        return window.crypto && window.crypto.subtle;
    }

    generateStrongPassword(length = 16) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
        password += '0123456789'[Math.floor(Math.random() * 10)];
        password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
        
        for (let i = 4; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
}

window.VerdiktCrypto = VerdiktCrypto;