// ==========================================
// MODULE 16: CHAT AI & CURRENCY DETECTOR
// ==========================================

(function() {
    let chatSessions = [];
    let activeSessionId = '';
    window._chatUploadedImageBase64 = '';
    window._chatUploadedImageName = '';

    // Initialize state
    function initChat() {
        const stored = localStorage.getItem('mc_ai_chat_sessions');
        if (stored) {
            try {
                chatSessions = JSON.parse(stored);
            } catch(e) {
                chatSessions = [];
            }
        }

        if (!Array.isArray(chatSessions) || chatSessions.length === 0) {
            chatSessions = [
                {
                    id: 'session_welcome',
                    title: 'Asisten AI Baru',
                    messages: [
                        { sender: 'ai', text: 'Halo! Saya adalah **Asisten AI Almara**. Unggah gambar uang kertas atau koin untuk dideteksi asal negaranya, nominalnya, atau tanyakan apa saja seputar transaksi valas dan keuangan.' }
                    ]
                }
            ];
            localStorage.setItem('mc_ai_chat_sessions', JSON.stringify(chatSessions));
        }

        activeSessionId = chatSessions[0]?.id || 'session_welcome';
        renderSessionsList();
        renderActiveSessionMessages();
        loadGeminiSettings();
    }

    function saveSessions() {
        localStorage.setItem('mc_ai_chat_sessions', JSON.stringify(chatSessions));
    }

    // Settings Configuration
    window.saveAISettings = function() {
        const providerInput = document.getElementById('settingsAiProvider');
        const geminiInput = document.getElementById('settingsGeminiKey');
        const openAiInput = document.getElementById('settingsOpenAiKey');
        const openAiModelInput = document.getElementById('settingsOpenAiModel');

        localStorage.setItem('mc_ai_provider', providerInput?.value || 'gemini');
        localStorage.setItem('mc_gemini_api_key', geminiInput?.value.trim() || '');
        localStorage.setItem('mc_openai_api_key', openAiInput?.value.trim() || '');
        localStorage.setItem('mc_openai_model', openAiModelInput?.value.trim() || 'gpt-4o-mini');
        alert('Pengaturan Asisten AI berhasil disimpan.');
    };

    window.saveGeminiSettings = window.saveAISettings;

    window.loadGeminiSettings = function() {
        const providerInput = document.getElementById('settingsAiProvider');
        const geminiInput = document.getElementById('settingsGeminiKey');
        const openAiInput = document.getElementById('settingsOpenAiKey');
        const openAiModelInput = document.getElementById('settingsOpenAiModel');
        if (providerInput) providerInput.value = localStorage.getItem('mc_ai_provider') || 'gemini';
        if (geminiInput) geminiInput.value = localStorage.getItem('mc_gemini_api_key') || '';
        if (openAiInput) openAiInput.value = localStorage.getItem('mc_openai_api_key') || '';
        if (openAiModelInput) openAiModelInput.value = localStorage.getItem('mc_openai_model') || 'gpt-4o-mini';
    };

    // Render left panel session list
    function renderSessionsList() {
        const container = document.getElementById('ai-chat-sessions-list');
        if (!container) return;

        container.innerHTML = chatSessions.map(session => {
            const isActive = session.id === activeSessionId;
            return `
                <div class="chat-session-item ${isActive ? 'active' : ''}" 
                     style="padding: 10px 12px; border-radius: 8px; background: ${isActive ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isActive ? '#EC4899' : 'rgba(255,255,255,0.05)'}; cursor: pointer; display: flex; align-items: center; justify-content: space-between;"
                     onclick="switchChatSession('${session.id}')">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                        <i class="fa-solid fa-comments" style="color: ${isActive ? '#EC4899' : '#64748b'};"></i>
                        <span style="font-size: 0.82rem; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${session.title}</span>
                    </div>
                    ${session.id !== 'session_welcome' ? `<i class="fa-solid fa-trash-can" style="font-size: 0.75rem; color: #64748b; cursor: pointer;" onclick="event.stopPropagation(); deleteChatSession('${session.id}')"></i>` : ''}
                </div>
            `;
        }).join('');
    }

    window.switchChatSession = function(sessionId) {
        activeSessionId = sessionId;
        renderSessionsList();
        renderActiveSessionMessages();
    };

    window.startNewChatSession = function() {
        const id = 'session_' + Date.now();
        const title = prompt('Masukkan Judul Obrolan Baru:', 'Analisis Valas Baru');
        if (title === null) return; // Cancelled
        
        const newSession = {
            id: id,
            title: (title.trim() || 'Obrolan Baru'),
            messages: [
                { sender: 'ai', text: 'Silakan ketik pertanyaan Anda atau unggah gambar uang kertas/koin untuk dianalisis.' }
            ]
        };
        chatSessions.unshift(newSession);
        activeSessionId = id;
        saveSessions();
        renderSessionsList();
        renderActiveSessionMessages();
    };

    window.deleteChatSession = function(sessionId) {
        if (confirm('Hapus sesi obrolan ini dari riwayat?')) {
            chatSessions = chatSessions.filter(s => s.id !== sessionId);
            if (activeSessionId === sessionId) {
                activeSessionId = chatSessions[0]?.id || 'session_welcome';
            }
            saveSessions();
            renderSessionsList();
            renderActiveSessionMessages();
        }
    };

    // Render active messages
    function renderActiveSessionMessages() {
        const container = document.getElementById('ai-chat-messages-container');
        if (!container) return;

        const session = chatSessions.find(s => s.id === activeSessionId);
        if (!session) return;

        let html = '';
        session.messages.forEach(msg => {
            const isAi = msg.sender === 'ai';
            html += `
                <div class="chat-message-row" style="display: flex; flex-direction: column; align-items: ${isAi ? 'flex-start' : 'flex-end'}; width: 100%;">
                    <div class="chat-bubble" style="
                        max-width: 75%; 
                        padding: 12px 16px; 
                        border-radius: 12px; 
                        line-height: 1.5;
                        font-size: 0.88rem;
                        background: ${isAi ? 'rgba(30, 41, 59, 0.45)' : 'rgba(236, 72, 153, 0.12)'}; 
                        border: 1px solid ${isAi ? 'rgba(255,255,255,0.06)' : 'rgba(236, 72, 153, 0.25)'}; 
                        color: ${isAi ? '#cbd5e1' : '#f8fafc'};
                    ">
                        <!-- If message contains uploaded image -->
                        ${msg.image ? `
                            <div style="margin-bottom: 10px; max-width: 300px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15);">
                                <img src="${msg.image}" style="width: 100%; height: auto; display: block;">
                            </div>
                        ` : ''}
                        
                        <!-- Text formatted in simple markdown -->
                        <div>${formatMarkdownText(msg.text)}</div>
                    </div>
                    <span style="font-size: 0.65rem; color: #64748b; margin-top: 4px; margin-left: 4px; margin-right: 4px;">
                        ${isAi ? 'Asisten AI' : 'Anda'}
                    </span>
                </div>
            `;
        });

        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    // Markdown simple text formatter (bold, bullet points, newline)
    function formatMarkdownText(str) {
        let clean = String(str || '');
        // Bold
        clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Bullet points
        clean = clean.replace(/^\s*-\s+(.+)$/gm, '<li style="margin-left: 20px;">$1</li>');
        // Paragraphs / Newlines
        clean = clean.replace(/\n/g, '<br>');
        return clean;
    }

    // Image Upload Handlers
    window.triggerChatImageUpload = function() {
        const input = document.getElementById('ai-chat-image-input');
        if (input) input.click();
    };

    window.handleChatImageUpload = function(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                window._chatUploadedImageBase64 = e.target.result;
                window._chatUploadedImageName = file.name;

                // Show preview container
                const previewContainer = document.getElementById('ai-chat-image-preview-container');
                const thumbnail = document.getElementById('ai-chat-image-thumbnail');
                const nameLabel = document.getElementById('ai-chat-image-name');

                if (previewContainer && thumbnail && nameLabel) {
                    thumbnail.style.backgroundImage = `url(${e.target.result})`;
                    thumbnail.style.backgroundSize = 'cover';
                    thumbnail.style.backgroundPosition = 'center';
                    nameLabel.textContent = file.name;
                    previewContainer.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    window.removeChatUploadedImage = function() {
        window._chatUploadedImageBase64 = '';
        window._chatUploadedImageName = '';
        
        const previewContainer = document.getElementById('ai-chat-image-preview-container');
        const input = document.getElementById('ai-chat-image-input');
        if (previewContainer) previewContainer.classList.add('hidden');
        if (input) input.value = '';
    };

    // Chat Enter trigger
    window.handleChatEnter = function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendChatMessage();
        }
    };

    // Send chat message
    window.sendChatMessage = async function() {
        const textInput = document.getElementById('ai-chat-text-input');
        if (!textInput) return;

        const text = textInput.value.trim();
        const image = window._chatUploadedImageBase64;
        const imageName = window._chatUploadedImageName;

        if (!text && !image) return;

        const session = chatSessions.find(s => s.id === activeSessionId);
        if (!session) return;

        // 1. Append user message to DOM and state
        session.messages.push({
            sender: 'user',
            text: text || 'Mengunggah gambar untuk dianalisis.',
            image: image || null
        });
        saveSessions();
        renderActiveSessionMessages();

        // Clear inputs immediately
        textInput.value = '';
        removeChatUploadedImage();

        // 2. Add Typing Indicator
        const container = document.getElementById('ai-chat-messages-container');
        const typingId = 'typing_' + Date.now();
        const typingHtml = `
            <div id="${typingId}" class="chat-message-row animate-pulse" style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                <div class="chat-bubble" style="
                    max-width: 75%; 
                    padding: 12px 16px; 
                    border-radius: 12px; 
                    background: rgba(30, 41, 59, 0.45); 
                    border: 1px solid rgba(255,255,255,0.06); 
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fa-solid fa-circle-notch fa-spin" style="color: #EC4899;"></i>
                    <span>AI sedang berpikir...</span>
                </div>
            </div>
        `;
        if (container) {
            container.insertAdjacentHTML('beforeend', typingHtml);
            container.scrollTop = container.scrollHeight;
        }

        // 3. Make Server Request
        const provider = localStorage.getItem('mc_ai_provider') || 'gemini';
        const geminiKey = localStorage.getItem('mc_gemini_api_key') || '';
        const openAiKey = localStorage.getItem('mc_openai_api_key') || '';
        const openAiModel = localStorage.getItem('mc_openai_model') || 'gpt-4o-mini';
        const apiKey = provider === 'openai' ? openAiKey : geminiKey;
        
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-AI-Provider': provider,
                    'X-Gemini-Key': geminiKey,
                    'X-OpenAI-Key': openAiKey,
                    'X-OpenAI-Model': openAiModel
                },
                body: JSON.stringify({
                    message: text,
                    image: image || null
                })
            });

            // Remove typing indicator
            const typingIndicator = document.getElementById(typingId);
            if (typingIndicator) typingIndicator.remove();

            if (response.ok) {
                const data = await response.json();
                session.messages.push({
                    sender: 'ai',
                    text: data.reply
                });
                saveSessions();
                renderActiveSessionMessages();
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errMessage = errorData.message || 'Gagal menghubungi server.';

                // Check if missing key trigger to run in SIMULATION failsafe mode
                if (response.status === 400 && !apiKey) {
                    runChatSimulation(session, text, image, imageName);
                } else {
                    session.messages.push({
                        sender: 'ai',
                        text: `⚠️ **Gagal memproses pesan.**\n\nDetail: ${errMessage}`
                    });
                    saveSessions();
                    renderActiveSessionMessages();
                }
            }
        } catch(error) {
            console.error('AI Chat error:', error);
            const typingIndicator = document.getElementById(typingId);
            if (typingIndicator) typingIndicator.remove();

            if (!apiKey) {
                runChatSimulation(session, text, image, imageName);
            } else {
                session.messages.push({
                    sender: 'ai',
                    text: `⚠️ **Koneksi terputus.** Gagal mengirim pesan ke server. Periksa koneksi internet Anda.`
                });
                saveSessions();
                renderActiveSessionMessages();
            }
        }
    };

    // Chat Simulation Failsafe (Runs offline/if key is missing)
    function runChatSimulation(session, text, image, imageName) {
        setTimeout(() => {
            let simulatedReply = '';

            if (image) {
                const nameClean = String(imageName || '').toLowerCase();
                if (nameClean.includes('usd') || nameClean.includes('dolar') || nameClean.includes('dollar')) {
                    simulatedReply = `⚠️ **[MODE SIMULASI]** Kunci API Gemini belum diatur di Pengaturan.\n\nHasil deteksi gambar:
- File name: **${imageName}**
- Deteksi Uang: **100 USD (United States Dollar)**
- Pecahan: **Seratus Dolar**
- Negara Asal: **Amerika Serikat**
- Seri/Desain: **Desain Baru (Benjamin Franklin)**
- Status Keaslian: **Tampak Asli** berdasarkan resolusi kertas dan benang pengaman.
                    
*Untuk mendeteksi secara nyata dengan kecerdasan buatan Gemini, silakan daftarkan Gemini API Key gratis Anda di menu Pengaturan > Asisten AI.*`;
                } else if (nameClean.includes('sgd') || nameClean.includes('singapore')) {
                    simulatedReply = `⚠️ **[MODE SIMULASI]** Kunci API Gemini belum diatur di Pengaturan.\n\nHasil deteksi gambar:
- File name: **${imageName}**
- Deteksi Uang: **10 SGD (Singapore Dollar)**
- Pecahan: **Sepuluh Dolar Singapura**
- Negara Asal: **Singapura**
- Gambar Tokoh: **Yusof bin Ishak**
- Status Keaslian: **Tampak Asli** (Bahan polimer khas Singapura).

*Untuk mendeteksi secara nyata dengan kecerdasan buatan Gemini, silakan daftarkan Gemini API Key gratis Anda di menu Pengaturan > Asisten AI.*`;
                } else if (nameClean.includes('idr') || nameClean.includes('rupiah') || nameClean.includes('indo')) {
                    simulatedReply = `⚠️ **[MODE SIMULASI]** Kunci API Gemini belum diatur di Pengaturan.\n\nHasil deteksi gambar:
- File name: **${imageName}**
- Deteksi Uang: **100.000 IDR (Indonesian Rupiah)**
- Pecahan: **Seratus Ribu Rupiah**
- Negara Asal: **Indonesia**
- Seri Emisi: **2022 (Soekarno-Hatta)**
- Status Keaslian: **Tampak Asli** dengan warna merah terang khas uang Rupiah emisi baru.

*Untuk mendeteksi secara nyata dengan kecerdasan buatan Gemini, silakan daftarkan Gemini API Key gratis Anda di menu Pengaturan > Asisten AI.*`;
                } else {
                    simulatedReply = `⚠️ **[MODE SIMULASI]** Kunci API Gemini belum diatur di Pengaturan.\n\nHasil deteksi gambar:
- File name: **${imageName}**
- Deteksi Uang: **Mata Uang Tidak Dikenal (Simulasi)**
- Negara Asal: **Tidak terdeteksi**
- Catatan: Gambar Anda terunggah dengan baik ke server kasir lokal, namun pemindai AI belum bisa memprosesnya karena API Key Gemini kosong.

*Silakan daftarkan Gemini API Key gratis Anda di menu Pengaturan > Asisten AI untuk mengaktifkan pemindai cerdas.*`;
                }
            } else {
                // Text prompt simulation
                const textLower = text.toLowerCase();
                if (textLower.includes('saham') || textLower.includes('indeks') || textLower.includes('ihsg') || textLower.includes('dow jones')) {
                    simulatedReply = `📊 **[MODE SIMULASI] Ringkasan Indeks Saham Terbaru:**
                    
- **IHSG (Indonesia)**: Berada di level **7.125,50 (+0,45%)**. Pasar saham domestik menguat didorong oleh aliran dana asing pada sektor perbankan dan kestabilan nilai tukar Rupiah.
- **Dow Jones (AS)**: Ditutup pada level **39.120,80 (+0,12%)**. Penguatan tipis terjadi seiring spekulasi investor terhadap kebijakan pemotongan suku bunga The Fed pada semester kedua.
- **Nikkei 225 (Jepang)**: Berada di level **38.590,00 (-0,32%)**, tertekan oleh aksi ambil untung pada sektor teknologi.
- **Hang Seng (Hong Kong)**: Naik ke level **18.020,40 (+0,85%)** menyusul stimulus baru di sektor properti China.

*Catatan: Ini adalah tanggapan simulasi. Hubungkan Gemini API Key di Pengaturan untuk mendapatkan analisis pasar ter-update secara real-time.*`;
                } else if (textLower.includes('bitcoin') || textLower.includes('btc') || textLower.includes('crypto') || textLower.includes('kripto')) {
                    simulatedReply = `🪙 **[MODE SIMULASI] Laporan Harga & Analisis Bitcoin (BTC):**
                    
- **Harga BTC/USD**: **$65.230,00**
- **Harga BTC/IDR**: Sekitar **Rp 1.075.000.000** (menggunakan asumsi kurs Rp 16.480)
- **Rentang Harian**: $64.100 - $65.850
- **Analisis Teknis Singkat**:
  - Bitcoin saat ini berada dalam fase konsolidasi setelah mengalami penurunan dari rekor tertinggi.
  - Level **Support Kuat** berada di kisaran **$64.000**. Jika mampu bertahan, berpeluang rebound menuju resistance terdekat.
  - Level **Resistance Utama** berada di kisaran **$67.000** dan selanjutnya **$69.500**.
  - Volume perdagangan cenderung stabil menjelang penutupan mingguan.

*Catatan: Ini adalah tanggapan simulasi. Hubungkan Gemini API Key di Pengaturan untuk mendapatkan harga crypto live.*`;
                } else if (textLower.includes('antam') || textLower.includes('emas') || textLower.includes('lm')) {
                    simulatedReply = `✨ **[MODE SIMULASI] Harga Emas Logam Mulia (LM) Antam Hari Ini:**
                    
- **Harga Jual (Pecahan 1 gram)**: **Rp 1.365.000 / gram**
- **Harga Buyback (Beli Kembali oleh Antam)**: **Rp 1.260.000 / gram**
- **Rincian Harga per Pecahan**:
  - Pecahan 0.5 gram: Rp 732.500
  - Pecahan 5 gram: Rp 6.600.000
  - Pecahan 10 gram: Rp 13.145.000
  - Pecahan 50 gram: Rp 65.395.000
  - Pecahan 100 gram: Rp 130.712.000
  
*Catatan: Harga emas batangan LM Antam belum termasuk pajak PPh 22 sebesar 0,25% bagi pemegang NPWP pada transaksi buyback. Ini adalah simulasi. Konfigurasikan Gemini API Key untuk harga live.*`;
                } else if (textLower.includes('perak') || textLower.includes('silver')) {
                    simulatedReply = `🥈 **[MODE SIMULASI] Laporan Harga Perak (Silver 99.9%) Hari Ini:**
                    
- **Harga Jual (Pecahan 1 gram)**: **Rp 16.200 / gram**
- **Harga Buyback (Beli Kembali)**: **Rp 14.500 / gram**
- **Tren Pasar**: Harga perak dunia bergerak di kisaran **$29,50 per troy ounce**. Permintaan industri (seperti panel surya dan elektronik) menopang harga perak tetap di level premium meskipun emas sedang fluktuatif.

*Catatan: Ini adalah tanggapan simulasi. Hubungkan Gemini API Key di Pengaturan untuk update komoditas real-time.*`;
                } else if (textLower.includes('analisis kurs') || textLower.includes('tren valas') || textLower.includes('kurs kedepan') || (textLower.includes('kurs') && (textLower.includes('analisis') || textLower.includes('prospek')))) {
                    simulatedReply = `💱 **[MODE SIMULASI] Laporan & Analisis Prospek Kurs Valas Utama:**

1. **USD (Dolar AS) - Tren Menguat (Bullish)**
   - **Kisaran Prospek**: Beli **Rp 16.390 - Rp 16.430** / Jual **Rp 16.480 - Rp 16.530**
   - **Analisis & Prediksi**: Indeks Dolar AS (DXY) masih kokoh di kisaran 105,4 seiring sikap Bank Sentral AS (The Fed) yang menunda pemangkasan suku bunga. Rupiah diprediksi masih akan mengalami tekanan jangka pendek. Cocok untuk simpanan defensif.

2. **SGD (Dolar Singapura) - Stabil Kokoh (Neutral-Bullish)**
   - **Kisaran Prospek**: Beli **Rp 12.060 - Rp 12.110** / Jual **Rp 12.160 - Rp 12.210**
   - **Analisis & Prediksi**: Kebijakan apresiasi nilai tukar dari MAS Singapura menjaga SGD tetap kuat terhadap Rupiah. Likuiditas SGD sangat kuat dan prospeknya stabil hingga akhir bulan.

3. **EUR (Euro) - Tren Konsolidasi Melemah (Bearish)**
   - **Kisaran Prospek**: Beli **Rp 17.480 - Rp 17.530** / Jual **Rp 17.620 - Rp 17.700**
   - **Analisis & Prediksi**: Euro tertekan sentimen politik Eropa pasca pemilu parlemen dan suku bunga ECB yang sudah mulai dipangkas. Prediksi ke depan menunjukkan Euro cenderung sideways terhadap Rupiah.

4. **AUD (Dolar Australia) - Volatilitas Tinggi (Neutral-Bearish)**
   - **Kisaran Prospek**: Beli **Rp 10.820 - Rp 10.890** / Jual **Rp 10.950 - Rp 11.020**
   - **Analisis & Prediksi**: Sangat dipengaruhi pergerakan harga komoditas global. Jika data manufaktur China membaik, AUD berpotensi rebound. Namun, saat ini masih dibayangi aksi ambil untung investor global.

*Catatan: Ini adalah analisis prospek simulasi harian. Daftarkan Gemini API Key Anda di Pengaturan > Asisten AI untuk mendapatkan diskusi pasar real-time.*`;
                } else if (textLower.includes('kurs') || textLower.includes('rate')) {
                    simulatedReply = `Halo! Di KUPVA Almara, kurs hari ini diatur di menu **Kurs Hari Ini** atau dikelola di **Manajemen Kurs**.
Mata uang utama saat ini:
- **USD**: Beli Rp 16.410 / Jual Rp 16.490
- **SGD**: Beli Rp 12.080 / Jual Rp 12.180
- **EUR**: Beli Rp 17.510 / Jual Rp 17.680
- **AUD**: Beli Rp 10.880 / Jual Rp 10.980

*Catatan: Ini adalah data simulasi. Pasang Kunci API Gemini Anda di menu Pengaturan > Asisten AI untuk diskusi interaktif.*`;
                } else if (textLower.includes('halo') || textLower.includes('hi') || textLower.includes('pagi') || textLower.includes('siang')) {
                    simulatedReply = `Halo! Ada yang bisa saya bantu untuk operasional kasir Money Changer hari ini? Anda bisa menanyakan cara transaksi, ciri uang palsu, atau mengupload foto mata uang.

*(Untuk asisten AI real-time, silakan konfigurasikan Gemini API Key Anda di Pengaturan)*`;
                } else {
                    simulatedReply = `Saya menerima pertanyaan Anda: *"${text}"*\n\nSaat ini saya berjalan dalam **Mode Simulasi** (tanpa internet/API Key). Saya adalah robot kasir lokal. 

Untuk mengaktifkan asisten AI yang dapat berdiskusi cerdas mengenai valuta asing, mendeteksi detail gambar uang kertas/koin palsu secara akurat, silakan masukkan **Gemini API Key** Anda pada **Pengaturan > Asisten AI**.`;
                }
            }

            session.messages.push({
                sender: 'ai',
                text: simulatedReply
            });
            saveSessions();
            renderActiveSessionMessages();
        }, 1200);
    }

    // Helper to send prompt from quick suggestions
    window.sendSuggestedPrompt = function(promptText) {
        const textInput = document.getElementById('ai-chat-text-input');
        if (!textInput) return;
        textInput.value = promptText;
        window.sendChatMessage();
    };

    // Auto-init on page load or script load
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(initChat, 500);
        });
    } else {
        setTimeout(initChat, 500);
    }

})();
