export class ChatStore {
    
    constructor(app) {
        this.app = app;
    }

    get chatManager() {
        return this.app.chatManager;
    }

    get state() {
        return this.app.state;
    }

    get elements() {
        return this.app.elements;
    }

    // Загрузка/сохранение

    async saveChats() {
        try {
            await this.saveCurrentChat();

            if (this.app.encryptionState.enabled && !this.app.encryptionState.isLocked) {
                await this.saveEncryptedChats();
            } else {
                localStorage.setItem('verdikt_chats', JSON.stringify(this.chatManager.chats));
            }

            if (this.chatManager.currentChatId) {
                localStorage.setItem('verdikt_last_active_chat', this.chatManager.currentChatId);
            }

            this.app.updateSettingsStats();
        } catch (error) {
            console.error('Error saving chats:', error);
        }
    }

    async saveEncryptedChats() {
        try {
            const encryptedData = localStorage.getItem('verdikt_encrypted_data');
            let decryptedData = {};
            
            if (encryptedData) {
                decryptedData = await this.app.crypto.decrypt(encryptedData, this.app.encryptionState.password);
            }
            decryptedData.chats = this.chatManager.chats;
            decryptedData.settings = { ...(decryptedData.settings || {}), theme: this.state.currentTheme };

            const reencryptedData = await this.app.crypto.encrypt(
                decryptedData, 
                this.app.encryptionState.password
            );
            
            localStorage.setItem('verdikt_encrypted_data', reencryptedData);
            
        } catch (error) {
            console.error('Error saving encrypted chats:', error);
            throw error;
        }
    }

    async saveCurrentChat() {
        if (!this.chatManager.currentChatId) return;
        
        const chatData = {
            id: this.chatManager.currentChatId,
            title: this.app.generateChatTitle(),
            messages: this.state.conversationHistory.filter(msg => msg.role !== 'system'),
            timestamp: Date.now(),
            mode: this.state.currentMode,
            stats: {
                totalMessages: this.state.stats.totalMessages,
                userMessages: this.state.stats.userMessages,
                aiMessages: this.state.stats.aiMessages,
                savedChats: this.state.stats.savedChats
            },
            theme: this.state.currentTheme
        };
        
        const existingIndex = this.chatManager.chats.findIndex(chat => chat.id === chatData.id);
        
        if (existingIndex >= 0) {
            this.chatManager.chats[existingIndex] = chatData;
        } else {
            this.chatManager.chats.push(chatData);
            
            if (this.chatManager.chats.length > this.chatManager.maxChats) {
                this.chatManager.chats = this.chatManager.chats.slice(-this.chatManager.maxChats);
            }
            
            if (this.chatManager.chats.length >= 5 && !this.state.achievements.chatHistorian.unlocked) {
                this.app.unlockAchievement('chatHistorian');
            }
        }
    }

    // Операции с чатами

    async createNewChat() {
        const newChatId = 'chat-' + this.chatManager.nextChatId++;
        this.chatManager.currentChatId = newChatId;

        // Сброс состояния диалога и статистики
        this.state.conversationHistory = [this.app.createSystemPromptMessage()];
        this.state.messageCount = 1;
        this.state.stats.totalMessages = 1;
        this.state.stats.userMessages = 0;
        this.state.stats.aiMessages = 1;
        this.state.retryCount = 0;

        // Стартовое сообщение
        this.elements.chatMessages.innerHTML = `
            <div class="message ai-message" style="opacity: 1; transform: translateY(0);">
                <div class="message-actions">
                    <button class="message-action" onclick="window.verdiktApp.copyMessage('msg-initial')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="message-action" onclick="window.verdiktApp.speakMessage('msg-initial')">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
                <div class="message-sender"><i class="fas fa-heart"></i> Эксперт по отношениям</div>
                <div class="message-content">Новый чат начат! Я готов помочь с вопросами об отношениях, знакомствах и манипуляциях. Расскажите, что вас беспокоит? 💕</div>
                <div class="message-feedback">
                    <button class="feedback-btn feedback-good" onclick="window.verdiktApp.rateMessage('msg-initial', 1)">👍 Полезно</button>
                    <button class="feedback-btn feedback-bad" onclick="window.verdiktApp.rateMessage('msg-initial', -1)">👎 Не полезно</button>
                </div>
                <div class="message-time">${this.app.getCurrentTime()}</div>
            </div>
        `;

        await this.saveChats();

        this.app.showNotification('Новый чат создан 💬', 'success');
        this.app.updateUI();
        this.app.updateSettingsStats();
    }

    async loadChat(chatId) {
        const chat = this.chatManager.chats.find(c => c.id === chatId);
        
        if (!chat) {
            this.app.showNotification('Чат не найден', 'error');
            return;
        }
        
        this.chatManager.currentChatId = chatId;
        
        this.state.conversationHistory = [
            this.app.createSystemPromptMessage(),
            ...chat.messages
        ];
        
        if (chat.stats) {
            Object.assign(this.state.stats, chat.stats);
        }
        
        this.state.messageCount = chat.messages.length + 1;
        
        if (chat.mode) {
            this.app.setAIMode(chat.mode);
        }
        
        if (chat.theme) {
            this.app.setTheme(chat.theme);
        }
        
        this.elements.chatMessages.innerHTML = '';
        
        chat.messages.forEach((msg, index) => {
            const messageId = `msg-${chatId}-${index}`;
            const messageElement = document.createElement('div');
            messageElement.className = `message ${msg.role === 'user' ? 'user' : 'ai'}-message`;
            messageElement.id = messageId;
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
            
            const sender = msg.role === 'user' ? 'Вы' : 'Эксперт по отношениям';
            const icon = msg.role === 'user' ? 'user' : 'heart';
            
            messageElement.innerHTML = `
                <div class="message-actions">
                    <button class="message-action" onclick="window.verdiktApp.copyMessage('${messageId}')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="message-action" onclick="window.verdiktApp.speakMessage('${messageId}')">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
                <div class="message-sender"><i class="fas fa-${icon}"></i> ${sender}</div>
                <div class="message-content">${msg.content}</div>
                ${msg.role !== 'user' ? `
                <div class="message-feedback">
                    <button class="feedback-btn feedback-good" onclick="window.verdiktApp.rateMessage('${messageId}', 1)">👍 Полезно</button>
                    <button class="feedback-btn feedback-bad" onclick="window.verdiktApp.rateMessage('${messageId}', -1)">👎 Не полезно</button>
                </div>
                ` : ''}
                <div class="message-time">${this.app.getCurrentTime()}</div>
            `;
            
            this.elements.chatMessages.appendChild(messageElement);
        });
        
        this.app.showNotification(`Загружен чат: ${chat.title}`, 'success');
        this.app.scrollToBottom();
        this.app.updateUI();
        this.app.updateSettingsStats();
    }

    async deleteChat(chatId) {
        if (this.chatManager.chats.length <= 1) {
            this.app.showNotification('Нельзя удалить последний чат', 'warning');
            return;
        }
        
        const chat = this.chatManager.chats.find(c => c.id === chatId);
        if (!chat) return;
        
        if (confirm(`Удалить чат "${chat.title}"?`)) {
            const index = this.chatManager.chats.findIndex(c => c.id === chatId);
            
            if (index >= 0) {
                this.chatManager.chats.splice(index, 1);
                
                if (chatId === this.chatManager.currentChatId) {
                    if (this.chatManager.chats.length > 0) {
                        await this.loadChat(this.chatManager.chats[0].id);
                    } else {
                        await this.createNewChat();
                    }
                }
                
                await this.saveChats();
                this.state.stats.totalChats = this.chatManager.chats.length;
                this.app.updateSettingsStats();
                this.app.showNotification('Чат удален 🗑️', 'info');
            }
        }
    }

    async clearAllChats() {
        if (this.chatManager.chats.length === 0) {
            return;
        }
        
        if (confirm('Вы уверены, что хотите удалить ВСЕ чаты? Это действие нельзя отменить.')) {
            this.chatManager.chats = [];
            await this.createNewChat();
            
            this.state.stats.totalChats = 1;
            this.app.updateSettingsStats();
            this.app.showNotification('Все чаты удалены 🗑️', 'info');
        }
    }
}

