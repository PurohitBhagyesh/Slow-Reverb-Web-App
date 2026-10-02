/**
 * Slowed + Reverb Studio - Web Audio DSP & Application Logic
 */

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
    
    // Control Elements
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
    
    // Visualizer & Player Controls
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
    
    // Export Controls
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

    // --- STATE VARIABLES ---
    let audioCtx = null;
    let audioBuffer = null;
    let sourceNode = null;
    let dryGainNode = null;
    let wetGainNode = null;
    let delayNode = null;
    let convolverNode = null;
    let toneFilter = null;
    let bassFilter = null;
    let analyserNode = null;

    let isPlaying = false;
    let startTime = 0;
    let pauseOffset = 0;
    let animationFrameId = null;
    let rawFileName = 'track';
    
    let convertedAudioBuffer = null;
    let convertedAudioUrl = null;
    let convertedSourceNode = null;
    let isPlayingConverted = false;

    // Preset definitions
    const PRESETS = {
        classic: { speed: 0.85, mix: 0.40, decay: 3.5, predelay: 30, tone: 16000, bass: 3.0 },
        nightdrive: { speed: 0.80, mix: 0.55, decay: 5.0, predelay: 45, tone: 12000, bass: 6.0 },
        astral: { speed: 0.75, mix: 0.70, decay: 7.0, predelay: 60, tone: 14000, bass: 2.0 },
        bedroom: { speed: 0.84, mix: 0.35, decay: 3.0, predelay: 20, tone: 4500, bass: 4.5 },
        lofi: { speed: 0.92, mix: 0.25, decay: 2.5, predelay: 15, tone: 9000, bass: 2.5 },
        chopped: { speed: 0.70, mix: 0.45, decay: 4.0, predelay: 35, tone: 11000, bass: 8.0 }
    };

    // --- THEME INITIALIZATION ---
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('theme-light');
        document.body.classList.toggle('theme-dark', !isLight);
        themeToggle.querySelector('.theme-toggle-icon').textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // --- FILE UPLOAD HANDLING ---
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
            alert('Please select a valid audio file.');
            return;
        }

        rawFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        outputNameInput.value = `${rawFileName} (Slowed + Reverb)`;
        fileNameDisplay.textContent = file.name;
        fileMetaDisplay.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        // Try extracting metadata cover art via jsmediatags
        if (window.jsmediatags) {
            window.jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const image = tag.tags.picture;
                    if (image) {
                        let base64String = '';
                        for (let i = 0; i < image.data.length; i++) {
                            base64String += String.fromCharCode(image.data[i]);
                        }
                        const base64 = "data:" + image.format + ";base64," + window.btoa(base64String);
                        fileCoverWrap.innerHTML = `<img src="${base64}" class="file-cover-img" alt="Cover Art">`;
                    } else {
                        fileCoverWrap.innerHTML = '<div class="file-icon-lead">🎵</div>';
                    }
                },
                onError: () => {
                    fileCoverWrap.innerHTML = '<div class="file-icon-lead">🎵</div>';
                }
            });
        }

        // Decode Audio Data
        const reader = new FileReader();
        reader.onload = async (e) => {
            initAudioContext();
            try {
                statusBadge.textContent = 'Decoding...';
                statusBadge.className = 'badge badge-secondary';
                audioBuffer = await audioCtx.decodeAudioData(e.target.result);
                
                fileOriginalDuration.textContent = `Original: ${formatTime(audioBuffer.duration)}`;
                uploadPrompt.classList.add('hidden');
                fileDetails.classList.remove('hidden');
                studioSection.classList.remove('hidden');
                statusBadge.textContent = 'Ready';
                statusBadge.className = 'badge badge-success';
                
                stopAudio();
                pauseOffset = 0;
                updateTimeDisplay();
                resizeCanvas();
            } catch (err) {
                console.error('Error decoding audio:', err);
                alert('Could not decode audio file. Please try another track.');
                statusBadge.textContent = 'Error';
                statusBadge.className = 'badge';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- AUDIO DSP INITIALIZATION ---
    function initAudioContext() {
        if (!audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioCtx();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function buildDSPChain() {
        if (!audioCtx || !audioBuffer) return;

        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = parseFloat(speedSlider.value);

        bassFilter = audioCtx.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 120;
        bassFilter.gain.value = parseFloat(bassSlider.value);

        toneFilter = audioCtx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = parseFloat(toneSlider.value);

        delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = parseFloat(reverbPreDelaySlider.value) / 1000;

        convolverNode = audioCtx.createConvolver();
        convolverNode.buffer = createReverbImpulseResponse(
            audioCtx,
            parseFloat(reverbDecaySlider.value),
            parseFloat(reverbPreDelaySlider.value) / 1000
        );

        dryGainNode = audioCtx.createGain();
        wetGainNode = audioCtx.createGain();
        
        const mix = parseFloat(reverbMixSlider.value);
        dryGainNode.gain.value = Math.cos(mix * 0.5 * Math.PI);
        wetGainNode.gain.value = Math.sin(mix * 0.5 * Math.PI);

        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;

        // Routing
        sourceNode.connect(bassFilter);
        bassFilter.connect(toneFilter);

        // Dry path
        toneFilter.connect(dryGainNode);
        dryGainNode.connect(analyserNode);

        // Wet path
        toneFilter.connect(delayNode);
        delayNode.connect(convolverNode);
        convolverNode.connect(wetGainNode);
        wetGainNode.connect(analyserNode);

        analyserNode.connect(audioCtx.destination);

        sourceNode.onended = () => {
            if (isPlaying && (getCurrentTime() >= getEffectiveDuration())) {
                stopAudio();
            }
        };
    }

    // Synthetic impulse response for stereo convolver reverb
    function createReverbImpulseResponse(ctx, duration, preDelaySec) {
        const sampleRate = ctx.sampleRate;
        const length = Math.floor(duration * sampleRate);
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const decay = Math.exp(-3 * t / duration);
            left[i] = (Math.random() * 2 - 1) * decay;
            right[i] = (Math.random() * 2 - 1) * decay;
        }
        return impulse;
    }

    // --- PLAYBACK CONTROLS ---
    btnPlayPause.addEventListener('click', () => {
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    });

    btnStop.addEventListener('click', stopAudio);

    function playAudio() {
        if (!audioBuffer) return;
        initAudioContext();

        if (isPlayingConverted && convertedSourceNode) {
            try { convertedSourceNode.stop(); } catch(e){}
            isPlayingConverted = false;
            updatePlayConvertedUI();
        }

        buildDSPChain();
        const currentSpeed = parseFloat(speedSlider.value);
        const originalOffset = pauseOffset;
        
        sourceNode.start(0, originalOffset);
        startTime = audioCtx.currentTime - (originalOffset / currentSpeed);
        isPlaying = true;

        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        drawVisualizer();
    }

    function pauseAudio() {
        if (!isPlaying || !sourceNode) return;
        pauseOffset = getCurrentTime() * parseFloat(speedSlider.value);
        try {
            sourceNode.stop();
        } catch (e) {}
        isPlaying = false;
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }

    function stopAudio() {
        if (sourceNode) {
            try { sourceNode.stop(); } catch (e) {}
        }
        isPlaying = false;
        pauseOffset = 0;
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        progressFill.style.width = '0%';
        updateTimeDisplay();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        clearCanvas();
    }

    function getCurrentTime() {
        if (!isPlaying) return pauseOffset / parseFloat(speedSlider.value);
        const currentSpeed = parseFloat(speedSlider.value);
        return (audioCtx.currentTime - startTime) * currentSpeed;
    }

    function getEffectiveDuration() {
        return audioBuffer ? audioBuffer.duration : 0;
    }

    progressBar.addEventListener('click', (e) => {
        if (!audioBuffer) return;
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const targetTime = pos * getEffectiveDuration();
        
        const wasPlaying = isPlaying;
        if (wasPlaying) pauseAudio();
        pauseOffset = targetTime;
        updateTimeDisplay();
        if (wasPlaying) playAudio();
    });

    function updateTimeDisplay() {
        const current = getCurrentTime();
        const total = getEffectiveDuration();
        const currentSpeed = parseFloat(speedSlider.value);
        const adjustedTotal = total / currentSpeed;
        const adjustedCurrent = current / currentSpeed;

        currentTimeDisplay.textContent = formatTime(adjustedCurrent);
        totalTimeDisplay.textContent = formatTime(adjustedTotal);
        
        if (total > 0) {
            const percent = Math.min((current / total) * 100, 100);
            progressFill.style.width = `${percent}%`;
        }
    }

    // --- DSP SLIDER CONTROLS ---
    speedSlider.addEventListener('input', () => {
        const speed = parseFloat(speedSlider.value);
        speedVal.textContent = `${Math.round(speed * 100)}%`;
        
        // Calculate pitch semitones: 12 * log2(speed)
        const semitones = (12 * Math.log2(speed)).toFixed(1);
        pitchSemitones.textContent = `(${semitones > 0 ? '+' : ''}${semitones} st)`;
        
        if (sourceNode && isPlaying) {
            const currTime = getCurrentTime();
            sourceNode.playbackRate.setValueAtTime(speed, audioCtx.currentTime);
            startTime = audioCtx.currentTime - (currTime / speed);
        }
        updateTimeDisplay();
    });

    btnSpeedDown.addEventListener('click', () => {
        let val = Math.max(0.50, parseFloat(speedSlider.value) - 0.01);
        speedSlider.value = val.toFixed(2);
        speedSlider.dispatchEvent(new Event('input'));
    });

    btnSpeedUp.addEventListener('click', () => {
        let val = Math.min(1.15, parseFloat(speedSlider.value) + 0.01);
        speedSlider.value = val.toFixed(2);
        speedSlider.dispatchEvent(new Event('input'));
    });

    btnSpeedReset.addEventListener('click', () => {
        speedSlider.value = 0.85;
        speedSlider.dispatchEvent(new Event('input'));
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
        reverbDecayVal.textContent = `${reverbDecaySlider.value}s`;
        if (convolverNode && audioCtx) {
            convolverNode.buffer = createReverbImpulseResponse(
                audioCtx,
                parseFloat(reverbDecaySlider.value),
                parseFloat(reverbPreDelaySlider.value) / 1000
            );
        }
    });

    reverbPreDelaySlider.addEventListener('input', () => {
        reverbPreDelayVal.textContent = `${reverbPreDelaySlider.value}ms`;
        if (delayNode) {
            delayNode.delayTime.value = parseFloat(reverbPreDelaySlider.value) / 1000;
        }
    });

    toneSlider.addEventListener('input', () => {
        const val = parseInt(toneSlider.value);
        let label = `${val}Hz`;
        if (val < 6000) label = `Muffled (${val}Hz)`;
        else if (val < 14000) label = `Warm (${val}Hz)`;
        else label = `Bright (${val}Hz)`;
        toneVal.textContent = label;
        if (toneFilter) {
            toneFilter.frequency.value = val;
        }
    });

    bassSlider.addEventListener('input', () => {
        const val = parseFloat(bassSlider.value);
        bassVal.textContent = `+${val.toFixed(1)} dB`;
        if (bassFilter) {
            bassFilter.gain.value = val;
        }
    });

    // --- PRESETS HANDLING ---
    presetsGrid.addEventListener('click', (e) => {
        const presetCard = e.target.closest('.preset-card');
        if (!presetCard) return;
        
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        presetCard.classList.add('active');
        
        const key = presetCard.dataset.preset;
        if (PRESETS[key]) {
            applyPreset(PRESETS[key]);
        }
    });

    function applyPreset(p) {
        speedSlider.value = p.speed;
        speedSlider.dispatchEvent(new Event('input'));

        reverbMixSlider.value = p.mix;
        reverbMixSlider.dispatchEvent(new Event('input'));

        reverbDecaySlider.value = p.decay;
        reverbDecaySlider.dispatchEvent(new Event('input'));

        reverbPreDelaySlider.value = p.predelay;
        reverbPreDelaySlider.dispatchEvent(new Event('input'));

        toneSlider.value = p.tone;
        toneSlider.dispatchEvent(new Event('input'));

        bassSlider.value = p.bass;
        bassSlider.dispatchEvent(new Event('input'));
    }

    // --- SUFFIX TAGS FOR RENAMING ---
    suffixBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const suffix = btn.dataset.suffix;
            outputNameInput.value = `${rawFileName}${suffix}`;
        });
    });

    // --- VISUALIZER DRAWING ---
    function resizeCanvas() {
        visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth;
        visualizerCanvas.height = visualizerCanvas.parentElement.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);

    function clearCanvas() {
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }

    function drawVisualizer() {
        if (!isPlaying || !analyserNode) return;
        animationFrameId = requestAnimationFrame(drawVisualizer);
        updateTimeDisplay();

        const width = visualizerCanvas.width;
        const height = visualizerCanvas.height;
        const mode = visModeSelect.value;

        canvasCtx.fillStyle = 'rgba(8, 14, 28, 0.3)';
        canvasCtx.fillRect(0, 0, width, height);

        if (mode === 'bars') {
            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteFrequencyData(dataArray);

            const barWidth = (width / bufferLength) * 2.2;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;
                const gradient = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
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

            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#38bdf8';
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
            const radius = Math.min(centerX, centerY) - 20;

            canvasCtx.beginPath();
            canvasCtx.strokeStyle = '#f472b6';
            canvasCtx.lineWidth = 2;
            for (let i = 0; i < bufferLength; i++) {
                const angle = (i / bufferLength) * Math.PI * 2;
                const offset = (dataArray[i] / 255) * 25;
                const r = radius + offset;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                if (i === 0) canvasCtx.moveTo(x, y);
                else canvasCtx.lineTo(x, y);
            }
            canvasCtx.closePath();
            canvasCtx.stroke();
        }
    }

    // --- OFFLINE AUDIO EXPORT (WAV) ---
    btnConvert.addEventListener('click', async () => {
        if (!audioBuffer) return;
        stopAudio();

        btnConvert.disabled = true;
        convertProgressBar.classList.remove('hidden');
        exportReadyCard.classList.add('hidden');
        convertProgressFill.style.width = '10%';
        convertStatusText.textContent = 'Setting up DSP rendering pipeline...';

        const speed = parseFloat(speedSlider.value);
        const decay = parseFloat(reverbDecaySlider.value);
        const predelay = parseFloat(reverbPreDelaySlider.value) / 1000;
        const toneFreq = parseFloat(toneSlider.value);
        const bassGain = parseFloat(bassSlider.value);
        const mix = parseFloat(reverbMixSlider.value);

        const outputDuration = (audioBuffer.duration / speed) + decay + predelay;
        const sampleRate = audioBuffer.sampleRate;
        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, Math.ceil(outputDuration * sampleRate), sampleRate);

        // Buffer source
        const offlineSource = offlineCtx.createBufferSource();
        offlineSource.buffer = audioBuffer;
        offlineSource.playbackRate.value = speed;

        // Bass filter
        const offlineBass = offlineCtx.createBiquadFilter();
        offlineBass.type = 'lowshelf';
        offlineBass.frequency.value = 120;
        offlineBass.gain.value = bassGain;

        // Tone filter
        const offlineTone = offlineCtx.createBiquadFilter();
        offlineTone.type = 'lowpass';
        offlineTone.frequency.value = toneFreq;

        // Reverb & Delay
        const offlineDelay = offlineCtx.createDelay();
        offlineDelay.delayTime.value = predelay;

        const offlineConvolver = offlineCtx.createConvolver();
        offlineConvolver.buffer = createReverbImpulseResponse(offlineCtx, decay, predelay);

        const offlineDry = offlineCtx.createGain();
        const offlineWet = offlineCtx.createGain();
        offlineDry.gain.value = Math.cos(mix * 0.5 * Math.PI);
        offlineWet.gain.value = Math.sin(mix * 0.5 * Math.PI);

        // Connect offline chain
        offlineSource.connect(offlineBass);
        offlineBass.connect(offlineTone);

        offlineTone.connect(offlineDry);
        offlineDry.connect(offlineCtx.destination);

        offlineTone.connect(offlineDelay);
        offlineDelay.connect(offlineConvolver);
        offlineConvolver.connect(offlineWet);
        offlineWet.connect(offlineCtx.destination);

        offlineSource.start(0);
        convertProgressFill.style.width = '40%';
        convertStatusText.textContent = 'Rendering audio DSP effects...';

        try {
            convertedAudioBuffer = await offlineCtx.startRendering();
            convertProgressFill.style.width = '85%';
            convertStatusText.textContent = 'Encoding to 16-bit PCM WAV...';

            const wavBlob = audioBufferToWav(convertedAudioBuffer);
            if (convertedAudioUrl) URL.revokeObjectURL(convertedAudioUrl);
            convertedAudioUrl = URL.createObjectURL(wavBlob);

            convertProgressFill.style.width = '100%';
            convertStatusText.textContent = 'Export complete!';
            
            setTimeout(() => {
                convertProgressBar.classList.add('hidden');
                exportReadyCard.classList.remove('hidden');
                btnConvert.disabled = false;
                exportMetaInfo.textContent = `16-bit PCM WAV • ${(wavBlob.size / (1024 * 1024)).toFixed(2)} MB • ${formatTime(convertedAudioBuffer.duration)}`;
            }, 400);
        } catch (err) {
            console.error('Rendering error:', err);
            alert('Failed to process audio offline.');
            btnConvert.disabled = false;
            convertProgressBar.classList.add('hidden');
        }
    });

    // --- DOWNLOAD WAV ---
    btnDownload.addEventListener('click', () => {
        if (!convertedAudioUrl) return;
        const a = document.createElement('a');
        a.href = convertedAudioUrl;
        let name = outputNameInput.value.trim() || 'slowed_reverb_track';
        if (!name.toLowerCase().endsWith('.wav')) name += '.wav';
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // --- PLAY CONVERTED RESULT ---
    btnPlayConverted.addEventListener('click', () => {
        if (!convertedAudioBuffer) return;
        initAudioContext();

        if (isPlayingConverted) {
            if (convertedSourceNode) {
                try { convertedSourceNode.stop(); } catch(e){}
            }
            isPlayingConverted = false;
            updatePlayConvertedUI();
        } else {
            stopAudio();
            convertedSourceNode = audioCtx.createBufferSource();
            convertedSourceNode.buffer = convertedAudioBuffer;
            convertedSourceNode.connect(audioCtx.destination);
            convertedSourceNode.start(0);
            isPlayingConverted = true;
            updatePlayConvertedUI();
            convertedSourceNode.onended = () => {
                isPlayingConverted = false;
                updatePlayConvertedUI();
            };
        }
    });

    function updatePlayConvertedUI() {
        if (isPlayingConverted) {
            playConvertedIcon.textContent = '⏸️';
            playConvertedText.textContent = 'Pause Converted Result';
        } else {
            playConvertedIcon.textContent = '▶️';
            playConvertedText.textContent = 'Play Converted Result';
        }
    }

    // --- HELPER UTILITIES ---
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Encode AudioBuffer to WAV 16-bit PCM Blob
    function audioBufferToWav(buffer) {
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

        const dataLength = result.length * 2;
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
        for (let index = 0; index < length; ) {
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
});
