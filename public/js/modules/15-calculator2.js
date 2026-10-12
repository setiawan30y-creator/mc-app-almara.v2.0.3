// ==========================================
// MODULE 15: FLOATING MULTI-ROW TAPE CALCULATOR
// ==========================================

(function() {
    let sheets = [];
    let activeSheetId = 'sheet_1';
    let isMinimized = false;
    let calcGlobalMode = 'BELI'; // 'BELI' or 'JUAL'

    // Helper to clean operator of quotes and spaces
    function cleanOperator(op) {
        return String(op || '').replace(/['"`“”‘’]/g, '').trim().toUpperCase();
    }

    // Initialize State
    function initCalc() {
        // Load global mode
        calcGlobalMode = localStorage.getItem('mc_calc_global_mode') || 'BELI';
        updateModeButtonsUI();

        const stored = localStorage.getItem('mc_calculator_sheets');
        if (stored) {
            try {
                sheets = JSON.parse(stored);
                // Sanitize legacy operators to prevent any quoting or case mismatches
                sheets.forEach(sheet => {
                    if (sheet && Array.isArray(sheet.rows)) {
                        sheet.rows.forEach(row => {
                            if (row.operator) {
                                row.operator = cleanOperator(row.operator);
                            }
                        });
                    }
                });
                saveCalcState();
            } catch(e) {
                sheets = [];
            }
        }
        if (!Array.isArray(sheets) || sheets.length === 0) {
            sheets = [
                {
                    id: 'sheet_1',
                    name: 'Lembar 1',
                    rows: [
                        { id: 'row_1', operator: '+', mode: 'kustom', valString: '150000', label: 'Kas Laci', checked: true },
                        { id: 'row_2', operator: '+', mode: 'valas', currencyCode: 'USD', amountString: '100', rateString: '15650', valString: '1565000', label: 'Beli Dolar', checked: true },
                        { id: 'row_3', operator: '-', mode: 'kustom', valString: '5000', label: 'Diskon', checked: true }
                    ]
                }
            ];
            saveCalcState();
        }

        activeSheetId = sheets[0]?.id || 'sheet_1';

        // Bind drag element
        const calcEl = document.getElementById('floating-multi-calculator');
        const headerEl = calcEl?.querySelector('.calc-header');
        if (calcEl && headerEl) {
            dragElement(calcEl, headerEl);
        }
        
        renderTabs();
        renderActiveSheet();
    }

    function saveCalcState() {
        localStorage.setItem('mc_calculator_sheets', JSON.stringify(sheets));
    }

    // Drag helper
    function dragElement(elmnt, header) {
        var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        if (header) {
            header.onmousedown = dragMouseDown;
        } else {
            elmnt.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('.btn') || e.target.closest('button')) {
                return;
            }
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            let newTop = elmnt.offsetTop - pos2;
            let newLeft = elmnt.offsetLeft - pos1;
            
            if (newTop < 0) newTop = 0;
            if (newLeft < 0) newLeft = 0;
            if (newTop > window.innerHeight - 50) newTop = window.innerHeight - 50;
            if (newLeft > window.innerWidth - 100) newLeft = window.innerWidth - 100;

            elmnt.style.top = newTop + "px";
            elmnt.style.left = newLeft + "px";
            elmnt.style.bottom = 'auto';
            elmnt.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Safe Math Evaluation
    function evaluateMathExpression(str) {
        const clean = String(str || '').replace(/[^0-9+\-*/().\s]/g, '');
        if (!clean.trim()) return 0;
        try {
            const result = new Function(`return (${clean})`)();
            return isNaN(result) || !isFinite(result) ? 0 : result;
        } catch(e) {
            return 0;
        }
    }

    // Toggle calculator open/close
    window.toggleMultiCalculator = function() {
        const calcEl = document.getElementById('floating-multi-calculator');
        if (!calcEl) return;
        if (calcEl.classList.contains('hidden')) {
            calcEl.classList.remove('hidden');
            if (calcEl.style.top === '' && calcEl.style.left === '') {
                calcEl.style.bottom = '80px';
                calcEl.style.right = '20px';
                calcEl.style.top = 'auto';
                calcEl.style.left = 'auto';
            }
            initCalc();
        } else {
            calcEl.classList.add('hidden');
        }
    };

    // Minimize calculator to header only
    window.toggleMinimizeCalculator = function() {
        const contentEl = document.getElementById('calc-expandable-content');
        const calcEl = document.getElementById('floating-multi-calculator');
        if (!contentEl || !calcEl) return;

        isMinimized = !isMinimized;
        if (isMinimized) {
            contentEl.style.display = 'none';
            calcEl.style.height = 'auto';
            calcEl.style.maxHeight = '48px';
        } else {
            contentEl.style.display = 'flex';
            calcEl.style.height = 'auto';
            calcEl.style.maxHeight = '500px';
            renderActiveSheet();
        }
    };

    // Global Mode Toggle (BELI / JUAL)
    window.setCalcGlobalMode = function(mode) {
        calcGlobalMode = mode;
        localStorage.setItem('mc_calc_global_mode', mode);
        updateModeButtonsUI();

        // Update all valas rows across all sheets with the new active rates
        const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
        sheets.forEach(sheet => {
            sheet.rows.forEach(row => {
                if (row.mode === 'valas') {
                    const cur = currencies.find(c => c.code === row.currencyCode);
                    if (cur) {
                        row.rateString = String(calcGlobalMode === 'BELI' ? (cur.buy || 0) : (cur.sell || 0));
                        // Re-evaluate row total
                        const amt = evaluateMathExpression(row.amountString || '0');
                        const rate = evaluateMathExpression(row.rateString || '0');
                        row.valString = String(amt * rate);
                    }
                }
            });
        });

        saveCalcState();
        renderActiveSheet();
    };

    function updateModeButtonsUI() {
        const btnBeli = document.getElementById('btn-calc-mode-beli');
        const btnJual = document.getElementById('btn-calc-mode-jual');

        if (btnBeli && btnJual) {
            if (calcGlobalMode === 'BELI') {
                btnBeli.style.background = '#10b981'; // Green
                btnBeli.style.color = '#ffffff';
                btnJual.style.background = 'transparent';
                btnJual.style.color = '#94a3b8';
            } else {
                btnJual.style.background = '#ef4444'; // Red
                btnJual.style.color = '#ffffff';
                btnBeli.style.background = 'transparent';
                btnBeli.style.color = '#94a3b8';
            }
        }
    }

    // Tabs rendering
    function renderTabs() {
        const tabsList = document.getElementById('calc-tabs-list');
        if (!tabsList) return;

        tabsList.innerHTML = sheets.map(sheet => {
            const isActive = sheet.id === activeSheetId;
            return `
                <div class="calc-tab ${isActive ? 'active' : ''}" 
                     style="padding: 6px 12px; font-size: 0.8rem; font-weight: 600; border-radius: 6px 6px 0 0; background: ${isActive ? 'rgba(30, 41, 59, 0.95)' : 'rgba(30, 41, 59, 0.4)'}; border: 1px solid rgba(255,255,255,0.08); border-bottom: none; cursor: pointer; color: ${isActive ? '#38bdf8' : '#94a3b8'}; display: flex; align-items: center; gap: 6px;"
                     onclick="switchCalcSheet('${sheet.id}')"
                     ondblclick="renameCalcSheet('${sheet.id}')">
                    <span id="tab-name-${sheet.id}">${sheet.name}</span>
                    ${sheets.length > 1 ? `<i class="fa-solid fa-xmark" style="font-size:0.7rem; color:#ef4444; margin-left: 4px;" onclick="event.stopPropagation(); deleteCalcSheet('${sheet.id}')"></i>` : ''}
                </div>
            `;
        }).join('');
    }

    window.switchCalcSheet = function(sheetId) {
        activeSheetId = sheetId;
        renderTabs();
        renderActiveSheet();
    };

    window.addNewCalcSheet = function() {
        const id = 'sheet_' + Date.now();
        const num = sheets.length + 1;
        const newSheet = {
            id: id,
            name: 'Lembar ' + num,
            rows: [
                { id: 'row_' + Date.now(), operator: '+', mode: 'kustom', valString: '0', label: 'Mulai', checked: true }
            ]
        };
        sheets.push(newSheet);
        activeSheetId = id;
        saveCalcState();
        renderTabs();
        renderActiveSheet();
    };

    window.deleteCalcSheet = function(sheetId) {
        if (sheets.length <= 1) return;
        if (confirm('Hapus lembar kalkulasi ini?')) {
            sheets = sheets.filter(s => s.id !== sheetId);
            if (activeSheetId === sheetId) {
                activeSheetId = sheets[0].id;
            }
            saveCalcState();
            renderTabs();
            renderActiveSheet();
        }
    };

    window.renameCalcSheet = function(sheetId) {
        const span = document.getElementById('tab-name-' + sheetId);
        if (!span) return;
        const currentName = span.textContent;
        const newName = prompt('Ubah nama lembar:', currentName);
        if (newName && newName.trim()) {
            const sheet = sheets.find(s => s.id === sheetId);
            if (sheet) {
                sheet.name = newName.trim();
                saveCalcState();
                renderTabs();
            }
        }
    };

    // Render Rows inside Active Sheet
    function renderActiveSheet() {
        const container = document.getElementById('calc-sheet-content');
        if (!container) return;

        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;

        const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];

        // Grid Header
        let rowsHtml = `
            <div class="calc-row-header" style="display: grid; grid-template-columns: 20px 55px 85px 65px 75px 80px 1fr 20px; gap: 5px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-bottom: 8px; font-size: 0.65rem; font-weight: bold; color: #94a3b8; text-transform: uppercase; text-align: center;">
                <span></span>
                <span>Tipe</span>
                <span>Valuta</span>
                <span>Nom/Qty</span>
                <span>Kurs</span>
                <span>Hasil Rp</span>
                <span style="text-align: left; padding-left: 4px;">Catatan</span>
                <span></span>
            </div>
        `;

        sheet.rows.forEach((row, index) => {
            const isValas = row.mode === 'valas';
            const cur = isValas ? currencies.find(c => c.code === row.currencyCode) : null;
            const op = cleanOperator(row.operator);

            // Generate options HTML for dropdown selector
            const dropdownOptions = `
                <option value="kustom" ${!isValas ? 'selected' : ''}>IDR (Kustom)</option>
                ${currencies.map(c => `
                    <option value="${c.code}" ${isValas && row.currencyCode === c.code ? 'selected' : ''}>
                        ${c.code}
                    </option>
                `).join('')}
            `;

            // Calculate Subtotal for this row
            let rowSubtotal = 0;
            if (row.mode === 'valas') {
                const amt = evaluateMathExpression(row.amountString || '0');
                const rate = evaluateMathExpression(row.rateString || '0');
                rowSubtotal = amt * rate;
            } else {
                rowSubtotal = evaluateMathExpression(row.valString);
            }

            rowsHtml += `
                <div class="calc-row-item" style="display: grid; grid-template-columns: 20px 55px 85px 65px 75px 80px 1fr 20px; gap: 5px; margin-bottom: 8px; align-items: center;">
                    <!-- Row Checkbox -->
                    <input type="checkbox" class="calc-row-check" ${row.checked ? 'checked' : ''} onchange="toggleRowActive('${row.id}', this.checked)" style="cursor: pointer; margin: 0; width: 14px; height: 14px; align-self: center; justify-self: center;">

                    <!-- Tipe / Operator Select -->
                    <select onchange="updateRowOperator('${row.id}', this.value)" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; border-radius: 4px; padding: 2px 4px; font-weight: bold; width: 55px; font-size: 0.72rem; height: 26px;">
                        <option value="BELI" ${op === 'BELI' ? 'selected' : ''} style="color:#34d399;">BELI</option>
                        <option value="JUAL" ${op === 'JUAL' ? 'selected' : ''} style="color:#f87171;">JUAL</option>
                        <option value="+" ${op === '+' ? 'selected' : ''}>+</option>
                        <option value="-" ${op === '-' ? 'selected' : ''}>-</option>
                    </select>

                    <!-- Valuta Dropdown (Keterangan) -->
                    <select onchange="updateRowModeOrCurrency('${row.id}', this.value)" style="width: 85px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.1); color: #38bdf8; border-radius: 4px; padding: 2px 4px; font-size: 0.72rem; height: 26px; font-weight: 600;">
                        ${dropdownOptions}
                    </select>

                    <!-- Render Input Fields based on mode -->
                    ${!isValas ? `
                        <!-- Kustom Rupiah Input -->
                        <input type="text" value="${row.valString}" 
                               onblur="updateRowValue('${row.id}', this.value)" 
                               onkeypress="handleRowEnter(event, '${row.id}', this.value)"
                               placeholder="Nominal" 
                               style="width: 65px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 4px; padding: 4px; font-size: 0.72rem; height: 26px;">
                    ` : `
                        <!-- Valas Amount (Qty) Input -->
                        <input type="text" value="${row.amountString || '1'}" 
                               onblur="updateRowAmount('${row.id}', this.value)" 
                               onkeypress="handleRowEnter(event, '${row.id}', this.value)"
                               placeholder="Jumlah" 
                               style="width: 65px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 4px; padding: 4px; font-size: 0.72rem; height: 26px; text-align: center;">
                    `}

                    <!-- Kurs Column -->
                    ${!isValas ? `
                        <span style="color: #64748b; font-size: 0.75rem; text-align: center; display: block; height: 26px; line-height: 26px;">—</span>
                    ` : `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
                            <!-- Buy/Sell rate badges directly above -->
                            <div style="display: flex; gap: 4px; font-size: 0.55rem; font-weight: bold; margin-bottom: 2px; line-height: 1.1;">
                                <span onclick="updateRowRate('${row.id}', '${cur ? cur.buy : 0}')" style="color: #34d399; cursor: pointer; background: rgba(52, 211, 153, 0.15); padding: 0px 3px; border-radius: 3px;" title="Klik untuk gunakan Kurs Beli">B:${cur ? Math.round(cur.buy || 0).toLocaleString('id-ID') : 0}</span>
                                <span onclick="updateRowRate('${row.id}', '${cur ? cur.sell : 0}')" style="color: #f87171; cursor: pointer; background: rgba(248, 113, 113, 0.15); padding: 0px 3px; border-radius: 3px;" title="Klik untuk gunakan Kurs Jual">J:${cur ? Math.round(cur.sell || 0).toLocaleString('id-ID') : 0}</span>
                            </div>
                            <input type="text" value="${row.rateString || '0'}" 
                                   onblur="updateRowRate('${row.id}', this.value)" 
                                   placeholder="Kurs" 
                                   style="width: 75px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; border-radius: 4px; padding: 4px; font-size: 0.72rem; height: 26px; text-align: center; line-height: 1;">
                        </div>
                    `}

                    <!-- Hasil Perkalian (Subtotal Baris) -->
                    <span style="font-size: 0.72rem; font-weight: 700; color: #38bdf8; text-align: right; display: block; line-height: 26px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Rp ${Math.round(rowSubtotal).toLocaleString('id-ID')}">
                        Rp ${Math.round(rowSubtotal).toLocaleString('id-ID')}
                    </span>

                    <!-- Text Note input -->
                    <input type="text" value="${row.label || ''}" 
                           onchange="updateRowLabel('${row.id}', this.value)" 
                           placeholder="Catatan..." 
                           style="width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; border-radius: 4px; padding: 4px; font-size: 0.72rem; height: 26px;">

                    <!-- Delete Row Button -->
                    <button onclick="deleteRow('${row.id}')" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 0.78rem; height: 26px; display: flex; align-items: center; justify-content: center; width: 100%;" title="Hapus baris"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
        });

        rowsHtml += `
            <button class="btn btn-sm btn-outline mt-2" onclick="addNewRow()" style="padding: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.75rem; border: 1px dashed rgba(255,255,255,0.15); width: 100%; color: #94a3b8;"><i class="fa-solid fa-plus-circle"></i> Tambah Baris Baru</button>
        `;

        container.innerHTML = rowsHtml;
        calculateTotals();
    }

    // Dropdown Mode & Currency change
    window.updateRowModeOrCurrency = function(rowId, val) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (!row) return;

        if (val === 'kustom') {
            row.mode = 'kustom';
            row.currencyCode = '';
            row.valString = '0';
            const cleanOp = cleanOperator(row.operator);
            if (cleanOp === 'BELI' || cleanOp === 'JUAL') {
                row.operator = '+'; // Default to + for manual Rupiah
            }
        } else {
            row.mode = 'valas';
            row.currencyCode = val;
            
            // Set operator to match row's current operator if it's BELI or JUAL, else fallback to global mode
            const cleanOp = cleanOperator(row.operator);
            if (cleanOp !== 'BELI' && cleanOp !== 'JUAL') {
                row.operator = calcGlobalMode;
            }
            
            // Set rate automatically based on row operator (BELI or JUAL)
            const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
            const cur = currencies.find(c => c.code === val);
            row.rateString = String(cur ? (cleanOperator(row.operator) === 'BELI' ? (cur.buy || 0) : (cur.sell || 0)) : 0);
            
            if (!row.amountString || row.amountString === '0') {
                row.amountString = '1';
            }
            
            // Recalculate valString
            const amt = evaluateMathExpression(row.amountString);
            const rate = evaluateMathExpression(row.rateString);
            row.valString = String(amt * rate);
        }

        saveCalcState();
        renderActiveSheet();
    };

    // Valas amount & rate updates
    window.updateRowAmount = function(rowId, amountStr) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (row) {
            row.amountString = amountStr;
            const amt = evaluateMathExpression(amountStr);
            const rate = evaluateMathExpression(row.rateString || '0');
            row.valString = String(amt * rate);
            
            saveCalcState();
            calculateTotals();
        }
    };

    window.updateRowRate = function(rowId, rateStr) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (row) {
            row.rateString = rateStr;
            const amt = evaluateMathExpression(row.amountString || '0');
            const rate = evaluateMathExpression(rateStr);
            row.valString = String(amt * rate);
            
            saveCalcState();
            calculateTotals();
        }
    };

    // Row property updates
    window.toggleRowActive = function(rowId, isChecked) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (row) {
            row.checked = isChecked;
            saveCalcState();
            calculateTotals();
        }
    };

    window.updateRowOperator = function(rowId, op) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (row) {
            row.operator = cleanOperator(op);
            const cleanedOp = row.operator;
            
            // Handle automatic updates when operator changes
            if (row.mode === 'valas' && row.currencyCode) {
                const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
                const cur = currencies.find(c => c.code === row.currencyCode);
                if (cur) {
                    row.rateString = String(cleanedOp === 'BELI' ? (cur.buy || 0) : (cur.sell || 0));
                    
                    const amt = evaluateMathExpression(row.amountString || '0');
                    const rate = evaluateMathExpression(row.rateString || '0');
                    row.valString = String(amt * rate);
                }
            } else if ((cleanedOp === '+' || cleanedOp === '-') && row.mode === 'valas') {
                // If switching operator to +/- for a valas row, convert it to manual Rupiah
                row.mode = 'kustom';
                row.valString = row.valString || '0';
            } else if ((cleanedOp === 'BELI' || cleanedOp === 'JUAL') && row.mode === 'kustom') {
                // If switching operator to BELI/JUAL for a manual Rupiah row, convert to USD default
                row.mode = 'valas';
                row.currencyCode = 'USD';
                const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
                const cur = currencies.find(c => c.code === 'USD');
                row.rateString = String(cur ? (cleanedOp === 'BELI' ? (cur.buy || 0) : (cur.sell || 0)) : 0);
                row.amountString = '1';
                row.valString = row.rateString;
            }
            
            saveCalcState();
            renderActiveSheet();
        }
    };

    window.updateRowValue = function(rowId, valStr) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (row) {
            row.valString = valStr;
            saveCalcState();
            calculateTotals();
        }
    };

    window.handleRowEnter = function(event, rowId, valStr) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (document.activeElement) document.activeElement.blur(); // Trigger save on blur
            addNewRow();
        }
    };

    window.updateRowLabel = function(rowId, labelStr) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        const row = sheet.rows.find(r => r.id === rowId);
        if (row) {
            row.label = labelStr;
            saveCalcState();
        }
    };

    window.addNewRow = function() {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        sheet.rows.push({
            id: 'row_' + Date.now() + '_' + Math.floor(Math.random()*100),
            operator: cleanOperator(calcGlobalMode === 'JUAL' ? 'JUAL' : 'BELI'),
            mode: 'kustom',
            valString: '0',
            label: '',
            checked: true
        });
        saveCalcState();
        renderActiveSheet();
        
        setTimeout(() => {
            const container = document.getElementById('calc-sheet-content');
            const inputs = container?.querySelectorAll('input[type="text"]');
            if (inputs && inputs.length >= 1) {
                // Focus on the input of the last row
                inputs[inputs.length - 2].focus();
                inputs[inputs.length - 2].select();
            }
        }, 50);
    };

    window.deleteRow = function(rowId) {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;
        if (sheet.rows.length <= 1) {
            sheet.rows = [{ id: 'row_' + Date.now(), operator: '+', mode: 'kustom', valString: '0', label: '', checked: true }];
        } else {
            sheet.rows = sheet.rows.filter(r => r.id !== rowId);
        }
        saveCalcState();
        renderActiveSheet();
    };

    // Calculate totals of current sheet (Total Beli, Total Jual, and Selisih Kurang/Lebih)
    function calculateTotals() {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;

        let totalBeli = 0;
        let totalJual = 0;

        sheet.rows.forEach(row => {
            let val = 0;
            if (row.mode === 'valas') {
                const amt = evaluateMathExpression(row.amountString || '0');
                const rate = evaluateMathExpression(row.rateString || '0');
                val = amt * rate;
                row.valString = String(val); // Keep updated internally
            } else {
                val = evaluateMathExpression(row.valString);
            }
            
            if (row.checked) {
                const op = cleanOperator(row.operator);
                if (op === 'BELI' || op === '-') {
                    totalBeli += val;
                } else if (op === 'JUAL' || op === '+') {
                    totalJual += val;
                } else if (op === '*') {
                    totalJual = totalJual * val;
                } else if (op === '/') {
                    if (val !== 0) totalJual = totalJual / val;
                }
            }
        });

        const formatRupiah = (val) => {
            return 'Rp ' + Math.round(Math.abs(val) || 0).toLocaleString('id-ID');
        };

        const totalBeliEl = document.getElementById('calc-total-beli');
        const totalJualEl = document.getElementById('calc-total-jual');
        const selisihLabelEl = document.getElementById('calc-selisih-label');
        const selisihValEl = document.getElementById('calc-selisih-val');

        if (totalBeliEl) totalBeliEl.textContent = formatRupiah(totalBeli);
        if (totalJualEl) totalJualEl.textContent = formatRupiah(totalJual);

        const selisih = totalJual - totalBeli;

        if (selisihLabelEl && selisihValEl) {
            if (selisih > 0) {
                selisihLabelEl.textContent = 'NASABAH KURANG:';
                selisihLabelEl.style.color = '#f87171'; // Red
                selisihValEl.textContent = formatRupiah(selisih);
                selisihValEl.style.color = '#f87171';
            } else if (selisih < 0) {
                selisihLabelEl.textContent = 'KITA BAYAR (LEBIH):';
                selisihLabelEl.style.color = '#34d399'; // Green
                selisihValEl.textContent = formatRupiah(selisih);
                selisihValEl.style.color = '#34d399';
            } else {
                selisihLabelEl.textContent = 'SELISIH AKHIR:';
                selisihLabelEl.style.color = '#94a3b8';
                selisihValEl.textContent = 'Rp 0';
                selisihValEl.style.color = '#38bdf8';
            }
        }

        const widget = document.getElementById('floating-multi-calculator');
        if (widget) {
            // Send the net absolute amount for POS injection
            widget.setAttribute('data-total', Math.abs(selisih));
        }
    }

    // Split selected rows into a new sheet
    window.splitSelectedRows = function() {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;

        const checkBoxes = document.querySelectorAll('.calc-row-check');
        const checkedRowIds = [];
        sheet.rows.forEach((row, i) => {
            if (checkBoxes[i] && checkBoxes[i].checked) {
                checkedRowIds.push(row.id);
            }
        });

        if (checkedRowIds.length === 0) {
            alert('Silakan centang setidaknya satu baris untuk dipisahkan.');
            return;
        }

        if (checkedRowIds.length === sheet.rows.length) {
            alert('Tidak bisa memindahkan semua baris. Sisakan minimal satu baris di lembar ini.');
            return;
        }

        const splitRows = sheet.rows.filter(r => checkedRowIds.includes(r.id));
        sheet.rows = sheet.rows.filter(r => !checkedRowIds.includes(r.id));

        const newId = 'sheet_' + Date.now();
        const newSheet = {
            id: newId,
            name: 'Pecahan ' + (sheets.length + 1),
            rows: splitRows
        };

        sheets.push(newSheet);
        activeSheetId = newId;
        saveCalcState();
        renderTabs();
        renderActiveSheet();
        alert('Baris terpilih berhasil dipisah ke lembar baru: ' + newSheet.name);
    };

    // Merge current total into another sheet
    window.mergeToOtherSheetPrompt = function() {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;

        const otherSheets = sheets.filter(s => s.id !== activeSheetId);
        if (otherSheets.length === 0) {
            alert('Tidak ada lembar lain untuk digabungkan. Silakan buat lembar baru terlebih dahulu.');
            return;
        }

        const listStr = otherSheets.map((s, idx) => `${idx + 1}. ${s.name}`).join('\n');
        const chosen = prompt(`Masukkan total lembar "${sheet.name}" ke lembar tujuan.\nPilih nomor lembar tujuan:\n${listStr}`);
        if (!chosen) return;

        const idx = parseInt(chosen) - 1;
        if (isNaN(idx) || idx < 0 || idx >= otherSheets.length) {
            alert('Pilihan tidak valid.');
            return;
        }

        const targetSheet = otherSheets[idx];
        const widget = document.getElementById('floating-multi-calculator');
        const total = parseFloat(widget?.getAttribute('data-total') || '0');

        targetSheet.rows.push({
            id: 'row_' + Date.now(),
            operator: '+',
            mode: 'kustom',
            valString: String(total),
            label: 'Total dari ' + sheet.name,
            checked: true
        });

        saveCalcState();
        activeSheetId = targetSheet.id;
        renderTabs();
        renderActiveSheet();
        alert(`Berhasil menggabungkan total ke lembar "${targetSheet.name}"`);
    };

    // Copy Summary Tape to Clipboard
    window.copyCalcSummary = function() {
        const sheet = sheets.find(s => s.id === activeSheetId);
        if (!sheet) return;

        let txt = `=== RINCIAN KALKULASI (${sheet.name.toUpperCase()}) ===\n`;
        let totalBeli = 0;
        let totalJual = 0;

        sheet.rows.forEach(row => {
            let val = 0;
            let rowText = '';
            const op = cleanOperator(row.operator);

            if (row.mode === 'valas') {
                const amt = evaluateMathExpression(row.amountString || '0');
                const rate = evaluateMathExpression(row.rateString || '0');
                val = amt * rate;
                rowText = `${op} ${amt.toLocaleString('id-ID')} ${row.currencyCode} @ ${rate.toLocaleString('id-ID')} = Rp ${val.toLocaleString('id-ID')}`;
            } else {
                val = evaluateMathExpression(row.valString);
                rowText = `${op} Rp ${val.toLocaleString('id-ID')}`;
            }

            if (row.checked) {
                if (op === 'BELI' || op === '-') {
                    totalBeli += val;
                } else if (op === 'JUAL' || op === '+') {
                    totalJual += val;
                }
            }

            const labelStr = row.label ? ` [${row.label}]` : '';
            const statusStr = row.checked ? '' : ' (Tidak dihitung)';
            txt += `${rowText}${labelStr}${statusStr}\n`;
        });

        const selisih = totalJual - totalBeli;
        txt += `--------------------------------------\n`;
        txt += `Total Beli (Kita Bayar): Rp ${Math.round(totalBeli).toLocaleString('id-ID')}\n`;
        txt += `Total Jual (Kita Terima): Rp ${Math.round(totalJual).toLocaleString('id-ID')}\n`;
        if (selisih > 0) {
            txt += `SELISIH AKHIR (Nasabah Kurang): Rp ${Math.round(selisih).toLocaleString('id-ID')}\n`;
        } else if (selisih < 0) {
            txt += `SELISIH AKHIR (Kita Bayar Lebih): Rp ${Math.round(Math.abs(selisih)).toLocaleString('id-ID')}\n`;
        } else {
            txt += `SELISIH AKHIR: Rp 0\n`;
        }

        navigator.clipboard.writeText(txt).then(() => {
            alert('Rincian lembar kalkulasi berhasil disalin ke clipboard!');
        }).catch(err => {
            console.error('Gagal menyalin teks:', err);
        });
    };

    // Send Calculator Total to Active POS view
    window.sendCalcTotalToPos = function() {
        const widget = document.getElementById('floating-multi-calculator');
        if (!widget) return;
        const total = Math.round(parseFloat(widget.getAttribute('data-total') || '0'));

        const posView = document.getElementById('pos-view');
        if (!posView || posView.classList.contains('hidden')) {
            navigator.clipboard.writeText(String(total)).then(() => {
                alert(`Hasil kalkulator (Rp ${total.toLocaleString('id-ID')}) telah disalin ke clipboard. Silakan buka halaman POS untuk menempelkannya.`);
            });
            return;
        }

        const cashReceivedInput = document.getElementById('posCashReceived');
        const dealRateInput = document.querySelector('.deal-rate-input:focus') || document.querySelector('input:focus');

        if (dealRateInput && !dealRateInput.disabled) {
            dealRateInput.value = total;
            dealRateInput.dispatchEvent(new Event('input', { bubbles: true }));
            alert(`Total Rp ${total.toLocaleString('id-ID')} dimasukkan ke input yang sedang aktif.`);
        } else if (cashReceivedInput) {
            cashReceivedInput.value = total;
            cashReceivedInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            if (typeof calculateChange === 'function') {
                calculateChange();
            }
            alert(`Total Rp ${total.toLocaleString('id-ID')} dimasukkan ke kolom Uang Diterima POS.`);
        } else {
            alert(`Tidak ada kolom input aktif di POS. Nilai Rp ${total.toLocaleString('id-ID')} disalin ke clipboard.`);
            navigator.clipboard.writeText(String(total));
        }
    };

    // Auto-init on page load or script load
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(initCalc, 500);
        });
    } else {
        setTimeout(initCalc, 500);
    }

})();
