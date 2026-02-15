export class APIClient {
    constructor(app) {
        this.app = app;
        // Максимальное количество сообщений для сохранения в истории
        this.maxHistoryMessages = 6; // Сохраняем последние 6 сообщений (3 пользователя + 3 ассистента)
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

    // ===== routerai.ru API =====

    // Метод для обрезки истории сообщений
    truncateMessageHistory(messages) {
        if (!messages || messages.length === 0) return messages;
        
        // Всегда сохраняем системный промпт (первое сообщение)
        const systemMessage = messages[0];
        
        // Берем последние N сообщений (исключая системное)
        const recentMessages = messages.slice(-this.maxHistoryMessages);
        
        // Если есть системное сообщение, добавляем его в начало
        if (systemMessage && systemMessage.role === 'system') {
            return [systemMessage, ...recentMessages];
        }
        
        return recentMessages;
    }

    // Метод для подсчета примерного количества токенов
    estimateTokens(text) {
        // Грубая оценка: 1 токен ≈ 4 символа для русского/английского
        return Math.ceil(text.length / 4);
    }

    // Метод для обрезки длинных сообщений
    truncateLongMessage(message, maxTokens = 500) {
        if (!message.content) return message;
        
        const estimatedTokens = this.estimateTokens(message.content);
        
        if (estimatedTokens > maxTokens) {
            // Обрезаем сообщение до примерно maxTokens токенов
            const maxChars = maxTokens * 4;
            const truncated = message.content.substring(0, maxChars) + 
                `\n\n[Сообщение обрезано... Оригинальная длина: ${estimatedTokens} токенов]`;
            
            return {
                ...message,
                content: truncated
            };
        }
        
        return message;
    }

    async getAIResponse(messages) {
        if (!this.apiConfig.apiKey) {
            throw new Error('API ключ не настроен. Пожалуйста, добавьте ключ в настройках.');
        }

        try {
            console.log('Исходная история сообщений:', messages.length);
            
            // 1. Обрезаем историю до последних N сообщений
            let processedMessages = this.truncateMessageHistory(messages);
            console.log('После обрезки истории:', processedMessages.length);
            
            // 2. Обрезаем слишком длинные сообщения
            processedMessages = processedMessages.map(msg => 
                this.truncateLongMessage(msg, 300) // Обрезаем сообщения длиннее 300 токенов
            );
            
            // 3. Проверяем общий размер запроса
            const totalEstimate = processedMessages.reduce((sum, msg) => 
                sum + this.estimateTokens(msg.content || ''), 0
            );
            
            console.log('Примерный размер запроса в токенах:', totalEstimate);
            
            // Если запрос слишком большой, дополнительно обрезаем
            if (totalEstimate > 1500) {
                console.log('Запрос слишком большой, применяем дополнительную обрезку');
                
                // Оставляем системный промпт и последние 4 сообщения
                const systemMsg = processedMessages[0];
                const lastMessages = processedMessages.slice(-4);
                processedMessages = systemMsg ? [systemMsg, ...lastMessages] : lastMessages;
            }

            const response = await fetch(this.apiConfig.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.apiConfig.model,
                    messages: processedMessages,
                    max_tokens: 300, // Ограничиваем ответ до 300 токенов
                    temperature: this.apiConfig.temperature,
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
            console.log('Ответ API получен');
            
            // Проверяем различные форматы ответа
            let aiResponse = '';
            
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
            
            // Обновляем историю в состоянии приложения, сохраняя только последние сообщения
            if (this.app.state) {
                // Находим последнее сообщение пользователя
                const lastUserMessage = messages.filter(m => m.role === 'user').pop();
                
                if (lastUserMessage) {
                    // Добавляем сообщение пользователя и ответ в историю, но обрезаем старые
                    const updatedHistory = [this.app.createSystemPromptMessage()];
                    
                    // Берем последние 2-4 сообщения из текущей истории
                    const recentMessages = this.app.state.conversationHistory
                        ?.filter(m => m.role !== 'system')
                        .slice(-4) || [];
                    
                    updatedHistory.push(...recentMessages);
                    updatedHistory.push({ role: "user", content: lastUserMessage.content });
                    updatedHistory.push({ role: "assistant", content: aiResponse });
                    
                    // Оставляем только последние 6 сообщений (системный + 5 диалоговых)
                    if (updatedHistory.length > 6) {
                        const systemMsg = updatedHistory[0];
                        const lastFive = updatedHistory.slice(-5);
                        this.app.state.conversationHistory = [systemMsg, ...lastFive];
                    } else {
                        this.app.state.conversationHistory = updatedHistory;
                    }
                }
            }
            
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
        if (!this.apiConfig.apiKey) {
            this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> API ключ не настроен';
            this.elements.apiStatus.style.background = 'rgba(239, 68, 68, 0.15)';
            this.elements.apiStatus.style.color = '#f87171';
            this.app.showNotification('Добавьте API ключ в настройках', 'warning');
            this.state.isApiConnected = false;
            return;
        }

        this.elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i> Проверка API ключа...';
        this.elements.apiStatus.classList.add('api-connecting');
        
        try {
            // Отправляем минимальный тестовый запрос (1-2 токена)
            const response = await fetch(this.apiConfig.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.apiConfig.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 2, // Минимум токенов для проверки
                    temperature: 0.1
                })
            });

            if (response.ok) {
                const data = await response.json();
                
                // Проверяем, что ответ содержит ожидаемые поля
                const hasValidResponse = data.choices && data.choices[0];
                
                if (hasValidResponse) {
                    const selectedModel = this.availableModels.find(m => m.id === this.apiConfig.model);
                    const modelName = selectedModel ? selectedModel.name : this.apiConfig.model;
                    
                    this.elements.apiStatus.innerHTML = `<i class="fas fa-circle"></i> ${modelName}`;
                    this.elements.apiStatus.classList.remove('api-connecting');
                    this.elements.apiStatus.classList.add('api-connected');
                    this.state.isApiConnected = true;
                    
                    this.app.showNotification('API ключ проверен и активен ✅', 'success');
                } else {
                    throw new Error('Неверный формат ответа');
                }
            } else {
                let errorText = '';
                try {
                    const errorData = await response.json();
                    errorText = JSON.stringify(errorData);
                } catch (e) {
                    errorText = await response.text();
                }
                
                this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ошибка API ключа';
                this.elements.apiStatus.classList.remove('api-connecting');
                this.elements.apiStatus.classList.add('api-error');
                this.state.isApiConnected = false;
                
                let userMessage = 'Не удалось подключиться к API. ';
                if (response.status === 401) {
                    userMessage = 'Неверный API ключ. Проверьте ключ в настройках.';
                } else {
                    userMessage += `Код ошибки: ${response.status}`;
                }
                
                this.app.showNotification(userMessage, 'error');
            }
        } catch (error) {
            console.error('API check error:', error);
            
            this.elements.apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ошибка соединения';
            this.elements.apiStatus.classList.remove('api-connecting');
            this.elements.apiStatus.classList.add('api-error');
            this.state.isApiConnected = false;
            
            this.app.showNotification('Не удалось подключиться к серверу API', 'error');
        }
    }

    // ===== Вопросы / дашборд (без изменений) =====

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
                                isDisliked: q.isDisliked ?? false
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
