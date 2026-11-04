// DOM Elements
    const video = document.getElementById('video');
    const startBtn = document.getElementById('startCamBtn');
    const captureBtn = document.getElementById('captureBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const resetAreaBtn = document.getElementById('resetAreaBtn');
    const fullAreaBtn = document.getElementById('fullAreaBtn');
    const enhanceCheckbox = document.getElementById('autoEnhance');
    const preciseMode = document.getElementById('preciseMode');
    const resolutionSelect = document.getElementById('resolution');
    const languageSelect = document.getElementById('languageSelect');
    const statusSpan = document.getElementById('statusMsg');
    const detectionBox = document.getElementById('detectionBox');
    const resizeHandle = document.getElementById('resizeHandle');
    const singleSelectBtn = document.getElementById('singleSelectBtn');
    const multiSelectBtn = document.getElementById('multiSelectBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const selectedCountSpan = document.getElementById('selectedCount');
    const selectedTagsDiv = document.getElementById('selectedTags');
    const detectedLangText = document.getElementById('detectedLangText');
    const selectedLangText = document.getElementById('selectedLangText');
    const displayLanguage = document.getElementById('displayLanguage');
    
    let stream = null, cameraActive = false, opencvReady = false, tesseractWorker = null;
    let startTime = 0;
    let selectMode = 'single';
    let selectedModes = ['auto'];
    let batchResults = [];
    let currentDetectedLanguage = 'eng';
    let currentSelectedLanguage = 'auto';
    
    // Language names mapping
    const languageNames = {
        'auto': '🤖 Auto-Detect',
        'eng': '🇺🇸 English',
        'spa': '🇪🇸 Spanish',
        'fra': '🇫🇷 French',
        'deu': '🇩🇪 German',
        'ita': '🇮🇹 Italian',
        'por': '🇵🇹 Portuguese',
        'rus': '🇷🇺 Russian',
        'chi_sim': '🇨🇳 Chinese (Simplified)',
        'chi_tra': '🇹🇼 Chinese (Traditional)',
        'jpn': '🇯🇵 Japanese',
        'kor': '🇰🇷 Korean',
        'ara': '🇸🇦 Arabic',
        'hin': '🇮🇳 Hindi'
    };
    
    const modeNames = {
        'auto': '🤖 AUTO', 'table': '📊 Table', 'business': '💳 Business Card',
        'inspection': '🔍 Inspection', 'attendance': '📋 Attendance', 'document': '📄 Document',
        'form': '📋 Form', 'receipt': '🧾 Receipt', 'invoice': '🧾 Invoice',
        'label': '🏷️ Label', 'pricetag': '💰 Price Tag', 'contract': '📄 Contract',
        'toylabel': '🧸 Toy Label', 'handwriting': '✍️ Handwriting', 'code': '🔢 Code'
    };
    
    // Update selected language display
    function updateSelectedLanguageDisplay() {
        const selectedValue = languageSelect.value;
        currentSelectedLanguage = selectedValue;
        selectedLangText.innerHTML = languageNames[selectedValue];
    }
    
    languageSelect.addEventListener('change', updateSelectedLanguageDisplay);
    updateSelectedLanguageDisplay();
    
    // Language detection patterns
    function detectLanguage(text) {
        const lowerText = text.toLowerCase();
        const patterns = {
            eng: /\b(the|and|for|with|this|that|have|from|they|will|would|could|should|about|which|their|there|what|were|when|your|said|been|can|out|other|more|some|into|than|then|them|these|people|also|well|only|new|very|after|before|those|without|through|between|under|over|during|among|within|because|therefore|however|nevertheless|meanwhile|consequently)\b/i,
            spa: /\b(el|la|de|y|que|en|por|con|para|los|una|del|las|como|más|pero|sus|le|ya|cuando|sobre|entre|sin|sobre|tras|durante|mediante|según|desde|hasta|contra|ante)\b/i,
            fra: /\b(le|la|et|de|un|une|pour|dans|avec|est|que|qui|sont|plus|par|sur|ces|ses|mais|comme|sous|entre|pendant|depuis|jusque|contre|chez|sans|après|avant)\b/i,
            deu: /\b(der|die|und|den|von|mit|dem|des|für|ist|auf|bei|nach|aus|durch|über|unter|zwischen|während|ohne|gegen|vor|hinter|neben|gemäß|entsprechend)\b/i,
            ita: /\b(il|la|e|di|che|per|con|un|una|del|della|dei|delle|nel|nella|nei|nelle|sul|sulla|sui|sulle|tra|fra|durante|senza|contro)\b/i,
            por: /\b(do|da|de|e|que|para|com|um|uma|dos|das|por|mais|como|mas|seu|sua|seus|suas|nos|nas|pelo|pela|pelos|pelas|entre|sobre|sem|após|antes)\b/i,
            rus: /[а-яА-Я]{2,}/,
            chi_sim: /[\u4e00-\u9fff]/,
            jpn: /[\u3040-\u309F\u30A0-\u30FF]/,
            kor: /[\uAC00-\uD7AF]/
        };
        
        let scores = {};
        for (let [lang, pattern] of Object.entries(patterns)) {
            let matches = 0;
            if (lang === 'rus') matches = (text.match(/[а-яА-Я]/g) || []).length;
            else if (lang === 'chi_sim') matches = (text.match(/[\u4e00-\u9fff]/g) || []).length;
            else if (lang === 'jpn') matches = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
            else if (lang === 'kor') matches = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
            else matches = (text.match(pattern) || []).length;
            scores[lang] = matches;
        }
        
        let bestLang = 'eng';
        let maxScore = 0;
        for (let [lang, score] of Object.entries(scores)) {
            if (score > maxScore && score > 2) {
                maxScore = score;
                bestLang = lang;
            }
        }
        return bestLang;
    }
    
    // Detection area
    let boxRect = { x: 0, y: 0, width: 1, height: 1 };
    let isDragging = false, isResizing = false;
    let dragStart = { x: 0, y: 0 }, boxStart = { x: 0, y: 0, width: 0, height: 0 };
    
    function updateBoxPosition() {
        const rect = video.getBoundingClientRect();
        if (rect.width === 0) return;
        detectionBox.style.left = `${boxRect.x * rect.width}px`;
        detectionBox.style.top = `${boxRect.y * rect.height}px`;
        detectionBox.style.width = `${boxRect.width * rect.width}px`;
        detectionBox.style.height = `${boxRect.height * rect.height}px`;
    }
    
    function startDrag(e) { e.preventDefault(); isDragging = true; const c = e.clientX ?? (e.touches?.[0]?.clientX ?? 0); dragStart = { x: c, y: c }; boxStart = { x: boxRect.x, y: boxRect.y }; }
    function startResize(e) { e.preventDefault(); isResizing = true; const c = e.clientX ?? (e.touches?.[0]?.clientX ?? 0); dragStart = { x: c, y: c }; boxStart = { width: boxRect.width, height: boxRect.height }; }
    function onMove(e) { if (!isDragging && !isResizing) return; e.preventDefault(); const c = e.clientX ?? (e.touches?.[0]?.clientX ?? 0), d = e.clientY ?? (e.touches?.[0]?.clientY ?? 0); const rect = video.getBoundingClientRect(); if (rect.width === 0) return;
        if (isDragging) { let nx = boxStart.x + (c - dragStart.x)/rect.width; let ny = boxStart.y + (d - dragStart.y)/rect.height; boxRect.x = Math.max(0, Math.min(1 - boxRect.width, nx)); boxRect.y = Math.max(0, Math.min(1 - boxRect.height, ny)); updateBoxPosition(); }
        else if (isResizing) { let nw = Math.max(0.05, Math.min(1, boxStart.width + (c - dragStart.x)/rect.width)); let nh = Math.max(0.05, Math.min(1, boxStart.height + (d - dragStart.y)/rect.height)); boxRect.width = nw; boxRect.height = nh; updateBoxPosition(); }
    }
    function endDrag() { isDragging = false; isResizing = false; }
    detectionBox.addEventListener('mousedown', startDrag); resizeHandle.addEventListener('mousedown', startResize);
    detectionBox.addEventListener('touchstart', startDrag, { passive: false }); resizeHandle.addEventListener('touchstart', startResize, { passive: false });
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', endDrag);
    
    function resetArea() { boxRect = { x: 0, y: 0, width: 1, height: 1 }; updateBoxPosition(); }
    function fullArea() { boxRect = { x: 0, y: 0, width: 1, height: 1 }; updateBoxPosition(); }
    resetAreaBtn.addEventListener('click', resetArea); fullAreaBtn.addEventListener('click', fullArea);
    
    function updateSelectedDisplay() {
        selectedCountSpan.innerText = selectedModes.length;
        selectedTagsDiv.innerHTML = selectedModes.map(mode => 
            `<span class="selected-tag">${modeNames[mode]} <button onclick="removeMode('${mode}')">✖</button></span>`
        ).join('');
        document.querySelectorAll('.mode-item input').forEach(cb => { cb.checked = selectedModes.includes(cb.value); });
    }
    
    window.removeMode = function(mode) {
        selectedModes = selectedModes.filter(m => m !== mode);
        if (selectedModes.length === 0) selectedModes = ['auto'];
        updateSelectedDisplay();
    };
    
    singleSelectBtn.addEventListener('click', () => { selectMode = 'single'; singleSelectBtn.classList.add('active'); multiSelectBtn.classList.remove('active'); });
    multiSelectBtn.addEventListener('click', () => { selectMode = 'multi'; multiSelectBtn.classList.add('active'); singleSelectBtn.classList.remove('active'); });
    selectAllBtn.addEventListener('click', () => { selectedModes = Array.from(document.querySelectorAll('.mode-item input')).map(cb => cb.value); updateSelectedDisplay(); });
    clearAllBtn.addEventListener('click', () => { selectedModes = ['auto']; updateSelectedDisplay(); });
    
    document.querySelectorAll('.mode-item input').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const mode = e.target.value;
            if (selectMode === 'single') { selectedModes = [mode]; }
            else { if (e.target.checked) { if (!selectedModes.includes(mode)) selectedModes.push(mode); } else { selectedModes = selectedModes.filter(m => m !== mode); } }
            if (selectedModes.length === 0) selectedModes = ['auto'];
            updateSelectedDisplay();
        });
    });
    
    // Mode PSM configurations
    const modePSM = {
        auto: 3, table: 3, business: 3, inspection: 3, attendance: 3, document: 3,
        form: 3, receipt: 3, invoice: 3, label: 6, pricetag: 8, contract: 3,
        toylabel: 6, handwriting: 3, code: 8
    };
    
    // Specialized parsers
    function parseTable(text) {
        const lines = text.split('\n').filter(l => l.trim());
        const rows = lines.map(line => line.split(/\s{2,}|\t+/).map(c => c.trim()).filter(c => c));
        const maxCols = Math.max(...rows.map(r => r.length), 1);
        return rows.map(row => { while (row.length < maxCols) row.push(''); return row; });
    }
    
    function parseBusinessCard(text) {
        const lines = text.split('\n');
        let name = '', email = '', phone = '', company = '';
        for (let line of lines) {
            if (line.match(/@/)) email = line;
            else if (line.match(/\+?\d[\d\s-]{8,}/)) phone = line;
            else if (!name && line.length > 3 && line.length < 40) name = line;
            else if (!company && line.length > 2) company = line;
        }
        return { name, company, email, phone };
    }
    
    function parseInspection(text) {
        let inspector = '', equipment = '', result = 'PENDING', defects = [];
        const lines = text.split('\n');
        for (let line of lines) {
            if (line.match(/inspector|inspected by/i)) inspector = line;
            if (line.match(/equipment|asset|machine/i)) equipment = line;
            if (line.match(/pass|fail|approved|rejected/i)) result = line;
            if (line.match(/defect|issue|fault/i)) defects.push(line);
        }
        return { inspector, equipment, result, defects: defects.join('; ') };
    }
    
    function parseAttendance(text) {
        let employeeId = '', name = '', date = '', timeIn = '', timeOut = '', status = '';
        const lines = text.split('\n');
        for (let line of lines) {
            if (line.match(/id|employee/i)) employeeId = line;
            if (line.match(/name/i)) name = line;
            if (line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) date = line;
            if (line.match(/\d{1,2}:\d{2}/) && !timeIn) timeIn = line;
            else if (line.match(/\d{1,2}:\d{2}/) && timeIn) timeOut = line;
            if (line.match(/present|absent|late|leave/i)) status = line;
        }
        return { employeeId, name, date, timeIn, timeOut, status };
    }
    
    function parseForm(text) {
        let name = '', address = '', ssn = '';
        const lines = text.split('\n');
        for (let line of lines) {
            if (line.match(/name/i)) name = line;
            if (line.match(/address|street/i)) address = line;
            if (line.match(/\d{3}-\d{2}-\d{4}/)) ssn = line;
        }
        return { name, address, ssn };
    }
    
    function parseReceipt(text) {
        let total = 0;
        const totalMatch = text.match(/total\s*:?\s*\$?(\d+\.\d{2})/i);
        if (totalMatch) total = parseFloat(totalMatch[1]);
        return { total: total.toFixed(2) };
    }
    
    function parseInvoice(text) {
        let invoiceNo = '', total = 0;
        const invMatch = text.match(/invoice\s*(?:#|no\.?)?\s*:?\s*([A-Z0-9-]+)/i);
        if (invMatch) invoiceNo = invMatch[1];
        const totalMatch = text.match(/total\s*(?:due)?\s*:?\s*\$?(\d+\.\d{2})/i);
        if (totalMatch) total = parseFloat(totalMatch[1]);
        return { invoiceNo, total: total.toFixed(2) };
    }
    
    function parseLabel(text) {
        let product = '', price = '';
        const priceMatch = text.match(/\$\d+\.?\d*/);
        if (priceMatch) price = priceMatch[0];
        const lines = text.split('\n');
        for (let line of lines) {
            if (!product && line.length > 3 && line.length < 50 && !line.match(/[\$\d]/)) {
                product = line.trim();
                break;
            }
        }
        return { product, price };
    }
    
    function parsePriceTag(text) {
        const priceMatch = text.match(/\$?\s?(\d+\.?\d{2})/);
        return { price: priceMatch ? `$${priceMatch[1]}` : 'N/A' };
    }
    
    function parseContract(text) {
        return { summary: text.substring(0, 150) + '...', length: text.length };
    }
    
    function parseToyLabel(text) {
        let name = '', age = '';
        const ageMatch = text.match(/ages?\s+\d+/i);
        if (ageMatch) age = ageMatch[0];
        const lines = text.split('\n');
        for (let line of lines) {
            if (!name && line.length > 2 && line.length < 40 && !line.match(/age|warning/i)) {
                name = line.trim();
                break;
            }
        }
        return { name, age };
    }
    
    function parseHandwriting(text) {
        return { text: text.substring(0, 200) + (text.length > 200 ? '...' : ''), length: text.length };
    }
    
    function parseCode(text) {
        const codeMatch = text.match(/[A-Z0-9]{4,}/g);
        return { codes: codeMatch ? codeMatch.join(', ') : 'N/A' };
    }
    
    function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m] || m)); }
    
    function formatOutput(mode, text, confidence, language) {
        let html = '';
        if (mode === 'table') {
            const data = parseTable(text);
            html = '<table class="data-table">';
            if (data.length) html += '<thead><tr>' + data[0].map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr></thead><tbody>';
            for (let i = 1; i < Math.min(data.length, 11); i++) {
                html += '</tr>' + data[i].map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
            }
            html += '</tbody><table>';
        } else if (mode === 'business') { const d = parseBusinessCard(text); html = `<div class="field-row"><div class="field-label">👤 Name:</div><div class="field-value">${escapeHtml(d.name)}</div></div><div class="field-row"><div class="field-label">🏢 Company:</div><div class="field-value">${escapeHtml(d.company)}</div></div><div class="field-row"><div class="field-label">📧 Email:</div><div class="field-value">${escapeHtml(d.email)}</div></div><div class="field-row"><div class="field-label">📞 Phone:</div><div class="field-value">${escapeHtml(d.phone)}</div></div>`;
        } else if (mode === 'inspection') { const d = parseInspection(text); html = `<div class="field-row"><div class="field-label">🔍 Inspector:</div><div class="field-value">${escapeHtml(d.inspector)}</div></div><div class="field-row"><div class="field-label">⚙️ Equipment:</div><div class="field-value">${escapeHtml(d.equipment)}</div></div><div class="field-row"><div class="field-label">📊 Result:</div><div class="field-value"><span class="price-highlight">${escapeHtml(d.result)}</span></div></div><div class="field-row"><div class="field-label">⚠️ Defects:</div><div class="field-value">${escapeHtml(d.defects)}</div></div>`;
        } else if (mode === 'attendance') { const d = parseAttendance(text); html = `<div class="field-row"><div class="field-label">👤 Employee ID:</div><div class="field-value">${escapeHtml(d.employeeId)}</div></div><div class="field-row"><div class="field-label">📛 Name:</div><div class="field-value">${escapeHtml(d.name)}</div></div><div class="field-row"><div class="field-label">📅 Date:</div><div class="field-value">${escapeHtml(d.date)}</div></div><div class="field-row"><div class="field-label">⏰ Time In:</div><div class="field-value">${escapeHtml(d.timeIn)}</div></div><div class="field-row"><div class="field-label">⏰ Time Out:</div><div class="field-value">${escapeHtml(d.timeOut)}</div></div><div class="field-row"><div class="field-label">✅ Status:</div><div class="field-value">${escapeHtml(d.status)}</div></div>`;
        } else if (mode === 'form') { const d = parseForm(text); html = `<div class="field-row"><div class="field-label">👤 Name:</div><div class="field-value">${escapeHtml(d.name)}</div></div><div class="field-row"><div class="field-label">📍 Address:</div><div class="field-value">${escapeHtml(d.address)}</div></div><div class="field-row"><div class="field-label">🔢 SSN/EIN:</div><div class="field-value">${escapeHtml(d.ssn)}</div></div>`;
        } else if (mode === 'receipt') { const d = parseReceipt(text); html = `<div class="field-row"><div class="field-label">🧾 Total:</div><div class="field-value"><span class="price-highlight">$${escapeHtml(d.total)}</span></div></div>`;
        } else if (mode === 'invoice') { const d = parseInvoice(text); html = `<div class="field-row"><div class="field-label">🧾 Invoice #:</div><div class="field-value">${escapeHtml(d.invoiceNo)}</div></div><div class="field-row"><div class="field-label">💰 Total:</div><div class="field-value"><span class="price-highlight">$${escapeHtml(d.total)}</span></div></div>`;
        } else if (mode === 'label') { const d = parseLabel(text); html = `<div class="field-row"><div class="field-label">🏷️ Product:</div><div class="field-value">${escapeHtml(d.product)}</div></div><div class="field-row"><div class="field-label">💰 Price:</div><div class="field-value">${escapeHtml(d.price)}</div></div>`;
        } else if (mode === 'pricetag') { const d = parsePriceTag(text); html = `<div class="field-row"><div class="field-label">💰 Price:</div><div class="field-value"><span class="price-highlight">${escapeHtml(d.price)}</span></div></div>`;
        } else if (mode === 'contract') { const d = parseContract(text); html = `<div class="field-row"><div class="field-label">📄 Summary:</div><div class="field-value">${escapeHtml(d.summary)}</div></div>`;
        } else if (mode === 'toylabel') { const d = parseToyLabel(text); html = `<div class="field-row"><div class="field-label">🧸 Toy:</div><div class="field-value">${escapeHtml(d.name)}</div></div><div class="field-row"><div class="field-label">👶 Age:</div><div class="field-value">${escapeHtml(d.age)}</div></div>`;
        } else if (mode === 'handwriting') { const d = parseHandwriting(text); html = `<div class="field-row"><div class="field-label">✍️ Text:</div><div class="field-value">${escapeHtml(d.text)}</div></div>`;
        } else if (mode === 'code') { const d = parseCode(text); html = `<div class="field-row"><div class="field-label">🔢 Codes:</div><div class="field-value">${escapeHtml(d.codes)}</div></div>`;
        } else { html = `<pre style="white-space:pre-wrap;">${escapeHtml(text)}</pre>`; }
        return `<div class="card-result"><div class="detection-info"><span>🎯 Mode: ${modeNames[mode]}</span><span>🌐 Language: ${languageNames[language]}</span><span>✅ Confidence: ${confidence}%</span></div>${html}</div>`;
    }
    
    async function initTesseractWorker(lang) {
        if (tesseractWorker) await tesseractWorker.terminate();
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        await worker.setParameters({ preserve_interword_spaces: '1', tessedit_enable_dictionary: '1' });
        tesseractWorker = worker;
        return worker;
    }
    
    async function processWithAllModes(imageElement) {
        batchResults = [];
        const totalModes = selectedModes.length;
        let bestConfidence = 0, bestResult = '', bestMode = '';
        let selectedLang = languageSelect.value;
        
        setStatus(`🔄 Processing ${totalModes} mode(s)...`);
        
        // First, detect language if auto mode
        let useLang = selectedLang;
        if (selectedLang === 'auto') {
            setStatus(`🌐 Detecting language from document...`);
            const tempWorker = await initTesseractWorker('eng');
            const tempResult = await tempWorker.recognize(imageElement);
            const detected = detectLanguage(tempResult.data.text);
            useLang = detected;
            currentDetectedLanguage = detected;
            detectedLangText.innerHTML = languageNames[detected];
            await tempWorker.terminate();
            setStatus(`🌐 Detected language: ${languageNames[detected]}`);
        } else {
            currentDetectedLanguage = selectedLang;
            detectedLangText.innerHTML = languageNames[selectedLang];
        }
        
        displayLanguage.innerHTML = languageNames[useLang];
        
        for (let i = 0; i < totalModes; i++) {
            const mode = selectedModes[i];
            setStatus(`📌 [${i+1}/${totalModes}] Processing ${modeNames[mode]} with ${languageNames[useLang]}...`);
            
            const worker = await initTesseractWorker(useLang);
            await worker.setParameters({ tessedit_pageseg_mode: modePSM[mode] });
            const result = await worker.recognize(imageElement);
            const text = result.data.text;
            const confidence = Math.round(result.data.confidence);
            
            batchResults.push({ mode, modeName: modeNames[mode], text, confidence, language: useLang, languageName: languageNames[useLang] });
            
            if (confidence > bestConfidence) { bestConfidence = confidence; bestResult = text; bestMode = mode; }
        }
        
        const elapsed = Date.now() - startTime;
        document.getElementById('formattedTab').innerHTML = formatOutput(bestMode, bestResult, bestConfidence, useLang);
        document.getElementById('batchTab').innerHTML = `<div class="batch-results">${batchResults.map(r => formatOutput(r.mode, r.text, r.confidence, r.language)).join('')}</div>`;
        document.getElementById('jsonTab').innerHTML = `<pre>${escapeHtml(JSON.stringify(batchResults, null, 2))}</pre>`;
        document.getElementById('rawTab').innerHTML = `<pre style="white-space:pre-wrap;">${escapeHtml(bestResult)}</pre>`;
        
        document.getElementById('ocrStats').style.display = 'block';
        document.getElementById('confidenceFill').style.width = `${bestConfidence}%`;
        document.getElementById('confidenceValue').innerHTML = bestConfidence;
        document.getElementById('bestMode').innerHTML = modeNames[bestMode];
        document.getElementById('wordCount').innerHTML = bestResult.split(/\s+/).length;
        document.getElementById('processTime').innerHTML = elapsed;
        document.getElementById('modesCount').innerHTML = totalModes;
        
        setStatus(`✅ Best: ${modeNames[bestMode]} (${bestConfidence}%) | Language: ${languageNames[useLang]}`);
    }
    
    async function captureAndScan() {
        if (!cameraActive) { setStatus("⚠️ Start camera first", true); return; }
        startTime = Date.now();
        document.getElementById('formattedTab').innerHTML = '<div class="spinner"></div> Processing...';
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const img = new Image();
        img.src = canvas.toDataURL();
        img.onload = async () => { await processWithAllModes(img); };
    }
    
    captureBtn.addEventListener('click', captureAndScan);
    
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const id = btn.dataset.tab;
            document.getElementById('formattedTab').style.display = id === 'formatted' ? 'block' : 'none';
            document.getElementById('batchTab').style.display = id === 'batch' ? 'block' : 'none';
            document.getElementById('jsonTab').style.display = id === 'json' ? 'block' : 'none';
            document.getElementById('rawTab').style.display = id === 'raw' ? 'block' : 'none';
        });
    });
    
    async function initCamera() {
        if (stream) stream.getTracks().forEach(t => t.stop());
        try {
            const res = resolutionSelect.value;
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: parseInt(res) }, height: { ideal: parseInt(res) * 0.75 } } });
            video.srcObject = stream; await video.play(); cameraActive = true;
            setTimeout(updateBoxPosition, 100);
            setStatus("✅ Camera ready - Select language and modes");
        } catch (err) { setStatus("❌ Camera error", true); cameraActive = false; }
    }
    startBtn.addEventListener('click', initCamera);
    
    uploadBtn.addEventListener('click', () => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0]; if (!file) return;
            const url = URL.createObjectURL(file); const img = new Image();
            img.onload = async () => { await processWithAllModes(img); URL.revokeObjectURL(url); };
            img.src = url;
        };
        input.click();
    });
    
    function waitForOpenCV() { return new Promise(r => { if (typeof cv !== 'undefined' && cv.Mat) { opencvReady = true; r(); } else { const i = setInterval(() => { if (typeof cv !== 'undefined' && cv.Mat) { clearInterval(i); opencvReady = true; r(); } }, 150); } }); }
    function setStatus(msg, isErr = false) { statusSpan.innerHTML = msg; statusSpan.style.color = isErr ? '#f87171' : '#94a3b8'; }
    
    window.addEventListener('load', async () => { await waitForOpenCV(); await initTesseractWorker('eng'); resetArea(); try { await initCamera(); } catch(e) { setStatus("Click Start Camera"); } });
    window.addEventListener('beforeunload', () => { if (tesseractWorker) tesseractWorker.terminate(); if (stream) stream.getTracks().forEach(t => t.stop()); });
    
    updateSelectedDisplay();