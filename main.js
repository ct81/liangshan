
// ========== TOGGLE PLAYBACK PANEL ==========
function togglePlaybackPanel() {
    const panel = document.getElementById('playbackPanel');
    const btn = document.getElementById('togglePlaybackBtn');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        btn.innerHTML = '📼 Hide Playback Panel';
        btn.style.background = '#ef4444';
    } else {
        panel.classList.add('hidden');
        btn.innerHTML = '📼 Show Playback Panel';
        btn.style.background = '#10b981';
    }
}

// ========== AUTO-SAVE LOCAL RECORDING ==========
let mediaRecorder = null;
let recordedChunks = [];
let recordings = [];
let isRecording = false;
let selectedRecordingIndex = 0;

let hit_threshold = 90;

const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordingStatusSpan = document.getElementById('recordingStatus');
const recordingBadge = document.getElementById('recordingBadge');
const playbackVideo = document.getElementById('playbackVideo');
const recordingsList = document.getElementById('recordingsList');

function startRecording() {
    if (!isStreaming || !canvas) {
        showToast('Start camera first!', '#ef4444');
        return;
    }

    try {
        const canvasStream = canvas.captureStream(30);

        mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
        recordedChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `sentinel-recording-${timestamp}.webm`;
            const fileSize = (blob.size / 1024 / 1024).toFixed(2);

            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            const recording = {
                id: Date.now(),
                name: filename,
                url: url,
                blob: blob,
                timestamp: new Date().toLocaleString(),
                size: fileSize + ' MB'
            };
            recordings.unshift(recording);
            updateRecordingsList();

            showToast(`Recording saved! ${filename} (${fileSize} MB)`, '#10b981');
            if (audioEnabled) speakText('Recording saved to your computer');
        };

        mediaRecorder.start(1000);
        isRecording = true;
        startRecordBtn.disabled = true;
        stopRecordBtn.disabled = false;
        recordingStatusSpan.innerHTML = 'Recording...';
        recordingStatusSpan.style.color = '#dc2626';
        recordingBadge.classList.add('active');
        showToast('Recording started! Click Stop when done.', '#dc2626');
        if (audioEnabled) speakText('Recording started');
    } catch (err) {
        console.error('Recording error:', err);
        showToast('Failed to start recording', '#ef4444');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordingStatusSpan.innerHTML = 'Stopped';
        recordingStatusSpan.style.color = '#8F9BB3';
        recordingBadge.classList.remove('active');
        showToast('Recording stopped - saving to computer...', '#3b82f6');
    }
}

function saveSelectedRecording() {
    if (recordings.length === 0) {
        showToast('No recordings to save', '#ef4444');
        return;
    }
    const rec = recordings[selectedRecordingIndex] || recordings[0];
    const link = document.createElement('a');
    link.href = rec.url;
    link.download = rec.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloading ${rec.name}`, '#10b981');
}

function updateRecordingsList() {
    if (recordings.length === 0) {
        recordingsList.innerHTML = '<div style="color:#9ca3af; text-align:center; padding:10px;">No recordings yet. Start recording to save videos.</div>';
        return;
    }

    let html = '';
    recordings.forEach((rec, index) => {
        html += `
                    <div class="recording-item" onclick="selectRecording(${index})">
                        <span>📼 ${rec.name}</span>
                        <span style="font-size:0.5rem;">${rec.timestamp} (${rec.size})</span>
                    </div>
                `;
    });
    recordingsList.innerHTML = html;
}

function selectRecording(index) {
    selectedRecordingIndex = index;
    const rec = recordings[index];
    showToast(`Selected: ${rec.name}`, '#3b82f6');
}

function playRecording() {
    if (recordings.length === 0) {
        showToast('No recordings to play', '#ef4444');
        return;
    }
    const rec = recordings[selectedRecordingIndex] || recordings[0];
    playbackVideo.src = rec.url;
    playbackVideo.play();
    showToast(`Playing: ${rec.name}`, '#10b981');
}

function stopPlayback() {
    playbackVideo.pause();
    playbackVideo.currentTime = 0;
    showToast('Playback stopped', '#3b82f6');
}

function clearRecordings() {
    recordings = [];
    playbackVideo.src = '';
    updateRecordingsList();
    showToast('Recording list cleared', '#3b82f6');
}

// ========== FULLSCREEN TOGGLE ==========
function toggleFullscreen() {
    const videoWrapper = document.getElementById('videoWrapper');
    if (!document.fullscreenElement) {
        videoWrapper.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
}

document.addEventListener('fullscreenchange', () => {
    const videoWrapper = document.getElementById('videoWrapper');
    if (document.fullscreenElement) {
        videoWrapper.classList.add('fullscreen');
    } else {
        videoWrapper.classList.remove('fullscreen');
    }
});

// ========== SESSION ID SYSTEM ==========
let currentSessionId = null;
let sessionDetectionCounter = 0;

function generateNewSessionId() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SCAN-${timestamp}-${random}`;
}

function startNewScanSession() {
    currentSessionId = generateNewSessionId();
    sessionDetectionCounter = 0;
    const sessionIndicator = document.getElementById('sessionIndicator');
    if (sessionIndicator) sessionIndicator.innerHTML = `🆔 SESSION: ${currentSessionId}`;
    return currentSessionId;
}

function getCurrentSessionId() {
    if (!currentSessionId) startNewScanSession();
    return currentSessionId;
}

function generateUniqueId() {
    sessionDetectionCounter++;
    return `DET-${sessionDetectionCounter.toString().padStart(4, '0')}`;
}

// ========== VISION MODES ==========
let currentVisionMode = 'normal';
const visionStatusSpan = document.getElementById('visionStatus');
const visionIndicatorSpan = document.getElementById('visionIndicator');
const videoWrapperDiv = document.getElementById('videoWrapper');

function setVisionMode(mode) {
    videoWrapperDiv.classList.remove('night-vision-mode', 'infrared-vision-mode', 'predator-vision-mode', 'thermal-vision-mode');
    currentVisionMode = mode;
    const modes = { night: '🌙 Night', infrared: '🔥 Infrared', predator: '🦅 Predator', thermal: '🌡️ Thermal', normal: '👁️ Normal' };
    if (visionStatusSpan) visionStatusSpan.innerHTML = modes[mode] || 'Normal';
    if (visionIndicatorSpan) visionIndicatorSpan.innerHTML = modes[mode] || '👁️ Normal';
    if (mode !== 'normal') videoWrapperDiv.classList.add(`${mode}-vision-mode`);
    showToast(`${modes[mode] || 'Normal'} activated`, '#ff6600');
    if (audioEnabled && mode !== 'normal') speakText(`${mode} vision activated`);
}

// ========== WEBHOOK ==========
let webhookEnabled = false;
let webhookUrl = '';
const webhookStatusSpan = document.getElementById('webhookStatus');
const webhookUrlInput = document.getElementById('webhookUrlInput');
const webhookToggleBtn = document.getElementById('webhookToggleBtn');

function toggleWebhook() {
    webhookEnabled = !webhookEnabled;
    if (webhookEnabled) {
        webhookUrl = webhookUrlInput ? webhookUrlInput.value.trim() : '';
        if (!webhookUrl) { webhookEnabled = false; showToast('Enter webhook URL!', '#ef4444'); return; }
        if (webhookToggleBtn) webhookToggleBtn.innerHTML = '🔔 ON';
        if (webhookStatusSpan) { webhookStatusSpan.innerHTML = 'Enabled'; webhookStatusSpan.style.color = '#10b981'; }
        showToast('Webhook ENABLED', '#10b981');
        //testWebhook();
    } else {
        if (webhookToggleBtn) webhookToggleBtn.innerHTML = '🔔 OFF';
        if (webhookStatusSpan) { webhookStatusSpan.innerHTML = 'Disabled'; webhookStatusSpan.style.color = '#8F9BB3'; }
        showToast('Webhook DISABLED', '#ef4444');
    }
}

async function sendWebhook(sessionId, uniqueId, objectName, confidence, bbox, source, isDanger, modelDisplayName) {
    if (!webhookEnabled || !webhookUrl) return;
    const [x, y, w, h] = bbox;
    const payload = {
        session_id: sessionId, detection_id: uniqueId, event: isDanger ? 'danger_zone_alert' : 'detection_alert',
        timestamp: new Date().toISOString(), vision_mode: currentVisionMode, object: objectName,
        confidence: Math.round(confidence * 100) + '%', position: { x: Math.round(x), y: Math.round(y) },
        size: { width: Math.round(w), height: Math.round(h) }, source: source, model_name: modelDisplayName,
        danger_zone: isDanger, zoom_level: currentZoom
    };
    //try { await fetch(webhookUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }); } catch (e) { }
    await sendWebhookNTFY(JSON.stringify(payload));
}

async function testWebhook() {
    const url = webhookUrlInput ? webhookUrlInput.value.trim() : '';
    if (!url) { showToast('Enter webhook URL', '#ef4444'); return; }
    showToast('Testing webhook...', '#3b82f6');
    //try { await fetch(url, { method: 'HEAD', mode: 'no-cors' }); showToast('Webhook reachable', '#10b981'); } catch (e) { showToast('Test sent', '#f59e0b'); }
    await sendWebhookNTFY("Alert log sent to ntfy group");
}

async function sendWebhookNTFY(payload) {
    const url = webhookUrlInput ? webhookUrlInput.value.trim() : '';
    //https://ntfy.sh/aisafetycompliance
    const topic = url;//+ "aisafetycompliance";

    try {

        const response = await fetch(
            //`https://ntfy.sh/${topic}`,
            `${topic}`,
            {
                method: "POST",
                body: payload
            }
        );

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        showToast('Notification sent!', '#f59e0b');
        console.log("Notification sent!");

    } catch (error) {

        showToast("Notification failed: " + error, '#ef4444');
        console.error("Notification failed:", error);

    }
}

// ========== NOTIFICATIONS ==========
let notificationPermission = false;
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        notificationPermission = permission === 'granted';
        showToast(notificationPermission ? 'Notifications enabled!' : 'Permission denied', notificationPermission ? '#10b981' : '#ef4444');
    }
}
function sendPushNotification(title, body) { if (notificationPermission) try { new Notification(title, { body: body }); } catch (e) { } }
function testNotification() { sendPushNotification('🔔 Test', 'Auto-save recording active!'); testWebhook(); showToast('Test sent!', '#3b82f6'); }

// ========== OFFLINE MODE ==========
let isOffline = false;
const offlineBadge = document.getElementById('offlineBadge');
const offlineStatusSpan = document.getElementById('offlineStatus');
function checkOfflineMode() {
    isOffline = !navigator.onLine;
    if (offlineBadge) offlineBadge.classList.toggle('show', isOffline);
    if (offlineStatusSpan) { offlineStatusSpan.innerHTML = isOffline ? 'ACTIVE' : 'Online'; offlineStatusSpan.style.color = isOffline ? '#f59e0b' : '#10b981'; }
}
window.addEventListener('online', checkOfflineMode);
window.addEventListener('offline', checkOfflineMode);
checkOfflineMode();

// ========== DANGER ZONE ==========
let dangerZonePoints = [], isDrawingZone = false, dangerAlertsEnabled = true, dangerZonePolygon = null, dangerCount = 0;
const canvasElem = document.getElementById('canvas'), canvasCtx = canvasElem ? canvasElem.getContext('2d') : null;

function startDrawingZone() { if (!isStreaming) { showToast('Start camera first!', '#ef4444'); return; } isDrawingZone = true; dangerZonePoints = []; showToast('Click on video to add points', '#ef4444'); const dzs = document.getElementById('dangerZoneStatus'); if (dzs) dzs.innerHTML = 'Drawing...'; }
function addZonePoint(x, y) { if (!isDrawingZone) return; dangerZonePoints.push({ x, y }); showToast(`Point ${dangerZonePoints.length} added`, '#ef4444'); }
function completeDrawingZone() { if (dangerZonePoints.length < 3) { showToast('Need 3+ points!', '#ef4444'); return; } isDrawingZone = false; dangerZonePolygon = [...dangerZonePoints]; const dzs = document.getElementById('dangerZoneStatus'); if (dzs) dzs.innerHTML = 'Active'; const dzi = document.getElementById('dangerzoneInfo'); if (dzi) dzi.innerHTML = '🚧 Zone ACTIVE'; showToast('Danger zone created!', '#ef4444'); }
function clearDangerZone() { dangerZonePoints = []; dangerZonePolygon = null; isDrawingZone = false; const dzs = document.getElementById('dangerZoneStatus'); if (dzs) dzs.innerHTML = 'Inactive'; const dzi = document.getElementById('dangerzoneInfo'); if (dzi) dzi.innerHTML = '🚧 No Zone'; showToast('Zone cleared', '#10b981'); }
function toggleDangerAlerts() { dangerAlertsEnabled = !dangerAlertsEnabled; const btn = document.getElementById('dangerAlertToggleBtn'); if (btn) { btn.innerHTML = dangerAlertsEnabled ? '🔔 ON' : '🔕 OFF'; btn.style.background = dangerAlertsEnabled ? '#2d3a54' : '#ef4444'; } showToast(`Danger alerts ${dangerAlertsEnabled ? 'ON' : 'OFF'}`, dangerAlertsEnabled ? '#10b981' : '#ef4444'); }
function isPointInPolygon(px, py, polygon) { if (!polygon || polygon.length < 3) return false; let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y; const intersect = ((yi > py) != (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi); if (intersect) inside = !inside; } return inside; }
function drawDangerZone() { if (!dangerZonePolygon || dangerZonePolygon.length < 3 || !canvasCtx) return; canvasCtx.beginPath(); canvasCtx.moveTo(dangerZonePolygon[0].x, dangerZonePolygon[0].y); for (let i = 1; i < dangerZonePolygon.length; i++) canvasCtx.lineTo(dangerZonePolygon[i].x, dangerZonePolygon[i].y); canvasCtx.closePath(); canvasCtx.fillStyle = '#ef444430'; canvasCtx.fill(); canvasCtx.strokeStyle = '#ef4444'; canvasCtx.lineWidth = 3; canvasCtx.setLineDash([5, 5]); canvasCtx.stroke(); canvasCtx.setLineDash([]); if (isDrawingZone && dangerZonePoints.length) for (const p of dangerZonePoints) { canvasCtx.beginPath(); canvasCtx.arc(p.x, p.y, 5, 0, 2 * Math.PI); canvasCtx.fillStyle = '#ef4444'; canvasCtx.fill(); } }
function checkDangerZone(sessionId, uniqueId, x, y, w, h, objectName, confidence, modelDisplayName) { if (!dangerZonePolygon || !dangerAlertsEnabled) return false; const cx = x + w / 2, cy = y + h / 2; if (isPointInPolygon(cx, cy, dangerZonePolygon)) { dangerCount++; const dcSpan = document.getElementById('dangerCount'); if (dcSpan) dcSpan.innerText = dangerCount; const alertList = document.getElementById('alertList'); if (alertList && alertList.children.length === 1 && alertList.children[0].innerText.includes('No detections')) alertList.innerHTML = ''; if (alertList) { const alertDiv = document.createElement('div'); alertDiv.className = 'alert-item alert-danger'; alertDiv.innerHTML = `<div><strong>⚠️ DANGER [${sessionId}][${uniqueId}]</strong><br>${objectName} entered!<br>Confidence: ${Math.round(confidence * 100)}%<br>Position: (${Math.round(cx)}, ${Math.round(cy)})<br>Model: ${modelDisplayName}<br>Zoom: ${currentZoom}x<br>🕐 ${new Date().toLocaleTimeString()}</div>`; alertList.insertBefore(alertDiv, alertList.firstChild); while (alertList.children.length > 50) alertList.removeChild(alertList.lastChild); } sendWebhook(sessionId, uniqueId, objectName, confidence, [x, y, w, h], 'danger', true, modelDisplayName); if (notificationPermission) sendPushNotification('⚠️ DANGER ZONE!', `${objectName} entered restricted area! [${modelDisplayName}]`); if (audioEnabled) speakText(`Danger alert! ${objectName} entered the restricted zone!`); return true; } return false; }

// ========== CORE APP ==========
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const statusMsgSpan = document.getElementById('statusMsg');
const camStatusSpan = document.getElementById('camStatus');
const errorMsgDiv = document.getElementById('errorMsg');
const perfInfoSpan = document.getElementById('perfInfo');
const detectionStatusBadgeSpan = document.getElementById('detectionStatusBadge');
const modelBadgeSpan = document.getElementById('modelBadge');
const loadingOverlayDiv = document.getElementById('loadingOverlay');
const loadingProgressBar = document.getElementById('loadingProgress');
const resultsContentDiv = document.getElementById('resultsContent');
const activeModelStatusSpan = document.getElementById('activeModelStatus');
const distanceBadgeSpan = document.getElementById('distanceBadge');
const zoomLevelSpan = document.getElementById('zoomLevel');

if (canvas) canvas.addEventListener('click', (e) => { if (!isDrawingZone || !canvas) return; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height; addZonePoint((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY); });

function updateLoadingStep(step, completed, active) { const el = document.getElementById(`step${step}`); if (el) { if (completed) el.classList.add('completed'); if (active) el.classList.add('active'); } }

let cocoModel = null, poseDetector = null, isStreaming = false, animationId = null, isDetecting = true, stream = null;
let fps = 0, frameCount = 0, lastFpsUpdate = performance.now(), currentCocoPredictions = [], currentPoses = [], currentCamera = 'back', detectionFrameCount = 0, modelsReady = false;
let audioEnabled = true, lastSpoken = {}, currentResolution = '720p', minConfidence = 0.5, currentZoom = 1.0, activeModel = 'coco';
let customModels = [], nextModelId = 1, stats = { humans: 0, animals: 0, vehicles: 0, others: 0, tm: 0, total: 0 };

// Model display names mapping for incremental numbers
let modelDisplayNames = new Map(); // Maps model id to display name like "Model 1", "Model 2"

const resolutionMap = {
    '480p': { width: 640, height: 480, label: 'Fast' },
    '720p': { width: 1280, height: 720, label: 'Balanced' },
    '1080p': { width: 1920, height: 1080, label: 'Full HD' },
    '1440p': { width: 2560, height: 1440, label: '2K' },
    '2160p': { width: 3840, height: 2160, label: '4K Ultra HD' }
};

const SKELETON_CONNECTIONS = [['nose', 'left_eye'], ['nose', 'right_eye'], ['left_eye', 'left_ear'], ['right_eye', 'right_ear'], ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']];

function getCategoryColor(category) {
    switch (category) {
        case 'human': return '#10b981';
        case 'animal': return '#f59e0b';
        case 'vehicle': return '#3b82f6';
        default: return '#9ca3af';
    }
}

function getCategory(className) {
    const lower = className.toLowerCase();
    if (lower === 'person' || lower.includes('human')) return 'human';
    const animals = ['cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'bird'];
    const vehicles = ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'boat', 'airplane', 'train'];
    if (animals.some(a => lower.includes(a))) return 'animal';
    if (vehicles.some(v => lower.includes(v))) return 'vehicle';
    return 'other';
}

// DUAL-COLOR DRAWING FUNCTION FOR CUSTOM MODEL DETECTIONS with model display name
function drawDualColorCustomBox(x, y, w, h, label, conf, category, modelId, modelDisplayName) {
    if (!ctx) return;
    const categoryColor = getCategoryColor(category);

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(x, y, w, h);

    ctx.strokeStyle = categoryColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    ctx.setLineDash([]);

    const icon = category === 'human' ? '👤' : (category === 'vehicle' ? '🚗' : (category === 'animal' ? '🐕' : '📦'));
    const labelText = `${icon} [${modelDisplayName}] ${label} ${Math.round(conf)}%`;
    ctx.font = 'bold 10px system-ui';
    const tw = ctx.measureText(labelText).width;

    ctx.fillStyle = '#a855f7CC';
    ctx.fillRect(x, y - 20, tw + 12, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, x + 6, y - 7);

    ctx.fillStyle = '#a855f7';
    ctx.fillRect(x, y - 2, 8, 4);

    addUnifiedLog(label, conf / 100, [x, y, w, h], 'custom', category, modelDisplayName);
}

function drawCocoBox(x, y, w, h, category, label, conf) {
    if (!ctx) return;
    const color = getCategoryColor(category);

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    const icon = category === 'human' ? '👤' : (category === 'vehicle' ? '🚗' : (category === 'animal' ? '🐕' : '📦'));
    const labelText = `${icon} ${label} ${Math.round(conf)}%`;
    ctx.font = 'bold 12px system-ui';
    const tw = ctx.measureText(labelText).width;
    ctx.fillStyle = color + 'CC';
    ctx.fillRect(x, y - 20, tw + 10, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, x + 5, y - 7);

    addUnifiedLog(label, conf / 100, [x, y, w, h], 'coco', category, 'COCO-SSD');
}

function drawHumanSkeleton(pose) {
    if (!pose || !pose.keypoints || !ctx) return;
    const keypointMap = {};
    pose.keypoints.forEach(kp => { if (kp.name) keypointMap[kp.name] = kp; });

    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);

    SKELETON_CONNECTIONS.forEach(conn => {
        const a = keypointMap[conn[0]], b = keypointMap[conn[1]];
        if (a && b && a.score > 0.3 && b.score > 0.3) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    });

    pose.keypoints.forEach(kp => {
        if (kp.score > 0.3 && kp.x && kp.y) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
    });
}

function drawHumanWithSkeleton(x, y, w, h, conf, pose) {
    if (!ctx) return;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    const label = `👤 Human ${Math.round(conf)}%`;
    ctx.font = 'bold 12px system-ui';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = '#10b981CC';
    ctx.fillRect(x, y - 20, tw + 10, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 5, y - 7);

    if (pose) drawHumanSkeleton(pose);

    addUnifiedLog('Person', conf / 100, [x, y, w, h], 'coco', 'human', 'COCO-SSD');
}

// Add unified log with model display name
function addUnifiedLog(objectName, confidence, bbox, source, category, modelDisplayName) {
    const sessionId = getCurrentSessionId();
    const uniqueId = generateUniqueId();
    const [x, y, width, height] = bbox;
    const confidencePercent = Math.round(confidence * 100);

    const resultsPanel = document.getElementById('resultsContent');
    if (resultsPanel) {
        if (resultsPanel.innerHTML.includes('No detections yet')) resultsPanel.innerHTML = '';
        const color = confidencePercent > 70 ? '#10b981' : (confidencePercent > 40 ? '#f59e0b' : '#ef4444');
        const sourceTag = source === 'coco' ? '<span class="source-tag source-coco">COCO-SSD</span>' : `<span class="source-tag source-custom">${modelDisplayName}</span>`;
        const newItem = document.createElement('div');
        newItem.className = 'result-item';
        newItem.style.animation = 'slideIn 0.3s ease';
        newItem.innerHTML = `<div class="result-label"><span style="background:#a855f7; color:white; padding:2px 6px; border-radius:12px; font-size:0.55rem; margin-right:6px;">🆔 ${sessionId}</span><span style="background:#ec489a; color:white; padding:2px 6px; border-radius:12px; font-size:0.55rem; margin-right:6px;">🔢 ${uniqueId}</span>${sourceTag}<strong>${objectName}</strong></div><div style="display:flex; align-items:center; gap:10px;"><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${confidencePercent}%; background:${color};"></div></div><span class="result-confidence" style="color:${color};">${confidencePercent}%</span><span style="font-size:0.5rem;">🔍 ${currentZoom}x</span></div>`;
        resultsPanel.insertBefore(newItem, resultsPanel.firstChild);
        while (resultsPanel.children.length > 20) resultsPanel.removeChild(resultsPanel.lastChild);
    }

    const alertList = document.getElementById('alertList');
    if (alertList && alertList.children.length === 1 && alertList.children[0].innerText.includes('No detections')) alertList.innerHTML = '';
    const icon = source === 'coco' ? '🎯' : '🧠';
    const sourceName = source === 'coco' ? 'COCO-SSD' : modelDisplayName;
    const sourceColor = source === 'coco' ? '#3b82f6' : '#a855f7';
    const alertType = category === 'human' ? 'critical' : (category === 'vehicle' ? 'warning' : 'info');
    let confColor = confidencePercent >= 70 ? '#10b981' : (confidencePercent >= 40 ? '#f59e0b' : '#ef4444');
    if (alertList) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-item alert-${alertType}`;
        alertDiv.innerHTML = `<div><div class="alert-title"><span class="source-tag" style="background:${sourceColor};">${sourceName}</span><strong>🆔 ${sessionId}</strong><span style="margin-left:6px;">🔢 ${uniqueId}</span><span style="margin-left:6px;">${icon} ${objectName}</span><span style="color:${confColor}; margin-left:auto;">${confidencePercent}%</span></div><div class="alert-details"><span class="detail-row">📍 (${Math.round(x)}, ${Math.round(y)})</span><span class="detail-row">📐 ${Math.round(width)}×${Math.round(height)}</span><span class="detail-row">🔍 ${currentZoom}x</span><span class="detail-row">🎨 ${currentVisionMode.toUpperCase()}</span><span class="detail-row">🗂️ Model: ${modelDisplayName}</span><span class="detail-row">🕐 ${new Date().toLocaleTimeString()}</span></div></div>`;
        alertList.insertBefore(alertDiv, alertList.firstChild);
        while (alertList.children.length > 500) alertList.removeChild(alertList.lastChild);
    }

    checkDangerZone(sessionId, uniqueId, x, y, width, height, objectName, confidence, modelDisplayName);
    if (confidencePercent > hit_threshold) {
        sendWebhook(sessionId, uniqueId, objectName, confidence, bbox, source, false, modelDisplayName);
    }
    if (notificationPermission && (category === 'human' || confidencePercent > hit_threshold)) {
        sendPushNotification(`⚠️ ${objectName.toUpperCase()} [${sessionId}][${uniqueId}]`, `${sourceName} detected ${objectName} with ${confidencePercent}% confidence at ${currentZoom}x zoom`);
    }
    if (audioEnabled && !objectName.includes('Test') && confidencePercent >= hit_threshold) speakText(`${sourceName} - ${objectName} with ${confidencePercent}% confidence`);

    const totalSpan = document.getElementById('totalDetections');
    if (totalSpan) totalSpan.innerText = (parseInt(totalSpan.innerText) || 0) + 1;
    if (category === 'human') { const hc = document.getElementById('humanCount'); if (hc) hc.innerText = (parseInt(hc.innerText) || 0) + 1; stats.humans++; }
    else if (category === 'animal') { const ac = document.getElementById('animalCount'); if (ac) ac.innerText = (parseInt(ac.innerText) || 0) + 1; stats.animals++; }
    else if (category === 'vehicle') { const vc = document.getElementById('vehicleCount'); if (vc) vc.innerText = (parseInt(vc.innerText) || 0) + 1; stats.vehicles++; }
    else { const oc = document.getElementById('otherCount'); if (oc) oc.innerText = (parseInt(oc.innerText) || 0) + 1; stats.others++; }
    if (source === 'custom') { const tc = document.getElementById('tmCount'); if (tc) tc.innerText = (parseInt(tc.innerText) || 0) + 1; stats.tm++; }
    stats.total++;
    updateRiskScore();
}

function updateRiskScore() {
    const risk = Math.min(100, (stats.humans * 5) + (stats.vehicles * 3) + (dangerCount * 10));
    const rs = document.getElementById('riskScore');
    if (rs) rs.innerText = risk;
}

function updateDistanceAndZoom() {
    const zoomSlider = document.getElementById('zoomSlider');
    if (!zoomSlider) return;
    const zoom = parseFloat(zoomSlider.value);
    currentZoom = zoom;
    const zoomSpan = document.getElementById('zoomValue');
    if (zoomSpan) zoomSpan.innerText = zoom + 'x';
    if (zoomLevelSpan) zoomLevelSpan.innerText = zoom + 'x';

    const baseDistance = 500;
    const estimatedDist = Math.round(baseDistance / Math.sqrt(zoom));
    const estSpan = document.getElementById('estimatedDistance');
    if (estSpan) estSpan.innerHTML = `~${estimatedDist}m`;
    const rangeSpan = document.getElementById('rangeIndicator');
    if (rangeSpan) rangeSpan.innerHTML = estimatedDist + 'm';
    if (distanceBadgeSpan) distanceBadgeSpan.innerHTML = `📏 ~${estimatedDist}m`;

    const accSpan = document.getElementById('accuracyIndicator');
    if (accSpan) {
        if (zoom >= 8) accSpan.innerHTML = '🔭 Super Zoom - Max Range';
        else if (zoom >= 5) accSpan.innerHTML = '🔭 Extreme Zoom - Distant Objects';
        else if (zoom >= 3) accSpan.innerHTML = '🎯 Enhanced Zoom';
        else accSpan.innerHTML = '🎯 Wide View';
    }
    const fovSpan = document.getElementById('fovStatus');
    if (fovSpan) fovSpan.innerHTML = zoom > 5 ? 'Tunnel Vision' : (zoom > 3 ? 'Zoomed' : (zoom > 1.5 ? 'Medium' : 'Wide'));

    showToast(`Zoom: ${zoom}x - Distance: ~${estimatedDist}m`, '#3b82f6');
}

function setCameraResolution(res) {
    currentResolution = res;
    document.querySelectorAll('.res-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    const resInfo = resolutionMap[res] || resolutionMap['1080p'];
    showToast(`Camera set to ${resInfo.label} mode - ${resInfo.width}x${resInfo.height}`, '#10b981');
    if (isStreaming) { stopCamera(); setTimeout(startCamera, 500); }
}

function updateConfidence() { const cs = document.getElementById('confidenceSlider'); if (!cs) return; minConfidence = parseFloat(cs.value); const cv = document.getElementById('confidenceValue'); if (cv) cv.innerHTML = Math.round(minConfidence * 100) + '%'; showToast(`Threshold: ${Math.round(minConfidence * 100)}%`, '#3b82f6'); }

function setActiveModel(model) { activeModel = model; document.querySelectorAll('.model-choice-btn').forEach(btn => btn.classList.remove('active')); const btn = document.querySelector(`.model-choice-btn.${model}`); if (btn) btn.classList.add('active'); if (activeModelStatusSpan) activeModelStatusSpan.innerHTML = `Current: ${model.toUpperCase()}`; if (modelBadgeSpan) modelBadgeSpan.innerHTML = { coco: '🎯 COCO', custom: '🧠 CUSTOM', both: '🔄 BOTH' }[model]; }

function speakText(t) { if (!audioEnabled) return; const now = Date.now(); if (lastSpoken[t] && now - lastSpoken[t] < 3000) return; lastSpoken[t] = now; try { const u = new SpeechSynthesisUtterance(t); u.rate = 0.9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) { } }
function toggleAudio() { audioEnabled = !audioEnabled; const label = document.getElementById('audioToggleLabel'); if (label) label.innerHTML = audioEnabled ? '🔇 Mute' : '🔊 Unmute'; showToast(`Audio ${audioEnabled ? 'ENABLED' : 'DISABLED'}`, audioEnabled ? '#10b981' : '#ef4444'); if (audioEnabled) speakText('Audio enabled'); else window.speechSynthesis.cancel(); }
function clearLogs() {
    const alertList = document.getElementById('alertList');
    if (alertList) alertList.innerHTML = '<div style="color:#9ca3af;text-align:center;padding:20px;">No detections yet</div>';
    const resultsPanel = document.getElementById('resultsContent');
    if (resultsPanel) resultsPanel.innerHTML = '<div style="color:#9ca3af;text-align:center;">No detections yet</div>';
    sessionDetectionCounter = 0; dangerCount = 0; stats = { humans: 0, animals: 0, vehicles: 0, others: 0, tm: 0, total: 0 };
    const ids = ['dangerCount', 'humanCount', 'animalCount', 'vehicleCount', 'otherCount', 'tmCount', 'totalDetections'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '0'; });
    updateRiskScore(); startNewScanSession(); showToast('Logs cleared', '#3b82f6'); if (audioEnabled) speakText('Logs cleared');
}
function showToast(msg, color) { const t = document.createElement('div'); t.className = 'toast-notification'; t.textContent = msg; t.style.background = color; document.body.appendChild(t); setTimeout(() => t.remove(), 2000); }

// ALERT SEARCH FUNCTIONS
function searchAlerts() {
    const searchInput = document.getElementById('alertSearchInput');
    const alertList = document.getElementById('alertList');
    const searchCount = document.getElementById('alertSearchCount');
    if (!searchInput || !alertList) return;
    const searchTerm = searchInput.value.toLowerCase().trim();
    const alertItems = alertList.querySelectorAll('.alert-item');
    let visibleCount = 0;
    alertItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!searchTerm || text.includes(searchTerm)) {
            item.classList.remove('alert-hidden');
            if (searchTerm) item.classList.add('alert-search-highlight'); else item.classList.remove('alert-search-highlight');
            visibleCount++;
        } else {
            item.classList.add('alert-hidden');
            item.classList.remove('alert-search-highlight');
        }
    });
    if (searchCount) searchCount.textContent = searchTerm && alertItems.length > 0 ? `🔍 ${visibleCount} of ${alertItems.length}` : '';
}
function quickSearch(term) {
    const searchInput = document.getElementById('alertSearchInput');
    if (searchInput) { searchInput.value = term; searchAlerts(); searchInput.focus(); }
}
function clearSearch() {
    const searchInput = document.getElementById('alertSearchInput');
    if (searchInput) { searchInput.value = ''; searchAlerts(); }
}
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (document.activeElement === document.body || document.activeElement === document.getElementById('alertList')) {
            e.preventDefault();
            const searchInput = document.getElementById('alertSearchInput');
            if (searchInput) { searchInput.focus(); searchInput.select(); }
        }
    }
    if (e.key === 'Escape' && document.activeElement === document.getElementById('alertSearchInput')) {
        clearSearch();
        document.getElementById('alertSearchInput').blur();
    }
});

async function drawAllDetections(cocoDets, customDets, poses) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentZoom > 1.0 && isStreaming && video) {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const zoomWidth = canvas.width / currentZoom;
        const zoomHeight = canvas.height / currentZoom;
        const sourceX = cx - zoomWidth / 2;
        const sourceY = cy - zoomHeight / 2;
        ctx.drawImage(video, sourceX, sourceY, zoomWidth, zoomHeight, 0, 0, canvas.width, canvas.height);
    } else if (video) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    drawDangerZone();

    const poseMap = []; if (poses) poses.forEach(pose => { const nose = pose.keypoints?.find(k => k.name === 'nose'); if (nose && nose.score > 0.3) poseMap.push({ pose, nx: nose.x, ny: nose.y }); });

    if ((activeModel === 'coco' || activeModel === 'both') && cocoDets) {
        for (const pred of cocoDets) {
            if (pred.score < minConfidence) continue;
            const [x, y, w, h] = pred.bbox;
            const category = getCategory(pred.class);
            const conf = pred.score * 100;
            if (category === 'human') {
                let matchPose = null; const cx = x + w / 2, cy = y + h / 2;
                for (const p of poseMap) { if (Math.abs(p.nx - cx) < w && Math.abs(p.ny - cy) < h) { matchPose = p.pose; break; } }
                drawHumanWithSkeleton(x, y, w, h, conf, matchPose);
            } else { drawCocoBox(x, y, w, h, category, pred.class, conf); }
        }
    }
    if ((activeModel === 'custom' || activeModel === 'both') && customDets && customDets.length) {
        for (const det of customDets) {
            if (det.predictions) {
                for (const p of det.predictions) {
                    if (p.score < minConfidence) continue;
                    const category = getCategory(p.class);
                    const modelDisplayName = modelDisplayNames.get(det.modelId) || `Model ${det.modelId + 1}`;
                    drawDualColorCustomBox(0, 0, canvas.width, canvas.height, p.class, p.score * 100, category, det.modelId, modelDisplayName);
                }
            }
        }
    }
    if ((!cocoDets || cocoDets.length === 0) && (!customDets || customDets.length === 0) && isStreaming && isDetecting && ctx) {
        ctx.font = '12px system-ui'; ctx.fillStyle = '#8F9BB3';
        ctx.fillText(`No objects detected (Zoom: ${currentZoom}x)`, canvas.width / 2 - 100, canvas.height / 2);
    }
}

let modelCounter = 1;
let globalModelIdCounter = 1; // Track the next available model number globally

async function loadSpecificModel(id) {
    const urlInput = document.getElementById(`modelUrl${id}`); if (!urlInput) return;
    let url = urlInput.value.trim(); const statusDiv = document.getElementById(`modelStatus${id}`);
    if (!url) { showToast('Enter URL', '#ef4444'); return; }
    if (!url.endsWith('/')) url += '/';
    if (statusDiv) statusDiv.innerHTML = 'Loading...';
    try {
        const model = await tmImage.load(url + 'model.json', url + 'metadata.json');
        const resp = await fetch(url + 'metadata.json'); const meta = await resp.json(); const labels = meta.labels || [];
        const idx = customModels.findIndex(m => m.id === id);
        let modelDisplayNumber;
        if (idx >= 0) {
            modelDisplayNumber = customModels[idx].modelNumber;
            customModels[idx] = { id, model, labels, url, modelNumber: modelDisplayNumber };
        } else {
            modelDisplayNumber = globalModelIdCounter++;
            customModels.push({ id, model, labels, url, modelNumber: modelDisplayNumber });
            modelDisplayNames.set(id, `Model ${modelDisplayNumber}`);
        }
        if (statusDiv) {
            statusDiv.innerHTML = `✅ Loaded: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? '...' : ''} (Model ${modelDisplayNumber})`;
            statusDiv.className = 'model-status-text loaded';
        }
        updateUI();
        showToast(`Model ${modelDisplayNumber} loaded with ${labels.length} classes! Dual-color boxes active.`, '#10b981');
    } catch (err) {
        if (statusDiv) { statusDiv.innerHTML = '❌ Load failed'; statusDiv.className = 'model-status-text error'; }
        showToast('Model load failed - Check URL and CORS', '#ef4444');
    }
}

function addModelEntry() {
    const list = document.getElementById('modelsList');
    if (!list) return;
    const newId = nextModelId++;
    const modelNumber = globalModelIdCounter;
    const div = document.createElement('div');
    div.className = 'model-entry';
    div.id = `modelEntry${newId}`;
    div.innerHTML = `<div class="model-entry-header">
                <span class="model-name">Model ${modelNumber}</span>
                <div>
                    <input type="text" class="model-url-input" id="modelUrl${newId}" placeholder="https://teachablemachine.withgoogle.com/models/YOUR_ID/">
                    <button class="model-load-btn" onclick="loadSpecificModel(${newId})">Load</button>
                    <button class="model-remove-btn" onclick="removeModel(${newId})">Remove</button>
                </div>
            </div>
            <div class="model-status-text" id="modelStatus${newId}">Not loaded - Enter URL and click Load</div>`;
    list.appendChild(div);
    showToast(`Model ${modelNumber} added - Enter URL and click Load`, '#10b981');
}

function removeModel(id) {
    const el = document.getElementById(`modelEntry${id}`);
    if (el) el.remove();
    const idx = customModels.findIndex(m => m.id === id);
    if (idx >= 0) customModels.splice(idx, 1);
    modelDisplayNames.delete(id);
    updateUI();
    showToast('Model removed', '#3b82f6');
}

async function runAllCustomModels(videoEl) {
    const results = [];
    for (let i = 0; i < customModels.length; i++) {
        const m = customModels[i];
        if (m.model) {
            try {
                const preds = await m.model.predict(videoEl);
                const filtered = preds.filter(p => p.probability > minConfidence).map(p => ({ class: p.className, score: p.probability, bbox: [0, 0, canvas ? canvas.width : 640, canvas ? canvas.height : 480] }));
                if (filtered.length) results.push({ predictions: filtered, modelId: m.id });
            } catch (e) { }
        }
    }
    return results;
}

let uploadedImageData = null;
const uploadInputElem = document.getElementById('uploadInput'), uploadPreview = document.getElementById('uploadPreview'), uploadedImageElem = document.getElementById('uploadedImage');
if (uploadInputElem) uploadInputElem.addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { uploadedImageData = ev.target.result; if (uploadedImageElem) uploadedImageElem.src = uploadedImageData; if (uploadPreview) uploadPreview.style.display = 'block'; }; reader.readAsDataURL(file); });
async function analyzeUploadedImage() {
    if (!uploadedImageData) { showToast('Upload image first', '#ef4444'); return; } if (!cocoModel) { showToast('Models loading...', '#f59e0b'); return; }
    startNewScanSession(); showToast(`New scan session: ${currentSessionId}`, '#a855f7');
    await new Promise(r => setTimeout(r, 100));
    const img = new Image(); img.src = uploadedImageData; img.onload = async () => { if (canvas) { canvas.width = img.width; canvas.height = img.height; if (ctx) ctx.drawImage(img, 0, 0); } try { const cocoRes = (activeModel === 'coco' || activeModel === 'both') ? await cocoModel.detect(img) : []; let customRes = []; if (activeModel === 'custom' || activeModel === 'both') { for (const m of customModels) { if (m.model) { const preds = await m.model.predict(img); const filtered = preds.filter(p => p.probability > minConfidence).map(p => ({ class: p.className, score: p.probability, bbox: [0, 0, canvas ? canvas.width : 640, canvas ? canvas.height : 480] })); if (filtered.length) customRes.push({ predictions: filtered, modelId: m.id }); } } } let poses = []; if ((activeModel === 'coco' || activeModel === 'both') && cocoRes.some(p => getCategory(p.class) === 'human') && poseDetector) { try { poses = await poseDetector.estimatePoses(img); } catch (e) { } } await drawAllDetections(cocoRes, customRes, poses); showToast(`Analysis complete! Found ${cocoRes.length + customRes.reduce((s, r) => s + r.predictions.length, 0)} objects [Zoom: ${currentZoom}x]`, '#10b981'); } catch (e) { showToast('Analysis failed', '#ef4444'); } };
}
function clearUploadedImage() { uploadedImageData = null; if (uploadedImageElem) uploadedImageElem.src = ''; if (uploadPreview) uploadPreview.style.display = 'none'; if (uploadInputElem) uploadInputElem.value = ''; if (!isStreaming && canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); } }

async function detectFrame() {
    if (!isStreaming || !cocoModel || !isDetecting) { animationId = requestAnimationFrame(detectFrame); return; }
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) { animationId = requestAnimationFrame(detectFrame); return; }
    startNewScanSession();
    try {
        if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
        const start = performance.now();
        currentCocoPredictions = (activeModel === 'coco' || activeModel === 'both') ? await cocoModel.detect(video) : [];
        let customResults = []; if (activeModel === 'custom' || activeModel === 'both') customResults = await runAllCustomModels(video);
        let hasHuman = (activeModel === 'coco' || activeModel === 'both') && currentCocoPredictions.some(p => getCategory(p.class) === 'human');
        if (hasHuman && poseDetector) { try { currentPoses = await poseDetector.estimatePoses(video); } catch (e) { currentPoses = []; } } else { currentPoses = []; }
        await drawAllDetections(currentCocoPredictions, customResults, currentPoses);
        const perf = performance.now() - start;
        if (detectionFrameCount % 30 === 0 && perfInfoSpan) perfInfoSpan.innerHTML = `⚡ ${Math.round(perf)}ms | ZOOM:${currentZoom}x | ${currentVisionMode}`;
        detectionFrameCount++; if (detectionStatusBadgeSpan) detectionStatusBadgeSpan.innerHTML = '🟢 DETECTING';
    } catch (err) { console.error(err); }
    frameCount++; const now = performance.now(); if (now - lastFpsUpdate >= 1000) { fps = frameCount; frameCount = 0; lastFpsUpdate = now; const fpsc = document.getElementById('fpsCounter'); if (fpsc) fpsc.innerText = fps; }
    animationId = requestAnimationFrame(detectFrame);
}

async function switchCamera(type) { if (stream) stream.getTracks().forEach(t => t.stop()); const facingMode = type === 'back' ? 'environment' : 'user'; const res = resolutionMap[currentResolution] || resolutionMap['1080p']; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facingMode }, width: { ideal: res.width }, height: { ideal: res.height } } }); if (video) video.srcObject = stream; await video.play(); isStreaming = true; currentCamera = type; const backBtn = document.getElementById('backCameraBtn'); if (backBtn) backBtn.classList.toggle('active', type === 'back'); const frontBtn = document.getElementById('frontCameraBtn'); if (frontBtn) frontBtn.classList.toggle('active', type === 'front'); if (camStatusSpan) camStatusSpan.innerHTML = `✅ ${type.toUpperCase()} Camera (${res.label})`; if (detectionStatusBadgeSpan) detectionStatusBadgeSpan.innerHTML = '🟢 DETECTING'; } catch (err) { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } }); if (video) video.srcObject = stream; await video.play(); isStreaming = true; } catch (e) { showToast('Camera switch failed', '#ef4444'); } } }
async function startCamera() { if (isStreaming) return; if (!cocoModel || !poseDetector) { showToast('Models loading...', '#f59e0b'); return; } const res = resolutionMap[currentResolution] || resolutionMap['1080p']; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: res.width }, height: { ideal: res.height } } }); if (video) video.srcObject = stream; await video.play(); isStreaming = true; currentCamera = 'back'; if (camStatusSpan) camStatusSpan.innerHTML = `✅ BACK Camera (${res.label})`; if (detectionStatusBadgeSpan) detectionStatusBadgeSpan.innerHTML = '🟢 DETECTING'; if (statusMsgSpan) statusMsgSpan.innerHTML = `Camera active - ${res.label} mode | 10x Zoom ready | Model IDs shown in logs`; startRecordBtn.disabled = false; const stopBtn = document.getElementById('stopCamBtn'); if (stopBtn) stopBtn.disabled = false; const pauseBtn = document.getElementById('pauseBtn'); if (pauseBtn) pauseBtn.disabled = false; detectFrame(); } catch (err) { try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); if (video) video.srcObject = stream; await video.play(); isStreaming = true; detectFrame(); } catch (e) { if (camStatusSpan) camStatusSpan.innerHTML = '❌ Failed'; showToast('Camera access denied', '#ef4444'); } } }
function stopCamera() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } if (video) video.srcObject = null; isStreaming = false; if (animationId) { cancelAnimationFrame(animationId); animationId = null; } if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); if (camStatusSpan) camStatusSpan.innerHTML = '⚫ Camera Off'; if (detectionStatusBadgeSpan) detectionStatusBadgeSpan.innerHTML = '⚫ OFF'; startRecordBtn.disabled = true; stopRecordBtn.disabled = true; const stopBtn = document.getElementById('stopCamBtn'); if (stopBtn) stopBtn.disabled = true; const pauseBtn = document.getElementById('pauseBtn'); if (pauseBtn) pauseBtn.disabled = true; }
function toggleDetection() { isDetecting = !isDetecting; if (detectionStatusBadgeSpan) detectionStatusBadgeSpan.innerHTML = isDetecting ? '🟢 DETECTING' : '⏸️ PAUSED'; if (!isDetecting && canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); } }
function takeScreenshot() { if (!isStreaming) { showToast('Start camera first', '#ef4444'); return; } if (!canvas) return; const link = document.createElement('a'); link.download = `safety-zoom${currentZoom}-${Date.now()}-${currentVisionMode}.png`; link.href = canvas.toDataURL(); link.click(); showToast(`Screenshot saved (${currentZoom}x zoom)`, '#10b981'); }
function generateReport() { const loaded = customModels.filter(m => m.model); let report = `AI SAFETY SENTINEL REPORT\nTime: ${new Date().toLocaleString()}\nActive Model: ${activeModel.toUpperCase()}\nCurrent Session ID: ${currentSessionId || 'None'}\nZoom Level: ${currentZoom}x\nVision Mode: ${currentVisionMode.toUpperCase()}\nCamera Resolution: ${resolutionMap[currentResolution]?.label || '1080p'}\nTotal Detections: ${sessionDetectionCounter}\nRecordings: ${recordings.length}\nWebhook: ${webhookEnabled ? 'ON' : 'OFF'}\nDanger Zone: ${dangerZonePolygon ? 'ACTIVE' : 'INACTIVE'}\nOffline: ${isOffline ? 'ACTIVE' : 'ONLINE'}\nCustom Models Loaded: ${loaded.length}\nCustom Model IDs: ${customModels.map(m => `Model ${m.modelNumber}`).join(', ') || 'None'}\n\nCUSTOM: Purple dashed outer + Category inner (Model ID shown in logs)\nCOCO-SSD: Solid category color\n\nHumans: ${stats.humans}\nVehicles: ${stats.vehicles}\nAnimals: ${stats.animals}\nTotal: ${stats.total}`; const blob = new Blob([report], { type: 'text/plain' }); const link = document.createElement('a'); link.download = `report-zoom${currentZoom}-${Date.now()}.txt`; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); showToast('Report exported', '#10b981'); }

function updateUI() {
    const tms = document.getElementById('tmCountStatus'); if (tms) tms.innerHTML = customModels.filter(m => m.model !== null).length;
    if (modelsReady) { const scb = document.getElementById('startCamBtn'); if (scb) scb.disabled = false; const stb = document.getElementById('stopCamBtn'); if (stb) stb.disabled = !isStreaming; const pb = document.getElementById('pauseBtn'); if (pb) pb.disabled = !isStreaming; }
}

const zoomSlider = document.getElementById('zoomSlider'); if (zoomSlider) zoomSlider.addEventListener('input', e => { currentZoom = parseFloat(e.target.value); updateDistanceAndZoom(); });
const confidenceSlider = document.getElementById('confidenceSlider'); if (confidenceSlider) confidenceSlider.addEventListener('input', e => { minConfidence = parseFloat(e.target.value); updateConfidence(); });

async function loadAllModels() {
    if (loadingOverlayDiv) loadingOverlayDiv.style.display = 'flex';
    const loadingDetail = document.getElementById('loadingDetail');
    if (loadingProgressBar) loadingProgressBar.style.width = '5%';
    if (loadingDetail) loadingDetail.innerHTML = 'Initializing TensorFlow.js...';
    updateLoadingStep(1, false, true);
    await tf.ready();
    updateLoadingStep(1, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '10%';

    if (loadingDetail) loadingDetail.innerHTML = 'Loading COCO-SSD (80 classes)...';
    updateLoadingStep(2, false, true);
    cocoModel = await cocoSsd.load();
    const cs = document.getElementById('cocoStatus'); if (cs) cs.innerHTML = '✅ Ready';
    updateLoadingStep(2, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '20%';

    if (loadingDetail) loadingDetail.innerHTML = 'Loading MoveNet Pose (17 keypoints)...';
    updateLoadingStep(3, false, true);
    poseDetector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true });
    const ps = document.getElementById('skeletonStatus'); if (ps) ps.innerHTML = '✅ Ready';
    updateLoadingStep(3, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '30%';

    if (loadingDetail) loadingDetail.innerHTML = 'Preparing Machine Learning Pipeline...';
    updateLoadingStep(4, false, true);
    await new Promise(r => setTimeout(r, 300));
    updateLoadingStep(4, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '40%';

    if (loadingDetail) loadingDetail.innerHTML = 'Configuring Offline & Long Range Detection...';
    updateLoadingStep(5, false, true);
    await new Promise(r => setTimeout(r, 200));
    updateLoadingStep(5, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '50%';

    if (loadingDetail) loadingDetail.innerHTML = 'Setting up Webhook Notification System...';
    updateLoadingStep(6, false, true);
    await new Promise(r => setTimeout(r, 200));
    updateLoadingStep(6, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '60%';

    // if (loadingDetail) loadingDetail.innerHTML = 'Initializing Vision Modes & Danger Zone...';
    // updateLoadingStep(7, false, true);
    // await new Promise(r => setTimeout(r, 200));
    // updateLoadingStep(7, true, false);
    // if (loadingProgressBar) loadingProgressBar.style.width = '70%';

    if (loadingDetail) loadingDetail.innerHTML = 'Loading Object Analyzing System...';
    updateLoadingStep(8, false, true);
    await new Promise(r => setTimeout(r, 250));
    updateLoadingStep(8, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '80%';

    // if (loadingDetail) loadingDetail.innerHTML = 'Activating Video Recording System...';
    // updateLoadingStep(9, false, true);
    // await new Promise(r => setTimeout(r, 200));
    // updateLoadingStep(9, true, false);
    // if (loadingProgressBar) loadingProgressBar.style.width = '87%';

    if (loadingDetail) loadingDetail.innerHTML = 'Preparing Alerts Logging with Model IDs...';
    updateLoadingStep(10, false, true);
    await new Promise(r => setTimeout(r, 200));
    updateLoadingStep(10, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '94%';

    if (loadingDetail) loadingDetail.innerHTML = 'Starting Real-Time Stream Processing...';
    updateLoadingStep(11, false, true);
    await new Promise(r => setTimeout(r, 250));
    updateLoadingStep(11, true, false);
    if (loadingProgressBar) loadingProgressBar.style.width = '100%';

    if (loadingDetail) loadingDetail.innerHTML = '✅ ALL SYSTEMS OPERATIONAL! 10x Zoom + Model IDs in Logs!';

    startNewScanSession();
    const modelUrl = document.getElementById('modelUrl0');
    if (modelUrl && modelUrl.value) { setTimeout(() => { loadSpecificModel(0); }, 500); }
    modelsReady = true; updateDistanceAndZoom(); updateUI();
    setTimeout(() => {
        if (loadingOverlayDiv) loadingOverlayDiv.style.display = 'none';
        if (statusMsgSpan) statusMsgSpan.innerHTML = 'Ready! 10x Zoom | Each custom model has a unique ID shown in logs';
        showToast('All systems ready! Model IDs will appear in detection logs!', '#10b981');
        if (audioEnabled) speakText('All systems ready. Each custom model has a unique ID shown in detection logs.');
    }, 1000);
}
loadAllModels();
window.addEventListener('beforeunload', () => { if (stream) stream.getTracks().forEach(t => t.stop()); if (animationId) cancelAnimationFrame(animationId); window.speechSynthesis.cancel(); });

