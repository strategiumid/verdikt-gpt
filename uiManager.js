export class UIManager {
    constructor(app) {
        this.app = app;
    }

    get elements() {
        return this.app.elements;
    }

    get state() {
        return this.app.state;
    }

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

    addMessage(content, sender) {
        const messageId = 'msg-' + Date.now();
        const time = this.app.getCurrentTime();

        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.id = messageId;
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';

        // Кнопки оценки только для AI-сообщений
        let feedbackHtml = '';
        if (sender !== 'user') {
            feedbackHtml = `
                <div class="message-feedback" style="margin-top:8px;display:flex;gap:8px;">
                    <button class="feedback-btn" data-feedback="like" data-msgid="${messageId}" title="Было полезно">
                        <span style="font-size:1.2em;">👍</span>
                    </button>
                    <button class="feedback-btn" data-feedback="dislike" data-msgid="${messageId}" title="Не было полезно">
                        <span style="font-size:1.2em;">👎</span>
                    </button>
                </div>
            `;
        }

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
                <i class="fas fa-${sender === 'user' ? 'user' : 'heart'}"></i> 
                ${sender === 'user' ? 'Вы' : 'Эксперт по отношениям'}
            </div>
            <div class="message-content">${content}</div>
            <div class="message-time">${time}</div>
            ${feedbackHtml}
        `;

        this.elements.chatMessages.appendChild(messageElement);

        // Навешиваем обработчики на кнопки оценки (делегирование)
        if (sender !== 'user') {
            const likeBtn = messageElement.querySelector('.feedback-btn[data-feedback="like"]');
            const dislikeBtn = messageElement.querySelector('.feedback-btn[data-feedback="dislike"]');
            if (likeBtn) {
                likeBtn.addEventListener('click', () => this.app.handleFeedback(messageId, 'like'));
            }
            if (dislikeBtn) {
                dislikeBtn.addEventListener('click', () => this.app.handleFeedback(messageId, 'dislike'));
            }
        }

        requestAnimationFrame(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });

        this.scrollToBottom();
    }

    showModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        el.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        el.classList.remove('active');
        document.body.style.overflow = '';
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    showTypingIndicator() {
        if (this.state.doNotDisturb) return;
        this.elements.typingIndicator.style.display = 'block';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.elements.typingIndicator.style.display = 'none';
    }
}

