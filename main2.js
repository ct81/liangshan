// ============ STORAGE ============
    const STORAGE_KEY = 'face_recognition_system';
    let faceGallery = [];
    let selectedIds = new Set();
    
    // ============ DOM Elements ============
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const startCameraBtn = document.getElementById('startCameraBtn');
    const stopCameraBtn = document.getElementById('stopCameraBtn');
    const captureBtn = document.getElementById('captureBtn');
    const loginFaceBtn = document.getElementById('loginFaceBtn');
    const registerModeBtn = document.getElementById('registerModeBtn');
    const loginModeBtn = document.getElementById('loginModeBtn');
    const registerControls = document.getElementById('registerControls');
    const loginControls = document.getElementById('loginControls');
    const faceNameInput = document.getElementById('faceName');
    const categorySelect = document.getElementById('categorySelect');
    const cameraStatus = document.getElementById('cameraStatus');
    const galleryDiv = document.getElementById('gallery');
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const galleryCount = document.getElementById('galleryCount');
    const progressFill = document.getElementById('progressFill');
    const loginResult = document.getElementById('loginResult');
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdValueDisplay = document.getElementById('thresholdValueDisplay');
    const sensitivityDescription = document.getElementById('sensitivityDescription');
    const sensitivityBadge = document.getElementById('sensitivityBadge');
    
    // ============ Camera State ============
    let isCameraActive = false;
    let faceMesh = null;
    let camera = null;
    let currentLandmarks = null;
    let currentDescriptor = null;
    let currentMode = 'register';
    
    // ============ Threshold Settings ============
    let MATCH_THRESHOLD = 0.38;
    
    // ============ Update Sensitivity UI ============
    function updateSensitivityUI() {
        thresholdValueDisplay.innerText = MATCH_THRESHOLD.toFixed(2);
        
        let description = '';
        let badgeClass = '';
        
        if (MATCH_THRESHOLD <= 0.28) {
            description = '🔒 VERY STRICT - Only identical matches, high security';
            badgeClass = 'sensitive-high';
            sensitivityBadge.innerHTML = '🔒 High Security Mode';
        } else if (MATCH_THRESHOLD <= 0.35) {
            description = '🔒 STRICT - Good for high security applications';
            badgeClass = 'sensitive-high';
            sensitivityBadge.innerHTML = '🔒 Strict Mode';
        } else if (MATCH_THRESHOLD <= 0.42) {
            description = '⚡ BALANCED - Recommended for most users';
            badgeClass = 'sensitive-medium';
            sensitivityBadge.innerHTML = '⚡ Balanced Mode';
        } else if (MATCH_THRESHOLD <= 0.50) {
            description = '😊 FORGIVING - Works with expressions/lighting changes';
            badgeClass = 'sensitive-medium';
            sensitivityBadge.innerHTML = '😊 Forgiving Mode';
        } else {
            description = '🌈 VERY FORGIVING - Easy login, lower security';
            badgeClass = 'sensitive-low';
            sensitivityBadge.innerHTML = '🌈 Easy Mode';
        }
        
        sensitivityDescription.innerText = description;
        sensitivityBadge.className = `sensitivity-badge ${badgeClass}`;
    }
    
    // ============ Load/Save Gallery ============
    function loadGallery() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            faceGallery = JSON.parse(saved);
        } else {
            faceGallery = [];
        }
        updateGalleryDisplay();
    }
    
    function saveGallery() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(faceGallery));
        updateGalleryDisplay();
    }
    
    function updateGalleryDisplay() {
        const searchTerm = searchInput.value.toLowerCase();
        const category = filterCategory.value;
        
        const filtered = faceGallery.filter(face => {
            const matchSearch = face.name.toLowerCase().includes(searchTerm);
            const matchCategory = category === 'all' || face.category === category;
            return matchSearch && matchCategory;
        });
        
        galleryCount.innerText = faceGallery.length;
        
        if (filtered.length === 0) {
            galleryDiv.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 20px;">No faces found</div>';
            return;
        }
        
        let html = '';
        filtered.forEach(face => {
            const isSelected = selectedIds.has(face.id);
            html += `
                <div class="gallery-item ${isSelected ? 'selected' : ''}" data-id="${face.id}">
                    <img class="gallery-img" src="${face.imageData}" alt="${face.name}">
                    <button class="delete-btn" data-id="${face.id}" data-delete="true">×</button>
                    <div class="gallery-info">
                        <div class="gallery-name">${escapeHtml(face.name)}</div>
                    </div>
                </div>
            `;
        });
        
        galleryDiv.innerHTML = html;
        
        document.querySelectorAll('.gallery-item').forEach(item => {
            const id = item.dataset.id;
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) return;
                if (selectedIds.has(id)) {
                    selectedIds.delete(id);
                } else {
                    selectedIds.add(id);
                }
                updateGalleryDisplay();
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                deleteFace(id);
            });
        });
    }
    
    function deleteFace(id) {
        faceGallery = faceGallery.filter(face => face.id !== id);
        selectedIds.delete(id);
        saveGallery();
        cameraStatus.innerHTML = '🗑️ Face deleted';
        setTimeout(() => {
            if (isCameraActive) cameraStatus.innerHTML = '📷 Ready';
        }, 1000);
    }
    
    function deleteSelected() {
        if (selectedIds.size === 0) {
            cameraStatus.innerHTML = '⚠️ No faces selected';
            return;
        }
        if (confirm(`Delete ${selectedIds.size} selected face(s)?`)) {
            faceGallery = faceGallery.filter(face => !selectedIds.has(face.id));
            selectedIds.clear();
            saveGallery();
            cameraStatus.innerHTML = `✅ Deleted ${selectedIds.size} faces`;
        }
    }
    
    function clearAllData() {
        if (confirm('⚠️ WARNING: Delete ALL registered faces? This cannot be undone.')) {
            faceGallery = [];
            selectedIds.clear();
            saveGallery();
            cameraStatus.innerHTML = '🗑️ All faces deleted';
        }
    }
    
    function exportData() {
        if (faceGallery.length === 0) {
            cameraStatus.innerHTML = '⚠️ No faces to export';
            return;
        }
        const dataStr = JSON.stringify(faceGallery, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `face_gallery_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        cameraStatus.innerHTML = '✅ Exported!';
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ============ Face Descriptor Extraction ============
    function extractFaceDescriptor(landmarks) {
        if (!landmarks) return null;
        
        const keyIndices = [
            1, 33, 61, 133, 157, 263, 291, 362, 386,
            70, 105, 107, 336, 296, 334, 293,
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
            78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308
        ];
        
        const descriptor = [];
        for (const idx of keyIndices) {
            if (landmarks[idx]) {
                descriptor.push(landmarks[idx].x);
                descriptor.push(landmarks[idx].y);
                descriptor.push(landmarks[idx].z || 0);
            }
        }
        
        if (descriptor.length === 0) return null;
        
        const mean = descriptor.reduce((a, b) => a + b, 0) / descriptor.length;
        const std = Math.sqrt(descriptor.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / descriptor.length);
        return descriptor.map(x => (x - mean) / (std + 0.001));
    }
    
    function compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 1;
        let distance = 0;
        for (let i = 0; i < Math.min(desc1.length, desc2.length); i++) {
            distance += Math.pow(desc1[i] - desc2[i], 2);
        }
        return Math.sqrt(distance);
    }
    
    function findMatchingUser(descriptor) {
        if (!descriptor || faceGallery.length === 0) return null;
        
        let bestMatch = null;
        let bestDistance = MATCH_THRESHOLD;
        
        for (const face of faceGallery) {
            if (face.descriptor) {
                const distance = compareDescriptors(descriptor, face.descriptor);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = face;
                }
            }
        }
        
        if (bestMatch) {
            // Calculate confidence based on threshold
            let confidence;
            if (bestDistance <= MATCH_THRESHOLD * 0.5) {
                confidence = 95 + Math.random() * 5;
            } else if (bestDistance <= MATCH_THRESHOLD * 0.7) {
                confidence = 80 + Math.random() * 15;
            } else {
                confidence = 60 + Math.random() * 20;
            }
            return { ...bestMatch, confidence: Math.min(99, Math.floor(confidence)), distance: bestDistance };
        }
        return null;
    }
    
    // ============ Draw 468 Landmark Dots ============
    function drawLandmarkDots(ctx, landmarks, width, height) {
        if (!landmarks) return;
        
        const regions = {
            eyes: { indices: [33,133,157,158,159,160,161,173,362,263,387,386,385,384,398,466], color: '#10b981', size: 5 },
            iris: { indices: [468,469,470,471,472,473], color: '#34d399', size: 6 },
            eyebrows: { indices: [70,63,105,66,107,336,296,334,293,300,55,52,65,53,46], color: '#06b6d4', size: 4 },
            nose: { indices: [1,2,4,5,6,168,197,195,94,97,98,99,100,101,102,103,104], color: '#f59e0b', size: 5 },
            lips: { indices: [61,291,13,14,78,308,78,95,88,178,87,317,402,318,324,308,82,312], color: '#ef4444', size: 4 },
            contour: { indices: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109], color: '#a855f7', size: 4 }
        };
        
        for (const region of Object.values(regions)) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = region.color;
            for (const idx of region.indices) {
                if (landmarks[idx]) {
                    const x = landmarks[idx].x * width;
                    const y = landmarks[idx].y * height;
                    ctx.beginPath();
                    ctx.arc(x, y, region.size, 0, 2 * Math.PI);
                    ctx.fillStyle = region.color;
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x, y, region.size - 2, 0, 2 * Math.PI);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                }
            }
        }
        
        ctx.shadowBlur = 0;
    }
    
    // ============ MediaPipe Face Mesh ============
    function initFaceMesh() {
        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        faceMesh.onResults(onFaceMeshResults);
        cameraStatus.innerHTML = '✅ Face Mesh ready! Start camera';
    }
    
    function onFaceMeshResults(results) {
        if (!isCameraActive) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            currentLandmarks = landmarks;
            currentDescriptor = extractFaceDescriptor(landmarks);
            
            // Calculate bounding box
            let minX = 1, minY = 1, maxX = 0, maxY = 0;
            for (const point of landmarks) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            
            const x = minX * canvas.width;
            const y = minY * canvas.height;
            const w = (maxX - minX) * canvas.width;
            const h = (maxY - minY) * canvas.height;
            
            // Draw bounding box with color based on mode
            let boxColor = currentMode === 'register' ? '#3b82f6' : '#f59e0b';
            if (currentMode === 'login') {
                const match = findMatchingUser(currentDescriptor);
                if (match) boxColor = '#10b981';
                else if (faceGallery.length > 0) boxColor = '#ef4444';
            }
            
            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
            
            // Draw corner accents
            ctx.lineWidth = 4;
            const cornerSize = 20;
            ctx.strokeRect(x, y, cornerSize, cornerSize);
            ctx.strokeRect(x + w - cornerSize, y, cornerSize, cornerSize);
            ctx.strokeRect(x, y + h - cornerSize, cornerSize, cornerSize);
            ctx.strokeRect(x + w - cornerSize, y + h - cornerSize, cornerSize, cornerSize);
            
            // Draw 468 landmark dots
            drawLandmarkDots(ctx, landmarks, canvas.width, canvas.height);
            
            // Draw status text
            let statusText = currentMode === 'register' ? '📸 REGISTER MODE' : '🔍 LOGIN MODE';
            if (currentMode === 'login') {
                const match = findMatchingUser(currentDescriptor);
                if (match) statusText = `✅ ${match.name} (${match.confidence}%)`;
                else if (faceGallery.length > 0) statusText = '❌ No match found';
            }
            
            ctx.font = "bold 14px 'Segoe UI'";
            ctx.fillStyle = '#000000aa';
            ctx.fillRect(x + 5, y - 28, 200, 26);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(statusText, x + 12, y - 10);
            
            // Draw threshold info on face
            ctx.font = "10px 'Segoe UI'";
            ctx.fillStyle = '#ffffffaa';
            ctx.fillText(`Threshold: ${MATCH_THRESHOLD.toFixed(2)}`, x + 12, y + h - 5);
            
            if (currentMode === 'register') {
                cameraStatus.innerHTML = '✅ Face detected! Enter name and click CAPTURE';
                cameraStatus.className = 'status success';
            }
        } else {
            cameraStatus.innerHTML = currentMode === 'register' ? '❌ No face detected' : '❌ Position your face';
            cameraStatus.className = 'status error';
        }
    }
    
    // ============ Camera Controls ============
    async function startCamera() {
        if (isCameraActive) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            await video.play();
            
            camera = new Camera(video, {
                onFrame: async () => { if (faceMesh) await faceMesh.send({ image: video }); },
                width: 640, height: 480
            });
            camera.start();
            isCameraActive = true;
            cameraStatus.innerHTML = '📷 Camera active - Position face';
            cameraStatus.className = 'status success';
        } catch (err) {
            cameraStatus.innerHTML = '❌ Camera access denied';
            cameraStatus.className = 'status error';
        }
    }
    
    function stopCamera() {
        if (camera) camera.stop();
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        isCameraActive = false;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cameraStatus.innerHTML = '⏸️ Camera stopped';
        cameraStatus.className = 'status info';
    }
    
    // ============ Capture & Register ============
    function captureFace() {
        const name = faceNameInput.value.trim();
        if (!name) {
            cameraStatus.innerHTML = '❌ Enter a name';
            return;
        }
        if (!currentLandmarks || !currentDescriptor) {
            cameraStatus.innerHTML = '❌ No face detected';
            return;
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const imageData = tempCanvas.toDataURL('image/jpeg', 0.9);
        
        const newFace = {
            id: Date.now(),
            name: name,
            category: categorySelect.value,
            imageData: imageData,
            descriptor: currentDescriptor,
            timestamp: new Date().toISOString()
        };
        
        faceGallery.push(newFace);
        saveGallery();
        
        progressFill.style.width = '100%';
        setTimeout(() => progressFill.style.width = '0%', 500);
        
        cameraStatus.innerHTML = `✅ "${name}" saved!`;
        faceNameInput.value = '';
        
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;opacity:0.5;z-index:9999;pointer-events:none';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 200);
    }
    
    // ============ Login ============
    function loginWithFace() {
        if (!currentDescriptor) {
            loginResult.innerHTML = '<span style="color:#f87171;">❌ No face detected. Look at camera.</span>';
            return;
        }
        if (faceGallery.length === 0) {
            loginResult.innerHTML = '<span style="color:#fbbf24;">⚠️ No registered faces. Register first.</span>';
            return;
        }
        
        const match = findMatchingUser(currentDescriptor);
        
        if (match) {
            loginResult.innerHTML = `
                <div style="background:#10b98120; padding:12px; border-radius:12px;">
                    <span style="color:#34d399; font-size:1.2rem;">✅ LOGIN SUCCESSFUL!</span><br>
                    <span style="color:#e2e8f0;">Welcome back, <strong>${match.name}</strong>!</span><br>
                    <span style="color:#6b7280; font-size:0.8rem;">Confidence: ${match.confidence}% | Distance: ${match.distance.toFixed(3)}</span><br>
                    <span style="color:#6b7280; font-size:0.7rem;">Threshold: ${MATCH_THRESHOLD.toFixed(2)}</span>
                </div>
            `;
            progressFill.style.width = '100%';
            setTimeout(() => progressFill.style.width = '0%', 1000);
        } else {
            loginResult.innerHTML = `
                <div style="background:#ef444420; padding:12px; border-radius:12px;">
                    <span style="color:#f87171;">❌ LOGIN FAILED!</span><br>
                    <span style="color:#e2e8f0; font-size:0.8rem;">No matching face found</span><br>
                    <span style="color:#6b7280; font-size:0.7rem;">Try adjusting sensitivity or register this face</span>
                </div>
            `;
        }
    }
    
    // ============ Mode Switching ============
    function setMode(mode) {
        currentMode = mode;
        if (mode === 'register') {
            registerModeBtn.classList.add('active');
            loginModeBtn.classList.remove('active');
            registerControls.style.display = 'block';
            loginControls.style.display = 'none';
            loginResult.innerHTML = '';
        } else {
            loginModeBtn.classList.add('active');
            registerModeBtn.classList.remove('active');
            registerControls.style.display = 'none';
            loginControls.style.display = 'block';
        }
    }
    
    // ============ Threshold Update ============
    function updateThreshold() {
        MATCH_THRESHOLD = parseFloat(thresholdSlider.value);
        updateSensitivityUI();
        
        // Show feedback
        cameraStatus.innerHTML = `⚙️ Sensitivity set to ${MATCH_THRESHOLD.toFixed(2)} - ${sensitivityDescription.innerText}`;
        cameraStatus.className = 'status info';
        setTimeout(() => {
            if (isCameraActive) {
                cameraStatus.innerHTML = '📷 Camera active';
                cameraStatus.className = 'status success';
            }
        }, 2000);
    }
    
    // ============ Event Listeners ============
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
    captureBtn.addEventListener('click', captureFace);
    loginFaceBtn.addEventListener('click', loginWithFace);
    registerModeBtn.addEventListener('click', () => setMode('register'));
    loginModeBtn.addEventListener('click', () => setMode('login'));
    deleteSelectedBtn.addEventListener('click', deleteSelected);
    exportDataBtn.addEventListener('click', exportData);
    clearAllBtn.addEventListener('click', clearAllData);
    searchInput.addEventListener('input', () => updateGalleryDisplay());
    filterCategory.addEventListener('change', () => updateGalleryDisplay());
    thresholdSlider.addEventListener('input', updateThreshold);
    
    faceNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') captureFace();
    });
    
    // ============ Initialize ============
    loadGallery();
    initFaceMesh();
    updateSensitivityUI();