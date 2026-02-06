/**
 * Основное приложение чата с ИИ
 */

class ChatApp {
    constructor() {
        this.currentChatId = this.generateChatId();
        this.messages = [];
        this.isTyping = false;
        this.settings = this.loadSettings();
        
        this.initializeElements();
        this.initializeEventListeners();
        this.loadChatHistory();
        this.applySettings();
    }

    /**
     * Генерация уникального ID для чата
     * @returns {string} - Уникальный ID
     */
    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Инициализация DOM элементов
     */
    initializeElements() {
        // Основные элементы
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.chatHistory = document.getElementById('chatHistory');
        this.currentChatTitle = document.getElementById('currentChatTitle');
        
        // Настройки
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.resetSettingsBtn = document.getElementById('resetSettingsBtn');
        this.copyApiBtn = document.getElementById('copyApiBtn');
        this.animationsToggle = document.getElementById('animationsToggle');
        this.soundToggle = document.getElementById('soundToggle');
        this.historyToggle = document.getElementById('historyToggle');
        
        // Тема
        this.themeOptions = document.querySelectorAll('.theme-option');
        
        // Модальное окно
        this.notificationModal = document.getElementById('notificationModal');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
        this.modalOkBtn = document.getElementById('modalOkBtn');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalMessage = document.getElementById('modalMessage');
        
        // Кнопки предложений
        this.suggestionCards = document.querySelectorAll('.suggestion-card');
        
        // Прочие элементы
        this.shareChatBtn = document.getElementById('shareChatBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.attachBtn = document.getElementById('attachBtn');
    }

    /**
     * Инициализация обработчиков событий
     */
    initializeEventListeners() {
        // Отправка сообщения
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Автоматическое изменение высоты textarea
        this.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
        });

        // Новый чат
        this.newChatBtn.addEventListener('click', () => this.createNewChat());

        // Очистка чата
        this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());

        // Настройки
        this.settingsBtn.addEventListener('click', () => this.toggleSettingsPanel(true));
        this.closeSettingsBtn.addEventListener('click', () => this.toggleSettingsPanel(false));
        
        // Сохранение настроек
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());
        
        // Копирование API
        this.copyApiBtn.addEventListener('click', () => this.copyApiEndpoint());
        
        // Выбор темы
        this.themeOptions.forEach(option => {
            option.addEventListener('click', () => this.selectTheme(option.dataset.theme));
        });

        // Модальное окно
        this.modalCloseBtn.addEventListener('click', () => this.hideModal());
        this.modalOkBtn.addEventListener('click', () => this.hideModal());

        // Карточки предложений
        this.suggestionCards.forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                this.messageInput.value = prompt;
                this.adjustTextareaHeight();
                this.messageInput.focus();
            });
        });

        // Поделиться чатом
        this.shareChatBtn.addEventListener('click', () => this.shareChat());

        // Полноэкранный режим
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Прикрепление файла
        this.attachBtn.addEventListener('click', () => this.attachFile());
        
        // Загрузка чата из истории
        document.addEventListener('click', (e) => {
            if (e.target.closest('.chat-item')) {
                const chatItem = e.target.closest('.chat-item');
                const chatId = chatItem.dataset.chatId;
                this.loadChat(chatId);
            }
        });
    }

    /**
     * Настройка высоты textarea
     */
    adjustTextareaHeight() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
    }

    /**
     * Отправка сообщения
     */
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) return;
        
        // Очищаем поле ввода
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        
        // Добавляем сообщение пользователя
        this.addMessage(message, 'user');
        
        // Показываем индикатор набора
        this.showTypingIndicator(true);
        
        try {
            // Получаем ответ от ИИ
            const response = await aiService.sendMessage(message, this.messages);
            
            // Добавляем ответ ИИ
            this.addMessage(response, 'ai');
            
            // Сохраняем историю
            this.saveCurrentChat();
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка', 'Не удалось получить ответ от ИИ. Пожалуйста, попробуйте еще раз.');
        } finally {
            // Скрываем индикатор набора
            this.showTypingIndicator(false);
        }
    }

    /**
     * Добавление сообщения в чат
     * @param {string} text - Текст сообщения
     * @param {string} sender - Отправитель ('user' или 'ai')
     */
    addMessage(text, sender) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Создаем элемент сообщения
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.id = messageId;
        
        // Определяем аватар и отправителя
        const avatarIcon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
        const senderName = sender === 'user' ? 'Вы' : 'ИИ Ассистент';
        
        // Форматируем текст (подсветка кода и т.д.)
        const formattedText = this.formatMessageText(text);
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="${avatarIcon}"></i>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderName}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-text">${formattedText}</div>
                <div class="message-actions">
                    <button class="message-action-btn copy-message-btn" title="Копировать">
                        <i class="fas fa-copy"></i>
                        <span>Копировать</span>
                    </button>
                    <button class="message-action-btn regenerate-btn" title="Перегенерировать">
                        <i class="fas fa-redo"></i>
                        <span>Перегенерировать</span>
                    </button>
                </div>
            </div>
        `;
        
        // Добавляем сообщение в контейнер
        this.messagesContainer.appendChild(messageElement);
        
        // Удаляем экран приветствия, если он есть
        const welcomeScreen = this.messagesContainer.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.remove();
        }
        
        // Прокручиваем к последнему сообщению
        this.scrollToBottom();
        
        // Добавляем обработчики для кнопок сообщения
        this.attachMessageActions(messageElement, messageId, text, sender);
        
        // Сохраняем в массив сообщений
        this.messages.push({
            id: messageId,
            role: sender,
            content: text,
            timestamp: Date.now()
        });
        
        // Обновляем заголовок чата на основе первого сообщения
        if (this.messages.length === 1) {
            const title = aiService.generateChatTitle(text);
            this.currentChatTitle.textContent = title;
        }
    }

    /**
     * Форматирование текста сообщения (подсветка кода и т.д.)
     * @param {string} text - Исходный текст
     * @returns {string} - Отформатированный HTML
     */
    formatMessageText(text) {
        // Экранирование HTML
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Обработка блоков кода
        formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
            // Определяем язык программирования (если указан)
            const firstLine = code.split('\n')[0];
            const languageMatch = firstLine.match(/^(\w+)/);
            const language = languageMatch ? languageMatch[1] : '';
            const codeContent = language ? code.replace(firstLine, '') : code;
            
            return `<pre><code class="language-${language}">${codeContent.trim()}</code></pre>`;
        });
        
        // Обработка встроенного кода
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Обработка ссылок (простой вариант)
        formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Обработка переносов строк
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Обработка жирного текста
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Обработка курсива
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        return formatted;
    }

    /**
     * Прикрепление обработчиков к действиям сообщения
     * @param {HTMLElement} messageElement - Элемент сообщения
     * @param {string} messageId - ID сообщения
     * @param {string} text - Текст сообщения
     * @param {string} sender - Отправитель
     */
    attachMessageActions(messageElement, messageId, text, sender) {
        // Копирование сообщения
        const copyBtn = messageElement.querySelector('.copy-message-btn');
        copyBtn.addEventListener('click', () => {
            this.copyToClipboard(text);
            this.showNotification('Успех', 'Сообщение скопировано в буфер обмена');
        });
        
        // Перегенерация (только для ответов ИИ)
        const regenerateBtn = messageElement.querySelector('.regenerate-btn');
        if (sender === 'ai') {
            regenerateBtn.addEventListener('click', () => {
                this.regenerateMessage(messageId);
            });
        } else {
            regenerateBtn.style.display = 'none';
        }
    }

    /**
     * Перегенерация сообщения ИИ
     * @param {string} messageId - ID сообщения для перегенерации
     */
    async regenerateMessage(messageId) {
        // Находим индекс сообщения
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1 || this.messages[messageIndex].role !== 'ai') return;
        
        // Находим предыдущее сообщение пользователя
        let userMessageIndex = -1;
        for (let i = messageIndex - 1; i >= 0; i--) {
            if (this.messages[i].role === 'user') {
                userMessageIndex = i;
                break;
            }
        }
        
        if (userMessageIndex === -1) return;
        
        const userMessage = this.messages[userMessageIndex].content;
        
        // Удаляем старое сообщение ИИ и все последующие сообщения
        this.messages.splice(messageIndex);
        
        // Удаляем соответствующие DOM элементы
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            let nextElement = messageElement.nextElementSibling;
            messageElement.remove();
            
            while (nextElement && nextElement.classList.contains('message')) {
                const temp = nextElement.nextElementSibling;
                nextElement.remove();
                nextElement = temp;
            }
        }
        
        // Показываем индикатор набора
        this.showTypingIndicator(true);
        
        try {
            // Получаем новый ответ
            const response = await aiService.sendMessage(userMessage, this.messages.slice(0, userMessageIndex + 1));
            
            // Добавляем новый ответ
            this.addMessage(response, 'ai');
            
            // Сохраняем историю
            this.saveCurrentChat();
            
        } catch (error) {
            console.error('Ошибка при перегенерации:', error);
            this.showNotification('Ошибка', 'Не удалось перегенерировать ответ');
        } finally {
            this.showTypingIndicator(false);
        }
    }

    /**
     * Показ/скрытие индикатора набора текста
     * @param {boolean} show - Показать или скрыть
     */
    showTypingIndicator(show) {
        this.isTyping = show;
        
        if (show) {
            this.typingIndicator.classList.add('active');
        } else {
            this.typingIndicator.classList.remove('active');
        }
    }

    /**
     * Прокрутка к последнему сообщению
     */
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Создание нового чата
     */
    createNewChat() {
        // Сохраняем текущий чат, если есть сообщения
        if (this.messages.length > 0) {
            this.saveCurrentChat();
        }
        
        // Генерируем новый ID
        this.currentChatId = this.generateChatId();
        this.messages = [];
        
        // Очищаем контейнер сообщений
        this.messagesContainer.innerHTML = `
            <div class="welcome-screen fade-in">
                <div class="welcome-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h1>Добро пожаловать в ИИ Чат</h1>
                <p>Задайте любой вопрос, и я постараюсь вам помочь!</p>
                
                <div class="suggestions">
                    <h3>Примеры запросов:</h3>
                    <div class="suggestion-cards">
                        <button class="suggestion-card" data-prompt="Объясни квантовую физику простыми словами">
                            <i class="fas fa-atom"></i>
                            <span>Объясни квантовую физику простыми словами</span>
                        </button>
                        <button class="suggestion-card" data-prompt="Напиши код для сортировки пузырьком на Python">
                            <i class="fas fa-code"></i>
                            <span>Напиши код для сортировки пузырьком на Python</span>
                        </button>
                        <button class="suggestion-card" data-prompt="Придумай план для путешествия по Японии">
                            <i class="fas fa-map-marked-alt"></i>
                            <span>Придумай план для путешествия по Японии</span>
                        </button>
                        <button class="suggestion-card" data-prompt="Составь бизнес-план для стартапа">
                            <i class="fas fa-chart-line"></i>
                            <span>Составь бизнес-план для стартапа</span>
                        </button>
                    </div>
                </div>
                
                <div class="features">
                    <h3>Возможности:</h3>
                    <div class="feature-list">
                        <div class="feature">
                            <i class="fas fa-bolt"></i>
                            <span>Быстрые ответы</span>
                        </div>
                        <div class="feature">
                            <i class="fas fa-code"></i>
                            <span>Написание кода</span>
                        </div>
                        <div class="feature">
                            <i class="fas fa-book"></i>
                            <span>Объяснение сложных тем</span>
                        </div>
                        <div class="feature">
                            <i class="fas fa-lightbulb"></i>
                            <span>Креативные идеи</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Обновляем заголовок
        this.currentChatTitle.textContent = 'Новый чат';
        
        // Перепривязываем обработчики к карточкам предложений
        setTimeout(() => {
            this.suggestionCards = document.querySelectorAll('.suggestion-card');
            this.suggestionCards.forEach(card => {
                card.addEventListener('click', () => {
                    const prompt = card.dataset.prompt;
                    this.messageInput.value = prompt;
                    this.adjustTextareaHeight();
                    this.messageInput.focus();
                });
            });
        }, 100);
        
        // Обновляем историю чатов
        this.loadChatHistory();
        
        // Фокус на поле ввода
        this.messageInput.focus();
        
        // Показываем уведомление
        this.showNotification('Новый чат', 'Создан новый чат. Начните общение!');
    }

    /**
     * Очистка текущего чата
     */
    clearCurrentChat() {
        if (this.messages.length === 0) return;
        
        if (confirm('Вы уверены, что хотите очистить текущий чат? Все сообщения будут удалены.')) {
            this.messages = [];
            
            // Очищаем контейнер сообщений
            this.messagesContainer.innerHTML = `
                <div class="welcome-screen fade-in">
                    <div class="welcome-icon">
                        <i class="fas fa-robot"></i>
                    </div>
                    <h1>Чат очищен</h1>
                    <p>Задайте новый вопрос, и я постараюсь вам помочь!</p>
                </div>
            `;
            
            // Обновляем заголовок
            this.currentChatTitle.textContent = 'Новый чат';
            
            // Сохраняем изменения
            this.saveCurrentChat();
            
            this.showNotification('Чат очищен', 'Все сообщения удалены');
        }
    }

    /**
     * Сохранение текущего чата
     */
    saveCurrentChat() {
        if (!this.settings.saveHistory) return;
        
        aiService.saveChatHistory(this.messages, this.currentChatId);
        this.loadChatHistory();
    }

    /**
     * Загрузка истории чатов
     */
    loadChatHistory() {
        const chats = aiService.getChats();
        const chatHistory = document.getElementById('chatHistory');
        
        if (chats.length === 0) {
            chatHistory.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-comments"></i>
                    <p>История чатов пуста</p>
                </div>
            `;
            return;
        }
        
        // Сортируем по времени (новые сверху)
        chats.sort((a, b) => b.timestamp - a.timestamp);
        
        let html = '';
        chats.forEach(chat => {
            const isActive = chat.id === this.currentChatId;
            const date = new Date(chat.timestamp).toLocaleDateString();
            
            html += `
                <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
                    <div class="chat-item-icon">
                        <i class="fas fa-comment"></i>
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-title">${chat.title}</div>
                        <div class="chat-item-date">${date} • ${chat.messageCount} сообщ.</div>
                    </div>
                </div>
            `;
        });
        
        chatHistory.innerHTML = html;
    }

    /**
     * Загрузка конкретного чата
     * @param {string} chatId - ID чата
     */
    loadChat(chatId) {
        // Сохраняем текущий чат, если есть сообщения
        if (this.messages.length > 0) {
            this.saveCurrentChat();
        }
        
        // Загружаем историю чата
        this.currentChatId = chatId;
        this.messages = aiService.getChatHistory(chatId);
        
        // Очищаем контейнер сообщений
        this.messagesContainer.innerHTML = '';
        
        // Добавляем сообщения
        this.messages.forEach(msg => {
            this.addMessage(msg.content, msg.role);
        });
        
        // Если нет сообщений, показываем приветственный экран
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="welcome-screen fade-in">
                    <div class="welcome-icon">
                        <i class="fas fa-robot"></i>
                    </div>
                    <h1>Чат загружен</h1>
                    <p>Продолжите общение с ИИ ассистентом</p>
                </div>
            `;
        }
        
        // Обновляем заголовок
        const chats = aiService.getChats();
        const currentChat = chats.find(chat => chat.id === chatId);
        if (currentChat) {
            this.currentChatTitle.textContent = currentChat.title;
        }
        
        // Обновляем историю чатов
        this.loadChatHistory();
        
        // Фокус на поле ввода
        this.messageInput.focus();
    }

    /**
     * Загрузка настроек из localStorage
     * @returns {Object} - Настройки
     */
    loadSettings() {
        const defaultSettings = {
            theme: 'auto',
            animations: true,
            sound: true,
            saveHistory: true
        };
        
        try {
            const saved = localStorage.getItem('ai_chat_settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            console.error('Ошибка при загрузке настроек:', error);
            return defaultSettings;
        }
    }

    /**
     * Применение настроек
     */
    applySettings() {
        // Применяем тему
        this.applyTheme(this.settings.theme);
        
        // Применяем настройки переключателей
        this.animationsToggle.checked = this.settings.animations;
        this.soundToggle.checked = this.settings.sound;
        this.historyToggle.checked = this.settings.saveHistory;
        
        // Активируем соответствующую тему в UI
        this.themeOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.theme === this.settings.theme);
        });
    }

    /**
     * Применение темы
     * @param {string} theme - Название темы
     */
    applyTheme(theme) {
        let themeToApply = theme;
        
        if (theme === 'auto') {
            // Автоматическое определение темы системы
            themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        document.documentElement.setAttribute('data-theme', themeToApply);
        localStorage.setItem('ai_chat_theme', themeToApply);
    }

    /**
     * Выбор темы
     * @param {string} theme - Название темы
     */
    selectTheme(theme) {
        this.settings.theme = theme;
        
        // Обновляем UI
        this.themeOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });
        
        // Применяем тему
        this.applyTheme(theme);
    }

    /**
     * Переключение панели настроек
     * @param {boolean} show - Показать или скрыть
     */
    toggleSettingsPanel(show) {
        if (show) {
            this.settingsPanel.classList.add('active');
        } else {
            this.settingsPanel.classList.remove('active');
        }
    }

    /**
     * Сохранение настроек
     */
    saveSettings() {
        this.settings.animations = this.animationsToggle.checked;
        this.settings.sound = this.soundToggle.checked;
        this.settings.saveHistory = this.historyToggle.checked;
        
        try {
            localStorage.setItem('ai_chat_settings', JSON.stringify(this.settings));
            this.showNotification('Настройки сохранены', 'Ваши настройки успешно сохранены');
            
            // Закрываем панель настроек
            this.toggleSettingsPanel(false);
        } catch (error) {
            console.error('Ошибка при сохранении настроек:', error);
            this.showNotification('Ошибка', 'Не удалось сохранить настройки');
        }
    }

    /**
     * Сброс настроек
     */
    resetSettings() {
        if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            localStorage.removeItem('ai_chat_settings');
            this.settings = this.loadSettings();
            this.applySettings();
            this.showNotification('Настройки сброшены', 'Все настройки восстановлены к значениям по умолчанию');
        }
    }

    /**
     * Копирование API endpoint в буфер обмена
     */
    copyApiEndpoint() {
        const apiEndpoint = 'rsk-or-v1-1bcba95c45222ff3943c6e87f8797666773118b93daaa73f52dba671364633d5';
        this.copyToClipboard(apiEndpoint);
        this.showNotification('API скопирован', 'API endpoint скопирован в буфер обмена');
    }

    /**
     * Копирование текста в буфер обмена
     * @param {string} text - Текст для копирования
     */
    copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    /**
     * Показ модального окна с уведомлением
     * @param {string} title - Заголовок
     * @param {string} message - Сообщение
     */
    showNotification(title, message) {
        this.modalTitle.textContent = title;
        this.modalMessage.textContent = message;
        this.notificationModal.classList.add('active');
        
        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            if (this.notificationModal.classList.contains('active')) {
                this.hideModal();
            }
        }, 3000);
    }

    /**
     * Скрытие модального окна
     */
    hideModal() {
        this.notificationModal.classList.remove('active');
    }

    /**
     * Поделиться чатом
     */
    shareChat() {
        if (this.messages.length === 0) {
            this.showNotification('Нечего делиться', 'В чате нет сообщений');
            return;
        }
        
        // Формируем текст для общего доступа
        let shareText = `Чат с ИИ ассистентом (${this.currentChatTitle.textContent}):\n\n`;
        
        this.messages.forEach(msg => {
            const sender = msg.role === 'user' ? 'Вы' : 'ИИ';
            shareText += `${sender}: ${msg.content}\n\n`;
        });
        
        // Копируем в буфер обмена
        this.copyToClipboard(shareText);
        this.showNotification('Чат скопирован', 'Весь чат скопирован в буфер обмена. Теперь вы можете поделиться им.');
    }

    /**
     * Переключение полноэкранного режима
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Ошибка при включении полноэкранного режима: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    /**
     * Прикрепление файла
     */
    attachFile() {
        this.showNotification('В разработке', 'Функция прикрепления файлов в разработке');
    }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const chatApp = new ChatApp();
    
    // Экспортируем в глобальную область видимости для отладки
    window.chatApp = chatApp;
});
