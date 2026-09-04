/**
 * SLOWED + REVERB STUDIO - JAVASCRIPT ENGINE
 * Web Audio API DSP, Stereo Convolver, Lossless WAV Encoder & Multi-mode Canvas Visualizer
 */

const state = {
    theme: 'dark',
    audioContext: null,
    audioBuffer: null,
    sourceNode: null,
    dryGainNode: null,
    wetGainNode: null,
    convolverNode: null,
    bassFilterNode: null,
    toneFilterNode: null,
    masterGainNode: null,
    analyserNode: null,
    
    isPlaying: false,
    startedAtCtxTime: 0,
    currentTrackTime: 0, // In Slowed Domain [0 ... getEffectiveDuration()]
    duration: 0,
    animationFrameId: null,
    
    // Converted audio state
    renderedBuffer: null,
    renderedBlob: null,
    renderedUrl: null,
    isConvertedPlaying: false,
    convertedSourceNode: null,
    
    // DSP Parameters
    speed: 0.85,
    reverbMix: 0.40,
    reverbDecay: 3.5,
    reverbPreDelay: 0.03,
    reverbDamp: 4500,
    toneCutoff: 16000,
    bassBoost: 3.0,
    
    // Metadata
    fileName: '',
    fileBaseName: '',
    fileSize: 0,
    fileType: '',
    visualizerMode: 'bars'
};

const PRESETS = {
    classic:   { speed: 0.85, reverbMix: 0.40, reverbDecay: 3.5, reverbPreDelay: 0.03, toneCutoff: 16000, bassBoost: 3.0, suffix: ' (Slowed + Reverb)' },
    nightdrive:{ speed: 0.80, reverbMix: 0.55, reverbDecay: 4.8, reverbPreDelay: 0.04, toneCutoff: 13000, bassBoost: 5.5, suffix: ' (Midnight Drive Edit)' },
    astral:    { speed: 0.75, reverbMix: 0.68, reverbDecay: 6.5, reverbPreDelay: 0.06, toneCutoff: 15000, bassBoost: 2.5, suffix: ' (Spaced Out Reverb)' },
    bedroom:   { speed: 0.84, reverbMix: 0.50, reverbDecay: 3.2, reverbPreDelay: 0.02, toneCutoff: 3800,  bassBoost: 4.0, suffix: ' (Bedroom Lo-Fi Edit)' },
    lofi:      { speed: 0.92, reverbMix: 0.28, reverbDecay: 2.2, reverbPreDelay: 0.02, toneCutoff: 11000, bassBoost: 1.5, suffix: ' (Lo-Fi Chill)' },
    chopped:   { speed: 0.70, reverbMix: 0.35, reverbDecay: 2.8, reverbPreDelay: 0.03, toneCutoff: 14000, bassBoost: 7.0, suffix: ' (Chopped & Screwed)' }
};

let dom = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    const savedTheme = localStorage.getItem('slowedStudioTheme') || 'dark';
    applyTheme(savedTheme);
    bindEvents();
    initVisualizerCanvas();
    updateUiFromState();
});

function cacheDom() {
    dom = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        uploadPrompt: document.getElementById('uploadPrompt'),
        fileDetails: document.getElementById('fileDetails'),
        fileNameDisplay: document.getElementById('fileNameDisplay'),
        fileMetaDisplay: document.getElementById('fileMetaDisplay'),
        fileOriginalDuration: document.getElementById('fileOriginalDuration'),
        fileCoverWrap: document.getElementById('fileCoverWrap'),
        fileIconLead: document.getElementById('fileIconLead'),
        btnChangeFile: document.getElementById('btnChangeFile'),
        studioSection: document.getElementById('studioSection'),
        
        speedSlider: document.getElementById('speedSlider'),
        speedVal: document.getElementById('speedVal'),
        pitchSemitones: document.getElementById('pitchSemitones'),
        btnSpeedDown: document.getElementById('btnSpeedDown'),
        btnSpeedUp: document.getElementById('btnSpeedUp'),
        btnSpeedReset: document.getElementById('btnSpeedReset'),
        
        reverbMixSlider: document.getElementById('reverbMixSlider'),
        reverbMixVal: document.getElementById('reverbMixVal'),
        reverbDecaySlider: document.getElementById('reverbDecaySlider'),
        reverbDecayVal: document.getElementById('reverbDecayVal'),
        reverbPreDelaySlider: document.getElementById('reverbPreDelaySlider'),
        reverbPreDelayVal: document.getElementById('reverbPreDelayVal'),
        
        toneSlider: document.getElementById('toneSlider'),
        toneVal: document.getElementById('toneVal'),
        bassSlider: document.getElementById('bassSlider'),
        bassVal: document.getElementById('bassVal'),
        
        canvas: document.getElementById('visualizerCanvas'),
        btnPlayPause: document.getElementById('btnPlayPause'),
        playIcon: document.getElementById('playIcon'),
        pauseIcon: document.getElementById('pauseIcon'),
        btnStop: document.getElementById('btnStop'),
        progressBar: document.getElementById('progressBar'),
        progressFill: document.getElementById('progressFill'),
        currentTimeDisplay: document.getElementById('currentTimeDisplay'),
        totalTimeDisplay: document.getElementById('totalTimeDisplay'),
        visModeSelect: document.getElementById('visModeSelect'),
        
        outputNameInput: document.getElementById('outputNameInput'),
        suffixButtons: document.querySelectorAll('.suffix-btn'),
        btnConvert: document.getElementById('btnConvert'),
        convertProgressBar: document.getElementById('convertProgressBar'),
        convertProgressFill: document.getElementById('convertProgressFill'),
        convertStatusText: document.getElementById('convertStatusText'),
        exportReadyCard: document.getElementById('exportReadyCard'),
        btnDownload: document.getElementById('btnDownload'),
        btnPlayConverted: document.getElementById('btnPlayConverted'),
        playConvertedIcon: document.getElementById('playConvertedIcon'),
        playConvertedText: document.getElementById('playConvertedText'),
        exportMetaInfo: document.getElementById('exportMetaInfo'),
        statusBadge: document.getElementById('statusBadge'),
        themeToggle: document.getElementById('themeToggle')
    };
}

function applyTheme(themeName) {
    const nextTheme = themeName === 'light' ? 'light' : 'dark';
    state.theme = nextTheme;
    document.body.classList.toggle('theme-light', nextTheme === 'light');
    document.body.classList.toggle('theme-dark', nextTheme === 'dark');
    const icon = nextTheme === 'light' ? '☀️' : '🌙';
    if (dom.themeToggle) dom.themeToggle.querySelector('.theme-toggle-icon').textContent = icon;
    dom.themeToggle?.setAttribute('aria-label', `Switch to ${nextTheme === 'light' ? 'dark' : 'light'} mode`);
    localStorage.setItem('slowedStudioTheme', nextTheme);
}

function getAudioContext() {
    if (!state.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioCtx();
    }
    if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    return state.audioContext;
}

// Algorithmic Stereo Impulse Response Generator
function createReverbImpulse(ctx, decayTime, preDelaySec = 0.03, dampingFreq = 4500) {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * decayTime));
    const preDelaySamples = Math.floor(sampleRate * Math.max(0, preDelaySec));
    
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    const decayFactor = 3.5 / decayTime;
    
    let prevL = 0, prevR = 0;
    const filterAlpha = Math.exp(-2.0 * Math.PI * (dampingFreq / sampleRate));
    
    for (let i = 0; i < length; i++) {
        if (i < preDelaySamples) {
            left[i] = 0;
            right[i] = 0;
            continue;
        }
        const t = (i - preDelaySamples) / sampleRate;
        const envelope = Math.exp(-decayFactor * t);
        
        const whiteNoiseL = (Math.random() * 2 - 1) * envelope;
        const whiteNoiseR = (Math.random() * 2 - 1) * envelope;
        
        prevL = (1 - filterAlpha) * whiteNoiseL + filterAlpha * prevL;
        prevR = (1 - filterAlpha) * whiteNoiseR + filterAlpha * prevR;
        
        left[i] = prevL;
        right[i] = prevR;
    }
    
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
        if (Math.abs(left[i]) > maxVal) maxVal = Math.abs(left[i]);
        if (Math.abs(right[i]) > maxVal) maxVal = Math.abs(right[i]);
    }
    if (maxVal > 0) {
        const norm = 0.95 / maxVal;
        for (let i = 0; i < length; i++) {
            left[i] *= norm;
            right[i] *= norm;
        }
    }
    return impulse;
}

function bindEvents() {
    dom.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropZone.classList.add('dragover');
    });
    dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));
    dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    dom.dropZone.addEventListener('click', (e) => {
        if (e.target !== dom.btnChangeFile) dom.fileInput.click();
    });
    dom.dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dom.fileInput.click();
        }
    });

    dom.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
    dom.btnChangeFile.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.fileInput.click();
    });

    // Speed Controls
    dom.speedSlider.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        updateSpeedUi();
        updateLiveGraphParams();
    });
    dom.btnSpeedDown.addEventListener('click', () => {
        state.speed = Math.max(0.50, Math.round((state.speed - 0.01) * 100) / 100);
        updateSpeedUi();
        updateLiveGraphParams();
    });
    dom.btnSpeedUp.addEventListener('click', () => {
        state.speed = Math.min(1.15, Math.round((state.speed + 0.01) * 100) / 100);
        updateSpeedUi();
        updateLiveGraphParams();
    });
    dom.btnSpeedReset.addEventListener('click', () => {
        state.speed = 0.85;
        updateSpeedUi();
        updateLiveGraphParams();
    });

    // Reverb Controls
    dom.reverbMixSlider.addEventListener('input', (e) => {
        state.reverbMix = parseFloat(e.target.value);
        dom.reverbMixVal.textContent = Math.round(state.reverbMix * 100) + '%';
        updateLiveGraphParams();
    });
    dom.reverbDecaySlider.addEventListener('input', (e) => {
        state.reverbDecay = parseFloat(e.target.value);
        dom.reverbDecayVal.textContent = state.reverbDecay.toFixed(1) + 's';
        if (state.audioBuffer) dom.totalTimeDisplay.textContent = formatTime(getEffectiveDuration());
        rebuildLiveReverb();
    });
    dom.reverbPreDelaySlider.addEventListener('input', (e) => {
        state.reverbPreDelay = parseFloat(e.target.value) / 1000;
        dom.reverbPreDelayVal.textContent = Math.round(state.reverbPreDelay * 1000) + 'ms';
        rebuildLiveReverb();
    });

    // Tone & Bass
    dom.toneSlider.addEventListener('input', (e) => {
        state.toneCutoff = parseFloat(e.target.value);
        dom.toneVal.textContent = state.toneCutoff >= 19000 ? 'Crisp (20000Hz)' : (state.toneCutoff <= 4500 ? 'Muffled (' + Math.round(state.toneCutoff) + 'Hz)' : 'Warm (' + Math.round(state.toneCutoff) + 'Hz)');
        updateLiveGraphParams();
    });
    dom.bassSlider.addEventListener('input', (e) => {
        state.bassBoost = parseFloat(e.target.value);
        dom.bassVal.textContent = '+' + state.bassBoost.toFixed(1) + ' dB';
        updateLiveGraphParams();
    });

    // Presets
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => applyPreset(card.dataset.preset));
    });

    // Suffix tags
    dom.suffixButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            dom.outputNameInput.value = state.fileBaseName + btn.dataset.suffix;
        });
    });

    // Transport Player
    dom.btnPlayPause.addEventListener('click', togglePlayPause);
    dom.btnStop.addEventListener('click', stopAudio);
    
    dom.progressBar.addEventListener('click', (e) => {
        if (!state.audioBuffer) return;
        const rect = dom.progressBar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        seekTo(ratio * getEffectiveDuration());
    });

    dom.visModeSelect.addEventListener('change', (e) => {
        state.visualizerMode = e.target.value;
    });

    dom.themeToggle.addEventListener('click', () => {
        const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
    });

    // Conversion & Export
    dom.btnConvert.addEventListener('click', startConversion);
    dom.btnDownload.addEventListener('click', triggerDownload);
    dom.btnPlayConverted.addEventListener('click', toggleConvertedPreview);
}

function handleFile(file) {
    stopAudio();
    stopConvertedPreview();
    
    state.fileName = file.name;
    state.fileBaseName = file.name.replace(/\.[^/.]+$/, "");
    state.fileSize = file.size;
    
    dom.fileNameDisplay.textContent = file.name;
    dom.fileMetaDisplay.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    dom.uploadPrompt.classList.add('hidden');
    dom.fileDetails.classList.remove('hidden');
    dom.studioSection.classList.remove('hidden');
    dom.exportReadyCard.classList.add('hidden');
    
    dom.outputNameInput.value = `${state.fileBaseName} (Slowed + Reverb)`;

    // Extract Cover Art using jsmediatags
    if (window.jsmediatags) {
        window.jsmediatags.read(file, {
            onSuccess: function(tag) {
                const picture = tag.tags.picture;
                if (picture) {
                    let base64String = "";
                    for (let i = 0; i < picture.data.length; i++) {
                        base64String += String.fromCharCode(picture.data[i]);
                    }
                    const base64 = `data:${picture.format};base64,${window.btoa(base64String)}`;
                    dom.fileCoverWrap.innerHTML = `<img src="${base64}" class="file-cover-img" alt="Album Cover">`;
                } else {
                    dom.fileCoverWrap.innerHTML = `<div class="file-icon-lead">🎵</div>`;
                }
            },
            onError: function(error) {
                console.log("No ID3 cover found:", error);
                dom.fileCoverWrap.innerHTML = `<div class="file-icon-lead">🎵</div>`;
            }
        });
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const ctx = getAudioContext();
            state.audioBuffer = await ctx.decodeAudioData(e.target.result);
            state.duration = state.audioBuffer.duration;
            dom.fileOriginalDuration.textContent = `Original: ${formatTime(state.duration)}`;
            dom.totalTimeDisplay.textContent = formatTime(getEffectiveDuration());
            dom.statusBadge.textContent = 'Audio Loaded';
        } catch (err) {
            console.error('Audio decode error:', err);
            alert('Could not decode audio file. Please try another audio format (MP3, WAV, FLAC, M4A).');
        }
    };
    reader.readAsArrayBuffer(file);
}

function getEffectiveDuration() {
    return state.audioBuffer ? (state.audioBuffer.duration / state.speed) + state.reverbDecay : 0;
}

function updateSpeedUi() {
    dom.speedSlider.value = state.speed;
    dom.speedVal.textContent = Math.round(state.speed * 100) + '%';
    const semitones = 12 * Math.log2(state.speed);
    dom.pitchSemitones.textContent = `(${semitones > 0 ? '+' : ''}${semitones.toFixed(1)} st)`;
    if (state.audioBuffer) {
        dom.totalTimeDisplay.textContent = formatTime(getEffectiveDuration());
    }
}

function updateUiFromState() {
    updateSpeedUi();
    dom.reverbMixSlider.value = state.reverbMix;
    dom.reverbMixVal.textContent = Math.round(state.reverbMix * 100) + '%';
    dom.reverbDecaySlider.value = state.reverbDecay;
    dom.reverbDecayVal.textContent = state.reverbDecay.toFixed(1) + 's';
    dom.reverbPreDelaySlider.value = state.reverbPreDelay * 1000;
    dom.reverbPreDelayVal.textContent = Math.round(state.reverbPreDelay * 1000) + 'ms';
    dom.toneSlider.value = state.toneCutoff;
    dom.bassSlider.value = state.bassBoost;
    dom.bassVal.textContent = '+' + state.bassBoost.toFixed(1) + ' dB';
    dom.toneVal.textContent = state.toneCutoff >= 19000 ? 'Crisp (20000Hz)' : (state.toneCutoff <= 4500 ? 'Muffled (' + Math.round(state.toneCutoff) + 'Hz)' : 'Warm (' + Math.round(state.toneCutoff) + 'Hz)');
}

function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    Object.assign(state, preset);
    
    document.querySelectorAll('.preset-card').forEach(c => {
        c.classList.toggle('active', c.dataset.preset === presetKey);
    });
    
    if (state.fileBaseName) {
        dom.outputNameInput.value = state.fileBaseName + preset.suffix;
    }
    
    updateUiFromState();
    rebuildLiveReverb();
    updateLiveGraphParams();
}

function buildLiveAudioGraph() {
    const ctx = getAudioContext();
    
    if (!state.masterGainNode) {
        state.masterGainNode = ctx.createGain();
        state.masterGainNode.gain.setValueAtTime(0.9, ctx.currentTime);
    }
    
    if (!state.analyserNode) {
        state.analyserNode = ctx.createAnalyser();
        state.analyserNode.fftSize = 512;
    }
    
    if (!state.masterGainNode._speakerConnected) {
        state.masterGainNode.connect(state.analyserNode);
        state.analyserNode.connect(ctx.destination);
        state.masterGainNode._speakerConnected = true;
    }

    state.toneFilterNode = ctx.createBiquadFilter();
    state.toneFilterNode.type = 'lowpass';
    state.toneFilterNode.frequency.setValueAtTime(state.toneCutoff, ctx.currentTime);

    state.bassFilterNode = ctx.createBiquadFilter();
    state.bassFilterNode.type = 'lowshelf';
    state.bassFilterNode.frequency.setValueAtTime(100, ctx.currentTime);
    state.bassFilterNode.gain.setValueAtTime(state.bassBoost, ctx.currentTime);

    state.convolverNode = ctx.createConvolver();
    state.convolverNode.buffer = createReverbImpulse(ctx, state.reverbDecay, state.reverbPreDelay, state.reverbDamp);

    state.dryGainNode = ctx.createGain();
    state.wetGainNode = ctx.createGain();
    
    const dryAngle = (1 - state.reverbMix) * 0.5 * Math.PI;
    const wetAngle = state.reverbMix * 0.5 * Math.PI;
    state.dryGainNode.gain.setValueAtTime(Math.sin(dryAngle), ctx.currentTime);
    state.wetGainNode.gain.setValueAtTime(Math.sin(wetAngle), ctx.currentTime);

    state.toneFilterNode.connect(state.bassFilterNode);
    state.bassFilterNode.connect(state.dryGainNode);
    state.dryGainNode.connect(state.masterGainNode);
    state.bassFilterNode.connect(state.convolverNode);
    state.convolverNode.connect(state.wetGainNode);
    state.wetGainNode.connect(state.masterGainNode);
}

function updateLiveGraphParams() {
    if (!state.audioContext) return;
    const now = state.audioContext.currentTime;

    if (state.sourceNode && state.isPlaying) {
        const currentPos = getLiveCurrentTime();
        state.currentTrackTime = currentPos;
        state.startedAtCtxTime = now;
        state.sourceNode.playbackRate.setValueAtTime(state.speed, now);
    }
    
    if (state.toneFilterNode) {
        state.toneFilterNode.frequency.setTargetAtTime(state.toneCutoff, now, 0.05);
    }
    if (state.bassFilterNode) {
        state.bassFilterNode.gain.setTargetAtTime(state.bassBoost, now, 0.05);
    }
    if (state.dryGainNode && state.wetGainNode) {
        const dryAngle = (1 - state.reverbMix) * 0.5 * Math.PI;
        const wetAngle = state.reverbMix * 0.5 * Math.PI;
        state.dryGainNode.gain.setTargetAtTime(Math.sin(dryAngle), now, 0.05);
        state.wetGainNode.gain.setTargetAtTime(Math.sin(wetAngle), now, 0.05);
    }
}

function rebuildLiveReverb() {
    if (state.audioContext && state.convolverNode) {
        state.convolverNode.buffer = createReverbImpulse(state.audioContext, state.reverbDecay, state.reverbPreDelay, state.reverbDamp);
    }
}

function togglePlayPause() {
    if (!state.audioBuffer) return;
    stopConvertedPreview();
    state.isPlaying ? pauseAudio() : playAudio(state.currentTrackTime);
}

function playAudio(startOffset = 0) {
    if (!state.audioBuffer) return;
    const ctx = getAudioContext();
    
    if (state.sourceNode) {
        try { state.sourceNode.stop(); } catch(e){}
        state.sourceNode.disconnect();
    }
    
    buildLiveAudioGraph();

    state.sourceNode = ctx.createBufferSource();
    state.sourceNode.buffer = state.audioBuffer;
    state.sourceNode.playbackRate.setValueAtTime(state.speed, ctx.currentTime);
    state.sourceNode.connect(state.toneFilterNode);

    state.sourceNode.onended = () => {
        if (state.isPlaying && getLiveCurrentTime() >= getEffectiveDuration() - 0.2) {
            stopAudio();
        }
    };

    const origBufferOffset = Math.min(state.duration - 0.001, Math.max(0, startOffset * state.speed));
    state.startedAtCtxTime = ctx.currentTime;
    state.currentTrackTime = startOffset;
    
    state.sourceNode.start(0, origBufferOffset);
    state.isPlaying = true;
    
    dom.playIcon.classList.add('hidden');
    dom.pauseIcon.classList.remove('hidden');
    startProgressTracker();
}

function pauseAudio() {
    if (!state.isPlaying) return;
    state.currentTrackTime = getLiveCurrentTime();
    if (state.sourceNode) {
        try { state.sourceNode.stop(); } catch(e){}
        state.sourceNode.disconnect();
        state.sourceNode = null;
    }
    state.isPlaying = false;
    dom.playIcon.classList.remove('hidden');
    dom.pauseIcon.classList.add('hidden');
    cancelAnimationFrame(state.animationFrameId);
}

function stopAudio() {
    if (state.sourceNode) {
        try { state.sourceNode.stop(); } catch(e){}
        state.sourceNode.disconnect();
        state.sourceNode = null;
    }
    state.isPlaying = false;
    state.currentTrackTime = 0;
    dom.playIcon.classList.remove('hidden');
    dom.pauseIcon.classList.add('hidden');
    dom.progressFill.style.width = '0%';
    dom.currentTimeDisplay.textContent = '0:00';
    cancelAnimationFrame(state.animationFrameId);
}

function seekTo(targetTime) {
    const effDuration = getEffectiveDuration();
    const clamped = Math.max(0, Math.min(effDuration, targetTime));
    if (state.isPlaying) {
        playAudio(clamped);
    } else {
        state.currentTrackTime = clamped;
        dom.progressFill.style.width = `${(clamped / effDuration) * 100}%`;
        dom.currentTimeDisplay.textContent = formatTime(clamped);
    }
}

function getLiveCurrentTime() {
    if (state.isPlaying && state.audioContext) {
        const elapsed = state.audioContext.currentTime - state.startedAtCtxTime;
        const total = state.currentTrackTime + elapsed;
        return Math.min(getEffectiveDuration(), Math.max(0, total));
    }
    return state.currentTrackTime;
}

function startProgressTracker() {
    function tick() {
        if (!state.isPlaying) return;
        const cur = getLiveCurrentTime();
        const tot = getEffectiveDuration();
        dom.currentTimeDisplay.textContent = formatTime(cur);
        dom.totalTimeDisplay.textContent = formatTime(tot);
        const percent = Math.min(100, (cur / tot) * 100);
        dom.progressFill.style.width = `${percent}%`;
        dom.progressBar.setAttribute('aria-valuenow', Math.round(percent));
        
        if (cur >= tot) {
            stopAudio();
            return;
        }
        state.animationFrameId = requestAnimationFrame(tick);
    }
    state.animationFrameId = requestAnimationFrame(tick);
}

function initVisualizerCanvas() {
    const canvas = dom.canvas;
    const ctx = canvas.getContext('2d');
    
    function getCssColor(varName, fallback = '#38bdf8') {
        const val = getComputedStyle(document.body).getPropertyValue(varName).trim();
        return val || fallback;
    }

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = (rect.width || 800) * window.devicePixelRatio;
        canvas.height = (rect.height || 160) * window.devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
        requestAnimationFrame(draw);
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (!state.analyserNode || !state.isPlaying) {
            const time = Date.now() * 0.002;
            ctx.lineWidth = 2.5 * window.devicePixelRatio;
            ctx.strokeStyle = getCssColor('--secondary', '#38bdf8');
            ctx.beginPath();
            for (let x = 0; x < w; x += 6 * window.devicePixelRatio) {
                const y = h / 2 + Math.sin(x * 0.008 + time) * (12 * window.devicePixelRatio);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            return;
        }

        const bufferLength = state.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        if (state.visualizerMode === 'wave') {
            state.analyserNode.getByteTimeDomainData(dataArray);
            ctx.lineWidth = 2.5 * window.devicePixelRatio;
            ctx.strokeStyle = getCssColor('--accent', '#f472b6');
            ctx.beginPath();
            const sliceWidth = w / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * h) / 2;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
        } else if (state.visualizerMode === 'circle') {
            state.analyserNode.getByteFrequencyData(dataArray);
            const centerX = w / 2;
            const centerY = h / 2;
            const radius = Math.min(w, h) * 0.22;
            
            ctx.strokeStyle = getCssColor('--secondary', '#38bdf8');
            ctx.lineWidth = 2 * window.devicePixelRatio;
            ctx.beginPath();
            const points = 80;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const val = dataArray[i * 2] / 255;
                const r = radius + val * (radius * 0.7);
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        } else {
            state.analyserNode.getByteFrequencyData(dataArray);
            const numBars = 54;
            const barW = (w / numBars) * 0.75;
            const gap = (w / numBars) * 0.25;
            
            const grad = ctx.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, getCssColor('--secondary', '#38bdf8'));
            grad.addColorStop(0.6, getCssColor('--accent', '#f472b6'));
            grad.addColorStop(1, getCssColor('--purple-light', '#c084fc'));
            ctx.fillStyle = grad;

            for (let i = 0; i < numBars; i++) {
                const idx = Math.floor(Math.pow(i / numBars, 1.4) * (bufferLength / 2));
                const barH = Math.max(4 * window.devicePixelRatio, (dataArray[idx] / 255) * h * 0.92);
                const x = i * (barW + gap);
                const y = h - barH;
                
                ctx.beginPath();
                ctx.roundRect(x, y, barW, barH, [4 * window.devicePixelRatio, 4 * window.devicePixelRatio, 0, 0]);
                ctx.fill();
            }
        }
    }
    draw();
}

async function startConversion() {
    if (!state.audioBuffer) return;
    if (state.isPlaying) pauseAudio();
    stopConvertedPreview();

    dom.btnConvert.disabled = true;
    dom.convertProgressBar.classList.remove('hidden');
    dom.convertProgressFill.style.width = '20%';
    dom.convertStatusText.textContent = 'Preparing DSP Pipeline & Reverb Impulse...';

    try {
        const sampleRate = state.audioBuffer.sampleRate;
        const totalDuration = (state.audioBuffer.duration / state.speed) + state.reverbDecay;
        const totalFrames = Math.ceil(totalDuration * sampleRate);

        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offlineCtx = new OfflineCtx(2, totalFrames, sampleRate);
        
        const source = offlineCtx.createBufferSource();
        source.buffer = state.audioBuffer;
        source.playbackRate.setValueAtTime(state.speed, 0);

        const toneFilter = offlineCtx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.setValueAtTime(state.toneCutoff, 0);

        const bassFilter = offlineCtx.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.setValueAtTime(100, 0);
        bassFilter.gain.setValueAtTime(state.bassBoost, 0);

        const convolver = offlineCtx.createConvolver();
        convolver.buffer = createReverbImpulse(offlineCtx, state.reverbDecay, state.reverbPreDelay, state.reverbDamp);

        const dryGain = offlineCtx.createGain();
        const wetGain = offlineCtx.createGain();
        const dryAngle = (1 - state.reverbMix) * 0.5 * Math.PI;
        const wetAngle = state.reverbMix * 0.5 * Math.PI;
        dryGain.gain.setValueAtTime(Math.sin(dryAngle), 0);
        wetGain.gain.setValueAtTime(Math.sin(wetAngle), 0);

        const compressor = offlineCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-1.0, 0);
        compressor.knee.setValueAtTime(40, 0);
        compressor.ratio.setValueAtTime(12, 0);
        compressor.attack.setValueAtTime(0.003, 0);
        compressor.release.setValueAtTime(0.25, 0);

        source.connect(toneFilter);
        toneFilter.connect(bassFilter);
        
        bassFilter.connect(dryGain);
        dryGain.connect(compressor);
        
        bassFilter.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(compressor);
        
        compressor.connect(offlineCtx.destination);
        source.start(0);

        dom.convertProgressFill.style.width = '55%';
        dom.convertStatusText.textContent = 'Rendering audio effects in high fidelity...';
        
        const rendered = await offlineCtx.startRendering();
        
        dom.convertProgressFill.style.width = '85%';
        dom.convertStatusText.textContent = 'Encoding lossless 16-bit WAV PCM...';

        const blob = audioBufferToWav(rendered);
        state.renderedBuffer = rendered;
        state.renderedBlob = blob;
        
        if (state.renderedUrl) URL.revokeObjectURL(state.renderedUrl);
        state.renderedUrl = URL.createObjectURL(blob);

        dom.convertProgressFill.style.width = '100%';
        setTimeout(() => {
            dom.convertProgressBar.classList.add('hidden');
            dom.exportReadyCard.classList.remove('hidden');
            dom.exportMetaInfo.textContent = `${(blob.size / (1024 * 1024)).toFixed(2)} MB • 16-bit Stereo PCM WAV • Duration: ${formatTime(totalDuration)}`;
            dom.btnConvert.disabled = false;
        }, 350);

    } catch (err) {
        console.error(err);
        dom.btnConvert.disabled = false;
        dom.convertProgressBar.classList.add('hidden');
        alert('Audio conversion error: ' + err.message);
    }
}

function triggerDownload() {
    if (!state.renderedBlob) return;
    let targetName = dom.outputNameInput.value.trim() || `${state.fileBaseName} (Slowed + Reverb)`;
    if (!targetName.toLowerCase().endsWith('.wav')) {
        targetName += '.wav';
    }

    const a = document.createElement('a');
    a.href = state.renderedUrl;
    a.download = targetName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function toggleConvertedPreview() {
    if (!state.renderedBuffer) return;
    
    if (state.isConvertedPlaying) {
        stopConvertedPreview();
    } else {
        if (state.isPlaying) stopAudio();
        const ctx = getAudioContext();
        
        state.convertedSourceNode = ctx.createBufferSource();
        state.convertedSourceNode.buffer = state.renderedBuffer;
        state.convertedSourceNode.connect(ctx.destination);
        
        state.convertedSourceNode.onended = () => {
            stopConvertedPreview();
        };
        
        state.convertedSourceNode.start(0);
        state.isConvertedPlaying = true;
        dom.playConvertedIcon.textContent = '⏹️';
        dom.playConvertedText.textContent = 'Stop Converted Result';
    }
}

function stopConvertedPreview() {
    if (state.convertedSourceNode) {
        try { state.convertedSourceNode.stop(); } catch(e){}
        state.convertedSourceNode.disconnect();
        state.convertedSourceNode = null;
    }
    state.isConvertedPlaying = false;
    if (dom.playConvertedIcon) dom.playConvertedIcon.textContent = '▶️';
    if (dom.playConvertedText) dom.playConvertedText.textContent = 'Play Converted Result';
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels;
    const interleaved = numChannels === 2 ? interleave(buffer.getChannelData(0), buffer.getChannelData(1)) : buffer.getChannelData(0);
    
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);

    function writeString(offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
    const result = new Float32Array(inputL.length + inputR.length);
    let idx = 0, inputIdx = 0;
    while (idx < result.length) {
        result[idx++] = inputL[inputIdx];
        result[idx++] = inputR[inputIdx];
        inputIdx++;
    }
    return result;
}

function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}