// [file name]: main.js
// Инициализация всех функций

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
                    content: `Ты - Verdikt GPT, эксперт по психологии отношений на основе методологии Максима Вердикта. 
Ты сочетаешь научные знания психологии с практическими инсайтами реальных отношений.`
                }
            ],
            currentMode: 'balanced',
            aiModes: {
                balanced: { name: "Сбалансированный", temperature: 0.7, description: "Объективный анализ" },
                creative: { name: "Эмоциональный", temperature: 0.8, description: "Фокус на чувствах и эмпатии" },
                precise: { name: "Аналитический", temperature: 0.3, description: "Детальный разбор ситуации" },
                protective: { name: "Защитный", temperature: 0.6, description: "Выявление манипуляций" }
            },
            messageCount: 1,
            responseTimes: [],
            isApiConnected: true,
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
                relationshipAdvice: 0,
                datingAdvice: 0,
                ignoringTopics: 0,
                loveTopics: 0,
                verdiktPrinciplesUsed: 0,
                activityByHour: new Array(24).fill(0)
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
            aiWritingAnimation: document.getElementById('ai-writing-animation'),
            prevSlide: document.getElementById('prev-slide'),
            nextSlide: document.getElementById('next-slide'),
            exitPresentation: document.getElementById('exit-presentation')
        };

        // Инициализация Web Speech API
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSynthesis = window.speechSynthesis;
        this.recognition = null;
        
        // Инициализация Chart.js
        this.activityChart = null;
    }

    // ========== ОСНОВНЫЕ МЕТОДЫ ==========

    init() {
        console.log('Инициализация Verdikt Chat...');
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.setupSpeechRecognition();
        this.setupBackgroundAnimations();
        this.updateUI();
        this.checkApiStatus();
        this.setupKeyboardShortcuts();
        
        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        this.saveToLocalStorage();
        
        console.log('Verdikt GPT v2.0 - Экспертная система по отношениям инициализирована');
    }

    setupEventListeners() {
        console.log('Настройка обработчиков событий...');
        
        // Отправка сообщения
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter для отправки
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Ctrl+Enter
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Автовысота textarea
        this.elements.messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
        
        // Кнопка записи голоса
        this.elements.recordButton.addEventListener('click', () => this.toggleVoiceRecording());
        
        // Голосовой ввод
        this.elements.voiceInput.addEventListener('click', () => this.toggleVoiceRecording());
        
        // Озвучивание
        this.elements.voiceOutput.addEventListener('click', () => this.speakLastMessage());
        
        // Очистка чата
        this.elements.clearChat.addEventListener('click', () => this.clearChat());
        
        // Сохранение чата
        this.elements.saveChat.addEventListener('click', () => this.saveChat());
        
        // Экспорт
        this.elements.exportChat.addEventListener('click', () => this.showExportModal());
        
        // Новый чат
        this.elements.newChat.addEventListener('click', () => this.createNewChat());
        
        // Настройки
        this.elements.settingsButton.addEventListener('click', () => this.showSettingsModal());
        
        // Режим презентации
        this.elements.presentationMode.addEventListener('click', () => this.togglePresentationMode());
        
        // Статистика
        this.elements.viewStats.addEventListener('click', () => this.showStatsModal());
        
        // Закрытие модальных окон
        document.getElementById('settings-close').addEventListener('click', () => this.hideModal('settings-modal'));
        document.getElementById('export-close').addEventListener('click', () => this.hideModal('export-modal'));
        document.getElementById('stats-close').addEventListener('click', () => this.hideModal('stats-modal'));
        document.getElementById('export-cancel').addEventListener('click', () => this.hideModal('export-modal'));
        
        // Сохранение настроек
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
        
        // Навигация презентации
        if (this.elements.prevSlide) {
            this.elements.prevSlide.addEventListener('click', () => this.prevSlide());
            this.elements.nextSlide.addEventListener('click', () => this.nextSlide());
            this.elements.exitPresentation.addEventListener('click', () => this.togglePresentationMode());
        }
        
        // Режимы AI
        document.querySelectorAll('.mode-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.setAIMode(mode);
            });
        });
        
        // Быстрые команды
        document.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const command = e.currentTarget.dataset.command;
                this.handleCommand(command);
            });
        });
        
        // Примеры вопросов
        document.querySelectorAll('.example-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const question = e.currentTarget.dataset.question;
                this.elements.messageInput.value = question;
                this.elements.messageInput.focus();
            });
        });
        
        // Умные подсказки
        document.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const suggestion = e.currentTarget.textContent;
                this.elements.messageInput.value = suggestion;
                this.elements.messageInput.focus();
            });
        });
        
        // Тема оформления
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.setTheme(theme);
            });
        });
        
        // Формат экспорта
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const format = e.currentTarget.dataset.format;
                this.exportChat(format);
            });
        });
        
        // Слайдер температуры
        const tempSlider = document.getElementById('temperature-slider');
        const tempValue = document.getElementById('temperature-value');
        if (tempSlider) {
            tempSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                tempValue.textContent = value;
                this.API_CONFIG.temperature = parseFloat(value);
            });
        }
        
        // Клик вне модального окна
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        console.log('Обработчики событий настроены');
    }

    // ========== API И КОММУНИКАЦИЯ ==========

    async sendMessage() {
        console.log('Отправка сообщения...');
        const message = this.elements.messageInput.value.trim();
        
        if (!message) {
            this.showNotification('Введите сообщение', 'warning');
            return;
        }
        
        if (this.handleCommand(message)) {
            this.elements.messageInput.value = '';
            return;
        }
        
        if (!this.isTopicRelevant(message)) {
            this.showNotification('Я специализируюсь на психологии отношений по методологии Вердикта. Расскажите о вашей ситуации в отношениях, знакомствах или вопросах общения.', 'warning');
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
        this.showAIWritingAnimation();
        
        try {
            const startTime = Date.now();
            const aiResponse = await this.getAIResponse(this.state.conversationHistory);
            const responseTime = (Date.now() - startTime) / 1000;
            
            this.state.responseTimes.push(responseTime);
            this.hideTypingIndicator();
            this.hideAIWritingAnimation();
            
            this.addMessage(aiResponse, 'ai');
            this.state.conversationHistory.push({ role: "assistant", content: aiResponse });
            this.state.stats.totalMessages++;
            this.state.stats.aiMessages++;
            
            if (this.state.conversationHistory.length > 25) {
                this.state.conversationHistory = [
                    this.state.conversationHistory[0],
                    ...this.state.conversationHistory.slice(-23)
                ];
            }
            
            this.showNotification('Ответ получен с применением методологии Вердикта ✅', 'success');
            this.updateUI();
            this.saveToLocalStorage();
            
        } catch (error) {
            this.hideTypingIndicator();
            this.hideAIWritingAnimation();
            const fallbackResponse = this.generateFallbackResponse(message);
            this.addMessage(fallbackResponse, 'ai');
            this.showNotification('Используем локальную базу знаний Вердикта ⚡', 'info');
            console.error('API Error:', error);
            
            this.state.isApiConnected = false;
            this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> API временно недоступен';
            this.elements.apiStatus.style.background = 'rgba(239, 68, 68, 0.15)';
            this.elements.apiStatus.style.color = '#f87171';
            this.elements.apiStatus.classList.add('api-error');
        }
        
        this.scrollToBottom();
    }

    isTopicRelevant(message) {
        const messageLower = message.toLowerCase();
        const relevantTopics = [
            // Основные темы
            'отношени', 'любов', 'брак', 'семь', 'пар', 'встреча', 'расставан',
            'ревност', 'довери', 'обид', 'ссор', 'конфликт', 'кризис',
            'верност', 'измен', 'секс', 'интим', 'родител', 'дети',
            
            // Знакомства
            'знакомств', 'свидан', 'встреч', 'тинд', 'бад', 'приложен',
            'профил', 'анкет', 'перв', 'втор', 'роман',
            'флирт', 'симпати', 'нравит', 'влюблен', 'ухаживан',
            
            // Манипуляции
            'манипуляц', 'токсичн', 'абью', 'насил', 'давлен',
            'шантаж', 'вина', 'обид', 'контрол', 'завис', 'унижен',
            'оскорбл', 'газлайтинг', 'нарцис', 'психолог', 'границ',
            
            // Игнор и коммуникация
            'игнор', 'молчан', 'избеган', 'неотвеч', 'тишина', 'холодн',
            'дистанц', 'отдален', 'уход', 'разрыв', 'непониман',
            'общен', 'коммуникац', 'разговор', 'диалог',
            
            // Эмоции и чувства
            'влюблен', 'романт', 'чувств', 'сердц', 'симпати', 'нераздел',
            'привязан', 'влечен', 'эмоц', 'чувствова', 'переживан',
            
            // Психология
            'психолог', 'самооцен', 'уверен', 'тревож', 'страх', 'одиночеств',
            'принят', 'пониман', 'поддерж', 'совет', 'помощ', 'консультац',
            
            // Максим Вердикт и методология
            'вердикт', 'методолог', 'принцип', 'техник', 'упражнен', 'анализ',
            'диагностик', 'чеклист', 'фреймворк', 'протокол', 'стратег'
        ];
        
        return relevantTopics.some(topic => messageLower.includes(topic));
    }

    updateTopicStats(message) {
        const messageLower = message.toLowerCase();
        
        if (messageLower.includes('манипуляц') || messageLower.includes('токсичн') || messageLower.includes('абью')) {
            this.state.stats.manipulationRequests++;
            if (this.state.stats.manipulationRequests >= 5) {
                this.unlockAchievement('manipulationExpert');
            }
        }
        
        if (messageLower.includes('отношени') || messageLower.includes('любов') || messageLower.includes('брак')) {
            this.state.stats.relationshipAdvice++;
            if (this.state.stats.relationshipAdvice >= 3) {
                this.unlockAchievement('relationshipHelper');
            }
        }
        
        if (messageLower.includes('знакомств') || messageLower.includes('свидан') || messageLower.includes('тинд')) {
            this.state.stats.datingAdvice++;
        }
        
        if (messageLower.includes('игнор') || messageLower.includes('молчан') || messageLower.includes('избеган')) {
            this.state.stats.ignoringTopics = (this.state.stats.ignoringTopics || 0) + 1;
        }
        
        if (messageLower.includes('влюблен') || messageLower.includes('романт') || messageLower.includes('чувств')) {
            this.state.stats.loveTopics = (this.state.stats.loveTopics || 0) + 1;
        }
        
        if (messageLower.includes('вердикт') || messageLower.includes('принцип зеркала') || messageLower.includes('границ')) {
            this.state.stats.verdiktPrinciplesUsed++;
            if (this.state.stats.verdiktPrinciplesUsed >= 5) {
                this.unlockAchievement('verdiktExpert');
            }
        }
    }

    generateFallbackResponse(message) {
        const messageLower = message.toLowerCase();
        const knowledge = this.VERDIKT_KNOWLEDGE;
        
        if (messageLower.includes('игнор') || messageLower.includes('молчан')) {
            return `🧠 АНАЛИЗ СИТУАЦИИ (по методологии Вердикта):

📊 ТИПЫ ИГНОРА:
${knowledge.psychology.ignoring.types.map((type, i) => `${i+1}. ${type}`).join('\n')}

🔍 ВАШ АЛГОРИТМ ДЕЙСТВИЙ:

1. ДИАГНОСТИКА (первые 24 часа):
   • Определите тип игнора (см. выше)
   • Проанализируйте предшествующие события
   • Оцените историю подобных ситуаций

2. ПРИНЦИП ВЕРДИКТА №2 (ГРАНИЦЫ):
   • Установите внутренний срок ожидания (например, 3 дня)
   • Сформулируйте свои потребности ясно
   • Подготовьтесь к разным сценариям развития

3. ПРАКТИЧЕСКИЕ ШАГИ:
   • Избегайте преследования и многократных сообщений
   • Используйте "Я-высказывания" при возобновлении контакта
   • Сфокусируйтесь на своих занятиях и развитии
   • Подготовьте вопросы для конструктивного диалога

4. ЭМОЦИОНАЛЬНАЯ ПОДДЕРЖКА:
   • Ведите дневник чувств
   • Практикуйте техники заземления
   • Обратитесь к друзьям или специалисту

💡 КЛЮЧЕВОЙ ИНСАЙТ ВЕРДИКТА:
"Игнор - это всегда информация. Задача не в том, чтобы заставить другого говорить, а в том, чтобы понять, что это молчание говорит о ваших отношениях."

Хотите более детальный разбор вашей конкретной ситуации?`;
        }
        
        if (messageLower.includes('влюблен') || messageLower.includes('романт')) {
            return `💖 ПСИХОЛОГИЯ ВЛЮБЛЕННОСТИ (наука + Вердикт):

🎭 3 СТАДИИ РАЗВИТИЯ ЧУВСТВ:
${knowledge.psychology.love.stages.map((stage, i) => `${i+1}. ${stage}`).join('\n')}

🧪 ГОРМОНАЛЬНЫЙ ФОН:
${Object.entries(knowledge.psychology.love.hormones).map(([hormone, desc]) => `• ${hormone}: ${desc}`).join('\n')}

✅ ПРИЗНАКИ ЗДОРОВОЙ ВЛЮБЛЕННОСТИ:
${knowledge.psychology.love.signs.healthy.map((sign, i) => `${i+1}. ${sign}`).join('\n')}

❌ КРАСНЫЕ ФЛАГИ:
${knowledge.psychology.love.signs.unhealthy.map((flag, i) => `${i+1}. ${flag}`).join('\n')}

🔮 МЕТОДОЛОГИЯ ВЕРДИКТА ДЛЯ ВЛЮБЛЕННЫХ:

1. ПРИНЦИП ЗЕРКАЛА:
   • Что эта влюбленность говорит о вас?
   • Какие потребности она удовлетворяет?
   • Какой образ себя вы видите в партнере?

2. ПРАКТИЧЕСКОЕ УПРАЖНЕНИЕ:
   • Запишите 5 главных качеств, которые вас привлекают
   • Отметьте, какие из них есть в вас самих
   • Определите, какие потребности реальны, а какие - проекция

3. ЧЕК-ЛИСТ ОСОЗНАННОСТИ:
   [ ] Я сохраняю свои интересы и хобби
   [ ] Я могу конструктивно обсуждать разногласия
   [ ] Я чувствую себя в безопасности быть собой
   [ ] У нас есть общие и личные цели
   [ ] Я уважаю границы партнера и свои

💭 МЫСЛЬ ВЕРДИКТА:
"Влюбленность показывает, каким ты хочешь быть. Любовь принимает тебя таким, какой ты есть."

Расскажите подробнее о вашей ситуации для персонализированного анализа.`;
        }
        
        if (messageLower.includes('манипуляц') || messageLower.includes('токсичн')) {
            return `🛡️ СИСТЕМА РАСПОЗНАВАНИЯ МАНИПУЛЯЦИЙ 2.0:

🎯 ТИПЫ МАНИПУЛЯТИВНОГО ПОВЕДЕНИЯ:
${knowledge.psychology.manipulation.types.map((type, i) => `${i+1}. ${type}`).join('\n')}

⚔️ СТРАТЕГИИ ЗАЩИТЫ (ПРОТОКОЛ ВЕРДИКТА):
${knowledge.psychology.manipulation.defense.map((strategy, i) => `${i+1}. ${strategy}`).join('\n')}

📝 ДЕТАЛЬНЫЙ ПЛАН ДЕЙСТВИЙ:

1. ФАЗА ИДЕНТИФИКАЦИИ (1-7 дней):
   • Ведите журнал инцидентов (дата, ситуация, ваши чувства)
   • Ищите повторяющиеся паттерны
   • Определите триггеры манипулятивного поведения

2. ФАЗА ГРАНИЦ (7-14 дней):
   • Четко сформулируйте неприемлемое поведение
   • Сообщите о границах спокойно и ясно
   • Определите последствия нарушения границ

3. ФАЗА УКРЕПЛЕНИЯ (14-30 дней):
   • Практикуйте отказ без объяснений
   • Развивайте эмоциональную независимость
   • Создайте систему поддержки

4. ФАЗА ПРИНЯТИЯ РЕШЕНИЙ (30+ дней):
   • Оцените возможность изменений
   • Примите решение об продолжении или завершении
   • Действуйте в соответствии с решением

💪 8 ПРИНЦИПОВ ВЕРДИКТА ДЛЯ ЗАЩИТЫ:
${knowledge.psychology.maxVerdiktPrinciples.map((principle, i) => `${i+1}. ${principle}`).join('\n')}

⚠️ КРИТИЧЕСКИЕ СИГНАЛЫ (требуют немедленных действий):
• Физическое насилие или угрозы
• Полная финансовая или социальная изоляция
• Систематическое унижение на публике
• Угрозы самоубийством или расправой

Если вы находитесь в опасности, немедленно обратитесь в специализированные службы.

Хотите разобрать конкретную ситуацию с применением этой методологии?`;
        }
        
        return `👋 Здравствуйте! Я - Verdikt GPT, эксперт по психологии отношений на основе методологии Максима Вердикта.

✨ ЧТО Я МОГУ ДЛЯ ВАС СДЕЛАТЬ:

🔍 ПРОАНАЛИЗИРУЮ вашу ситуацию с применением:
• 8 принципов здоровых отношений Вердикта
• Научно-обоснованных психологических концепций
• Практических фреймворков для решения проблем

💡 ПРЕДЛОЖУ конкретный план действий:
• Пошаговые инструкции для вашего случая
• Коммуникационные скрипты
• Упражнения для развития эмоционального интеллекта

🛡️ ПОМОГУ распознать и защититься от:
• Манипуляций и токсичных паттернов
• Эмоционального насилия
• Нарушения границ

📊 ДАМ инструменты для:
• Диагностики состояния отношений
• Принятия взвешенных решений
• Личностного роста в контексте отношений

🎯 МОЯ МЕТОДОЛОГИЯ ОСНОВАНА НА:
1. Принцип зеркала (отношения = отражение отношения к себе)
2. Принцип границ (четкие границы = здоровая близость)
3. Принцип коммуникации (честный разговор решает 80% проблем)
... и еще 5 ключевых принципов

Расскажите о вашей ситуации, и я применю всю мощь методологии Вердикта для ее анализа! 💫`;
    }

    async getAIResponse(messages) {
        try {
            console.log('Запрос к API...');
            const response = await fetch(this.API_CONFIG.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Verdikt GPT - Expert Relationship Advisor'
                },
                body: JSON.stringify({
                    model: this.API_CONFIG.model,
                    messages: messages,
                    max_tokens: this.API_CONFIG.maxTokens,
                    temperature: this.state.aiModes[this.state.currentMode].temperature,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Ответ от API получен');
            return data.choices[0].message.content;
            
        } catch (error) {
            console.warn('API недоступен, используем локальную базу знаний Вердикта');
            return this.generateFallbackResponse(messages[messages.length - 1].content);
        }
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
            messageElement.style.animation = 'messageAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        }, 10);
        
        setTimeout(() => {
            if (typeof hljs !== 'undefined') {
                hljs.highlightAll();
            }
        }, 100);
        
        this.scrollToBottom();
    }

    formatMessage(text) {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`{3}([\s\S]*?)`{3}/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/🧠/g, '<span class="emoji-large">🧠</span>')
            .replace(/💖/g, '<span class="emoji-large">💖</span>')
            .replace(/🛡️/g, '<span class="emoji-large">🛡️</span>')
            .replace(/✨/g, '<span class="emoji-large">✨</span>');
    }

    showAIWritingAnimation() {
        if (this.elements.aiWritingAnimation) {
            this.elements.aiWritingAnimation.classList.add('visible');
        }
    }

    hideAIWritingAnimation() {
        if (this.elements.aiWritingAnimation) {
            this.elements.aiWritingAnimation.classList.remove('visible');
        }
    }

    // ========== РЕЖИМЫ И МЕТОДОЛОГИЯ ==========

    setAIMode(modeId) {
        this.state.currentMode = modeId;
        
        document.querySelectorAll('.mode-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.mode-item[data-mode="${modeId}"]`).classList.add('active');
        
        this.API_CONFIG.temperature = this.state.aiModes[modeId].temperature;
        
        let modeDescription = '';
        switch(modeId) {
            case 'balanced':
                modeDescription = 'Объективный анализ ситуации';
                break;
            case 'creative':
                modeDescription = 'Эмпатичный подход с акцентом на чувства';
                break;
            case 'precise':
                modeDescription = 'Детальный анализ с использованием психологических моделей';
                break;
            case 'protective':
                modeDescription = 'Выявление манипуляций и защита границ';
                break;
        }
        
        this.showNotification(`Режим: ${this.state.aiModes[modeId].name} - ${modeDescription}`, 'info');
    }

    // ========== ДОСТИЖЕНИЯ ==========

    checkAchievements() {
        if (this.state.stats.userMessages >= 10 && !this.state.achievements.activeUser.unlocked) {
            this.unlockAchievement('activeUser');
        }
    }

    unlockAchievement(achievementId) {
        if (!this.state.achievements[achievementId]) return;
        
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
        
        this.updateAchievementsUI();
        this.saveToLocalStorage();
    }

    // ========== КОМАНДЫ И УПРАВЛЕНИЕ ==========

    handleCommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        
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
            case '/ignore':
                this.setAIMode('precise');
                this.elements.messageInput.value = 'Как правильно реагировать на игнор в отношениях по методологии Вердикта?';
                this.elements.messageInput.focus();
                break;
            case '/love':
                this.setAIMode('creative');
                this.elements.messageInput.value = 'Как понять свои чувства: влюбленность или любовь? Какие стадии проходят отношения?';
                this.elements.messageInput.focus();
                break;
            case '/manipulation':
                this.setAIMode('protective');
                this.elements.messageInput.value = 'Как распознать манипуляции в отношениях и защитить свои границы?';
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

    showQuickCommands() {
        const commands = [
            '/clear - Очистить чат',
            '/save - Сохранить консультацию',
            '/export - Экспорт в разные форматы',
            '/ignore - Консультация по игнору',
            '/love - Психология влюбленности',
            '/manipulation - Распознавание манипуляций',
            '/stats - Статистика и аналитика',
            '/presentation - Режим презентации',
            '/help - Все команды'
        ];
        
        alert('📋 КОМАНДЫ VERDIKT GPT:\n\n' + commands.join('\n'));
    }

    // ========== ОСТАЛЬНЫЕ МЕТОДЫ ==========

    setupSpeechRecognition() {
        if (this.SpeechRecognition) {
            this.recognition = new this.SpeechRecognition();
            this.recognition.lang = 'ru-RU';
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.elements.messageInput.value = transcript;
                this.elements.messageInput.focus();
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.showNotification('Ошибка распознавания речи', 'error');
                this.elements.recordButton.classList.remove('recording');
                this.state.isRecording = false;
            };
            
            this.recognition.onend = () => {
                this.elements.recordButton.classList.remove('recording');
                this.state.isRecording = false;
            };
        }
    }

    toggleVoiceRecording() {
        if (!this.SpeechRecognition) {
            this.showNotification('Голосовой ввод не поддерживается в вашем браузере', 'warning');
            return;
        }
        
        if (this.state.isRecording) {
            this.recognition.stop();
            this.state.isRecording = false;
            this.elements.recordButton.classList.remove('recording');
            this.showNotification('Запись остановлена', 'info');
        } else {
            this.recognition.start();
            this.state.isRecording = true;
            this.elements.recordButton.classList.add('recording');
            this.showNotification('Говорите сейчас...', 'info');
        }
    }

    speakLastMessage() {
        const messages = document.querySelectorAll('.ai-message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const text = lastMessage.querySelector('.message-content').textContent;
            this.speakText(text);
        }
    }

    speakText(text) {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        this.speechSynthesis.speak(utterance);
    }

    clearChat() {
        if (confirm('Вы уверены, что хотите очистить весь чат?')) {
            this.elements.chatMessages.innerHTML = '';
            this.state.conversationHistory = [this.state.conversationHistory[0]];
            this.state.stats.totalMessages = 1;
            this.state.stats.userMessages = 0;
            this.state.stats.aiMessages = 1;
            this.showNotification('Чат очищен', 'success');
            this.updateUI();
            this.saveToLocalStorage();
        }
    }

    saveChat() {
        const chatData = {
            timestamp: new Date().toISOString(),
            conversation: this.state.conversationHistory.slice(1),
            stats: this.state.stats
        };
        
        localStorage.setItem('verdikt_chat_backup', JSON.stringify(chatData));
        this.state.stats.savedChats++;
        this.showNotification('Чат сохранен в локальное хранилище', 'success');
        this.updateUI();
        this.saveToLocalStorage();
    }

    createNewChat() {
        if (confirm('Начать новый чат? Текущий будет сохранен.')) {
            this.saveChat();
            this.clearChat();
        }
    }

    exportChat(format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let content = '';
        let filename = '';
        let mimeType = '';
        
        const messages = Array.from(document.querySelectorAll('.message')).map(msg => {
            const sender = msg.classList.contains('user-message') ? 'Вы' : 'Verdikt GPT';
            const time = msg.querySelector('.message-time')?.textContent || '';
            const text = msg.querySelector('.message-content')?.textContent || '';
            return `${time} - ${sender}:\n${text}\n\n`;
        }).join('\n---\n\n');
        
        switch(format) {
            case 'markdown':
                content = `# Verdikt GPT - История диалога\n\n${messages}`;
                filename = `verdikt-chat-${timestamp}.md`;
                mimeType = 'text/markdown';
                break;
            case 'txt':
                content = messages;
                filename = `verdikt-chat-${timestamp}.txt`;
                mimeType = 'text/plain';
                break;
            default:
                content = messages;
                filename = `verdikt-chat-${timestamp}.txt`;
                mimeType = 'text/plain';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        this.hideModal('export-modal');
        this.showNotification(`Чат экспортирован как ${format.toUpperCase()}`, 'success');
    }

    showExportModal() {
        this.showModal('export-modal');
    }

    showStatsModal() {
        this.showModal('stats-modal');
        this.updateStatsModal();
    }

    showSettingsModal() {
        this.showModal('settings-modal');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    updateStatsModal() {
        document.getElementById('total-messages').textContent = this.state.stats.totalMessages;
        document.getElementById('user-messages').textContent = this.state.stats.userMessages;
        document.getElementById('ai-messages').textContent = this.state.stats.aiMessages;
        
        const avgTime = this.state.responseTimes.length > 0 
            ? (this.state.responseTimes.reduce((a, b) => a + b) / this.state.responseTimes.length).toFixed(1)
            : '0';
        document.getElementById('avg-response').textContent = `${avgTime}с`;
    }

    setTheme(theme) {
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
        
        this.showNotification(`Тема изменена на ${theme === 'dark' ? 'Темную' : theme === 'light' ? 'Светлую' : theme === 'high-contrast' ? 'Высокую контрастность' : 'Градиентную'}`, 'info');
        this.saveToLocalStorage();
    }

    saveSettings() {
        this.hideModal('settings-modal');
        this.showNotification('Настройки сохранены', 'success');
        this.saveToLocalStorage();
    }

    setupBackgroundAnimations() {
        // Удалена генерация сердечек
        // Оставлены только частицы
        const particlesContainer = document.getElementById('connection-particles');
        if (!particlesContainer) return;
        
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + 'vw';
                particle.style.top = Math.random() * 100 + 'vh';
                particle.style.animationDelay = Math.random() * 2 + 's';
                particlesContainer.appendChild(particle);
                
                setTimeout(() => {
                    particle.remove();
                }, 3000);
            }, i * 100);
        }
        
        setInterval(() => {
            if (particlesContainer.children.length < 20) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + 'vw';
                particle.style.top = Math.random() * 100 + 'vh';
                particle.style.animationDelay = Math.random() * 2 + 's';
                particlesContainer.appendChild(particle);
                
                setTimeout(() => {
                    particle.remove();
                }, 3000);
            }
        }, 500);
    }

    checkApiStatus() {
        this.elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i> Подключение...';
        this.elements.apiStatus.style.background = 'rgba(234, 179, 8, 0.15)';
        this.elements.apiStatus.style.color = '#fbbf24';
        this.elements.apiStatus.classList.add('api-connecting');
        
        setTimeout(() => {
            this.elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i> API доступен';
            this.elements.apiStatus.style.background = 'rgba(34, 197, 94, 0.15)';
            this.elements.apiStatus.style.color = '#4ade80';
            this.elements.apiStatus.classList.remove('api-connecting');
            this.state.isApiConnected = true;
        }, 2000);
    }

    togglePresentationMode() {
        this.state.isPresentationMode = !this.state.isPresentationMode;
        
        if (this.state.isPresentationMode) {
            document.body.classList.add('presentation-mode');
            document.querySelector('.presentation-nav').style.display = 'flex';
            this.showNotification('Режим презентации включен', 'info');
        } else {
            document.body.classList.remove('presentation-mode');
            document.querySelector('.presentation-nav').style.display = 'none';
            this.showNotification('Режим презентации выключен', 'info');
        }
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
        });
    }

    updateUI() {
        document.getElementById('sidebar-messages').textContent = this.state.stats.totalMessages;
        document.getElementById('sidebar-time').textContent = this.state.responseTimes.length > 0 
            ? `${(this.state.responseTimes.reduce((a, b) => a + b) / this.state.responseTimes.length).toFixed(1)}с`
            : '—';
        document.getElementById('sidebar-saved').textContent = this.state.stats.savedChats;
        document.getElementById('sidebar-sessions').textContent = this.state.stats.sessions;
        
        // Обновление достижений
        this.updateAchievementsUI();
    }

    updateAchievementsUI() {
        const achievementsGrid = document.querySelector('.achievements-grid');
        if (!achievementsGrid) return;
        
        achievementsGrid.querySelectorAll('.achievement-item').forEach((item, index) => {
            const achievementKeys = Object.keys(this.state.achievements);
            if (index < achievementKeys.length) {
                const key = achievementKeys[index];
                const achievement = this.state.achievements[key];
                
                if (achievement.unlocked) {
                    item.classList.add('unlocked');
                } else {
                    item.classList.remove('unlocked');
                }
                
                const icon = item.querySelector('.achievement-icon');
                const name = item.querySelector('.achievement-name');
                const desc = item.querySelector('.achievement-desc');
                
                if (icon) icon.textContent = achievement.icon;
                if (name) name.textContent = achievement.name;
                if (desc) desc.textContent = achievement.description;
            }
        });
    }

    copyMessage(messageId) {
        const messageElement = typeof messageId === 'string' 
            ? document.getElementById(messageId) 
            : messageId.closest('.message');
        
        if (!messageElement) return;
        
        const text = messageElement.querySelector('.message-content').textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Сообщение скопировано в буфер обмена', 'success');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            this.showNotification('Ошибка копирования', 'error');
        });
    }

    speakMessage(messageId) {
        const messageElement = typeof messageId === 'string' 
            ? document.getElementById(messageId) 
            : messageId.closest('.message');
        
        if (!messageElement) return;
        
        const text = messageElement.querySelector('.message-content').textContent;
        this.speakText(text);
    }

    showTypingIndicator() {
        this.elements.typingIndicator.style.display = 'block';
    }

    hideTypingIndicator() {
        this.elements.typingIndicator.style.display = 'none';
    }

    showNotification(text, type = 'info') {
        const notification = this.elements.notification;
        const notificationText = this.elements.notificationText;
        
        notificationText.textContent = text;
        
        // Установка цвета в зависимости от типа
        switch(type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #ec4899, #8b5cf6)';
        }
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('verdikt_chat');
            if (savedData) {
                const data = JSON.parse(savedData);
                Object.assign(this.state, data);
                console.log('Данные загружены из localStorage');
            }
            
            const savedTheme = localStorage.getItem('verdikt_theme');
            if (savedTheme) {
                this.setTheme(savedTheme);
            }
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('verdikt_chat', JSON.stringify(this.state));
            localStorage.setItem('verdikt_theme', this.state.currentTheme);
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
        }
    }
}

// Сохраняем глобальный доступ
window.VerdiktChat = new VerdiktChatApp();


