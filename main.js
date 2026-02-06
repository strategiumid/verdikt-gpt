// Инициализация всех функций
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация подсветки синтаксиса
    hljs.highlightAll();
    
    // Создание экземпляра приложения
    window.verdiktApp = new VerdiktChatApp();
    window.verdiktApp.init();
});

// Основной класс приложения
class VerdiktChatApp {
    constructor() {
        // Конфигурация API для Hugging Face DialoGPT-medium
        this.API_CONFIG = {
            url: 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
            apiKey: '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',
            maxTokens: 400,
            temperature: 0.7
        };

        // Состояние приложения
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
                presenter: { unlocked: false, name: "Презентатор", icon: "📊", description: "Использовали режим презентации" }
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
                popularTopics: {}
            },
            currentTheme: 'dark',
            isPresentationMode: false,
            currentSlide: 0,
            slides: [],
            retryCount: 0,
            maxRetries: 3
        };

        // DOM элементы
        this.elements = {
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            recordButton: document.getElementById('record-button'),
            voiceInput: document.getElementById('voice-input'),
            voiceOutput: document.getElementById('voice-output'),
            clearChat: document.getElementById('clear-chat'),
            exportChat: document.getElementById('export-chat'),
            saveChat: document.getElementById('save-chat'),
            newChat: document.getElementById('new-chat'),
            settingsButton: document.getElementById('settings-button'),
            presentationMode: document.getElementById('presentation-mode'),
            viewStats: document.getElementById('view-stats'),
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notification-text'),
            apiStatus: document.getElementById('api-status'),
            smartSuggestions: document.getElementById('smart-suggestions'),
            typingIndicator: document.getElementById('typing-indicator'),
            achievementNotification: document.getElementById('achievement-notification'),
            prevSlide: document.getElementById('prev-slide'),
            nextSlide: document.getElementById('next-slide'),
            exitPresentation: document.getElementById('exit-presentation'),
            settingsClose: document.getElementById('settings-close'),
            exportClose: document.getElementById('export-close'),
            exportCancel: document.getElementById('export-cancel'),
            statsClose: document.getElementById('stats-close'),
            saveSettings: document.getElementById('save-settings'),
            temperatureSlider: document.getElementById('temperature-slider'),
            temperatureValue: document.getElementById('temperature-value')
        };

        // Инициализация Web Speech API
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSynthesis = window.speechSynthesis;
        this.recognition = null;
        
        // Инициализация Chart.js
        this.activityChart = null;
    }

    init() {
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.setupSpeechRecognition();
        this.setupBackgroundAnimations();
        this.updateUI();
        this.checkApiStatus();
        this.setupKeyboardShortcuts();
        this.setupServiceWorker();
        
        // Отметить активность текущего часа
        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        this.saveToLocalStorage();
        
        console.log('Verdikt GPT с Hugging Face DialoGPT-medium инициализирован');
    }

    setupEventListeners() {
        // Отправка сообщения
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Голосовой ввод
        this.elements.recordButton.addEventListener('click', () => this.toggleVoiceRecording());
        this.elements.voiceInput.addEventListener('click', () => this.toggleVoiceRecording());
        this.elements.voiceOutput.addEventListener('click', () => this.speakLastMessage());
        
        // Быстрые команды
        document.querySelectorAll('.command-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.target.dataset.command;
                this.handleCommand(command);
            });
        });
        
        // Режимы AI
        document.querySelectorAll('.mode-item').forEach(mode => {
            mode.addEventListener('click', (e) => {
                const modeId = e.currentTarget.dataset.mode;
                this.setAIMode(modeId);
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
        
        // Управление чатом
        this.elements.clearChat.addEventListener('click', () => this.clearChat());
        this.elements.exportChat.addEventListener('click', () => this.showExportModal());
        this.elements.saveChat.addEventListener('click', () => this.saveChat());
        this.elements.newChat.addEventListener('click', () => this.createNewChat());
        this.elements.settingsButton.addEventListener('click', () => this.showSettingsModal());
        this.elements.presentationMode.addEventListener('click', () => this.togglePresentationMode());
        this.elements.viewStats.addEventListener('click', () => this.showStatsModal());
        
        // Температура модели
        this.elements.temperatureSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.elements.temperatureValue.textContent = value;
            this.API_CONFIG.temperature = parseFloat(value);
        });
        
        // Тема оформления
        document.querySelectorAll('.theme-option').forEach(theme => {
            theme.addEventListener('click', (e) => {
                const themeName = e.currentTarget.dataset.theme;
                this.setTheme(themeName);
            });
        });
        
        // Экспорт
        document.querySelectorAll('.export-option').forEach(option => {
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
        
        // Навигация презентации
        this.elements.prevSlide.addEventListener('click', () => this.prevSlide());
        this.elements.nextSlide.addEventListener('click', () => this.nextSlide());
        this.elements.exitPresentation.addEventListener('click', () => this.togglePresentationMode());
        
        // Обработка ввода текста
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 200) + 'px';
        });
        
        // Слежение за онлайн статусом
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
        
        // Сохранение перед закрытием
        window.addEventListener('beforeunload', () => this.saveToLocalStorage());
        
        // Футер ссылки
        document.getElementById('model-info').addEventListener('click', (e) => {
            e.preventDefault();
            this.showNotification('Модель: microsoft/DialoGPT-medium (Hugging Face)', 'info');
        });
        
        document.getElementById('keyboard-shortcuts').addEventListener('click', (e) => {
            e.preventDefault();
            this.showQuickCommands();
        });
        
        document.getElementById('privacy-policy').addEventListener('click', (e) => {
            e.preventDefault();
            this.showNotification('Используется Hugging Face API. Данные анонимизированы.', 'info');
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.sendMessage();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.showQuickCommands();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveChat();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.showExportModal();
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
            
            // Навигация в режиме презентации
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

    setupBackgroundAnimations() {
        // Создаем плавающие сердечки
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

        // Создаем частицы подключения
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
        // Показать анимацию подключения
        this.elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i> Подключение к Hugging Face...';
        this.elements.apiStatus.classList.add('api-connecting');
        this.elements.apiStatus.classList.remove('api-error');
        
        // Устанавливаем флаг подключения
        this.state.isApiConnected = true;
        
        // Проверка доступности API с таймаутом
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
            // Не блокируем работу, но показываем предупреждение
            this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Проверьте соединение';
            this.elements.apiStatus.classList.remove('api-connecting');
            this.showNotification('API проверка не удалась, но можно попробовать отправить сообщение', 'warning');
        }
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

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message) {
            this.showNotification('Введите сообщение', 'warning');
            return;
        }
        
        // Проверка команд
        if (message.startsWith('/')) {
            if (this.handleCommand(message)) {
                this.elements.messageInput.value = '';
                return;
            }
        }
        
        // Проверка темы сообщения
        if (!this.isTopicRelevant(message)) {
            this.showNotification('Я специализируюсь только на отношениях, знакомствах и манипуляциях.', 'warning');
            return;
        }
        
        // Добавление сообщения пользователя
        this.addMessage(message, 'user');
        
        // Сохранение в историю
        this.state.conversationHistory.push({ role: "user", content: message });
        this.state.messageCount++;
        this.state.stats.totalMessages++;
        this.state.stats.userMessages++;
        
        // Обновление статистики по темам
        this.updateTopicStats(message);
        
        // Отметить активность текущего часа
        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        
        // Проверка достижений
        this.checkAchievements();
        
        // Очистка поля ввода
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        
        // Показать индикатор набора с предупреждением о возможной задержке
        this.showTypingIndicator();
        if (this.state.messageCount <= 3) {
            this.showNotification('Первые запросы могут занимать 20-40 секунд (загрузка модели)', 'info');
        }
        
        try {
            // Получение ответа от AI
            const startTime = Date.now();
            const aiResponse = await this.getAIResponse(this.state.conversationHistory);
            const responseTime = (Date.now() - startTime) / 1000;
            
            this.state.responseTimes.push(responseTime);
            
            // Скрыть индикатор
            this.hideTypingIndicator();
            
            // Добавление ответа AI
            this.addMessage(aiResponse, 'ai');
            
            // Сохранение в историю
            this.state.conversationHistory.push({ role: "assistant", content: aiResponse });
            this.state.stats.totalMessages++;
            this.state.stats.aiMessages++;
            
            // Ограничение истории
            if (this.state.conversationHistory.length > 20) {
                this.state.conversationHistory = [
                    this.state.conversationHistory[0],
                    ...this.state.conversationHistory.slice(-18)
                ];
            }
            
            this.showNotification(`Ответ получен за ${responseTime.toFixed(1)}с ✅`, 'success');
            this.updateUI();
            this.saveToLocalStorage();
            
            // Сброс счетчика повторных попыток при успехе
            this.state.retryCount = 0;
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('API Error details:', error);
            
            // Обработка ошибок Hugging Face
            let errorMessage = "Извините, произошла ошибка при получении ответа. ";
            let userMessage = error.message;
            
            if (error.message.includes('503') || error.message.includes('загружается')) {
                if (this.state.retryCount < this.state.maxRetries) {
                    this.state.retryCount++;
                    errorMessage += `Попытка ${this.state.retryCount}/${this.state.maxRetries}. Попробуйте через 30 секунд.`;
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

    isTopicRelevant(message) {
        const messageLower = message.toLowerCase();
        const relevantTopics = [
            // Отношения
            'отношени', 'любов', 'брак', 'семь', 'пар', 'встреча', 'расставан',
            'ревност', 'довери', 'обид', 'ссор', 'конфликт', 'кризис',
            'верност', 'измен', 'секс', 'интим', 'родител', 'дети',
            'свекр', 'тещ', 'муж', 'жена', 'мужчин', 'женщин',
            
            // Знакомства
            'знакомств', 'свидан', 'встреч', 'тинд', 'бад', 'приложен',
            'профил', 'анкет', 'перв', 'втор', 'свидан', 'роман',
            'флирт', 'симпати', 'нравит', 'влюблен', 'ухаживан',
            'познаком', 'встрет', 'познаком',
            
            // Манипуляции
            'манипуляц', 'токсичн', 'абью', 'насил', 'давлен',
            'шантаж', 'вина', 'обид', 'контрол', 'завис', 'унижен',
            'оскорбл', 'газлайтинг', 'нарцис', 'психолог', 'границ',
            'уважен', 'достоинств', 'самооцен', 'психологическ',
            
            // Общие психологические термины
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

    async getAIResponse(messages) {
        if (!this.state.isApiConnected) {
            throw new Error('API не подключен');
        }

        try {
            // Получаем последнее сообщение пользователя и немного контекста
            const userMessages = messages.filter(msg => msg.role === "user");
            const lastUserMessage = userMessages[userMessages.length - 1]?.content || 
                                   messages[messages.length - 1]?.content || 
                                   "Привет";
            
            // Формируем промпт для DialoGPT
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
            
            // Обработка ответа от Hugging Face API
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
            
            // Убираем промпт из ответа и очищаем
            let cleanResponse = generatedText.replace(prompt, '').trim();
            
            // Удаляем повторяющиеся фразы
            cleanResponse = cleanResponse.replace(/Психолог:/g, '').trim();
            
            // Проверяем, не пустой ли ответ
            if (!cleanResponse || cleanResponse.length < 5) {
                // Фолбэк ответы
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
        
        // Анимация
        setTimeout(() => {
            messageElement.style.animation = 'messageAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        }, 10);
        
        // Подсветка синтаксиса
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

    toggleVoiceRecording() {
        if (!this.recognition) {
            this.showNotification('Голосовой ввод не поддерживается в вашем браузере', 'error');
            return;
        }
        
        if (!this.state.isRecording) {
            this.state.isRecording = true;
            this.elements.recordButton.classList.add('recording');
            this.elements.recordButton.innerHTML = '<i class="fas fa-stop"></i>';
            this.recognition.start();
            this.showNotification('Запись началась... 🎤', 'info');
        } else {
            this.state.isRecording = false;
            this.elements.recordButton.classList.remove('recording');
            this.elements.recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
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

    handleCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0];
        
        switch(cmd) {
            case '/clear':
                this.clearChat();
                break;
            case '/save':
                this.saveChat();
                break;
            case '/export':
                this.showExportModal();
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

    setAIMode(modeId) {
        if (!this.state.aiModes[modeId]) return;
        
        this.state.currentMode = modeId;
        
        // Обновление UI
        document.querySelectorAll('.mode-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeMode = document.querySelector(`.mode-item[data-mode="${modeId}"]`);
        if (activeMode) {
            activeMode.classList.add('active');
        }
        
        // Обновление настроек API
        this.API_CONFIG.temperature = this.state.aiModes[modeId].temperature;
        
        this.showNotification(`Режим изменен на: ${this.state.aiModes[modeId].name}`, 'info');
    }

    clearChat() {
        if (confirm('Очистить всю историю диалога? Это действие нельзя отменить.')) {
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
            
            this.showNotification('Чат очищен 🗑️', 'info');
            this.updateUI();
            this.saveToLocalStorage();
        }
    }

    saveChat() {
        const chatData = {
            id: 'chat-' + Date.now(),
            title: 'Консультация от ' + new Date().toLocaleString(),
            messages: this.state.conversationHistory.filter(msg => msg.role !== 'system'),
            timestamp: Date.now(),
            stats: { ...this.state.stats }
        };
        
        const savedChats = JSON.parse(localStorage.getItem('verdikt_saved_chats') || '[]');
        savedChats.push(chatData);
        localStorage.setItem('verdikt_saved_chats', JSON.stringify(savedChats));
        
        this.state.stats.savedChats++;
        this.unlockAchievement('exporter');
        this.showNotification('Консультация сохранена 📁', 'success');
        this.updateUI();
    }

    createNewChat() {
        this.clearChat();
        this.showNotification('Новая консультация начата', 'info');
    }

    exportChat(format) {
        const chatContent = this.state.conversationHistory
            .filter(msg => msg.role !== 'system')
            .map(msg => `${msg.role === 'user' ? 'Вы' : 'Эксперт'}: ${msg.content}`)
            .join('\n\n');
        
        let content, mimeType, extension;
        
        switch(format) {
            case 'pdf':
                // Для PDF используем window.print()
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

    setTheme(theme) {
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
        const activeTheme = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
        }
        localStorage.setItem('verdikt_theme', theme);
        this.showNotification(`Тема изменена: ${theme}`, 'info');
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

    checkAchievements() {
        // Проверка активного пользователя
        if (this.state.stats.userMessages >= 10 && !this.state.achievements.activeUser.unlocked) {
            this.unlockAchievement('activeUser');
        }
        
        // Проверка совы
        const currentHour = new Date().getHours();
        if ((currentHour >= 23 || currentHour <= 5) && !this.state.achievements.nightOwl.unlocked) {
            this.unlockAchievement('nightOwl');
        }
    }

    unlockAchievement(achievementId) {
        if (!this.state.achievements[achievementId] || this.state.achievements[achievementId].unlocked) return;
        
        this.state.achievements[achievementId].unlocked = true;
        
        // Показать уведомление
        const achievement = this.state.achievements[achievementId];
        document.getElementById('achievement-icon').textContent = achievement.icon;
        document.getElementById('achievement-title').textContent = achievement.name;
        document.getElementById('achievement-desc').textContent = achievement.description;
        
        const notification = document.getElementById('achievement-notification');
        notification.style.display = 'flex';
        notification.style.animation = 'none';
        
        // Сбросить анимацию
        setTimeout(() => {
            notification.style.animation = 'achievementSlide 3s ease';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }, 10);
        
        // Обновить UI
        this.updateAchievementsUI();
        this.saveToLocalStorage();
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
        this.showModal('settings-modal');
    }

    showExportModal() {
        this.showModal('export-modal');
    }

    showStatsModal() {
        // Обновить данные
        document.getElementById('total-messages').textContent = this.state.stats.totalMessages;
        document.getElementById('avg-response').textContent = 
            this.state.responseTimes.length > 0 
            ? (this.state.responseTimes.reduce((a, b) => a + b, 0) / this.state.responseTimes.length).toFixed(1) + 'с'
            : '0с';
        document.getElementById('user-messages').textContent = this.state.stats.userMessages;
        document.getElementById('ai-messages').textContent = this.state.stats.aiMessages;
        
        // Обновить график
        this.updateActivityChart();
        
        // Обновить популярные темы
        this.updatePopularTopics();
        
        this.showModal('stats-modal');
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
        this.hideModal('settings-modal');
        this.showNotification('Настройки сохранены ✅', 'success');
    }

    updateUI() {
        // Обновить счетчики
        document.getElementById('sidebar-messages').textContent = this.state.stats.totalMessages;
        document.getElementById('sidebar-time').textContent = 
            this.state.responseTimes.length > 0 
            ? (this.state.responseTimes.reduce((a, b) => a + b, 0) / this.state.responseTimes.length).toFixed(1) + 'с'
            : '—';
        document.getElementById('sidebar-saved').textContent = this.state.stats.savedChats;
        document.getElementById('sidebar-sessions').textContent = this.state.stats.sessions;
        
        // Обновить достижения
        this.updateAchievementsUI();
    }

    updateAchievementsUI() {
        document.querySelectorAll('.achievement-item').forEach(item => {
            const achievementName = item.querySelector('.achievement-name').textContent;
            const achievementId = this.getAchievementIdByName(achievementName);
            
            if (achievementId && this.state.achievements[achievementId]?.unlocked) {
                item.classList.add('unlocked');
            } else {
                item.classList.remove('unlocked');
            }
        });
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
            // Fallback для старых браузеров
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
            
            // Удалить старый ответ и сгенерировать новый
            messageElement.remove();
            this.state.conversationHistory.pop();
            
            this.elements.messageInput.value = userMessage;
            this.sendMessage();
        }
    }

    showTypingIndicator() {
        this.elements.typingIndicator.style.display = 'block';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.elements.typingIndicator.style.display = 'none';
    }

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

    getCurrentTime() {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    showQuickCommands() {
        const commands = [
            '/clear - Очистить чат',
            '/save - Сохранить чат',
            '/export - Экспорт в разные форматы',
            '/advice - Совет по отношениям',
            '/manipulation - Распознавание манипуляций',
            '/stats - Статистика',
            '/presentation - Режим презентации',
            '/help - Помощь по командам'
        ];
        
        alert('Доступные команды:\n\n' + commands.join('\n'));
    }

    loadFromLocalStorage() {
        // Загрузка темы
        const savedTheme = localStorage.getItem('verdikt_theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        }
        
        // Загрузка сохраненных чатов
        const savedChats = JSON.parse(localStorage.getItem('verdikt_saved_chats') || '[]');
        this.state.stats.savedChats = savedChats.length;
        
        // Загрузка статистики
        const savedStats = JSON.parse(localStorage.getItem('verdikt_stats') || '{}');
        if (savedStats.totalMessages) {
            Object.assign(this.state.stats, savedStats);
        }
        
        // Загрузка достижений
        const savedAchievements = JSON.parse(localStorage.getItem('verdikt_achievements') || '{}');
        Object.keys(savedAchievements).forEach(key => {
            if (this.state.achievements[key]) {
                this.state.achievements[key].unlocked = savedAchievements[key].unlocked;
            }
        });
    }

    saveToLocalStorage() {
        localStorage.setItem('verdikt_theme', this.state.currentTheme);
        localStorage.setItem('verdikt_stats', JSON.stringify(this.state.stats));
        
        const achievementsData = {};
        Object.keys(this.state.achievements).forEach(key => {
            achievementsData[key] = {
                unlocked: this.state.achievements[key].unlocked
            };
        });
        localStorage.setItem('verdikt_achievements', JSON.stringify(achievementsData));
    }
}
