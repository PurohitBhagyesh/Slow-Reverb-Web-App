/* ==========================================================================
   SLOWED + REVERB STUDIO - APPLICATION LOGIC & DSP ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
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
    const statusBadge = document.getElementById('statusBadge');
    const presetsGrid = document.getElementById('presetsGrid');

    // Controls & Sliders
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

    // Visualizer & Player
    const visModeSelect = document.getElementById('visModeSelect');
    const visualizerCanvas = document.getElementById('visualizerCanvas');
    const canvasCtx = visualizerCanvas.getContext('2d');
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

    // --- AUDIO & DSP STATE ---
    let audioCtx = null;
    let audioBuffer = null;
    let sourceNode = null;
    let toneFilterNode = null;
    let bassFilterNode = null;
    let convolverNode = null;
    let dryGainNode = null;
    let wetGainNode = null;
    let analyserNode = null;
    let masterGainNode = null;

    let isPlaying = false;
    let startTime = 0;
    let pauseOffset = 0;
    let animFrameId = null;
    let currentAudioFile = null;
    let convertedBlob = null;
    let convertedAudioElement = null;
    let isConvertedPlaying = false;

    // Presets Configuration
    const presets = {
        classic: { speed: 0.85, mix: 0.40, decay: 3.5, preDelay: 30, tone: 16000, bass: 3.0 },
        nightdrive: { speed: 0.80, mix: 0.55, decay: 5.0, preDelay: 40, tone: 12000, bass: 6.0 },
        astral: { speed: 0.75, mix: 0.70, decay: 7.5, preDelay: 50, tone: 18000, bass: 2.0 },
        bedroom: { speed: 0.84, mix: 0.35, decay: 3.0, preDelay: 20, tone: 3500, bass: 4.0 },
        lofi: { speed: 0.92, mix: 0.25, decay: 2.5, preDelay: 15, tone: 8000, bass: 2.0 },
        chopped: { speed: 0.70, mix: 0.45, decay: 4.0, preDelay: 35, tone: 14000, bass: 8.0 }
    };

    // --- THEME TOGGLE ---
    themeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('theme-light');
        document.body.classList.toggle('theme-dark', !isLight);
        themeToggle.querySelector('.theme-toggle-icon').textContent = isLight ? '☀️' : '🌙';
    });

    // --- FILE UPLOAD & DROP ZONE ---
    dropZone.addEventListener('click', () => fileInput.click());
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

        currentAudioFile = file;
        fileNameDisplay.textContent = file.name;
        fileMetaDisplay.textContent = formatBytes(file.size);

        // Set default output name
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        outputNameInput.value = `${baseName} (Slowed + Reverb)`;

        // Extract Cover Art if jsmediatags is available
        fileCoverWrap.innerHTML = '<div class="file-icon-lead">🎵</div>';
        if (window.jsmediatags) {
            window.jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const picture = tag.tags.picture;
                    if (picture) {
                        let base64String = '';
                        for (let i = 0; i < picture.data.length; i++) {
                            base64String += String.fromCharCode(picture.data[i]);
                        }
                        const imageUrl = `data:${picture.format};base64,${window.btoa(base64String)}`;
                        fileCoverWrap.innerHTML = `<img src="${imageUrl}" class="file-cover-img" alt="Cover Art">`;
                    }
                },
                onError: (err) => console.log('ID3 Tag extraction skipped:', err)
            });
        }

        // Read & Decode Audio File
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                initAudioContext();
                statusBadge.textContent = 'Decoding...';
                statusBadge.className = 'badge badge-secondary';
                
                audioBuffer = await audioCtx.decodeAudioData(event.target.result);
                fileOriginalDuration.textContent = `Original: ${formatTime(audioBuffer.duration)}`;
                
                uploadPrompt.classList.add('hidden');
                fileDetails.classList.remove('hidden');
                studioSection.classList.remove('hidden');
                exportReadyCard.classList.add('hidden');
                
                statusBadge.textContent = 'Ready';
                statusBadge.className = 'badge badge-success';
                
                pauseOffset = 0;
                updateProgressUI(0);
                updateEffectLabels();
            } catch (err) {
                console.error('Audio decode error:', err);
                alert('Error decoding audio file. Please try another track.');
                statusBadge.textContent = 'Error';
                statusBadge.className = 'badge';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- WEB AUDIO API INITIALIZATION ---
    function initAudioContext() {
        if (!audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioCtx();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function buildDSPPipeline() {
        if (!audioCtx || !audioBuffer) return;

        // Source node
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = parseFloat(speedSlider.value);

        // Lowpass Tone Filter
        toneFilterNode = audioCtx.createBiquadFilter();
        toneFilterNode.type = 'lowpass';
        toneFilterNode.frequency.value = parseFloat(toneSlider.value);

        // 808 Bass Boost Lowshelf Filter
        bassFilterNode = audioCtx.createBiquadFilter();
        bassFilterNode.type = 'lowshelf';
        bassFilterNode.frequency.value = 100;
        bassFilterNode.gain.value = parseFloat(bassSlider.value);

        // Reverb Convolver & Mix
        convolverNode = audioCtx.createConvolver();
        updateReverbImpulse();

        dryGainNode = audioCtx.createGain();
        wetGainNode = audioCtx.createGain();
        const mix = parseFloat(reverbMixSlider.value);
        dryGainNode.gain.value = 1 - (mix * 0.4);
        wetGainNode.gain.value = mix * 1.2;

        // Analyser Node
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 512;

        // Master Gain
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = 1.0;

        // Signal Connections
        sourceNode.connect(toneFilterNode);
        toneFilterNode.connect(bassFilterNode);

        // Dry path
        bassFilterNode.connect(dryGainNode);
        dryGainNode.connect(analyserNode);

        // Wet path
        bassFilterNode.connect(convolverNode);
        convolverNode.connect(wetGainNode);
        wetGainNode.connect(analyserNode);

        analyserNode.connect(masterGainNode);
        masterGainNode.connect(audioCtx.destination);

        sourceNode.onended = () => {
            if (isPlaying && (getCurrentPlaybackTime() >= getEffectiveDuration())) {
                stopPlayback();
            }
        };
    }

    function updateReverbImpulse() {
        if (!audioCtx || !convolverNode) return;
        const duration = parseFloat(reverbDecaySlider.value);
        const preDelayMs = parseFloat(reverbPreDelaySlider.value);
        convolverNode.buffer = generateImpulseResponse(audioCtx, duration, preDelayMs);
    }

    function generateImpulseResponse(ctx, duration, preDelayMs) {
        const sampleRate = ctx.sampleRate;
        const preDelaySamples = Math.floor(sampleRate * (preDelayMs / 1000));
        const length = Math.floor(sampleRate * duration) + preDelaySamples;
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = preDelaySamples; i < length; i++) {
            const t = (i - preDelaySamples) / (length - preDelaySamples);
            const envelope = Math.pow(1 - t, 2.5);
            left[i] = (Math.random() * 2 - 1) * envelope;
            right[i] = (Math.random() * 2 - 1) * envelope;
        }
        return impulse;
    }

    // --- TRANSPORT CONTROLS ---
    btnPlayPause.addEventListener('click', () => {
        if (!audioBuffer) return;
        if (isPlaying) {
            pausePlayback();
        } else {
            startPlayback(pauseOffset);
        }
    });

    btnStop.addEventListener('click', () => {
        stopPlayback();
    });

    function startPlayback(offset = 0) {
        initAudioContext();
        if (isPlaying) stopSourceOnly();

        buildDSPPipeline();
        const speed = parseFloat(speedSlider.value);
        const startBufferOffset = offset * speed;

        sourceNode.start(0, Math.min(startBufferOffset, audioBuffer.duration));
        startTime = audioCtx.currentTime - offset;
        isPlaying = true;

        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        statusBadge.textContent = 'Playing';
        statusBadge.className = 'badge badge-success';

        startVisualizerLoop();
    }

    function pausePlayback() {
        if (!isPlaying) return;
        pauseOffset = getCurrentPlaybackTime();
        stopSourceOnly();
        isPlaying = false;

        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        statusBadge.textContent = 'Paused';
        statusBadge.className = 'badge badge-secondary';
    }

    function stopPlayback() {
        stopSourceOnly();
        isPlaying = false;
        pauseOffset = 0;

        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        statusBadge.textContent = 'Ready';
        statusBadge.className = 'badge badge-success';

        updateProgressUI(0);
    }

    function stopSourceOnly() {
        if (sourceNode) {
            try {
                sourceNode.stop();
                sourceNode.disconnect();
            } catch (e) {}
            sourceNode = null;
        }
    }

    function getCurrentPlaybackTime() {
        if (!isPlaying) return pauseOffset;
        return audioCtx.currentTime - startTime;
    }

    function getEffectiveDuration() {
        if (!audioBuffer) return 0;
        return audioBuffer.duration / parseFloat(speedSlider.value);
    }

    // Progress bar click & seek
    progressBar.addEventListener('click', (e) => {
        if (!audioBuffer) return;
        const rect = progressBar.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetTime = clickRatio * getEffectiveDuration();
        
        pauseOffset = targetTime;
        if (isPlaying) {
            startPlayback(targetTime);
        } else {
            updateProgressUI(targetTime);
        }
    });

    function updateProgressUI(currentTime) {
        const total = getEffectiveDuration();
        const percent = total > 0 ? (currentTime / total) * 100 : 0;
        progressFill.style.width = `${Math.min(100, percent)}%`;
        currentTimeDisplay.textContent = formatTime(currentTime);
        totalTimeDisplay.textContent = formatTime(total);
    }

    // --- DSP CONTROLS & SLIDERS INTERACTION ---
    speedSlider.addEventListener('input', () => {
        const val = parseFloat(speedSlider.value);
        if (sourceNode && isPlaying) {
            const currTime = getCurrentPlaybackTime();
            sourceNode.playbackRate.setValueAtTime(val, audioCtx.currentTime);
            startTime = audioCtx.currentTime - currTime;
        }
        updateEffectLabels();
    });

    btnSpeedDown.addEventListener('click', () => {
        speedSlider.value = Math.max(0.50, parseFloat(speedSlider.value) - 0.01).toFixed(2);
        speedSlider.dispatchEvent(new Event('input'));
    });
    btnSpeedReset.addEventListener('click', () => {
        speedSlider.value = 0.85;
        speedSlider.dispatchEvent(new Event('input'));
    });
    btnSpeedUp.addEventListener('click', () => {
        speedSlider.value = Math.min(1.15, parseFloat(speedSlider.value) + 0.01).toFixed(2);
        speedSlider.dispatchEvent(new Event('input'));
    });

    reverbMixSlider.addEventListener('input', () => {
        if (dryGainNode && wetGainNode) {
            const mix = parseFloat(reverbMixSlider.value);
            dryGainNode.gain.setValueAtTime(1 - (mix * 0.4), audioCtx.currentTime);
            wetGainNode.gain.setValueAtTime(mix * 1.2, audioCtx.currentTime);
        }
        updateEffectLabels();
    });

    reverbDecaySlider.addEventListener('input', () => {
        updateReverbImpulse();
        updateEffectLabels();
    });

    reverbPreDelaySlider.addEventListener('input', () => {
        updateReverbImpulse();
        updateEffectLabels();
    });

    toneSlider.addEventListener('input', () => {
        if (toneFilterNode) {
            toneFilterNode.frequency.setValueAtTime(parseFloat(toneSlider.value), audioCtx.currentTime);
        }
        updateEffectLabels();
    });

    bassSlider.addEventListener('input', () => {
        if (bassFilterNode) {
            bassFilterNode.gain.setValueAtTime(parseFloat(bassSlider.value), audioCtx.currentTime);
        }
        updateEffectLabels();
    });

    function updateEffectLabels() {
        const speed = parseFloat(speedSlider.value);
        speedVal.textContent = `${Math.round(speed * 100)}%`;
        
        // Calculate pitch drop semitones: 12 * log2(speed)
        const semitones = (12 * Math.log2(speed)).toFixed(1);
        pitchSemitones.textContent = `(${semitones > 0 ? '+' : ''}${semitones} st)`;

        reverbMixVal.textContent = `${Math.round(parseFloat(reverbMixSlider.value) * 100)}%`;
        reverbDecayVal.textContent = `${parseFloat(reverbDecaySlider.value).toFixed(1)}s`;
        reverbPreDelayVal.textContent = `${reverbPreDelaySlider.value}ms`;
        
        const freq = toneSlider.value;
        let toneLabel = 'Default';
        if (freq <= 4000) toneLabel = 'Heavy Muffle';
        else if (freq <= 8000) toneLabel = 'Lo-Fi Muffled';
        else if (freq <= 16000) toneLabel = 'Warm';
        else toneLabel = 'Crisp';
        toneVal.textContent = `${toneLabel} (${freq}Hz)`;

        bassVal.textContent = `+${parseFloat(bassSlider.value).toFixed(1)} dB`;

        if (audioBuffer) {
            updateProgressUI(getCurrentPlaybackTime());
        }
    }

    // --- PRESETS HANDLING ---
    presetsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.preset-card');
        if (!card) return;

        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const presetKey = card.dataset.preset;
        const config = presets[presetKey];
        if (!config) return;

        speedSlider.value = config.speed;
        reverbMixSlider.value = config.mix;
        reverbDecaySlider.value = config.decay;
        reverbPreDelaySlider.value = config.preDelay;
        toneSlider.value = config.tone;
        bassSlider.value = config.bass;

        if (dryGainNode && wetGainNode) {
            dryGainNode.gain.value = 1 - (config.mix * 0.4);
            wetGainNode.gain.value = config.mix * 1.2;
        }
        if (toneFilterNode) toneFilterNode.frequency.value = config.tone;
        if (bassFilterNode) bassFilterNode.gain.value = config.bass;
        updateReverbImpulse();
        updateEffectLabels();
    });

    // --- VISUALIZER LOOP ---
    function startVisualizerLoop() {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        
        function render() {
            fitCanvas();
            const width = visualizerCanvas.width;
            const height = visualizerCanvas.height;
            const mode = visModeSelect.value;

            canvasCtx.clearRect(0, 0, width, height);

            if (isPlaying && analyserNode) {
                updateProgressUI(getCurrentPlaybackTime());
                const bufferLength = analyserNode.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                if (mode === 'wave') {
                    analyserNode.getByteTimeDomainData(dataArray);
                    drawOscilloscope(dataArray, bufferLength, width, height);
                } else if (mode === 'circle') {
                    analyserNode.getByteFrequencyData(dataArray);
                    drawCircularSpectrum(dataArray, bufferLength, width, height);
                } else {
                    analyserNode.getByteFrequencyData(dataArray);
                    drawNeonSpectrum(dataArray, bufferLength, width, height);
                }
            } else {
                drawIdleCanvas(width, height);
            }

            animFrameId = requestAnimationFrame(render);
        }
        render();
    }

    function fitCanvas() {
        const rect = visualizerCanvas.getBoundingClientRect();
        if (visualizerCanvas.width !== rect.width || visualizerCanvas.height !== rect.height) {
            visualizerCanvas.width = rect.width;
            visualizerCanvas.height = rect.height;
        }
    }

    function drawNeonSpectrum(dataArray, bufferLength, width, height) {
        const barWidth = (width / (bufferLength * 0.65)) * 2.2;
        let x = 0;
        for (let i = 0; i < bufferLength * 0.65; i++) {
            const barHeight = (dataArray[i] / 255) * (height * 0.85);
            const grad = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(0.5, '#a855f7');
            grad.addColorStop(1, '#f472b6');

            canvasCtx.fillStyle = grad;
            canvasCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }

    function drawOscilloscope(dataArray, bufferLength, width, height) {
        canvasCtx.lineWidth = 2.5;
        canvasCtx.strokeStyle = '#f472b6';
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
    }

    function drawCircularSpectrum(dataArray, bufferLength, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) * 0.45;
        const numBars = 60;

        for (let i = 0; i < numBars; i++) {
            const value = dataArray[i * 2] || 0;
            const barHeight = (value / 255) * 35;
            const angle = (i / numBars) * Math.PI * 2;
            
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            canvasCtx.strokeStyle = '#38bdf8';
            canvasCtx.lineWidth = 3;
            canvasCtx.beginPath();
            canvasCtx.moveTo(x1, y1);
            canvasCtx.lineTo(x2, y2);
            canvasCtx.stroke();
        }
    }

    function drawIdleCanvas(width, height) {
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        canvasCtx.font = '600 0.8rem sans-serif';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Press Play for Real-Time Visualizer', width / 2, height / 2 + 4);
    }

    // --- EXPORT & RENAME HANDLERS ---
    suffixBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const suffix = btn.dataset.suffix;
            outputNameInput.value = outputNameInput.value.replace(/\s*\([^)]*\)/g, '') + suffix;
        });
    });

    btnConvert.addEventListener('click', async () => {
        if (!audioBuffer) return;
        if (isPlaying) pausePlayback();

        btnConvert.disabled = true;
        convertProgressBar.classList.remove('hidden');
        exportReadyCard.classList.add('hidden');
        convertProgressFill.style.width = '15%';
        convertStatusText.textContent = 'Initializing Offline DSP Engine...';

        setTimeout(async () => {
            try {
                convertProgressFill.style.width = '45%';
                convertStatusText.textContent = 'Applying Reverb, Pitch Shift & Lowpass Filters...';
                
                const renderedBuffer = await renderAudioOffline();
                
                convertProgressFill.style.width = '85%';
                convertStatusText.textContent = 'Encoding 16-bit Lossless Stereo WAV File...';
                
                convertedBlob = bufferToWav(renderedBuffer);
                
                convertProgressFill.style.width = '100%';
                convertStatusText.textContent = 'Audio Processing Complete!';
                
                exportMetaInfo.textContent = `WAV (16-bit PCM • Stereo • ${formatTime(renderedBuffer.duration)})`;
                exportReadyCard.classList.remove('hidden');
                
                if (convertedAudioElement) {
                    convertedAudioElement.pause();
                    convertedAudioElement = null;
                }
                playConvertedText.textContent = 'Play Converted Result';
                playConvertedIcon.textContent = '▶️';
                isConvertedPlaying = false;
            } catch (err) {
                console.error('Offline export error:', err);
                alert('An error occurred during audio processing. Please try again.');
            } finally {
                btnConvert.disabled = false;
            }
        }, 100);
    });

    // Offline Audio Rendering Engine
    async function renderAudioOffline() {
        const speed = parseFloat(speedSlider.value);
        const decay = parseFloat(reverbDecaySlider.value);
        const preDelay = parseFloat(reverbPreDelaySlider.value) / 1000;
        const toneFreq = parseFloat(toneSlider.value);
        const bassGain = parseFloat(bassSlider.value);
        const mix = parseFloat(reverbMixSlider.value);

        const outputDuration = (audioBuffer.duration / speed) + decay + preDelay + 0.5;
        const sampleRate = audioBuffer.sampleRate;
        const offlineCtx = new OfflineAudioContext(2, Math.ceil(outputDuration * sampleRate), sampleRate);

        const offlineSource = offlineCtx.createBufferSource();
        offlineSource.buffer = audioBuffer;
        offlineSource.playbackRate.value = speed;

        const offlineTone = offlineCtx.createBiquadFilter();
        offlineTone.type = 'lowpass';
        offlineTone.frequency.value = toneFreq;

        const offlineBass = offlineCtx.createBiquadFilter();
        offlineBass.type = 'lowshelf';
        offlineBass.frequency.value = 100;
        offlineBass.gain.value = bassGain;

        const offlineConvolver = offlineCtx.createConvolver();
        offlineConvolver.buffer = generateImpulseResponse(offlineCtx, decay, reverbPreDelaySlider.value);

        const offlineDry = offlineCtx.createGain();
        const offlineWet = offlineCtx.createGain();
        offlineDry.gain.value = 1 - (mix * 0.4);
        offlineWet.gain.value = mix * 1.2;

        offlineSource.connect(offlineTone);
        offlineTone.connect(offlineBass);

        offlineBass.connect(offlineDry);
        offlineDry.connect(offlineCtx.destination);

        offlineBass.connect(offlineConvolver);
        offlineConvolver.connect(offlineWet);
        offlineWet.connect(offlineCtx.destination);

        offlineSource.start(0);
        return await offlineCtx.startRendering();
    }

    // Download Processed WAV
    btnDownload.addEventListener('click', () => {
        if (!convertedBlob) return;
        const url = URL.createObjectURL(convertedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        let filename = outputNameInput.value.trim() || 'slowed_reverb_track';
        if (!filename.toLowerCase().endsWith('.wav')) filename += '.wav';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    });

    // Play / Pause Converted WAV Result
    btnPlayConverted.addEventListener('click', () => {
        if (!convertedBlob) return;
        if (isPlaying) pausePlayback();

        if (!convertedAudioElement) {
            const url = URL.createObjectURL(convertedBlob);
            convertedAudioElement = new Audio(url);
            convertedAudioElement.onended = () => {
                isConvertedPlaying = false;
                playConvertedText.textContent = 'Play Converted Result';
                playConvertedIcon.textContent = '▶️';
            };
        }

        if (isConvertedPlaying) {
            convertedAudioElement.pause();
            isConvertedPlaying = false;
            playConvertedText.textContent = 'Play Converted Result';
            playConvertedIcon.textContent = '▶️';
        } else {
            convertedAudioElement.play();
            isConvertedPlaying = true;
            playConvertedText.textContent = 'Pause Result';
            playConvertedIcon.textContent = '⏸️';
        }
    });

    // --- UTILITY FUNCTIONS ---
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Convert AudioBuffer to 16-bit PCM WAV Blob
    function bufferToWav(buffer) {
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
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        let offset = 44;
        for (let i = 0; i < result.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, result[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    function interleave(leftChannel, rightChannel) {
        const length = leftChannel.length + rightChannel.length;
        const result = new Float32Array(length);
        let inputIndex = 0;
        for (let index = 0; index < length;) {
            result[index++] = leftChannel[inputIndex];
            result[index++] = rightChannel[inputIndex];
            inputIndex++;
        }
        return result;
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // Draw initial idle visualizer state
    fitCanvas();
    drawIdleCanvas(visualizerCanvas.width, visualizerCanvas.height);
});
