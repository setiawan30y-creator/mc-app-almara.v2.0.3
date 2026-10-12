// ==========================================
// MODULE 18: REAL-TIME MULTI-LANGUAGE TRANSLATOR
// ==========================================

(function() {
    let chatLog = [];
    let recognition = null;
    let isListening = false;
    let activeMicBtn = null;
    let currentSpeechUtterance = null;
    let translationTimeout = null;
    let pendingListen = null;
    let translatorInitialized = false;
    let textTranslationRequest = 0;

    // Supported languages config
    const LANGUAGES = [
        { code: 'id-ID', shortCode: 'id', name: 'Indonesia', voiceCode: 'id-ID' },
        { code: 'en-US', shortCode: 'en', name: 'Inggris (English)', voiceCode: 'en-US' },
        { code: 'ar-SA', shortCode: 'ar', name: 'Arab (العربية)', voiceCode: 'ar-SA' },
        { code: 'zh-CN', shortCode: 'zh-CN', name: 'Mandarin (中文)', voiceCode: 'zh-CN' },
        { code: 'ja-JP', shortCode: 'ja', name: 'Jepang (日本語)', voiceCode: 'ja-JP' },
        { code: 'ko-KR', shortCode: 'ko', name: 'Korea (한국어)', voiceCode: 'ko-KR' },
        { code: 'fr-FR', shortCode: 'fr', name: 'Prancis (Français)', voiceCode: 'fr-FR' },
        { code: 'es-ES', shortCode: 'es', name: 'Spanyol (Español)', voiceCode: 'es-ES' },
        { code: 'de-DE', shortCode: 'de', name: 'Jerman (Deutsch)', voiceCode: 'de-DE' },
        { code: 'ru-RU', shortCode: 'ru', name: 'Rusia (Русский)', voiceCode: 'ru-RU' },
        { code: 'hi-IN', shortCode: 'hi', name: 'Hindi (हिन्दी)', voiceCode: 'hi-IN' }
    ];

    // Initialize Translator Module
    function initTranslator() {
        if (translatorInitialized) return;
        translatorInitialized = true;
        // Load default choices from local storage
        const storedLog = localStorage.getItem('mc_trans_chat_log');
        if (storedLog) {
            try { chatLog = JSON.parse(storedLog); } catch(e) { chatLog = []; }
        }

        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => {
                isListening = true;
                if (activeMicBtn) {
                    activeMicBtn.classList.add('mic-active');
                    activeMicBtn.style.animation = 'pulse-red 1.2s infinite';
                    const icon = activeMicBtn.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-microphone-lines';
                }
            };

            recognition.onend = () => {
                isListening = false;
                const completedButton = activeMicBtn;
                if (completedButton) {
                    completedButton.classList.remove('mic-active');
                    completedButton.style.animation = 'none';
                    const icon = completedButton.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-microphone';
                    activeMicBtn = null;
                }
                if (pendingListen) {
                    const nextSession = pendingListen;
                    pendingListen = null;
                    startListening(nextSession.button, nextSession.langCode);
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                isListening = false;
                if (activeMicBtn) {
                    activeMicBtn.classList.remove('mic-active');
                    activeMicBtn.style.animation = 'none';
                    const icon = activeMicBtn.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-microphone';
                    activeMicBtn = null;
                }
                pendingListen = null;
            };

            recognition.onresult = async (event) => {
                const speechResult = event.results[0][0].transcript;
                if (!speechResult) return;

                // Handle output based on which mic button was clicked
                const micId = activeMicBtn ? activeMicBtn.id : '';
                
                if (micId === 'btnTransTextMic') {
                    const sourceInput = document.getElementById('transTextSource');
                    if (sourceInput) {
                        sourceInput.value = speechResult;
                        // Auto-translate
                        translateTextMode();
                    }
                } else if (micId === 'btnTransSpeakMicKasir') {
                    // Kasir speaks Indonesian
                    addChatBubble('kasir', speechResult);
                } else if (micId === 'btnTransSpeakMicNasabah') {
                    // Nasabah speaks foreign language
                    addChatBubble('nasabah', speechResult);
                }
            };
        } else {
            console.warn('Speech Recognition not supported in this browser.');
        }

        // Initialize voices list loading (some browsers load voices asynchronously)
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }

        populateTranslatorSelects();
        renderChatLog();
    }

    // Populate selects with languages
    function populateTranslatorSelects() {
        const selSource = document.getElementById('transLangSource');
        const selTarget = document.getElementById('transLangTarget');
        const selSpeakTarget = document.getElementById('transSpeakLangTarget');

        if (selSource && selTarget) {
            selSource.innerHTML = LANGUAGES.map(l => `<option value="${l.shortCode}">${l.name}</option>`).join('');
            selTarget.innerHTML = LANGUAGES.map(l => `<option value="${l.shortCode}">${l.name}</option>`).join('');
            
            // Set defaults: Source = ID, Target = EN
            selSource.value = localStorage.getItem('mc_trans_lang_src') || 'id';
            selTarget.value = localStorage.getItem('mc_trans_lang_tgt') || 'en';
        }

        if (selSpeakTarget) {
            // Speech target only lists foreign languages
            selSpeakTarget.innerHTML = LANGUAGES.filter(l => l.shortCode !== 'id')
                .map(l => `<option value="${l.code}">${l.name}</option>`).join('');
            
            selSpeakTarget.value = localStorage.getItem('mc_trans_speak_tgt') || 'en-US';
        }
    }

    // Save selected languages
    window.saveTranslatorLanguages = function() {
        const selSource = document.getElementById('transLangSource');
        const selTarget = document.getElementById('transLangTarget');
        const selSpeakTarget = document.getElementById('transSpeakLangTarget');

        if (selSource) localStorage.setItem('mc_trans_lang_src', selSource.value);
        if (selTarget) localStorage.setItem('mc_trans_lang_tgt', selTarget.value);
        if (selSpeakTarget) localStorage.setItem('mc_trans_speak_tgt', selSpeakTarget.value);
    };

    // Swap Source and Target Languages in Text Mode
    window.swapTextLanguages = function() {
        const selSource = document.getElementById('transLangSource');
        const selTarget = document.getElementById('transLangTarget');
        const txtSource = document.getElementById('transTextSource');
        const txtTarget = document.getElementById('transTextTarget');

        if (!selSource || !selTarget || !txtSource || !txtTarget) return;

        // Swap select values
        const tempVal = selSource.value;
        selSource.value = selTarget.value;
        selTarget.value = tempVal;

        // Swap texts
        const tempText = txtSource.value;
        txtSource.value = txtTarget.value;
        txtTarget.value = tempText;

        saveTranslatorLanguages();
        translateTextMode();
    };

    // Google Translate Public API fetch
    async function fetchTranslation(text, sl, tl) {
        if (!text || !text.trim()) return '';
        if (sl === tl) return text;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            if (data && data[0]) {
                let translated = '';
                data[0].forEach(chunk => {
                    if (chunk[0]) translated += chunk[0];
                });
                return translated;
            }
            return '';
        } catch(e) {
            console.error('Translation Fetch Error:', e);
            return 'Gagal menerjemahkan (periksa koneksi internet).';
        }
    }

    // Text Mode Translate action
    window.translateTextMode = async function() {
        const srcInput = document.getElementById('transTextSource');
        const tgtInput = document.getElementById('transTextTarget');
        const sl = document.getElementById('transLangSource')?.value || 'id';
        const tl = document.getElementById('transLangTarget')?.value || 'en';

        if (!srcInput || !tgtInput) return;
        const text = srcInput.value.trim();
        
        if (!text) {
            tgtInput.value = '';
            return;
        }

        const requestId = ++textTranslationRequest;
        tgtInput.value = 'Menerjemahkan...';
        const result = await fetchTranslation(text, sl, tl);
        // Do not overwrite a newer input with an older network response.
        if (requestId !== textTranslationRequest || srcInput.value.trim() !== text) return;
        tgtInput.value = result;

        // Auto-play if enabled
        const autoPlayCheck = document.getElementById('transTextAutoPlay');
        if (autoPlayCheck && autoPlayCheck.checked) {
            speakText(result, tl);
        }
    };

    // Debounced text translation for fluid auto-typing
    window.debounceTranslate = function() {
        clearTimeout(translationTimeout);
        translationTimeout = setTimeout(() => {
            translateTextMode();
        }, 800);
    };

    // Text-to-Speech implementation
    window.speakText = function(text, langShortOrLongCode) {
        if (!window.speechSynthesis) return;
        
        // Cancel active speech
        window.speechSynthesis.cancel();

        if (!text || !text.trim()) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find matching voice
        let langCode = langShortOrLongCode;
        if (langCode.length === 2) {
            const match = LANGUAGES.find(l => l.shortCode === langCode);
            langCode = match ? match.code : langCode;
        }
        
        utterance.lang = langCode;
        
        const voices = window.speechSynthesis.getVoices();
        // Try to match the exact voice code or prefix matching
        const voice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === langCode.toLowerCase().replace('_', '-')) || 
                      voices.find(v => v.lang.toLowerCase().startsWith(langCode.substring(0, 2).toLowerCase()));
        
        if (voice) {
            utterance.voice = voice;
        }

        currentSpeechUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    };

    // Listen to source or target text in Text Mode
    window.speakSourceText = function() {
        const text = document.getElementById('transTextSource')?.value || '';
        const lang = document.getElementById('transLangSource')?.value || 'id';
        speakText(text, lang);
    };

    window.speakTargetText = function() {
        const text = document.getElementById('transTextTarget')?.value || '';
        const lang = document.getElementById('transLangTarget')?.value || 'en';
        speakText(text, lang);
    };

    // Speech-to-Text Voice Recording Trigger
    function startListening(button, langCode) {
        const language = LANGUAGES.find(l => l.code === langCode || l.shortCode === langCode);
        activeMicBtn = button;
        recognition.lang = language ? language.code : langCode;
        try {
            recognition.start();
        } catch (e) {
            // A late browser state update can reject start(); the onend handler
            // remains the single place that cleans up the active button.
            console.error('Failed to start recognition:', e);
        }
    }

    window.toggleSpeechListen = function(buttonId, langCode) {
        if (!recognition) {
            alert('Fitur rekam suara (Speech Recognition) tidak didukung oleh browser ini. Gunakan Google Chrome atau Microsoft Edge.');
            return;
        }

        const button = document.getElementById(buttonId);
        if (!button) return;

        if (isListening) {
            if (activeMicBtn === button) {
                pendingListen = null;
                recognition.stop();
                return;
            }

            // Recognition cannot be restarted until its current session ends.
            // Queue the other speaker and start it from onend instead.
            pendingListen = { button, langCode };
            recognition.stop();
            return;
        }

        startListening(button, langCode);
    };

    // --- Mode Bicara (Percakapan) Logic ---

    // Adds speech results to the chat log and processes translation
    async function addChatBubble(speaker, originalText) {
        const speakLangTargetCode = document.getElementById('transSpeakLangTarget')?.value || 'en-US';
        const langMatch = LANGUAGES.find(l => l.code === speakLangTargetCode);
        const foreignShortCode = langMatch ? langMatch.shortCode : 'en';

        let sourceLang = 'id';
        let targetLang = foreignShortCode;
        let speakLang = speakLangTargetCode;

        if (speaker === 'nasabah') {
            // Nasabah speaks foreign, translated to Indonesian
            sourceLang = foreignShortCode;
            targetLang = 'id';
            speakLang = 'id-ID';
        }

        const bubbleId = 'bubble_' + Date.now();
        const newBubble = {
            id: bubbleId,
            date: new Date().toISOString(),
            speaker: speaker, // 'kasir' or 'nasabah'
            original: originalText,
            translated: 'Menerjemahkan...',
            langCode: speakLang
        };

        chatLog.push(newBubble);
        saveChatLog();
        renderChatLog();
        scrollToBottomChat();

        // Perform translation
        const translatedText = await fetchTranslation(originalText, sourceLang, targetLang);
        
        // Update bubble in log
        const bubble = chatLog.find(b => b.id === bubbleId);
        if (bubble) {
            bubble.translated = translatedText;
            saveChatLog();
            renderChatLog();

            // Auto-play TTS
            const autoPlayCheck = document.getElementById('transSpeakAutoPlay');
            if (autoPlayCheck && autoPlayCheck.checked) {
                speakText(translatedText, speakLang);
            }
        }
    }

    function saveChatLog() {
        localStorage.setItem('mc_trans_chat_log', JSON.stringify(chatLog));
    }

    // Clear conversation log
    window.clearTransChatLog = function() {
        if (confirm('Hapus seluruh log riwayat percakapan?')) {
            chatLog = [];
            saveChatLog();
            renderChatLog();
        }
    };

    // Render conversation list
    function renderChatLog() {
        const container = document.getElementById('transSpeakChatLog');
        if (!container) return;

        if (chatLog.length === 0) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 0.85rem; padding: 40px 10px; text-align: center;">
                    <i class="fa-solid fa-comments" style="font-size: 2.2rem; margin-bottom: 12px; opacity: 0.5; color: #EC4899;"></i>
                    Mulai percakapan dengan mengeklik tombol mikrofon di bawah.<br>Kasir berbicara Indonesia, Nasabah berbicara dalam bahasa pilihan.
                </div>
            `;
            return;
        }

        container.innerHTML = chatLog.map(bubble => {
            const isKasir = bubble.speaker === 'kasir';
            const speakerName = isKasir ? 'Kasir (Kita)' : 'Nasabah';
            const align = isKasir ? 'flex-start' : 'flex-end';
            const bubbleBg = isKasir ? 'rgba(30, 41, 59, 0.95)' : 'rgba(236, 72, 153, 0.12)';
            const borderCol = isKasir ? 'rgba(255,255,255,0.06)' : 'rgba(236, 72, 153, 0.25)';
            const speakerColor = isKasir ? '#38bdf8' : '#EC4899';
            const textAlign = isKasir ? 'left' : 'right';

            return `
                <div style="display: flex; flex-direction: column; align-items: ${align}; width: 100%; margin-bottom: 15px;">
                    <div style="font-size: 0.68rem; font-weight: 700; color: ${speakerColor}; text-transform: uppercase; margin-bottom: 4px; padding: 0 4px;">${speakerName}</div>
                    <div style="max-width: 80%; background: ${bubbleBg}; border: 1px solid ${borderCol}; border-radius: 12px; padding: 10px 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 4px; text-align: ${textAlign};">
                        <!-- Original spoken text -->
                        <span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">"${bubble.original}"</span>
                        <!-- Translated text -->
                        <span style="font-size: 0.92rem; font-weight: 600; color: #f8fafc;">${bubble.translated}</span>
                        <!-- Actions -->
                        <div style="display: flex; gap: 8px; justify-content: ${isKasir ? 'flex-start' : 'flex-end'}; margin-top: 6px; font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 6px;">
                            <span onclick="speakText('${bubble.translated.replace(/'/g, "\\'")}', '${bubble.langCode}')" style="color: #38bdf8; cursor: pointer;" title="Dengarkan suara"><i class="fa-solid fa-volume-high"></i> Play</span>
                            <span onclick="navigator.clipboard.writeText('${bubble.translated.replace(/'/g, "\\'")}')" style="color: #94a3b8; cursor: pointer;" title="Salin teks"><i class="fa-solid fa-copy"></i> Copy</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        scrollToBottomChat();
    }

    function scrollToBottomChat() {
        const container = document.getElementById('transSpeakChatLog');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    // Auto-init
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(initTranslator, 500);
        });
    } else {
        setTimeout(initTranslator, 500);
    }

})();
