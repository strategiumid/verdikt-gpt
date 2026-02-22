// particles.js
export class ParticleSystem {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        // Настройки по умолчанию
        this.options = {
            particleCount: options.particleCount || 150,
            minSize: options.minSize || 0.5,
            maxSize: options.maxSize || 2.5,
            minSpeed: options.minSpeed || 0.02,
            maxSpeed: options.maxSpeed || 0.1,
            colors: options.colors || ['#ffffff', '#f0f0f0', '#e0e0e0'],
            glowIntensity: options.glowIntensity || 0.7,
            interactive: options.interactive !== false,
            performanceMode: options.performanceMode || false,
            ...options
        };
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        this.resizeCanvas();
        this.createParticles();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        const count = this.options.performanceMode ? 
            Math.floor(this.options.particleCount / 2) : 
            this.options.particleCount;
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: this.options.minSize + Math.random() * (this.options.maxSize - this.options.minSize),
                speedX: (Math.random() - 0.5) * this.options.maxSpeed,
                speedY: (Math.random() - 0.5) * this.options.maxSpeed,
                color: this.options.colors[Math.floor(Math.random() * this.options.colors.length)],
                opacity: 0.3 + Math.random() * 0.7,
                twinkleSpeed: 0.5 + Math.random() * 2,
                twinkleOffset: Math.random() * Math.PI * 2,
                layer: Math.random() // Для эффекта глубины
            });
        }
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        if (this.options.interactive) {
            document.addEventListener('mousemove', (e) => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
                
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                
                this.targetX = (this.mouseX - centerX) / centerX * 30;
                this.targetY = (this.mouseY - centerY) / centerY * 30;
            });
            
            // Touch support для мобильных
            document.addEventListener('touchmove', (e) => {
                if (e.touches.length) {
                    this.mouseX = e.touches[0].clientX;
                    this.mouseY = e.touches[0].clientY;
                    
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    
                    this.targetX = (this.mouseX - centerX) / centerX * 20;
                    this.targetY = (this.mouseY - centerY) / centerY * 20;
                }
            }, { passive: true });
        }
        
        // Приватный режим - отключаем сложные эффекты
        const privacyToggle = document.getElementById('privacy-mode-toggle');
        if (privacyToggle) {
            privacyToggle.addEventListener('click', () => {
                this.options.performanceMode = document.body.classList.contains('privacy-mode');
                if (this.options.performanceMode) {
                    this.particles = this.particles.slice(0, Math.floor(this.particles.length / 2));
                } else {
                    this.createParticles();
                }
            });
        }
    }
    
    updateParticles() {
        // Плавное движение камеры (параллакс)
        this.currentX += (this.targetX - this.currentX) * 0.05;
        this.currentY += (this.targetY - this.currentY) * 0.05;
        
        for (let p of this.particles) {
            // Движение частиц
            p.x += p.speedX;
            p.y += p.speedY;
            
            // Мерцание (опционально)
            if (!this.options.performanceMode) {
                p.currentOpacity = p.opacity * (0.7 + 0.3 * Math.sin(Date.now() * 0.001 * p.twinkleSpeed + p.twinkleOffset));
            } else {
                p.currentOpacity = p.opacity;
            }
            
            // Зацикливание по краям
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
        }
    }
    
    drawParticles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Сортируем по слоям для глубины (дальние частицы рисуем первыми)
        const sortedParticles = [...this.particles].sort((a, b) => a.layer - b.layer);
        
        for (let p of sortedParticles) {
            // Применяем параллакс в зависимости от слоя
            const parallaxFactor = 0.2 + p.layer * 0.8;
            const drawX = p.x + this.currentX * parallaxFactor;
            const drawY = p.y + this.currentY * parallaxFactor;
            
            // Рисуем частицу
            this.ctx.beginPath();
            this.ctx.arc(drawX, drawY, p.size, 0, Math.PI * 2);
            
            // Свечение
            if (!this.options.performanceMode) {
                const gradient = this.ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.size * 4);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${p.currentOpacity})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${p.currentOpacity * 0.3})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
            } else {
                // Простой режим - без свечения
                this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
                this.ctx.fill();
            }
            
            // Основная точка
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        }
    }
    
    animate() {
        this.updateParticles();
        this.drawParticles();
        requestAnimationFrame(() => this.animate());
    }
    
    // API для изменения режимов
    setPerformanceMode(enabled) {
        this.options.performanceMode = enabled;
        if (enabled) {
            this.particles = this.particles.slice(0, Math.floor(this.particles.length / 2));
        } else {
            this.createParticles();
        }
    }
    
    setParticleCount(count) {
        this.options.particleCount = count;
        this.createParticles();
    }
}