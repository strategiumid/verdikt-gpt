// main.js - Полная версия с системой истории чатов
document.addEventListener('DOMContentLoaded', function() {
    hljs.highlightAll();
    
    window.verdiktApp = new VerdiktChatApp();
    window.verdiktApp.init();
});

// Основной класс приложения
class VerdiktChatApp {
    constructor() {
        this.API_CONFIG = {
            url: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
            apiKey: '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',
            maxTokens: 400,
            temperature: 0.7
        };

        this.state = {
            conversationHistory: [
                {
                    role: "system",
                    content: `Ты - Verdikt GPT, эксперт по психологии отношений, знакомств и манипуляций.
Отвечай на русском языке дружелюбно, но профессионально.
Специализация:
💕 Отношения - конфликты, общение, восстановление
👥 Знакомства - советы по свиданиям, профилям
🛡️ Манипуляции - распознавание, защита, границы

Будь поддерживающим, давай практические советы, используй эмодзи умеренно.`
                }
            ],
            currentMode: 'balanced',
            aiModes: {
                creative: { name: "Эмоциональный", temperature: 0.8, description: "Учет чувств и эмоций" },
                precise: { name: "Аналитический", temperature: 0.3, description: "Детальный разбор ситуации" },
                balanced: { name: "Сбалансированный", temperature: 0.7, description: "Объективный анализ" },
                protective: { name: "Защитный", temperature: 0.5, description: "Распознавание манипуляций" }
            },
            messageCount: 1,
            responseTimes: [],
            isApiConnected: false,
            isRecording: false,
            isSpeaking: false,
            isModelLoading: false,
            achievements: {
                firstMessage: { unlocked: true, name: "Первый шаг", icon: "🎯", description: "Первая консультация" },
                activeUser: { unlocked: false, name: "Доверие", icon: "💬", description: "10 личных вопросов" },
                manipulationExpert: { unlocked: false, name: "Защитник", icon: "🛡️", description: "Распознал 5 манипуляций" },
                relationshipHelper: { unlocked: false, name: "Романтик", icon: "💕", description: "Помог в отношениях" },
                nightOwl: { unlocked: false, name: "Сова", icon: "🦉", description: "Общались ночью" },
                exporter: { unlocked: false, name: "Архивариус", icon: "📥", description: "Экспортировали чат" },
                presenter: { unlocked: false, name: "Презентатор", icon: "📊", description: "Использовали режим презентации" },
                chatHistorian: { unlocked: false, name: "Историк", icon: "📚", description: "Создали 5 чатов" }
            },
            stats: {
                totalMessages: 1,
                userMessages: 0,
                aiMessages: 1,
                savedChats: 0,
                sessions: 1,
                manipulationRequests: 0,
                relationshipAdvice: 0,
                datingAdvice: 0,
                activityByHour: new Array(24).fill(0),
                popularTopics: {},
                totalChats: 1
            },
            currentTheme: 'dark',
            isPresentationMode: false,
            currentSlide: 0,
            slides: [],
            retryCount: 0,
            maxRetries: 3
        };

        this.crypto = new VerdiktCrypto();
        
        this.encryptionState = {
            enabled: false,
            password: null,
            passwordHash: null,
            isLocked: true,
            autoLockTimeout: 15 * 60 * 1000,
            lockTimer: null
        };

        // Система управления чатами
        this.chatManager = {
            chats: [],
            currentChatId: null,
            maxChats: 100,
            nextChatId: 1,
            autoSave: true,
            autoSaveInterval: 30000,
            autoSaveTimer: null
        };

        this.elements = {
            // Основные элементы
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            voiceInput: document.getElementById('voice-input'),
            voiceOutput: document.getElementById('voice-output'),
            newChat: document.getElementById('new-chat'),
            settingsButton: document.getElementById('settings-button'),
            presentationMode: document.getElementById('presentation-mode'),
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notification-text'),
            apiStatus: document.getElementById('api-status'),
            smartSuggestions: document.getElementById('smart-suggestions'),
            typingIndicator: document.getElementById('typing-indicator'),
            achievementNotification: document.getElementById('achievement-notification'),
            
            // Навигация
            prevSlide: document.getElementById('prev-slide'),
            nextSlide: document.getElementById('next-slide'),
            exitPresentation: document.getElementById('exit-presentation'),
            
            // Модальные окна
            settingsClose: document.getElementById('settings-close'),
            exportClose: document.getElementById('export-close'),
            exportCancel: document.getElementById('export-cancel'),
            statsClose: document.getElementById('stats-close'),
            saveSettings: document.getElementById('save-settings'),
            temperatureSlider: document.getElementById('temperature-slider'),
            temperatureValue: document.getElementById('temperature-value'),
            
            // История чатов
            toggleChatHistory: document.getElementById('toggle-chat-history'),
            importChatBtn: null,
            exportChatBtn: null,
            clearChatsBtn: null,
            
            // Импорт/экспорт
            importModal: document.getElementById('import-modal'),
            importFileInput: document.getElementById('import-file-input'),
            importDropzone: document.getElementById('import-dropzone'),
            importPreview: document.getElementById('import-preview'),
            importPreviewContent: document.getElementById('import-preview-content'),
            importConfirm: document.getElementById('import-confirm'),
            importCancel: document.getElementById('import-cancel'),
            importModalClose: document.getElementById('import-modal-close'),
            
            exportChatModal: document.getElementById('export-chat-modal'),
            exportChatConfirm: document.getElementById('export-chat-confirm'),
            exportChatCancel: document.getElementById('export-chat-cancel'),
            exportChatModalClose: document.getElementById('export-chat-modal-close'),
            encryptionNote: document.getElementById('encryption-note')
        };

        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSynthesis = window.speechSynthesis;
        this.recognition = null;
        this.activityChart = null;
        
        // Элементы для вкладок настроек
        this.settingsTabs = null;
        this.settingsTabContents = null;
    }

    async init() {
        this.setupCookieNotification();
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.setupSpeechRecognition();
        this.setupBackgroundAnimations();
        this.updateUI();
        this.checkApiStatus();
        this.setupKeyboardShortcuts();
        this.setupServiceWorker();
        this.setupSettingsTabs();
        
        // Загружаем историю чатов
        await this.loadChats();
        
        // Статистика
        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        
        // Шифрование
        setTimeout(async () => {
            await this.setupEncryption();
        }, 1000);
        
        // Автосохранение
        this.startAutoSave();
        
        console.log('Verdikt GPT с обновленным интерфейсом инициализирован');
    }

    // ==================== НАСТРОЙКА ВКЛАДОК НАСТРОЕК ====================

    setupSettingsTabs() {
        this.settingsTabs = document.querySelectorAll('.settings-tab');
        this.settingsTabContents = document.querySelectorAll('.settings-tab-content');
        
        if (!this.settingsTabs.length) return;
        
        this.settingsTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchSettingsTab(tabId);
            });
        });
        
        // Загружаем статистику в настройки
        this.updateSettingsStats();
        this.updateSettingsAchievements();
    }

    switchSettingsTab(tabId) {
        // Убираем активный класс со всех вкладок и содержимого
        this.settingsTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        this.settingsTabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // Добавляем активный класс выбранной вкладке и содержимому
        const activeTab = document.querySelector(`.settings-tab[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(`${tabId}-tab`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        // Обновляем данные при переключении на определенные вкладки
        if (tabId === 'stats') {
            this.updateSettingsStats();
        } else if (tabId === 'achievements') {
            this.updateSettingsAchievements();
        }
    }

    updateSettingsStats() {
        // Обновляем статистику в настройках
        const statsElements = {
            'stats-total-messages': this.state.stats.totalMessages,
            'stats-user-messages': this.state.stats.userMessages,
            'stats-ai-messages': this.state.stats.aiMessages,
            'stats-total-chats': this.state.stats.totalChats,
            'stats-avg-response': this.state.responseTimes.length > 0 
                ? (this.state.responseTimes.reduce((a, b) => a + b, 0) / this.state.responseTimes.length).toFixed(1) + 'с'
                : '0с',
            'stats-consultations': this.state.stats.totalMessages - 1,
            'stats-saved-chats': this.state.stats.savedChats,
            'stats-sessions': this.state.stats.sessions
        };
        
        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateSettingsAchievements() {
        // Обновляем достижения в настройках
        const achievementItems = document.querySelectorAll('.achievement-item-settings');
        
        achievementItems.forEach(item => {
            const achievementName = item.querySelector('.achievement-name-settings').textContent;
            const achievementId = this.getAchievementIdByName(achievementName);
            
            if (achievementId && this.state.achievements[achievementId]?.unlocked) {
                item.classList.add('unlocked');
            } else {
                item.classList.remove('unlocked');
            }
        });
    }

    // ==================== СИСТЕМА УПРАВЛЕНИЯ ЧАТАМИ ====================

    async loadChats() {
        try {
            let chatsData;
            
            if (this.encryptionState.enabled && !this.encryptionState.isLocked) {
                const encryptedData = localStorage.getItem('verdikt_encrypted_data');
                if (encryptedData) {
                    const decryptedData = await this.crypto.decrypt(encryptedData, this.encryptionState.password);
                    chatsData = decryptedData.chats || [];
                }
            } else {
                const savedChats = localStorage.getItem('verdikt_chats');
                if (savedChats) {
                    chatsData = JSON.parse(savedChats);
                }
            }
            
            if (chatsData && Array.isArray(chatsData)) {
                this.chatManager.chats = chatsData;
                
                // Восстанавливаем следующий ID
                const maxId = Math.max(...this.chatManager.chats.map(chat => 
                    parseInt(chat.id.replace('chat-', '')) || 0
                ));
                this.chatManager.nextChatId = maxId + 1;
                
                // Загружаем последний активный чат
                const lastActiveId = localStorage.getItem('verdikt_last_active_chat');
                if (lastActiveId) {
                    const chat = this.chatManager.chats.find(c => c.id === lastActiveId);
                    if (chat) {
                        await this.loadChat(chat.id);
                        return;
                    }
                }
                
                // Если есть сохраненные чаты, загружаем последний
                if (this.chatManager.chats.length > 0) {
                    const lastChat = this.chatManager.chats[this.chatManager.chats.length - 1];
                    await this.loadChat(lastChat.id);
                } else {
                    this.createNewChat();
                }
            } else {
                this.createNewChat();
            }
            
            // Обновляем статистику
            this.state.stats.totalChats = this.chatManager.chats.length;
            
        } catch (error) {
            console.error('Error loading chats:', error);
            this.createNewChat();
        }
    }

    async saveChats() {
        try {
            // Сохраняем текущий чат
            await this.saveCurrentChat();
            
            // Сохраняем список всех чатов
            if (this.encryptionState.enabled && !this.encryptionState.isLocked) {
                await this.saveEncryptedChats();
            } else {
                localStorage.setItem('verdikt_chats', JSON.stringify(this.chatManager.chats));
            }
            
            // Сохраняем ID последнего активного чата
            if (this.chatManager.currentChatId) {
                localStorage.setItem('verdikt_last_active_chat', this.chatManager.currentChatId);
            }
            
            // Обновляем статистику в настройках
            this.updateSettingsStats();
            
        } catch (error) {
            console.error('Error saving chats:', error);
        }
    }

    async saveEncryptedChats() {
        try {
            const encryptedData = localStorage.getItem('verdikt_encrypted_data');
            let decryptedData = {};
            
            if (encryptedData) {
                decryptedData = await this.crypto.decrypt(encryptedData, this.encryptionState.password);
            }
            
            decryptedData.chats = this.chatManager.chats;
            
            const reencryptedData = await this.crypto.encrypt(
                decryptedData, 
                this.encryptionState.password
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
            title: this.generateChatTitle(),
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
        
        // Находим или создаем запись чата
        const existingIndex = this.chatManager.chats.findIndex(chat => chat.id === chatData.id);
        
        if (existingIndex >= 0) {
            this.chatManager.chats[existingIndex] = chatData;
        } else {
            this.chatManager.chats.push(chatData);
            
            // Ограничиваем количество сохраненных чатов
            if (this.chatManager.chats.length > this.chatManager.maxChats) {
                this.chatManager.chats = this.chatManager.chats.slice(-this.chatManager.maxChats);
            }
            
            // Достижение за создание чатов
            if (this.chatManager.chats.length >= 5 && !this.state.achievements.chatHistorian.unlocked) {
                this.unlockAchievement('chatHistorian');
            }
        }
    }

    generateChatTitle() {
        const userMessages = this.state.conversationHistory
            .filter(msg => msg.role === 'user')
            .map(msg => msg.content);
        
        let title = 'Новый чат';
        
        if (userMessages.length > 0) {
            const firstMessage = userMessages[0];
            
            // Извлекаем первые слова как заголовок
            const words = firstMessage.split(' ').slice(0, 5);
            title = words.join(' ');
            
            if (title.length > 40) {
                title = title.substring(0, 37) + '...';
            }
            
            // Добавляем эмодзи в зависимости от темы
            if (firstMessage.toLowerCase().includes('отношен') || firstMessage.toLowerCase().includes('любов')) {
                title = '💕 ' + title;
            } else if (firstMessage.toLowerCase().includes('знакомств') || firstMessage.toLowerCase().includes('свидан')) {
                title = '👥 ' + title;
            } else if (firstMessage.toLowerCase().includes('манипуляц') || firstMessage.toLowerCase().includes('токсичн')) {
                title = '🛡️ ' + title;
            }
        }
        
        return title;
    }

    async createNewChat() {
        const newChatId = 'chat-' + this.chatManager.nextChatId++;
        
        this.chatManager.currentChatId = newChatId;
        
        // Сбрасываем состояние
        this.state.conversationHistory = [
            {
                role: "system",
                content: `Ты - Verdikt GPT, эксперт по психологии отношений, знакомств и манипуляций.
Отвечай на русском языке дружелюбно, но профессионально.
Специализация:
💕 Отношения - конфликты, общение, восстановление
👥 Знакомства - советы по свиданиям, профилям
🛡️ Манипуляции - распознавание, защита, границы

Будь поддерживающим, давай практические советы, используй эмодзи умеренно.`
            }
        ];
        
        this.state.messageCount = 1;
        this.state.stats.totalMessages = 1;
        this.state.stats.userMessages = 0;
        this.state.stats.aiMessages = 1;
        this.state.retryCount = 0;
        
        // Очищаем чат
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
                <div class="message-time">${this.getCurrentTime()}</div>
            </div>
        `;
        
        // Сохраняем новый чат
        await this.saveChats();
        
        this.showNotification('Новый чат создан 💬', 'success');
        this.updateUI();
        this.updateSettingsStats();
    }

    async loadChat(chatId) {
        const chat = this.chatManager.chats.find(c => c.id === chatId);
        
        if (!chat) {
            this.showNotification('Чат не найден', 'error');
            return;
        }
        
        this.chatManager.currentChatId = chatId;
        
        // Восстанавливаем историю
        this.state.conversationHistory = [
            {
                role: "system",
                content: `Ты - Verdikt GPT, эксперт по психологии отношений, знакомств и манипуляций.
Отвечай на русском языке дружелюбно, но профессионально.
Специализация:
💕 Отношения - конфликты, общение, восстановление
👥 Знакомства - советы по свиданиям, профилям
🛡️ Манипуляции - распознавание, защита, границы

Будь поддерживающим, давай практические советы, используй эмодзи умеренно.`
            },
            ...chat.messages
        ];
        
        // Восстанавливаем статистику
        if (chat.stats) {
            Object.assign(this.state.stats, chat.stats);
        }
        
        this.state.messageCount = chat.messages.length + 1;
        
        // Восстанавливаем режим
        if (chat.mode) {
            this.setAIMode(chat.mode);
        }
        
        // Восстанавливаем тему
        if (chat.theme) {
            this.setTheme(chat.theme);
        }
        
        // Очищаем и перерисовываем сообщения
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
                <div class="message-sender">
                    <i class="fas fa-${icon}"></i>
                    ${sender}
                </div>
                <div class="message-content">${this.formatMessage(msg.content)}</div>
                <div class="message-time">${this.formatTimestamp(chat.timestamp)}</div>
            `;
            
            this.elements.chatMessages.appendChild(messageElement);
        });
        
        this.showNotification(`Загружен чат: ${chat.title}`, 'success');
        this.scrollToBottom();
        this.updateUI();
        this.updateSettingsStats();
    }

    async deleteChat(chatId) {
        if (this.chatManager.chats.length <= 1) {
            this.showNotification('Нельзя удалить последний чат', 'warning');
            return;
        }
        
        const chat = this.chatManager.chats.find(c => c.id === chatId);
        
        if (!chat) return;
        
        if (confirm(`Удалить чат "${chat.title}"?`)) {
            const index = this.chatManager.chats.findIndex(c => c.id === chatId);
            
            if (index >= 0) {
                this.chatManager.chats.splice(index, 1);
                
                // Если удалили текущий чат, загружаем другой
                if (chatId === this.chatManager.currentChatId) {
                    if (this.chatManager.chats.length > 0) {
                        await this.loadChat(this.chatManager.chats[0].id);
                    } else {
                        this.createNewChat();
                    }
                }
                
                await this.saveChats();
                this.state.stats.totalChats = this.chatManager.chats.length;
                this.updateSettingsStats();
                this.showNotification('Чат удален 🗑️', 'info');
            }
        }
    }

    async clearAllChats() {
        if (this.chatManager.chats.length === 0) {
            return;
        }
        
        if (confirm('Вы уверены, что хотите удалить ВСЕ чаты? Это действие нельзя отменить.')) {
            this.chatManager.chats = [];
            this.createNewChat();
            
            this.state.stats.totalChats = 1;
            this.updateSettingsStats();
            this.showNotification('Все чаты удалены 🗑️', 'info');
        }
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        
        // Сегодня
        if (date.toDateString() === now.toDateString()) {
            return `Сегодня ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
        // Вчера
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `Вчера ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
        // На этой неделе
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        if (date > weekAgo) {
            const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            return `${days[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
        // Старые сообщения
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    }

    // ==================== ШИФРОВАНИЕ И БЕЗОПАСНОСТЬ ====================

    async setupEncryption() {
        if (!this.crypto.isSupported()) {
            this.showNotification('Ваш браузер не поддерживает шифрование', 'warning');
            return false;
        }
        
        const hasEncryptionSetup = localStorage.getItem('verdikt_encryption_setup');
        
        if (!hasEncryptionSetup) {
            setTimeout(() => this.showEncryptionSetupWizard(), 2000);
            return false;
        }
        
        if (hasEncryptionSetup === 'enabled') {
            this.encryptionState.enabled = true;
            this.encryptionState.isLocked = true;
            setTimeout(() => this.showLockScreen(), 500);
        }
        
        return this.encryptionState.enabled;
    }

    async showEncryptionSetupWizard() {
        const modalHTML = `
        <div class="modal" id="encryption-setup-modal">
            <div class="modal-content" style="max-width: 500px;">
                <h2 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-lock"></i> Настройка шифрования
                </h2>
                
                <div class="modal-section">
                    <p style="margin-bottom: 20px; color: var(--text-secondary);">
                        Для максимальной конфиденциальности включите шифрование данных. 
                        Все ваши чаты и данные будут защищены паролем.
                    </p>
                    
                    <div class="encryption-options">
                        <div class="encryption-option active" data-option="enable">
                            <div class="option-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div>
                                <h4>Включить шифрование</h4>
                                <p style="font-size: 0.9rem; color: var(--text-tertiary);">
                                    Рекомендуется. Ваши данные будут защищены.
                                </p>
                            </div>
                        </div>
                        
                        <div class="encryption-option" data-option="skip">
                            <div class="option-icon">
                                <i class="fas fa-unlock"></i>
                            </div>
                            <div>
                                <h4>Пропустить</h4>
                                <p style="font-size: 0.9rem; color: var(--text-tertiary);">
                                    Данные будут храниться без шифрования
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div id="password-section" style="margin-top: 25px; display: block;">
                        <h4 style="margin-bottom: 15px;">Установите пароль</h4>
                        
                        <div style="margin-bottom: 15px;">
                            <input type="password" id="encryption-password" 
                                   placeholder="Введите пароль" 
                                   style="width: 100%; padding: 12px; border-radius: 8px; 
                                          background: var(--bg-card); border: 1px solid var(--border-color);
                                          color: var(--text-primary); margin-bottom: 10px;">
                            <div class="password-strength" style="height: 4px; background: var(--border-color); 
                                                                  border-radius: 2px; margin-bottom: 5px;">
                                <div id="strength-bar" style="height: 100%; width: 0%; background: #ef4444; 
                                                             border-radius: 2px; transition: width 0.3s;"></div>
                            </div>
                            <div id="strength-text" style="font-size: 0.85rem; color: var(--text-tertiary);">
                                Сложность пароля: слабый
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <input type="password" id="confirm-password" 
                                   placeholder="Подтвердите пароль" 
                                   style="width: 100%; padding: 12px; border-radius: 8px; 
                                          background: var(--bg-card); border: 1px solid var(--border-color);
                                          color: var(--text-primary);">
                        </div>
                        
                        <button id="generate-password" class="ios-button tertiary small" 
                                style="margin-bottom: 15px;">
                            <i class="fas fa-key"></i> Сгенерировать надежный пароль
                        </button>
                        
                        <div style="background: rgba(236, 72, 153, 0.1); padding: 12px; border-radius: 8px; 
                                     margin-bottom: 20px; border-left: 3px solid var(--primary);">
                            <p style="font-size: 0.9rem; margin-bottom: 5px;">
                                <i class="fas fa-info-circle"></i> Важная информация:
                            </p>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">
                                • Пароль не хранится на серверах<br>
                                • Если вы забудете пароль, данные восстановить невозможно<br>
                                • Запишите пароль в безопасном месте
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-buttons" style="display: flex; gap: 10px;">
                    <button class="ios-button secondary" id="cancel-encryption">
                        Отмена
                    </button>
                    <button class="ios-button" id="confirm-encryption" disabled>
                        Продолжить
                    </button>
                </div>
            </div>
        </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('encryption-setup-modal');
        modal.classList.add('active');
        
        let selectedOption = 'enable';
        document.querySelectorAll('.encryption-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.encryption-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                selectedOption = option.dataset.option;
                
                const passwordSection = document.getElementById('password-section');
                if (selectedOption === 'enable') {
                    passwordSection.style.display = 'block';
                    this.validatePasswordInputs();
                } else {
                    passwordSection.style.display = 'none';
                    document.getElementById('confirm-encryption').disabled = false;
                }
            });
        });
        
        const passwordInput = document.getElementById('encryption-password');
        const confirmInput = document.getElementById('confirm-password');
        
        const validateInputs = () => this.validatePasswordInputs();
        passwordInput.addEventListener('input', validateInputs);
        confirmInput.addEventListener('input', validateInputs);
        
        document.getElementById('generate-password').addEventListener('click', () => {
            const strongPassword = this.crypto.generateStrongPassword();
            passwordInput.value = strongPassword;
            confirmInput.value = strongPassword;
            validateInputs();
            
            passwordInput.type = 'text';
            confirmInput.type = 'text';
            setTimeout(() => {
                passwordInput.type = 'password';
                confirmInput.type = 'password';
            }, 2000);
        });
        
        document.getElementById('confirm-encryption').addEventListener('click', async () => {
            if (selectedOption === 'enable') {
                const password = passwordInput.value;
                const confirmPassword = confirmInput.value;
                
                if (password !== confirmPassword) {
                    this.showNotification('Пароли не совпадают', 'error');
                    return;
                }
                
                if (password.length < 8) {
                    this.showNotification('Пароль должен быть не менее 8 символов', 'error');
                    return;
                }
                
                await this.saveEncryptionSettings(password);
                this.showNotification('Шифрование настроено ✅', 'success');
            } else {
                localStorage.setItem('verdikt_encryption_setup', 'skipped');
                this.showNotification('Шифрование отключено', 'info');
            }
            
            modal.remove();
        });
        
        document.getElementById('cancel-encryption').addEventListener('click', () => {
            modal.remove();
            localStorage.setItem('verdikt_encryption_setup', 'skipped');
        });
    }

    validatePasswordInputs() {
        const password = document.getElementById('encryption-password')?.value || '';
        const confirm = document.getElementById('confirm-password')?.value || '';
        const button = document.getElementById('confirm-encryption');
        
        if (!button) return;
        
        if (!password || !confirm) {
            button.disabled = true;
            return;
        }
        
        let strength = 0;
        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');
        
        if (password.length >= 8) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;
        
        if (strengthBar) {
            strengthBar.style.width = strength + '%';
            strengthBar.style.background = 
                strength < 50 ? '#ef4444' : 
                strength < 75 ? '#f59e0b' : 
                '#10b981';
        }
        
        if (strengthText) {
            strengthText.textContent = 
                strength < 50 ? 'Сложность пароля: слабый' : 
                strength < 75 ? 'Сложность пароля: средний' : 
                'Сложность пароля: надежный';
        }
        
        button.disabled = password !== confirm || strength < 50;
    }

    async saveEncryptionSettings(password) {
        try {
            const passwordHash = await this.crypto.hashPassword(password);
            
            localStorage.setItem('verdikt_encryption_setup', 'enabled');
            localStorage.setItem('verdikt_password_hash', passwordHash);
            
            await this.encryptAllExistingData(password);
            
            this.encryptionState.enabled = true;
            this.encryptionState.password = password;
            this.encryptionState.passwordHash = passwordHash;
            this.encryptionState.isLocked = false;
            
            this.startAutoLockTimer();
            
        } catch (error) {
            console.error('Error saving encryption settings:', error);
            this.showNotification('Ошибка настройки шифрования', 'error');
        }
    }

    async encryptAllExistingData(password) {
        const dataToEncrypt = {
            chats: this.chatManager.chats,
            stats: this.state.stats,
            achievements: this.state.achievements,
            settings: {
                theme: this.state.currentTheme
            }
        };
        
        try {
            const encryptedData = await this.crypto.encrypt(dataToEncrypt, password);
            localStorage.setItem('verdikt_encrypted_data', encryptedData);
            
        } catch (error) {
            console.error('Error encrypting existing data:', error);
            throw error;
        }
    }

    showLockScreen() {
        const lockScreenHTML = `
        <div class="lock-screen" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bg-gradient);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        ">
            <div style="text-align: center;">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: var(--gradient);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    margin: 0 auto 20px;
                    animation: pulse 2s infinite;
                ">
                    <i class="fas fa-lock"></i>
                </div>
                
                <h2 style="margin-bottom: 10px; font-size: 1.8rem;">
                    Приложение заблокировано
                </h2>
                
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Для продолжения работы введите пароль
                </p>
                
                <div style="max-width: 300px; width: 100%;">
                    <input type="password" id="lock-password" 
                           placeholder="Введите пароль" 
                           style="width: 100%; padding: 15px; border-radius: 12px; 
                                  background: var(--bg-card); border: 2px solid var(--border-color);
                                  color: var(--text-primary); margin-bottom: 15px;
                                  font-size: 16px; text-align: center;">
                    
                    <button class="ios-button" id="unlock-app" 
                            style="width: 100%;">
                        <i class="fas fa-unlock"></i> Разблокировать
                    </button>
                    
                    <div style="margin-top: 20px; color: var(--text-tertiary); font-size: 0.9rem;">
                        <p><i class="fas fa-info-circle"></i> 
                        Приложение автоматически блокируется через 15 минут бездействия</p>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        const existingLockScreen = document.querySelector('.lock-screen');
        if (existingLockScreen) existingLockScreen.remove();
        
        document.body.insertAdjacentHTML('beforeend', lockScreenHTML);
        
        const passwordInput = document.getElementById('lock-password');
        const unlockButton = document.getElementById('unlock-app');
        
        unlockButton.addEventListener('click', async () => {
            await this.attemptUnlock(passwordInput.value);
        });
        
        passwordInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await this.attemptUnlock(passwordInput.value);
            }
        });
        
        passwordInput.focus();
    }

    async attemptUnlock(password) {
        try {
            const storedHash = localStorage.getItem('verdikt_password_hash');
            const inputHash = await this.crypto.hashPassword(password);
            
            if (storedHash !== inputHash) {
                this.showNotification('Неверный пароль', 'error');
                
                const lockScreen = document.querySelector('.lock-screen');
                lockScreen.style.animation = 'shake 0.5s';
                setTimeout(() => lockScreen.style.animation = '', 500);
                
                return;
            }
            
            await this.loadEncryptedData(password);
            
            this.encryptionState.password = password;
            this.encryptionState.isLocked = false;
            
            document.querySelector('.lock-screen').remove();
            
            this.startAutoLockTimer();
            this.showNotification('Разблокировано ✅', 'success');
            
        } catch (error) {
            console.error('Unlock error:', error);
            this.showNotification('Ошибка разблокировки', 'error');
        }
    }

    async loadEncryptedData(password) {
        try {
            const encryptedData = localStorage.getItem('verdikt_encrypted_data');
            
            if (!encryptedData) {
                return;
            }
            
            const decryptedData = await this.crypto.decrypt(encryptedData, password);
            
            // Загружаем чаты
            if (decryptedData.chats) {
                this.chatManager.chats = decryptedData.chats;
                this.state.stats.totalChats = this.chatManager.chats.length;
            }
            
            // Загружаем статистику
            if (decryptedData.stats) {
                Object.assign(this.state.stats, decryptedData.stats);
            }
            
            // Загружаем достижения
            if (decryptedData.achievements) {
                Object.keys(decryptedData.achievements).forEach(key => {
                    if (this.state.achievements[key]) {
                        this.state.achievements[key].unlocked = decryptedData.achievements[key].unlocked;
                    }
                });
            }
            
            // Загружаем настройки
            if (decryptedData.settings?.theme) {
                this.setTheme(decryptedData.settings.theme);
            }
            
        } catch (error) {
            console.error('Error loading encrypted data:', error);
            throw error;
        }
    }

    startAutoLockTimer() {
        if (this.encryptionState.lockTimer) {
            clearTimeout(this.encryptionState.lockTimer);
        }
        
        if (this.encryptionState.autoLockTimeout > 0) {
            this.encryptionState.lockTimer = setTimeout(() => {
                this.lockApp();
            }, this.encryptionState.autoLockTimeout);
        }
    }

    lockApp() {
        if (this.encryptionState.enabled && !this.encryptionState.isLocked) {
            this.encryptionState.isLocked = true;
            this.encryptionState.password = null;
            
            this.state.conversationHistory = [
                {
                    role: "system",
                    content: `Ты - Verdikt GPT, эксперт по психологии отношений...`
                }
            ];
            
            this.showNotification('Приложение заблокировано 🔒', 'info');
            this.showLockScreen();
        }
    }

    // ==================== ОСНОВНЫЕ ФУНКЦИИ ЧАТА ====================

    setupEventListeners() {
        // Отправка сообщений
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Голосовые функции
        this.elements.voiceInput.addEventListener('click', () => this.toggleVoiceRecording());
        this.elements.voiceOutput.addEventListener('click', () => this.speakLastMessage());
        
        // Режимы AI в настройках
        document.querySelectorAll('.mode-item-settings').forEach(mode => {
            mode.addEventListener('click', (e) => {
                const modeId = e.currentTarget.dataset.mode;
                this.setAIMode(modeId);
                
                // Обновляем активный класс
                document.querySelectorAll('.mode-item-settings').forEach(item => {
                    item.classList.remove('active');
                });
                mode.classList.add('active');
            });
        });
        
        // Примеры вопросов
        document.querySelectorAll('.example-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const question = e.currentTarget.dataset.question;
                this.elements.messageInput.value = question;
                this.elements.messageInput.focus();
            });
        });
        
        // Кнопки управления
        this.elements.newChat.addEventListener('click', () => this.createNewChat());
        this.elements.settingsButton.addEventListener('click', () => this.showSettingsModal());
        this.elements.presentationMode.addEventListener('click', () => this.togglePresentationMode());
        
        // История чатов
        this.elements.toggleChatHistory.addEventListener('click', () => {
            this.showChatHistoryModal();
        });
        
        // Настройки
        this.elements.temperatureSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.elements.temperatureValue.textContent = value;
            this.API_CONFIG.temperature = parseFloat(value);
        });
        
        // Темы
        document.querySelectorAll('.theme-option').forEach(theme => {
            theme.addEventListener('click', (e) => {
                const themeName = e.currentTarget.dataset.theme;
                this.setTheme(themeName);
                
                // Обновляем активный класс
                document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
                theme.classList.add('active');
            });
        });
        
        // Экспорт
        document.querySelectorAll('#export-modal .export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const format = e.currentTarget.dataset.format;
                this.exportChat(format);
            });
        });
        
        // Модальные окна
        this.elements.settingsClose.addEventListener('click', () => this.hideModal('settings-modal'));
        this.elements.exportClose.addEventListener('click', () => this.hideModal('export-modal'));
        this.elements.exportCancel.addEventListener('click', () => this.hideModal('export-modal'));
        this.elements.statsClose.addEventListener('click', () => this.hideModal('stats-modal'));
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        
        // Презентация
        this.elements.prevSlide.addEventListener('click', () => this.prevSlide());
        this.elements.nextSlide.addEventListener('click', () => this.nextSlide());
        this.elements.exitPresentation.addEventListener('click', () => this.togglePresentationMode());
        
        // Автовысота текстового поля
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 200) + 'px';
        });
        
        // Сетевое соединение
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
        
        // Сохранение при закрытии
        window.addEventListener('beforeunload', () => this.saveToLocalStorage());
        
        // Футер ссылки
        document.getElementById('model-info').addEventListener('click', (e) => {
            e.preventDefault();
            this.showNotification('Модель: microsoft/DialoGPT-medium (Hugging Face)', 'info');
        });
        
        document.getElementById('privacy-policy').addEventListener('click', (e) => {
            e.preventDefault();
            this.showNotification('Используется Hugging Face API. Данные анонимизированы.', 'info');
        });
        
        // Управление шифрованием
        document.getElementById('encryption-manager')?.addEventListener('click', () => {
            this.showEncryptionManager();
        });
        
        // Импорт/экспорт
        this.setupImportListeners();
        this.setupExportListeners();
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message) {
            this.showNotification('Введите сообщение', 'warning');
            return;
        }
        
        if (message.startsWith('/')) {
            if (this.handleCommand(message)) {
                this.elements.messageInput.value = '';
                return;
            }
        }
        
        if (!this.isTopicRelevant(message)) {
            this.showNotification('Я специализируюсь только на отношениях, знакомствах и манипуляциях.', 'warning');
            return;
        }
        
        this.addMessage(message, 'user');
        this.state.conversationHistory.push({ role: "user", content: message });
        this.state.messageCount++;
        this.state.stats.totalMessages++;
        this.state.stats.userMessages++;
        
        this.updateTopicStats(message);
        
        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        
        this.checkAchievements();
        
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        
        this.showTypingIndicator();
        if (this.state.messageCount <= 3) {
            this.showNotification('Первые запросы могут занимать 20-40 секунд (загрузка модели)', 'info');
        }
        
        try {
            const startTime = Date.now();
            const aiResponse = await this.getAIResponse(this.state.conversationHistory);
            const responseTime = (Date.now() - startTime) / 1000;
            
            this.state.responseTimes.push(responseTime);
            
            this.hideTypingIndicator();
            
            this.addMessage(aiResponse, 'ai');
            this.state.conversationHistory.push({ role: "assistant", content: aiResponse });
            this.state.stats.totalMessages++;
            this.state.stats.aiMessages++;
            
            if (this.state.conversationHistory.length > 20) {
                this.state.conversationHistory = [
                    this.state.conversationHistory[0],
                    ...this.state.conversationHistory.slice(-18)
                ];
            }
            
            this.showNotification(`Ответ получен за ${responseTime.toFixed(1)}с ✅`, 'success');
            this.updateUI();
            this.updateSettingsStats();
            await this.saveChats();
            
            this.state.retryCount = 0;
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('API Error details:', error);
            
            let errorMessage = "Извините, произошла ошибка при получении ответа. ";
            let userMessage = error.message;
            
            if (error.message.includes('503') || error.message.includes('загружается')) {
                if (this.state.retryCount < this.state.maxRetries) {
                    this.state.retryCount++;
                    errorMessage += `Попытка ${this.state.retryCount}/${this.state.maxRetries}. Подождите 30 секунд.`;
                    userMessage = "Модель загружается, подождите 30 секунд и попробуйте снова...";
                } else {
                    errorMessage = "Сервер перегружен. Пожалуйста, попробуйте позже или используйте более короткий запрос.";
                }
            } else if (error.message.includes('429')) {
                errorMessage = "Превышен лимит запросов. Бесплатный лимит: 30K токенов в месяц.";
            } else if (error.message.includes('401')) {
                errorMessage = "Ошибка аутентификации API. Проверьте API ключ.";
            }
            
            this.addMessage(userMessage, 'ai');
            this.showNotification(errorMessage, 'error');
            
            this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ошибка API';
            this.elements.apiStatus.style.background = 'rgba(239, 68, 68, 0.15)';
            this.elements.apiStatus.style.color = '#f87171';
        }
        
        this.scrollToBottom();
    }

    async getAIResponse(messages) {
        if (!this.state.isApiConnected) {
            throw new Error('API не подключен');
        }

        try {
            const userMessages = messages.filter(msg => msg.role === "user");
            const lastUserMessage = userMessages[userMessages.length - 1]?.content || 
                                   messages[messages.length - 1]?.content || 
                                   "Привет";
            
            const prompt = `Ты - психолог Verdikt GPT, специалист по отношениям, знакомствам и манипуляциям.
Пользователь: ${lastUserMessage}
Психолог:`;

            const response = await fetch(this.API_CONFIG.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_CONFIG.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: this.API_CONFIG.maxTokens,
                        temperature: this.API_CONFIG.temperature,
                        top_p: 0.95,
                        repetition_penalty: 1.2,
                        do_sample: true,
                        return_full_text: false,
                        num_return_sequences: 1
                    },
                    options: {
                        use_cache: true,
                        wait_for_model: true
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('HF API Error Response:', errorText);
                
                if (response.status === 503) {
                    throw new Error('Модель загружается. Попробуйте через 20-30 секунд.');
                } else if (response.status === 429) {
                    throw new Error('Превышен лимит запросов (429). Попробуйте позже.');
                } else if (response.status === 401) {
                    throw new Error('Ошибка аутентификации API (401)');
                } else {
                    throw new Error(`HF API Error: ${response.status} - ${errorText.substring(0, 100)}`);
                }
            }

            const data = await response.json();
            
            let generatedText;
            if (Array.isArray(data)) {
                generatedText = data[0]?.generated_text || '';
            } else if (data.generated_text) {
                generatedText = data.generated_text;
            } else if (data[0]?.generated_text) {
                generatedText = data[0].generated_text;
            } else {
                console.warn('Unexpected API response format:', data);
                generatedText = JSON.stringify(data);
            }
            
            let cleanResponse = generatedText.replace(prompt, '').trim();
            cleanResponse = cleanResponse.replace(/Психолог:/g, '').trim();
            
            if (!cleanResponse || cleanResponse.length < 5) {
                const fallbackResponses = [
                    "Я понимаю вашу ситуацию. Важно обсудить это открыто и честно с партнером. 💬",
                    "Это сложный вопрос. Рекомендую сосредоточиться на ваших чувствах и потребностях. 💕",
                    "В подобных ситуациях важно сохранять спокойствие и действовать обдуманно. 🧘‍♀️",
                    "Я бы посоветовал обратиться к профессиональному психологу для более детальной консультации. 👥"
                ];
                cleanResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
            }
            
            return cleanResponse;
            
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            throw error;
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    isTopicRelevant(message) {
        const messageLower = message.toLowerCase();
        const relevantTopics = [
            'отношени', 'любов', 'брак', 'семь', 'пар', 'встреча', 'расставан',
            'ревност', 'довери', 'обид', 'ссор', 'конфликт', 'кризис',
            'верност', 'измен', 'секс', 'интим', 'родител', 'дети',
            'свекр', 'тещ', 'муж', 'жена', 'мужчин', 'женщин',
            'знакомств', 'свидан', 'встреч', 'тинд', 'бад', 'приложен',
            'профил', 'анкет', 'перв', 'втор', 'свидан', 'роман',
            'флирт', 'симпати', 'нравит', 'влюблен', 'ухаживан',
            'познаком', 'встрет', 'познаком',
            'манипуляц', 'токсичн', 'абью', 'насил', 'давлен',
            'шантаж', 'вина', 'обид', 'контрол', 'завис', 'унижен',
            'оскорбл', 'газлайтинг', 'нарцис', 'психолог', 'границ',
            'уважен', 'достоинств', 'самооцен', 'психологическ',
            'психолог', 'эмоц', 'чувств', 'общен', 'коммуникац',
            'довери', 'уважен', 'пониман', 'поддерж', 'совет',
            'помощ', 'консультац', 'эксперт', 'специалист'
        ];
        
        return relevantTopics.some(topic => messageLower.includes(topic));
    }

    updateTopicStats(message) {
        const messageLower = message.toLowerCase();
        
        if (messageLower.includes('манипуляц') || messageLower.includes('токсичн') || messageLower.includes('абью')) {
            this.state.stats.manipulationRequests++;
            if (this.state.stats.manipulationRequests === 5) {
                this.unlockAchievement('manipulationExpert');
            }
        }
        
        if (messageLower.includes('отношени') || messageLower.includes('любов') || messageLower.includes('брак')) {
            this.state.stats.relationshipAdvice++;
            if (this.state.stats.relationshipAdvice === 3) {
                this.unlockAchievement('relationshipHelper');
            }
        }
        
        if (messageLower.includes('знакомств') || messageLower.includes('свидан') || messageLower.includes('тинд')) {
            this.state.stats.datingAdvice++;
        }
    }

    addMessage(content, sender) {
        const messageId = 'msg-' + Date.now();
        const time = this.getCurrentTime();
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.id = messageId;
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
        
        messageElement.innerHTML = `
            <div class="message-actions">
                <button class="message-action" onclick="window.verdiktApp.copyMessage('${messageId}')">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="message-action" onclick="window.verdiktApp.speakMessage('${messageId}')">
                    <i class="fas fa-volume-up"></i>
                </button>
                <button class="message-action" onclick="window.verdiktApp.regenerateMessage('${messageId}')">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
            <div class="message-sender">
                <i class="fas fa-${sender === 'user' ? 'user' : 'heart'}"></i>
                ${sender === 'user' ? 'Вы' : 'Эксперт по отношениям'}
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
            <div class="message-time">${time}</div>
        `;
        
        this.elements.chatMessages.appendChild(messageElement);
        
        setTimeout(() => {
            messageElement.style.animation = 'messageAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        }, 10);
        
        setTimeout(() => {
            hljs.highlightAll();
        }, 100);
        
        this.scrollToBottom();
    }

    formatMessage(text) {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`{3}([\s\S]*?)`{3}/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    handleCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0];
        
        switch(cmd) {
            case '/clear':
                this.clearChat();
                break;
            case '/save':
                this.saveChats();
                break;
            case '/export':
                this.showExportModal();
                break;
            case '/history':
                this.showChatHistoryModal();
                break;
            case '/import':
                this.showImportModal();
                break;
            case '/advice':
                this.setAIMode('balanced');
                this.elements.messageInput.value = 'Нужен совет по отношениям...';
                this.elements.messageInput.focus();
                break;
            case '/manipulation':
                this.setAIMode('protective');
                this.elements.messageInput.value = 'Как понять, что мной манипулируют?';
                this.elements.messageInput.focus();
                break;
            case '/stats':
                this.showStatsModal();
                break;
            case '/presentation':
                this.togglePresentationMode();
                break;
            case '/help':
                this.showQuickCommands();
                break;
            default:
                return false;
        }
        return true;
    }

    clearChat() {
        if (confirm('Очистить текущий чат? Сообщения будут удалены.')) {
            this.state.conversationHistory = [
                {
                    role: "system",
                    content: `Ты - Verdikt GPT, эксперт по психологии отношений, знакомств и манипуляций.
Отвечай на русском языке дружелюбно, но профессионально.
Специализация:
💕 Отношения - конфликты, общение, восстановление
👥 Знакомства - советы по свиданиям, профилям
🛡️ Манипуляции - распознавание, защита, границы

Будь поддерживающим, давай практические советы, используй эмодзи умеренно.`
                }
            ];
            
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
                    <div class="message-content">Чат очищен! Я готов помочь с вопросами об отношениях, знакомствах и манипуляциях. Расскажите, что вас беспокоит? 💕</div>
                    <div class="message-time">${this.getCurrentTime()}</div>
                </div>
            `;
            
            this.saveChats();
            this.showNotification('Чат очищен 🗑️', 'info');
        }
    }

    setAIMode(modeId) {
        if (!this.state.aiModes[modeId]) return;
        
        this.state.currentMode = modeId;
        this.API_CONFIG.temperature = this.state.aiModes[modeId].temperature;
        
        // Обновляем активный класс в настройках
        document.querySelectorAll('.mode-item-settings').forEach(item => {
            item.classList.remove('active');
        });
        const activeMode = document.querySelector(`.mode-item-settings[data-mode="${modeId}"]`);
        if (activeMode) {
            activeMode.classList.add('active');
        }
        
        this.showNotification(`Режим изменен на: ${this.state.aiModes[modeId].name}`, 'info');
    }

    togglePresentationMode() {
        this.state.isPresentationMode = !this.state.isPresentationMode;
        
        if (this.state.isPresentationMode) {
            document.body.classList.add('presentation-mode');
            document.querySelector('.presentation-nav').style.display = 'flex';
            this.createSlides();
            this.showSlide(0);
            this.unlockAchievement('presenter');
            this.showNotification('Режим презентации активирован 📊', 'info');
        } else {
            document.body.classList.remove('presentation-mode');
            document.querySelector('.presentation-nav').style.display = 'none';
            this.showNotification('Режим презентации выключен', 'info');
        }
    }

    setTheme(theme) {
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        // Обновляем активный класс
        document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
        const activeTheme = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
        }
        
        this.saveChats();
        this.showNotification(`Тема изменена: ${theme}`, 'info');
    }

    // ==================== СИСТЕМА УВЕДОМЛЕНИЙ ====================

    showNotification(text, type = 'info') {
        this.elements.notificationText.textContent = text;
        
        switch(type) {
            case 'success':
                this.elements.notification.style.background = 'linear-gradient(135deg, #ec4899, #db2777)';
                break;
            case 'error':
                this.elements.notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                break;
            case 'warning':
                this.elements.notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                break;
            default:
                this.elements.notification.style.background = 'var(--gradient)';
        }
        
        this.elements.notification.classList.add('show');
        
        setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, 3000);
    }

    unlockAchievement(achievementId) {
        if (!this.state.achievements[achievementId] || this.state.achievements[achievementId].unlocked) return;
        
        this.state.achievements[achievementId].unlocked = true;
        
        const achievement = this.state.achievements[achievementId];
        document.getElementById('achievement-icon').textContent = achievement.icon;
        document.getElementById('achievement-title').textContent = achievement.name;
        document.getElementById('achievement-desc').textContent = achievement.description;
        
        const notification = document.getElementById('achievement-notification');
        notification.style.display = 'flex';
        notification.style.animation = 'none';
        
        setTimeout(() => {
            notification.style.animation = 'achievementSlide 3s ease';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }, 10);
        
        this.updateSettingsAchievements();
        this.saveChats();
    }

    checkAchievements() {
        if (this.state.stats.userMessages >= 10 && !this.state.achievements.activeUser.unlocked) {
            this.unlockAchievement('activeUser');
        }
        
        const currentHour = new Date().getHours();
        if ((currentHour >= 23 || currentHour <= 5) && !this.state.achievements.nightOwl.unlocked) {
            this.unlockAchievement('nightOwl');
        }
    }

    // ==================== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ====================

    loadFromLocalStorage() {
        const encryptionSetup = localStorage.getItem('verdikt_encryption_setup');
        
        if (encryptionSetup === 'enabled') {
            this.encryptionState.enabled = true;
            this.encryptionState.isLocked = true;
        } else {
            const savedTheme = localStorage.getItem('verdikt_theme');
            if (savedTheme) {
                this.setTheme(savedTheme);
            }
        }
    }

    async saveToLocalStorage() {
        await this.saveChats();
    }

    // ==================== ПОЛЕЗНЫЕ ФУНКЦИИ ====================

    getCurrentTime() {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    showTypingIndicator() {
        this.elements.typingIndicator.style.display = 'block';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.elements.typingIndicator.style.display = 'none';
    }

    updateUI() {
        this.updateSettingsStats();
    }

    getAchievementIdByName(name) {
        for (const [id, achievement] of Object.entries(this.state.achievements)) {
            if (achievement.name === name) return id;
        }
        return null;
    }

    copyMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        
        const messageText = messageElement.querySelector('.message-content').textContent;
        navigator.clipboard.writeText(messageText).then(() => {
            this.showNotification('Сообщение скопировано 📋', 'success');
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = messageText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Сообщение скопировано 📋', 'success');
        });
    }

    regenerateMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        
        const messageIndex = Array.from(this.elements.chatMessages.children).indexOf(messageElement);
        if (messageIndex > 0) {
            const prevMessage = this.elements.chatMessages.children[messageIndex - 1];
            const userMessage = prevMessage.querySelector('.message-content').textContent;
            
            messageElement.remove();
            this.state.conversationHistory.pop();
            
            this.elements.messageInput.value = userMessage;
            this.sendMessage();
        }
    }

    toggleVoiceRecording() {
        if (!this.recognition) {
            this.showNotification('Голосовой ввод не поддерживается в вашем браузере', 'error');
            return;
        }
        
        if (!this.state.isRecording) {
            this.state.isRecording = true;
            this.elements.voiceInput.classList.add('recording');
            this.elements.voiceInput.innerHTML = '<i class="fas fa-stop"></i>';
            this.recognition.start();
            this.showNotification('Запись началась... 🎤', 'info');
        } else {
            this.state.isRecording = false;
            this.elements.voiceInput.classList.remove('recording');
            this.elements.voiceInput.innerHTML = '<i class="fas fa-microphone"></i>';
            this.recognition.stop();
            this.showNotification('Запись остановлена', 'info');
        }
    }

    speakMessage(messageId) {
        if (this.state.isSpeaking) {
            this.speechSynthesis.cancel();
            this.state.isSpeaking = false;
            this.showNotification('Озвучивание остановлено', 'info');
            return;
        }
        
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        
        const messageText = messageElement.querySelector('.message-content').textContent;
        
        const utterance = new SpeechSynthesisUtterance(messageText);
        utterance.lang = 'ru-RU';
        utterance.rate = 1;
        utterance.pitch = 1;
        
        utterance.onstart = () => {
            this.state.isSpeaking = true;
            this.showNotification('Озвучивание началось... 🔊', 'info');
        };
        
        utterance.onend = () => {
            this.state.isSpeaking = false;
        };
        
        utterance.onerror = () => {
            this.state.isSpeaking = false;
            this.showNotification('Ошибка озвучивания', 'error');
        };
        
        this.speechSynthesis.speak(utterance);
    }

    speakLastMessage() {
        const messages = this.elements.chatMessages.querySelectorAll('.ai-message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            this.speakMessage(lastMessage.id);
        } else {
            this.showNotification('Нет сообщений для озвучивания', 'warning');
        }
    }

    // ==================== МОДАЛЬНЫЕ ОКНА ====================

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';
    }

    showSettingsModal() {
        document.getElementById('temperature-slider').value = this.API_CONFIG.temperature;
        document.getElementById('temperature-value').textContent = this.API_CONFIG.temperature;
        this.switchSettingsTab('themes');
        this.showModal('settings-modal');
    }

    showExportModal() {
        this.showModal('export-modal');
    }

    showStatsModal() {
        document.getElementById('total-messages').textContent = this.state.stats.totalMessages;
        document.getElementById('avg-response').textContent = 
            this.state.responseTimes.length > 0 
            ? (this.state.responseTimes.reduce((a, b) => a + b, 0) / this.state.responseTimes.length).toFixed(1) + 'с'
            : '0с';
        document.getElementById('user-messages').textContent = this.state.stats.userMessages;
        document.getElementById('ai-messages').textContent = this.state.stats.aiMessages;
        
        this.updateActivityChart();
        this.updatePopularTopics();
        
        this.showModal('stats-modal');
    }

    showChatHistoryModal() {
        this.showHistoryModal();
    }

    showHistoryModal() {
        const modalHTML = `
        <div class="modal" id="chat-history-modal">
            <div class="modal-content" style="max-width: 500px;">
                <button class="modal-close" id="chat-history-modal-close">
                    <i class="fas fa-times"></i>
                </button>
                
                <h2 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-history"></i> История чатов
                </h2>
                
                <div class="modal-section">
                    <div id="chat-history-list" style="max-height: 300px; overflow-y: auto;">
                        <div class="chat-history-empty" style="text-align: center; padding: 30px; color: var(--text-tertiary);">
                            Нет сохраненных чатов
                        </div>
                    </div>
                </div>
                
                <div class="modal-buttons" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="ios-button tertiary" id="import-chat-btn" style="flex: 1;">
                        <i class="fas fa-upload"></i> Импорт
                    </button>
                    <button class="ios-button tertiary" id="export-all-chats-btn" style="flex: 1;">
                        <i class="fas fa-download"></i> Экспорт всех
                    </button>
                    <button class="ios-button secondary" id="clear-all-chats-btn" style="flex: 1;">
                        <i class="fas fa-trash"></i> Очистить
                    </button>
                </div>
            </div>
        </div>
        `;
        
        const existingModal = document.getElementById('chat-history-modal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('chat-history-modal');
        this.showModal('chat-history-modal');
        
        this.updateHistoryModalContent();
        
        document.getElementById('chat-history-modal-close').addEventListener('click', () => {
            this.hideModal('chat-history-modal');
        });
        
        document.getElementById('import-chat-btn').addEventListener('click', () => {
            this.hideModal('chat-history-modal');
            this.showImportModal();
        });
        
        document.getElementById('export-all-chats-btn').addEventListener('click', () => {
            this.exportAllChats();
        });
        
        document.getElementById('clear-all-chats-btn').addEventListener('click', () => {
            this.clearAllChats();
            this.hideModal('chat-history-modal');
        });
    }

    updateHistoryModalContent() {
        const historyList = document.getElementById('chat-history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        if (this.chatManager.chats.length === 0) {
            historyList.innerHTML = `
                <div class="chat-history-empty" style="text-align: center; padding: 30px; color: var(--text-tertiary);">
                    Нет сохраненных чатов
                </div>
            `;
            return;
        }
        
        // Сортируем чаты по времени (новые сверху)
        const sortedChats = [...this.chatManager.chats].sort((a, b) => b.timestamp - a.timestamp);
        
        sortedChats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-history-item';
            chatItem.style.cssText = `
                padding: 12px 15px;
                border-radius: var(--radius-md);
                margin-bottom: 8px;
                cursor: pointer;
                transition: var(--transition);
                display: flex;
                flex-direction: column;
                gap: 5px;
                background: rgba(255, 255, 255, 0.05);
                border-left: 3px solid transparent;
                position: relative;
            `;
            
            if (chat.id === this.chatManager.currentChatId) {
                chatItem.style.background = 'rgba(236, 72, 153, 0.1)';
                chatItem.style.borderLeftColor = 'var(--primary)';
            }
            
            const messageCount = chat.messages ? chat.messages.length : 0;
            const date = new Date(chat.timestamp);
            const timeStr = date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const dateStr = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit'
            });
            
            chatItem.innerHTML = `
                <div style="font-weight: 500; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 20px;">
                    ${chat.title || 'Без названия'}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-tertiary);">
                    <span>${dateStr} ${timeStr}</span>
                    <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem;">
                        ${messageCount} сообщ.
                    </span>
                </div>
            `;
            
            chatItem.addEventListener('click', () => {
                this.loadChat(chat.id);
                this.hideModal('chat-history-modal');
            });
            
            // Контекстное меню для удаления
            chatItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.deleteChat(chat.id);
                this.updateHistoryModalContent();
            });
            
            historyList.appendChild(chatItem);
        });
    }

    // ==================== ПРОЧИЕ ФУНКЦИИ ====================

    setupSpeechRecognition() {
        if (this.SpeechRecognition) {
            this.recognition = new this.SpeechRecognition();
            this.recognition.lang = 'ru-RU';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.elements.messageInput.value = transcript;
                this.showNotification('Речь распознана: ' + transcript.substring(0, 50) + '...');
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                this.showNotification('Ошибка распознавания речи', 'error');
            };
            
            this.recognition.onend = () => {
                if (this.state.isRecording) {
                    this.toggleVoiceRecording();
                }
            };
        }
    }

    setupBackgroundAnimations() {
        const heartsContainer = document.getElementById('floating-hearts');
        for (let i = 0; i < 15; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.innerHTML = '❤';
            heart.style.left = `${Math.random() * 100}%`;
            heart.style.animationDelay = `${Math.random() * 15}s`;
            heart.style.fontSize = `${10 + Math.random() * 20}px`;
            heartsContainer.appendChild(heart);
        }

        const particlesContainer = document.getElementById('connection-particles');
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 3}s`;
            particlesContainer.appendChild(particle);
        }
    }

    async checkApiStatus() {
        this.elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i> Подключение к Hugging Face...';
        this.elements.apiStatus.classList.add('api-connecting');
        this.elements.apiStatus.classList.remove('api-error');
        
        this.state.isApiConnected = true;
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут подключения')), 5000)
        );
        
        try {
            const response = await Promise.race([
                fetch('https://api-inference.huggingface.co/status', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.API_CONFIG.apiKey}`,
                    }
                }),
                timeoutPromise
            ]);
            
            if (response.ok) {
                this.elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i> HF API доступен';
                this.elements.apiStatus.style.background = 'rgba(34, 197, 94, 0.15)';
                this.elements.apiStatus.style.color = '#4ade80';
                this.elements.apiStatus.classList.remove('api-connecting');
                this.showConnectionSuccessAnimation();
                this.showNotification('Hugging Face API подключен ✅', 'success');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.log('API check error:', error);
            this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Проверьте соединение';
            this.elements.apiStatus.classList.remove('api-connecting');
            this.showNotification('API проверка не удалась, но можно попробовать отправить сообщение', 'warning');
        }
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker зарегистрирован:', registration);
                })
                .catch(error => {
                    console.log('Ошибка регистрации Service Worker:', error);
                });
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'enter':
                        e.preventDefault();
                        this.sendMessage();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.createNewChat();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveChats();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.showExportModal();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.showHistoryModal();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.clearChat();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.togglePresentationMode();
                        break;
                }
            }
            
            if (this.state.isPresentationMode) {
                switch(e.key) {
                    case 'ArrowLeft':
                        this.prevSlide();
                        break;
                    case 'ArrowRight':
                        this.nextSlide();
                        break;
                    case 'Escape':
                        this.togglePresentationMode();
                        break;
                }
            }
        });
    }

    setupCookieNotification() {
        const notification = document.getElementById('cookie-notification');
        const acceptBtn = document.getElementById('cookie-accept');
        const rejectBtn = document.getElementById('cookie-reject');
        const policyLink = document.getElementById('cookie-policy-link');
        
        const cookieConsent = localStorage.getItem('verdikt_cookie_consent');
        if (cookieConsent) {
            notification.style.display = 'none';
            return;
        }
        
        setTimeout(() => {
            notification.style.display = 'flex';
        }, 1000);
        
        acceptBtn.addEventListener('click', () => {
            this.handleCookieAccept();
        });
        
        rejectBtn.addEventListener('click', () => {
            this.handleCookieReject();
        });
        
        policyLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showCookiePolicy();
        });
    }

    handleCookieAccept() {
        const notification = document.getElementById('cookie-notification');
        
        localStorage.setItem('verdikt_cookie_consent', 'accepted');
        localStorage.setItem('verdikt_cookie_date', new Date().toISOString());
        
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(100%)';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
        
        this.showNotification('Настройки cookie сохранены ✅', 'success');
    }

    handleCookieReject() {
        const notification = document.getElementById('cookie-notification');
        
        localStorage.setItem('verdikt_cookie_consent', 'rejected');
        
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(100%)';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
        
        this.showNotification('Файлы cookie отключены', 'info');
    }

    showCookiePolicy() {
        alert(`Политика использования файлов cookie в Verdikt GPT:

1. Обязательные cookie:
   - Сохранение истории чатов
   - Сохранение настроек темы
   - Сохранение достижений
   - Сохранение статистики

2. Данные хранятся только локально:
   - Все данные сохраняются в вашем браузере
   - Никакая информация не отправляется на сервер
   - Вы можете очистить данные в настройках браузера

3. Для чего мы используем cookie:
   - Улучшение пользовательского опыта
   - Сохранение ваших предпочтений
   - Анализ использования (анонимный)
   - Работа в офлайн-режиме

4. Ваши права:
   - Вы можете отключить cookie в любое время
   - Вы можете очистить все сохраненные данные
   - Все данные хранятся локально на вашем устройстве

Все данные обрабатываются анонимно и используются только для улучшения работы приложения.`);
    }

    updateActivityChart() {
        const ctx = document.getElementById('activity-chart').getContext('2d');
        
        if (this.activityChart) {
            this.activityChart.destroy();
        }
        
        this.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => i + ':00'),
                datasets: [{
                    label: 'Активность по часам',
                    data: this.state.stats.activityByHour,
                    borderColor: '#ec4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'var(--text-secondary)'
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'var(--text-secondary)',
                            maxRotation: 45
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    }
                }
            }
        });
    }

    updatePopularTopics() {
        const topicsElement = document.getElementById('popular-topics');
        let topicsHTML = '';
        
        if (this.state.stats.manipulationRequests > 0) {
            topicsHTML += `<div style="margin-bottom: 10px;">🛡️ Манипуляции: ${this.state.stats.manipulationRequests} запросов</div>`;
        }
        
        if (this.state.stats.relationshipAdvice > 0) {
            topicsHTML += `<div style="margin-bottom: 10px;">💕 Отношения: ${this.state.stats.relationshipAdvice} советов</div>`;
        }
        
        if (this.state.stats.datingAdvice > 0) {
            topicsHTML += `<div style="margin-bottom: 10px;">👥 Знакомства: ${this.state.stats.datingAdvice} консультаций</div>`;
        }
        
        if (!topicsHTML) {
            topicsHTML = 'Пока нет данных о популярных темах';
        }
        
        topicsElement.innerHTML = topicsHTML;
    }

    saveSettings() {
        const temperature = parseFloat(document.getElementById('temperature-slider').value);
        this.API_CONFIG.temperature = temperature;
        
        this.saveChats();
        
        this.hideModal('settings-modal');
        this.showNotification('Настройки сохранены ✅', 'success');
    }

    updateOnlineStatus(isOnline) {
        const statusElement = document.getElementById('offline-status');
        if (isOnline) {
            statusElement.innerHTML = '<i class="fas fa-wifi"></i> Онлайн';
            statusElement.style.color = '#4ade80';
            this.showNotification('Подключение восстановлено', 'success');
        } else {
            statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Офлайн';
            statusElement.style.color = '#f87171';
            this.showNotification('Нет подключения к интернету', 'warning');
        }
    }

    createSlides() {
        this.state.slides = [];
        const messages = this.elements.chatMessages.querySelectorAll('.message');
        
        messages.forEach((msg, index) => {
            this.state.slides.push({
                content: msg.outerHTML,
                index: index
            });
        });
        
        this.state.currentSlide = 0;
    }

    showSlide(index) {
        if (index >= 0 && index < this.state.slides.length) {
            this.state.currentSlide = index;
            this.elements.chatMessages.innerHTML = this.state.slides[index].content;
            this.elements.chatMessages.scrollTop = 0;
        }
    }

    prevSlide() {
        this.showSlide(this.state.currentSlide - 1);
    }

    nextSlide() {
        this.showSlide(this.state.currentSlide + 1);
    }

    exportChat(format) {
        const chatContent = this.state.conversationHistory
            .filter(msg => msg.role !== 'system')
            .map(msg => `${msg.role === 'user' ? 'Вы' : 'Эксперт'}: ${msg.content}`)
            .join('\n\n');
        
        let content, mimeType, extension;
        
        switch(format) {
            case 'pdf':
                window.print();
                return;
            case 'markdown':
                content = `# Консультация по отношениям - Verdikt GPT\n\n${chatContent}`;
                mimeType = 'text/markdown';
                extension = 'md';
                break;
            case 'html':
                content = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Консультация по отношениям - Verdikt GPT</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #fdf2f8; }
            .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
            .user { background: #ec4899; color: white; }
            .ai { background: #fce7f3; }
        </style>
    </head>
    <body>
        <h1 style="color: #ec4899;">Консультация по отношениям - Verdikt GPT</h1>
        <p>Экспортировано: ${new Date().toLocaleString()}</p>
        <div>${chatContent.replace(/\n/g, '<br>')}</div>
    </body>
</html>`;
                mimeType = 'text/html';
                extension = 'html';
                break;
            case 'json':
                content = JSON.stringify({
                    chat: this.state.conversationHistory.filter(msg => msg.role !== 'system'),
                    metadata: {
                        exported: new Date().toISOString(),
                        totalMessages: this.state.stats.totalMessages,
                        model: 'microsoft/DialoGPT-medium',
                        topics: {
                            manipulations: this.state.stats.manipulationRequests,
                            relationships: this.state.stats.relationshipAdvice,
                            dating: this.state.stats.datingAdvice
                        }
                    }
                }, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verdikt-консультация-${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.hideModal('export-modal');
        this.showNotification(`Консультация экспортирована в ${format.toUpperCase()} 📥`, 'success');
    }

    exportAllChats() {
        const allChatsData = {
            version: '2.1',
            timestamp: new Date().toISOString(),
            chats: this.chatManager.chats,
            metadata: {
                totalChats: this.chatManager.chats.length,
                totalMessages: this.state.stats.totalMessages,
                model: 'microsoft/DialoGPT-medium'
            }
        };
        
        const content = JSON.stringify(allChatsData, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verdikt-all-chats-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Все чаты экспортированы 📥', 'success');
    }

    showQuickCommands() {
        const commands = [
            '/clear - Очистить текущий чат',
            '/save - Сохранить все чаты',
            '/export - Экспорт в разные форматы',
            '/history - Показать историю чатов',
            '/import - Импорт чатов из файла',
            '/advice - Совет по отношениям',
            '/manipulation - Распознавание манипуляций',
            '/stats - Статистика',
            '/presentation - Режим презентации',
            '/help - Помощь по командам'
        ];
        
        alert('Доступные команды:\n\n' + commands.join('\n'));
    }

    showConnectionSuccessAnimation() {
        const particlesContainer = document.getElementById('connection-particles');
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = '50%';
            particle.style.top = '50%';
            particle.style.background = '#4ade80';
            particle.style.width = '6px';
            particle.style.height = '6px';
            particle.style.animation = 'particleFlow 1.5s ease-out forwards';
            particlesContainer.appendChild(particle);
            
            setTimeout(() => particle.remove(), 1500);
        }
    }

    // ==================== ИМПОРТ/ЭКСПОРТ ====================

    setupImportListeners() {
        // Открытие файлового диалога
        this.elements.importDropzone.addEventListener('click', () => {
            this.elements.importFileInput.click();
        });
        
        // Drag & drop
        this.elements.importDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.importDropzone.style.borderColor = 'var(--primary)';
            this.elements.importDropzone.style.background = 'rgba(236, 72, 153, 0.1)';
        });
        
        this.elements.importDropzone.addEventListener('dragleave', () => {
            this.elements.importDropzone.style.borderColor = 'var(--border-color)';
            this.elements.importDropzone.style.background = '';
        });
        
        this.elements.importDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.importDropzone.style.borderColor = 'var(--border-color)';
            this.elements.importDropzone.style.background = '';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/json') {
                this.handleImportFile(file);
            } else {
                this.showNotification('Пожалуйста, выберите файл JSON', 'error');
            }
        });
        
        // Выбор файла
        this.elements.importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImportFile(file);
            }
        });
        
        // Кнопки
        this.elements.importConfirm.addEventListener('click', () => {
            this.importChat();
        });
        
        this.elements.importCancel.addEventListener('click', () => {
            this.hideModal('import-modal');
        });
        
        this.elements.importModalClose.addEventListener('click', () => {
            this.hideModal('import-modal');
        });
    }

    setupExportListeners() {
        // Выбор формата экспорта
        document.querySelectorAll('#export-chat-modal .export-option[data-format]').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('#export-chat-modal .export-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                
                // Показываем/скрываем заметку о шифровании
                const format = option.dataset.format;
                if (format === 'json-encrypted') {
                    this.elements.encryptionNote.style.display = 'block';
                } else {
                    this.elements.encryptionNote.style.display = 'none';
                }
            });
        });
        
        // Кнопки
        this.elements.exportChatConfirm.addEventListener('click', () => {
            const selectedFormat = document.querySelector('#export-chat-modal .export-option.active')?.dataset.format;
            if (selectedFormat) {
                this.exportChatToFile(selectedFormat);
            }
        });
        
        this.elements.exportChatCancel.addEventListener('click', () => {
            this.hideModal('export-chat-modal');
        });
        
        this.elements.exportChatModalClose.addEventListener('click', () => {
            this.hideModal('export-chat-modal');
        });
    }

    async handleImportFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            this.showImportPreview(data);
            this.elements.importConfirm.disabled = false;
            
        } catch (error) {
            console.error('Error reading import file:', error);
            this.showNotification('Ошибка чтения файла. Проверьте формат.', 'error');
        }
    }

    showImportPreview(data) {
        this.elements.importPreview.style.display = 'block';
        
        let previewHTML = '';
        
        if (data.chats && Array.isArray(data.chats)) {
            previewHTML = `<p>Найдено ${data.chats.length} чатов:</p><ul>`;
            data.chats.forEach((chat, index) => {
                previewHTML += `
                    <li style="margin-bottom: 8px;">
                        <strong>${chat.title || 'Без названия'}</strong><br>
                        <small>${new Date(chat.timestamp).toLocaleString('ru-RU')}</small><br>
                        <small>${chat.messages?.length || 0} сообщений</small>
                    </li>
                `;
            });
            previewHTML += '</ul>';
        } else if (data.messages && Array.isArray(data.messages)) {
            previewHTML = `
                <p><strong>${data.title || 'Импортируемый чат'}</strong></p>
                <p>Сообщений: ${data.messages.length}</p>
                <p>Дата: ${new Date(data.timestamp || Date.now()).toLocaleString('ru-RU')}</p>
            `;
        } else {
            previewHTML = '<p>Неизвестный формат данных</p>';
        }
        
        this.elements.importPreviewContent.innerHTML = previewHTML;
    }

    async importChat() {
        try {
            const file = this.elements.importFileInput.files[0];
            if (!file) return;
            
            const text = await file.text();
            const data = JSON.parse(text);
            
            let importedChats = [];
            
            if (data.chats && Array.isArray(data.chats)) {
                importedChats = data.chats;
            } else if (data.messages) {
                importedChats = [data];
            } else {
                throw new Error('Неверный формат файла');
            }
            
            // Добавляем чаты с новыми ID
            importedChats.forEach(chat => {
                const newId = 'chat-' + this.chatManager.nextChatId++;
                const newChat = {
                    ...chat,
                    id: newId,
                    timestamp: chat.timestamp || Date.now()
                };
                
                this.chatManager.chats.push(newChat);
            });
            
            await this.saveChats();
            
            // Загружаем последний импортированный чат
            if (importedChats.length > 0) {
                const lastChat = this.chatManager.chats[this.chatManager.chats.length - 1];
                await this.loadChat(lastChat.id);
            }
            
            this.hideModal('import-modal');
            this.state.stats.totalChats = this.chatManager.chats.length;
            this.updateSettingsStats();
            this.showNotification(`Импортировано ${importedChats.length} чатов ✅`, 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            this.showNotification('Ошибка импорта: ' + error.message, 'error');
        }
    }

    async exportChatToFile(format) {
        try {
            if (!this.chatManager.currentChatId) {
                this.showNotification('Нет активного чата для экспорта', 'error');
                return;
            }
            
            const chat = this.chatManager.chats.find(c => c.id === this.chatManager.currentChatId);
            
            if (!chat) {
                this.showNotification('Чат не найден', 'error');
                return;
            }
            
            let exportData;
            let filename;
            let mimeType = 'application/json';
            
            if (format === 'json-encrypted') {
                const password = prompt('Введите пароль для шифрования (минимум 8 символов):');
                if (!password || password.length < 8) {
                    this.showNotification('Пароль должен быть не менее 8 символов', 'error');
                    return;
                }
                
                const confirmPassword = prompt('Подтвердите пароль:');
                if (password !== confirmPassword) {
                    this.showNotification('Пароли не совпадают', 'error');
                    return;
                }
                
                const encryptedData = await this.crypto.encrypt(chat, password);
                
                exportData = {
                    version: '2.1',
                    type: 'verdikt-chat-encrypted',
                    timestamp: Date.now(),
                    data: encryptedData,
                    metadata: {
                        title: chat.title,
                        messageCount: chat.messages?.length || 0,
                        encryption: 'AES-GCM-256'
                    }
                };
                
                filename = `verdikt-chat-encrypted-${Date.now()}.json`;
                
            } else {
                exportData = chat;
                filename = `verdikt-chat-${Date.now()}.json`;
            }
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.hideModal('export-chat-modal');
            this.showNotification('Чат экспортирован 📥', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Ошибка экспорта: ' + error.message, 'error');
        }
    }

    showImportModal() {
        this.elements.importFileInput.value = '';
        this.elements.importPreview.style.display = 'none';
        this.elements.importConfirm.disabled = true;
        this.showModal('import-modal');
    }

    showExportChatModal() {
        document.querySelectorAll('#export-chat-modal .export-option').forEach(opt => opt.classList.remove('active'));
        const firstOption = document.querySelector('#export-chat-modal .export-option');
        if (firstOption) {
            firstOption.classList.add('active');
            if (firstOption.dataset.format === 'json-encrypted') {
                this.elements.encryptionNote.style.display = 'block';
            }
        }
        this.showModal('export-chat-modal');
    }

    startAutoSave() {
        if (!this.chatManager.autoSave) return;
        
        // Сохраняем каждые 30 секунд
        this.chatManager.autoSaveTimer = setInterval(async () => {
            if (this.chatManager.currentChatId && this.state.messageCount > 1) {
                await this.saveChats();
            }
        }, this.chatManager.autoSaveInterval);
        
        // Сохраняем при закрытии страницы
        window.addEventListener('beforeunload', () => {
            if (this.chatManager.currentChatId && this.state.messageCount > 1) {
                this.saveChatsSync();
            }
        });
    }

    saveChatsSync() {
        try {
            localStorage.setItem('verdikt_chats', JSON.stringify(this.chatManager.chats));
            if (this.chatManager.currentChatId) {
                localStorage.setItem('verdikt_last_active_chat', this.chatManager.currentChatId);
            }
        } catch (error) {
            console.error('Sync save error:', error);
        }
    }

    // Методы управления шифрованием (сокращенные)
    showEncryptionManager() {
        const modalHTML = `
        <div class="modal" id="encryption-manager-modal">
            <div class="modal-content" style="max-width: 500px;">
                <h2 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-user-shield"></i> Управление шифрованием
                </h2>
                
                <div class="modal-section">
                    <h3><i class="fas fa-lock"></i> Статус шифрования</h3>
                    <div style="display: flex; align-items: center; gap: 15px; margin: 20px 0;">
                        <div style="
                            width: 50px;
                            height: 50px;
                            border-radius: 12px;
                            background: ${this.encryptionState.enabled ? 
                                'linear-gradient(135deg, #10b981, #059669)' : 
                                'linear-gradient(135deg, #ef4444, #dc2626)'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                        ">
                            <i class="fas fa-${this.encryptionState.enabled ? 'shield-alt' : 'unlock'}"></i>
                        </div>
                        <div>
                            <h4 style="margin-bottom: 5px;">
                                ${this.encryptionState.enabled ? 'Шифрование включено' : 'Шифрование отключено'}
                            </h4>
                            <p style="font-size: 0.9rem; color: var(--text-tertiary);">
                                ${this.encryptionState.enabled ? 
                                    'Ваши данные защищены паролем' : 
                                    'Данные хранятся без шифрования'}
                            </p>
                        </div>
                    </div>
                </div>
                
                ${this.encryptionState.enabled ? `
                <div class="modal-section" style="margin-top: 25px;">
                    <h3><i class="fas fa-cog"></i> Настройки безопасности</h3>
                    
                    <div style="margin-top: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">
                            Время автоблокировки:
                        </label>
                        <select id="auto-lock-time" style="
                            width: 100%; padding: 12px; border-radius: 8px;
                            background: var(--bg-card); border: 1px solid var(--border-color);
                            color: var(--text-primary); font-family: inherit;
                        ">
                            <option value="5" ${this.encryptionState.autoLockTimeout === 5*60*1000 ? 'selected' : ''}>
                                5 минут бездействия
                            </option>
                            <option value="15" ${this.encryptionState.autoLockTimeout === 15*60*1000 ? 'selected' : ''}>
                                15 минут бездействия
                            </option>
                            <option value="30" ${this.encryptionState.autoLockTimeout === 30*60*1000 ? 'selected' : ''}>
                                30 минут бездействия
                            </option>
                            <option value="60" ${this.encryptionState.autoLockTimeout === 60*60*1000 ? 'selected' : ''}>
                                1 час бездействия
                            </option>
                            <option value="0">Никогда не блокировать</option>
                        </select>
                    </div>
                    
                    <button class="ios-button secondary" id="change-password" 
                            style="width: 100%; margin-top: 15px;">
                        <i class="fas fa-key"></i> Изменить пароль
                    </button>
                    
                    <button class="ios-button tertiary" id="export-backup" 
                            style="width: 100%; margin-top: 10px;">
                        <i class="fas fa-download"></i> Экспорт резервной копии
                    </button>
                    
                    <button class="ios-button" id="disable-encryption" 
                            style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, #ef4444, #dc2626);">
                        <i class="fas fa-unlock"></i> Отключить шифрование
                    </button>
                </div>
                ` : `
                <div class="modal-section" style="margin-top: 25px;">
                    <h3><i class="fas fa-shield-alt"></i> Включить шифрование</h3>
                    <p style="margin: 15px 0; color: var(--text-secondary);">
                        Защитите ваши конфиденциальные беседы с помощью шифрования.
                        После включения потребуется пароль для доступа к данным.
                    </p>
                    <button class="ios-button" id="enable-encryption" style="width: 100%;">
                        <i class="fas fa-lock"></i> Включить шифрование
                    </button>
                </div>
                `}
                
                <div class="modal-buttons" style="display: flex; gap: 10px; margin-top: 30px;">
                    <button class="ios-button secondary" id="close-encryption-manager">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('encryption-manager-modal');
        modal.classList.add('active');
        
        if (this.encryptionState.enabled) {
            document.getElementById('auto-lock-time').addEventListener('change', (e) => {
                const minutes = parseInt(e.target.value);
                this.encryptionState.autoLockTimeout = minutes * 60 * 1000;
                
                if (minutes === 0) {
                    clearTimeout(this.encryptionState.lockTimer);
                } else {
                    this.startAutoLockTimer();
                }
                
                this.showNotification('Настройки сохранены', 'success');
            });
            
            document.getElementById('change-password').addEventListener('click', () => {
                modal.remove();
                this.showChangePasswordModal();
            });
            
            document.getElementById('export-backup').addEventListener('click', () => {
                this.exportEncryptedBackup();
            });
            
            document.getElementById('disable-encryption').addEventListener('click', () => {
                if (confirm('Вы уверены? После отключения шифрования данные будут храниться в открытом виде.')) {
                    this.disableEncryption();
                    modal.remove();
                }
            });
        } else {
            document.getElementById('enable-encryption').addEventListener('click', () => {
                modal.remove();
                this.showEncryptionSetupWizard();
            });
        }
        
        document.getElementById('close-encryption-manager').addEventListener('click', () => {
            modal.remove();
        });
    }

    showChangePasswordModal() {
        this.showNotification('Функция изменения пароля в разработке', 'info');
    }

    async exportEncryptedBackup() {
        try {
            const encryptedData = localStorage.getItem('verdikt_encrypted_data');
            
            if (!encryptedData) {
                this.showNotification('Нет данных для экспорта', 'warning');
                return;
            }
            
            const backupData = {
                version: '2.1',
                timestamp: new Date().toISOString(),
                data: encryptedData,
                metadata: {
                    model: 'microsoft/DialoGPT-medium',
                    encryption: 'AES-GCM-256',
                    chatCount: this.chatManager.chats.length
                }
            };
            
            const blob = new Blob([JSON.stringify(backupData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `verdikt-backup-${new Date().toISOString().split('T')[0]}.encrypted.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Резервная копия экспортирована 🔐', 'success');
            
        } catch (error) {
            console.error('Export backup error:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    async disableEncryption() {
        try {
            const password = await this.showPasswordPrompt();
            if (!password) return;
            
            const storedHash = localStorage.getItem('verdikt_password_hash');
            const inputHash = await this.crypto.hashPassword(password);
            
            if (storedHash !== inputHash) {
                this.showNotification('Неверный пароль', 'error');
                return;
            }
            
            const encryptedData = localStorage.getItem('verdikt_encrypted_data');
            const decryptedData = await this.crypto.decrypt(encryptedData, password);
            
            // Сохраняем данные без шифрования
            if (decryptedData.chats) {
                localStorage.setItem('verdikt_chats', JSON.stringify(decryptedData.chats));
                this.chatManager.chats = decryptedData.chats;
            }
            
            if (decryptedData.stats) {
                localStorage.setItem('verdikt_stats', JSON.stringify(decryptedData.stats));
                Object.assign(this.state.stats, decryptedData.stats);
            }
            
            if (decryptedData.achievements) {
                localStorage.setItem('verdikt_achievements', JSON.stringify(decryptedData.achievements));
                Object.keys(decryptedData.achievements).forEach(key => {
                    if (this.state.achievements[key]) {
                        this.state.achievements[key].unlocked = decryptedData.achievements[key].unlocked;
                    }
                });
            }
            
            // Очищаем зашифрованные данные
            localStorage.removeItem('verdikt_encrypted_data');
            localStorage.removeItem('verdikt_password_hash');
            localStorage.setItem('verdikt_encryption_setup', 'skipped');
            
            this.encryptionState.enabled = false;
            this.encryptionState.password = null;
            this.encryptionState.passwordHash = null;
            this.encryptionState.isLocked = false;
            
            clearTimeout(this.encryptionState.lockTimer);
            
            this.showNotification('Шифрование отключено', 'success');
            
        } catch (error) {
            console.error('Disable encryption error:', error);
            this.showNotification('Ошибка отключения шифрования', 'error');
        }
    }

    async showPasswordPrompt() {
        return new Promise((resolve) => {
            const modalHTML = `
            <div class="modal" id="password-prompt-modal">
                <div class="modal-content" style="max-width: 400px;">
                    <h2 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-lock"></i> Требуется пароль
                    </h2>
                    
                    <p style="margin-bottom: 20px; color: var(--text-secondary);">
                        Введите пароль для доступа к зашифрованным данным
                    </p>
                    
                    <input type="password" id="unlock-password" 
                           placeholder="Пароль" 
                           style="width: 100%; padding: 12px; border-radius: 8px; 
                                  background: var(--bg-card); border: 1px solid var(--border-color);
                                  color: var(--text-primary); margin-bottom: 20px;">
                    
                    <div class="modal-buttons" style="display: flex; gap: 10px;">
                        <button class="ios-button secondary" id="cancel-unlock">
                            Отмена
                        </button>
                        <button class="ios-button" id="confirm-unlock">
                            Разблокировать
                        </button>
                    </div>
                </div>
            </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById('password-prompt-modal');
            modal.classList.add('active');
            
            const passwordInput = document.getElementById('unlock-password');
            passwordInput.focus();
            
            document.getElementById('confirm-unlock').addEventListener('click', () => {
                const password = passwordInput.value;
                modal.remove();
                resolve(password);
            });
            
            document.getElementById('cancel-unlock').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });
            
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('confirm-unlock').click();
                }
            });
        });
    }
}