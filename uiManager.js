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

    addMessage(content, sender, opts = {}) {
        const messageId = 'msg-' + Date.now();
        const time = this.app.getCurrentTime();
        const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const imageHtml = (opts.imageDataUrl) 
            ? `<div class="message-attached-image"><img src="${opts.imageDataUrl.replace(/"/g, '&quot;')}" alt="Скриншот" loading="lazy"></div>` 
            : '';

        // If a typing-placeholder exists, replace it with the real message so feedback appears immediately
        const typingPlaceholder = document.getElementById('typing-msg');

        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.id = messageId;

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
            <div class="message-content">${escapedContent.replace(/\n/g, '<br>')}${imageHtml}</div>
            ${sender !== 'user' ? `
            <div class="message-feedback">
                <button class="feedback-btn feedback-good" onclick="window.verdiktApp.rateMessage('${messageId}', 1)">👍 Полезно</button>
                <button class="feedback-btn feedback-bad" onclick="window.verdiktApp.rateMessage('${messageId}', -1)">👎 Не полезно</button>
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
        
        // Анимация появления в стиле Grok: fade-in + slide-up
        requestAnimationFrame(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
            messageElement.style.transition = 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)';
        });
        
        // Убираем will-change после анимации для производительности
        setTimeout(() => {
            messageElement.style.willChange = 'auto';
        }, 400);
        
        this.scrollToBottom();
        
        // Update questions navigation after adding message
        if (this.app && this.app.updateQuestionsNavigation) {
            setTimeout(() => {
                this.app.updateQuestionsNavigation();
            }, 100);
        }
    }

    showModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        // Удаляем класс closing если он был установлен
        el.classList.remove('closing');
        el.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        // Добавляем класс для анимации закрытия
        el.classList.add('closing');
        const modalContent = el.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.add('closing');
        }
        setTimeout(() => {
            el.classList.remove('active', 'closing');
            if (modalContent) {
                modalContent.classList.remove('closing');
            }
            document.body.style.overflow = '';
        }, 300);
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }
    
    smoothScrollToBottom() {
        const container = this.elements.chatMessages;
        const targetScroll = container.scrollHeight;
        const currentScroll = container.scrollTop;
        const distance = targetScroll - currentScroll;
        
        if (distance < 50) {
            container.scrollTop = targetScroll;
            return;
        }
        
        // Плавная прокрутка с easing
        const duration = Math.min(300, distance * 0.5);
        const startTime = performance.now();
        const startScroll = currentScroll;
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            container.scrollTop = startScroll + (distance * ease);
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };
        
        requestAnimationFrame(animateScroll);
    }

    showTypingIndicator() {
        if (this.state.doNotDisturb) return;

        // Скрываем логотип над полем ввода, когда ИИ начинает печатать
        const heroBlock = document.getElementById('hero-block');
        if (heroBlock) heroBlock.style.display = 'none';
        this.app.syncInputPosition && this.app.syncInputPosition();

        // Проверяем, включен ли режим глубокого размышления
        const isDeepReflection = this.app.state?.deepReflectionMode || false;
        const typingText = isDeepReflection ? 'Глубоко размышляю...' : 'Думаю...';
        const typingClass = isDeepReflection ? 'typing-message-grok deep-reflection-thinking' : 'typing-message-grok';

        // Отдельное сообщение «Думаю...» или «Глубоко размышляю...» в стиле Grok — пока идёт запрос к API
        if (!document.getElementById('typing-msg')) {
            const tpl = document.createElement('div');
            tpl.className = `message ai-message typing ${typingClass}`;
            tpl.id = 'typing-msg';
            tpl.innerHTML = `
                <div class="message-sender">
                    <i class="fas fa-heart"></i> Эксперт по отношениям
                </div>
                <div class="message-content">
                    <div class="typing-content typing-content-grok">
                        <div class="typing-dots typing-dots-grok">
                            <span></span><span></span><span></span>
                        </div>
                        <span class="typing-text ${isDeepReflection ? 'deep-reflection-thinking' : ''}">${typingText}</span>
                    </div>
                </div>
            `;

            this.elements.chatMessages.appendChild(tpl);
            // Анимация появления индикатора печати в стиле Grok
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    tpl.style.opacity = '1';
                    tpl.style.transform = 'translateY(0)';
                    tpl.style.transition = 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)';
                });
            });
            this.smoothScrollToBottom();
        }
    }

    hideTypingIndicator() {
        const tpl = document.getElementById('typing-msg');
        if (tpl && tpl.parentNode) {
            tpl.parentNode.removeChild(tpl);
        }
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'none';
        }
    }

    /** Анимация «Ищу в интернете...» — пока идёт поиск (как «Думаю...»). */
    showSearchingIndicator() {
        if (this.state.doNotDisturb) return;
        const heroBlock = document.getElementById('hero-block');
        if (heroBlock) heroBlock.style.display = 'none';
        this.app.syncInputPosition && this.app.syncInputPosition();
        if (document.getElementById('searching-msg')) return;
        const tpl = document.createElement('div');
        tpl.className = 'message ai-message typing typing-message-grok searching-message';
        tpl.id = 'searching-msg';
        tpl.innerHTML = `
            <div class="message-sender">
                <i class="fas fa-globe"></i> Эксперт по отношениям
            </div>
            <div class="message-content">
                <div class="typing-content typing-content-grok typing-content-search">
                    <div class="typing-dots typing-dots-grok searching-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <span class="typing-text typing-text-search">Ищу в интернете...</span>
                </div>
            </div>
        `;
        this.elements.chatMessages.appendChild(tpl);
        // Анимация появления индикатора поиска в стиле Grok
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                tpl.style.opacity = '1';
                tpl.style.transform = 'translateY(0)';
                tpl.style.transition = 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)';
            });
        });
        this.smoothScrollToBottom();
    }

    hideSearchingIndicator() {
        const tpl = document.getElementById('searching-msg');
        if (tpl && tpl.parentNode) {
            tpl.parentNode.removeChild(tpl);
        }
    }
}

