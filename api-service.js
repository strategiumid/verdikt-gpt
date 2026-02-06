/**
 * Сервис для работы с API ИИ
 */

class AIService {
    constructor() {
        this.apiEndpoint = 'rsk-or-v1-1bcba95c45222ff3943c6e87f8797666773118b93daaa73f52dba671364633d5';
        this.model = 'tngtech/deepseek-r1t2-chimera:free';
        this.chatHistory = [];
        this.isGenerating = false;
    }

    /**
     * Отправляет сообщение в API и получает ответ
     * @param {string} message - Текст сообщения пользователя
     * @param {Array} history - История предыдущих сообщений
     * @returns {Promise<string>} - Ответ от ИИ
     */
    async sendMessage(message, history = []) {
        if (this.isGenerating) {
            throw new Error('ИИ уже генерирует ответ. Пожалуйста, подождите.');
        }

        this.isGenerating = true;

        try {
            // Формируем сообщения в формате, ожидаемом API
            const messages = [
                ...history.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: message
                }
            ];

            // В реальном приложении здесь будет запрос к вашему API
            // Для демонстрации эмулируем запрос с задержкой
            return await this.mockApiCall(message, history);
            
            // Реальный код для работы с API будет выглядеть примерно так:
            /*
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    max_tokens: 2000,
                    temperature: 0.7,
                    stream: true // Для потокового ответа
                })
            });

            if (!response.ok) {
                throw new Error(`Ошибка API: ${response.status}`);
            }

            // Обработка потокового ответа
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return result;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            result += content;
                            // Можно вызывать callback для отображения частичного ответа
                            if (this.onPartialResponse) {
                                this.onPartialResponse(result);
                            }
                        } catch (e) {
                            console.error('Ошибка парсинга JSON:', e);
                        }
                    }
                }
            }

            return result;
            */
            
        } catch (error) {
            console.error('Ошибка при запросе к API:', error);
            throw error;
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Мок-функция для эмуляции ответа от API
     * @param {string} message - Сообщение пользователя
     * @param {Array} history - История чата
     * @returns {Promise<string>} - Мок-ответ
     */
    async mockApiCall(message, history) {
        // Эмулируем задержку сети
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
        
        // Генерируем разумный ответ в зависимости от запроса
        let response = '';
        
        if (message.toLowerCase().includes('привет') || message.toLowerCase().includes('hello')) {
            response = 'Привет! Я ИИ-ассистент, готовый помочь вам с различными вопросами. Чем могу быть полезен?';
        } else if (message.toLowerCase().includes('код') || message.toLowerCase().includes('программир')) {
            response = `Вот пример кода на Python для решения этой задачи:

\`\`\`python
def example_function():
    """
    Пример функции, демонстрирующей лучшие практики программирования.
    """
    try:
        # Логика функции
        result = 42
        return result
    except Exception as e:
        print(f"Произошла ошибка: {e}")
        return None

# Использование
if __name__ == "__main__":
    value = example_function()
    print(f"Результат: {value}")
\`\`\`

Этот код демонстрирует обработку исключений и использование документации. Нужна ли вам помощь с конкретным языком программирования или фреймворком?`;
        } else if (message.toLowerCase().includes('объясни') || message.toLowerCase().includes('что такое')) {
            response = 'Конечно, объясню эту тему. Основные принципы включают:\n\n1. **Фундаментальные понятия** - базовые элементы, которые нужно понимать\n2. **Принципы работы** - как система функционирует на практике\n3. **Применение** - где и как это используется в реальном мире\n4. **Лучшие практики** - рекомендации по эффективному использованию\n\nМогли бы вы уточнить, какой аспект вас интересует больше всего?';
        } else if (message.toLowerCase().includes('план') || message.toLowerCase().includes('идея')) {
            response = `Отличный запрос! Вот структурированный план:

## Основные этапы:
1. **Подготовительный этап** (1-2 недели)
   - Анализ текущей ситуации
   - Определение целей и задач
   - Сбор необходимой информации

2. **Планирование** (2-3 недели)
   - Разработка детального плана
   - Распределение ресурсов
   - Определение метрик успеха

3. **Реализация** (4-8 недель)
   - Поэтапное выполнение плана
   - Мониторинг прогресса
   - Корректировка при необходимости

4. **Оценка результатов** (1 неделя)
   - Анализ достигнутых результатов
   - Извлечение уроков
   - Планирование следующих шагов

Нужна ли более детальная информация по какому-либо из этапов?`;
        } else {
            // Генерация общего ответа
            const responses = [
                'Я понимаю ваш запрос. Чтобы дать наиболее точный ответ, мне нужно немного больше информации. Можете уточнить детали?',
                'Это интересный вопрос! Основываясь на моих знаниях, могу сказать следующее: решение этой задачи требует системного подхода и тщательного анализа всех факторов.',
                'Спасибо за ваш вопрос. Для полноценного ответа мне нужно учесть несколько аспектов: контекст, цели и ограничения. Могли бы вы предоставить дополнительные детали?',
                'Отличный вопрос! Чтобы дать наиболее полезный ответ, рекомендую рассмотреть несколько подходов и выбрать тот, который лучше всего соответствует вашим потребностям и ресурсам.'
            ];
            
            response = responses[Math.floor(Math.random() * responses.length)];
        }
        
        return response;
    }

    /**
     * Обработка потокового ответа (для реального API)
     * @param {ReadableStream} stream - Поток данных
     * @param {Function} onChunk - Callback для обработки чанков
     * @returns {Promise<string>} - Полный ответ
     */
    async processStream(stream, onChunk) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            return fullResponse;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            
                            if (content) {
                                fullResponse += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            console.warn('Не удалось распарсить chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullResponse;
    }

    /**
     * Извлекает заголовок чата из первого сообщения
     * @param {string} message - Первое сообщение
     * @returns {string} - Заголовок чата
     */
    generateChatTitle(message) {
        const words = message.trim().split(/\s+/);
        
        if (words.length <= 5) {
            return message.length > 50 ? message.substring(0, 50) + '...' : message;
        }
        
        // Генерация заголовка на основе первых слов
        let title = words.slice(0, 4).join(' ');
        if (title.length < 50) {
            title = words.slice(0, 5).join(' ');
        }
        
        return title.length > 50 ? title.substring(0, 50) + '...' : title;
    }

    /**
     * Сохраняет историю чата в localStorage
     * @param {Array} history - История чата
     * @param {string} chatId - ID чата
     */
    saveChatHistory(history, chatId) {
        try {
            const chats = this.getChats();
            const chatIndex = chats.findIndex(chat => chat.id === chatId);
            
            const chatData = {
                id: chatId,
                title: history.length > 0 ? this.generateChatTitle(history[0].content) : 'Новый чат',
                lastMessage: history.length > 0 ? history[history.length - 1].content.substring(0, 100) : '',
                timestamp: Date.now(),
                messageCount: history.length
            };
            
            if (chatIndex >= 0) {
                chats[chatIndex] = chatData;
            } else {
                chats.push(chatData);
            }
            
            localStorage.setItem('ai_chats', JSON.stringify(chats));
            localStorage.setItem(`ai_chat_${chatId}`, JSON.stringify(history));
        } catch (error) {
            console.error('Ошибка при сохранении истории:', error);
        }
    }

    /**
     * Загружает историю чатов из localStorage
     * @returns {Array} - Список чатов
     */
    getChats() {
        try {
            const chats = localStorage.getItem('ai_chats');
            return chats ? JSON.parse(chats) : [];
        } catch (error) {
            console.error('Ошибка при загрузке чатов:', error);
            return [];
        }
    }

    /**
     * Загружает конкретный чат по ID
     * @param {string} chatId - ID чата
     * @returns {Array} - История сообщений
     */
    getChatHistory(chatId) {
        try {
            const history = localStorage.getItem(`ai_chat_${chatId}`);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Ошибка при загрузке истории чата:', error);
            return [];
        }
    }

    /**
     * Удаляет чат
     * @param {string} chatId - ID чата
     */
    deleteChat(chatId) {
        try {
            const chats = this.getChats();
            const filteredChats = chats.filter(chat => chat.id !== chatId);
            localStorage.setItem('ai_chats', JSON.stringify(filteredChats));
            localStorage.removeItem(`ai_chat_${chatId}`);
        } catch (error) {
            console.error('Ошибка при удалении чата:', error);
        }
    }

    /**
     * Очищает все чаты
     */
    clearAllChats() {
        try {
            const chats = this.getChats();
            chats.forEach(chat => {
                localStorage.removeItem(`ai_chat_${chat.id}`);
            });
            localStorage.removeItem('ai_chats');
        } catch (error) {
            console.error('Ошибка при очистке чатов:', error);
        }
    }
}

// Экспортируем экземпляр сервиса
const aiService = new AIService();
