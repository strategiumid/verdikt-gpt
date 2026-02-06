// Инициализация всех функций
document.addEventListener('DOMContentLoaded', function() {
    if (window.hljs) hljs.highlightAll();
    window.VerdiktChat = new VerdiktChatApp();
    window.VerdiktChat.init();
});

// Основной класс приложения
class VerdiktChatApp {
    constructor() {
        // Конфигурация API
        this.API_CONFIG = {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'stepfun/step-3.5-flash:free',
            apiKey: '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',
            maxTokens: 2500,
            temperature: 0.7
        };

        // База знаний Максима Вердикта
        this.VERDIKT_KNOWLEDGE = {
            psychology: {
                ignoring: {
                    types: [
                        "Защитный игнор - когда человек отстраняется, чтобы избежать конфликта или эмоциональной боли",
                        "Манипулятивный игнор - используется для контроля, наказания или получения власти",
                        "Эмоциональный игнор - когда партнер физически присутствует, но эмоционально отсутствует",
                        "Ситуационный игнор - временное отстранение для принятия решений",
                        "Токсичный игнор - систематическое избегание как форма эмоционального насилия"
                    ],
                    causes: [
                        "Страх конфронтации и эмоциональной уязвимости",
                        "Отсутствие коммуникативных навыков",
                        "Накопленные обиды и невысказанные претензии",
                        "Эмоциональное выгорание в отношениях",
                        "Пассивно-агрессивное поведение",
                        "Проверка границ и терпения партнера"
                    ],
                    strategies: [
                        "Анализ причины игнора - понять мотивы поведения",
                        "Использование 'Я-высказываний' вместо обвинений",
                        "Установление временных рамок для разрешения конфликта",
                        "Предложение профессиональной помощи при необходимости",
                        "Фокус на собственных потребностях и границах",
                        "Избегание преследования игнорирующего партнера"
                    ]
                },
                love: {
                    stages: [
                        "Лиминация (1-6 мес) - гормональная влюбленность, идеализация",
                        "Стабилизация (6-18 мес) - реалистичная оценка, принятие недостатков",
                        "Привязанность (18+ мес) - глубокая эмоциональная связь, партнерство"
                    ],
                    hormones: {
                        dopamine: "Отвечает за удовольствие и мотивацию в начальной стадии",
                        oxytocin: "Гормон привязанности и доверия",
                        serotonin: "Влияет на настроение и эмоциональную стабильность",
                        norepinephrine: "Вызывает волнение и эйфорию"
                    },
                    signs: {
                        healthy: [
                            "Взаимное уважение и поддержка",
                            "Сохранение личных границ",
                            "Открытая и честная коммуникация",
                            "Радость от успехов партнера",
                            "Баланс близости и автономии"
                        ],
                        unhealthy: [
                            "Одержимость и потеря себя",
                            "Игнорирование красных флагов",
                            "Эмоциональная зависимость",
                            "Ревность и контроль",
                            "Потеря других интересов"
                        ]
                    }
                },
                manipulation: {
                    types: [
                        "Газлайтинг - искажение реальности и подрыв уверенности",
                        "Триангуляция - вовлечение третьих лиц для давления",
                        "Шантаж эмоциями - использование чувств для контроля",
                        "Пассивная агрессия - скрытое выражение гнева",
                        "Жертвенность - манипуляция через чувство вины",
                        "Идеализация-девальвация - цикл восхваления и унижения"
                    ],
                    defense: [
                        "Распознавание паттернов манипуляции",
                        "Установление четких границ",
                        "Отказ играть по правилам манипулятора",
                        "Поддержание эмоциональной дистанции",
                        "Документирование инцидентов",
                        "Обращение за профессиональной поддержкой"
                    ]
                },
                maxVerdiktPrinciples: [
                    "Принцип зеркала: Отношения отражают ваше отношение к себе",
                    "Принцип границ: Здоровые границы = здоровые отношения",
                    "Принцип коммуникации: 80% проблем решаются честным разговором",
                    "Принцип ответственности: Берите ответственность только за свои действия",
                    "Принцип времени: Настоящие чувства проверяются временем",
                    "Принцип баланса: Давать и получать должно быть примерно равно",
                    "Принцип роста: Отношения должны способствовать личному развитию",
                    "Принцип реализма: Любовь видит недостатки, но принимает их"
                ]
            },
            techniques: {
                communication: {
                    iStatements: "Я чувствую... когда ты... потому что... я бы хотел...",
                    activeListening: "Повторение, уточнение, отражение чувств",
                    nonViolentCommunication: "Наблюдения → Чувства → Потребности → Просьбы",
                    conflictResolution: "Пауза → Анализ → Диалог → Решение → Примирение"
                },
                selfCare: [
                    "Эмоциональный дневник для отслеживания чувств",
                    "Практика осознанности и медитации",
                    "Регулярная физическая активность",
                    "Поддержка социальных связей",
                    "Профессиональная терапия при необходимости"
                ]
            }
        };

        // Состояние приложения
        this.state = {
            conversationHistory: [
                {
                    role: "system",
                    content: `Ты - Verdikt GPT, эксперт по психологии отношений. Отвечай на русском, используй эмодзи для структурирования, будь подробным, но не водянистым.`
                }
            ],
            currentMode: 'balanced',
            aiModes: {
                verdikt: { name: "Вердикт", temperature: 0.5 },
                emotional: { name: "Эмоциональный", temperature: 0.8 },
                analytical: { name: "Аналитический", temperature: 0.3 },
                protective: { name: "Защитный", temperature: 0.6 }
            },
            messageCount: 1,
            responseTimes: [],
            isApiConnected: false,
            isRecording: false,
            isSpeaking: false,
            achievements: {
                firstMessage: { unlocked: true, name: "Первый шаг", icon: "🎯", description: "Первая консультация" },
                activeUser: { unlocked: false, name: "Доверие", icon: "💬", description: "10 личных вопросов" },
                manipulationExpert: { unlocked: false, name: "Защитник", icon: "🛡️", description: "Распознал 5 манипуляций" },
                relationshipHelper: { unlocked: false, name: "Романтик", icon: "💕", description: "Помог в отношениях" }
            },
            stats: {
                totalMessages: 1,
                userMessages: 0,
                aiMessages: 1,
                savedChats: 0,
                sessions: 1,
                manipulationRequests: 0,
                relationshipAdvice: 0
            },
            currentTheme: 'dark',
            isPresentationMode: false,
            currentSlide: 0,
            slides: []
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
            exitPresentation: document.getElementById('exit-presentation')
        };

        // Инициализация Web Speech API
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSynthesis = window.speechSynthesis;
        this.recognition = null;
    }

    // ========== ОСНОВНЫЕ МЕТОДЫ ==========

    init() {
        console.log('Verdikt GPT инициализируется...');
        
        try {
            this.setupEventListeners();
            this.loadFromLocalStorage();
            this.setupBackgroundAnimations();
            this.updateUI();
            this.checkApiStatus();
            this.setupKeyboardShortcuts();
            
            console.log('Verdikt GPT v2.0 - Экспертная система по отношениям инициализирована');
            
            // Показать приветственное сообщение
            setTimeout(() => {
                this.showNotification('Система готова к работе! ✨', 'success');
            }, 1000);
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showNotification('Ошибка загрузки. Обновите страницу.', 'error');
        }
    }

    setupEventListeners() {
        // Кнопка отправки
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Ввод по Enter
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Автовысота textarea
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 200) + 'px';
        });
        
        // Примеры вопросов
        document.querySelectorAll('.example-button').forEach(button => {
            button.addEventListener('click', () => {
                const question = button.getAttribute('data-question');
                this.elements.messageInput.value = question;
                this.elements.messageInput.focus();
                this.showNotification('Вопрос добавлен в поле ввода', 'info');
            });
        });
        
        // Подсказки
        document.querySelectorAll('.suggestion-item').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                this.elements.messageInput.value = suggestion.textContent;
                this.elements.messageInput.focus();
            });
        });
        
        // Очистка чата
        if (this.elements.clearChat) {
            this.elements.clearChat.addEventListener('click', () => this.clearChat());
        }
        
        // Новый чат
        if (this.elements.newChat) {
            this.elements.newChat.addEventListener('click', () => this.createNewChat());
        }
        
        // Режимы AI
        document.querySelectorAll('.mode-item').forEach(item => {
            item.addEventListener('click', () => {
                const mode = item.getAttribute('data-mode');
                this.setAIMode(mode);
            });
        });
        
        // Команды
        document.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const command = item.getAttribute('data-command');
                this.elements.messageInput.value = command;
                this.elements.messageInput.focus();
            });
        });
    }

    // ========== КОММУНИКАЦИЯ ==========

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message) {
            this.showNotification('Введите сообщение', 'warning');
            return;
        }
        
        if (this.handleCommand(message)) {
            this.elements.messageInput.value = '';
            return;
        }
        
        // Добавляем сообщение пользователя
        this.addMessage(message, 'user');
        this.state.conversationHistory.push({ role: "user", content: message });
        this.state.stats.userMessages++;
        this.state.stats.totalMessages++;
        
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        this.showTypingIndicator();
        
        try {
            // Имитируем задержку ответа
            setTimeout(() => {
                this.hideTypingIndicator();
                
                // Генерируем ответ из базы знаний
                const aiResponse = this.generateFallbackResponse(message);
                this.addMessage(aiResponse, 'ai');
                this.state.conversationHistory.push({ role: "assistant", content: aiResponse });
                this.state.stats.aiMessages++;
                this.state.stats.totalMessages++;
                
                this.showNotification('Ответ сгенерирован локально ✅', 'success');
                this.saveToLocalStorage();
                this.scrollToBottom();
                
            }, 1500);
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('Ошибка генерации ответа:', error);
            this.showNotification('Ошибка генерации ответа', 'error');
        }
    }

    handleCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0];
        
        switch(cmd) {
            case '/clear':
                this.clearChat();
                return true;
            case '/help':
                this.showQuickCommands();
                return true;
            case '/stats':
                this.showStatsModal();
                return true;
            default:
                return false;
        }
    }

    showQuickCommands() {
        const commands = [
            '/clear - Очистить чат',
            '/help - Все команды'
        ];
        
        alert('📋 КОМАНДЫ VERDIKT GPT:\n\n' + commands.join('\n'));
    }

    generateFallbackResponse(message) {
        const messageLower = message.toLowerCase();
        
        if (messageLower.includes('игнор') || messageLower.includes('молчан')) {
            return `🧠 **АНАЛИЗ СИТУАЦИИ С ИГНОРОМ:**

📊 **ТИПЫ ИГНОРА:**
1. Защитный игнор - чтобы избежать конфликта
2. Манипулятивный игнор - для контроля и власти
3. Эмоциональный игнор - физическое присутствие, эмоциональное отсутствие

🔍 **ВАШИ ДЕЙСТВИЯ:**
1. Не преследовать и не писать многократно
2. Установить внутренний срок ожидания (например, 3 дня)
3. Сфокусироваться на своих занятиях
4. Подготовить вопросы для конструктивного диалога

💡 **КЛЮЧЕВОЙ ИНСАЙТ:**
Игнор - это всегда информация о состоянии отношений. Ваша задача - понять, что говорит это молчание.

Хотите более детальный разбор вашей ситуации?`;
        }
        
        if (messageLower.includes('влюблен') || messageLower.includes('романт')) {
            return `💖 **ПСИХОЛОГИЯ ВЛЮБЛЕННОСТИ:**

🎭 **3 СТАДИИ РАЗВИТИЯ ЧУВСТВ:**
1. Лиминация (1-6 мес) - гормональная влюбленность
2. Стабилизация (6-18 мес) - реалистичная оценка
3. Привязанность (18+ мес) - глубокая эмоциональная связь

✅ **ПРИЗНАКИ ЗДОРОВОЙ ВЛЮБЛЕННОСТИ:**
• Сохранение своих интересов
• Открытая коммуникация
• Взаимное уважение
• Чувство безопасности быть собой

🔮 **ПРАКТИЧЕСКОЕ УПРАЖНЕНИЕ:**
Запишите 5 главных качеств, которые вас привлекают
Отметьте, какие из них есть в вас самих

Расскажите подробнее о ваших чувствах!`;
        }
        
        if (messageLower.includes('манипуляц') || messageLower.includes('токсичн')) {
            return `🛡️ **РАСПОЗНАВАНИЕ МАНИПУЛЯЦИЙ:**

🎯 **ТИПЫ МАНИПУЛЯТИВНОГО ПОВЕДЕНИЯ:**
1. Газлайтинг - искажение реальности
2. Эмоциональный шантаж
3. Пассивная агрессия
4. Триангуляция

⚔️ **СТРАТЕГИИ ЗАЩИТЫ:**
1. Установить четкие границы
2. Вести журнал инцидентов
3. Не играть по правилам манипулятора
4. Обратиться за поддержкой

📝 **ПЛАН ДЕЙСТВИЙ:**
1. Идентификация паттернов (1-7 дней)
2. Установление границ (7-14 дней)
3. Укрепление позиций (14-30 дней)

Нужен ли более подробный анализ вашей ситуации?`;
        }
        
        return `👋 **Привет! Я - Verdikt GPT, эксперт по отношениям.**

✨ **ЧТО Я МОГУ ДЛЯ ВАС СДЕЛАТЬ:**

🔍 **ПРОАНАЛИЗИРУЮ** вашу ситуацию с:
• Научно-обоснованными психологическими концепциями
• Практическими фреймворками для решения проблем
• Методологией здоровых отношений

💡 **ПРЕДЛОЖУ** конкретный план действий

🛡️ **ПОМОГУ** распознать и защититься от:
• Манипуляций и токсичных паттернов
• Эмоционального насилия
• Нарушения границ

📊 **ДАМ** инструменты для:
• Диагностики состояния отношений
• Принятия взвешенных решений
• Личностного роста

**Расскажите о вашей ситуации, и я помогу разобраться!** 💫`;
    }

    // ========== UI И ИНТЕРФЕЙС ==========

    addMessage(content, sender) {
        const messageId = 'msg-' + Date.now();
        const time = this.getCurrentTime();
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.id = messageId;
        
        messageElement.innerHTML = `
            <div class="message-actions">
                <button class="message-action" onclick="VerdiktChat.copyMessage('${messageId}')">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="message-action" onclick="VerdiktChat.speakMessage('${messageId}')">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
            <div class="message-sender">
                <i class="fas fa-${sender === 'user' ? 'user' : 'heart'}"></i>
                ${sender === 'user' ? 'Вы' : 'Verdikt GPT'}
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
            <div class="message-time">${time}</div>
        `;
        
        this.elements.chatMessages.appendChild(messageElement);
        
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 10);
        
        this.scrollToBottom();
    }

    formatMessage(text) {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    setAIMode(modeId) {
        this.state.currentMode = modeId;
        
        document.querySelectorAll('.mode-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`.mode-item[data-mode="${modeId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        this.showNotification(`Режим изменен: ${this.state.aiModes[modeId].name}`, 'info');
    }

    // ========== УПРАВЛЕНИЕ ЧАТОМ ==========

    clearChat() {
        if (confirm('Вы уверены, что хотите очистить чат?')) {
            this.elements.chatMessages.innerHTML = '';
            
            // Оставляем только системное сообщение
            this.state.conversationHistory = [this.state.conversationHistory[0]];
            this.state.messageCount = 1;
            
            // Добавляем начальное сообщение
            this.addMessage(`Привет! 👋 Я - эксперт в области психологии отношений, знакомств и распознавания манипуляций. 

💕 **Отношения** - помощь в построении здоровых отношений, решение конфликтов
👥 **Знакомства** - советы по онлайн и офлайн знакомствам
🛡️ **Манипуляции** - распознавание психологических манипуляций

Расскажите, с какой ситуацией вы столкнулись?`, 'ai');
            
            this.showNotification('Чат очищен', 'success');
            this.saveToLocalStorage();
        }
    }

    createNewChat() {
        if (confirm('Создать новый чат? Текущая история будет сохранена.')) {
            this.state.stats.sessions++;
            this.clearChat();
            this.showNotification('Новый чат создан', 'success');
        }
    }

    // ========== УВЕДОМЛЕНИЯ И СТАТУС ==========

    showNotification(text, type = 'info') {
        const notification = this.elements.notification;
        const notificationText = this.elements.notificationText;
        
        if (!notification || !notificationText) return;
        
        // Устанавливаем цвет в зависимости от типа
        switch(type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
        }
        
        notificationText.textContent = text;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    showTypingIndicator() {
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'none';
        }
    }

    checkApiStatus() {
        // Проверяем статус соединения
        const isOnline = navigator.onLine;
        const statusElement = this.elements.apiStatus;
        
        if (statusElement) {
            if (isOnline) {
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Онлайн';
                statusElement.style.background = 'rgba(34, 197, 94, 0.15)';
                statusElement.style.color = '#4ade80';
            } else {
                statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> Офлайн';
                statusElement.style.background = 'rgba(239, 68, 68, 0.15)';
                statusElement.style.color = '#f87171';
            }
        }
        
        return isOnline;
    }

    // ========== УТИЛИТЫ ==========

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }

    scrollToBottom() {
        const container = this.elements.chatMessages;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    copyMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        
        const contentElement = messageElement.querySelector('.message-content');
        if (!contentElement) return;
        
        const text = contentElement.textContent || contentElement.innerText;
        
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Сообщение скопировано', 'success');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
        });
    }

    speakMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement || !this.speechSynthesis) return;
        
        const contentElement = messageElement.querySelector('.message-content');
        if (!contentElement) return;
        
        const text = contentElement.textContent || contentElement.innerText;
        
        if (this.state.isSpeaking) {
            this.speechSynthesis.cancel();
            this.state.isSpeaking = false;
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onstart = () => {
            this.state.isSpeaking = true;
            this.showNotification('Озвучивание началось', 'info');
        };
        
        utterance.onend = () => {
            this.state.isSpeaking = false;
        };
        
        this.speechSynthesis.speak(utterance);
    }

    // ========== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ ==========

    saveToLocalStorage() {
        try {
            const data = {
                conversationHistory: this.state.conversationHistory,
                stats: this.state.stats,
                achievements: this.state.achievements,
                theme: this.state.currentTheme
            };
            localStorage.setItem('verdikt-chat-data', JSON.stringify(data));
        } catch (error) {
            console.warn('Не удалось сохранить данные:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('verdikt-chat-data');
            if (saved) {
                const data = JSON.parse(saved);
                
                if (data.conversationHistory) {
                    this.state.conversationHistory = data.conversationHistory;
                }
                
                if (data.stats) {
                    Object.assign(this.state.stats, data.stats);
                }
                
                if (data.achievements) {
                    Object.assign(this.state.achievements, data.achievements);
                }
                
                if (data.theme) {
                    this.setTheme(data.theme);
                }
                
                // Обновляем UI
                this.updateUI();
            }
        } catch (error) {
            console.warn('Не удалось загрузить данные:', error);
        }
    }

    // ========== АНИМАЦИИ И ДЕКОРАЦИИ ==========

    setupBackgroundAnimations() {
        // Создаем плавающие сердца
        const heartsContainer = document.getElementById('floating-hearts');
        if (!heartsContainer) return;
        
        for (let i = 0; i < 20; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.innerHTML = '❤️';
            
            // Случайная позиция и задержка
            heart.style.left = Math.random() * 100 + '%';
            heart.style.animationDelay = Math.random() * 15 + 's';
            heart.style.fontSize = (Math.random() * 10 + 15) + 'px';
            heart.style.opacity = Math.random() * 0.2 + 0.05;
            
            heartsContainer.appendChild(heart);
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter - отправка сообщения
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
            
            // Ctrl+K - фокус на поле ввода
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.elements.messageInput.focus();
            }
            
            // Ctrl+L - очистка чата
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.clearChat();
            }
            
            // Escape - очистка поля ввода
            if (e.key === 'Escape') {
                this.elements.messageInput.value = '';
                this.elements.messageInput.style.height = 'auto';
            }
        });
    }

    updateUI() {
        // Обновляем статистику в боковой панели
        const sidebarMessages = document.getElementById('sidebar-messages');
        if (sidebarMessages) {
            sidebarMessages.textContent = this.state.stats.totalMessages;
        }
        
        const sidebarTime = document.getElementById('sidebar-time');
        if (sidebarTime) {
            if (this.state.responseTimes.length > 0) {
                const avgTime = this.state.responseTimes.reduce((a, b) => a + b, 0) / this.state.responseTimes.length;
                sidebarTime.textContent = avgTime.toFixed(1) + 'с';
            } else {
                sidebarTime.textContent = '—';
            }
        }
        
        const sidebarSaved = document.getElementById('sidebar-saved');
        if (sidebarSaved) {
            sidebarSaved.textContent = this.state.stats.savedChats;
        }
        
        const sidebarSessions = document.getElementById('sidebar-sessions');
        if (sidebarSessions) {
            sidebarSessions.textContent = this.state.stats.sessions;
        }
    }

    setTheme(theme) {
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        // Обновляем активную тему в селекторе
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-theme') === theme) {
                option.classList.add('active');
            }
        });
        
        this.saveToLocalStorage();
    }

    showStatsModal() {
        const modal = document.getElementById('stats-modal');
        if (modal) {
            modal.classList.add('active');
            
            // Обновляем статистику в модальном окне
            const totalMessages = document.getElementById('total-messages');
            const avgResponse = document.getElementById('avg-response');
            const userMessages = document.getElementById('user-messages');
            const aiMessages = document.getElementById('ai-messages');
            
            if (totalMessages) totalMessages.textContent = this.state.stats.totalMessages;
            if (userMessages) userMessages.textContent = this.state.stats.userMessages;
            if (aiMessages) aiMessages.textContent = this.state.stats.aiMessages;
            
            if (avgResponse) {
                if (this.state.responseTimes.length > 0) {
                    const avgTime = this.state.responseTimes.reduce((a, b) => a + b, 0) / this.state.responseTimes.length;
                    avgResponse.textContent = avgTime.toFixed(1) + 'с';
                } else {
                    avgResponse.textContent = '0с';
                }
            }
            
            // Закрытие модального окна
            const closeBtn = document.getElementById('stats-close');
            if (closeBtn) {
                closeBtn.onclick = () => modal.classList.remove('active');
            }
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            };
        }
    }

    // Простые анимации для проверки работы
    testAnimations() {
        console.log('Тест анимаций...');
        
        // Пульсация логотипа
        const logo = document.querySelector('.logo-icon');
        if (logo) {
            logo.style.animation = 'pulse 2s infinite';
        }
        
        // Плавающая аватарка
        const avatar = document.querySelector('.ai-avatar');
        if (avatar) {
            avatar.style.animation = 'float 6s infinite ease-in-out';
        }
    }
}

// Сохраняем глобальный доступ
window.VerdiktChatApp = VerdiktChatApp;
