export class AuthService {
    constructor(app) {
        this.app = app;
    }

    get authConfig() {
        return this.app.AUTH_CONFIG;
    }

    get state() {
        return this.app.state;
    }

    async restoreSession() {
        try {
            const url = `${this.authConfig.baseUrl}${this.authConfig.endpoints.me}`;
            const response = await fetch(url, { credentials: 'include' });
            if (response.ok) {
                const user = await response.json();
                this.setUser(user);
            } else {
                this.setUser(null);
            }
        } catch (e) {
            this.setUser(null);
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
        this.app.updateAuthUI();
        this.app.updateSidebarInfo();
        if (user) {
            setTimeout(() => this.app.loadDashboardData(), 1000);
            this.app.loadUsage().catch(() => {});
        } else {
            this.app.state.usage = null;
            this.app.updateSidebarUsage && this.app.updateSidebarUsage();
        }
    }

    async logout() {
        try {
            const url = `${this.authConfig.baseUrl}${this.authConfig.endpoints.logout}`;
            await fetch(url, { method: 'POST', credentials: 'include' });
        } catch (e) {
            // игнорируем
        }
        this.setUser(null);
        this.app.showNotification('Вы вышли из аккаунта', 'info');
    }

    getAuthHeaders() {
        return {};
    }

    async registerUser({ name, email, password }) {
        const url = `${this.authConfig.baseUrl}${this.authConfig.endpoints.register}`;
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
        const url = `${this.authConfig.baseUrl}${this.authConfig.endpoints.login}`;
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
}

