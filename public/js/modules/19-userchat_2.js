// ==========================================
// MODULE 19: USER-TO-USER INTERNAL CHAT
// ==========================================

(function() {
    let activeChatType = 'public'; // 'public' or 'private'
    let activeUserId = null;       // null if public
    let activeUserFullName = 'Semua Akun';
    let lastMessageId = 0;
    let globalLastMessageId = 0;
    let isPolling = false;
    let pollInterval = null;

    // Synthesize double-ding audio chime via Web Audio API
    function playChatChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            // Ding 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            gain1.gain.setValueAtTime(0.12, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.15);

            // Ding 2 (slightly higher, delayed by 100ms)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
            gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.1);
            osc2.stop(ctx.currentTime + 0.4);
        } catch(e) {
            console.warn('Chat chime synthesis failed:', e);
        }
    }

    // Initialize module
    function initUserChat() {
        // Find maximum message ID to initialize background polling state
        initializeLastMessageId();

        // Bind events
        const btnSend = document.getElementById('btnSendUserChat');
        if (btnSend) {
            btnSend.addEventListener('click', sendUserChatMessage);
        }

        const inputMsg = document.getElementById('userChatInputMessage');
        if (inputMsg) {
            inputMsg.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') sendUserChatMessage();
            });
        }

        // Start background polling every 5 seconds
        startChatPolling();
        
        // Initial load
        window.loadChatInterface = function() {
            loadChatUsers();
            loadChatMessages(activeChatType, activeUserId);
        };
    }

    // Find the initial maximum message ID in db on startup
    async function initializeLastMessageId() {
        try {
            // We fetch the latest public messages just to get the max ID
            const response = await fetch('/api/user-chats/poll?last_id=0');
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success' && result.data && result.data.length > 0) {
                    const maxId = Math.max(...result.data.map(m => m.id));
                    globalLastMessageId = maxId;
                }
            }
        } catch (e) {
            console.error('Failed to initialize last message ID:', e);
        }
    }

    // Load list of users in sidebar
    async function loadChatUsers() {
        const container = document.getElementById('userChatList');
        if (!container) return;

        try {
            const response = await fetch('/api/user-chats/users');
            if (!response.ok) return;

            const result = await response.json();
            if (result.status !== 'success') return;

            const users = result.data;
            const totalUnread = result.totalUnreadPrivate;

            // Update badge on sidebar menu item
            updateSidebarChatBadge(totalUnread);

            let html = `
                <!-- Group Chat Option -->
                <div onclick="selectChatTarget('public', null, 'Semua Akun')" class="chat-user-item ${activeChatType === 'public' ? 'active' : ''}" style="display: flex; align-items: center; gap: 10px; padding: 12px 15px; border-radius: 8px; cursor: pointer; transition: all 0.2s; margin-bottom: 5px;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(236, 72, 153, 0.15); display: flex; align-items: center; justify-content: center; color: #EC4899; font-weight: bold; border: 1px solid rgba(236, 72, 153, 0.25);">
                        <i class="fa-solid fa-users" style="font-size: 1.1rem;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.88rem; font-weight: 600; color: #f8fafc;">Semua Akun (Grup)</div>
                        <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase;">Saluran Publik</div>
                    </div>
                </div>
                <div style="font-size: 0.68rem; font-weight: 700; color: #475569; text-transform: uppercase; margin: 15px 0 8px; padding-left: 5px; letter-spacing: 0.5px;">Pesan Pribadi (Tellers)</div>
            `;

            users.forEach(u => {
                const isSelected = activeChatType === 'private' && activeUserId === u.id;
                const initials = u.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const roleColor = u.role === 'owner' || u.role === 'superadmin' ? '#ef4444' : (u.role === 'admin' ? '#38bdf8' : '#cbd5e1');
                const photoHtml = u.photo 
                    ? `<img src="${u.photo}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">`
                    : `<div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-weight: bold; border: 1px solid rgba(255,255,255,0.1);">${initials}</div>`;

                const onlineDot = u.isOnline 
                    ? `<div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid #0f172a;" title="Online"></div>`
                    : `<div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: #64748b; border: 2px solid #0f172a;" title="Offline"></div>`;

                const unreadBadge = u.unreadCount > 0 
                    ? `<div style="background: #ef4444; color: #fff; font-size: 0.72rem; font-weight: bold; border-radius: 10px; padding: 2px 7px; min-width: 18px; text-align: center;">${u.unreadCount}</div>`
                    : '';

                html += `
                    <div onclick="selectChatTarget('private', '${u.id}', '${u.fullName}')" class="chat-user-item ${isSelected ? 'active' : ''}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; margin-bottom: 4px; position: relative;">
                        <div style="position: relative;">
                            ${photoHtml}
                            ${onlineDot}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.85rem; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.fullName}</div>
                            <span style="font-size: 0.65rem; font-weight: bold; color: ${roleColor}; text-transform: uppercase;">${u.role}</span>
                        </div>
                        ${unreadBadge}
                    </div>
                `;
            });

            container.innerHTML = html;

        } catch (e) {
            console.error('Failed to load chat users:', e);
        }
    }

    // Update sidebar nav badge counter
    function updateSidebarChatBadge(totalUnread) {
        const navItem = document.querySelector('.nav-item[data-target="user-chat-view"]');
        if (navItem) {
            let badge = navItem.querySelector('.sidebar-badge');
            if (totalUnread > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'sidebar-badge';
                    badge.style.cssText = 'background: #ef4444; color: #fff; font-size: 0.7rem; font-weight: bold; border-radius: 10px; padding: 1px 6px; margin-left: auto;';
                    navItem.appendChild(badge);
                }
                badge.textContent = totalUnread;
            } else {
                if (badge) badge.remove();
            }
        }

        // Update header chat badge counter
        const headerBadge = document.getElementById('chatUnreadHeaderBadge');
        if (headerBadge) {
            if (totalUnread > 0) {
                headerBadge.textContent = totalUnread;
                headerBadge.style.display = 'block';
            } else {
                headerBadge.textContent = '0';
                headerBadge.style.display = 'none';
            }
        }
    }

    // Switch chat room target
    window.selectChatTarget = function(chatType, userId, fullName) {
        activeChatType = chatType;
        activeUserId = userId;
        activeUserFullName = fullName;

        // Reset chat bubble screen
        const chatTitle = document.getElementById('userChatHeaderTitle');
        if (chatTitle) {
            chatTitle.textContent = fullName;
        }

        // Highlight selected item in sidebar list
        const items = document.querySelectorAll('.chat-user-item');
        items.forEach(it => it.classList.remove('active'));

        loadChatUsers(); // Redraws list to highlight
        loadChatMessages(chatType, userId);
    };

    // Load messages list for selected room
    async function loadChatMessages(chatType, otherUserId) {
        const body = document.getElementById('userChatMessagesBody');
        if (!body) return;

        body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #64748b; font-size: 0.85rem;">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Memuat percakapan...
            </div>
        `;

        lastMessageId = 0;

        try {
            const url = `/api/user-chats/messages?chat_type=${chatType}&other_user_id=${otherUserId || ''}&last_id=0`;
            const response = await fetch(url);
            if (!response.ok) return;

            const result = await response.json();
            if (result.status !== 'success') return;

            const messages = result.data;

            if (messages.length === 0) {
                body.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 0.85rem; text-align: center; padding: 20px;">
                        <i class="fa-solid fa-comments" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.4; color: #EC4899;"></i>
                        Belum ada pesan di percakapan ini.<br>Ketik pesan di bawah untuk memulai!
                    </div>
                `;
                return;
            }

            renderMessagesList(messages, false);

            // Update lastMessageId to largest ID in loaded set
            const ids = messages.map(m => m.id);
            if (ids.length > 0) {
                const max = Math.max(...ids);
                lastMessageId = max;
                if (max > globalLastMessageId) {
                    globalLastMessageId = max;
                }
            }

        } catch (e) {
            console.error('Failed to load chat messages:', e);
            body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #ef4444; font-size: 0.85rem;"><i class="fa-solid fa-circle-exclamation" style="margin-right:8px;"></i> Gagal memuat percakapan.</div>`;
        }
    }

    // Render message bubbles in container
    function renderMessagesList(messages, append = false) {
        const body = document.getElementById('userChatMessagesBody');
        if (!body) return;

        const currentUser = getCurrentUser();
        const currentUserId = currentUser ? currentUser.id : '';

        const html = messages.map(m => {
            const isMe = m.sender_id === currentUserId;
            const date = new Date(m.created_at);
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            
            const align = isMe ? 'flex-end' : 'flex-start';
            const bubbleBg = isMe ? '#EC4899' : 'rgba(30, 41, 59, 0.95)';
            const color = isMe ? '#fff' : '#f8fafc';
            const border = isMe ? 'none' : '1px solid rgba(255,255,255,0.06)';
            
            const initials = m.sender_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
            const avatarHtml = m.sender_photo 
                ? `<img src="${m.sender_photo}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.05);" title="${m.sender_name}">`
                : `<div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-size: 0.7rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.05);" title="${m.sender_name}">${initials}</div>`;

            return `
                <div style="display: flex; align-items: flex-end; gap: 8px; justify-content: ${align}; width: 100%; margin-bottom: 12px;">
                    ${!isMe ? avatarHtml : ''}
                    <div style="max-width: 70%; display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                        ${!isMe && activeChatType === 'public' ? `<span style="font-size: 0.68rem; font-weight: 700; color: #38bdf8; margin-bottom: 2px; padding: 0 4px;">${m.sender_name}</span>` : ''}
                        <div style="background: ${bubbleBg}; color: ${color}; border: ${border}; border-radius: ${isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px'}; padding: 8px 12px; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); line-height: 1.4; word-break: break-word;">
                            ${m.message.replace(/\n/g, '<br>')}
                        </div>
                        <span style="font-size: 0.6rem; color: #64748b; margin-top: 3px; padding: 0 4px;">${timeStr}</span>
                    </div>
                    ${isMe ? avatarHtml : ''}
                </div>
            `;
        }).join('');

        if (append) {
            // Remove empty placeholder first if exists
            const placeholder = body.querySelector('.fa-comments')?.parentElement;
            if (placeholder) placeholder.remove();
            
            body.innerHTML += html;
        } else {
            body.innerHTML = html;
        }

        scrollToBottomChat();
    }

    function scrollToBottomChat() {
        const body = document.getElementById('userChatMessagesBody');
        if (body) {
            body.scrollTop = body.scrollHeight;
        }
    }

    // Send message action
    async function sendUserChatMessage() {
        const input = document.getElementById('userChatInputMessage');
        const btn = document.getElementById('btnSendUserChat');
        if (!input || !btn) return;

        const text = input.value.trim();
        if (!text) return;

        // Temporarily disable
        input.disabled = true;
        btn.disabled = true;

        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
            const response = await fetch('/api/user-chats/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf
                },
                body: JSON.stringify({
                    message: text,
                    receiver_id: activeUserId
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    input.value = '';
                    
                    // Append bubble to chat window
                    renderMessagesList([result.data], true);
                    
                    // Update loaded track IDs
                    lastMessageId = result.data.id;
                    if (result.data.id > globalLastMessageId) {
                        globalLastMessageId = result.data.id;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to send chat message:', e);
            alert('Gagal mengirim pesan, periksa jaringan.');
        } finally {
            input.disabled = false;
            btn.disabled = false;
            input.focus();
        }
    }

    // Background polling loop
    function startChatPolling() {
        if (pollInterval) clearInterval(pollInterval);
        
        pollInterval = setInterval(async () => {
            if (isPolling) return;
            isPolling = true;

            try {
                // Poll for new messages that occurred since globalLastMessageId
                const response = await fetch(`/api/user-chats/poll?last_id=${globalLastMessageId}`);
                if (!response.ok) throw new Error('Poll failed');

                const result = await response.json();
                if (result.status === 'success' && result.data && result.data.length > 0) {
                    
                    // Separate messages that fit the open chat window from the ones that don't
                    const currentRoomMessages = [];
                    const otherRoomMessages = [];

                    result.data.forEach(m => {
                        const isMe = false; // Polling endpoint only returns other users' messages
                        const isForActiveRoom = (activeChatType === 'public' && m.receiver_id === null) || 
                                                (activeChatType === 'private' && m.sender_id === activeUserId && m.receiver_id !== null);

                        if (isForActiveRoom) {
                            currentRoomMessages.push(m);
                        } else {
                            otherRoomMessages.push(m);
                        }
                    });

                    // 1. If there are messages for active open room, append them
                    if (currentRoomMessages.length > 0) {
                        // Check if the chat view is currently visible
                        const isChatVisible = !document.getElementById('user-chat-view')?.classList.contains('hidden');
                        
                        if (isChatVisible) {
                            renderMessagesList(currentRoomMessages, true);
                            
                            // Since we received them while looking at them, they are read. Let's mark read.
                            if (activeChatType === 'private') {
                                // Mark as read on DB
                                fetch(`/api/user-chats/messages?chat_type=private&other_user_id=${activeUserId}&last_id=0`);
                            }
                        } else {
                            // If chat is not open but we received messages for the active target, treat as unread/notify
                            currentRoomMessages.forEach(m => showToastChatNotification(m));
                            playChatChime();
                        }
                    }

                    // 2. If there are messages for other rooms (e.g. group chat when viewing private A, or private B when viewing public), notify the user!
                    if (otherRoomMessages.length > 0) {
                        otherRoomMessages.forEach(m => showToastChatNotification(m));
                        playChatChime();
                    }

                    // Redraw user list to show updated badges & online indicators
                    loadChatUsers();

                    // Update global tracker to largest ID received
                    const maxId = Math.max(...result.data.map(m => m.id));
                    if (maxId > globalLastMessageId) {
                        globalLastMessageId = maxId;
                    }
                    if (currentRoomMessages.length > 0 && maxId > lastMessageId) {
                        lastMessageId = maxId;
                    }
                }
            } catch (e) {
                console.warn('Chat polling cycle failed:', e);
            } finally {
                isPolling = false;
            }
        }, 5000);
    }

    // Display floating toast notification at bottom right
    function showToastChatNotification(m) {
        const container = document.getElementById('global-toast-container');
        if (!container) return;

        const toastId = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'chat-toast';
        toast.style.cssText = `
            background: rgba(30, 41, 59, 0.95);
            border: 1px solid rgba(236, 72, 153, 0.3);
            border-left: 4px solid #EC4899;
            border-radius: 8px;
            padding: 12px 16px;
            margin-top: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            width: 290px;
            transform: translateX(350px);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            backdrop-filter: blur(8px);
        `;

        const initials = m.sender_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const avatarHtml = m.sender_photo 
            ? `<img src="${m.sender_photo}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;">`
            : `<div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.05);">${initials}</div>`;

        const isGroup = m.receiver_id === null;
        const subtitle = isGroup ? `mengirim di Grup Semua` : `mengirim pesan pribadi`;

        toast.innerHTML = `
            ${avatarHtml}
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.8rem; font-weight: 700; color: #EC4899; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.sender_name}</div>
                <div style="font-size: 0.65rem; color: #94a3b8; margin-bottom: 2px;">${subtitle}</div>
                <div style="font-size: 0.78rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">"${m.message}"</div>
            </div>
            <button style="background: transparent; border: none; color: #64748b; cursor: pointer; padding: 0 2px;"><i class="fa-solid fa-xmark"></i></button>
        `;

        // Click toast to open chat view and open corresponding conversation
        toast.addEventListener('click', function(e) {
            // If clicked cross button, close
            if (e.target.closest('button')) {
                dismissToast(toast);
                return;
            }

            dismissToast(toast);

            // Switch to chat view
            const navLink = document.querySelector('.nav-item[data-target="user-chat-view"]');
            if (navLink) {
                navLink.click();
            }

            // Select active chat target
            if (isGroup) {
                selectChatTarget('public', null, 'Semua Akun');
            } else {
                selectChatTarget('private', m.sender_id, m.sender_name);
            }
        });

        container.appendChild(toast);

        // Slide in animation
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 50);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
            dismissToast(toast);
        }, 6000);
    }

    function dismissToast(toast) {
        if (!toast) return;
        toast.style.transform = 'translateX(350px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    // Minimize chat view
    window.minimizeUserChat = function() {
        const dashLink = document.querySelector('.nav-item[data-target="dashboard-view"]');
        if (dashLink) {
            dashLink.click();
        }
    };

    // Close chat if clicking outside
    document.addEventListener('click', function(event) {
        const chatView = document.getElementById('user-chat-view');
        // Only minimize if chat view is currently active/visible
        if (!chatView || chatView.classList.contains('hidden')) {
            return;
        }

        // Exclusions:
        // 1. Inside the chat panels (header-panel or main chat box panel)
        const isClickInsideChatPanel = event.target.closest('#user-chat-view .panel');
        if (isClickInsideChatPanel) {
            return;
        }

        // 2. Inside the sidebar navigation
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.contains(event.target)) {
            return;
        }

        // 3. The top header chat icon
        const headerChat = document.querySelector('.header-chat');
        if (headerChat && headerChat.contains(event.target)) {
            return;
        }

        // 4. Mobile sidebar toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle && menuToggle.contains(event.target)) {
            return;
        }

        // 5. Theme switcher
        const themeWrap = document.getElementById('themeSwitcherWrap');
        if (themeWrap && themeWrap.contains(event.target)) {
            return;
        }

        // 6. Inside modals, SweetAlert, or flatpickr
        const isModal = event.target.closest('.modal') || 
                        event.target.closest('.modal-content') || 
                        event.target.closest('.swal2-container') ||
                        event.target.closest('#multiCalculatorModal') || 
                        event.target.closest('.flatpickr-calendar');
        if (isModal) {
            return;
        }

        // Otherwise, minimize to dashboard
        window.minimizeUserChat();
    });

    // Expose sendUserChatMessage globally
    window.sendUserChatMessage = sendUserChatMessage;

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(initUserChat, 600);
        });
    } else {
        setTimeout(initUserChat, 600);
    }
})();
