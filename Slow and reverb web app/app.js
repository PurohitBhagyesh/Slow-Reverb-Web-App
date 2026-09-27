/* ==========================================================================
   SLOWED + REVERB STUDIO - MAIN JS APPLICATION
   Handles Web Audio API DSP pipeline, presets, real-time audio visualization,
   offline rendering, and lossless 16-bit WAV audio export.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // DOM Element References
    // ----------------------------------------------------------------------
    const themeToggle = document.getElementById('themeToggle');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const fileDetails = document.getElementById('fileDetails');
    const fileCoverWrap = document.getElementById('fileCoverWrap');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileMetaDisplay = document.getElementById('fileMetaDisplay');
    const fileOriginalDuration = document.getElementById('fileOriginalDuration');
    const btnChangeFile = document.getElementById('btnChangeFile');

    const studioSection = document.getElementById('studioSection');
    const presetsGrid = document.getElementById('presetsGrid');
    const statusBadge = document.getElementById('statusBadge');

    // Controls
    const pitchSemitones = document.getElementById('pitchSemitones');
    const speedSlider = document.getElementById('speedSlider');
    const speedVal = document.getElementById('speedVal');
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

    // Visualizer & Transport
    const visModeSelect = document.getElementById('visModeSelect');
    const visualizerCanvas = document.getElementById('visualizerCanvas');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const totalTimeDisplay = document.getElementById('totalTimeDisplay');
    const btnPlayPause = document.getElementById('btnPlayPause');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const btnStop = document.getElementById('btnStop');

    // Export & Rename
    const outputNameInput = document.getElementById('outputNameInput');
    const suffixButtons = document.querySelectorAll('.suffix-btn');
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

    // Canvas setup
    const canvasCtx = visualizerCanvas.getContext('2d');

    // ----------------------------------------------------------------------
    // State & Presets
    // ----------------------------------------------------------------------
    let currentTheme = 'dark';
    let audioFile = null;
    let audioBuffer = null;
    let originalFileName = '';
    
    let audioCtx = null;
    let sourceNode = null;
    let toneFilterNode = null;
    let bassFilterNode = null;
    let preDelayNode = null;
    let convolverNode = null;
    let dryGainNode = null;
    let wetGainNode = null;
    let analyserNode = null;

    let isPlaying = false;
    let startTime = 0;
    let pauseOffset = 0;
    let animationFrameId = null;

    let convertedAudioBlob = null;
    let convertedAudioUrl = null;
    let convertedAudioPlayer = null;
    let isPlayingConverted = false;

    const PRESETS = {
        classic: { speed: 0.85, mix: 0.40, decay: 3.5, preDelay: 30, tone: 16000, bass: 3.0 },
        nightdrive: { speed: 0.80, mix: 0.50, decay: 4.5, preDelay: 40, tone: 12000, bass: 6.0 },
        astral: { speed: 0.75, mix: 0.65, decay: 6.5, preDelay: 50, tone: 18000, bass: 2.0 },
        bedroom: { speed: 0.84, mix: 0.35, decay: 2.5, preDelay: 20, tone: 4500, bass: 4.0 },
        lofi: { speed: 0.92, mix: 0.25, decay: 2.0, preDelay: 15, tone: 8000, bass: 2.5 },
        chopped: { speed: 0.70, mix: 0.30, decay: 3.0, preDelay: 20, tone: 14000, bass: 8.0 }
    };

    // ----------------------------------------------------------------------
    // Initialization & Theme
    // ----------------------------------------------------------------------
    themeToggle.addEventListener('click', () => {
        if (currentTheme === 'dark') {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
            currentTheme = 'light';
        } else {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
            currentTheme = 'dark';
        }
    });

    function resizeCanvas() {
        if (visualizerCanvas) {
            visualizerCanvas.width = visualizerCanvas.clientWidth * (window.devicePixelRatio || 1);
            visualizerCanvas.height = visualizerCanvas.clientHeight * (window.devicePixelRatio || 1);
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ----------------------------------------------------------------------
    // File Handling & Upload
    // ----------------------------------------------------------------------
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
        if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(file.name)) {
            alert('Please select a valid audio file (MP3, WAV, FLAC, M4A, OGG, AAC).');
            return;
        }

        stopAudio();
        audioFile = file;
        originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        // UI Updates
        fileNameDisplay.textContent = file.name;
        fileMetaDisplay.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        uploadPrompt.classList.add('hidden');
        fileDetails.classList.remove('hidden');
        studioSection.classList.remove('hidden');
        exportReadyCard.classList.add('hidden');

        outputNameInput.value = `${originalFileName} (Slowed + Reverb)`;

        // Reset Cover Art
        fileCoverWrap.innerHTML = `<div class="file-icon-lead" id="fileIconLead">🎵</div>`;

        // Extract Album Cover if available
        if (window.jsmediatags) {
            window.jsmediatags.read(file, {
                onSuccess: function (tag) {
                    if (tag.tags && tag.tags.picture) {
                        const { data, format } = tag.tags.picture;
                        let base64String = '';
                        for (let i = 0; i < data.length; i++) {
                            base64String += String.fromCharCode(data[i]);
                        }
                        const imageUrl = `data:${format};base64,${btoa(base64String)}`;
                        fileCoverWrap.innerHTML = `<img src="${imageUrl}" class="file-cover-img" alt="Cover Art">`;
                    }
                },
                onError: function () {
                    // Fallback handled by default icon
                }
            });
        }

        // Decode Audio Data
        const reader = new FileReader();
        statusBadge.textContent = 'Decoding...';
        statusBadge.className = 'badge badge-primary';

        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            initAudioContext();
            audioCtx.decodeAudioData(arrayBuffer, (buffer) => {
                audioBuffer = buffer;
                fileOriginalDuration.textContent = `Original: ${formatTime(buffer.duration)}`;
                totalTimeDisplay.textContent = formatTime(buffer.duration / parseFloat(speedSlider.value));
                statusBadge.textContent = 'Ready';
                statusBadge.className = 'badge badge-success';
                updateTimeDisplay();
            }, (err) => {
                console.error('Error decoding audio:', err);
                statusBadge.textContent = 'Decode Error';
                statusBadge.className = 'badge badge-primary';
                alert('Could not decode audio file. Please try another audio format.');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    // ----------------------------------------------------------------------
    // Web Audio DSP Engine
    // ----------------------------------------------------------------------
    function initAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function createReverbBuffer(duration, decay) {
        const sampleRate = audioCtx.sampleRate;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const impulse = audioCtx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length;
            const mult = Math.pow(1 - n, decay);
            left[i] = (Math.random() * 2 - 1) * mult;
            right[i] = (Math.random() * 2 - 1) * mult;
        }
        return impulse;
    }

    function buildDSPGraph() {
        if (!audioCtx || !audioBuffer) return;

        // Tone Filter (Lowpass)
        toneFilterNode = audioCtx.createBiquadFilter();
        toneFilterNode.type = 'lowpass';
        toneFilterNode.frequency.value = parseFloat(toneSlider.value);

        // Bass Filter (Low shelf)
        bassFilterNode = audioCtx.createBiquadFilter();
        bassFilterNode.type = 'lowshelf';
        bassFilterNode.frequency.value = 120;
        bassFilterNode.gain.value = parseFloat(bassSlider.value);

        // Pre-delay
        preDelayNode = audioCtx.createDelay();
        preDelayNode.delayTime.value = parseFloat(reverbPreDelaySlider.value) / 1000;

        // Convolver Reverb
        convolverNode = audioCtx.createConvolver();
        const decayVal = parseFloat(reverbDecaySlider.value);
        convolverNode.buffer = createReverbBuffer(decayVal, 3.0);

        // Wet / Dry Mix Gains
        const mixVal = parseFloat(reverbMixSlider.value);
        dryGainNode = audioCtx.createGain();
        wetGainNode = audioCtx.createGain();
        dryGainNode.gain.value = Math.cos(mixVal * 0.5 * Math.PI);
        wetGainNode.gain.value = Math.sin(mixVal * 0.5 * Math.PI);

        // Analyser Node for Visualizer
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;

        // Wire nodes: Tone -> Bass -> [Dry, PreDelay -> Convolver -> Wet] -> Analyser -> Destination
        toneFilterNode.connect(bassFilterNode);

        // Dry path
        bassFilterNode.connect(dryGainNode);
        dryGainNode.connect(analyserNode);

        // Wet path
        bassFilterNode.connect(preDelayNode);
        preDelayNode.connect(convolverNode);
        convolverNode.connect(wetGainNode);
        wetGainNode.connect(analyserNode);

        analyserNode.connect(audioCtx.destination);
    }

    function startPlayback(offset = 0) {
        if (!audioBuffer) return;
        initAudioContext();

        if (sourceNode) {
            try { sourceNode.stop(); } catch (e) {}
            sourceNode.disconnect();
        }

        buildDSPGraph();

        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = parseFloat(speedSlider.value);
        sourceNode.connect(toneFilterNode);

        startTime = audioCtx.currentTime - offset;
        pauseOffset = offset;
        sourceNode.start(0, offset);
        isPlaying = true;

        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');

        sourceNode.onended = () => {
            const effectiveDuration = audioBuffer.duration / parseFloat(speedSlider.value);
            if (audioCtx.currentTime - startTime >= effectiveDuration) {
                stopAudio();
            }
        };

        drawVisualizer();
    }

    function pauseAudio() {
        if (!isPlaying) return;
        pauseOffset = audioCtx.currentTime - startTime;
        if (sourceNode) {
            try { sourceNode.stop(); } catch (e) {}
            sourceNode.disconnect();
            sourceNode = null;
        }
        isPlaying = false;
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }

    function stopAudio() {
        pauseAudio();
        pauseOffset = 0;
        updateTimeDisplay();
        if (canvasCtx) {
            canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        }
    }

    btnPlayPause.addEventListener('click', () => {
        if (!audioBuffer) return;
        if (isPlaying) {
            pauseAudio();
        } else {
            startPlayback(pauseOffset);
        }
    });

    btnStop.addEventListener('click', () => {
        stopAudio();
    });

    // ----------------------------------------------------------------------
    // DSP Controls Events & Real-time Updates
    // ----------------------------------------------------------------------
    function updatePitchDisplay() {
        const speed = parseFloat(speedSlider.value);
        const semitones = 12 * Math.log2(speed);
        pitchSemitones.textContent = `(${semitones >= 0 ? '+' : ''}${semitones.toFixed(1)} st)`;
        speedVal.textContent = `${Math.round(speed * 100)}%`;

        if (audioBuffer) {
            totalTimeDisplay.textContent = formatTime(audioBuffer.duration / speed);
        }

        if (sourceNode && isPlaying) {
            sourceNode.playbackRate.value = speed;
        }
    }

    speedSlider.addEventListener('input', () => {
        updatePitchDisplay();
        updateTimeDisplay();
    });

    btnSpeedDown.addEventListener('click', () => {
        speedSlider.value = Math.max(0.50, parseFloat(speedSlider.value) - 0.01).toFixed(2);
        updatePitchDisplay();
        updateTimeDisplay();
    });

    btnSpeedReset.addEventListener('click', () => {
        speedSlider.value = 0.85;
        updatePitchDisplay();
        updateTimeDisplay();
    });

    btnSpeedUp.addEventListener('click', () => {
        speedSlider.value = Math.min(1.15, parseFloat(speedSlider.value) + 0.01).toFixed(2);
        updatePitchDisplay();
        updateTimeDisplay();
    });

    reverbMixSlider.addEventListener('input', () => {
        const val = parseFloat(reverbMixSlider.value);
        reverbMixVal.textContent = `${Math.round(val * 100)}%`;
        if (dryGainNode && wetGainNode) {
            dryGainNode.gain.value = Math.cos(val * 0.5 * Math.PI);
            wetGainNode.gain.value = Math.sin(val * 0.5 * Math.PI);
        }
    });

    reverbDecaySlider.addEventListener('input', () => {
        const val = parseFloat(reverbDecaySlider.value);
        reverbDecayVal.textContent = `${val.toFixed(1)}s`;
        if (convolverNode && audioCtx) {
            convolverNode.buffer = createReverbBuffer(val, 3.0);
        }
    });

    reverbPreDelaySlider.addEventListener('input', () => {
        const val = parseFloat(reverbPreDelaySlider.value);
        reverbPreDelayVal.textContent = `${val}ms`;
        if (preDelayNode) {
            preDelayNode.delayTime.value = val / 1000;
        }
    });

    toneSlider.addEventListener('input', () => {
        const val = parseFloat(toneSlider.value);
        let toneText = `${val}Hz`;
        if (val <= 4000) toneText = `Muffled (${val}Hz)`;
        else if (val <= 12000) toneText = `Warm (${val}Hz)`;
        else toneText = `Bright (${val}Hz)`;
        toneVal.textContent = toneText;

        if (toneFilterNode) {
            toneFilterNode.frequency.value = val;
        }
    });

    bassSlider.addEventListener('input', () => {
        const val = parseFloat(bassSlider.value);
        bassVal.textContent = `+${val.toFixed(1)} dB`;
        if (bassFilterNode) {
            bassFilterNode.gain.value = val;
        }
    });

    // Preset Selection
    presetsGrid.addEventListener('click', (e) => {
        const presetCard = e.target.closest('.preset-card');
        if (!presetCard) return;

        document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('active'));
        presetCard.classList.add('active');

        const presetKey = presetCard.dataset.preset;
        const config = PRESETS[presetKey];
        if (!config) return;

        speedSlider.value = config.speed;
        reverbMixSlider.value = config.mix;
        reverbDecaySlider.value = config.decay;
        reverbPreDelaySlider.value = config.preDelay;
        toneSlider.value = config.tone;
        bassSlider.value = config.bass;

        // Trigger updates
        updatePitchDisplay();
        reverbMixSlider.dispatchEvent(new Event('input'));
        reverbDecaySlider.dispatchEvent(new Event('input'));
        reverbPreDelaySlider.dispatchEvent(new Event('input'));
        toneSlider.dispatchEvent(new Event('input'));
        bassSlider.dispatchEvent(new Event('input'));
    });

    // ----------------------------------------------------------------------
    // Seeking & Progress Bar
    // ----------------------------------------------------------------------
    function updateTimeDisplay() {
        if (!audioBuffer) {
            currentTimeDisplay.textContent = '0:00';
            totalTimeDisplay.textContent = '0:00';
            progressFill.style.width = '0%';
            return;
        }

        const effectiveDuration = audioBuffer.duration / parseFloat(speedSlider.value);
        let elapsed = isPlaying ? (audioCtx.currentTime - startTime) : pauseOffset;
        elapsed = Math.max(0, Math.min(elapsed, effectiveDuration));

        currentTimeDisplay.textContent = formatTime(elapsed);
        totalTimeDisplay.textContent = formatTime(effectiveDuration);

        const pct = (elapsed / effectiveDuration) * 100;
        progressFill.style.width = `${pct}%`;

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(updateTimeDisplay);
        }
    }

    progressBar.addEventListener('click', (e) => {
        if (!audioBuffer) return;
        const rect = progressBar.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const effectiveDuration = audioBuffer.duration / parseFloat(speedSlider.value);
        const newOffset = clickRatio * effectiveDuration;

        if (isPlaying) {
            startPlayback(newOffset);
        } else {
            pauseOffset = newOffset;
            updateTimeDisplay();
        }
    });

    // ----------------------------------------------------------------------
    // Visualizer Canvas Rendering
    // ----------------------------------------------------------------------
    function drawVisualizer() {
        if (!isPlaying || !analyserNode) return;

        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        const mode = visModeSelect.value;

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
                canvasCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        } else if (mode === 'wave') {
            const bufferLength = analyserNode.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteTimeDomainData(dataArray);

            canvasCtx.lineWidth = 3 * (window.devicePixelRatio || 1);
            const gradient = canvasCtx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#38bdf8');
            gradient.addColorStop(0.5, '#f472b6');
            gradient.addColorStop(1, '#a855f7');
            canvasCtx.strokeStyle = gradient;

            canvasCtx.beginPath();
            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;

                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);

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
            const baseRadius = Math.min(centerX, centerY) * 0.4;

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const avg = sum / bufferLength;
            const pulseRadius = baseRadius + (avg / 255) * 25;

            canvasCtx.beginPath();
            canvasCtx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
            const gradient = canvasCtx.createRadialGradient(centerX, centerY, 5, centerX, centerY, pulseRadius);
            gradient.addColorStop(0, 'rgba(244, 114, 182, 0.8)');
            gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.4)');
            gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
            canvasCtx.fillStyle = gradient;
            canvasCtx.fill();

            // Ring path
            canvasCtx.beginPath();
            for (let i = 0; i < bufferLength; i++) {
                const angle = (i / bufferLength) * Math.PI * 2;
                const r = pulseRadius + (dataArray[i] / 255) * 20;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;

                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
            canvasCtx.closePath();
            canvasCtx.strokeStyle = '#f472b6';
            canvasCtx.lineWidth = 2 * (window.devicePixelRatio || 1);
            canvasCtx.stroke();
        }
    }

    // ----------------------------------------------------------------------
    // Suffix Buttons
    // ----------------------------------------------------------------------
    suffixButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const suffix = btn.dataset.suffix;
            outputNameInput.value = `${originalFileName}${suffix}`;
        });
    });

    // ----------------------------------------------------------------------
    // Offline DSP Rendering & WAV Export
    // ----------------------------------------------------------------------
    btnConvert.addEventListener('click', async () => {
        if (!audioBuffer) return;

        stopAudio();
        convertProgressBar.classList.remove('hidden');
        convertProgressFill.style.width = '10%';
        convertStatusText.textContent = 'Preparing DSP Offline Context...';
        btnConvert.disabled = true;

        setTimeout(async () => {
            try {
                const speed = parseFloat(speedSlider.value);
                const decay = parseFloat(reverbDecaySlider.value);
                const preDelay = parseFloat(reverbPreDelaySlider.value) / 1000;
                const mix = parseFloat(reverbMixSlider.value);
                const toneFreq = parseFloat(toneSlider.value);
                const bassGain = parseFloat(bassSlider.value);

                const renderDuration = (audioBuffer.duration / speed) + decay + preDelay;
                const sampleRate = audioBuffer.sampleRate;
                const frameCount = Math.ceil(renderDuration * sampleRate);

                const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                const offlineCtx = new OfflineContext(2, frameCount, sampleRate);

                // Nodes in Offline Context
                const offlineSource = offlineCtx.createBufferSource();
                offlineSource.buffer = audioBuffer;
                offlineSource.playbackRate.value = speed;

                const offlineTone = offlineCtx.createBiquadFilter();
                offlineTone.type = 'lowpass';
                offlineTone.frequency.value = toneFreq;

                const offlineBass = offlineCtx.createBiquadFilter();
                offlineBass.type = 'lowshelf';
                offlineBass.frequency.value = 120;
                offlineBass.gain.value = bassGain;

                const offlinePreDelay = offlineCtx.createDelay();
                offlinePreDelay.delayTime.value = preDelay;

                // Impulse Response for Reverb
                const impulseLen = Math.max(1, Math.floor(sampleRate * decay));
                const impulseBuffer = offlineCtx.createBuffer(2, impulseLen, sampleRate);
                const leftImp = impulseBuffer.getChannelData(0);
                const rightImp = impulseBuffer.getChannelData(1);
                for (let i = 0; i < impulseLen; i++) {
                    const n = i / impulseLen;
                    const mult = Math.pow(1 - n, 3.0);
                    leftImp[i] = (Math.random() * 2 - 1) * mult;
                    rightImp[i] = (Math.random() * 2 - 1) * mult;
                }

                const offlineConvolver = offlineCtx.createConvolver();
                offlineConvolver.buffer = impulseBuffer;

                const offlineDry = offlineCtx.createGain();
                const offlineWet = offlineCtx.createGain();
                offlineDry.gain.value = Math.cos(mix * 0.5 * Math.PI);
                offlineWet.gain.value = Math.sin(mix * 0.5 * Math.PI);

                // Wire Offline Graph
                offlineSource.connect(offlineTone);
                offlineTone.connect(offlineBass);

                offlineBass.connect(offlineDry);
                offlineDry.connect(offlineCtx.destination);

                offlineBass.connect(offlinePreDelay);
                offlinePreDelay.connect(offlineConvolver);
                offlineConvolver.connect(offlineWet);
                offlineWet.connect(offlineCtx.destination);

                convertProgressFill.style.width = '40%';
                convertStatusText.textContent = 'Rendering Audio Effects (Stereo DSP)...';

                offlineSource.start(0);

                const renderedBuffer = await offlineCtx.startRendering();

                convertProgressFill.style.width = '80%';
                convertStatusText.textContent = 'Encoding 16-bit PCM Lossless WAV File...';

                // Encode to WAV Blob
                convertedAudioBlob = encodeWAV(renderedBuffer);
                if (convertedAudioUrl) URL.revokeObjectURL(convertedAudioUrl);
                convertedAudioUrl = URL.createObjectURL(convertedAudioBlob);

                convertProgressFill.style.width = '100%';
                convertStatusText.textContent = 'Conversion Complete!';

                setTimeout(() => {
                    convertProgressBar.classList.add('hidden');
                    exportReadyCard.classList.remove('hidden');
                    exportMetaInfo.textContent = `WAV (16-bit Stereo PCM) • ${(convertedAudioBlob.size / (1024 * 1024)).toFixed(2)} MB • ${formatTime(renderDuration)}`;
                    btnConvert.disabled = false;
                }, 400);

            } catch (err) {
                console.error('Offline rendering error:', err);
                convertStatusText.textContent = 'Error during conversion.';
                btnConvert.disabled = false;
            }
        }, 50);
    });

    // WAV Encoder
    function encodeWAV(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length * numChannels * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);

        function writeString(offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        // RIFF header
        writeString(0, 'RIFF');
        view.setUint32(4, length - 8, true);
        writeString(8, 'WAVE');

        // FMT chunk
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true);              // AudioFormat (1 for PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
        view.setUint16(32, numChannels * 2, true);              // BlockAlign
        view.setUint16(34, 16, true);                           // BitsPerSample

        // DATA chunk
        writeString(36, 'data');
        view.setUint32(40, length - 44, true);

        // Write PCM Samples
        let offset = 44;
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }

        for (let i = 0; i < audioBuffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                let sample = channels[ch][i];
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 32768 : sample * 32767;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    // Download Handler
    btnDownload.addEventListener('click', () => {
        if (!convertedAudioUrl) return;
        const filename = (outputNameInput.value.trim() || 'slowed_reverb_track') + '.wav';
        const a = document.createElement('a');
        a.href = convertedAudioUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Converted Result Audio Player
    btnPlayConverted.addEventListener('click', () => {
        if (!convertedAudioUrl) return;

        if (!convertedAudioPlayer) {
            convertedAudioPlayer = new Audio(convertedAudioUrl);
            convertedAudioPlayer.onended = () => {
                isPlayingConverted = false;
                playConvertedIcon.textContent = '▶️';
                playConvertedText.textContent = 'Play Converted Result';
            };
        }

        if (isPlayingConverted) {
            convertedAudioPlayer.pause();
            isPlayingConverted = false;
            playConvertedIcon.textContent = '▶️';
            playConvertedText.textContent = 'Play Converted Result';
        } else {
            convertedAudioPlayer.play();
            isPlayingConverted = true;
            playConvertedIcon.textContent = '⏸️';
            playConvertedText.textContent = 'Pause Converted Result';
        }
    });

    // Helper Utility
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds <= 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
});
