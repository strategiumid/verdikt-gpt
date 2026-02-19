export class APIClient {
    constructor(app) {
        this.app = app;
    }

    get apiConfig() {
        return this.app.API_CONFIG;
    }

    get authConfig() {
        return this.app.AUTH_CONFIG;
    }

    get state() {
        return this.app.state;
    }

    get elements() {
        return this.app.elements;
    }

    get availableModels() {
        return this.app.availableModels;
    }

    getAuthHeaders() {
        return this.app.getAuthHeaders();
    }

    /**
     * ПОЛУЧЕНИЕ КОНФИГУРАЦИИ API В ЗАВИСИМОСТИ ОТ ПОДПИСКИ ПОЛЬЗОВАТЕЛЯ
     * Если у пользователя подписка Ultimate - используем DeepSeek V3.2
     * Для всех остальных - стандартную модель
     */
    getAPIConfigForUser() {
        // Базовая конфигурация (по умолчанию)
        const defaultConfig = {
            url: 'https://routerai.ru/api/v1/chat/completions',
            model: 'stepfun/step-3.5-flash',
            apiKey: "sk-ayshgI6SUUplUxB0ocKzEQ1IK73mbdql"
        };
        
        // Конфигурация для Ultimate подписки
        const ultimateConfig = {
            url: 'https://routerai.ru/api/v1/chat/completions', // тот же URL
            model: 'deepseek/deepseek-v3.2',
            apiKey: "sk-LJTwkqk_kTbSO0_h39nc5i6UElbsdfmF"
        };
        
        // Проверяем, есть ли пользователь и его подписка
        if (this.state.user) {
            const subscription = (this.state.user.subscription || '').toLowerCase();
            if (subscription === 'ultimate') {
                console.log('🎯 Ultimate подписка: используем модель DeepSeek V3.2');
                return ultimateConfig;
            }
        }
        
        // Для всех остальных случаев используем стандартную конфигурацию
        return defaultConfig;
    }

    // ===== routerai.ru API =====

    async getAIResponse(messages) {
        // ПОЛУЧАЕМ КОНФИГУРАЦИЮ ДЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
        const apiConfig = this.getAPIConfigForUser();
        
        if (!apiConfig.apiKey) {
            throw new Error('API ключ не настроен. Пожалуйста, добавьте ключ в настройках.');
        }

        try {
            console.log('Отправка запроса к API...', {
                url: apiConfig.url,
                model: apiConfig.model,
                messagesCount: messages.length,
                subscription: this.state.user?.subscription || 'free'
            });

            // Добавляем инструкцию по форматированию в последнее сообщение
            const enhancedMessages = [...messages];
            
            // Проверяем, есть ли уже инструкция в последнем сообщении пользователя
            const lastUserMessageIndex = [...enhancedMessages].reverse().findIndex(m => m.role === 'user');
            if (lastUserMessageIndex !== -1) {
                const actualIndex = enhancedMessages.length - 1 - lastUserMessageIndex;
                const lastUserMsg = enhancedMessages[actualIndex];
                
                // Добавляем инструкцию по длине ответа, если её ещё нет
                if (!lastUserMsg.content.includes('[ФОРМАТИРОВАНИЕ]')) {
                    enhancedMessages[actualIndex] = {
                        ...lastUserMsg,
                        content: lastUserMsg.content + `\n\n[ФОРМАТИРОВАНИЕ: без #, заголовки **жирным**, списки через • или -. Завершай каждую мысль полным предложением; не обрывай ответ на полуслове.]`
                    };
                }
            }

            // ИСПОЛЬЗУЕМ ПОЛУЧЕННУЮ КОНФИГУРАЦИЮ
            const response = await fetch(apiConfig.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: enhancedMessages,
                    max_tokens: this.apiConfig.maxTokens, // оставляем из this.apiConfig
                    temperature: this.apiConfig.temperature, // оставляем из this.apiConfig
                    stream: false
                })
            });

            console.log('Статус ответа:', response.status);

            if (!response.ok) {
                let errorMessage = "Ошибка API: ";
                
                try {
                    const errorData = await response.json();
                    console.error('API Error:', errorData);
                    if (errorData.error?.message) {
                        errorMessage += errorData.error.message;
                    } else {
                        errorMessage += `HTTP ${response.status}`;
                    }
                } catch {
                    errorMessage += `HTTP ${response.status}`;
                }
                
                if (response.status === 401) {
                    errorMessage = "Неверный API ключ. Проверьте ключ в настройках.";
                } else if (response.status === 429) {
                    errorMessage = "Превышен лимит запросов. Попробуйте позже.";
                } else if (response.status === 503) {
                    errorMessage = "Сервер временно недоступен. Попробуйте позже.";
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Ответ API получен:', data);
            
            let aiResponse = '';
            
            // Проверяем различные форматы ответа
            if (data.choices && data.choices[0]?.message?.content) {
                aiResponse = data.choices[0].message.content.trim();
            } else if (data.choices && data.choices[0]?.text) {
                aiResponse = data.choices[0].text.trim();
            } else if (data.response) {
                aiResponse = data.response.trim();
            } else if (data.content) {
                aiResponse = data.content.trim();
            } else if (data.message?.content) {
                aiResponse = data.message.content.trim();
            } else {
                console.error('Неизвестный формат ответа:', data);
                throw new Error('Неверный формат ответа от API');
            }
            
            // Пост-обработка ответа: удаляем решетки, если вдруг появились
            aiResponse = aiResponse.replace(/#{1,6}\s*/g, '**'); // Заменяем заголовки с # на жирный текст
            
            return aiResponse;
            
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            
            if (error.message.includes('API ключ') || error.message.includes('401')) {
                throw new Error('Пожалуйста, настройте API ключ в настройках приложения.');
            }
            
            throw error;
        }
    }

    async checkApiStatus() {
        // ПОЛУЧАЕМ КОНФИГУРАЦИЮ ДЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
        const apiConfig = this.getAPIConfigForUser();
        
        if (!apiConfig.apiKey) {
            if (this.app.updateHeaderApiStatus) {
                this.app.updateHeaderApiStatus('not-configured', 'API ключ не настроен');
            }
            this.app.showNotification('Добавьте API ключ в настройках', 'warning');
            this.state.isApiConnected = false;
            if (this.app.updateSphereApiState) {
                this.app.updateSphereApiState('not-configured');
            }
            return;
        }

        // Уже подключены (например, после создания нового чата) — не показывать «Проверка API...» и не слать лишний запрос
        if (this.state.isApiConnected) {
            // ПОКАЗЫВАЕМ НАЗВАНИЕ МОДЕЛИ В ЗАВИСИМОСТИ ОТ ПОДПИСКИ
            let modelName = apiConfig.model;
            if (modelName.includes('stepfun')) {
                modelName = 'Verdikt GPT';
            } else if (modelName.includes('deepseek')) {
                modelName = 'DeepSeek V3.2 (Ultimate)';
            }
            
            if (this.app.updateHeaderApiStatus) {
                this.app.updateHeaderApiStatus('connected', modelName);
            }
            return;
        }

        if (this.app.updateHeaderApiStatus) {
            this.app.updateHeaderApiStatus('connecting', 'Проверка API...');
        }
        if (this.app.updateSphereApiState) {
            this.app.updateSphereApiState('connecting');
        }
        
        try {
            console.log('Проверка API с ключом:', apiConfig.apiKey.substring(0, 10) + '...');
            console.log('URL:', apiConfig.url);
            console.log('Модель:', apiConfig.model);
            
            // ИСПОЛЬЗУЕМ ПОЛУЧЕННУЮ КОНФИГУРАЦИЮ
            const response = await fetch(apiConfig.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: apiConfig.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 5,
                    temperature: 0.5
                })
            });

            console.log('Статус ответа:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Ответ API при проверке:', data);
                
                // Проверяем, что ответ содержит ожидаемые поля
                const hasValidResponse = data.choices && 
                                        data.choices[0] && 
                                        (data.choices[0].message || data.choices[0].text);
                
                if (hasValidResponse) {
                    // ПОКАЗЫВАЕМ НАЗВАНИЕ МОДЕЛИ В ЗАВИСИМОСТИ ОТ ПОДПИСКИ
                    let modelName = apiConfig.model;
                    if (modelName.includes('stepfun')) {
                        modelName = 'Verdikt GPT';
                    } else if (modelName.includes('deepseek')) {
                        modelName = 'DeepSeek V3.2 (Ultimate)';
                    }
                    
                    if (this.app.updateHeaderApiStatus) {
                        this.app.updateHeaderApiStatus('connected', modelName);
                    }
                    this.state.isApiConnected = true;
                    if (this.app.updateSphereApiState) {
                        this.app.updateSphereApiState('connected');
                    }
                    
                    this.app.showNotification('API ключ проверен и активен ✅', 'success');
                } else {
                    throw new Error('Неверный формат ответа');
                }
            } else {
                let errorText = '';
                try {
                    const errorData = await response.json();
                    errorText = JSON.stringify(errorData);
                    console.error('Ошибка API:', errorData);
                } catch (e) {
                    errorText = await response.text();
                    console.error('Ошибка API (текст):', errorText);
                }
                
                if (this.app.updateHeaderApiStatus) {
                    this.app.updateHeaderApiStatus('error', 'Ошибка API ключа');
                }
                this.state.isApiConnected = false;
                if (this.app.updateSphereApiState) {
                    this.app.updateSphereApiState('error');
                }
                
                let userMessage = 'Не удалось подключиться к API. ';
                if (response.status === 401) {
                    userMessage = 'Неверный API ключ. Проверьте ключ в настройках.';
                } else if (response.status === 404) {
                    userMessage = 'API endpoint не найден. Проверьте URL.';
                } else if (response.status === 500) {
                    userMessage = 'Внутренняя ошибка сервера. Попробуйте позже.';
                } else {
                    userMessage += `Код ошибки: ${response.status}`;
                }
                
                this.app.showNotification(userMessage, 'error');
            }
        } catch (error) {
            console.error('API check error:', error);
            
            if (this.app.updateHeaderApiStatus) {
                this.app.updateHeaderApiStatus('error', 'Ошибка соединения');
            }
            this.state.isApiConnected = false;
            if (this.app.updateSphereApiState) {
                this.app.updateSphereApiState('error');
            }
            
            let errorMessage = 'Не удалось подключиться к API. ';
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Сервер недоступен. Проверьте URL и интернет-соединение.';
            } else {
                errorMessage += error.message;
            }
            
            this.app.showNotification(errorMessage, 'error');
        }
    }

    // ===== Вопросы / дашборд =====

    async loadDashboardData() {
        try {
            let questions = [];
            if (this.state.user) {
                try {
                    const url = `${this.authConfig.baseUrl}/api/questions`;
                    const response = await fetch(url, {
                        method: 'GET',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (Array.isArray(data)) {
                            questions = data.map(q => ({
                                id: q.id,
                                authorId: q.authorId ?? null,
                                user: {
                                    name: q.authorName || q.authorEmail || 'Пользователь',
                                    email: q.authorEmail || '',
                                    avatar: '👤'
                                },
                                content: q.content,
                                date: q.createdAt,
                                likes: q.likesCount ?? 0,
                                dislikes: q.dislikesCount ?? 0,
                                comments: q.commentsCount ?? 0,
                                isLiked: q.isLiked ?? false,
                                isDisliked: q.isDisliked ?? false,
                                isResolved: q.resolved ?? false
                            }));
                        }
                    } else if (response.status !== 404) {
                        console.warn('Не удалось загрузить вопросы с бэкенда', response.status);
                    }
                } catch (e) {
                    console.error('Error fetching questions from backend:', e);
                }
            }

            this.app.dashboard = {
                questions,
                stories: this.app.chatManager.chats.map(chat => ({
                    id: chat.id,
                    title: chat.title,
                    preview: chat.messages && chat.messages.length > 0 
                        ? chat.messages[0].content.substring(0, 100) + '...'
                        : 'Нет сообщений',
                    date: new Date(chat.timestamp),
                    messageCount: chat.messages ? chat.messages.length : 0,
                    likes: Math.floor(Math.random() * 20),
                    comments: Math.floor(Math.random() * 10)
                })),
                analytics: {
                    totalResponses: this.state.stats.aiMessages || 0,
                    helpfulResponses: (this.state.stats.relationshipAdvice || 0)
                        + (this.state.stats.manipulationRequests || 0)
                        + (this.state.stats.datingAdvice || 0),
                    averageRating: 0,
                    activity: this.app.generateActivityData()
                }
            };
            
            this.app.renderDashboardData();
            this.app.updateSidebarStats();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async submitDashboardQuestion(content) {
        if (!this.state.user) {
            this.app.showNotification('Войдите в аккаунт, чтобы задать вопрос', 'warning');
            return;
        }

        const trimmed = (content || '').trim();
        if (!trimmed) {
            this.app.showNotification('Введите текст вопроса', 'warning');
            return;
        }

        try {
            const url = `${this.authConfig.baseUrl}/api/questions`;
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
                body: JSON.stringify({ content: trimmed })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const message = error.message || `Не удалось отправить вопрос (HTTP ${response.status})`;
                throw new Error(message);
            }

            const question = await response.json();
            const mapped = {
                id: question.id,
                user: {
                    name: question.authorName || question.authorEmail || (this.state.user.name || this.state.user.email || 'Пользователь'),
                    email: question.authorEmail || this.state.user.email || '',
                    avatar: '👤'
                },
                content: question.content,
                date: question.createdAt,
                likes: question.likesCount ?? 0,
                dislikes: question.dislikesCount ?? 0,
                comments: question.commentsCount ?? 0,
                isLiked: question.isLiked ?? false,
                isDisliked: question.isDisliked ?? false
            };

            if (!this.app.dashboard) {
                this.app.dashboard = { questions: [], stories: [], analytics: { activity: [] } };
            }

            this.app.dashboard.questions = [mapped, ...(this.app.dashboard.questions || [])];
            this.app.renderQuestions();
            this.app.updateSidebarStats();
            this.app.showNotification('Вопрос отправлен', 'success');
        } catch (error) {
            console.error('submitDashboardQuestion error:', error);
            this.app.showNotification(error.message || 'Не удалось отправить вопрос', 'error');
        }
    }

    async setQuestionReaction(questionId, type) {
        if (!this.state.user) return;
        try {
            const url = `${this.authConfig.baseUrl}/api/questions/${questionId}/reaction`;
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
                body: JSON.stringify({ type })
            });
            if (!res.ok) throw new Error('Не удалось отправить реакцию');
            const q = await res.json();
            const question = this.app.dashboard?.questions?.find(x => String(x.id) === String(questionId));
            if (question) {
                question.likes = q.likesCount ?? question.likes;
                question.dislikes = q.dislikesCount ?? question.dislikes;
                question.isLiked = q.isLiked ?? false;
                question.isDisliked = q.isDisliked ?? false;
            }
            this.app.renderQuestions();
            this.app.updateSidebarStats();
        } catch (e) {
            this.app.showNotification(e.message || 'Ошибка реакции', 'error');
        }
    }

    async submitQuestionComment(questionId, content) {
        if (!this.state.user) return;
        try {
            const trimmed = (content || '').trim();
            if (!trimmed) {
                this.app.showNotification('Введите текст комментария', 'warning');
                return;
            }

            const url = `${this.authConfig.baseUrl}/api/questions/${questionId}/comments`;
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
                body: JSON.stringify({ content: trimmed })
            });
            if (!res.ok) throw new Error('Не удалось отправить комментарий');
            const question = this.app.dashboard?.questions?.find(x => String(x.id) === String(questionId));
            if (question) question.comments = (question.comments || 0) + 1;

            if (this.state.questionComments && this.state.questionComments[questionId]) {
                this.state.questionComments[questionId] = null;
            }

            this.app.renderQuestions();
            this.app.updateSidebarStats();
            this.app.showNotification('Комментарий добавлен', 'success');
        } catch (e) {
            this.app.showNotification(e.message || 'Ошибка отправки комментария', 'error');
        }
    }

    async loadQuestionComments(questionId, force = false) {
        if (!this.state.questionComments) {
            this.state.questionComments = {};
        }

        if (!force && this.state.questionComments[questionId]) {
            return this.state.questionComments[questionId];
        }

        let comments = [];

        try {
            const url = `${this.authConfig.baseUrl}/api/questions/${questionId}/comments`;
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }
            });

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    comments = data.map(c => ({
                        id: c.id,
                        authorName: c.authorName || c.authorEmail || 'Пользователь',
                        authorEmail: c.authorEmail || '',
                        content: c.content || '',
                        createdAt: c.createdAt || c.created_at || null
                    }));
                }
            } else if (res.status !== 404) {
                console.warn('Не удалось загрузить комментарии', res.status);
            }
        } catch (e) {
            console.error('Error loading question comments:', e);
        }

        this.state.questionComments[questionId] = comments;
        return comments;
    }
}