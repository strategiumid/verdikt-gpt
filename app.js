import { VerdiktChatApp } from './main.js';

document.addEventListener('DOMContentLoaded', () => {
    if (window.hljs && typeof window.hljs.highlightAll === 'function') {
        window.hljs.highlightAll();
    }

    window.verdiktApp = new VerdiktChatApp();
    window.verdiktApp.init();
});

