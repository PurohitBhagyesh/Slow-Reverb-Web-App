/**
 * Slowed + Reverb Studio
 * Client-side Web Audio DSP, Visualizer, Presets, and Lossless 16-bit WAV Export
 */

(() => {
    'use strict';

    // Preset Configurations
    const PRESETS = {
        classic: {
            speed: 0.85,
            reverbMix: 0.40,
            reverbDecay: 3.5,
            reverbPreDelay: 30,
            tone: 16000,
            bass: 3.0
        },
        nightdrive: {
            speed: 0.80,
            reverbMix: 0.45,
            reverbDecay: 4.2,
            reverbPreDelay: 40,
            tone: 14000,
            bass: 6.0
        },
        astral: {
            speed: 0.75,
            reverbMix: 0.60,
            reverbDecay: 6.0,
            reverbPreDelay: 60,
            tone: 15000,
            bass: 2.0
        },
        bedroom: {
            speed: 0.84,
            reverbMix: 0.35,
            reverbDecay: 2.5,
            reverbPreDelay: 20,
            tone: 5500,
            bass: 3.5
        },
        lofi: {
            speed: 0.92,
            reverbMix: 0.25,
            reverbDecay: 2.0,
            reverbPreDelay: 15,
            tone: 8500,
            bass: 2.0
        },
        chopped: {
            speed: 0.70,
            reverbMix: 0.30,
            reverbDecay: 2.8,
            reverbPreDelay: 25,
            tone: 12000,
            bass: 8.0
        }
    };

    // State Management
    const state = {
        audioContext: null,
        originalAudioBuffer: null,
        originalFileName: '',
        originalFileBaseName: '',
        originalFileSizeStr: '',
        
        // Active DSP params
        speed: 0.85,
        reverbMix: 0.40,
        reverbDecay: 3.5,
        reverbPreDelay: 30,
        tone: 16000,
        bass: 3.0,
        
        // Impulse response buffer cache
        impulseBuffer: null,
        
        // Live Playback Graph
        sourceNode: null,
        bassNode: null,
        toneNode: null,
        preDelayNode: null,
        convolverNode: null,
        dryGainNode: null,
        wetGainNode: null,
        analyserNode: null,
        
        isPlaying: false,
        playbackStartTime: 0,
        pausedAtTime: 0,
        rafId: null,
        
        // Exported result
        convertedBlobUrl: null,
        convertedAudio: null,
        isConvertedPlaying: false
    };

    // DOM Elements
    const el = {
        themeToggle: document.getElementById('themeToggle'),
        themeIcon: document.querySelector('.theme-toggle-icon'),
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        uploadPrompt: document.getElementById('uploadPrompt'),
        fileDetails: document.getElementById('fileDetails'),
        fileCoverWrap: document.getElementById('fileCoverWrap'),
        fileNameDisplay: document.getElementById('fileNameDisplay'),
        fileMetaDisplay: document.getElementById('fileMetaDisplay'),
        fileOriginalDuration: document.getElementById('fileOriginalDuration'),
        btnChangeFile: document.getElementById('btnChangeFile'),
        
        studioSection: document.getElementById('studioSection'),
        presetsGrid: document.getElementById('presetsGrid'),
        presetCards: document.querySelectorAll('.preset-card'),
        statusBadge: document.getElementById('statusBadge'),
        
        pitchSemitones: document.getElementById('pitchSemitones'),
        speedSlider: document.getElementById('speedSlider'),
        speedVal: document.getElementById('speedVal'),
        btnSpeedDown: document.getElementById('btnSpeedDown'),
        btnSpeedReset: document.getElementById('btnSpeedReset'),
        btnSpeedUp: document.getElementById('btnSpeedUp'),
        
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
        
        visModeSelect: document.getElementById('visModeSelect'),
        visualizerCanvas: document.getElementById('visualizerCanvas'),
        progressBar: document.getElementById('progressBar'),
        progressFill: document.getElementById('progressFill'),
        currentTimeDisplay: document.getElementById('currentTimeDisplay'),
        totalTimeDisplay: document.getElementById('totalTimeDisplay'),
        btnPlayPause: document.getElementById('btnPlayPause'),
        playIcon: document.getElementById('playIcon'),
        pauseIcon: document.getElementById('pauseIcon'),
        btnStop: document.getElementById('btnStop'),
        
        outputNameInput: document.getElementById('outputNameInput'),
        suffixButtons: document.querySelectorAll('.suffix-btn'),
        btnConvert: document.getElementById('btnConvert'),
        convertProgressBar: document.getElementById('convertProgressBar'),
        convertStatusText: document.getElementById('convertStatusText'),
        convertProgressFill: document.getElementById('convertProgressFill'),
        exportReadyCard: document.getElementById('exportReadyCard'),
        exportMetaInfo: document.getElementById('exportMetaInfo'),
        btnDownload: document.getElementById('btnDownload'),
        btnPlayConverted: document.getElementById('btnPlayConverted'),
        playConvertedIcon: document.getElementById('playConvertedIcon'),
        playConvertedText: document.getElementById('playConvertedText')
    };

    const canvasCtx = el.visualizerCanvas.getContext('2d');

    // -------------------------------------------------------------------------
    // Audio Context Helper
    // -------------------------------------------------------------------------
    function getAudioContext() {
        if (!state.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            state.audioContext = new AudioContextClass();
        }
        if (state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
        return state.audioContext;
    }

    // Format seconds to mm:ss
    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Format byte size to readable string
    function formatFileSize(bytes) {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // -------------------------------------------------------------------------
    // Algorithmic Stereo Reverb Impulse Generator
    // -------------------------------------------------------------------------
    function createReverbImpulse(ctx, decayTime) {
        const sampleRate = ctx.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * decayTime));
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            // Exponential decay envelope
            const envelope = Math.exp(-3.5 * (t / decayTime));
            // Stereo decorrelated white noise with subtle diffusion
            left[i] = (Math.random() * 2 - 1) * envelope;
            right[i] = (Math.random() * 2 - 1) * envelope;
        }
        return impulse;
    }

    function getOrBuildImpulse(ctx) {
        if (!state.impulseBuffer || state.impulseBuffer.decayTime !== state.reverbDecay) {
            state.impulseBuffer = createReverbImpulse(ctx, state.reverbDecay);
            state.impulseBuffer.decayTime = state.reverbDecay;
        }
        return state.impulseBuffer;
    }

    // -------------------------------------------------------------------------
    // Theme Toggle
    // -------------------------------------------------------------------------
    function initTheme() {
        const savedTheme = localStorage.getItem('slow_reverb_theme') || 'dark';
        setTheme(savedTheme);

        el.themeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.contains('theme-light');
            const newTheme = isLight ? 'dark' : 'light';
            setTheme(newTheme);
        });
    }

    function setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            el.themeIcon.textContent = '☀️';
            el.themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        } else {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            el.themeIcon.textContent = '🌙';
            el.themeToggle.setAttribute('aria-label', 'Switch to light mode');
        }
        localStorage.setItem('slow_reverb_theme', theme);
    }

    // -------------------------------------------------------------------------
    // File Loading and ID3 Tag Extraction
    // -------------------------------------------------------------------------
    function initFileUpload() {
        el.dropZone.addEventListener('click', (e) => {
            if (e.target.closest('#btnChangeFile')) return;
            el.fileInput.click();
        });

        el.btnChangeFile.addEventListener('click', (e) => {
            e.stopPropagation();
            el.fileInput.click();
        });

        el.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            el.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            el.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.dropZone.classList.remove('drag-over');
            });
        });

        el.dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFile(dt.files[0]);
            }
        });
    }

    async function handleFile(file) {
        stopPlayback();
        resetExportState();

        state.originalFileName = file.name;
        state.originalFileBaseName = file.name.replace(/\.[^/.]+$/, '');
        state.originalFileSizeStr = formatFileSize(file.size);

        el.statusBadge.textContent = 'Decoding...';
        el.statusBadge.className = 'badge badge-secondary';

        // Parse ID3 Artwork if jsmediatags is present
        extractCoverArt(file);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const ctx = getAudioContext();
            const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

            state.originalAudioBuffer = decodedBuffer;
            state.pausedAtTime = 0;

            // Update UI Details
            el.fileNameDisplay.textContent = state.originalFileName;
            el.fileMetaDisplay.textContent = state.originalFileSizeStr;
            el.fileOriginalDuration.textContent = `Original: ${formatTime(decodedBuffer.duration)}`;
            el.outputNameInput.value = `${state.originalFileBaseName} (Slowed + Reverb)`;
            
            el.uploadPrompt.classList.add('hidden');
            el.fileDetails.classList.remove('hidden');
            el.studioSection.classList.remove('hidden');
            
            updateTotalDurationDisplay();
            updateProgressBar(0);

            el.statusBadge.textContent = 'Ready';
            el.statusBadge.className = 'badge badge-success';
        } catch (err) {
            console.error('Audio decode error:', err);
            alert('Failed to decode audio file. Please try another audio format (MP3, WAV, FLAC, M4A).');
            el.statusBadge.textContent = 'Error';
            el.statusBadge.className = 'badge badge-primary';
        }
    }

    function extractCoverArt(file) {
        el.fileCoverWrap.innerHTML = '<div class="file-icon-lead" id="fileIconLead">🎵</div>';
        
        if (window.jsmediatags) {
            window.jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const image = tag.tags.picture;
                    if (image) {
                        let base64String = '';
                        for (let i = 0; i < image.data.length; i++) {
                            base64String += String.fromCharCode(image.data[i]);
                        }
                        const base64 = 'data:' + image.format + ';base64,' + window.btoa(base64String);
                        el.fileCoverWrap.innerHTML = `<img src="${base64}" alt="Cover" class="file-cover-img">`;
                    }
                },
                onError: () => {
                    // Keep fallback musical icon
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Audio DSP Setup & Graph Connections
    // -------------------------------------------------------------------------
    function buildLiveGraph(ctx, startTimeOffset = 0) {
        if (!state.originalAudioBuffer) return;

        // Disconnect old nodes
        tearDownLiveGraph();

        // Source node
        state.sourceNode = ctx.createBufferSource();
        state.sourceNode.buffer = state.originalAudioBuffer;
        state.sourceNode.playbackRate.value = state.speed;

        // Bass boost filter (Low-shelf @ 120Hz)
        state.bassNode = ctx.createBiquadFilter();
        state.bassNode.type = 'lowshelf';
        state.bassNode.frequency.value = 120;
        state.bassNode.gain.value = state.bass;

        // Tone filter (Lowpass @ tone freq)
        state.toneNode = ctx.createBiquadFilter();
        state.toneNode.type = 'lowpass';
        state.toneNode.frequency.value = state.tone;
        state.toneNode.Q.value = 0.707;

        // Reverb Pre-Delay
        state.preDelayNode = ctx.createDelay(1.0);
        state.preDelayNode.delayTime.value = state.reverbPreDelay / 1000;

        // Convolver Reverb
        state.convolverNode = ctx.createConvolver();
        state.convolverNode.buffer = getOrBuildImpulse(ctx);

        // Wet / Dry gains
        state.dryGainNode = ctx.createGain();
        state.wetGainNode = ctx.createGain();
        state.dryGainNode.gain.value = 1.0 - state.reverbMix * 0.45;
        state.wetGainNode.gain.value = state.reverbMix;

        // Analyser for visualizer
        state.analyserNode = ctx.createAnalyser();
        state.analyserNode.fftSize = 256;
        state.analyserNode.smoothingTimeConstant = 0.82;

        // Connections:
        // Source -> Bass -> Tone
        state.sourceNode.connect(state.bassNode);
        state.bassNode.connect(state.toneNode);

        // Tone -> DryGain -> Analyser -> Destination
        state.toneNode.connect(state.dryGainNode);
        state.dryGainNode.connect(state.analyserNode);

        // Tone -> PreDelay -> Convolver -> WetGain -> Analyser -> Destination
        state.toneNode.connect(state.preDelayNode);
        state.preDelayNode.connect(state.convolverNode);
        state.convolverNode.connect(state.wetGainNode);
        state.wetGainNode.connect(state.analyserNode);

        state.analyserNode.connect(ctx.destination);

        state.sourceNode.onended = () => {
            if (state.isPlaying) {
                const currentPos = getCurrentPlaybackPosition();
                const totalDur = getEffectiveDuration();
                if (currentPos >= totalDur - 0.2) {
                    stopPlayback();
                }
            }
        };

        // Start playback at given buffer offset
        state.playbackStartTime = ctx.currentTime - (startTimeOffset / state.speed);
        state.sourceNode.start(0, startTimeOffset);
        state.isPlaying = true;
        updatePlayPauseIcons(true);
    }

    function tearDownLiveGraph() {
        if (state.sourceNode) {
            try {
                state.sourceNode.onended = null;
                state.sourceNode.stop();
                state.sourceNode.disconnect();
            } catch (e) { /* ignore */ }
            state.sourceNode = null;
        }
    }

    function updateLiveParams() {
        if (state.sourceNode && state.audioContext) {
            const currTime = state.audioContext.currentTime;
            state.sourceNode.playbackRate.setValueAtTime(state.speed, currTime);
        }
        if (state.bassNode && state.audioContext) {
            state.bassNode.gain.setValueAtTime(state.bass, state.audioContext.currentTime);
        }
        if (state.toneNode && state.audioContext) {
            state.toneNode.frequency.setValueAtTime(state.tone, state.audioContext.currentTime);
        }
        if (state.preDelayNode && state.audioContext) {
            state.preDelayNode.delayTime.setValueAtTime(state.reverbPreDelay / 1000, state.audioContext.currentTime);
        }
        if (state.convolverNode && state.audioContext) {
            state.convolverNode.buffer = getOrBuildImpulse(state.audioContext);
        }
        if (state.dryGainNode && state.wetGainNode && state.audioContext) {
            const currTime = state.audioContext.currentTime;
            state.dryGainNode.gain.setValueAtTime(1.0 - state.reverbMix * 0.45, currTime);
            state.wetGainNode.gain.setValueAtTime(state.reverbMix, currTime);
        }
    }

    // -------------------------------------------------------------------------
    // Playback Transport Controls
    // -------------------------------------------------------------------------
    function getEffectiveDuration() {
        if (!state.originalAudioBuffer) return 0;
        return state.originalAudioBuffer.duration / state.speed;
    }

    function getCurrentPlaybackPosition() {
        if (!state.isPlaying || !state.audioContext) {
            return state.pausedAtTime;
        }
        const elapsed = (state.audioContext.currentTime - state.playbackStartTime) * state.speed;
        return Math.min(Math.max(0, elapsed), state.originalAudioBuffer.duration);
    }

    function togglePlayPause() {
        if (!state.originalAudioBuffer) return;
        const ctx = getAudioContext();

        if (state.isPlaying) {
            pausePlayback();
        } else {
            playPlayback();
        }
    }

    function playPlayback() {
        if (!state.originalAudioBuffer) return;
        const ctx = getAudioContext();

        if (state.pausedAtTime >= state.originalAudioBuffer.duration) {
            state.pausedAtTime = 0;
        }
        buildLiveGraph(ctx, state.pausedAtTime);
        startPlaybackLoop();
    }

    function pausePlayback() {
        if (!state.isPlaying) return;
        state.pausedAtTime = getCurrentPlaybackPosition();
        tearDownLiveGraph();
        state.isPlaying = false;
        updatePlayPauseIcons(false);
    }

    function stopPlayback() {
        tearDownLiveGraph();
        state.isPlaying = false;
        state.pausedAtTime = 0;
        updatePlayPauseIcons(false);
        updateProgressBar(0);
        el.currentTimeDisplay.textContent = '0:00';
    }

    function seekToRatio(ratio) {
        if (!state.originalAudioBuffer) return;
        const targetTime = Math.max(0, Math.min(state.originalAudioBuffer.duration * ratio, state.originalAudioBuffer.duration));
        state.pausedAtTime = targetTime;

        if (state.isPlaying) {
            const ctx = getAudioContext();
            buildLiveGraph(ctx, targetTime);
        } else {
            updateProgressBar(ratio);
            el.currentTimeDisplay.textContent = formatTime(targetTime / state.speed);
        }
    }

    function updatePlayPauseIcons(isPlaying) {
        if (isPlaying) {
            el.playIcon.classList.add('hidden');
            el.pauseIcon.classList.remove('hidden');
        } else {
            el.playIcon.classList.remove('hidden');
            el.pauseIcon.classList.add('hidden');
        }
    }

    function updateTotalDurationDisplay() {
        const totalEffective = getEffectiveDuration();
        el.totalTimeDisplay.textContent = formatTime(totalEffective);
    }

    function updateProgressBar(ratio) {
        const pct = Math.max(0, Math.min(ratio * 100, 100));
        el.progressFill.style.width = `${pct}%`;
        el.progressBar.setAttribute('aria-valuenow', Math.round(pct));
    }

    function startPlaybackLoop() {
        cancelAnimationFrame(state.rafId);

        const loop = () => {
            if (state.isPlaying && state.originalAudioBuffer) {
                const currentPos = getCurrentPlaybackPosition();
                const ratio = currentPos / state.originalAudioBuffer.duration;
                updateProgressBar(ratio);
                el.currentTimeDisplay.textContent = formatTime(currentPos / state.speed);
            }
            drawVisualizer();
            state.rafId = requestAnimationFrame(loop);
        };
        state.rafId = requestAnimationFrame(loop);
    }

    // -------------------------------------------------------------------------
    // Audio Spectrum & Waveform Visualizer
    // -------------------------------------------------------------------------
    function resizeCanvas() {
        const rect = el.visualizerCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        el.visualizerCanvas.width = rect.width * dpr;
        el.visualizerCanvas.height = rect.height * dpr;
        canvasCtx.scale(dpr, dpr);
    }

    window.addEventListener('resize', () => {
        resizeCanvas();
    });

    function drawVisualizer() {
        const rect = el.visualizerCanvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        canvasCtx.clearRect(0, 0, width, height);

        if (!state.analyserNode || !state.isPlaying) {
            // Idle ambient line
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            canvasCtx.lineWidth = 2;
            canvasCtx.moveTo(0, height / 2);
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
            return;
        }

        const mode = el.visModeSelect.value;
        const bufferLength = state.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        if (mode === 'bars') {
            state.analyserNode.getByteFrequencyData(dataArray);
            const barCount = 48;
            const barWidth = (width / barCount) - 2;
            const step = Math.floor(bufferLength / barCount);

            for (let i = 0; i < barCount; i++) {
                const val = dataArray[i * step] / 255;
                const barHeight = Math.max(3, val * (height - 12));
                const x = i * (barWidth + 2);
                const y = height - barHeight;

                const gradient = canvasCtx.createLinearGradient(0, y, 0, height);
                gradient.addColorStop(0, '#f472b6');
                gradient.addColorStop(0.5, '#a855f7');
                gradient.addColorStop(1, '#38bdf8');

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, y, barWidth, barHeight);
            }
        } else if (mode === 'wave') {
            state.analyserNode.getByteTimeDomainData(dataArray);
            canvasCtx.lineWidth = 2.5;
            canvasCtx.strokeStyle = '#38bdf8';
            canvasCtx.beginPath();

            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
        } else if (mode === 'circle') {
            state.analyserNode.getByteFrequencyData(dataArray);
            const centerX = width / 2;
            const centerY = height / 2;
            const baseRadius = Math.min(width, height) * 0.22;
            const count = 36;
            const angleStep = (Math.PI * 2) / count;
            const step = Math.floor(bufferLength / count);

            canvasCtx.beginPath();
            for (let i = 0; i <= count; i++) {
                const idx = (i % count) * step;
                const amp = (dataArray[idx] / 255) * 24;
                const r = baseRadius + amp;
                const angle = i * angleStep;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
            }
            canvasCtx.closePath();
            canvasCtx.strokeStyle = '#f472b6';
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();
        }
    }

    // -------------------------------------------------------------------------
    // UI Sliders & Controls Binding
    // -------------------------------------------------------------------------
    function updatePitchDisplay() {
        const semitones = 12 * Math.log2(state.speed);
        const sign = semitones >= 0 ? '+' : '';
        el.pitchSemitones.textContent = `(${sign}${semitones.toFixed(1)} st)`;
    }

    function setSpeed(newSpeed) {
        state.speed = parseFloat(newSpeed.toFixed(2));
        el.speedSlider.value = state.speed;
        el.speedVal.textContent = `${Math.round(state.speed * 100)}%`;
        updatePitchDisplay();
        updateTotalDurationDisplay();
        updateLiveParams();
        clearActivePresetHighlight();
    }

    function initControls() {
        // Speed Slider
        el.speedSlider.addEventListener('input', (e) => {
            setSpeed(parseFloat(e.target.value));
        });

        el.btnSpeedDown.addEventListener('click', () => {
            const val = Math.max(parseFloat(el.speedSlider.min), state.speed - 0.01);
            setSpeed(val);
        });
        el.btnSpeedReset.addEventListener('click', () => {
            setSpeed(0.85);
        });
        el.btnSpeedUp.addEventListener('click', () => {
            const val = Math.min(parseFloat(el.speedSlider.max), state.speed + 0.01);
            setSpeed(val);
        });

        // Reverb Mix
        el.reverbMixSlider.addEventListener('input', (e) => {
            state.reverbMix = parseFloat(e.target.value);
            el.reverbMixVal.textContent = `${Math.round(state.reverbMix * 100)}%`;
            updateLiveParams();
            clearActivePresetHighlight();
        });

        // Reverb Decay
        el.reverbDecaySlider.addEventListener('input', (e) => {
            state.reverbDecay = parseFloat(e.target.value);
            el.reverbDecayVal.textContent = `${state.reverbDecay.toFixed(1)}s`;
            state.impulseBuffer = null;
            updateLiveParams();
            clearActivePresetHighlight();
        });

        // Reverb Pre-Delay
        el.reverbPreDelaySlider.addEventListener('input', (e) => {
            state.reverbPreDelay = parseInt(e.target.value, 10);
            el.reverbPreDelayVal.textContent = `${state.reverbPreDelay}ms`;
            updateLiveParams();
            clearActivePresetHighlight();
        });

        // Tone Filter
        el.toneSlider.addEventListener('input', (e) => {
            state.tone = parseInt(e.target.value, 10);
            const desc = state.tone >= 16000 ? 'Bright' : state.tone >= 9000 ? 'Warm' : 'Muffled';
            el.toneVal.textContent = `${desc} (${state.tone}Hz)`;
            updateLiveParams();
            clearActivePresetHighlight();
        });

        // Bass Boost
        el.bassSlider.addEventListener('input', (e) => {
            state.bass = parseFloat(e.target.value);
            el.bassVal.textContent = `+${state.bass.toFixed(1)} dB`;
            updateLiveParams();
            clearActivePresetHighlight();
        });

        // Transport Buttons
        el.btnPlayPause.addEventListener('click', togglePlayPause);
        el.btnStop.addEventListener('click', stopPlayback);

        // Interactive Progress Bar
        el.progressBar.addEventListener('click', (e) => {
            const rect = el.progressBar.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            seekToRatio(ratio);
        });

        // Presets
        el.presetCards.forEach((card) => {
            card.addEventListener('click', () => {
                const presetKey = card.getAttribute('data-preset');
                applyPreset(presetKey);
            });
        });

        // Suffix rename buttons
        el.suffixButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const suffix = btn.getAttribute('data-suffix');
                el.outputNameInput.value = `${state.originalFileBaseName}${suffix}`;
            });
        });
    }

    function applyPreset(key) {
        const p = PRESETS[key];
        if (!p) return;

        el.presetCards.forEach(c => c.classList.toggle('active', c.getAttribute('data-preset') === key));

        state.speed = p.speed;
        state.reverbMix = p.reverbMix;
        state.reverbDecay = p.reverbDecay;
        state.reverbPreDelay = p.reverbPreDelay;
        state.tone = p.tone;
        state.bass = p.bass;
        state.impulseBuffer = null;

        // Update UI controls
        el.speedSlider.value = p.speed;
        el.speedVal.textContent = `${Math.round(p.speed * 100)}%`;
        updatePitchDisplay();
        updateTotalDurationDisplay();

        el.reverbMixSlider.value = p.reverbMix;
        el.reverbMixVal.textContent = `${Math.round(p.reverbMix * 100)}%`;

        el.reverbDecaySlider.value = p.reverbDecay;
        el.reverbDecayVal.textContent = `${p.reverbDecay.toFixed(1)}s`;

        el.reverbPreDelaySlider.value = p.reverbPreDelay;
        el.reverbPreDelayVal.textContent = `${p.reverbPreDelay}ms`;

        el.toneSlider.value = p.tone;
        const desc = p.tone >= 16000 ? 'Bright' : p.tone >= 9000 ? 'Warm' : 'Muffled';
        el.toneVal.textContent = `${desc} (${p.tone}Hz)`;

        el.bassSlider.value = p.bass;
        el.bassVal.textContent = `+${p.bass.toFixed(1)} dB`;

        updateLiveParams();
    }

    function clearActivePresetHighlight() {
        el.presetCards.forEach(c => c.classList.remove('active'));
    }

    // -------------------------------------------------------------------------
    // Audio Conversion & Lossless WAV Export (Offline DSP Pipeline)
    // -------------------------------------------------------------------------
    function initConvertAndExport() {
        el.btnConvert.addEventListener('click', startAudioConversion);

        el.btnDownload.addEventListener('click', () => {
            if (!state.convertedBlobUrl) return;
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = state.convertedBlobUrl;
            const filename = (el.outputNameInput.value.trim() || 'slowed_and_reverb') + '.wav';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });

        el.btnPlayConverted.addEventListener('click', togglePlayConverted);
    }

    function resetExportState() {
        if (state.convertedBlobUrl) {
            URL.revokeObjectURL(state.convertedBlobUrl);
            state.convertedBlobUrl = null;
        }
        if (state.convertedAudio) {
            state.convertedAudio.pause();
            state.convertedAudio = null;
        }
        state.isConvertedPlaying = false;
        el.playConvertedIcon.textContent = '▶️';
        el.playConvertedText.textContent = 'Play Converted Result';
        el.exportReadyCard.classList.add('hidden');
        el.convertProgressBar.classList.add('hidden');
    }

    async function startAudioConversion() {
        if (!state.originalAudioBuffer) return;

        pausePlayback();
        resetExportState();

        el.btnConvert.disabled = true;
        el.convertProgressBar.classList.remove('hidden');
        el.convertStatusText.textContent = 'Rendering Audio DSP graph...';
        el.convertProgressFill.style.width = '15%';

        try {
            const sampleRate = state.originalAudioBuffer.sampleRate;
            const channels = 2;
            const speed = state.speed;
            const tailSeconds = state.reverbDecay + (state.reverbPreDelay / 1000) + 1.0;
            const totalDuration = (state.originalAudioBuffer.duration / speed) + tailSeconds;
            const totalLength = Math.ceil(totalDuration * sampleRate);

            const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            const offlineCtx = new OfflineAudioContextClass(channels, totalLength, sampleRate);

            // Build Offline DSP Nodes
            const source = offlineCtx.createBufferSource();
            source.buffer = state.originalAudioBuffer;
            source.playbackRate.value = speed;

            const bass = offlineCtx.createBiquadFilter();
            bass.type = 'lowshelf';
            bass.frequency.value = 120;
            bass.gain.value = state.bass;

            const tone = offlineCtx.createBiquadFilter();
            tone.type = 'lowpass';
            tone.frequency.value = state.tone;
            tone.Q.value = 0.707;

            const preDelay = offlineCtx.createDelay(1.0);
            preDelay.delayTime.value = state.reverbPreDelay / 1000;

            const convolver = offlineCtx.createConvolver();
            convolver.buffer = createReverbImpulse(offlineCtx, state.reverbDecay);

            const dryGain = offlineCtx.createGain();
            dryGain.gain.value = 1.0 - state.reverbMix * 0.45;

            const wetGain = offlineCtx.createGain();
            wetGain.gain.value = state.reverbMix;

            // Routing
            source.connect(bass);
            bass.connect(tone);

            tone.connect(dryGain);
            dryGain.connect(offlineCtx.destination);

            tone.connect(preDelay);
            preDelay.connect(convolver);
            convolver.connect(wetGain);
            wetGain.connect(offlineCtx.destination);

            source.start(0);

            el.convertProgressFill.style.width = '45%';
            el.convertStatusText.textContent = 'Rendering Convolver & High-Fidelity Filters...';

            const renderedBuffer = await offlineCtx.startRendering();

            el.convertProgressFill.style.width = '80%';
            el.convertStatusText.textContent = 'Encoding to Lossless 16-bit WAV PCM...';

            // Encode to WAV Blob
            const wavBlob = audioBufferToWavBlob(renderedBuffer);
            state.convertedBlobUrl = URL.createObjectURL(wavBlob);
            state.convertedAudio = new Audio(state.convertedBlobUrl);
            state.convertedAudio.onended = () => {
                state.isConvertedPlaying = false;
                el.playConvertedIcon.textContent = '▶️';
                el.playConvertedText.textContent = 'Play Converted Result';
            };

            el.convertProgressFill.style.width = '100%';
            el.convertStatusText.textContent = 'Export completed!';

            // Display exported meta info
            el.exportMetaInfo.textContent = `WAV • 16-bit Stereo PCM • ${formatTime(renderedBuffer.duration)} • ${formatFileSize(wavBlob.size)}`;
            el.exportReadyCard.classList.remove('hidden');

            setTimeout(() => {
                el.convertProgressBar.classList.add('hidden');
            }, 1000);
        } catch (err) {
            console.error('Audio conversion failed:', err);
            alert('Failed to process and render audio: ' + err.message);
            el.convertProgressBar.classList.add('hidden');
        } finally {
            el.btnConvert.disabled = false;
        }
    }

    function togglePlayConverted() {
        if (!state.convertedAudio) return;
        if (state.isConvertedPlaying) {
            state.convertedAudio.pause();
            state.isConvertedPlaying = false;
            el.playConvertedIcon.textContent = '▶️';
            el.playConvertedText.textContent = 'Play Converted Result';
        } else {
            stopPlayback();
            state.convertedAudio.play();
            state.isConvertedPlaying = true;
            el.playConvertedIcon.textContent = '⏸️';
            el.playConvertedText.textContent = 'Pause Converted Result';
        }
    }

    // -------------------------------------------------------------------------
    // 16-bit Stereo PCM WAV Encoder
    // -------------------------------------------------------------------------
    function audioBufferToWavBlob(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const left = buffer.getChannelData(0);
        const right = numChannels > 1 ? buffer.getChannelData(1) : left;
        const sampleCount = buffer.length;
        const dataByteCount = sampleCount * blockAlign;
        const headerByteCount = 44;
        const totalByteCount = headerByteCount + dataByteCount;

        const arrayBuffer = new ArrayBuffer(totalByteCount);
        const view = new DataView(arrayBuffer);

        // RIFF header chunk
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataByteCount, true);
        writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
        view.setUint16(20, format, true); // AudioFormat
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);

        // data sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataByteCount, true);

        // Write interleaved PCM samples with clipping prevention
        let offset = 44;
        for (let i = 0; i < sampleCount; i++) {
            let sampleL = left[i];
            sampleL = Math.max(-1, Math.min(1, sampleL));
            view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7FFF, true);
            offset += 2;

            let sampleR = right[i];
            sampleR = Math.max(-1, Math.min(1, sampleR));
            view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // -------------------------------------------------------------------------
    // Initialize on DOM Ready
    // -------------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initFileUpload();
        initControls();
        initConvertAndExport();
        resizeCanvas();
        updatePitchDisplay();
        startPlaybackLoop();
    });
})();
