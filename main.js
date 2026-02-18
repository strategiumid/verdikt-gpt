import { APIClient } from './apiClient.js';
import { ChatStore } from './chatStore.js';
import { UIManager } from './uiManager.js';
import { EncryptionService } from './encryptionService.js';
import { AuthService } from './authService.js';

// Основной класс 
export class VerdiktChatApp {
      // Статические словари для анализа тональности
    static NEGATIVE_WORDS = [
        'устал', 'устала', 'больно', 'плохо', 'грустно', 'тоска', 'одиноко', 'депрессия',
        'ненавижу', 'бесит', 'раздражает', 'обидно', 'обида', 'страшно', 'тревожно',
        'безнадежно', 'бесполезно', 'сдаюсь', 'опускаются руки', 'не вижу смысла',
        'мучение', 'страдание', 'апатия', 'выгорание', 'сорвался', 'сорвалась'
    ];

    static POSITIVE_WORDS = [
        'счастье', 'радость', 'люблю', 'нравится', 'классно', 'отлично', 'прекрасно',
        'замечательно', 'восторг', 'вдохновляет', 'надежда', 'верю', 'получается',
        'горжусь', 'доволен', 'довольна', 'спокойно', 'легко', 'комфортно', 'уютно'
    ];

    static HIGH_ENERGY_WORDS = [
        '!!!!', '???', 'Срочно', 'немедленно', 'помогите', 'спасите', 'крик души',
        'почему', 'зачем', 'когда же', 'сколько можно'
    ];
    constructor() {
        this.API_CONFIG = {
            url: 'https://routerai.ru/api/v1/chat/completions',
            model: 'mistralai/ministral-3b-2512', 
            maxTokens: 1400,
            temperature: 0.3,
            apiKey: "sk-ayshgI6SUUplUxB0ocKzEQ1IK73mbdql"
        };

        this.AUTH_CONFIG = {
            baseUrl: (window && window.VERDIKT_BACKEND_URL) || window.location.origin,
            endpoints: {
                register: '/api/auth/register',
                login: '/api/auth/login',
                me: '/api/auth/me',
                logout: '/api/auth/logout'
            }
        };

        this.state = {
            conversationHistory: [],
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
            isResponding: false,
            instructions: '',
            instructionsLoaded: false,
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
            isAdmin: false,
            doNotDisturb: false,
            balanceShown: false,
            adminQuestionFilter: 'all',
            adminUserFilter: 'all',
            adminUserSearchQuery: '',
            adminRoles: {},
            adminSubscriptions: {},
            questionComments: {},
            user: null,
            usage: null,
            authToken: null,
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
            chatMessages: document.getElementById('chat-messages'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            voiceInput: document.getElementById('voice-input'),
            newChat: document.getElementById('new-chat'),
            // settingsButton удалена - настройки теперь в профиле
            presentationMode: document.getElementById('presentation-mode'),
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notification-text'),
            apiStatus: document.getElementById('api-status'),
            smartSuggestions: document.getElementById('smart-suggestions'),
            typingIndicator: document.getElementById('typing-indicator'),
            achievementNotification: document.getElementById('achievement-notification'),
            dndToggle: document.getElementById('dnd-toggle'),
            adminModeToggle: document.getElementById('admin-mode-toggle'),
            loginButton: document.getElementById('login-button'),
            authModal: document.getElementById('auth-modal'),
            authClose: document.getElementById('auth-close'),
            
            prevSlide: document.getElementById('prev-slide'),
            nextSlide: document.getElementById('next-slide'),
            exitPresentation: document.getElementById('exit-presentation'),
            
            // settingsClose больше не нужен - настройки теперь в профиле
            exportClose: document.getElementById('export-close'),
            exportCancel: document.getElementById('export-cancel'),
            statsClose: document.getElementById('stats-close'),
            // saveSettings больше не нужен - настройки сохраняются автоматически
            // temperatureSlider и temperatureValue теперь в настройках профиля
            
            toggleChatHistory: document.getElementById('toggle-chat-history'),
            
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
            encryptionNote: document.getElementById('encryption-note'),

            sidebarToggle: document.getElementById('sidebar-toggle'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            sidebar: document.getElementById('sidebar'),
            sidebarUsername: document.getElementById('sidebar-username'),
            sidebarUseremail: document.getElementById('sidebar-useremail'),
            userAvatar: document.getElementById('user-avatar'),
            navProfile: document.getElementById('nav-profile'),
            navDashboard: document.getElementById('nav-dashboard'),
            navStories: document.getElementById('nav-stories'),
            navQuestions: document.getElementById('nav-questions'),
            navLikes: document.getElementById('nav-likes'),
            navComments: document.getElementById('nav-comments'),
            navSettings: document.getElementById('nav-settings'),
            navSecurity: document.getElementById('nav-security'),
            navNotifications: document.getElementById('nav-notifications'),
            // НОВЫЙ ПУНКТ
            navSubscription: document.getElementById('nav-subscription'),
            questionsBadge: document.getElementById('questions-badge'),
            likesBadge: document.getElementById('likes-badge'),
            commentsBadge: document.getElementById('comments-badge'),
            statQuestions: document.getElementById('stat-questions'),
            statLikes: document.getElementById('stat-likes'),
            statComments: document.getElementById('stat-comments'),
            statHelpful: document.getElementById('stat-helpful'),
            logoutSidebar: document.getElementById('logout-sidebar'),
            sidebarUserplan: document.getElementById('sidebar-userplan'),
            sidebarUsage: document.getElementById('sidebar-usage'),

            dashboardModal: document.getElementById('dashboard-modal'),
            dashboardClose: document.getElementById('dashboard-close'),
            dashboardUsername: document.getElementById('dashboard-username'),
            dashboardRating: document.getElementById('dashboard-rating'),
            dashboardTabs: document.querySelectorAll('.dashboard-tab'),
            dashboardTabContents: document.querySelectorAll('.dashboard-tab-content'),

            profileSettingsModal: document.getElementById('profile-settings-modal'),
            profileSettingsClose: document.getElementById('profile-settings-close'),
            profileSettingsForm: document.getElementById('profile-settings-form'),
            
            reloadInstructions: document.getElementById('reload-instructions'),

            // НОВЫЙ ЭЛЕМЕНТ ДЛЯ ЗАКРЫТИЯ ПОДПИСОК
            subscriptionClose: document.getElementById('subscription-close')
        };

        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSynthesis = window.speechSynthesis;
        this.recognition = null;
        this.activityChart = null;
        this.balanceChart = null;

        this.apiClient = new APIClient(this);
        this.chatStore = new ChatStore(this);
        this.uiManager = new UIManager(this);
        this.encryptionService = new EncryptionService(this);
        this.authService = new AuthService(this);

        this.availableModels = [
            { id: 'mistralai/ministral-3b-2512', name: 'Verdikt GPT', free: true }
        ];
        
        // Старые вкладки настроек больше не используются
    }

    createSystemPromptMessage() {
        const instructions = this.state?.instructions || '';
        
        return {
            role: "system",
            content: `Ты - Verdikt GPT, эксперт по психологии отношений, знакомств и манипуляций.
Отвечай на русском языке дружелюбно, но профессионально.
ВАЖНЫЕ ПРАВИЛА ЭКОНОМИИ ТОКЕНОВ:
1. Отвечай **кратко и по существу**. Избегай длинных вступлений, повторений и воды.
2. Для простых вопросов достаточно 3–5 предложений.
3. Для сложных вопросов дай самое важное (2–3 ключевых совета) и в конце добавь: "Если хотите подробнее, спросите".
4. Всегда завершай ответ полным предложением с точкой.
5. Не используй нумерованные списки из 10 пунктов – максимум 3–5, и только если это действительно нужно.
6. Если вопрос требует развернутого ответа, разбей его на логические части и предложи пользователю выбрать, о чём рассказать подробнее.

ПРИМЕР ХОРОШЕГО КОРОТКОГО ОТВЕТА:
**Понимаю вашу ситуацию.** Главное сейчас – перестать писать первой и заняться собой. Сфокусируйтесь на работе, спорте, новых хобби. Если она захочет – напишет сама. Хотите, расскажу подробнее про этапы игнора?

ПРИМЕР ПЛОХОГО ДЛИННОГО ОТВЕТА:
(много общих слов, повторений, ненужных деталей)

ДИАЛОГОВЫЙ ПОДХОД:
Не вываливай всю информацию сразу. Сначала задай уточняющие вопросы, чтобы понять контекст. Только потом давай совет – кратко и по делу.

 ВАЖНЫЕ ПРАВИЛА ФОРМАТИРОВАНИЯ:
        1. НИКОГДА не используй символ # в ответах.
        2. Для заголовков используй **жирный текст** или эмодзи.
        3. Для списков используй маркеры: • или - или *.
        4. **ОБЯЗАТЕЛЬНО ЗАВЕРШАЙ КАЖДОЕ ПРЕДЛОЖЕНИЕ И МЫСЛЬ.**
        5. НЕ ОБРЫВАЙ ОТВЕТ НА ПОЛУСЛОВЕ ИЛИ НЕЗАКОНЧЕННОЙ ФРАЗОЙ.
        6. Если ответ получается длинным, структурируй его с подзаголовками **вот так**, но **обязательно закончи каждую часть полным предложением**.
        7. Если чувствуешь, что не укладываешься в лимит, сократи ответ, но сохрани суть и заверши мысль.
        8. ВСЕГДА проверяй, что ответ закончен, прежде чем отправить.
Специализация:
💕 Отношения - конфликты, общение, восстановление
👥 Знакомства - советы по свиданиям, профилям
🛡️ Манипуляции - распознавание, защита, границы

${instructions ? 'ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ (используй их как базу знаний):\n' + instructions : ''}

Будь поддерживающим, давай практические советы, используй эмодзи умеренно.
Если пользователь спрашивает об игноре или возврате бывшей или для знакомств, используй эти инструкции как базу для ответов.
Адаптируй советы под конкретную ситуацию пользователя.

СТРУКТУРА ОТВЕТА:
• Начинай с краткого понимания ситуации
• Затем давай основные советы по пунктам
• В конце - резюме или следующий шаг

ПРИМЕР ХОРОШЕГО ФОРМАТИРОВАНИЯ:
**Понимаю вашу ситуацию** - это действительно сложно.

Вот что можно сделать:
• Первый важный шаг - это...
• Затем обратите внимание на...
• И самое главное - ...
Не используй символ # в ответах, убери лишние пропуски.`
        };
    }

    async loadInstructions() {
        try {
            console.log('Загрузка инструкций из instructions.txt...');
            const response = await fetch('instructions.txt?t=' + Date.now());
            if (response.ok) {
                const instructions = await response.text();
                this.state.instructions = instructions;
                this.state.instructionsLoaded = true;
                this.updateSystemPromptWithInstructions(instructions);
                console.log('✅ Инструкции успешно загружены, длина:', instructions.length);
                
                if (this.state.messageCount > 1) {
                    this.showNotification('Инструкции AI обновлены 📚', 'success');
                }
                
                return true;
            } else {
                console.warn('❌ Не удалось загрузить инструкции, статус:', response.status);
                this.state.instructionsLoaded = false;
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки инструкций:', error);
            this.state.instructionsLoaded = false;
            return false;
        }
    }

    updateSystemPromptWithInstructions(instructions) {
        const systemPrompt = this.createSystemPromptMessage();
        
        if (this.state.conversationHistory && this.state.conversationHistory.length > 0) {
            this.state.conversationHistory[0] = systemPrompt;
        } else {
            this.state.conversationHistory = [systemPrompt];
        }
    }

    analyzeUserType(message) {
        const messageLower = message.toLowerCase();

        // 1. Анализ на преследователя (как и было)
        const pursuitIndicators = [
            'бегал', 'унижал', 'прощал измены', 'умолял', 'выпрашивал',
            'писал первым', 'звонил', 'добивался', 'уговоры', 'доказательства',
            'унижался', 'бегаю', 'унижаюсь', 'прощаю измены'
        ];
        let isPursuer = pursuitIndicators.some(indicator => messageLower.includes(indicator));

        // 2. Анализ тональности (sentiment analysis)
        let sentimentScore = 0;
        // Считаем негативные слова
        VerdiktChatApp.NEGATIVE_WORDS.forEach(word => {
            if (messageLower.includes(word)) {
                sentimentScore -= 1;
            }
        });
        // Считаем позитивные слова
        VerdiktChatApp.POSITIVE_WORDS.forEach(word => {
            if (messageLower.includes(word)) {
                sentimentScore += 1;
            }
        });

        // 3. Анализ энергии (количество знаков ! и ?)
        const exclamationCount = (message.match(/!/g) || []).length;
        const questionCount = (message.match(/\?/g) || []).length;
        const isHighEnergy = (exclamationCount + questionCount) > 2 || VerdiktChatApp.HIGH_ENERGY_WORDS.some(word => messageLower.includes(word));

        // 4. Анализ длины сообщения
        const wordCount = message.split(/\s+/).length;
        const isLongMessage = wordCount > 30; // Сообщения длиннее 30 слов считаем подробными

        // 5. Определяем тип эмоционального состояния
        let emotionalState = 'neutral';
        if (sentimentScore < -1) {
            emotionalState = 'negative';
        } else if (sentimentScore > 1) {
            emotionalState = 'positive';
        }

        let exhaustionState = '';
        // Проверка на эмоциональное выгорание (много негатива + длинное сообщение)
        if (sentimentScore < -1 && isLongMessage && messageLower.includes('устал')) {
            exhaustionState = 'exhausted';
        }

        // Формируем расширенный контекст для AI
        let contextParts = [];
        if (isPursuer) {
            contextParts.push('Пользователь описывает себя как бывшего преследователя.');
        }
        if (emotionalState === 'negative') {
            contextParts.push('Эмоциональный фон сообщения: негативный.');
        } else if (emotionalState === 'positive') {
            contextParts.push('Эмоциональный фон сообщения: позитивный.');
        }
        if (isHighEnergy) {
            contextParts.push('Пользователь в возбужденном или тревожном состоянии (высокая энергия сообщения).');
        }
        if (exhaustionState) {
            contextParts.push('Пользователь может испытывать эмоциональное выгорание/усталость от отношений.');
        }
        if (isLongMessage && emotionalState === 'negative') {
            contextParts.push('Пользователь подробно описывает проблему, что говорит о глубокой вовлеченности.');
        }

        const contextString = contextParts.length > 0 ? `\n\n[Контекст: ${contextParts.join(' ')}]` : '';

        return {
            isPursuer: isPursuer,
            emotionalState: emotionalState,
            isHighEnergy: isHighEnergy,
            exhaustionState: exhaustionState,
            context: contextString, // Этот текст мы добавим к сообщению
            advice: isPursuer ?
                'Ты был в роли преследователя. Сейчас тебе нужно полностью стереть старую матрицу и начать с чистого листа, но уже в новой роли. Игнор для тебя — единственный способ.' :
                'Твоя позиция не выглядит как классическое преследование, но стратегия игнора всё равно работает на укрепление твоих позиций.'
        };
    }

    async init() {
        this.setupCookieNotification();
        this.loadApiKey();
        this.setupEventListeners();
        this.setupT9Suggestions();
        this.loadFromLocalStorage();
        this.loadUserFromStorage();
        await this.restoreSession();
        this.setupAdminMode();
        this.setupSpeechRecognition();
        this.setupBackgroundAnimations();
        
        await this.loadInstructions();
        
        this.updateUI();
        // Проверка API при загрузке не выполняется — подключение к API только при входе в аккаунт
        this.setupKeyboardShortcuts();
        this.setupServiceWorker();
        this.setupSettingsTabs();
        this.setupAuthUI();
        
        this.setupSidebar();
        this.setupDashboard();
        this.setupHeroChips();
        this.setupProfileSettings();
        
        await this.loadChats();
        
        if (this.state.user) {
            await this.loadUserSettings();
            await this.loadUsage();
        } else {
            const savedTheme = localStorage.getItem('verdikt_theme');
            if (savedTheme) this.setTheme(savedTheme);
        }

        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        
        setTimeout(async () => {
            await this.setupEncryption();
        }, 1000);
        
        this.startAutoSave();

        // НОВЫЙ ВЫЗОВ
        this.setupSubscriptionModal();
        
        console.log('✅ Verdikt GPT инициализирован');
        console.log('📚 Инструкции загружены:', this.state.instructionsLoaded);
        // load frontend feedback stats and update analytics
        this.loadFeedback();
        this.updateAnalyticsFromFeedback();
    }

    loadApiKey() {
        const savedApiKey = localStorage.getItem('verdikt_api_key');
        if (savedApiKey) {
            this.API_CONFIG.apiKey = savedApiKey;
        } else {
            this.API_CONFIG.apiKey = "sk-ayshgI6SUUplUxB0ocKzEQ1IK73mbdql";
        }
        
        this.API_CONFIG.model = "mistralai/ministral-3b-2512";
        localStorage.setItem('verdikt_model', this.API_CONFIG.model);
    }

    saveApiKey(apiKey) {
        if (apiKey) {
            localStorage.setItem('verdikt_api_key', apiKey);
            this.API_CONFIG.apiKey = apiKey;
        }
        
        this.showNotification('Настройки API сохранены ✅', 'success');
        this.checkApiStatus();
    }

    async getAIResponse(messages) {
        return this.apiClient.getAIResponse(messages);
    }

    async checkApiStatus() {
        return this.apiClient.checkApiStatus();
    }

    setupApiSettingsListeners() {
        // Кнопка API настроек теперь в настройках профиля (в HTML)
        // Обработчик события для неё уже настроен в setupProfileSettings()
        // Эта функция оставлена для совместимости, но больше ничего не делает
    }

    showApiSettingsModal() {
        const modalHTML = `
        <div class="modal" id="api-settings-modal">
            <div class="modal-content" style="max-width: 500px;">
                <button class="modal-close" id="api-settings-close">
                    <i class="fas fa-times"></i>
                </button>
                
                <h2 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-key"></i> Настройки API
                </h2>
                
               
                               
                        
                        <div style="
                            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
                            border-left: 3px solid #10b981;
                            padding: 15px;
                            border-radius: var(--radius-md);
                            margin: 20px 0;
                        ">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                <div style="
                                    width: 40px;
                                    height: 40px;
                                    background: linear-gradient(135deg, #10b981, #059669);
                                    border-radius: 10px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 18px;
                                ">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <div>
                                    <h4 style="margin: 0; font-size: 1.1rem;">Активная модель</h4>
                                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">Verdikt GPT</p>
                                </div>
                            </div>
                            <p style="font-size: 0.9rem; margin: 0; color: var(--text-secondary);">
                                <i class="fas fa-check-circle" style="color: #10b981;"></i> 
                                Бесплатная модель с хорошей производительностью.
                            </p>
                        </div>
                        
                        <div id="api-test-result" style="
                            display: none;
                            padding: 12px;
                            border-radius: var(--radius-sm);
                            margin-bottom: 15px;
                            font-size: 0.9rem;
                        "></div>
                    </div>
                </div>
                
                <div class="modal-buttons" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="ios-button secondary" id="test-api-key" style="flex: 1;">
                        <i class="fas fa-vial"></i> Проверить ключ
                    </button>
                    <button class="ios-button" id="save-api-settings" style="flex: 1;">
                        <i class="fas fa-save"></i> Сохранить
                    </button>
                    <button class="ios-button tertiary" id="api-settings-cancel" style="width: 100%;">
                        <i class="fas fa-times"></i> Отмена
                    </button>
                </div>
            </div>
        </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('api-settings-modal');
        modal.classList.add('active');
        
        const apiKeyInput = document.getElementById('api-key-input');
        const testResult = document.getElementById('api-test-result');
        
        document.getElementById('test-api-key').addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                testResult.innerHTML = '<span style="color: #ef4444;">Введите API ключ</span>';
                testResult.style.display = 'block';
                testResult.style.background = 'rgba(239, 68, 68, 0.1)';
                return;
            }
            
            const testBtn = document.getElementById('test-api-key');
            const originalText = testBtn.innerHTML;
            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
            testBtn.disabled = true;
            
            try {
                const response = await fetch('https://routerai.ru/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'mistralai/ministral-3b-2512',
                        messages: [{ role: 'user', content: 'test' }],
                        max_tokens: 5
                    })
                });
                
                if (response.ok) {
                    testResult.innerHTML = '<span style="color: #10b981;">✅ Ключ активен</span>';
                    testResult.style.display = 'block';
                    testResult.style.background = 'rgba(16, 185, 129, 0.1)';
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                testResult.innerHTML = `<span style="color: #ef4444;">❌ Ошибка: ${error.message}</span>`;
                testResult.style.display = 'block';
                testResult.style.background = 'rgba(239, 68, 68, 0.1)';
            } finally {
                testBtn.innerHTML = originalText;
                testBtn.disabled = false;
            }
        });
        
        document.getElementById('save-api-settings').addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                testResult.innerHTML = '<span style="color: #ef4444;">Введите API ключ</span>';
                testResult.style.display = 'block';
                testResult.style.background = 'rgba(239, 68, 68, 0.1)';
                return;
            }
            
            this.saveApiKey(apiKey);
            modal.remove();
            this.hideModal('settings-modal');
        });
        
        document.getElementById('api-settings-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('api-settings-close').addEventListener('click', () => {
            modal.remove();
        });
        
        apiKeyInput.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                setTimeout(() => {
                    apiKeyInput.type = 'password';
                }, 2000);
            }
        });
    }

    // ==================== НАСТРОЙКА ВКЛАДОК НАСТРОЕК ====================

    setupSettingsTabs() {
        // Старые вкладки настроек больше не используются - навигация теперь в профиле
        // Обновляем статистику и достижения при инициализации
        this.updateSettingsStats();
        this.updateSettingsAchievements();
    }

    updateSettingsStats() {
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

        this.updateSkillsTree();
    }

    updateSkillsTree() {
        const total = this.state.stats.totalMessages || 0;
        const empathyBase = this.state.stats.relationshipAdvice || 0;
        const protectionBase = this.state.stats.manipulationRequests || 0;
        const wisdomBase = this.state.stats.sessions || 0;

        const empathyLevel = Math.min(3, Math.floor(empathyBase / 5));
        const protectionLevel = Math.min(3, Math.floor(protectionBase / 3));
        const wisdomLevel = Math.min(3, Math.floor(total / 30));

        const empathyLabel = document.getElementById('skill-empathy-level');
        const protectionLabel = document.getElementById('skill-protection-level');
        const wisdomLabel = document.getElementById('skill-wisdom-level');

        if (empathyLabel) empathyLabel.textContent = `Уровень ${empathyLevel}`;
        if (protectionLabel) protectionLabel.textContent = `Уровень ${protectionLevel}`;
        if (wisdomLabel) wisdomLabel.textContent = `Уровень ${wisdomLevel}`;

        const setNodes = (branch, level) => {
            const nodes = document.querySelectorAll(`.skill-node[data-skill^="${branch}-"]`);
            nodes.forEach((node, index) => {
                if (index < level) {
                    node.classList.add('unlocked');
                } else {
                    node.classList.remove('unlocked');
                }
            });
        };

        setNodes('empathy', empathyLevel);
        setNodes('protection', protectionLevel);
        setNodes('wisdom', wisdomLevel);
    }

    updateSettingsAchievements() {
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

    // ==================== FEEDBACK STORAGE & ANALYTICS (frontend-only) ====================

    loadFeedback() {
        try {
            const raw = localStorage.getItem('verdikt_feedback');
            this.feedbackEntries = raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to load feedback:', e);
            this.feedbackEntries = [];
        }
    }

    saveFeedbackEntries() {
        try {
            localStorage.setItem('verdikt_feedback', JSON.stringify(this.feedbackEntries || []));
        } catch (e) {
            console.error('Failed to save feedback:', e);
        }
    }

    classifyTopic(text) {
        if (!text || typeof text !== 'string') return 'other';
        const t = text.toLowerCase();
        if (t.match(/отношен|любов|партн|развод|ссора|ревност/)) return 'relationships';
        if (t.match(/знаком|свидан|профил|подход|подпис|текст для/)) return 'dating';
        if (t.match(/манипуляц|манипулир|газлайт|контрол|токсич/)) return 'manipulation';
        if (t.match(/печаль|депресс|тревог|устал|грустит/)) return 'mental_health';
        return 'other';
    }

    rateMessage(messageId, rating) {
        try {
            const el = document.getElementById(messageId);
            if (!el) return;

            const contentEl = el.querySelector('.message-content');
            const aiContent = contentEl ? contentEl.textContent.trim() : '';

            // find last user message from conversationHistory
            let userPrompt = '';
            if (Array.isArray(this.state.conversationHistory)) {
                for (let i = this.state.conversationHistory.length - 1; i >= 0; i--) {
                    if (this.state.conversationHistory[i].role === 'user') {
                        userPrompt = this.state.conversationHistory[i].content || '';
                        break;
                    }
                }
            }

            this.feedbackEntries = this.feedbackEntries || [];
            const entry = {
                id: messageId,
                chatId: this.chatManager.currentChatId,
                rating: Number(rating),
                aiContent,
                userPrompt,
                timestamp: Date.now(),
                topic: this.classifyTopic(userPrompt)
            };

            this.feedbackEntries.push(entry);
            this.saveFeedbackEntries();

            const goodBtn = el.querySelector('.feedback-good');
            const badBtn = el.querySelector('.feedback-bad');
            if (goodBtn) goodBtn.disabled = true;
            if (badBtn) badBtn.disabled = true;
            if (rating > 0 && goodBtn) goodBtn.classList.add('selected');
            if (rating < 0 && badBtn) badBtn.classList.add('selected');

            this.updateAnalyticsFromFeedback();
        } catch (e) {
            console.error('Error in rateMessage:', e);
        }
    }

    updateAnalyticsFromFeedback() {
        try {
            const entries = this.feedbackEntries || [];
            const total = entries.length;
            const helpful = entries.filter(e => Number(e.rating) > 0).length;

            const byTopic = entries.reduce((acc, e) => {
                acc[e.topic] = (acc[e.topic] || 0) + (Number(e.rating) < 0 ? 1 : 0);
                return acc;
            }, {});

            const elTotal = document.getElementById('analytics-total');
            const elHelpful = document.getElementById('analytics-helpful');
            const elLikes = document.getElementById('analytics-likes');
            if (elTotal) elTotal.textContent = total;
            if (elHelpful) elHelpful.textContent = helpful;
            if (elLikes) elLikes.textContent = entries.filter(e => e.rating > 0).length;

            // populate a short summary in analytics area (if present)
            const analyticsSummary = document.getElementById('analytics-summary');
            if (analyticsSummary) {
                analyticsSummary.innerHTML = Object.entries(byTopic)
                    .map(([topic, count]) => `<div><strong>${topic}</strong>: ${count} плохих ответов</div>`)
                    .join('');
            }
        } catch (e) {
            console.error('Failed to update analytics:', e);
        }
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
                
                const maxId = Math.max(...this.chatManager.chats.map(chat => 
                    parseInt(chat.id.replace('chat-', '')) || 0
                ));
                this.chatManager.nextChatId = maxId + 1;
                
                const lastActiveId = localStorage.getItem('verdikt_last_active_chat');
                if (lastActiveId) {
                    const chat = this.chatManager.chats.find(c => c.id === lastActiveId);
                    if (chat) {
                        await this.loadChat(chat.id);
                        return;
                    }
                }
                
                if (this.chatManager.chats.length > 0) {
                    const lastChat = this.chatManager.chats[this.chatManager.chats.length - 1];
                    await this.loadChat(lastChat.id);
                } else {
                    this.createNewChat();
                }
            } else {
                this.createNewChat();
            }
            
            this.state.stats.totalChats = this.chatManager.chats.length;
            
        } catch (error) {
            console.error('Error loading chats:', error);
            this.createNewChat();
        }
    }

    async saveChats() {
        return this.chatStore.saveChats();
    }

    async saveEncryptedChats() {
        return this.chatStore.saveEncryptedChats();
    }

    async saveCurrentChat() {
        return this.chatStore.saveCurrentChat();
    }

    generateChatTitle() {
        const userMessages = this.state.conversationHistory
            .filter(msg => msg.role === 'user')
            .map(msg => msg.content);
        
        let title = 'Новый чат';
        
        if (userMessages.length > 0) {
            const firstMessage = userMessages[0];
            
            const words = firstMessage.split(' ').slice(0, 5);
            title = words.join(' ');
            
            if (title.length > 40) {
                title = title.substring(0, 37) + '...';
            }
            
            if (firstMessage.toLowerCase().includes('отношен') || firstMessage.toLowerCase().includes('любов')) {
                title = '💕 ' + title;
            } else if (firstMessage.toLowerCase().includes('знакомств') || firstMessage.toLowerCase().includes('свидан')) {
                title = '👥 ' + title;
            } else if (firstMessage.toLowerCase().includes('манипуляц') || firstMessage.toLowerCase().includes('токсичн')) {
                title = '🛡️ ' + title;
            } else if (firstMessage.toLowerCase().includes('игнор') || firstMessage.toLowerCase().includes('бывшая') || firstMessage.toLowerCase().includes('вернуть')) {
                title = '🔄 ' + title;
            }
        }
        
        return title;
    }

    async createNewChat() {
        const newChatId = 'chat-' + this.chatManager.nextChatId++;
        
        this.chatManager.currentChatId = newChatId;
        
        this.state.conversationHistory = [this.createSystemPromptMessage()];
        
        this.state.messageCount = 0;
        this.state.stats.totalMessages = 0;
        this.state.stats.userMessages = 0;
        this.state.stats.aiMessages = 0;
        this.state.retryCount = 0;

        const heroBlock = document.getElementById('hero-block');
        if (heroBlock) {
            heroBlock.style.display = 'flex';
        }
        this.syncInputPosition();

        this.elements.chatMessages.innerHTML = '';

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
        
        this.state.conversationHistory = [
            this.createSystemPromptMessage(),
            ...chat.messages
        ];
        
        if (chat.stats) {
            Object.assign(this.state.stats, chat.stats);
        }
        
        this.state.messageCount = chat.messages.length + 1;
        
        if (chat.mode) {
            this.setAIMode(chat.mode);
        }
        
        if (chat.theme) {
            this.setTheme(chat.theme);
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
                <div class="message-sender">
                    <i class="fas fa-${icon}"></i>
                    ${sender}
                </div>
                <div class="message-content">${this.formatMessage(msg.content)}</div>
                ${msg.role !== 'user' ? `
                <div class="message-feedback">
                    <button class="feedback-btn feedback-good" onclick="window.verdiktApp.rateMessage('${messageId}', 1)">👍 Было полезно</button>
                    <button class="feedback-btn feedback-bad" onclick="window.verdiktApp.rateMessage('${messageId}', -1)">👎 Не было полезно</button>
                </div>
                ` : ''}
                <div class="message-time">${this.formatTimestamp(chat.timestamp)}</div>
            `;
            
            this.elements.chatMessages.appendChild(messageElement);
        });
        
        const heroBlock = document.getElementById('hero-block');
        if (heroBlock) {
            heroBlock.style.display = chat.messages.length > 0 ? 'none' : 'flex';
        }
        this.syncInputPosition();

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
        
        if (date.toDateString() === now.toDateString()) {
            return `Сегодня ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `Вчера ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        if (date > weekAgo) {
            const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            return `${days[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        
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
            
            if (decryptedData.chats) {
                this.chatManager.chats = decryptedData.chats;
                this.state.stats.totalChats = this.chatManager.chats.length;
            }
            
            if (decryptedData.stats) {
                Object.assign(this.state.stats, decryptedData.stats);
            }
            
            if (decryptedData.achievements) {
                Object.keys(decryptedData.achievements).forEach(key => {
                    if (this.state.achievements[key]) {
                        this.state.achievements[key].unlocked = decryptedData.achievements[key].unlocked;
                    }
                });
            }
            
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
            
            this.state.conversationHistory = [this.createSystemPromptMessage()];
            
            this.showNotification('Приложение заблокировано 🔒', 'info');
            this.showLockScreen();
        }
    }

    // ==================== ФУНКЦИИ БОКОВОГО МЕНЮ ====================

    setupSidebar() {
        if (this.elements.sidebarToggle) {
            this.elements.sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        if (this.elements.sidebarOverlay) {
            this.elements.sidebarOverlay.addEventListener('click', () => {
                this.hideSidebar();
            });
        }

        const sidebarChatHistoryBtn = document.getElementById('sidebar-chat-history-btn');
        if (sidebarChatHistoryBtn) {
            sidebarChatHistoryBtn.addEventListener('click', () => {
                this.showChatHistoryModal();
                this.hideSidebar();
            });
        }

        const sidebarCollapse = document.getElementById('sidebar-collapse');
        if (sidebarCollapse) {
            sidebarCollapse.addEventListener('click', () => {
                if (window.matchMedia('(min-width: 769px)').matches) {
                    this.toggleSidebarCollapsed();
                } else {
                    this.hideSidebar();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('sidebar-search-input');
                if (this.elements.sidebar.classList.contains('active') && searchInput) {
                    searchInput.focus();
                } else {
                    this.showSidebar();
                    setTimeout(() => searchInput?.focus(), 450);
                }
            }
            if (e.key === 'Escape' && this.elements.sidebar?.classList.contains('active')) {
                this.hideSidebar();
            }
        });

        if (this.elements.navDashboard) {
            this.elements.navDashboard.addEventListener('click', () => {
                this.showDashboardModal();
                this.hideSidebar();
            });
        }

        if (this.elements.navProfile) {
            this.elements.navProfile.addEventListener('click', () => {
                this.showProfileSettingsModal();
                this.hideSidebar();
            });
        }

        if (this.elements.navSettings) {
            this.elements.navSettings.addEventListener('click', () => {
                this.showProfileSettingsModal();
                this.hideSidebar();
            });
        }

        if (this.elements.navQuestions) {
            this.elements.navQuestions.addEventListener('click', () => {
                this.showDashboardModal();
                this.switchDashboardTab('questions');
                this.hideSidebar();
            });
        }

        if (this.elements.navLikes) {
            this.elements.navLikes.addEventListener('click', () => {
                this.showDashboardModal();
                this.switchDashboardTab('activity');
                this.hideSidebar();
            });
        }

        if (this.elements.navComments) {
            this.elements.navComments.addEventListener('click', () => {
                this.showDashboardModal();
                this.switchDashboardTab('activity');
                this.hideSidebar();
            });
        }

        if (this.elements.navStories) {
            this.elements.navStories.addEventListener('click', () => {
                this.showDashboardModal();
                this.switchDashboardTab('stories');
                this.hideSidebar();
            });
        }

        // НОВЫЙ ОБРАБОТЧИК ДЛЯ ПОДПИСОК
        if (this.elements.navSubscription) {
            this.elements.navSubscription.addEventListener('click', () => {
                this.showSubscriptionModal();
                this.hideSidebar();
            });
        }

        if (this.elements.logoutSidebar) {
            this.elements.logoutSidebar.addEventListener('click', () => {
                this.logout();
                this.hideSidebar();
            });
        }

        this.applySidebarCollapsedState();
        this.updateSidebarInfo();
    }

    toggleSidebarCollapsed() {
        const sidebar = this.elements.sidebar;
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        try {
            localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
        } catch (_) {}
        this.updateSidebarCollapseButton();
    }

    applySidebarCollapsedState() {
        if (!window.matchMedia('(min-width: 769px)').matches) return;
        let collapsed = false;
        try {
            collapsed = localStorage.getItem('sidebarCollapsed') === '1';
        } catch (_) {}
        if (collapsed && this.elements.sidebar) {
            this.elements.sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
        }
        this.updateSidebarCollapseButton();
    }

    updateSidebarCollapseButton() {
        const btn = document.getElementById('sidebar-collapse');
        const icon = document.getElementById('sidebar-collapse-icon');
        if (!btn || !this.elements.sidebar) return;
        const isCollapsed = this.elements.sidebar.classList.contains('collapsed');
        btn.title = isCollapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар';
        if (icon) {
            icon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        }
    }

    toggleSidebar() {
        const isActive = this.elements.sidebar.classList.contains('active');
        if (isActive) {
            this.hideSidebar();
        } else {
            this.showSidebar();
        }
    }

    showSidebar() {
        this.elements.sidebar?.classList.add('active');
        this.elements.sidebarOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideSidebar() {
        this.elements.sidebar?.classList.remove('active');
        this.elements.sidebarOverlay?.classList.remove('active');
        document.body.style.overflow = '';
    }

    updateSidebarInfo() {
        if (!this.elements.sidebarUsername) return;
        
        if (this.state.user) {
            this.elements.sidebarUsername.textContent = this.state.user.name || this.state.user.email || 'Пользователь';
            this.elements.sidebarUseremail.textContent = this.state.user.email || 'В аккаунте';
            
            if (this.elements.dashboardUsername) {
                this.elements.dashboardUsername.textContent = this.state.user.name || this.state.user.email || 'Пользователь';
            }
            
            const avatarIcon = this.elements.userAvatar.querySelector('i');
            const avatarText = this.elements.userAvatar.querySelector('.avatar-initials');
            if (this.state.user.avatar) {
                this.elements.userAvatar.style.backgroundImage = `url(${this.state.user.avatar})`;
                this.elements.userAvatar.style.backgroundSize = 'cover';
                this.elements.userAvatar.style.backgroundPosition = 'center';
                if (avatarIcon) avatarIcon.style.display = 'none';
                if (avatarText) avatarText.style.display = 'none';
            } else {
                this.elements.userAvatar.style.backgroundImage = '';
                const name = this.state.user.name || this.state.user.email || '';
                const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
                if (avatarText) {
                    avatarText.textContent = initials;
                    avatarText.style.display = 'flex';
                }
                if (avatarIcon) avatarIcon.style.display = 'none';
            }
            
            if (this.elements.logoutSidebar) {
                this.elements.logoutSidebar.style.display = 'flex';
            }
            const sub = (this.state.user.subscription || 'free').toLowerCase();
            const planLabels = { free: 'FREE', lite: 'Lite', pro: 'Pro', ultimate: 'Ultimate' };
            if (this.elements.sidebarUserplan) {
                this.elements.sidebarUserplan.textContent = `План: ${planLabels[sub] || sub}`;
                this.elements.sidebarUserplan.style.display = 'block';
            }
        } else {
            this.elements.sidebarUsername.textContent = 'Гость';
            this.elements.sidebarUseremail.textContent = 'Войдите в аккаунт';
            
            if (this.elements.dashboardUsername) {
                this.elements.dashboardUsername.textContent = 'Гость';
            }
            
            const avatarIcon = this.elements.userAvatar?.querySelector('i');
            const avatarText = this.elements.userAvatar?.querySelector('.avatar-initials');
            if (avatarText) avatarText.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'flex';
            this.elements.userAvatar && (this.elements.userAvatar.style.backgroundImage = '');
            
            if (this.elements.logoutSidebar) {
                this.elements.logoutSidebar.style.display = 'none';
            }
            if (this.elements.sidebarUserplan) {
                this.elements.sidebarUserplan.style.display = 'none';
            }
            if (this.elements.sidebarUsage) {
                this.elements.sidebarUsage.style.display = 'none';
            }
        }
    }

    async loadUsage() {
        if (!this.state.user) return;
        try {
            const baseUrl = (this.AUTH_CONFIG.baseUrl || window.location.origin).replace(/\/$/, '');
            const res = await fetch(`${baseUrl}/api/users/me/usage`, { method: 'GET', credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                this.state.usage = { used: data.used, limit: data.limit };
                this.updateSidebarUsage();
            }
        } catch (e) {
            console.warn('loadUsage error', e);
        }
    }

    updateSidebarUsage() {
        const el = this.elements.sidebarUsage;
        if (!el) return;
        const u = this.state.usage;
        if (this.state.user && u) {
            el.textContent = `Запросов: ${u.used} / ${u.limit} за месяц`;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    updateSubscriptionModalState() {
        const modal = document.getElementById('subscription-modal');
        if (!modal) return;
        const current = this.state.user ? (this.state.user.subscription || 'free').toLowerCase() : null;
        modal.querySelectorAll('.subscription-card').forEach(card => {
            const plan = (card.getAttribute('data-plan') || '').toLowerCase();
            const btn = card.querySelector('.subscription-plan-btn');
            if (!btn) return;
            const isCurrent = current !== null && plan === current;
            btn.textContent = isCurrent ? 'Текущий план' : 'Выбрать';
            btn.classList.toggle('secondary', isCurrent);
            btn.disabled = isCurrent;
        });
    }

    // ==================== ДАШБОРД ====================

    setupDashboard() {
        this.elements.dashboardTabs = document.querySelectorAll('.dashboard-tab');
        this.elements.dashboardTabContents = document.querySelectorAll('.dashboard-tab-content');
        
        if (!this.elements.dashboardTabs.length) return;
        
        this.elements.dashboardTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchDashboardTab(tabId);
            });
        });
        
        if (this.elements.dashboardClose) {
            this.elements.dashboardClose.addEventListener('click', () => {
                this.hideModal('dashboard-modal');
            });
        }

        const dashboardModal = document.getElementById('dashboard-modal');
        if (dashboardModal) {
            dashboardModal.addEventListener('click', async (e) => {
                const likeBtn = e.target.closest('[data-action="like"]');
                const dislikeBtn = e.target.closest('[data-action="dislike"]');
                const commentBtn = e.target.closest('[data-action="comment"]');
                const commentsBlock = e.target.closest('.comments-count');
                const sourceEl = likeBtn || dislikeBtn || commentBtn || commentsBlock;
                const cardEl = e.target.closest('.question-card[data-question-id]');
                const questionId = sourceEl?.getAttribute('data-question-id') || cardEl?.getAttribute('data-question-id');
                if (!questionId) return;
                if (!this.state.user) {
                    if (commentBtn || commentsBlock) this.showNotification('Войдите в аккаунт, чтобы ответить', 'warning');
                    return;
                }
                if (likeBtn) {
                    await this.setQuestionReaction(questionId, 'like');
                    return;
                }
                if (dislikeBtn) {
                    await this.setQuestionReaction(questionId, 'dislike');
                    return;
                }
                if (commentBtn || commentsBlock) this.showQuestionCommentModal(questionId);
            });
        }

        const commentSubmitBtn = document.getElementById('question-comment-submit');
        if (commentSubmitBtn && !commentSubmitBtn._bound) {
            commentSubmitBtn.addEventListener('click', async () => {
                const textarea = document.getElementById('question-comment-input');
                const text = textarea ? textarea.value : '';
                const questionId = this.currentCommentQuestionId;
                if (!questionId) return;

                await this.submitQuestionComment(questionId, text);

                if (textarea) {
                    textarea.value = '';
                }

                await this.loadQuestionComments(questionId, true);
                this.renderQuestionComments(questionId);
            });
            commentSubmitBtn._bound = true;
        }
        
        this.loadDashboardData();
    }

    switchDashboardTab(tabId) {
        if (!this.elements.dashboardTabs) return;
        
        this.elements.dashboardTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        this.elements.dashboardTabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`.dashboard-tab[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(`${tabId}-tab`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        if (tabId === 'analytics') {
            this.renderAnalytics();
        }
    }

    showDashboardModal() {
        if (!this.state.user) {
            this.showNotification('Войдите в аккаунт для просмотра дашборда', 'warning');
            return;
        }
        
        this.loadDashboardData();
        this.showModal('dashboard-modal');
    }

    // ==================== НАСТРОЙКИ ПРОФИЛЯ ====================

    setupProfileSettings() {
        if (this.elements.profileSettingsClose) {
            this.elements.profileSettingsClose.addEventListener('click', () => {
                this.hideModal('profile-settings-modal');
            });
        }
        
        // Навигация по секциям настроек профиля
        const navItems = document.querySelectorAll('.profile-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                
                // Убираем активный класс со всех элементов навигации
                navItems.forEach(nav => nav.classList.remove('active'));
                // Добавляем активный класс к выбранному элементу
                item.classList.add('active');
                
                // Скрываем все секции
                document.querySelectorAll('.profile-settings-section').forEach(sec => {
                    sec.classList.remove('active');
                    sec.style.display = 'none';
                });
                
                // Показываем выбранную секцию
                const targetSection = document.getElementById(`${section}-section`);
                if (targetSection) {
                    targetSection.classList.add('active');
                    targetSection.style.display = 'block';
                }
            });
        });
        
        // Редактирование описания профиля
        const profileBioEditBtn = document.getElementById('profile-bio-edit-btn');
        const profileBioDisplay = document.getElementById('profile-bio-display');
        const profileBioSection = document.getElementById('profile-bio-section');
        
        if (profileBioEditBtn) {
            profileBioEditBtn.addEventListener('click', () => {
                if (profileBioDisplay) {
                    profileBioDisplay.style.display = 'none';
                }
                if (profileBioSection) {
                    profileBioSection.style.display = 'block';
                    const profileBioInput = document.getElementById('profile-bio-input');
                    if (profileBioInput) {
                        const savedBio = localStorage.getItem('verdikt_user_bio') || '';
                        profileBioInput.value = savedBio;
                        profileBioInput.focus();
                    }
                }
            });
        }
        
        // Сохранение описания профиля
        const profileBioSave = document.getElementById('profile-bio-save');
        const profileBioCancel = document.getElementById('profile-bio-cancel');
        const profileBioInput = document.getElementById('profile-bio-input');
        
        if (profileBioSave) {
            profileBioSave.addEventListener('click', () => {
                const bio = profileBioInput ? profileBioInput.value.trim() : '';
                localStorage.setItem('verdikt_user_bio', bio);
                if (this.state.user) {
                    this.state.user.bio = bio;
                }
                this.updateProfileBioDisplay(bio);
                this.showNotification('Описание профиля сохранено', 'success');
                if (profileBioSection) {
                    profileBioSection.style.display = 'none';
                }
                if (profileBioDisplay) {
                    profileBioDisplay.style.display = 'block';
                }
            });
        }
        
        if (profileBioCancel) {
            profileBioCancel.addEventListener('click', () => {
                if (profileBioInput) {
                    const savedBio = localStorage.getItem('verdikt_user_bio') || '';
                    profileBioInput.value = savedBio;
                }
                if (profileBioSection) {
                    profileBioSection.style.display = 'none';
                }
                if (profileBioDisplay) {
                    profileBioDisplay.style.display = 'block';
                }
            });
        }
        
        
        // Загрузка аватарки
        const avatarInput = document.getElementById('profile-avatar-input');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const avatarDisplay = document.getElementById('profile-avatar-display');
                        if (avatarDisplay) {
                            avatarDisplay.style.backgroundImage = `url(${event.target.result})`;
                            avatarDisplay.textContent = '';
                            if (this.state.user) {
                                this.state.user.avatar = event.target.result;
                                localStorage.setItem('verdikt_user_avatar', event.target.result);
                                this.showNotification('Аватарка обновлена', 'success');
                            }
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // Выбор темы (только фронтенд, без отправки на бэкенд)
        const themeOptions = document.querySelectorAll('.theme-option-profile');
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                themeOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                // Используем setTheme с флагом skipBackend, чтобы не отправлять на бэкенд
                this.setTheme(theme, { skipBackend: true });
                this.showNotification(`Тема изменена на ${theme === 'dark' ? 'темную' : 'светлую'}`, 'success');
            });
        });
        
        // Выбор подписки
        const subscriptionCards = document.querySelectorAll('.subscription-card-profile');
        const subscriptionButtons = document.querySelectorAll('.subscription-select-btn');
        
        subscriptionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const subscription = btn.dataset.subscription;
                subscriptionCards.forEach(card => card.classList.remove('active'));
                const card = document.querySelector(`.subscription-card-profile[data-subscription="${subscription}"]`);
                if (card) {
                    card.classList.add('active');
                    // Сохраняем подписку только локально (фронтенд)
                    localStorage.setItem('verdikt_user_subscription', subscription);
                    this.showNotification(`Подписка изменена на ${subscription.toUpperCase()}`, 'success');
                }
            });
        });
        
        // Промо код
        const profilePromoInput = document.getElementById('profile-promo-input');
        const profilePromoApply = document.getElementById('profile-promo-apply');
        const profilePromoStatus = document.getElementById('profile-promo-status');
        
        // Загружаем сохраненный промо код
        if (profilePromoInput) {
            const savedPromo = localStorage.getItem('verdikt_promo_code') || '';
            profilePromoInput.value = savedPromo;
            if (savedPromo) {
                this.updatePromoStatus('success', `Промо код "${savedPromo}" применен`);
            }
        }
        
        // Применение промо кода
        if (profilePromoApply) {
            profilePromoApply.addEventListener('click', () => {
                this.applyPromoCode();
            });
        }
        
        // Применение по Enter
        if (profilePromoInput) {
            profilePromoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applyPromoCode();
                }
            });
        }
        
        // Режимы AI в настройках профиля
        const modeItems = document.querySelectorAll('.mode-item-settings');
        modeItems.forEach(item => {
            item.addEventListener('click', () => {
                const mode = item.dataset.mode;
                modeItems.forEach(m => m.classList.remove('active'));
                item.classList.add('active');
                this.setAIMode(mode);
                localStorage.setItem('verdikt_ai_mode', mode);
                this.showNotification(`Режим изменен на "${this.state.aiModes[mode]?.name || mode}"`, 'success');
            });
        });
        
        // Температура AI
        const temperatureSlider = document.getElementById('temperature-slider');
        const temperatureValue = document.getElementById('temperature-value');
        if (temperatureSlider && temperatureValue) {
            temperatureSlider.value = this.API_CONFIG.temperature;
            temperatureValue.textContent = this.API_CONFIG.temperature;
            
            temperatureSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                temperatureValue.textContent = value.toFixed(1);
                this.API_CONFIG.temperature = value;
                localStorage.setItem('verdikt_temperature', value.toString());
            });
        }
        
        // Кнопка настроек API
        const apiSettingsButton = document.getElementById('api-settings-button');
        if (apiSettingsButton) {
            apiSettingsButton.addEventListener('click', () => {
                this.showApiSettingsModal();
            });
        }
        
        // Кнопка управления шифрованием
        const encryptionManager = document.getElementById('encryption-manager');
        if (encryptionManager) {
            encryptionManager.addEventListener('click', () => {
                this.showNotification('Функция управления шифрованием в разработке', 'info');
            });
        }
        
        // Обновление статистики при открытии секции статистики
        const statsSection = document.getElementById('stats-section');
        if (statsSection) {
            // Обновляем статистику сразу при открытии настроек профиля
            this.updateSettingsStats();
            
            // Также обновляем при переключении на секцию статистики
            const observer = new MutationObserver(() => {
                if (statsSection.style.display !== 'none' && statsSection.classList.contains('active')) {
                    this.updateSettingsStats();
                }
            });
            observer.observe(statsSection, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        
        // Обновление достижений при открытии секции достижений
        const achievementsSection = document.getElementById('achievements-section');
        if (achievementsSection) {
            this.updateSettingsAchievements();
            
            const observer = new MutationObserver(() => {
                if (achievementsSection.style.display !== 'none' && achievementsSection.classList.contains('active')) {
                    this.updateSettingsAchievements();
                }
            });
            observer.observe(achievementsSection, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        
        // Форма профиля больше не используется - все настройки сохраняются локально
        // Функция saveProfileSettings оставлена для совместимости, но не вызывается
    }
    
    applyPromoCode() {
        const profilePromoInput = document.getElementById('profile-promo-input');
        const profilePromoStatus = document.getElementById('profile-promo-status');
        
        if (!profilePromoInput || !profilePromoStatus) return;
        
        const promoCode = profilePromoInput.value.trim().toUpperCase();
        
        if (!promoCode) {
            this.updatePromoStatus('error', 'Введите промо код');
            return;
        }
        
        // Валидация промо кода (только фронтенд)
        if (promoCode.length < 3) {
            this.updatePromoStatus('error', 'Промо код должен содержать минимум 3 символа');
            return;
        }
        
        // Сохраняем промо код локально
        localStorage.setItem('verdikt_promo_code', promoCode);
        
        // Обновляем статус
        this.updatePromoStatus('success', `Промо код "${promoCode}" успешно применен!`);
        
        // Очищаем поле ввода после успешного применения
        setTimeout(() => {
            profilePromoInput.value = promoCode;
        }, 100);
        
        this.showNotification('Промо код применен', 'success');
    }
    
    updatePromoStatus(type, message) {
        const profilePromoStatus = document.getElementById('profile-promo-status');
        if (!profilePromoStatus) return;
        
        profilePromoStatus.className = `profile-promo-status ${type}`;
        
        if (type === 'success') {
            profilePromoStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        } else if (type === 'error') {
            profilePromoStatus.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        } else {
            profilePromoStatus.innerHTML = message;
        }
    }
    
    updateProfileBioDisplay(bio) {
        const bioDisplayText = document.getElementById('profile-bio-display-text');
        if (bioDisplayText) {
            if (bio && bio.trim()) {
                // Экранируем HTML для безопасности
                const escapedBio = bio
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                bioDisplayText.innerHTML = `<span class="profile-bio-content">${escapedBio.replace(/\n/g, '<br>')}</span>`;
            } else {
                bioDisplayText.innerHTML = '<span class="profile-bio-empty">Описание не указано</span>';
            }
        }
    }

    showProfileSettingsModal() {
        if (!this.state.user) {
            this.showNotification('Войдите в аккаунт для настройки профиля', 'warning');
            return;
        }
        
        // Обновляем отображение профиля в новом формате
        const displayName = document.getElementById('profile-display-name');
        const displayEmail = document.getElementById('profile-display-email');
        const profileAvatar = document.querySelector('.profile-avatar');
        
        if (displayName) {
            displayName.textContent = this.state.user.name || 'Пользователь';
        }
        if (displayEmail) {
            displayEmail.textContent = this.state.user.email || '';
        }
        const avatarDisplay = document.getElementById('profile-avatar-display');
        if (avatarDisplay) {
            // Загружаем сохраненную аватарку или генерируем инициалы
            const savedAvatar = localStorage.getItem('verdikt_user_avatar');
            if (savedAvatar) {
                avatarDisplay.style.backgroundImage = `url(${savedAvatar})`;
                avatarDisplay.textContent = '';
                if (this.state.user) {
                    this.state.user.avatar = savedAvatar;
                }
            } else if (this.state.user && this.state.user.name) {
                // Генерируем инициалы из имени
                const initials = this.state.user.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
                avatarDisplay.textContent = initials || 'U';
                avatarDisplay.style.backgroundImage = '';
            }
        }
        
        // Загружаем и отображаем описание профиля
        const savedBio = localStorage.getItem('verdikt_user_bio') || '';
        if (this.state.user) {
            this.state.user.bio = savedBio;
        }
        this.updateProfileBioDisplay(savedBio);
        
        const profileBioInput = document.getElementById('profile-bio-input');
        if (profileBioInput) {
            profileBioInput.value = savedBio;
        }
        
        // Загружаем промо код
        const profilePromoInput = document.getElementById('profile-promo-input');
        const savedPromo = localStorage.getItem('verdikt_promo_code') || '';
        if (profilePromoInput) {
            profilePromoInput.value = savedPromo;
            if (savedPromo) {
                this.updatePromoStatus('success', `Промо код "${savedPromo}" применен`);
            } else {
                const profilePromoStatus = document.getElementById('profile-promo-status');
                if (profilePromoStatus) {
                    profilePromoStatus.innerHTML = '';
                    profilePromoStatus.className = 'profile-promo-status';
                }
            }
        }
        
        // Устанавливаем активную тему
        const currentTheme = localStorage.getItem('verdikt_theme') || 'dark';
        const themeOptions = document.querySelectorAll('.theme-option-profile');
        themeOptions.forEach(option => {
            if (option.dataset.theme === currentTheme) {
                option.classList.add('active');
            }
        });
        
        // Устанавливаем активную подписку
        const currentSubscription = localStorage.getItem('verdikt_user_subscription') || 'free';
        const subscriptionCard = document.querySelector(`.subscription-card-profile[data-subscription="${currentSubscription}"]`);
        if (subscriptionCard) {
            subscriptionCard.classList.add('active');
        }
        
        // Устанавливаем активный режим AI
        const currentAIMode = localStorage.getItem('verdikt_ai_mode') || this.state.currentMode || 'balanced';
        const modeItems = document.querySelectorAll('.mode-item-settings');
        modeItems.forEach(item => {
            if (item.dataset.mode === currentAIMode) {
                item.classList.add('active');
            }
        });
        
        // Загружаем температуру из localStorage
        const savedTemperature = localStorage.getItem('verdikt_temperature');
        if (savedTemperature) {
            this.API_CONFIG.temperature = parseFloat(savedTemperature);
            const tempSlider = document.getElementById('temperature-slider');
            const tempValue = document.getElementById('temperature-value');
            if (tempSlider) tempSlider.value = this.API_CONFIG.temperature;
            if (tempValue) tempValue.textContent = this.API_CONFIG.temperature;
        }
        
        // Старые поля формы (если они еще используются)
        const profileNameInput = document.getElementById('profile-name');
        const profileEmailInput = document.getElementById('profile-email');
        if (profileNameInput) profileNameInput.value = this.state.user.name || '';
        if (profileEmailInput) profileEmailInput.value = this.state.user.email || '';
        
        const profileBio = document.getElementById('profile-bio');
        if (profileBio) profileBio.value = this.state.user.bio || '';
        
        const expertiseSelect = document.getElementById('profile-expertise');
        if (expertiseSelect) {
            Array.from(expertiseSelect.options).forEach(option => {
                option.selected = false;
            });
            
            if (this.state.user.expertise && Array.isArray(this.state.user.expertise)) {
                this.state.user.expertise.forEach(exp => {
                    const option = expertiseSelect.querySelector(`option[value="${exp}"]`);
                    if (option) option.selected = true;
                });
            }
        }
        
        const privacySelect = document.getElementById('profile-privacy');
        if (privacySelect) {
            privacySelect.value = this.state.user.privacy || 'public';
        }

        this.updateProfileSubscriptionDisplay();
        this.showModal('profile-settings-modal');
    }

    getActiveSubscription() {
        try {
            return (localStorage.getItem('verdikt_user_subscription') || 'free').toLowerCase();
        } catch (_) {
            return 'free';
        }
    }

    getSubscriptionDisplayName(key) {
        const names = { free: 'Verdikt-GPT FREE', lite: 'Verdikt-GPT Lite', pro: 'Verdikt-GPT Pro', ultimate: 'Verdikt-GPT Ultimate' };
        return names[key] || names.free;
    }

    updateProfileSubscriptionDisplay() {
        const el = document.getElementById('profile-subscription-value');
        if (!el) return;
        const key = this.getActiveSubscription();
        el.textContent = this.getSubscriptionDisplayName(key);
        el.className = 'profile-subscription-value profile-subscription--' + key;
    }

    async saveProfileSettings() {
        try {
            const profileData = {
                name: document.getElementById('profile-name').value.trim(),
                email: document.getElementById('profile-email').value.trim(),
                bio: document.getElementById('profile-bio').value.trim(),
                expertise: Array.from(document.getElementById('profile-expertise').selectedOptions)
                    .map(option => option.value),
                privacy: document.getElementById('profile-privacy').value
            };
            
            if (!profileData.name) {
                this.showNotification('Введите имя', 'warning');
                return;
            }
            
            if (!profileData.email) {
                this.showNotification('Введите email', 'warning');
                return;
            }
            
            if (!this.state.user) {
                this.showNotification('Войдите в аккаунт для сохранения профиля', 'warning');
                return;
            }
            
            const url = `${this.AUTH_CONFIG.baseUrl}/api/users/me`;
            const response = await fetch(url, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
                body: JSON.stringify(profileData)
            });
            
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const message = err.message || (response.status === 401 ? 'Войдите снова' : `Ошибка ${response.status}`);
                throw new Error(message);
            }
            
            const data = await response.json();
            this.setUser(data);
            
            this.hideModal('profile-settings-modal');
            this.showNotification('Профиль обновлен ✅', 'success');
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showNotification(error.message || 'Ошибка при обновлении профиля', 'error');
        }
    }

    // ==================== ОСНОВНЫЕ ФУНКЦИИ ЧАТА ====================

    setupEventListeners() {
        // Send button (if exists)
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => {
                if (!this.state.isResponding) {
                    this.sendMessage();
                }
            });
            // Инициализируем состояние кнопки
            this.updateSendButtonState();
        }
        
        // Enter key to send message
        if (!this.elements.messageInput) {
            console.error('messageInput element not found');
            return;
        }
        
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Блокируем отправку, если ИИ отвечает
                if (!this.state.isResponding) {
                    this.sendMessage();
                }
            } else if (e.key === 'Enter' && e.shiftKey) {
                // Allow Shift+Enter for new line
                return;
            }
        });
        
        if (this.elements.voiceInput) {
            this.elements.voiceInput.addEventListener('click', () => this.toggleVoiceRecording());
        }
        
        // Обработчики для режимов AI теперь настраиваются в setupProfileSettings()
        // Этот код выполняется при инициализации, когда элементы могут еще не существовать
        
        // Grok-style AI Mode Selector
        this.setupGrokModeSelector();
        
        // Обработчики для примеров вопросов (если они существуют)
        const exampleButtons = document.querySelectorAll('.example-button');
        if (exampleButtons.length > 0) {
            exampleButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const question = e.currentTarget.dataset.question;
                    if (this.elements.messageInput) {
                        this.elements.messageInput.value = question;
                        this.elements.messageInput.focus();
                    }
                });
            });
        }
        
        if (this.elements.newChat) {
            this.elements.newChat.addEventListener('click', () => this.createNewChat());
        }
        // Кнопка настроек удалена - настройки теперь в профиле
        if (this.elements.presentationMode) {
            this.elements.presentationMode.addEventListener('click', () => this.togglePresentationMode());
        }
        
        if (this.elements.toggleChatHistory) {
            this.elements.toggleChatHistory.addEventListener('click', () => {
                this.showChatHistoryModal();
            });
        }

        if (this.elements.dndToggle) {
            this.elements.dndToggle.addEventListener('click', () => {
                this.state.doNotDisturb = !this.state.doNotDisturb;
                const enabled = this.state.doNotDisturb;

                this.elements.dndToggle.innerHTML = enabled
                    ? '<i class="fas fa-bell-slash"></i>'
                    : '<i class="fas fa-bell"></i>';

                const status = this.elements.apiStatus || null;
                if (status) {
                    status.classList.toggle('dnd-active', enabled);
                }

                this.showNotification(
                    enabled ? 'Режим «Не беспокоить» включен' : 'Режим «Не беспокоить» выключен',
                    'info'
                );
            });
        }

        const messageInput = this.elements.messageInput;
        if (messageInput) {
            const inputContainer = messageInput.closest('.input-container-extended') || messageInput;

            const preventDefaults = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                inputContainer.addEventListener(eventName, preventDefaults);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                inputContainer.addEventListener(eventName, () => {
                    inputContainer.classList.add('drag-over');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                inputContainer.addEventListener(eventName, () => {
                    inputContainer.classList.remove('drag-over');
                });
            });

            inputContainer.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const file = dt && dt.files && dt.files[0];
                if (!file) return;

                const allowedTypes = [
                    'text/plain',
                    'application/json'
                ];
                const isAllowed =
                    allowedTypes.includes(file.type) ||
                    file.name.endsWith('.txt') ||
                    file.name.endsWith('.json');

                if (!isAllowed) {
                    this.showNotification('Можно перетащить только .txt или .json файл', 'warning');
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    const text = reader.result || '';
                    if (!text) return;

                    const current = messageInput.value || '';
                    const separator = current && !current.endsWith('\n') ? '\n\n' : '';
                    messageInput.value = current + separator + String(text);
                    messageInput.focus();
                };
                reader.onerror = () => {
                    this.showNotification('Не удалось прочитать файл', 'error');
                };
                reader.readAsText(file, 'utf-8');
            });
        }
        
        // Обработчик для слайдера температуры теперь в setupProfileSettings()
        // Эти элементы больше не находятся в this.elements, так как они в настройках профиля
        const temperatureSlider = document.getElementById('temperature-slider');
        const temperatureValue = document.getElementById('temperature-value');
        if (temperatureSlider && temperatureValue) {
            temperatureSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                temperatureValue.textContent = value;
                this.API_CONFIG.temperature = parseFloat(value);
            });
        }
        
        // Обработчики для выбора темы (если элементы существуют)
        const themeOptions = document.querySelectorAll('.theme-option');
        if (themeOptions.length > 0) {
            themeOptions.forEach(theme => {
                theme.addEventListener('click', (e) => {
                    const themeName = e.currentTarget.dataset.theme;
                    this.setTheme(themeName);
                    
                    themeOptions.forEach(opt => opt.classList.remove('active'));
                    theme.classList.add('active');
                });
            });
        }
        
        // Обработчики для опций экспорта (если модальное окно существует)
        const exportOptions = document.querySelectorAll('#export-modal .export-option');
        if (exportOptions.length > 0) {
            exportOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    const format = e.currentTarget.dataset.format;
                    this.exportChat(format);
                });
            });
        }
        
        // Обработчики для старого модального окна настроек больше не нужны
        // Все настройки теперь в профиле
        if (this.elements.exportClose) {
            this.elements.exportClose.addEventListener('click', () => this.hideModal('export-modal'));
        }
        if (this.elements.exportCancel) {
            this.elements.exportCancel.addEventListener('click', () => this.hideModal('export-modal'));
        }
        if (this.elements.statsClose) {
            this.elements.statsClose.addEventListener('click', () => this.hideModal('stats-modal'));
        }
        
        if (this.elements.prevSlide) {
            this.elements.prevSlide.addEventListener('click', () => this.prevSlide());
        }
        if (this.elements.nextSlide) {
            this.elements.nextSlide.addEventListener('click', () => this.nextSlide());
        }
        if (this.elements.exitPresentation) {
            this.elements.exitPresentation.addEventListener('click', () => this.togglePresentationMode());
        }
        
        if (this.elements.messageInput) {        
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('input', () => {
                this.elements.messageInput.style.height = 'auto';
                this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 200) + 'px';
            });
        }
        }
        
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
        
        window.addEventListener('beforeunload', () => this.saveToLocalStorage());
        
        const modelInfo = document.getElementById('model-info');
        if (modelInfo) {
            modelInfo.addEventListener('click', (e) => {
                e.preventDefault();
                this.showNotification('Используется: Verdikt GPT-b v0.01', 'info');
            });
        }
        
        document.getElementById('privacy-policy').addEventListener('click', (e) => {
            e.preventDefault();
            this.showNotification('Данные чатов хранятся локально в вашем браузере', 'info');
        });
        
        document.getElementById('encryption-manager')?.addEventListener('click', () => {
            this.showEncryptionManager();
        });

        this.setupApiSettingsListeners();
        
        this.setupImportListeners();
        this.setupExportListeners();

        if (this.elements.reloadInstructions) {
            this.elements.reloadInstructions.addEventListener('click', async () => {
                await this.loadInstructions();
                this.showNotification('Инструкции успешно обновлены ✅', 'success');
            });
        }

        // Обработчик клика на сферу для показа/скрытия кнопок выбора
        const animatedSphere = document.querySelector('.animated-sphere');
        if (animatedSphere) {
            animatedSphere.addEventListener('click', (e) => {
                // Не активируем, если клик был по кнопке
                if (e.target.closest('.hero-chip')) {
                    return;
                }
                animatedSphere.classList.toggle('active');
            });
        }

        const chips = document.querySelectorAll('.hero-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем закрытие при клике на кнопку
                const question = chip.dataset.question;
                if (question) {
                    this.elements.messageInput.value = question;
                    this.elements.messageInput.focus();
                    this.elements.messageInput.style.height = 'auto';
                    this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 200) + 'px';
                    // Закрываем кнопки после выбора
                    if (animatedSphere) {
                        animatedSphere.classList.remove('active');
                    }
                }
            });
        });

        // НОВЫЙ ОБРАБОТЧИК ДЛЯ ЗАКРЫТИЯ ПОДПИСОК
        if (this.elements.subscriptionClose) {
            this.elements.subscriptionClose.addEventListener('click', () => {
                this.hideModal('subscription-modal');
            });
        }
    }

    async sendMessage() {
        // Блокируем отправку, если ИИ уже отвечает
        if (this.state.isResponding) {
            return;
        }
        
        const message = this.elements.messageInput.value.trim();
        
        if (!message) {
            this.showNotification('Введите сообщение', 'warning');
            return;
        }

        if (!this.state.user) {
            this.showNotification('Чтобы отправить сообщение, пожалуйста, авторизуйтесь', 'warning');
            return;
        }
        
        if (message.startsWith('/')) {
            if (this.handleCommand(message)) {
                this.elements.messageInput.value = '';
                return;
            }
        }
        
        //if (!this.isTopicRelevant(message)) {
            this.showNotification('Я специализируюсь только на отношениях, знакомствах и манипуляциях.', 'warning');
            //return;
        //}

        if (!this.API_CONFIG.apiKey) {
            this.showNotification('Пожалуйста, настройте API ключ в настройках', 'error');
            this.showApiSettingsModal();
            return;
        }
        
        if (!this.state.isApiConnected) {
            this.showNotification('API не подключен. Проверьте настройки.', 'error');
            this.checkApiStatus();
            return;
        }

        if (this.state.user) {
            try {
                const baseUrl = (this.AUTH_CONFIG.baseUrl || window.location.origin).replace(/\/$/, '');
                const res = await fetch(`${baseUrl}/api/users/me/usage`, { method: 'GET', credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.used >= data.limit) {
                        this.showNotification('Исчерпан лимит запросов на этот месяц. Смените план в «План подписок».', 'warning');
                        return;
                    }
                }
            } catch (e) {
                console.warn('Не удалось проверить лимит запросов', e);
            }
        }
        
        this.addMessage(message, 'user');
        
       // Получаем расширенный анализ сообщения
        const userAnalysis = this.analyzeUserType(message);
        
        // Добавляем к сообщению контекст из анализа, если он есть
        // Используем новый userAnalysis.context, который мы сформировали
        const enhancedMessage = message + (userAnalysis.context ? userAnalysis.context : '');
        
        this.state.conversationHistory.push({ role: "user", content: enhancedMessage });
        this.state.messageCount++;
        this.state.stats.totalMessages++;
        this.state.stats.userMessages++;
        
        this.updateTopicStats(message);
        
        const currentHour = new Date().getHours();
        this.state.stats.activityByHour[currentHour]++;
        
        this.checkAchievements();
        
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        
        // Устанавливаем состояние ответа и блокируем интерфейс
        this.state.isResponding = true;
        this.updateSendButtonState();
        this.elements.messageInput.disabled = true;
        
        this.showTypingIndicator();
        
        try {
            const startTime = Date.now();
            const aiResponse = await this.getAIResponse(this.state.conversationHistory);
            const responseTime = (Date.now() - startTime) / 1000;
            
            this.state.responseTimes.push(responseTime);
            
            this.hideTypingIndicator();
            
            this.addAiMessageWithTypingEffect(aiResponse);
            this.state.conversationHistory.push({ role: "assistant", content: aiResponse });
            this.state.stats.totalMessages++;
            this.state.stats.aiMessages++;
            
           if (this.state.conversationHistory.length > 50) {
    this.state.conversationHistory = [
        this.state.conversationHistory[0],
        ...this.state.conversationHistory.slice(-48)
    ];
}
            
            this.showNotification(`Ответ получен за ${responseTime.toFixed(1)}с ✅`, 'success');

            if (this.state.user) {
                try {
                    const baseUrl = (this.AUTH_CONFIG.baseUrl || window.location.origin).replace(/\/$/, '');
                    const incRes = await fetch(`${baseUrl}/api/users/me/usage/increment`, { method: 'POST', credentials: 'include' });
                    if (incRes.ok) {
                        const data = await incRes.json();
                        this.state.usage = { used: data.used, limit: data.limit };
                        this.updateSidebarUsage();
                    } else if (incRes.status === 429) {
                        this.showNotification('Лимит запросов на этот месяц исчерпан.', 'warning');
                    }
                } catch (e) {
                    console.warn('Не удалось обновить счётчик запросов', e);
                }
            }

            this.triggerHapticFeedback();
            this.updateUI();
            this.updateSettingsStats();
            await this.saveChats();

            if (this.state.stats.aiMessages >= 10 && !this.state.balanceShown) {
                this.state.balanceShown = true;
                this.showBalanceModal(true);
            }
            
            this.state.retryCount = 0;
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('API Error:', error);
            
            let errorMessage = error.message || "Ошибка при получении ответа";
            
            this.addMessage(`Ошибка: ${errorMessage}`, 'ai');
            this.showNotification(errorMessage, 'error');
            
            if (this.elements.apiStatus) {
                this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ошибка API';
                this.elements.apiStatus.style.background = 'rgba(239, 68, 68, 0.15)';
                this.elements.apiStatus.style.color = '#f87171';
            }
            
            if (errorMessage.includes('API ключ') || errorMessage.includes('401')) {
                setTimeout(() => {
                    this.showApiSettingsModal();
                }, 1000);
            }
        } finally {
            // Разблокируем интерфейс после завершения ответа
            this.state.isResponding = false;
            this.updateSendButtonState();
            this.elements.messageInput.disabled = false;
        }
        
        this.scrollToBottom();
    }
    
    updateSendButtonState() {
        const sendButton = this.elements.sendButton;
        if (!sendButton) return;
        
        const icon = sendButton.querySelector('i');
        if (!icon) return;
        
        if (this.state.isResponding) {
            // Меняем иконку на паузу
            icon.className = 'fas fa-pause';
            sendButton.title = 'ИИ отвечает...';
            sendButton.disabled = true;
            sendButton.style.opacity = '0.7';
            sendButton.style.cursor = 'not-allowed';
        } else {
            // Возвращаем иконку отправки
            icon.className = 'fas fa-paper-plane';
            sendButton.title = 'Отправить сообщение';
            sendButton.disabled = false;
            sendButton.style.opacity = '1';
            sendButton.style.cursor = 'pointer';
        }
    }

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
            'помощ', 'консультац', 'эксперт', 'специалист',
            'игнор', 'бывшая', 'вернуть', 'преследователь', 'слив'
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

        if (messageLower.includes('игнор') || messageLower.includes('бывшая') || messageLower.includes('вернуть')) {
            this.state.stats.relationshipAdvice++;
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
            hljs.highlightAll();
        }, 100);
        
        this.scrollToBottom();

        const heroBlock = document.getElementById('hero-block');
        if (heroBlock) {
            heroBlock.style.display = 'none';
        }
        this.syncInputPosition();
    }

    addAiMessageWithTypingEffect(fullText) {
        const messageId = 'msg-' + Date.now();
        const time = this.getCurrentTime();

        const messageElement = document.createElement('div');
        messageElement.className = 'message ai-message ai-message-typing';
        messageElement.id = messageId;
        messageElement.style.opacity = '1';
        messageElement.style.transform = 'translateY(0)';

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
                <i class="fas fa-heart"></i> Эксперт по отношениям
            </div>
            <div class="message-content"><span class="typing-cursor"></span></div>
            <div class="message-time">${time}</div>
        `;

        this.elements.chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        const heroBlock = document.getElementById('hero-block');
        if (heroBlock) heroBlock.style.display = 'none';
        this.syncInputPosition();

        const contentEl = messageElement.querySelector('.message-content');
        const cursorHtml = '<span class="typing-cursor"></span>';
        const chunkMin = 1;
        const chunkMax = 3;
        const delayMs = 15;
        let index = 0;

        const typeNext = () => {
            if (index >= fullText.length) {
                contentEl.innerHTML = this.formatMessage(fullText);
                messageElement.classList.remove('ai-message-typing');
                setTimeout(() => hljs.highlightAll(), 50);
                this.scrollToBottom();
                return;
            }
            const chunkSize = Math.min(chunkMin + Math.floor(Math.random() * (chunkMax - chunkMin + 1)), fullText.length - index);
            index += chunkSize;
            const accumulated = fullText.slice(0, index);
            contentEl.innerHTML = this.formatMessage(accumulated) + cursorHtml;
            this.scrollToBottom();
            setTimeout(typeNext, delayMs);
        };

        setTimeout(typeNext, 80);
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
            this.state.conversationHistory = [this.createSystemPromptMessage()];
            const heroBlock = document.getElementById('hero-block');
            if (heroBlock) heroBlock.style.display = 'flex';
            this.syncInputPosition();
            this.elements.chatMessages.innerHTML = '';
            this.saveChats();
            this.showNotification('Чат очищен 🗑️', 'info');
        }
    }

    setAIMode(modeId) {
        if (!this.state.aiModes[modeId]) return;
        
        this.state.currentMode = modeId;
        this.API_CONFIG.temperature = this.state.aiModes[modeId].temperature;
        
        document.querySelectorAll('.mode-item-settings').forEach(item => {
            item.classList.remove('active');
        });
        const activeMode = document.querySelector(`.mode-item-settings[data-mode="${modeId}"]`);
        if (activeMode) {
            activeMode.classList.add('active');
        }
        
        // Update Grok mode selector UI
        this.updateGrokModeSelector(modeId);
        
        this.showNotification(`Режим изменен на: ${this.state.aiModes[modeId].name}`, 'info');
    }
    
    setupGrokModeSelector() {
        const modeSelector = document.getElementById('ai-mode-selector');
        const modeDropdown = document.getElementById('ai-mode-dropdown');
        const wrapper = modeSelector && modeSelector.closest('.ai-mode-selector-wrapper');
        
        if (!modeSelector || !modeDropdown) return;
        
        const setDropdownOpen = (open) => {
            if (open) {
                modeDropdown.classList.add('show');
                modeSelector.classList.add('active');
                modeSelector.setAttribute('aria-expanded', 'true');
                const iconClosed = modeSelector.querySelector('.ai-mode-icon-closed');
                const iconOpen = modeSelector.querySelector('.ai-mode-icon-open');
                if (iconClosed) iconClosed.style.display = 'none';
                if (iconOpen) iconOpen.style.display = '';
            } else {
                modeDropdown.classList.remove('show');
                modeSelector.classList.remove('active');
                modeSelector.setAttribute('aria-expanded', 'false');
                const iconClosed = modeSelector.querySelector('.ai-mode-icon-closed');
                const iconOpen = modeSelector.querySelector('.ai-mode-icon-open');
                if (iconClosed) iconClosed.style.display = '';
                if (iconOpen) iconOpen.style.display = 'none';
            }
        };
        
        // Кнопка: сворачивает и разворачивает список режимов
        modeSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = modeDropdown.classList.contains('show');
            setDropdownOpen(!isOpen);
        });
        
        // Клик вне области — сворачиваем список
        document.addEventListener('click', (e) => {
            if (wrapper && !wrapper.contains(e.target)) {
                setDropdownOpen(false);
            }
        });
        
        // Выбор режима — применяем и сворачиваем список
        modeDropdown.querySelectorAll('.mode-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const modeId = item.dataset.mode;
                if (modeId) {
                    this.setAIMode(modeId);
                    setDropdownOpen(false);
                }
            });
        });
        
        this.updateGrokModeSelector(this.state.currentMode);
    }
    
    updateGrokModeSelector(modeId) {
        const modeSelector = document.getElementById('ai-mode-selector');
        const modeDropdown = document.getElementById('ai-mode-dropdown');
        
        if (!modeSelector || !modeDropdown) return;
        
        // Update dropdown items
        modeDropdown.querySelectorAll('.mode-dropdown-item').forEach(item => {
            item.classList.remove('active');
            const checkIcon = item.querySelector('.mode-item-check');
            if (checkIcon) {
                checkIcon.style.display = 'none';
            }
            
            if (item.dataset.mode === modeId) {
                item.classList.add('active');
                const checkIcon = item.querySelector('.mode-item-check');
                if (checkIcon) {
                    checkIcon.style.display = 'block';
                }
            }
        });
    }

    /** Подсказки в стиле Т9 при вводе */
    static T9_PHRASES = [
        'Как распознать манипуляцию в отношениях?',
        'Как правильно вести себя на первом свидании?',
        'Как установить здоровые границы в отношениях?',
        'Как понять, что мной манипулируют?',
        'Как вернуть бывшую после расставания?',
        'Что такое игнор и как он работает?',
        'Как перестать думать о бывшем?',
        'Как намекнуть на отношения?',
        'Как сказать что хочешь серьёзных отношений?',
        'Как вести себя после ссоры?',
        'Как извиниться перед партнёром?',
        'Как понять что отношения зашли в тупик?',
        'Как расстаться правильно?',
        'Как пережить измену?',
        'Как наладить доверие в отношениях?',
        'Как реагировать на критику?',
        'Как перестать ревновать?',
        'Как поддержать партнёра в сложный момент?',
        'Как познакомиться в интернете?',
        'Как написать первое сообщение?',
        'Как понять что нравишься человеку?',
        'Как отказать вежливо?',
        'Как не потерять себя в отношениях?',
        'Признаки токсичных отношений',
        'Как выйти из токсичных отношений?',
        'Как восстановиться после расставания?',
        'Как начать новые отношения?',
        'Стоит ли возвращаться к бывшему?',
        'Как отличить любовь от привычки?',
        'Как сохранить отношения на расстоянии?',
        'Как подготовиться к первому свиданию?',
        'О чём говорить на первом свидании?',
        'Как понять что пора расставаться?',
        'Как простить предательство?',
        'Как перестать бояться отношений?',
        'Как признаться в чувствах?',
        'Как реагировать на игнор?',
        'Что делать если не звонит?',
        'Как вернуть интерес партнёра?',
        'Признаки манипуляции',
        'Как защититься от манипуляций?',
        'Как сказать нет?',
        'Как не дать собой манипулировать?',
        'Что такое газлайтинг?',
        'Как общаться с токсичными людьми?',
        'Нужен совет по отношениям',
        'Помоги разобраться в ситуации'
    ];

    setupT9Suggestions() {
        const input = document.getElementById('message-input');
        if (!input) {
            console.warn('T9: #message-input не найден');
            return;
        }
        const inputBar = input.closest('.input-container-extended');
        if (!inputBar) {
            console.warn('T9: .input-container-extended не найден');
            return;
        }

        let container = document.getElementById('t9-suggestions');
        if (!container) {
            container = document.createElement('div');
            container.id = 't9-suggestions';
            container.className = 't9-dropdown t9-dropdown-fixed';
            container.setAttribute('role', 'listbox');
            container.setAttribute('aria-label', 'Подсказки');
            container.style.setProperty('display', 'none', 'important');
            document.body.appendChild(container);
        }

        let t9Debounce = null;

        const positionDropdown = () => {
            const rect = inputBar.getBoundingClientRect();
            container.style.top = rect.top + 'px';
            container.style.left = rect.left + 'px';
            container.style.width = Math.max(rect.width, 280) + 'px';
            container.style.transform = 'translateY(-100%)';
        };

        const hideDropdown = () => {
            container.innerHTML = '';
            container.style.setProperty('display', 'none', 'important');
            container.classList.remove('has-suggestions');
        };

        const updateSuggestions = () => {
            const text = (input.value || '').trim();
            hideDropdown();
            if (!text || text.length < 1) return;

            const lower = text.toLowerCase();
            const matches = VerdiktChatApp.T9_PHRASES.filter(phrase => {
                const pl = phrase.toLowerCase();
                return pl.startsWith(lower) || pl.includes(lower);
            }).slice(0, 8);

            if (matches.length === 0) return;

            matches.forEach(phrase => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 't9-suggestion-item';
                item.setAttribute('role', 'option');
                const icon = document.createElement('span');
                icon.className = 't9-icon';
                icon.innerHTML = '<i class="fas fa-search"></i>';
                const textSpan = document.createElement('span');
                textSpan.className = 't9-text';
                textSpan.textContent = phrase;
                item.appendChild(icon);
                item.appendChild(textSpan);
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    input.value = phrase;
                    if (input.style) {
                        input.style.height = 'auto';
                        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
                    }
                    hideDropdown();
                    input.focus();
                });
                container.appendChild(item);
            });

            positionDropdown();
            container.style.setProperty('display', 'flex', 'important');
            container.classList.add('has-suggestions');
        };

        const scheduleUpdate = () => {
            if (input.style) {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 200) + 'px';
            }
            clearTimeout(t9Debounce);
            t9Debounce = setTimeout(updateSuggestions, 80);
        };

        input.addEventListener('input', scheduleUpdate);
        input.addEventListener('keyup', scheduleUpdate);
        input.addEventListener('focus', () => {
            if ((input.value || '').trim().length >= 1) updateSuggestions();
        });
        input.addEventListener('blur', () => {
            clearTimeout(t9Debounce);
            setTimeout(() => {
                if (!container.contains(document.activeElement)) hideDropdown();
            }, 220);
        });

        window.addEventListener('scroll', () => {
            if (container.classList.contains('has-suggestions')) positionDropdown();
        }, true);
        window.addEventListener('resize', () => {
            if (container.classList.contains('has-suggestions')) positionDropdown();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideDropdown();
        });
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

    setTheme(theme, options = {}) {
        const { fromServer = false, skipBackend = false } = options;
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
        const activeTheme = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (activeTheme) {
            activeTheme.classList.add('active');
        }
        
        localStorage.setItem('verdikt_theme', theme);
        this.saveChats();
        
        // Отправляем на бэкенд только если пользователь авторизован, не из сервера и не пропущен флаг skipBackend
        if (this.state.user && !fromServer && !skipBackend) {
            const url = `${this.AUTH_CONFIG.baseUrl}/api/users/me/settings`;
            fetch(url, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme })
            }).catch(() => {});
        }
        
        // Показываем уведомление только если не из сервера и не пропущен флаг skipBackend
        if (!fromServer && !skipBackend) {
            this.showNotification(`Тема изменена: ${theme}`, 'info');
        }
    }

    async loadUserSettings() {
        if (!this.state.user) return;
        try {
            const url = `${this.AUTH_CONFIG.baseUrl}/api/users/me/settings`;
            const response = await fetch(url, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.theme) {
                    this.setTheme(data.theme, { fromServer: true });
                }
            }
        } catch (e) {
            const savedTheme = localStorage.getItem('verdikt_theme');
            if (savedTheme) this.setTheme(savedTheme, { fromServer: true });
        }
    }

    // ==================== СИСТЕМА УВЕДОМЛЕНИЙ ====================

    showNotification(text, type = 'info') {
        if (this.state.doNotDisturb) {
            return;
        }

        this.elements.notificationText.textContent = text;
    
        const notification = this.elements.notification;
        notification.style.background = '';
        notification.style.color = '';
        
        notification.className = 'notification';
        notification.classList.add(type);
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
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

        try {
            const rolesJson = localStorage.getItem('verdikt_admin_roles');
            if (rolesJson) this.state.adminRoles = JSON.parse(rolesJson) || {};
        } catch (e) {}

        try {
            const subsJson = localStorage.getItem('verdikt_admin_subscriptions');
            if (subsJson) this.state.adminSubscriptions = JSON.parse(subsJson) || {};
        } catch (e) {}
    }

    async saveToLocalStorage() {
        await this.saveChats();
    }

    // ==================== АДМИН-РЕЖИМ ====================

    setupAdminMode() {
        const btn = this.elements.adminModeToggle;
        if (!btn) return;
        btn.classList.add('primary');
        btn.title = 'Админ-панель';
        btn.addEventListener('click', () => {
            const adminTab = document.querySelector('.dashboard-tab[data-tab="admin"]');
            if (adminTab) adminTab.click();
        });
    }

    attachAdminQuestionHandlers() {
        if (!this.state.isAdmin || !this.dashboard || !this.dashboard.questions) return;

        const container = document.getElementById('questions-list');
        if (!container) return;

        container.querySelectorAll('[data-action="admin-delete"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-question-id');
                if (!id) return;
                const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
                try {
                    const response = await fetch(`${baseUrl}/api/admin/questions/${id}`, { method: 'DELETE', credentials: 'include' });
                    if (!response.ok) {
                        this.showNotification(response.status === 403 ? 'Нет прав' : 'Не удалось удалить вопрос', 'error');
                        return;
                    }
                    this.showNotification('Вопрос удалён', 'info');
                    await this.loadDashboardData();
                    this.renderQuestions();
                    this.renderAdminQuestions();
                    this.renderAdminUsers();
                    this.updateSidebarStats();
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        container.querySelectorAll('[data-action="admin-ban"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const authorId = btn.getAttribute('data-author-id');
                if (!authorId) {
                    this.showNotification('Нет данных об авторе вопроса', 'warning');
                    return;
                }
                const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
                try {
                    const response = await fetch(`${baseUrl}/api/admin/users/${authorId}/ban`, { method: 'PATCH', credentials: 'include' });
                    if (!response.ok) {
                        const msg = await response.text().catch(() => '');
                        this.showNotification(msg || (response.status === 403 ? 'Нет прав' : 'Ошибка'), 'error');
                        return;
                    }
                    this.showNotification('Пользователь забанен', 'warning');
                    await this.loadDashboardData();
                    this.renderAdminQuestions();
                    this.renderAdminUsers();
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });
    }

    // ==================== АВТОРИЗАЦИЯ ====================

    loadUserFromStorage() {
        try {
            const userJson = localStorage.getItem('verdikt_user');
            if (userJson) {
                this.state.user = JSON.parse(userJson);
                this.state.isAdmin = (this.state.user.role || '').toUpperCase() === 'ADMIN';
            } else {
                this.state.isAdmin = false;
            }
            this.state.authToken = null;
        } catch (e) {
            console.warn('Не удалось загрузить пользователя из localStorage', e);
        }
    }

    async restoreSession() {
        try {
            const url = `${this.AUTH_CONFIG.baseUrl}${this.AUTH_CONFIG.endpoints.me}`;
            const response = await fetch(url, { credentials: 'include' });
            if (response.ok) {
                const user = await response.json();
                this.state.user = user;
                this.saveUserToStorage();
                this.updateAuthUI();
                this.updateSidebarInfo();
            } else {
                this.state.user = null;
                this.state.authToken = null;
                this.saveUserToStorage();
                this.updateAuthUI();
                this.updateSidebarInfo();
            }
        } catch (e) {
            this.state.user = null;
            this.state.authToken = null;
            this.saveUserToStorage();
            this.updateAuthUI();
            this.updateSidebarInfo();
        }
    }

    saveUserToStorage() {
        if (this.state.user) {
            localStorage.setItem('verdikt_user', JSON.stringify(this.state.user));
        } else {
            localStorage.removeItem('verdikt_user');
        }
        localStorage.removeItem('verdikt_token');
    }

    setUser(user, _token) {
        this.state.user = user;
        this.state.authToken = null;
        this.saveUserToStorage();
        this.updateAuthUI();
        this.updateSidebarInfo();
        if (user) {
            setTimeout(() => this.loadDashboardData(), 1000);
        }
    }

    async logout() {
        try {
            const url = `${this.AUTH_CONFIG.baseUrl}${this.AUTH_CONFIG.endpoints.logout}`;
            await fetch(url, { method: 'POST', credentials: 'include' });
        } catch (e) {
        }
        this.state.user = null;
        this.state.authToken = null;
        this.saveUserToStorage();
        this.updateAuthUI();
        this.updateSidebarInfo();
        this.showNotification('Вы вышли из аккаунта', 'info');
    }

    getAuthHeaders() {
        return {};
    }

    async registerUser({ name, email, password }) {
        const url = `${this.AUTH_CONFIG.baseUrl}${this.AUTH_CONFIG.endpoints.register}`;
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const message = error.message || `Ошибка регистрации (HTTP ${response.status})`;
            throw new Error(message);
        }

        const data = await response.json();
        this.setUser(data);
    }

    async loginUser({ email, password }) {
        const url = `${this.AUTH_CONFIG.baseUrl}${this.AUTH_CONFIG.endpoints.login}`;
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const message = error.message || `Ошибка входа (HTTP ${response.status})`;
            throw new Error(message);
        }

        const data = await response.json();
        this.setUser(data.user);
    }

    setupAuthUI() {
        const loginBtn = this.elements.loginButton;
        const logoutBtn = document.getElementById('logout-button');
        const authClose = this.elements.authClose;
        const authTabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.showModal('auth-modal');
            });
        }

        if (authClose) {
            authClose.addEventListener('click', () => this.hideModal('auth-modal'));
        }

        authTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.tab;
                authTabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                document.querySelectorAll('.auth-form').forEach(form => {
                    form.classList.remove('active');
                });
                document.getElementById(`${target}-form`).classList.add('active');
            });
        });

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

                if (!email || !password) {
                    this.showNotification('Введите email и пароль', 'warning');
                    return;
                }

                try {
                    await this.loginUser({ email, password });
                    this.hideModal('auth-modal');
                    this.showApiLoadingEffect();
                    try {
                        await this.checkApiStatus();
                    } finally {
                        this.hideApiLoadingEffect();
                    }
                    this.showNotification('Вы успешно вошли ✅', 'success');
                } catch (error) {
                    this.showNotification(error.message || 'Ошибка входа', 'error');
                }
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('register-name').value.trim();
                const email = document.getElementById('register-email').value.trim();
                const password = document.getElementById('register-password').value;

                if (!name || !email || !password) {
                    this.showNotification('Заполните все поля', 'warning');
                    return;
                }

                try {
                    await this.registerUser({ name, email, password });
                    this.hideModal('auth-modal');
                    this.showApiLoadingEffect();
                    try {
                        await this.checkApiStatus();
                    } finally {
                        this.hideApiLoadingEffect();
                    }
                    this.showNotification('Регистрация прошла успешно ✅', 'success');
                } catch (error) {
                    this.showNotification(error.message || 'Ошибка регистрации', 'error');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        this.updateAuthUI();
    }

    updateAuthUI() {
        const userAuth = document.getElementById('user-auth');
        const label = userAuth?.querySelector('.user-auth-label');
        const userInfo = document.getElementById('auth-user-info');
        const userNameLabel = document.getElementById('auth-user-name');

        if (!userAuth || !label) return;

        if (this.state.user) {
            const name = this.state.user.name || this.state.user.email || 'Аккаунт';
            label.textContent = name;
            userAuth.classList.add('user-auth-logged-in');
            if (userInfo && userNameLabel) {
                userNameLabel.textContent = name;
                userInfo.style.display = 'flex';
            }
            this.state.isAdmin = (this.state.user.role || '').toUpperCase() === 'ADMIN';
        } else {
            label.textContent = 'Войти';
            userAuth.classList.remove('user-auth-logged-in');
            if (userInfo) {
                userInfo.style.display = 'none';
            }
            this.state.isAdmin = false;
        }

        const adminTab = document.querySelector('.dashboard-tab[data-tab="admin"]');
        if (adminTab) adminTab.style.display = this.state.isAdmin ? '' : 'none';
        const adminToggle = document.getElementById('admin-mode-toggle');
        if (adminToggle) adminToggle.style.display = this.state.isAdmin ? '' : 'none';
        document.body.classList.toggle('admin-mode', this.state.isAdmin);
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

    showTypingIndicator() {
    if (this.state.doNotDisturb) return;
    const indicator = this.elements.typingIndicator;
    if (indicator) {
        indicator.classList.add('visible');
        this.scrollToBottom();
    }
}

hideTypingIndicator() {
    const indicator = this.elements.typingIndicator;
    if (indicator) {
        indicator.classList.remove('visible');
    }
}

showApiLoadingEffect() {
    const overlay = document.getElementById('api-loading-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

hideApiLoadingEffect() {
    const overlay = document.getElementById('api-loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

syncInputPosition() {
    const heroBlock = document.getElementById('hero-block');
    const chatContainer = document.querySelector('.chat-container');
    if (heroBlock && chatContainer) {
        const isCentered = heroBlock.style.display !== 'none';
        chatContainer.classList.toggle('input-centered', isCentered);
    }
}

updateSphereApiState(state) {
    // Пробуем найти сферу несколько раз с задержкой, если она еще не загрузилась
    let sphere = document.querySelector('.animated-sphere');
    
    if (!sphere) {
        // Если сфера не найдена, пробуем еще раз через небольшую задержку
        setTimeout(() => {
            sphere = document.querySelector('.animated-sphere');
            if (sphere) {
                this.applySphereApiState(sphere, state);
            }
        }, 100);
        return;
    }
    
    this.applySphereApiState(sphere, state);
}

applySphereApiState(sphere, state) {
    if (!sphere) return;
    
    // Удаляем все предыдущие классы состояний
    sphere.classList.remove('api-connecting', 'api-connected', 'api-error', 'api-not-configured');
    
    // Добавляем новый класс состояния
    switch(state) {
        case 'connecting':
            sphere.classList.add('api-connecting');
            this.startStarSuction(sphere);
            break;
        case 'connected':
            sphere.classList.add('api-connected');
            this.startStarSuction(sphere);
            // Сфера должна светиться зеленым постоянно при подключении
            // Не убираем класс api-connected
            break;
        case 'error':
            sphere.classList.add('api-error');
            this.startStarSuction(sphere);
            break;
        case 'not-configured':
            sphere.classList.add('api-not-configured');
            this.stopStarSuction();
            break;
        default:
            this.stopStarSuction();
            break;
    }
}

startStarSuction(sphere) {
    // Останавливаем предыдущий интервал, если он существует
    if (this.starSuctionInterval) {
        clearInterval(this.starSuctionInterval);
    }
    
    const starContainer = sphere.querySelector('.sphere-star-suction');
    if (!starContainer) return;
    
    // Очищаем предыдущие звезды
    starContainer.innerHTML = '';
    
    // Функция создания звезды со спиральным движением
    const createStar = () => {
        const star = document.createElement('div');
        star.className = 'star-suction-particle';
        
        // Генерируем случайную позицию на краю контейнера (вокруг сферы)
        const startAngle = Math.random() * Math.PI * 2;
        const startDistance = 225 + Math.random() * 100; // Расстояние от центра (225-325px) для сферы 500px
        const startX = Math.cos(startAngle) * startDistance;
        const startY = Math.sin(startAngle) * startDistance;
        
        // Устанавливаем начальную позицию
        star.style.left = '50%';
        star.style.top = '50%';
        star.style.transform = `translate(${startX}px, ${startY}px)`;
        
        // Количество оборотов спирали (2-4 оборота)
        const rotations = 2 + Math.random() * 2;
        const duration = 2 + Math.random() * 0.5; // Длительность анимации 2-2.5 секунды
        
        // Создаем keyframes для спирального движения
        const animationName = `starSuction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const styleSheet = document.createElement('style');
        
        // Генерируем ключевые кадры для спирального движения
        const keyframes = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const currentAngle = startAngle + (rotations * Math.PI * 2 * progress);
            const currentDistance = startDistance * (1 - progress); // Уменьшаем расстояние к центру
            const currentX = Math.cos(currentAngle) * currentDistance;
            const currentY = Math.sin(currentAngle) * currentDistance;
            const scale = 1 - progress * 0.9; // Уменьшаем размер
            const opacity = progress < 0.1 ? progress * 10 : (progress > 0.9 ? (1 - progress) * 10 : 1);
            
            keyframes.push(`
                ${progress * 100}% {
                    opacity: ${opacity};
                    transform: translate(${currentX}px, ${currentY}px) scale(${scale});
                }
            `);
        }
        
        styleSheet.textContent = `
            @keyframes ${animationName} {
                ${keyframes.join('\n')}
            }
            .star-suction-particle.${animationName} {
                animation: ${animationName} ${duration}s ease-in forwards;
            }
        `;
        document.head.appendChild(styleSheet);
        star.classList.add(animationName);
        
        starContainer.appendChild(star);
        
        // Удаляем звезду и стили после анимации
        setTimeout(() => {
            star.remove();
            styleSheet.remove();
        }, duration * 1000 + 100);
    };
    
    // Создаем звезды периодически
    this.starSuctionInterval = setInterval(() => {
        createStar();
    }, 250); // Новая звезда каждые 250мс для более плавного эффекта
}

stopStarSuction() {
    if (this.starSuctionInterval) {
        clearInterval(this.starSuctionInterval);
        this.starSuctionInterval = null;
    }
    
    // Очищаем контейнер звезд
    const starContainer = document.querySelector('.sphere-star-suction');
    if (starContainer) {
        starContainer.innerHTML = '';
    }
}

    updateUI() {
        this.updateSettingsStats();
        this.updateSidebarInfo();
        // Update Grok mode selector if it exists
        if (this.state.currentMode) {
            this.updateGrokModeSelector(this.state.currentMode);
        }
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
        // Функция больше не используется - настройки теперь в профиле
        // Открываем настройки профиля вместо старого модального окна
        this.showProfileSettingsModal();
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
                
                <h2 style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-history"></i> История чатов
                </h2>

                <div class="modal-section" style="margin-bottom: 12px;">
                    <input 
                        type="text" 
                        id="chat-history-search" 
                        placeholder="Поиск по названию и содержимому..." 
                        style="
                            width: 100%;
                            padding: 10px 12px;
                            border-radius: var(--radius-md);
                            border: 1px solid var(--border-color);
                            background: var(--bg-card);
                            color: var(--text-primary);
                            font-size: 0.9rem;
                            margin-bottom: 4px;
                        "
                    />
                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">
                        Поиск учитывает имя чата и первые сообщения в нём
                    </div>
                </div>
                
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

        const searchInput = document.getElementById('chat-history-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.trim().toLowerCase();
                this.updateHistoryModalContent(query);
            });
        }
    }

    updateHistoryModalContent(searchQuery = '') {
        const historyList = document.getElementById('chat-history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        const chats = this.chatManager.chats || [];

        if (chats.length === 0) {
            historyList.innerHTML = `
                <div class="chat-history-empty" style="text-align: center; padding: 30px; color: var(--text-tertiary);">
                    Нет сохраненных чатов
                </div>
            `;
            return;
        }
        
        let sortedChats = [...chats].sort((a, b) => b.timestamp - a.timestamp);

        const q = (searchQuery || '').toLowerCase();
        if (q) {
            sortedChats = sortedChats.filter(chat => {
                const title = (chat.title || '').toLowerCase();
                const messagesText = (chat.messages || [])
                    .slice(0, 10)
                    .map(m => (m.content || '').toLowerCase())
                    .join(' ');
                return title.includes(q) || messagesText.includes(q);
            });
        }

        if (!sortedChats.length) {
            historyList.innerHTML = `
                <div class="chat-history-empty" style="text-align: center; padding: 30px; color: var(--text-tertiary);">
                    Ничего не найдено. Попробуйте изменить запрос.
                </div>
            `;
            return;
        }
        
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
        const profile = this.getPerformanceProfile ? this.getPerformanceProfile() : { isLowEnd: false, reducedMotion: false };

        if (profile.reducedMotion) {
            const particlesContainer = document.getElementById('connection-particles');
            if (particlesContainer) {
                particlesContainer.innerHTML = '';
            }
            return;
        }

        const particlesContainer = document.getElementById('connection-particles');
        if (particlesContainer) {
            const baseCount = 80;
            const particleCount = profile.isLowEnd ? 40 : baseCount;

            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';

                const size = 1.5 + Math.random() * 3.5;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;

                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;

                const delay = Math.random() * 6;
                const duration = 4 + Math.random() * 6;
                particle.style.animationDelay = `${delay}s`;
                particle.style.setProperty('--duration', `${duration}s`);

                const alpha = 0.25 + Math.random() * 0.6;
                particle.style.opacity = alpha.toFixed(2);
                particle.style.setProperty('--alpha', alpha.toFixed(2));

                const baseAngle = -Math.PI / 2;
                const angleSpread = Math.PI / 3;
                const angle = baseAngle + (Math.random() - 0.5) * angleSpread;
                const distance = 80 + Math.random() * 180;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance;
                particle.style.setProperty('--tx', tx.toFixed(1));
                particle.style.setProperty('--ty', ty.toFixed(1));

                const scale = 0.7 + Math.random() * 1.3;
                particle.style.setProperty('--scale', scale.toFixed(2));

                particle.addEventListener('animationend', (e) => {
                    if (e.animationName === 'particleFlow') {
                        particle.remove();
                    }
                });

                particlesContainer.appendChild(particle);
            }
        }
    }

    getPerformanceProfile() {
        const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
            ? navigator.hardwareConcurrency
            : 2;
        // По запросу: не ограничиваем анимации даже на "слабых" устройствах
        // и не учитываем prefers-reduced-motion для отключения анимаций.
        return { cores, reducedMotion: false, isLowEnd: false };
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
        // Настройки теперь сохраняются автоматически при изменении
        // Эта функция оставлена для совместимости
        const temperatureSlider = document.getElementById('temperature-slider');
        if (temperatureSlider) {
            const temperature = parseFloat(temperatureSlider.value);
            this.API_CONFIG.temperature = temperature;
            localStorage.setItem('verdikt_temperature', temperature.toString());
        }
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
                        model: 'mistralai/ministral-3b-2512',
                        api: 'routerai.ru',
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
                model: 'mistralai/ministral-3b-2512',
                api: 'routerai.ru'
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
        this.elements.importDropzone.addEventListener('click', () => {
            this.elements.importFileInput.click();
        });
        
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
        
        this.elements.importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImportFile(file);
            }
        });
        
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
        document.querySelectorAll('#export-chat-modal .export-option[data-format]').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('#export-chat-modal .export-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                
                const format = option.dataset.format;
                if (format === 'json-encrypted') {
                    this.elements.encryptionNote.style.display = 'block';
                } else {
                    this.elements.encryptionNote.style.display = 'none';
                }
            });
        });
        
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
        
        this.chatManager.autoSaveTimer = setInterval(async () => {
            if (this.chatManager.currentChatId && this.state.messageCount > 1) {
                await this.saveChats();
            }
        }, this.chatManager.autoSaveInterval);
        
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
                    model: this.API_CONFIG.model,
                    apiModel: this.API_CONFIG.model,
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

    async loadDashboardData() {
        return this.apiClient.loadDashboardData();
    }

    async loadAdminUsers(page = 0) {
        const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
        this.state.adminUsersLoading = true;
        this.state.adminUsersPageNumber = page;
        this.renderAdminUsers();
        try {
            const response = await fetch(`${baseUrl}/api/admin/users?page=${page}&size=20`, { credentials: 'include' });
            if (!response.ok) {
                this.state.adminUsersPage = null;
                this.showNotification(response.status === 403 ? 'Нет прав администратора' : 'Не удалось загрузить список пользователей', 'error');
                return;
            }
            const data = await response.json();
            this.state.adminUsersPage = data;
        } catch (e) {
            this.state.adminUsersPage = null;
            this.showNotification('Ошибка загрузки списка пользователей', 'error');
        } finally {
            this.state.adminUsersLoading = false;
            this.renderAdminUsers();
        }
    }

    async submitDashboardQuestion(content) {
        return this.apiClient.submitDashboardQuestion(content);
    }

    async setQuestionReaction(questionId, type) {
        return this.apiClient.setQuestionReaction(questionId, type);
    }

    async showQuestionCommentModal(questionId) {
        if (!this.state.user) {
            this.showNotification('Войдите в аккаунт, чтобы ответить', 'warning');
            return;
        }

        this.currentCommentQuestionId = questionId;

        const modalId = 'question-comments-modal';
        const question = this.dashboard?.questions?.find(q => String(q.id) === String(questionId));

        const previewEl = document.getElementById('question-comments-preview');
        if (previewEl) {
            previewEl.textContent = question ? (question.content || '') : '';
        }

        const textarea = document.getElementById('question-comment-input');
        if (textarea) {
            textarea.value = '';
        }

        this.showModal(modalId);

        await this.loadQuestionComments(questionId);
        this.renderQuestionComments(questionId);
    }

    async submitQuestionComment(questionId, content) {
        return this.apiClient.submitQuestionComment(questionId, content);
    }

    async loadQuestionComments(questionId, force = false) {
        return this.apiClient.loadQuestionComments(questionId, force);
    }

    renderQuestionComments(questionId) {
        const list = document.getElementById('question-comments-list');
        if (!list) return;

        const comments = (this.state.questionComments && this.state.questionComments[questionId]) || [];

        if (!comments.length) {
            list.innerHTML = `
                <div style="color: var(--text-tertiary); font-size: 0.9rem;">
                    Пока нет комментариев. Будьте первым, кто ответит на этот вопрос.
                </div>
            `;
            return;
        }

        list.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-avatar">
                        ${(c.authorName || 'П')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${c.authorName || 'Пользователь'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">
                            ${c.authorEmail || ''}
                            ${c.createdAt ? ' · ' + this.formatDate(c.createdAt) : ''}
                        </div>
                    </div>
                </div>
                <div class="comment-content">
                    ${c.content}
                </div>
            </div>
        `).join('');
    }

    generateActivityData() {
        const activity = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            
            activity.push({
                date: date.toISOString().split('T')[0],
                questions: Math.floor(Math.random() * 5),
                responses: Math.floor(Math.random() * 10),
                likes: Math.floor(Math.random() * 20)
            });
        }
        
        return activity;
    }

    renderDashboardData() {
        this.renderQuestions();
        this.renderStories();
        this.renderAnalytics();
        this.renderActivity();
        this.renderAdminQuestions();
        this.renderAdminUsers();
    }

    renderQuestions() {
        const questionsList = document.getElementById('questions-list');
        if (!questionsList) return;

        let formHtml = '';
        if (this.state.user) {
            formHtml = `
                <div class="question-card" style="margin-bottom: 15px;">
                    <div class="question-header">
                        <div class="question-avatar">👤</div>
                        <div class="question-meta">
                            <h5>${this.state.user.name || this.state.user.email || 'Пользователь'}</h5>
                            <div class="date">Задайте новый вопрос</div>
                        </div>
                    </div>
                    <div class="question-content">
                        <textarea id="new-question-content" class="comment-input" placeholder="Опишите ваш вопрос или ситуацию..." rows="3"></textarea>
                    </div>
                    <div class="question-actions">
                        <div class="action-buttons">
                            <button class="action-btn" id="new-question-submit">
                                <i class="fas fa-paper-plane"></i> Отправить вопрос
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            formHtml = `
                <div class="question-card" style="margin-bottom: 15px; text-align: center;">
                    <p style="color: var(--text-tertiary);">
                        Войдите в аккаунт, чтобы задавать вопросы.
                    </p>
                </div>
            `;
        }

        let listHtml = '';
        if (!this.dashboard.questions || this.dashboard.questions.length === 0) {
            listHtml = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-question-circle" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Пока нет вопросов</h4>
                    <p style="color: var(--text-tertiary);">Когда пользователи зададут вам вопросы, они появятся здесь</p>
                </div>
            `;
        } else {
            listHtml = this.dashboard.questions.map(question => `
                <div class="question-card" data-question-id="${question.id}">
                    <div class="question-header">
                        <div class="question-avatar">${question.user.avatar}</div>
                        <div class="question-meta">
                            <h5>${question.user.name}</h5>
                            <div class="date">${this.formatDate(question.date)}</div>
                        </div>
                    </div>
                    <div class="question-content">${question.content}</div>
                    <div class="question-actions">
                        <div class="action-buttons">
                            <button class="action-btn ${question.isLiked ? 'liked' : ''}" data-action="like" data-question-id="${question.id}">
                                <i class="fas fa-thumbs-up"></i> ${question.likes}
                            </button>
                            <button class="action-btn ${question.isDisliked ? 'disliked' : ''}" data-action="dislike" data-question-id="${question.id}">
                                <i class="fas fa-thumbs-down"></i> ${question.dislikes}
                            </button>
                            <button class="action-btn" data-action="comment" data-question-id="${question.id}">
                                <i class="fas fa-comment"></i> Ответить
                            </button>
                            ${this.state.isAdmin ? `
                            <button class="action-btn" data-action="admin-delete" data-question-id="${question.id}">
                                <i class="fas fa-trash"></i> Удалить
                            </button>
                            <button class="action-btn" data-action="admin-ban" data-question-id="${question.id}" data-author-id="${question.authorId ?? ''}">
                                <i class="fas fa-user-slash"></i> Бан пользователя
                            </button>
                            ` : ''}
                        </div>
                        <div class="comments-count" data-question-id="${question.id}">
                            <i class="fas fa-comments"></i> ${question.comments}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        questionsList.innerHTML = formHtml + listHtml;

        const submitBtn = document.getElementById('new-question-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const textarea = document.getElementById('new-question-content');
                const text = textarea ? textarea.value : '';
                await this.submitDashboardQuestion(text);
                if (textarea) {
                    textarea.value = '';
                }
            });
        }

        this.attachAdminQuestionHandlers();
        this.updateBadges();
    }

    renderStories() {
        const storiesList = document.getElementById('stories-list');
        if (!storiesList) return;
        
        if (!this.dashboard.stories || this.dashboard.stories.length === 0) {
            storiesList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-history" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Пока нет историй</h4>
                    <p style="color: var(--text-tertiary);">Ваши чаты и консультации появятся здесь</p>
                </div>
            `;
            return;
        }
        
        const sortedStories = [...this.dashboard.stories].sort((a, b) => b.date - a.date);
        
        storiesList.innerHTML = sortedStories.map(story => `
            <div class="question-card" data-story-id="${story.id}">
                <div class="question-header">
                    <div class="question-avatar">💬</div>
                    <div class="question-meta">
                        <h5>${story.title}</h5>
                        <div class="date">${this.formatDate(story.date)}</div>
                    </div>
                </div>
                <div class="question-content">${story.preview}</div>
                <div class="question-actions">
                    <div class="action-buttons">
                        <button class="action-btn" onclick="window.verdiktApp.loadChat('${story.id}'); window.verdiktApp.hideModal('dashboard-modal');">
                            <i class="fas fa-eye"></i> Открыть
                        </button>
                        <button class="action-btn" onclick="window.verdiktApp.shareStory('${story.id}')">
                            <i class="fas fa-share"></i> Поделиться
                        </button>
                    </div>
                    <div class="comments-count">
                        <i class="fas fa-comment"></i> ${story.messageCount} сообщ.
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAnalytics() {
        const analyticsTotal = document.getElementById('analytics-total');
        const analyticsHelpful = document.getElementById('analytics-helpful');
        const analyticsLikes = document.getElementById('analytics-likes');
        const analyticsComments = document.getElementById('analytics-comments');
        const dashboardRating = document.getElementById('dashboard-rating');
        
        if (analyticsTotal) analyticsTotal.textContent = this.dashboard.analytics.totalResponses || 0;
        if (analyticsHelpful) analyticsHelpful.textContent = this.dashboard.analytics.helpfulResponses || 0;
        if (analyticsLikes) analyticsLikes.textContent = this.dashboard.dashboard?.likes || 0;
        if (analyticsComments) analyticsComments.textContent = this.dashboard.dashboard?.comments?.length || 0;
        if (dashboardRating) dashboardRating.textContent = this.dashboard.analytics.averageRating || 0;
        
        this.createAnalyticsChart();
    }

    renderActivity() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        const activities = [
            { type: 'question', text: 'Ответил на вопрос о манипуляциях', time: '2 часа назад' },
            { type: 'like', text: 'Получил 5 лайков за совет о свиданиях', time: '5 часов назад' },
            { type: 'comment', text: 'Прокомментировал историю о токсичных отношениях', time: 'Вчера' },
            { type: 'chat', text: 'Провел консультацию по семейным отношениям', time: '2 дня назад' }
        ];
        
        activityList.innerHTML = activities.map(activity => `
            <div class="question-card">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: ${this.getActivityColor(activity.type)}; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white;">
                        ${this.getActivityIcon(activity.type)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 3px;">${activity.text}</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">${activity.time}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAdminUsers() {
        const usersList = document.getElementById('admin-users-list');
        const usersFilterButtons = document.querySelectorAll('.admin-user-filter');
        const searchInput = document.getElementById('admin-user-search-input');

        if (!usersList) return;

        if (!this.state.isAdmin) {
            usersList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Нет доступа</h4>
                    <p style="color: var(--text-tertiary);">Управление пользователями доступно только в админ-режиме</p>
                </div>
            `;
            return;
        }

        if (this.state.adminUsersLoading) {
            usersList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-tertiary); margin-bottom: 16px;"></i>
                    <p style="color: var(--text-tertiary);">Загрузка пользователей...</p>
                </div>
            `;
            return;
        }

        if (!this.state.adminUsersPage || !this.state.adminUsersPage.content) {
            usersList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Список пользователей</h4>
                    <p style="color: var(--text-tertiary); margin-bottom: 16px;">Загрузите список с сервера</p>
                    <button type="button" class="action-btn" id="admin-users-load-btn"><i class="fas fa-sync-alt"></i> Загрузить</button>
                </div>
            `;
            const loadBtn = document.getElementById('admin-users-load-btn');
            if (loadBtn && !loadBtn._bound) {
                loadBtn._bound = true;
                loadBtn.addEventListener('click', () => this.loadAdminUsers(0));
            }
            if (!this.state._adminUsersLoadTriggered) {
                this.state._adminUsersLoadTriggered = true;
                this.loadAdminUsers(0);
            }
            return;
        }

        const page = this.state.adminUsersPage;
        let users = page.content || [];
        const filter = this.state.adminUserFilter || 'all';
        if (filter === 'banned') {
            users = users.filter(u => u.banned === true);
        } else if (filter === 'admins') {
            users = users.filter(u => (u.role || '').toUpperCase() === 'ADMIN');
        }

        const query = (this.state.adminUserSearchQuery || '').trim().toLowerCase();
        if (query) {
            users = users.filter(u => {
                const name = (u.name || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                return name.includes(query) || email.includes(query);
            });
        }

        if (!users.length) {
            usersList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-users-slash" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Ничего не найдено</h4>
                    <p style="color: var(--text-tertiary);">Попробуйте изменить фильтр или поиск</p>
                </div>
            `;
        } else {
            const isAdminRole = (r) => (r || '').toUpperCase() === 'ADMIN';
            const subs = this.state.adminSubscriptions || {};
            usersList.innerHTML = users.map(user => {
                const sub = (user.subscription || subs[user.id] || 'free').toLowerCase();
                return `
                <div class="question-card" data-user-id="${user.id}">
                    <div class="question-header">
                        <div class="question-avatar">${(user.name || user.email || 'П')[0].toUpperCase()}</div>
                        <div class="question-meta">
                            <h5>${user.name || user.email || 'Пользователь'}</h5>
                            <div class="date">
                                ${user.email ? user.email + ' · ' : ''}${isAdminRole(user.role) ? 'Админ' : 'Пользователь'}${user.banned ? ' · Забанен' : ''} · Подписка: ${String(sub).toUpperCase()}
                            </div>
                        </div>
                    </div>
                    <div class="question-actions">
                        <div class="action-buttons">
                            <button class="action-btn" data-action="user-ban" data-user-id="${user.id}" data-user-banned="${user.banned === true}">
                                <i class="fas fa-${user.banned ? 'user-check' : 'user-slash'}"></i>
                                ${user.banned ? 'Разбанить' : 'Забанить'}
                            </button>
                            <button class="action-btn" data-action="user-role" data-user-id="${user.id}" data-user-role="${(user.role || 'USER').toUpperCase()}">
                                <i class="fas fa-${isAdminRole(user.role) ? 'user' : 'user-shield'}"></i>
                                ${isAdminRole(user.role) ? 'Сделать пользователем' : 'Сделать админом'}
                            </button>
                            <label style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05);">
                                <i class="fas fa-gem" style="opacity: 0.8;"></i>
                                <span style="font-size: 0.85rem; color: var(--text-secondary);">Подписка</span>
                                <select data-action="user-subscription" data-user-id="${user.id}" style="background: transparent; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 8px;">
                                    <option value="free" ${sub === 'free' ? 'selected' : ''}>FREE</option>
                                    <option value="lite" ${sub === 'lite' ? 'selected' : ''}>LITE</option>
                                    <option value="pro" ${sub === 'pro' ? 'selected' : ''}>PRO</option>
                                    <option value="ultimate" ${sub === 'ultimate' ? 'selected' : ''}>ULTIMATE</option>
                                </select>
                            </label>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        const paginationHtml = [];
        if (page.totalPages > 1) {
            const currentPage = page.number !== undefined ? page.number : (this.state.adminUsersPageNumber || 0);
            if (!page.first) {
                paginationHtml.push(`<button type="button" class="action-btn admin-users-prev" data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i> Назад</button>`);
            }
            paginationHtml.push(`<span style="color: var(--text-secondary); font-size: 0.9rem;">Страница ${currentPage + 1} из ${page.totalPages}</span>`);
            if (!page.last) {
                paginationHtml.push(`<button type="button" class="action-btn admin-users-next" data-page="${currentPage + 1}">Вперёд <i class="fas fa-chevron-right"></i></button>`);
            }
        }
        if (paginationHtml.length) {
            usersList.insertAdjacentHTML('beforeend', `<div class="question-card" style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 16px;">${paginationHtml.join('')}</div>`);
            usersList.querySelectorAll('.admin-users-prev, .admin-users-next').forEach(btn => {
                btn.addEventListener('click', () => {
                    const p = parseInt(btn.getAttribute('data-page'), 10);
                    if (!isNaN(p)) this.loadAdminUsers(p);
                });
            });
        }

        usersFilterButtons.forEach(btn => {
            const value = btn.getAttribute('data-filter');
            if (!value) return;
            btn.classList.toggle('active', value === this.state.adminUserFilter);
            if (!btn._adminUserFilterBound) {
                btn.addEventListener('click', () => {
                    this.state.adminUserFilter = value;
                    this.renderAdminUsers();
                });
                btn._adminUserFilterBound = true;
            }
        });

        if (searchInput) {
            if (typeof this.state.adminUserSearchQuery === 'string') searchInput.value = this.state.adminUserSearchQuery;
            if (!searchInput._adminUserSearchBound) {
                searchInput.addEventListener('input', () => {
                    this.state.adminUserSearchQuery = searchInput.value || '';
                    this.renderAdminUsers();
                });
                searchInput._adminUserSearchBound = true;
            }
        }

        const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
        usersList.querySelectorAll('[data-action="user-ban"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-user-id');
                const isBanned = btn.getAttribute('data-user-banned') === 'true';
                if (!id) return;
                const endpoint = isBanned ? `${baseUrl}/api/admin/users/${id}/unban` : `${baseUrl}/api/admin/users/${id}/ban`;
                const method = 'PATCH';
                try {
                    const response = await fetch(endpoint, { method, credentials: 'include' });
                    if (!response.ok) {
                        const msg = await response.text().catch(() => '');
                        this.showNotification(msg || (response.status === 403 ? 'Нет прав' : 'Ошибка'), 'error');
                        return;
                    }
                    this.showNotification(isBanned ? 'Пользователь разбанен' : 'Пользователь забанен', isBanned ? 'success' : 'warning');
                    await this.loadAdminUsers(this.state.adminUsersPageNumber ?? 0);
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        usersList.querySelectorAll('[data-action="user-role"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-user-id');
                const currentRole = (btn.getAttribute('data-user-role') || 'USER').toUpperCase();
                const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
                if (!id) return;
                try {
                    const response = await fetch(`${baseUrl}/api/admin/users/${id}/role`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: newRole })
                    });
                    if (!response.ok) {
                        const text = await response.text();
                        let msg = 'Ошибка смены роли';
                        try {
                            const err = text ? JSON.parse(text) : {};
                            if (err.message) msg = err.message;
                        } catch (_) {
                            if (text && text.length < 200) msg = text;
                        }
                        this.showNotification(msg, 'error');
                        return;
                    }
                    this.showNotification(newRole === 'ADMIN' ? 'Пользователь назначен админом' : 'Права админа сняты', 'info');
                    await this.loadAdminUsers(this.state.adminUsersPageNumber ?? 0);
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        usersList.querySelectorAll('select[data-action="user-subscription"]').forEach(sel => {
            if (sel._adminSubBound) return;
            sel._adminSubBound = true;
            sel.addEventListener('change', async () => {
                const id = sel.getAttribute('data-user-id');
                const value = (sel.value || 'free').toLowerCase();
                if (!id) return;
                try {
                    const response = await fetch(`${baseUrl}/api/admin/users/${id}/subscription`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscription: value })
                    });
                    if (!response.ok) {
                        this.showNotification(response.status === 403 ? 'Нет прав' : 'Не удалось изменить подписку', 'error');
                        return;
                    }
                    this.showNotification(`Подписка изменена на ${value.toUpperCase()}`, 'info');
                    await this.loadAdminUsers(this.state.adminUsersPageNumber ?? 0);
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });
    }

    renderAdminQuestions() {
        const adminTabButton = document.querySelector('.dashboard-tab[data-tab="admin"]');
        const adminList = document.getElementById('admin-questions-list');

        if (!adminTabButton || !adminList) return;

        if (this.state.isAdmin) {
            adminTabButton.style.display = '';
        } else {
            adminTabButton.style.display = 'none';
        }

        if (!this.state.isAdmin) {
            adminList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Нет доступа</h4>
                    <p style="color: var(--text-tertiary);">Админ-панель доступна только в админ-режиме</p>
                </div>
            `;
            return;
        }

        if (!this.dashboard || !this.dashboard.questions || this.dashboard.questions.length === 0) {
            adminList.innerHTML = `
                <div class="question-card" style="text-align: center; padding: 40px;">
                    <i class="fas fa-tasks" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 20px;"></i>
                    <h4>Пока нет вопросов</h4>
                    <p style="color: var(--text-tertiary);">После появления вопросов вы сможете управлять ими здесь</p>
                </div>
            `;
            return;
        }

        const filter = this.state.adminQuestionFilter || 'all';
        let questions = [...this.dashboard.questions];

        if (filter === 'unresolved') {
            questions = questions.filter(q => !q.isResolved);
        } else if (filter === 'resolved') {
            questions = questions.filter(q => q.isResolved);
        } else if (filter === 'banned') {
            questions = questions.filter(q => q.isBanned);
        } else if (filter === 'not-banned') {
            questions = questions.filter(q => !q.isBanned);
        }

        const html = questions.map(question => `
            <div class="question-card" data-question-id="${question.id}">
                <div class="question-header">
                    <div class="question-avatar">${question.user.avatar}</div>
                    <div class="question-meta">
                        <h5>${question.user.name}</h5>
                        <div class="date">${this.formatDate(question.date)}</div>
                    </div>
                </div>
                <div class="question-content">
                    ${question.content}
                    ${question.isBanned ? `
                        <div style="margin-top: 8px; font-size: 0.8rem; color: #f97316;">
                            <i class="fas fa-exclamation-triangle"></i> Пользователь помечен как забаненный
                        </div>
                    ` : ''}
                </div>
                <div class="question-actions">
                    <div class="action-buttons">
                        <button class="action-btn" data-action="admin-delete" data-question-id="${question.id}">
                            <i class="fas fa-trash"></i> Удалить вопрос
                        </button>
                        <button class="action-btn" data-action="admin-ban" data-question-id="${question.id}" data-author-id="${question.authorId ?? ''}">
                            <i class="fas fa-user-slash"></i> Забанить пользователя
                        </button>
                        <button class="action-btn" data-action="admin-resolve" data-question-id="${question.id}">
                            <i class="fas fa-${question.isResolved ? 'undo' : 'check'}"></i> ${question.isResolved ? 'Снять отметку' : 'Отметить как решенный'}
                        </button>
                    </div>
                    <div class="comments-count" data-question-id="${question.id}">
                        <i class="fas fa-comments"></i> ${question.comments}
                    </div>
                </div>
            </div>
        `).join('');

        adminList.innerHTML = html;

        adminList.querySelectorAll('[data-action="admin-delete"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-question-id');
                if (!id) return;
                const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
                try {
                    const response = await fetch(`${baseUrl}/api/admin/questions/${id}`, { method: 'DELETE', credentials: 'include' });
                    if (!response.ok) {
                        this.showNotification(response.status === 403 ? 'Нет прав' : 'Не удалось удалить вопрос', 'error');
                        return;
                    }
                    this.showNotification('Вопрос удалён', 'info');
                    await this.loadDashboardData();
                    this.renderQuestions();
                    this.renderAdminQuestions();
                    this.updateSidebarStats();
                    this.renderAdminUsers();
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        adminList.querySelectorAll('[data-action="admin-ban"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const authorId = btn.getAttribute('data-author-id');
                if (!authorId) {
                    this.showNotification('Нет данных об авторе вопроса', 'warning');
                    return;
                }
                const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
                try {
                    const response = await fetch(`${baseUrl}/api/admin/users/${authorId}/ban`, { method: 'PATCH', credentials: 'include' });
                    if (!response.ok) {
                        const msg = await response.text().catch(() => '');
                        this.showNotification(msg || (response.status === 403 ? 'Нет прав' : 'Ошибка'), 'error');
                        return;
                    }
                    this.showNotification('Пользователь забанен', 'warning');
                    await this.loadDashboardData();
                    this.renderAdminQuestions();
                    this.renderAdminUsers();
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        adminList.querySelectorAll('[data-action="admin-resolve"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-question-id');
                if (!id) return;
                const question = this.dashboard.questions.find(q => String(q.id) === String(id));
                if (!question) return;
                const resolved = !question.isResolved;
                const baseUrl = (window.VERDIKT_BACKEND_URL || window.location.origin).replace(/\/$/, '');
                try {
                    const response = await fetch(`${baseUrl}/api/admin/questions/${id}/resolve`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resolved })
                    });
                    if (!response.ok) {
                        const msg = await response.text().catch(() => '');
                        this.showNotification(msg || (response.status === 403 ? 'Нет прав' : 'Ошибка'), 'error');
                        return;
                    }
                    this.showNotification(resolved ? 'Вопрос отмечен как решённый' : 'Снята отметка о решении', 'success');
                    await this.loadDashboardData();
                    this.renderAdminQuestions();
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        const filterButtons = document.querySelectorAll('.admin-question-filter');
        filterButtons.forEach(btn => {
            const value = btn.getAttribute('data-filter');
            if (!value) return;

            btn.classList.toggle('active', value === this.state.adminQuestionFilter);

            if (!btn._adminFilterBound) {
                btn.addEventListener('click', () => {
                    this.state.adminQuestionFilter = value;
                    this.renderAdminQuestions();
                });
                btn._adminFilterBound = true;
            }
        });
    }

    getActivityColor(type) {
        switch(type) {
            case 'question': return 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
            case 'like': return 'linear-gradient(135deg, #ef4444, #dc2626)';
            case 'comment': return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            case 'chat': return 'linear-gradient(135deg, #10b981, #059669)';
            default: return 'linear-gradient(135deg, var(--primary), var(--secondary))';
        }
    }

    getActivityIcon(type) {
        switch(type) {
            case 'question': return '❓';
            case 'like': return '❤️';
            case 'comment': return '💬';
            case 'chat': return '💕';
            default: return '📝';
        }
    }

    triggerHapticFeedback() {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent || '');
        if (!isMobile) return;
        if (!navigator.vibrate) return;

        navigator.vibrate(30);
    }

    createAnalyticsChart() {
        const ctx = document.getElementById('analytics-chart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.analyticsChart) {
            this.analyticsChart.destroy();
        }
        
        const labels = this.dashboard.analytics.activity.map(a => 
            new Date(a.date).toLocaleDateString('ru-RU', { weekday: 'short' })
        );
        
        const questionsData = this.dashboard.analytics.activity.map(a => a.questions);
        const responsesData = this.dashboard.analytics.activity.map(a => a.responses);
        
        this.analyticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Вопросы',
                        data: questionsData,
                        borderColor: '#ec4899',
                        backgroundColor: 'rgba(236, 72, 153, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Ответы',
                        data: responsesData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: 'var(--text-secondary)'
                        }
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
                            color: 'var(--text-secondary)'
                        },
                        grid: {
                            color: 'var(--border-color)'
                        }
                    }
                }
            }
        });
    }

    getBalanceData() {
        const stats = this.state.stats;
        const total = stats.totalMessages || 0;

        const trustConcerns = stats.relationshipAdvice || 0;
        const communicationConcerns = stats.relationshipAdvice || 0;
        const boundariesConcerns = stats.manipulationRequests || 0;
        const passionConcerns = stats.datingAdvice || 0;

        const clampScore = (concerns, maxImpact = 5) => {
            const impact = Math.min(concerns, maxImpact);
            const score = 10 - impact;
            return Math.max(2, Math.min(10, score));
        };

        const trust = clampScore(trustConcerns, 6);
        const passion = clampScore(passionConcerns, 5);
        const communication = clampScore(communicationConcerns, 6);
        const boundaries = clampScore(boundariesConcerns, 6);
        const selfEsteem = clampScore(boundariesConcerns + trustConcerns, 8);
        const conflicts = clampScore(trustConcerns, 6);
        const support = Math.min(10, 5 + Math.floor(total / 15));
        const independence = Math.min(10, 6 + Math.floor(stats.sessions / 2));

        const labels = [
            'Доверие',
            'Страсть',
            'Коммуникация',
            'Границы',
            'Самоценность',
            'Конфликты',
            'Поддержка',
            'Самостоятельность',
        ];

        const values = [
            trust,
            passion,
            communication,
            boundaries,
            selfEsteem,
            conflicts,
            support,
            independence,
        ];

        return { labels, values };
    }

    showBalanceModal(auto = false) {
        const modal = document.getElementById('balance-modal');
        const canvas = document.getElementById('balance-chart');
        if (!modal || !canvas) return;

        const { labels, values } = this.getBalanceData();

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (this.balanceChart) {
            this.balanceChart.destroy();
        }

        this.balanceChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'Баланс отношений',
                    data: values,
                    backgroundColor: 'rgba(236, 72, 153, 0.18)',
                    borderColor: '#ec4899',
                    borderWidth: 2,
                    pointBackgroundColor: '#ec4899',
                    pointRadius: 3,
                    pointHoverRadius: 5,
                }],
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        suggestedMin: 0,
                        suggestedMax: 10,
                        ticks: {
                            display: false,
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.4)',
                        },
                        angleLines: {
                            color: 'rgba(148, 163, 184, 0.4)',
                        },
                        pointLabels: {
                            color: 'var(--text-secondary)',
                            font: {
                                size: 11,
                            },
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        });

        const summaryEl = document.getElementById('balance-summary');
        const recsEl = document.getElementById('balance-recommendations');

        if (summaryEl && recsEl) {
            const pairs = labels.map((label, idx) => ({ label, value: values[idx] }));
            const sorted = [...pairs].sort((a, b) => a.value - b.value);
            const weakest = sorted.slice(0, 2);
            const strongest = sorted.slice(-2).reverse();

            summaryEl.innerHTML = `
                Сильные стороны сейчас: <strong>${strongest.map(s => s.label).join(', ')}</strong>.<br>
                Зоны напряжения: <strong>${weakest.map(w => w.label).join(', ')}</strong>.
            `;

            const recs = [];
            weakest.forEach(({ label }) => {
                switch (label) {
                    case 'Доверие':
                        recs.push('Больше проговаривайте ожидания и страхи, договоритесь о прозрачности в важных темах.');
                        break;
                    case 'Коммуникация':
                        recs.push('Вводите привычку «спокойных разговоров»: обсуждать сложные темы отдельно от ссор.');
                        break;
                    case 'Границы':
                        recs.push('Определите, что для вас недопустимо, и проговорите это партнёру в спокойной форме.');
                        break;
                    case 'Страсть':
                        recs.push('Запланируйте совместные тёплые активности: свидания, ритуалы близости, общие впечатления.');
                        break;
                    case 'Самоценность':
                        recs.push('Отслеживайте, где вы поступаетесь собой ради партнёра, и постепенно выравнивайте баланс.');
                        break;
                    case 'Конфликты':
                        recs.push('Договоритесь об общих правилах ссор: без оскорблений, с паузами и возвращением к диалогу.');
                        break;
                    case 'Поддержка':
                        recs.push('Попросите партнёра о конкретной поддержке и сами интересуйтесь его состоянием чаще.');
                        break;
                    case 'Самостоятельность':
                        recs.push('Сохраните свои личные интересы и друзей — это укрепляет, а не рушит отношения.');
                        break;
                }
            });

            recsEl.innerHTML = recs.map(r => `<li>${r}</li>`).join('');
        }

        this.showModal('balance-modal');

        const closeBtn = document.getElementById('balance-close');
        if (closeBtn && !closeBtn._balanceBound) {
            closeBtn.addEventListener('click', () => this.hideModal('balance-modal'));
            closeBtn._balanceBound = true;
        }
    }

    updateSidebarStats() {
        if (!this.dashboard.questions) return;
        
        const totalQuestions = this.dashboard.questions.length;
        const totalLikes = this.dashboard.questions.reduce((sum, q) => sum + q.likes, 0);
        const totalComments = this.dashboard.questions.reduce((sum, q) => sum + q.comments, 0);
        const helpfulResponses = this.dashboard.analytics.helpfulResponses;
        
        if (this.elements.statQuestions) this.elements.statQuestions.textContent = totalQuestions;
        if (this.elements.statLikes) this.elements.statLikes.textContent = totalLikes;
        if (this.elements.statComments) this.elements.statComments.textContent = totalComments;
        if (this.elements.statHelpful) this.elements.statHelpful.textContent = helpfulResponses;
    }

    updateBadges() {
        if (!this.dashboard.questions) return;
        
        const totalQuestions = this.dashboard.questions.length;
        const totalLikes = this.dashboard.questions.reduce((sum, q) => sum + q.likes, 0);
        const totalComments = this.dashboard.questions.reduce((sum, q) => sum + q.comments, 0);
        
        if (this.elements.questionsBadge) this.elements.questionsBadge.textContent = totalQuestions;
        if (this.elements.likesBadge) this.elements.likesBadge.textContent = totalLikes;
        if (this.elements.commentsBadge) this.elements.commentsBadge.textContent = totalComments;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Сегодня в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Вчера в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return `${diffDays} дней назад`;
        } else {
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }
    }

    shareStory(storyId) {
        const story = this.dashboard.stories.find(s => s.id === storyId);
        if (!story) return;
        
        const shareUrl = `${window.location.origin}?story=${storyId}`;
        
        if (navigator.share) {
            navigator.share({
                title: story.title,
                text: story.preview,
                url: shareUrl
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.showNotification('Ссылка скопирована в буфер обмена 📋', 'success');
            }).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = shareUrl;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('Ссылка скопирована в буфер обмена 📋', 'success');
            });
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

    
    setupHeroChips() {
        // Этот метод вызывается в init(), но не определен
        console.log('Hero chips initialized');
    }

    showSubscriptionModal() {
        this.showModal('subscription-modal');
        this.updateSubscriptionModalState();
    }

    setupSubscriptionModal() {
        const modal = document.getElementById('subscription-modal');
        if (!modal) return;
        modal.querySelectorAll('.subscription-plan-btn').forEach(btn => {
            if (btn._subscriptionBound) return;
            btn._subscriptionBound = true;
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const plan = (btn.getAttribute('data-plan') || 'free').toLowerCase();
                const current = (this.state.user?.subscription || 'free').toLowerCase();
                if (plan === current) return;
                if (!this.state.user) {
                    this.showNotification('Войдите в аккаунт, чтобы сменить план', 'warning');
                    return;
                }
                const baseUrl = (this.AUTH_CONFIG.baseUrl || window.location.origin).replace(/\/$/, '');
                try {
                    const response = await fetch(`${baseUrl}/api/users/me/subscription`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscription: plan })
                    });
                    if (!response.ok) {
                        const err = await response.json().catch(() => ({}));
                        this.showNotification(err.message || 'Не удалось сменить план', 'error');
                        return;
                    }
                    const user = await response.json();
                    this.state.user = user;
                    this.authService.saveUserToStorage();
                    this.updateSubscriptionModalState();
                    this.updateSidebarInfo();
                    const labels = { free: 'FREE', lite: 'Lite', pro: 'Pro', ultimate: 'Ultimate' };
                    this.showNotification(`План изменён на ${labels[plan] || plan}`, 'success');
                    this.hideModal('subscription-modal');
                } catch (e) {
                    this.showNotification('Ошибка запроса', 'error');
                }
            });
        });

        this._updateSubscriptionButtons = updateSubscriptionButtons;
    }

    showSubscriptionModal() {
        this.showModal('subscription-modal');
        if (this._updateSubscriptionButtons) this._updateSubscriptionButtons();
    }
}
