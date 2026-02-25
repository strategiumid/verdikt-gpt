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

    // ===== routerai.ru API или прокси бэкенда (ключ на сервере) =====

    async getAIResponse(messages, maxTokens = null) {
        const useBackendProxy = this.authConfig.baseUrl && this.state.user;
        if (!useBackendProxy && !this.apiConfig.apiKey) {
            throw new Error('API ключ не настроен или войдите в аккаунт для использования общего ключа.');
        }

    try {
        if (window.VERDIKT_DEBUG) {
            console.log('Отправка запроса к API...', {
                url: useBackendProxy ? (this.authConfig.baseUrl + '/api/chat/completions') : this.apiConfig.url,
                model: this.apiConfig.model,
                messagesCount: messages.length,
                maxTokens: maxTokens || this.apiConfig.maxTokens
            });
        }

        // Добавляем инструкцию по форматированию в последнее сообщение
        const enhancedMessages = [...messages];
        const formatHint = `\n\n[ФОРМАТИРОВАНИЕ: без #, заголовки **жирным**, списки через • или -. Завершай каждую мысль полным предложением; не обрывай ответ на полуслове.]`;
        
        const lastUserMessageIndex = [...enhancedMessages].reverse().findIndex(m => m.role === 'user');
        if (lastUserMessageIndex !== -1) {
            const actualIndex = enhancedMessages.length - 1 - lastUserMessageIndex;
            const lastUserMsg = enhancedMessages[actualIndex];
            const hasFormatHint = (c) => typeof c === 'string' ? c.includes('[ФОРМАТИРОВАНИЕ]') : (Array.isArray(c) && c.some(p => p.type === 'text' && p.text && p.text.includes('[ФОРМАТИРОВАНИЕ]')));
            if (!hasFormatHint(lastUserMsg.content)) {
                if (Array.isArray(lastUserMsg.content)) {
                    const newContent = lastUserMsg.content.map(p => p.type === 'text' ? { ...p, text: (p.text || '') + formatHint } : p);
                    enhancedMessages[actualIndex] = { ...lastUserMsg, content: newContent };
                } else {
                    enhancedMessages[actualIndex] = { ...lastUserMsg, content: lastUserMsg.content + formatHint };
                }
            }
        }
         let response;
        if (useBackendProxy) {
            const baseUrl = (this.authConfig.baseUrl || window.location.origin).replace(/\/$/, '');
            response = await fetch(`${baseUrl}/api/chat/completions`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
                body: JSON.stringify({
                    model: this.apiConfig.model,
                    messages: enhancedMessages,
                    max_tokens: maxTokens || this.apiConfig.maxTokens,
                    temperature: this.apiConfig.temperature,
                    stream: false
                })
            });
        } else {
        response = await fetch(this.apiConfig.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.apiConfig.model,
                messages: enhancedMessages,
                max_tokens: maxTokens || this.apiConfig.maxTokens,
                temperature: this.apiConfig.temperature,
                stream: false
            })
        });
        }

        if (window.VERDIKT_DEBUG) console.log('Статус ответа:', response.status);

        if (!response.ok) {
            let errorMessage = "Ошибка API: ";
            
            try {
                const errorData = await response.json();
                if (window.VERDIKT_DEBUG) console.error('API Error:', errorData);
                if (errorData.error?.message) {
                    errorMessage += errorData.error.message;
                } else if (errorData.message) {
                    errorMessage += errorData.message;
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
        if (window.VERDIKT_DEBUG) console.log('Ответ API получен:', data);

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
            if (window.VERDIKT_DEBUG) console.error('Неизвестный формат ответа:', data);
            throw new Error('Неверный формат ответа от API');
        }
        
        // Пост-обработка ответа: удаляем решетки, если вдруг появились
     aiResponse = aiResponse.replace(/#{1,6}\s*/g, '**'); // Заменяем заголовки с # на жирный текст
        
        if (useBackendProxy) {
            return { content: aiResponse, usedBackendProxy: true };
        }
        return aiResponse;
        
    } catch (error) {
        if (window.VERDIKT_DEBUG) console.error('Error in getAIResponse:', error);

        if (error.message.includes('API ключ') || error.message.includes('401')) {
            throw new Error('Пожалуйста, настройте API ключ в настройках приложения.');
        }
        
        throw error;
    }
}

    async checkApiStatus() {
        if (!this.apiConfig.apiKey) {
            if (this.authConfig.baseUrl && this.state.user) {
                if (this.app.updateHeaderApiStatus) {
                    this.app.updateHeaderApiStatus('connected', 'Чат (ключ на сервере)');
                }
                this.state.isApiConnected = true;
                if (this.app.updateSphereApiState) {
                    this.app.updateSphereApiState('connected');
                }
                return;
            }
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
            const selectedModel = this.availableModels.find(m => m.id === this.apiConfig.model);
            const modelName = selectedModel ? selectedModel.name : this.apiConfig.model;
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
            if (window.VERDIKT_DEBUG) {
                console.log('Проверка API с ключом:', this.apiConfig.apiKey.substring(0, 10) + '...');
                console.log('URL:', this.apiConfig.url);
            }

            // Отправляем тестовый запрос
            const response = await fetch(this.apiConfig.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.apiConfig.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 5,
                    temperature: 0.5
                })
            });

            if (window.VERDIKT_DEBUG) console.log('Статус ответа:', response.status);

            if (response.ok) {
                const data = await response.json();
                if (window.VERDIKT_DEBUG) console.log('Ответ API при проверке:', data);
                
                // Проверяем, что ответ содержит ожидаемые поля
                const hasValidResponse = data.choices && 
                                        data.choices[0] && 
                                        (data.choices[0].message || data.choices[0].text);
                
                if (hasValidResponse) {
                    const selectedModel = this.availableModels.find(m => m.id === this.apiConfig.model);
                    const modelName = selectedModel ? selectedModel.name : this.apiConfig.model;
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
                    if (window.VERDIKT_DEBUG) console.error('Ошибка API:', errorData);
                } catch (e) {
                    errorText = await response.text();
                    if (window.VERDIKT_DEBUG) console.error('Ошибка API (текст):', errorText);
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
            if (window.VERDIKT_DEBUG) console.error('API check error:', error);

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
                    } else if (response.status !== 404 && window.VERDIKT_DEBUG) {
                        console.warn('Не удалось загрузить вопросы с бэкенда', response.status);
                    }
                } catch (e) {
                    if (window.VERDIKT_DEBUG) console.error('Error fetching questions from backend:', e);
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

            if (questions.length > 0) {
                await Promise.all(
                    questions.slice(0, 25).map(q => this.loadQuestionComments(q.id))
                );
            }

            this.app.renderDashboardData();
            this.app.updateSidebarStats();
            
        } catch (error) {
            if (window.VERDIKT_DEBUG) console.error('Error loading dashboard data:', error);
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
            if (window.VERDIKT_DEBUG) console.error('submitDashboardQuestion error:', error);
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
            } else if (res.status !== 404 && window.VERDIKT_DEBUG) {
                console.warn('Не удалось загрузить комментарии', res.status);
            }
        } catch (e) {
            if (window.VERDIKT_DEBUG) console.error('Error loading question comments:', e);
        }

        this.state.questionComments[questionId] = comments;
        return comments;
    }
}
