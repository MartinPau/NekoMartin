let fullData = null;
let globalChartInstances = [];
let currentAudio = null;

// Coordinates & alignment for nodes relative to hologram wrapper (50/50 is center)
const NODE_MAP = {
    'hjarta_och_cirkulation': { label: 'HEART_SYS',  top: '28%', left: '54%', align: 'right' },
    'ekg':                    { label: 'EKG_RHYTHM', top: '35%', left: '46%', align: 'left' },
    'kropp':                  { label: 'BODY_COMP',  top: '43%', left: '40%', align: 'left' },
    'diabetes':               { label: 'METABOLIC',  top: '49%', left: '51%', align: 'right' },
    'blodfetter':             { label: 'LIPID_PRO',  top: '56%', left: '58%', align: 'right' },
    'immunforsvar':           { label: 'IMMUNE_DEF', top: '15%', left: '50%', align: 'right' },
    'hematologi':             { label: 'HEMA_SYS',   top: '63%', left: '45%', align: 'left' },
    'hud':                    { label: 'DERM_SCAN',  top: '77%', left: '53%', align: 'right' }
};

// Maps each EKG metric to: which normalized X range to highlight + label
const ECG_SEGMENT_MAP = {
    //  x-ranges mapped to PATH coordinates:
    //  TP(0-0.08) | P(0.08-0.18) | PR-seg(0.18-0.22) | Q(0.22-0.26) | R(0.26-0.31) | S(0.31-0.36) | ST(0.36-0.46) | T(0.46-0.68) | TP(0.68-1)
    'puls':                { segments: [[0.00, 1.00]], label: 'HEART RATE', color: '#00E5FF',
                             desc: 'The full cardiac cycle. Rate reflects the number of complete P-QRS-T sequences per minute.' },
    'overledningstid':     { segments: [[0.08, 0.31]], label: 'PR INTERVAL', color: '#B500FF',
                             desc: 'Time from start of P wave to start of QRS complex. Prolonged PR > 200 ms indicates a first-degree atrioventricular conduction block.' },
    'kammaraktiveringstid':{ segments: [[0.22, 0.36]], label: 'QRS COMPLEX', color: '#FF5E00',
                             desc: 'Duration of ventricular depolarization (Q through S). A wide QRS > 120 ms suggests bundle branch block or aberrant conduction.' },
    'aterhamtningstid':    { segments: [[0.22, 0.68]], label: 'QT INTERVAL', color: '#00FF88',
                             desc: 'Time from QRS onset to end of T wave — the full ventricular depolarization + repolarization cycle. QT > 440 ms (men) / 460 ms (women) may indicate arrhythmia risk.' },
    'hjartljudsinspelning':{ segments: [[0.68, 1.00]], label: 'TP BASELINE', color: '#FFD600',
                             desc: 'The isoelectric silence between beats. Irregularity here can indicate atrial fibrillation or ectopic pacemaker activity.' },
};

let currentECGHighlight = null; // key into ECG_SEGMENT_MAP
let ecgAnimId = null;

const ANIMATION_MAP = {
    // EKG Wave
    'puls': 'ekg-wave', 'overledningstid': 'ekg-wave', 'kammaraktiveringstid': 'ekg-wave', 'aterhamtningstid': 'ekg-wave',
    // Liquid Gauge
    'blodtryck_systoliskt': 'liquid-gauge', 'blodtryck_diastoliskt': 'liquid-gauge', 'totalt_kolesterol': 'liquid-gauge',
    'hdl': 'liquid-gauge', 'non_hdl': 'liquid-gauge', 'ldl': 'liquid-gauge', 'triglycerider': 'liquid-gauge',
    'glukos': 'liquid-gauge', 'hba1c': 'liquid-gauge', 'hemoglobin': 'liquid-gauge',
    // Pulse Core
    'hjartalder': 'pulse-core', 'syremattnad': 'pulse-core', 'hcrp': 'pulse-core', 'hs_crp': 'pulse-core', 'hjartljudsinspelning': 'pulse-core',
    // Particle Swarm
    'vita_blodkroppar': 'particle-swarm', 'neutrofiler': 'particle-swarm', 'eosinofiler': 'particle-swarm', 'lymfocyter': 'particle-swarm', 'basofiler': 'particle-swarm',
    // Kinetic Scale
    'vikt': 'kinetic-scale', 'bmi': 'kinetic-scale', 'greppstyrka_hoger': 'kinetic-scale', 'greppstyrka_vanster': 'kinetic-scale', 'ankeltryck': 'kinetic-scale', 'abi': 'kinetic-scale',
    // Radar Scan
    'hudforandringar': 'radar-scan', 'ogontryck': 'radar-scan'
};

const CHART_RENDER_ENGINE = {
    'vikt': 'bar', 'bmi': 'bar', 'greppstyrka_hoger': 'bar', 'greppstyrka_vanster': 'bar',
    'vita_blodkroppar': 'stepped', 'neutrofiler': 'stepped', 'eosinofiler': 'stepped', 'lymfocyter': 'stepped', 'basofiler': 'stepped',
    'totalt_kolesterol': 'stepped', 'hdl': 'stepped', 'non_hdl': 'stepped', 'ldl': 'stepped', 'triglycerider': 'stepped'
};

const CLINICAL_THRESHOLDS = {
    'puls': { min: 50, max: 100 },
    'blodtryck_systoliskt': { min: 90, max: 120 },
    'blodtryck_diastoliskt': { min: 60, max: 80 },
    'bmi': { min: 18.5, max: 24.9 },
    'glukos': { min: 4.0, max: 6.0 },
    'hba1c': { min: 27, max: 42 },
    'totalt_kolesterol': { max: 5.0 },
    'ldl': { max: 3.0 },
    'hdl': { min: 1.0 },
    'syremattnad': { min: 95, max: 100 }
};

// Logical groupings for sub-charts
const CHART_GROUPS = {
    'hjarta_och_cirkulation': [
        ['blodtryck_systoliskt', 'blodtryck_diastoliskt'], 
        ['ankeltryck'], 
        ['abi'],
        ['syremattnad'], 
        ['hjartalder']
    ],
    'ekg': [
        ['overledningstid', 'kammaraktiveringstid', 'aterhamtningstid'],
        ['puls'],
        ['hjartljudsinspelning']
    ],
    'blodfetter': [
        ['totalt_kolesterol', 'non_hdl', 'ldl', 'hdl', 'triglycerider']
    ],
    'kropp': [
        ['greppstyrka_hoger', 'greppstyrka_vanster'],
        ['vikt'], 
        ['bmi'],
        ['ogontryck', 'hcrp']
    ],
    'diabetes': [
        ['hba1c'], ['glukos']
    ],
    'immunforsvar': [
        ['vita_blodkroppar', 'neutrofiler', 'lymfocyter', 'eosinofiler', 'basofiler'],
        ['hs_crp']
    ],
    'hematologi': [['hemoglobin']],
    'hud': [['hudforandringar']]
};

let geminiApiKey = null;

document.addEventListener('DOMContentLoaded', () => {
    // Touch speech synthesis to load voices early
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

    // Check if key is already saved from a previous visit
    const savedKey = localStorage.getItem('neko_gemini_key');
    if (savedKey) {
        geminiApiKey = savedKey;
        dismissSplash();
    }
    // Otherwise: splash screen stays visible, user must interact

    document.getElementById('btn-overview').addEventListener('click', showOverview);
});

function activateWithKey() {
    const key = document.getElementById('splash-api-key').value.trim();
    if (!key) { alert('Please enter a valid API key.'); return; }
    geminiApiKey = key;
    localStorage.setItem('neko_gemini_key', key);
    dismissSplash();
}

function skipApiKey() {
    geminiApiKey = null;
    // Show locked state in chat panel
    document.getElementById('chat-history').style.display = 'none';
    document.getElementById('chat-locked-msg').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = 'none';
    dismissSplash();
}

function dismissSplash() {
    const splash = document.getElementById('api-splash');
    splash.classList.add('hidden');
    setTimeout(() => { splash.style.display = 'none'; }, 800);
    
    // Now init app
    setTimeout(() => {
        if (typeof NekoData !== 'undefined') {
            fullData = NekoData;
            initDiagnosticHUD(NekoData);
        } else {
            document.getElementById('loader').innerHTML = "<div class='pulse' style='color:red'>UPLINK FAILED: data.js NOT FOUND</div>";
        }
    }, 400);
}

function initDiagnosticHUD(data) {
    document.getElementById('loader').classList.add('hidden');
    
    const scans = data.scans;
    const latestScan = scans[scans.length - 1];

    document.getElementById('patient-name').innerText = data.patientInfo.name.toUpperCase();
    document.getElementById('patient-age').innerText = latestScan.age;
    document.getElementById('latest-scan-date').innerText = latestScan.date;

    // Populate Intro Panels
    document.getElementById('system-summary').innerText = latestScan.summary;
    renderRecommendations(latestScan, 'system-recommendations');

    buildNodes(latestScan);
    
    // Default to Overview view
    showOverview();
}

function showOverview() {
    // Stop any AI speech
    stopSpeech();

    // Remove active nodes
    document.querySelectorAll('.holo-node').forEach(n => n.classList.remove('active'));

    // Slide out Actual Panels
    document.getElementById('panel-left').classList.add('hidden-slide-left');
    document.getElementById('panel-right').classList.add('hidden-slide-right');

    // Slide in Intro Panels
    setTimeout(() => {
        document.getElementById('intro-left').classList.remove('hidden-slide-left');
        document.getElementById('intro-right').classList.remove('hidden-slide-right');
    }, 400); // Wait for actual to disappear
}

// ─────────────────────────────────────────────
// Mobile Tab Navigation
// ─────────────────────────────────────────────
let _mobActiveTab = 'body'; // track current tab

function mobSwitchTab(tab) {
    const isMobile = window.innerWidth <= 768;
    _mobActiveTab = tab;

    // Update active state on tab buttons
    ['body', 'metrics', 'trends', 'doctor'].forEach(t => {
        const el = document.getElementById(`mob-tab-${t}`);
        if (el) el.classList.toggle('active', t === tab);
    });

    if (!isMobile) return; // no-op on desktop

    const panelLeft  = document.getElementById('panel-left');
    const panelRight = document.getElementById('panel-right');
    const introLeft  = document.getElementById('intro-left');
    const introRight = document.getElementById('intro-right');

    const hasActiveNode = !!document.querySelector('.holo-node.active');

    // Helper: completely hide slide panels
    const hideSlide = (el) => {
        if (!el) return;
        el.classList.add('hidden-slide-left');
        el.classList.add('hidden-slide-right');
    };
    const showSlide = (el) => {
        if (!el) return;
        el.classList.remove('hidden-slide-left');
        el.classList.remove('hidden-slide-right');
    };

    // Hide everything first
    hideSlide(panelLeft);
    hideSlide(panelRight);
    hideSlide(introLeft);
    hideSlide(introRight);
    introRight.classList.remove('mob-visible');

    if (tab === 'body') {
        // Body tab: show hologram only — all panels hidden
        // (nothing to show)
    } else if (tab === 'metrics') {
        if (hasActiveNode) {
            showSlide(panelLeft);
        } else {
            showSlide(introLeft);
        }
    } else if (tab === 'trends') {
        if (hasActiveNode) {
            showSlide(panelRight);
        }
        // If no node selected, trends tab shows nothing (hologram still visible)
    } else if (tab === 'doctor') {
        introRight.classList.add('mob-visible');
        showSlide(introRight);
    }
}


function buildNodes(latestScan) {
    const container = document.getElementById('nodes-container');
    const categories = Object.keys(latestScan.metrics);

    categories.forEach(cat => {
        const conf = NODE_MAP[cat];
        if (!conf) return;

        const node = document.createElement('div');
        node.className = `holo-node align-${conf.align || 'right'}`;
        node.style.top = conf.top;
        node.style.left = conf.left;
        node.setAttribute('data-label', conf.label);
        
        node.addEventListener('click', () => {
            document.querySelectorAll('.holo-node').forEach(n => n.classList.remove('active'));
            node.classList.add('active');
            triggerPanels(cat, latestScan, conf.label);
        });

        container.appendChild(node);
    });
}

function triggerPanels(categoryKey, latestScan, viewLabel) {
    stopSpeech(); // Stop speech when navigating

    const introL = document.getElementById('intro-left');
    const introR = document.getElementById('intro-right');
    const leftP = document.getElementById('panel-left');
    const rightP = document.getElementById('panel-right');

    // Slide EVERYTHING out
    introL.classList.add('hidden-slide-left');
    introR.classList.add('hidden-slide-right');
    leftP.classList.add('hidden-slide-left');
    rightP.classList.add('hidden-slide-right');

    setTimeout(() => {
        document.getElementById('view-title').innerText = viewLabel;
        
        renderMetricsLogic(categoryKey, latestScan);
        renderNeonCharts(categoryKey);
        
        // On desktop: show both panels simultaneously
        // On mobile: show left panel first, tab bar reflects 'metrics'
        if (window.innerWidth <= 768) {
            leftP.classList.remove('hidden-slide-left');
            // Update tab bar state to METRICS without hiding the panel we just showed
            _mobActiveTab = 'metrics';
            ['body','metrics','trends','doctor'].forEach(t => {
                const el = document.getElementById(`mob-tab-${t}`);
                if (el) el.classList.toggle('active', t === 'metrics');
            });
        } else {
            leftP.classList.remove('hidden-slide-left');
            rightP.classList.remove('hidden-slide-right');
        }
    }, 400);
}

function renderMetricsLogic(categoryKey, latestScan) {
    const metrics = latestScan.metrics[categoryKey];
    const grid = document.getElementById('metrics-grid');
    grid.innerHTML = '';

    Object.keys(metrics).forEach(metricKey => {
        const m = metrics[metricKey];
        const statusClean = (m.status || '').toUpperCase();
        let glowClass = '';
        if (statusClean === 'OPTIMALT' || statusClean === 'MATCHAR') glowClass = 'optimal';
        else if (statusClean === 'VARNING') glowClass = 'warning';

        // Map animation
        const animType = ANIMATION_MAP[metricKey] || 'pulse-core';
        let animHTML = '';
        if (animType === 'ekg-wave')     animHTML = `<div class="ekg-line"></div>`;
        else if (animType === 'liquid-gauge') animHTML = `<div class="liquid-wave"></div>`;
        else if (animType === 'pulse-core')   animHTML = `<div class="pulse-inner"></div>`;
        else if (animType === 'particle-swarm') animHTML = `<div class="particle p1"></div><div class="particle p2"></div><div class="particle p3"></div>`;
        else if (animType === 'kinetic-scale') animHTML = `<div class="kinetic-bar"><div class="kinetic-node"></div></div>`;
        else if (animType === 'radar-scan')   animHTML = `<div class="radar-blade"></div>`;

        // Wrapper allows expansion
        const wrap = document.createElement('div');
        wrap.className = `metric-wrap ${glowClass}`;
        
        const isNumeric = !isNaN(parseFloat(m.value)) && isFinite(m.value);
        let finalVal = m.value;
        let statusHtml = m.status ? `<div class="m-status">${m.status.toUpperCase()}</div>` : '';
        let unitHtml = m.unit ? `<span class="m-unit">${m.unit}</span>` : '';

        wrap.innerHTML = `
            <div class="metric-data-row">
                <div class="m-left-group">
                    <div class="m-anim-slot ${animType}">
                        ${animHTML}
                    </div>
                    <div>
                        <div class="m-label">${formatCleanName(metricKey)}</div>
                        ${statusHtml}
                    </div>
                </div>
                <div class="m-right-group">
                    <span class="m-val" id="val-${metricKey}">${isNumeric ? '0' : finalVal}</span>
                    ${unitHtml}
                </div>
            </div>
            <div class="ai-insight-box"></div>
        `;

        // Interaction Logic — EKG panel highlights the corresponding waveform segment
        wrap.addEventListener('click', () => {
            document.querySelectorAll('.metric-wrap').forEach(w => {
                if (w !== wrap) { w.classList.remove('expanded'); w.querySelector('.ai-insight-box').innerHTML = ''; }
            });

            const isExpanded = wrap.classList.toggle('expanded');
            const insightBox = wrap.querySelector('.ai-insight-box');

            if (isExpanded) {
                if (categoryKey === 'ekg') setECGHighlight(metricKey);
                const insightText = fullData.aiInsights[metricKey] || 'Ingen analysdata definierad för detta värde.';
                typeWriter(insightBox, '> A.I. DIAGNOS: ' + insightText, 25);
                speakInsight(metricKey);
            } else {
                insightBox.innerHTML = '';
                stopSpeech();
                if (categoryKey === 'ekg') setECGHighlight(null);
            }
        });

        grid.appendChild(wrap);

        if (isNumeric) {
            animateDigits(`val-${metricKey}`, 0, parseFloat(m.value), 800, m.value % 1 !== 0);
        }
    });
}

function animateDigits(id, start, end, duration, isFloat) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTime = null;
    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeProg = 1 - Math.pow(1 - progress, 3);
        const curr = start + easeProg * (end - start);
        obj.innerHTML = isFloat ? curr.toFixed(2) : Math.floor(curr);
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerHTML = end;
    };
    window.requestAnimationFrame(step);
}

// AI Typewriter
function typeWriter(element, text, speed) {
    element.innerHTML = '';
    let i = 0;
    function type() {
        if (!element.closest('.expanded')) return; // abort if closed
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// AI Pre-Rendered Audio Player
function speakInsight(metricKey) {
    stopSpeech(); // Stop existing
    
    currentAudio = new Audio(`audio/${metricKey}.mp3`);
    currentAudio.volume = 1.0;
    
    const playPromise = currentAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(e => console.warn("Browser blocked audio auto-play:", e));
    }
}
function stopSpeech() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
}

function renderNeonCharts(categoryKey) {
    globalChartInstances.forEach(c => c.destroy());
    globalChartInstances = [];

    const scans = fullData.scans;
    const labels = scans.map(s => s.date);
    
    const container = document.getElementById('charts-list');
    container.innerHTML = '';
    
    // ── Special case: EKG rhythm gets ONE live-animated ECG canvas ──
    if (categoryKey === 'ekg') {
        currentECGHighlight = null; // reset on open
        renderECGCanvas(container);
        return;
    }
    let groups = CHART_GROUPS[categoryKey];
    if (!groups) {
        groups = [ Object.keys(scans[scans.length-1].metrics[categoryKey]) ];
    }

    const palette = ['rgba(0, 229, 255, 1)', 'rgba(181, 0, 255, 1)', 'rgba(255, 255, 255, 1)'];

    Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Register Clinical Thresholds Plugin
    const thresholdPlugin = {
        id: 'clinicalThresholds',
        beforeDraw: (chart) => {
            const threshold = chart.config.options.plugins.clinicalThresholds;
            if (!threshold) return;
            
            const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
            
            let yTop = top;
            let yBottom = bottom;
            
            if (threshold.max !== undefined) yTop = Math.max(top, y.getPixelForValue(threshold.max));
            if (threshold.min !== undefined) yBottom = Math.min(bottom, y.getPixelForValue(threshold.min));
            
            if (yBottom > yTop && yTop >= top && yBottom <= bottom) {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 255, 136, 0.08)'; // Optimal Green Box
                ctx.fillRect(left, yTop, right - left, yBottom - yTop);
                
                // Draw boundary lines
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
                ctx.setLineDash([5, 5]);
                
                if (threshold.max !== undefined && yTop > top) {
                    ctx.beginPath();
                    ctx.moveTo(left, yTop);
                    ctx.lineTo(right, yTop);
                    ctx.stroke();
                }
                if (threshold.min !== undefined && yBottom < bottom) {
                    ctx.beginPath();
                    ctx.moveTo(left, yBottom);
                    ctx.lineTo(right, yBottom);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    };
    Chart.register(thresholdPlugin);

    groups.forEach(groupKeys => {
        const datasets = groupKeys.map((metricKey, idx) => {
            const dataPts = scans.map(s => {
                const metricObj = s.metrics[categoryKey][metricKey];
                if (metricObj && !isNaN(parseFloat(metricObj.value))) {
                    return parseFloat(metricObj.value);
                }
                return null;
            });
            const clr = palette[idx % palette.length];
            const engineType = CHART_RENDER_ENGINE[metricKey] || 'line';
            
            return {
                label: formatCleanName(metricKey),
                data: dataPts,
                type: engineType === 'stepped' ? 'line' : engineType,
                stepped: engineType === 'stepped' ? 'middle' : false,
                borderColor: clr,
                backgroundColor: (context) => {
                    if (engineType === 'bar') return clr.replace('1)', '0.6)');
                    if (!context.chart.chartArea) return 'transparent';
                    const { ctx, chartArea: { top, bottom } } = context.chart;
                    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
                    gradient.addColorStop(0, clr.replace('1)', '0.3)'));
                    gradient.addColorStop(1, clr.replace('1)', '0.0)'));
                    return gradient;
                },
                fill: engineType !== 'bar',
                pointBackgroundColor: '#0C1021',
                pointBorderColor: clr,
                pointBorderWidth: 2,
                pointRadius: engineType === 'bar' ? 0 : 4,
                pointHoverRadius: 6,
                borderWidth: engineType === 'bar' ? 0 : 3,
                tension: engineType === 'stepped' ? 0 : 0.4,
                borderRadius: engineType === 'bar' ? 6 : 0
            };
        }).filter(ds => ds.data.some(d => d !== null));

        if (datasets.length === 0) return;
        
        // Find if this group has a clinical threshold
        let activeThreshold = null;
        for (let key of groupKeys) {
            if (CLINICAL_THRESHOLDS[key]) {
                activeThreshold = CLINICAL_THRESHOLDS[key];
                break;
            }
        }

        const box = document.createElement('div');
        box.className = 'chart-box';
        
        const title = document.createElement('div');
        title.className = 'chart-box-title';
        title.innerText = groupKeys.map(formatCleanName).join(' / ');
        
        const canvasWrapper = document.createElement('div');
        canvasWrapper.style.position = 'relative';
        canvasWrapper.style.flex = '1'; // flex fill for the bento glass box
        const canvas = document.createElement('canvas');
        canvasWrapper.appendChild(canvas);
        
        box.appendChild(title);
        box.appendChild(canvasWrapper);
        container.appendChild(box);

        const chartInst = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { 
                        grid: { display: true, color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                        border: { display: false },
                        beginAtZero: false 
                    },
                    x: { 
                        grid: { display: false },
                        border: { display: false }
                    }
                },
                plugins: {
                    legend: { labels: { color: 'rgba(255, 255, 255, 0.7)', boxWidth: 12, usePointStyle: true, font: { family: "'Inter', sans-serif", size: 11, weight: 500 } } },
                    clinicalThresholds: activeThreshold
                }
            }
        });

        globalChartInstances.push(chartInst);
    });
}

function renderRecommendations(latestScan, targetId) {
    const list = document.getElementById(targetId);
    if (!list) return;
    list.innerHTML = '';
    latestScan.recommendations.forEach(r => {
        const li = document.createElement('li');
        li.innerText = r;
        list.appendChild(li);
    });
}

function formatCleanName(key) {
    const map = {
        'hjartalder': 'HEART AGE',
        'blodtryck_systoliskt': 'SYS BP',
        'blodtryck_diastoliskt': 'DIA BP',
        'ankeltryck': 'ANKLE PRESSURE',
        'greppstyrka_hoger': 'GRIP (R)',
        'greppstyrka_vanster': 'GRIP (L)'
    };
    if (map[key]) return map[key];
    return key.replace(/_/g, ' ').toUpperCase();
}

// ─────────────────────────────────────────────
// Single Shared ECG Canvas with Segment Highlighting
// ─────────────────────────────────────────────

function setECGHighlight(metricKey) {
    currentECGHighlight = metricKey || null;

    // Update the description card below the canvas
    const desc = document.getElementById('ecg-segment-desc');
    if (!desc) return;

    if (metricKey && ECG_SEGMENT_MAP[metricKey]) {
        const seg = ECG_SEGMENT_MAP[metricKey];
        desc.style.opacity = '1';
        desc.style.borderColor = seg.color + '55';
        desc.innerHTML = `<span style="color:${seg.color}; font-weight:700; letter-spacing:1px;">${seg.label}</span><br><span style="color:rgba(255,255,255,0.65); font-size:0.8rem;">${seg.desc}</span>`;
    } else {
        desc.style.opacity = '0.4';
        desc.style.borderColor = 'rgba(255,255,255,0.05)';
        desc.innerHTML = '<span style="color:rgba(255,255,255,0.35); font-size:0.8rem;">Select a metric on the left to highlight its segment.</span>';
    }
}

function renderECGCanvas(container) {
    const box = document.createElement('div');
    box.className = 'ecg-chart-box';
    box.style.height = '250px';

    const title = document.createElement('div');
    title.className = 'chart-box-title';
    title.innerText = 'ECG REFERENCE — P-QRS-T WAVEFORM';
    box.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.className = 'ecg-canvas';
    box.appendChild(canvas);
    container.appendChild(box);

    // Description card below canvas
    const desc = document.createElement('div');
    desc.id = 'ecg-segment-desc';
    desc.style.cssText = 'margin-top:16px; padding:16px 20px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:16px; line-height:1.6; transition: opacity 0.4s, border-color 0.4s; opacity:0.4;';
    desc.innerHTML = '<span style="color:rgba(255,255,255,0.35); font-size:0.8rem;">Select a metric on the left to highlight its waveform segment.</span>';
    container.appendChild(desc);

    requestAnimationFrame(() => {
        const dpr = window.devicePixelRatio || 1;
        const W   = canvas.offsetWidth;
        const H   = canvas.offsetHeight || 170;
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Layout: generous top+bottom. Extra bottom space reserved for interval brackets.
        const pad = { top: 32, bottom: 58, left: 20, right: 20 };
        const drawW = W - pad.left - pad.right;
        const drawH = H - pad.top  - pad.bottom;
        const midY  = pad.top + drawH / 2;
        const amp   = drawH * 0.40; // amplitude of R peak (≈ 40% of available height)

        // Convert normalized coords (nx ∈ [0,1], ny ∈ [-1,+1]) to canvas pixels
        function px(nx, ny) {
            return { x: pad.left + nx * drawW, y: midY + ny * amp };
        }

        // ── STATIC waveform definition (single complete PQRST cycle) ──
        // Each segment is a {type, x, y} for lines, or {type, cx1,cy1,cx2,cy2, x, y} for curves.
        // nx/ny values are the END point of each segment.
        const PATH = [
            { type: 'line',  x: 0.00, y:  0    },   // start of baseline
            { type: 'line',  x: 0.08, y:  0    },   // flat before P
            // P wave — smooth bump upward
            { type: 'curve', cx1: 0.09, cy1: -0.24, cx2: 0.11, cy2: -0.30, x: 0.13, y: -0.24 },
            { type: 'curve', cx1: 0.15, cy1: -0.18, cx2: 0.17, cy2:  0,    x: 0.18, y:  0    },
            // PR segment (isoelectric)
            { type: 'line',  x: 0.22, y:  0    },
            // Q dip
            { type: 'line',  x: 0.26, y:  0.26 },
            // R spike — tall sharp peak
            { type: 'line',  x: 0.31, y: -1.0  },
            // S dip
            { type: 'line',  x: 0.36, y:  0.30 },
            // ST segment — slightly elevated, then flattens
            { type: 'curve', cx1: 0.40, cy1: 0.08, cx2: 0.44, cy2: 0.02, x: 0.46, y: 0.02 },
            // T wave — smooth rounded hump
            { type: 'curve', cx1: 0.48, cy1: -0.28, cx2: 0.54, cy2: -0.32, x: 0.58, y: -0.16 },
            { type: 'curve', cx1: 0.62, cy1: -0.02, cx2: 0.65, cy2:  0,    x: 0.68, y:  0    },
            // TP flat baseline to end
            { type: 'line',  x: 1.00, y:  0    },
        ];

        // Pre-compute all screen coordinates once (static — no scrolling)
        const pts = PATH.map(seg => {
            const p = px(seg.x, seg.y);
            const out = { ...seg, sx: p.x, sy: p.y };
            if (seg.type === 'curve') {
                const c1 = px(seg.cx1, seg.cy1);
                const c2 = px(seg.cx2, seg.cy2);
                out.c1x = c1.x; out.c1y = c1.y;
                out.c2x = c2.x; out.c2y = c2.y;
            }
            return out;
        });

        // ── LABELS: match exact PATH x-positions and y-values at those points ──
        // PATH y-values at key points:
        //   P peak ≈ (0.11, -0.30) | Q = (0.26, 0.26) | R = (0.31, -1.0) | S = (0.36, 0.30)
        //   ST mid ≈ (0.46, 0.02) | T peak ≈ (0.53, -0.30) | T end = (0.68, 0)
        const LABELS = [
            { name: 'P',  nx: 0.12,  ny: -0.56, waveNY: -0.30 },
            { name: 'Q',  nx: 0.26,  ny:  0.72,  waveNY:  0.26 },
            { name: 'R',  nx: 0.31,  ny: -1.22,  waveNY: -1.00 },
            { name: 'S',  nx: 0.36,  ny:  0.72,  waveNY:  0.30 },
            { name: 'ST', nx: 0.46,  ny:  0.52,  waveNY:  0.02 },
            { name: 'T',  nx: 0.53,  ny: -0.58,  waveNY: -0.30 },
        ];

        // Heartbeat pulse timing (no horizontal scroll, just a brightness pulse)
        let pulseT = 0;
        const BEAT_PERIOD = 1.4;
        let lastTime = null;
        let animId = null;

        // Hoisted here so it's declared once, not on every animation frame
        function drawBracket(ctx, nx0, nx1, y, labelStr, color, pad, drawW, tickH) {
            const bx0 = pad.left + nx0 * drawW;
            const bx1 = pad.left + nx1 * drawW;
            ctx.save();
            ctx.strokeStyle = color + 'BB';
            ctx.fillStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(bx0, y); ctx.lineTo(bx1, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx0, y - tickH); ctx.lineTo(bx0, y + tickH); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx1, y - tickH); ctx.lineTo(bx1, y + tickH); ctx.stroke();
            ctx.font = '700 8px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labelStr, (bx0 + bx1) / 2, y - 6);
            ctx.restore();
        }

        function redraw(ts) {
            if (!lastTime) lastTime = ts;
            const dt = (ts - lastTime) / 1000;
            lastTime = ts;

            pulseT = (pulseT + dt / BEAT_PERIOD) % 1;

            // Pulse envelope: sharp rise at t=0 → 0.15, then decay
            // Gives a quick "blip" of brightness each heartbeat
            const beatPhase = pulseT < 0.12 ? pulseT / 0.12 : Math.max(0, 1 - (pulseT - 0.12) / 0.4);
            const beatGlow  = beatPhase * 18;   // shadow blur
            const beatAlpha = 0.25 + beatPhase * 0.55; // base line opacity modulation

            ctx.clearRect(0, 0, W, H);

            // ── Grid ──
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 5; i++) {
                const x = pad.left + (i / 5) * drawW;
                ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + drawH); ctx.stroke();
            }
            for (let i = 0; i <= 3; i++) {
                const y = pad.top + (i / 3) * drawH;
                ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + drawW, y); ctx.stroke();
            }
            // Isoelectric baseline
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.beginPath(); ctx.moveTo(pad.left, midY); ctx.lineTo(pad.left + drawW, midY); ctx.stroke();

            // ── Highlight band ──
            const hl = currentECGHighlight && ECG_SEGMENT_MAP[currentECGHighlight];
            if (hl) {
                hl.segments.forEach(([x0, x1]) => {
                    const sx = pad.left + x0 * drawW;
                    const sw = (x1 - x0) * drawW;
                    ctx.fillStyle = hl.color + '1A';
                    ctx.fillRect(sx, pad.top, sw, drawH);
                    ctx.strokeStyle = hl.color + '55';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 5]);
                    ctx.beginPath(); ctx.moveTo(sx,      pad.top); ctx.lineTo(sx,      pad.top + drawH); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(sx + sw, pad.top); ctx.lineTo(sx + sw, pad.top + drawH); ctx.stroke();
                    ctx.setLineDash([]);
                });
            }

            // ── Draw base waveform (dim when highlight active) ──
            const baseColor = hl
                ? `rgba(255,255,255,${beatAlpha * 0.35})`
                : `rgba(0,229,255,${beatAlpha})`;

            ctx.beginPath();
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur  = hl ? 0 : beatGlow;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            pts.forEach((pt, i) => {
                if (i === 0) { ctx.moveTo(pt.sx, pt.sy); return; }
                if (pt.type === 'curve') ctx.bezierCurveTo(pt.c1x, pt.c1y, pt.c2x, pt.c2y, pt.sx, pt.sy);
                else                     ctx.lineTo(pt.sx, pt.sy);
            });
            ctx.stroke();
            ctx.shadowBlur = 0;

            // ── Highlighted portion redrawn on top in accent color ──
            if (hl) {
                hl.segments.forEach(([x0, x1]) => {
                    const clipX  = pad.left + x0 * drawW;
                    const clipW  = (x1 - x0) * drawW;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(clipX, pad.top - 5, clipW, drawH + 10);
                    ctx.clip();

                    ctx.beginPath();
                    ctx.strokeStyle = hl.color;
                    ctx.lineWidth   = 3;
                    ctx.shadowColor = hl.color;
                    ctx.shadowBlur  = 12 + beatGlow * 0.5;
                    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                    pts.forEach((pt, i) => {
                        if (i === 0) { ctx.moveTo(pt.sx, pt.sy); return; }
                        if (pt.type === 'curve') ctx.bezierCurveTo(pt.c1x, pt.c1y, pt.c2x, pt.c2y, pt.sx, pt.sy);
                        else                     ctx.lineTo(pt.sx, pt.sy);
                    });
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.restore();
                });
            }

            // ── PQRST Labels (always anchored to static wave positions) ──
            ctx.font = '700 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            LABELS.forEach(lbl => {
                const labelPt = px(lbl.nx, lbl.ny);
                const wavePt  = px(lbl.nx, lbl.waveNY);

                const isLit = hl && hl.segments.some(([x0, x1]) => lbl.nx >= x0 && lbl.nx <= x1);
                const color = isLit ? hl.color : 'rgba(255,255,255,0.45)';

                // Pill
                const tw = ctx.measureText(lbl.name).width + 12;
                ctx.fillStyle = isLit ? hl.color + '25' : 'rgba(255,255,255,0.06)';
                ctx.beginPath();
                ctx.roundRect(labelPt.x - tw / 2, labelPt.y - 10, tw, 20, 5);
                ctx.fill();

                // Dashed tick from pill to waveform point
                const tickStart = lbl.ny < 0
                    ? { x: labelPt.x, y: labelPt.y + 12 }  // above baseline → tick downward
                    : { x: labelPt.x, y: labelPt.y - 12 }; // below baseline → tick upward
                ctx.strokeStyle = color + '60';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 4]);
                ctx.beginPath();
                ctx.moveTo(tickStart.x, tickStart.y);
                ctx.lineTo(wavePt.x, wavePt.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label text
                ctx.fillStyle = color;
                if (isLit) {
                    ctx.shadowColor = hl.color;
                    ctx.shadowBlur  = 8;
                }
                ctx.fillText(lbl.name, labelPt.x, labelPt.y + 4);
                ctx.shadowBlur = 0;
            });

            // Always-visible PR and QT measurement brackets below the waveform
            const allScans = (typeof fullData !== 'undefined' && fullData.scans) ? fullData.scans : [];
            const latestEKG = allScans.length ? (allScans[allScans.length - 1].metrics?.ekg || {}) : {};
            const prMs  = latestEKG.overledningstid?.value;
            const qtMs  = latestEKG.aterhamtningstid?.value;

            const tickH       = 4;
            const bracketPRY  = pad.top + drawH + 12;
            const bracketQTY  = pad.top + drawH + 30;

            const prLabel = prMs  ? `PR  ${prMs} ms`  : 'PR INTERVAL';
            const qtLabel = qtMs  ? `QT  ${qtMs} ms`  : 'QT INTERVAL';
            drawBracket(ctx, 0.08, 0.31, bracketPRY, prLabel, '#B500FF', pad, drawW, tickH);
            drawBracket(ctx, 0.22, 0.68, bracketQTY, qtLabel, '#00FF88', pad, drawW, tickH);

            animId = ecgAnimId = requestAnimationFrame(redraw);
        }

        if (ecgAnimId) cancelAnimationFrame(ecgAnimId);
        animId = ecgAnimId = requestAnimationFrame(redraw);

        // Cleanup when panel is removed from DOM
        const observer = new MutationObserver(() => {
            if (!document.contains(canvas)) {
                cancelAnimationFrame(animId);
                ecgAnimId = null;
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// ─────────────────────────────────────────────
// Gemini AI Doctor Chat
// ─────────────────────────────────────────────

async function sendChatMessage() {
    if (!geminiApiKey) return;
    const input = document.getElementById('chat-input');
    const history = document.getElementById('chat-history');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    // Add user message
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-msg user-msg';
    userBubble.innerText = msg;
    history.appendChild(userBubble);

    // Thinking indicator
    const thinkBubble = document.createElement('div');
    thinkBubble.className = 'chat-msg ai-msg thinking';
    thinkBubble.innerHTML = '<span class="dr-tag">Dr. Gemini:</span> Analyzing your biometrics...';
    history.appendChild(thinkBubble);
    history.scrollTop = history.scrollHeight;

    // Build rich system prompt with all patient data
    const patientDataStr = JSON.stringify(fullData, null, 2);
    const systemPrompt = `You are Dr. Gemini, a warm, knowledgeable, and reassuring AI medical diagnostician. 
You have been provided with the following complete Neko Health diagnostic records for this patient. 
Refer to the patient by their first name. Always speak in simple, clear language. 
Provide actionable, evidence-based insights grounded in the data. 
Always conclude with an encouraging note. 
NEVER make a definitive diagnosis — always recommend the patient discuss findings with their physician.

PATIENT DATA:
${patientDataStr}

User question: ${msg}`;

    try {
        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
                })
            }
        );

        const data = await resp.json();
        let replyText = 'I was unable to process that request. Please check your API key and try again.';
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            replyText = data.candidates[0].content.parts[0].text;
        } else if (data.error) {
            replyText = `API Error: ${data.error.message}`;
        }

        thinkBubble.innerHTML = `<span class="dr-tag">Dr. Gemini:</span> ${replyText.replace(/\n/g, '<br>')}`;
        thinkBubble.classList.remove('thinking');
    } catch (e) {
        thinkBubble.innerHTML = '<span class="dr-tag">Dr. Gemini:</span> Network error. Please check your connection.';
        thinkBubble.classList.remove('thinking');
    }
    history.scrollTop = history.scrollHeight;
}
