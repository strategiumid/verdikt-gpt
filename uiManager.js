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
        
        // If a typing-placeholder exists, replace it with the real message so feedback appears immediately
        const typingPlaceholder = document.getElementById('typing-msg');

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
            </div>
            <div class="message-sender">
                <i class="fas fa-${sender === 'user' ? 'user' : 'heart'}"></i> 
                ${sender === 'user' ? 'Вы' : 'Эксперт по отношениям'}
            </div>
            <div class="message-content">${content}</div>
            ${sender !== 'user' ? `
            <div class="message-feedback">
                <button class="feedback-btn feedback-good" onclick="window.verdiktApp.rateMessage('${messageId}', 1)">👍 Было полезно</button>
                <button class="feedback-btn feedback-bad" onclick="window.verdiktApp.rateMessage('${messageId}', -1)">👎 Не было полезно</button>
            </div>
            ` : ''}
            <div class="message-time">${time}</div>
        `;

        if (typingPlaceholder && sender !== 'user') {
            // Replace typing placeholder so the feedback buttons appear immediately next to the new message
            typingPlaceholder.parentNode.replaceChild(messageElement, typingPlaceholder);
        } else {
            this.elements.chatMessages.appendChild(messageElement);
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

        // Render typing indicator as an inline assistant message placeholder
        if (!document.getElementById('typing-msg')) {
            const tpl = document.createElement('div');
            tpl.className = 'message assistant-message typing';
            tpl.id = 'typing-msg';
            tpl.innerHTML = `
                <div class="message-sender">
                    <i class="fas fa-heart"></i> Эксперт по отношениям
                </div>
                <div class="message-content">
                    <div class="typing-content">
                        <div class="typing-dots">
                            <span></span><span></span><span></span>
                        </div>
                        <span class="typing-text">Думаю...</span>
                    </div>
                </div>
            `;

            this.elements.chatMessages.appendChild(tpl);
            requestAnimationFrame(() => {
                tpl.style.opacity = '1';
                tpl.style.transform = 'translateY(0)';
            });
            this.scrollToBottom();
        }
    }

    hideTypingIndicator() {
        const tpl = document.getElementById('typing-msg');
        if (tpl && tpl.parentNode) {
            tpl.parentNode.removeChild(tpl);
        }
        // also hide global indicator if exists
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'none';
        }
    }
}

