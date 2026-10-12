(function () {
    'use strict';

    const KEY = 'mc_regulatory_chat_history_v1';
    const $ = id => document.getElementById(id);
    let activeId = null;

    function readHistory() {
        try {
            const value = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function saveHistory(items) {
        localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
    }

    function safe(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    function currentChat() {
        return readHistory().find(item => item.id === activeId) || null;
    }

    function renderHistory() {
        const target = $('regChatHistory');
        if (!target) return;
        const items = readHistory();
        if (!items.length) {
            target.innerHTML = '<p class="text-muted">Belum ada percakapan.</p>';
            return;
        }
        target.innerHTML = items.map(item =>
            '<button type="button" class="btn btn-secondary" data-regchat-open="' +
            safe(item.id) + '" style="text-align:left;white-space:normal;' +
            (item.id === activeId ? 'border-color:var(--primary-color,#27836f);' : '') +
            '">' + safe(item.title || 'Percakapan baru') + '</button>'
        ).join('');
    }

    function renderMessages() {
        const target = $('regChatMessages');
        if (!target) return;
        const chat = currentChat();
        if (!chat || !chat.messages.length) {
            target.innerHTML = '<div style="max-width:720px;margin:35px auto;text-align:center;">' +
                '<i class="fa-solid fa-scale-balanced" style="font-size:42px;color:var(--primary-color,#27836f);"></i>' +
                '<h3 style="margin-top:16px;">Apa yang ingin Anda cari?</h3>' +
                '<p class="text-muted">Mulai percakapan regulasi Anda di sini.</p></div>';
            return;
        }
        target.innerHTML = chat.messages.map(message =>
            '<div style="max-width:800px;margin:0 auto 18px;display:flex;justify-content:' +
            (message.role === 'user' ? 'flex-end' : 'flex-start') + ';">' +
            '<div style="max-width:90%;padding:14px 16px;border-radius:14px;' +
            (message.role === 'user'
                ? 'background:var(--primary-color,#27836f);color:white;'
                : 'background:var(--card-bg,#f3f5f4);') +
            'white-space:pre-wrap;overflow-wrap:anywhere;">' + safe(message.text) + '</div></div>'
        ).join('');
        target.scrollTop = target.scrollHeight;
    }

    function newChat() {
        activeId = null;
        renderHistory();
        renderMessages();
        $('regChatPrompt')?.focus();
    }

    function init() {
        if (!$('almara-regulatory-chat-view')) return;

        $('regChatNewButton')?.addEventListener('click', newChat);

        $('regChatHistory')?.addEventListener('click', event => {
            const button = event.target.closest('[data-regchat-open]');
            if (!button) return;
            activeId = button.dataset.regchatOpen;
            renderHistory();
            renderMessages();
        });

        $('regChatForm')?.addEventListener('submit', event => {
            event.preventDefault();
            const input = $('regChatPrompt');
            const question = (input?.value || '').trim();
            if (!question) return;

            const items = readHistory();
            let chat = currentChat();
            if (!chat) {
                chat = {
                    id: (window.crypto?.randomUUID?.() || String(Date.now()) + Math.random()),
                    title: question.slice(0, 55),
                    messages: [],
                    updatedAt: new Date().toISOString()
                };
                activeId = chat.id;
                items.unshift(chat);
            }

            chat.messages.push({ role: 'user', text: question });
            chat.messages.push({
                role: 'assistant',
                text: 'Pertanyaan Anda sudah tercatat di antarmuka chat ini. Mesin AI belum terhubung, dan isi dokumen regulasi belum diekstrak. Karena itu, saya belum dapat memberikan jawaban faktual atau referensi pasal. Tahap berikutnya adalah mengaktifkan ekstraksi dokumen dan integrasi AI agar jawaban dapat disertai sumber yang benar.'
            });
            chat.updatedAt = new Date().toISOString();
            saveHistory(items);
            input.value = '';
            renderHistory();
            renderMessages();
        });

        document.addEventListener('click', event => {
            if (event.target.closest('[data-target="almara-regulatory-chat-view"]')) {
                renderHistory();
                renderMessages();
            }
        });

        renderHistory();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
