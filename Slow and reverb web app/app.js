/* ==========================================================================
   SLOWED + REVERB STUDIO - APPLICATION LOGIC & DSP ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const themeToggle = document.getElementById('themeToggle');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const fileDetails = document.getElementById('fileDetails');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileMetaDisplay = document.getElementById('fileMetaDisplay');
    const fileOriginalDuration = document.getElementById('fileOriginalDuration');
    const fileCoverWrap = document.getElementById('fileCoverWrap');
    const btnChangeFile = document.getElementById('btnChangeFile');

    const studioSection = document.getElementById('studioSection');
    const statusBadge = document.getElementById('statusBadge');
    const presetsGrid = document.getElementById('presetsGrid');

    const speedSlider = document.getElementById('speedSlider');
    const speedVal = document.getElementById('speedVal');
    const pitchSemitones = document.getElementById('pitchSemitones');
    const btnSpeedDown = document.getElementById('btnSpeedDown');
    const btnSpeedReset = document.getElementById('btnSpeedReset');
    const btnSpeedUp = document.getElementById('btnSpeedUp');

    const reverbMixSlider = document.getElementById('reverbMixSlider');
    const reverbMixVal = document.getElementById('reverbMixVal');
    const reverbDecaySlider = document.getElementById('reverbDecaySlider');
    const reverbDecayVal = document.getElementById('reverbDecayVal');
    const reverbPreDelaySlider = document.getElementById('reverbPreDelaySlider');
    const reverbPreDelayVal = document.getElementById('reverbPreDelayVal');

    const toneSlider = document.getElementById('toneSlider');
    const toneVal = document.getElementById('toneVal');
    const bassSlider = document.getElementById('bassSlider');
    const bassVal = document.getElementById('bassVal');

    const visModeSelect = document.getElementById('visModeSelect');
    const canvas = document.getElementById('visualizerCanvas');
    const canvasCtx = canvas.getContext('2d');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const totalTimeDisplay = document.getElementById('totalTimeDisplay');

    const btnPlayPause = document.getElementById('btnPlayPause');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const btnStop = document.getElementById('btnStop');

    const outputNameInput = document.getElementById('outputNameInput');
    const suffixBtns = document.querySelectorAll('.suffix-btn');
    const btnConvert = document.getElementById('btnConvert');
    const convertProgressBar = document.getElementById('convertProgressBar');
    const convertStatusText = document.getElementById('convertStatusText');
    const convertProgressFill = document.getElementById('convertProgressFill');
    const exportReadyCard = document.getElementById('exportReadyCard');
    const exportMetaInfo = document.getElementById('exportMetaInfo');
    const btnDownload = document.getElementById('btnDownload');
    const btnPlayConverted = document.getElementById('btnPlayConverted');
    const playConvertedIcon = document.getElementById('playConvertedIcon');
    const playConvertedText = document.getElementById('playConvertedText');

    // Audio Context & State
    let audioCtx = null;
    let originalAudioBuffer = null;
    let currentSourceNode = null;
    let filterToneNode = null;
    let filterBassNode = null;
    let dryGainNode = null;
    let wetGainNode = null;
    let preDelayNode = null;
    let convolverNode = null;
    let analyserNode = null;

    let isPlaying = false;
    let playbackStartTime = 0;
    let startOffset = 0;
    let animationFrameId = null;

    let processedAudioBlob = null;
    let processedAudioUrl = null;
    let convertedAudioElement = null;
    let isPlayingConverted = false;

    // Preset Data
    const PRESETS = {
        classic: { speed: 0.85, mix: 0.40, decay: 3.5, preDelay: 30, tone: 16000, bass: 3.0 },
        nightdrive: { speed: 0.80, mix: 0.50, decay: 4.5, preDelay: 40, tone: 14000, bass: 6.0 },
        astral: { speed: 0.75, mix: 0.65, decay: 6.5, preDelay: 50, tone: 18000, bass: 2.0 },
        bedroom: { speed: 0.84, mix: 0.35, decay: 2.5, preDelay: 20, tone: 3500, bass: 4.0 },
        lofi: { speed: 0.92, mix: 0.25, decay: 2.0, preDelay: 15, tone: 8000, bass: 2.5 },
        chopped: { speed: 0.70, mix: 0.45, decay: 4.0, preDelay: 35, tone: 12000, bass: 8.0 }
    };

    // Helper: Format Time in Seconds to M:SS
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Helper: Calculate Semitones from Speed Factor
    function calculateSemitones(speed) {
        const semitones = 12 * (Math.log2(speed));
        const sign = semitones > 0 ? '+' : '';
        return `(${sign}${semitones.toFixed(1)} st)`;
    }

    // Helper: Format Tone Value Label
    function formatToneLabel(hz) {
        if (hz <= 4000) return `Muffled (${hz}Hz)`;
        if (hz <= 10000) return `Warm (${hz}Hz)`;
        if (hz <= 16000) return `Natural (${hz}Hz)`;
        return `Bright (${hz}Hz)`;
    }

    // Theme Switcher
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('theme-dark');
        if (isDark) {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
            themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        } else {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
            themeToggle.setAttribute('aria-label', 'Switch to light mode');
        }
    });

    // Handle Drop & Select File
    dropZone.addEventListener('click', (e) => {
        if (e.target.id !== 'btnChangeFile') {
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    btnChangeFile.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|flac|m4a|aac|ogg)$/i)) {
            alert('Please select a valid audio file (MP3, WAV, FLAC, M4A, OGG, AAC).');
            return;
        }

        // Display File Meta
        fileNameDisplay.textContent = file.name;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        fileMetaDisplay.textContent = `${sizeMb} MB`;
        
        // Output Name Input Suggestion
        const dotIdx = file.name.lastIndexOf('.');
        const baseName = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;
        outputNameInput.value = `${baseName} (Slowed + Reverb)`;

        // Read ID3 Cover Art
        resetCoverArt();
        if (window.jsmediatags) {
            window.jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const picture = tag.tags.picture;
                    if (picture) {
                        let base64String = "";
                        for (let i = 0; i < picture.data.length; i++) {
                            base64String += String.fromCharCode(picture.data[i]);
                        }
                        const base64 = "data:" + picture.format + ";base64," + window.btoa(base64String);
                        fileCoverWrap.innerHTML = `<img src="${base64}" class="file-cover-img" alt="Cover Art">`;
                    }
                },
                onError: () => {}
            });
        }

        // Read & Decode Audio Buffer
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                const arrayBuffer = e.target.result;
                originalAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

                fileOriginalDuration.textContent = `Original: ${formatTime(originalAudioBuffer.duration)}`;
                
                uploadPrompt.classList.add('hidden');
                fileDetails.classList.remove('hidden');
                studioSection.classList.remove('hidden');

                // Reset Playback
                stopPlayback();
                updateTotalDurationDisplay();
                statusBadge.textContent = 'Ready';
                exportReadyCard.classList.add('hidden');
            } catch (err) {
                console.error('Failed to decode audio file:', err);
                alert('Could not decode audio file. Please try another audio file.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function resetCoverArt() {
        fileCoverWrap.innerHTML = '<div class="file-icon-lead" id="fileIconLead">🎵</div>';
    }

    // Audio Synthetic Reverb Impulse Response Generator
    function createReverbImpulseBuffer(ctx, durationSeconds, decaySec) {
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * durationSeconds;
        const impulseBuffer = ctx.createBuffer(2, length, sampleRate);
        const left = impulseBuffer.getChannelData(0);
        const right = impulseBuffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const decayFactor = Math.pow(1 - time / durationSeconds, decaySec);
            left[i] = (Math.random() * 2 - 1) * decayFactor;
            right[i] = (Math.random() * 2 - 1) * decayFactor;
        }
        return impulseBuffer;
    }

    // Live DSP Web Audio Chain
    function setupAudioGraph() {
        if (!audioCtx || !originalAudioBuffer) return;

        if (currentSourceNode) {
            try { currentSourceNode.stop(); } catch (_) {}
            currentSourceNode.disconnect();
        }

        currentSourceNode = audioCtx.createBufferSource();
        currentSourceNode.buffer = originalAudioBuffer;
        currentSourceNode.playbackRate.value = parseFloat(speedSlider.value);

        // Tone Filter (Lowpass)
        filterToneNode = audioCtx.createBiquadFilter();
        filterToneNode.type = 'lowpass';
        filterToneNode.frequency.value = parseFloat(toneSlider.value);

        // Bass Boost (Lowshelf at 200Hz)
        filterBassNode = audioCtx.createBiquadFilter();
        filterBassNode.type = 'lowshelf';
        filterBassNode.frequency.value = 200;
        filterBassNode.gain.value = parseFloat(bassSlider.value);

        // Reverb Branch
        preDelayNode = audioCtx.createDelay(1.0);
        preDelayNode.delayTime.value = parseFloat(reverbPreDelaySlider.value) / 1000.0;

        convolverNode = audioCtx.createConvolver();
        const decayVal = parseFloat(reverbDecaySlider.value);
        convolverNode.buffer = createReverbImpulseBuffer(audioCtx, decayVal, 2.5);

        // Mixers
        const mix = parseFloat(reverbMixSlider.value);
        dryGainNode = audioCtx.createGain();
        wetGainNode = audioCtx.createGain();
        dryGainNode.gain.value = 1.0 - (mix * 0.5);
        wetGainNode.gain.value = mix * 0.8;

        // Analyser for Visualization
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;

        // Audio Graph Routing
        currentSourceNode.connect(filterToneNode);
        filterToneNode.connect(filterBassNode);

        filterBassNode.connect(dryGainNode);
        filterBassNode.connect(preDelayNode);
        preDelayNode.connect(convolverNode);
        convolverNode.connect(wetGainNode);

        dryGainNode.connect(analyserNode);
        wetGainNode.connect(analyserNode);

        analyserNode.connect(audioCtx.destination);
    }

    // Play / Pause Controls
    btnPlayPause.addEventListener('click', () => {
        if (!originalAudioBuffer) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        if (isPlaying) {
            pausePlayback();
        } else {
            startPlayback();
        }
    });

    btnStop.addEventListener('click', () => {
        stopPlayback();
    });

    function startPlayback() {
        setupAudioGraph();
        playbackStartTime = audioCtx.currentTime - (startOffset / parseFloat(speedSlider.value));
        currentSourceNode.start(0, startOffset);
        isPlaying = true;

        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        statusBadge.textContent = 'Playing';

        currentSourceNode.onended = () => {
            if (isPlaying && (audioCtx.currentTime - playbackStartTime) * parseFloat(speedSlider.value) >= originalAudioBuffer.duration - 0.1) {
                stopPlayback();
            }
        };

        requestAnimationFrame(updatePlaybackProgress);
        drawVisualizer();
    }

    function pausePlayback() {
        if (!isPlaying) return;
        isPlaying = false;
        startOffset = (audioCtx.currentTime - playbackStartTime) * parseFloat(speedSlider.value);
        if (currentSourceNode) {
            try { currentSourceNode.stop(); } catch (_) {}
        }
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        statusBadge.textContent = 'Paused';
    }

    function stopPlayback() {
        isPlaying = false;
        startOffset = 0;
        if (currentSourceNode) {
            try { currentSourceNode.stop(); } catch (_) {}
        }
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        progressFill.style.width = '0%';
        currentTimeDisplay.textContent = '0:00';
        statusBadge.textContent = 'Ready';
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        clearCanvas();
    }

    function updatePlaybackProgress() {
        if (!isPlaying || !originalAudioBuffer) return;

        const currentSpeed = parseFloat(speedSlider.value);
        const playedSecs = (audioCtx.currentTime - playbackStartTime) * currentSpeed;
        const totalDuration = originalAudioBuffer.duration;

        if (playedSecs <= totalDuration) {
            const percent = (playedSecs / totalDuration) * 100;
            progressFill.style.width = `${Math.min(percent, 100)}%`;
            currentTimeDisplay.textContent = formatTime(playedSecs / currentSpeed);
            animationFrameId = requestAnimationFrame(updatePlaybackProgress);
        } else {
            stopPlayback();
        }
    }

    // Progress Bar Seek
    progressBar.addEventListener('click', (e) => {
        if (!originalAudioBuffer) return;
        const rect = progressBar.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seekTime = clickRatio * originalAudioBuffer.duration;

        startOffset = seekTime;
        if (isPlaying) {
            startPlayback();
        } else {
            progressFill.style.width = `${clickRatio * 100}%`;
            currentTimeDisplay.textContent = formatTime(seekTime / parseFloat(speedSlider.value));
        }
    });

    // Control Event Listeners & Live Audio Parameters Update
    speedSlider.addEventListener('input', () => {
        const val = parseFloat(speedSlider.value);
        speedVal.textContent = `${Math.round(val * 100)}%`;
        pitchSemitones.textContent = calculateSemitones(val);
        if (currentSourceNode && isPlaying) {
            currentSourceNode.playbackRate.setValueAtTime(val, audioCtx.currentTime);
        }
        updateTotalDurationDisplay();
    });

    btnSpeedDown.addEventListener('click', () => {
        let val = Math.max(0.50, parseFloat((parseFloat(speedSlider.value) - 0.01).toFixed(2)));
        speedSlider.value = val;
        speedSlider.dispatchEvent(new Event('input'));
    });

    btnSpeedReset.addEventListener('click', () => {
        speedSlider.value = 0.85;
        speedSlider.dispatchEvent(new Event('input'));
    });

    btnSpeedUp.addEventListener('click', () => {
        let val = Math.min(1.15, parseFloat((parseFloat(speedSlider.value) + 0.01).toFixed(2)));
        speedSlider.value = val;
        speedSlider.dispatchEvent(new Event('input'));
    });

    reverbMixSlider.addEventListener('input', () => {
        const mix = parseFloat(reverbMixSlider.value);
        reverbMixVal.textContent = `${Math.round(mix * 100)}%`;
        if (dryGainNode && wetGainNode && audioCtx) {
            dryGainNode.gain.setValueAtTime(1.0 - (mix * 0.5), audioCtx.currentTime);
            wetGainNode.gain.setValueAtTime(mix * 0.8, audioCtx.currentTime);
        }
    });

    reverbDecaySlider.addEventListener('input', () => {
        const decay = parseFloat(reverbDecaySlider.value);
        reverbDecayVal.textContent = `${decay.toFixed(1)}s`;
        if (isPlaying) {
            setupAudioGraph();
            startPlayback();
        }
    });

    reverbPreDelaySlider.addEventListener('input', () => {
        const preDelayMs = parseFloat(reverbPreDelaySlider.value);
        reverbPreDelayVal.textContent = `${preDelayMs}ms`;
        if (preDelayNode && audioCtx) {
            preDelayNode.delayTime.setValueAtTime(preDelayMs / 1000.0, audioCtx.currentTime);
        }
    });

    toneSlider.addEventListener('input', () => {
        const hz = parseFloat(toneSlider.value);
        toneVal.textContent = formatToneLabel(hz);
        if (filterToneNode && audioCtx) {
            filterToneNode.frequency.setValueAtTime(hz, audioCtx.currentTime);
        }
    });

    bassSlider.addEventListener('input', () => {
        const db = parseFloat(bassSlider.value);
        bassVal.textContent = `+${db.toFixed(1)} dB`;
        if (filterBassNode && audioCtx) {
            filterBassNode.gain.setValueAtTime(db, audioCtx.currentTime);
        }
    });

    function updateTotalDurationDisplay() {
        if (!originalAudioBuffer) return;
        const currentSpeed = parseFloat(speedSlider.value);
        const slowedDuration = originalAudioBuffer.duration / currentSpeed;
        totalTimeDisplay.textContent = formatTime(slowedDuration);
    }

    // Presets Selection
    presetsGrid.addEventListener('click', (e) => {
        const presetCard = e.target.closest('.preset-card');
        if (!presetCard) return;

        const presetKey = presetCard.getAttribute('data-preset');
        if (!PRESETS[presetKey]) return;

        document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('active'));
        presetCard.classList.add('active');

        applyPreset(presetKey);
    });

    function applyPreset(presetKey) {
        const p = PRESETS[presetKey];

        speedSlider.value = p.speed;
        speedSlider.dispatchEvent(new Event('input'));

        reverbMixSlider.value = p.mix;
        reverbMixSlider.dispatchEvent(new Event('input'));

        reverbDecaySlider.value = p.decay;
        reverbDecaySlider.dispatchEvent(new Event('input'));

        reverbPreDelaySlider.value = p.preDelay;
        reverbPreDelaySlider.dispatchEvent(new Event('input'));

        toneSlider.value = p.tone;
        toneSlider.dispatchEvent(new Event('input'));

        bassSlider.value = p.bass;
        bassSlider.dispatchEvent(new Event('input'));
    }

    // Custom Suffix Buttons
    suffixBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const suffix = btn.getAttribute('data-suffix');
            let currentVal = outputNameInput.value.trim();
            currentVal = currentVal.replace(/\s*\([^)]*\)$/, '');
            outputNameInput.value = `${currentVal}${suffix}`;
        });
    });

    // Visualizer Canvas Drawing
    function clearCanvas() {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function drawVisualizer() {
        if (!isPlaying || !analyserNode) {
            clearCanvas();
            return;
        }

        const mode = visModeSelect.value;
        const width = canvas.width;
        const height = canvas.height;

        canvasCtx.clearRect(0, 0, width, height);

        if (mode === 'bars') {
            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteFrequencyData(dataArray);

            const barWidth = (width / bufferLength) * 2.2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;
                const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
                gradient.addColorStop(0, '#38bdf8');
                gradient.addColorStop(0.5, '#f472b6');
                gradient.addColorStop(1, '#a855f7');

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        } else if (mode === 'wave') {
            const bufferLength = analyserNode.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteTimeDomainData(dataArray);

            canvasCtx.lineWidth = 3 * (window.devicePixelRatio || 1);
            const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#38bdf8');
            gradient.addColorStop(0.5, '#f472b6');
            gradient.addColorStop(1, '#c084fc');
            canvasCtx.strokeStyle = gradient;

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
            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteFrequencyData(dataArray);

            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) / 4;

            canvasCtx.beginPath();
            canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            canvasCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();

            for (let i = 0; i < bufferLength; i += 2) {
                const angle = (i / bufferLength) * Math.PI * 2;
                const amplitude = (dataArray[i] / 255) * (radius * 0.8);
                const x1 = centerX + Math.cos(angle) * radius;
                const y1 = centerY + Math.sin(angle) * radius;
                const x2 = centerX + Math.cos(angle) * (radius + amplitude);
                const y2 = centerY + Math.sin(angle) * (radius + amplitude);

                canvasCtx.beginPath();
                canvasCtx.moveTo(x1, y1);
                canvasCtx.lineTo(x2, y2);
                canvasCtx.strokeStyle = `hsl(${(i / bufferLength) * 360}, 80%, 65%)`;
                canvasCtx.lineWidth = 3;
                canvasCtx.stroke();
            }
        }

        if (isPlaying) {
            requestAnimationFrame(drawVisualizer);
        }
    }

    // Audio Export Conversion (Offline Audio Context)
    btnConvert.addEventListener('click', async () => {
        if (!originalAudioBuffer) return;

        btnConvert.disabled = true;
        convertProgressBar.classList.remove('hidden');
        convertProgressFill.style.width = '10%';
        convertStatusText.textContent = 'Preparing DSP Offline Context...';

        try {
            const speed = parseFloat(speedSlider.value);
            const decay = parseFloat(reverbDecaySlider.value);
            const mix = parseFloat(reverbMixSlider.value);
            const tone = parseFloat(toneSlider.value);
            const bass = parseFloat(bassSlider.value);
            const preDelayMs = parseFloat(reverbPreDelaySlider.value);

            const outputDuration = (originalAudioBuffer.duration / speed) + decay + (preDelayMs / 1000);
            const sampleRate = originalAudioBuffer.sampleRate;
            const outputFrameCount = Math.ceil(outputDuration * sampleRate);

            const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
                2,
                outputFrameCount,
                sampleRate
            );

            // Re-create nodes in Offline Context
            const source = offlineCtx.createBufferSource();
            source.buffer = originalAudioBuffer;
            source.playbackRate.value = speed;

            const toneFilter = offlineCtx.createBiquadFilter();
            toneFilter.type = 'lowpass';
            toneFilter.frequency.value = tone;

            const bassFilter = offlineCtx.createBiquadFilter();
            bassFilter.type = 'lowshelf';
            bassFilter.frequency.value = 200;
            bassFilter.gain.value = bass;

            const preDelay = offlineCtx.createDelay(1.0);
            preDelay.delayTime.value = preDelayMs / 1000.0;

            const convolver = offlineCtx.createConvolver();
            convolver.buffer = createReverbImpulseBuffer(offlineCtx, decay, 2.5);

            const dryGain = offlineCtx.createGain();
            const wetGain = offlineCtx.createGain();
            dryGain.gain.value = 1.0 - (mix * 0.5);
            wetGain.gain.value = mix * 0.8;

            // Connect offline graph
            source.connect(toneFilter);
            toneFilter.connect(bassFilter);

            bassFilter.connect(dryGain);
            bassFilter.connect(preDelay);
            preDelay.connect(convolver);
            convolver.connect(wetGain);

            dryGain.connect(offlineCtx.destination);
            wetGain.connect(offlineCtx.destination);

            source.start(0);

            convertProgressFill.style.width = '40%';
            convertStatusText.textContent = 'Rendering Audio Effects (High-Speed DSP)...';

            const renderedBuffer = await offlineCtx.startRendering();

            convertProgressFill.style.width = '80%';
            convertStatusText.textContent = 'Encoding lossless 16-bit PCM WAV...';

            // Convert AudioBuffer to WAV Blob
            processedAudioBlob = audioBufferToWavBlob(renderedBuffer);
            if (processedAudioUrl) {
                URL.revokeObjectURL(processedAudioUrl);
            }
            processedAudioUrl = URL.createObjectURL(processedAudioBlob);

            convertProgressFill.style.width = '100%';
            convertStatusText.textContent = 'Conversion Complete!';

            setTimeout(() => {
                convertProgressBar.classList.add('hidden');
                btnConvert.disabled = false;
                exportReadyCard.classList.remove('hidden');
                
                const mbSize = (processedAudioBlob.size / (1024 * 1024)).toFixed(2);
                exportMetaInfo.textContent = `WAV 16-bit Stereo PCM • ${mbSize} MB • Duration: ${formatTime(renderedBuffer.duration)}`;
            }, 400);

        } catch (err) {
            console.error('Offline rendering error:', err);
            alert('Failed to process audio. Please try again.');
            convertProgressBar.classList.add('hidden');
            btnConvert.disabled = false;
        }
    });

    // Download Button Handler
    btnDownload.addEventListener('click', () => {
        if (!processedAudioUrl) return;
        const customName = outputNameInput.value.trim() || 'slowed_and_reverb';
        const fileName = customName.toLowerCase().endsWith('.wav') ? customName : `${customName}.wav`;

        const a = document.createElement('a');
        a.href = processedAudioUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Play Converted Audio Result Preview
    btnPlayConverted.addEventListener('click', () => {
        if (!processedAudioUrl) return;

        if (!convertedAudioElement) {
            convertedAudioElement = new Audio(processedAudioUrl);
            convertedAudioElement.addEventListener('ended', () => {
                isPlayingConverted = false;
                playConvertedIcon.textContent = '▶️';
                playConvertedText.textContent = 'Play Converted Result';
            });
        }

        if (isPlayingConverted) {
            convertedAudioElement.pause();
            isPlayingConverted = false;
            playConvertedIcon.textContent = '▶️';
            playConvertedText.textContent = 'Play Converted Result';
        } else {
            if (isPlaying) stopPlayback(); // stop live preview if active
            convertedAudioElement.play();
            isPlayingConverted = true;
            playConvertedIcon.textContent = '⏸️';
            playConvertedText.textContent = 'Pause Converted Audio';
        }
    });

    // WAV Encoder (AudioBuffer to 16-bit PCM Stereo WAV Blob)
    function audioBufferToWavBlob(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        let result;
        if (numChannels === 2) {
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            result = interleave(left, right);
        } else {
            result = buffer.getChannelData(0);
        }

        const dataLength = result.length * (bitDepth / 8);
        const bufferLength = 44 + dataLength;
        const wavBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(wavBuffer);

        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');

        // FMT sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);

        // DATA sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write PCM samples
        floatTo16BitPCM(view, 44, result);

        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    function interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);
        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    function floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }
});
