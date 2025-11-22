// ============================================================
// Ethereal Ambient Music Generator
// ============================================================
// Creates procedural ambient music using Web Audio API
// Features: slow chord progressions, pads, reverb, dynamic evolution
// ============================================================

class EtherealMusic {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.oscillators = [];
        this.isPlaying = false;
        
        // Musical notes (frequencies in Hz) - Dorian mode for ethereal feel
        this.scale = [
            130.81, // C3
            146.83, // D3
            155.56, // Eb3
            174.61, // F3
            196.00, // G3
            220.00, // A3
            233.08, // Bb3
            261.63, // C4
            293.66, // D4
            311.13, // Eb4
            349.23, // F4
            392.00, // G4
        ];
        
        // Chord progressions (indices into scale array)
        this.chordProgressions = [
            [0, 2, 4, 7],   // i - Cm
            [3, 5, 7, 10],  // IV - Fm
            [5, 7, 9, 0],   // v - Gm
            [1, 3, 5, 8],   // ii - Dm
        ];
        
        this.currentChordIndex = 0;
        this.transitionTime = 8000; // 8 seconds per chord
        this.lastChordChange = 0;
    }
    
    /**
     * Initialize audio context and effects chain
     */
    init() {
        if (this.audioContext) return; // Already initialized
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Master gain (volume control)
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.3; // 30% volume
            this.masterGain.connect(this.audioContext.destination);
            
            // Create reverb effect
            this.reverbNode = this.createReverb();
            this.reverbNode.connect(this.masterGain);
            
            // Dry/wet mix for reverb
            this.dryGain = this.audioContext.createGain();
            this.dryGain.gain.value = 0.4;
            this.dryGain.connect(this.masterGain);
            
            this.wetGain = this.audioContext.createGain();
            this.wetGain.gain.value = 0.6;
            this.wetGain.connect(this.reverbNode);
            
            console.log('Ethereal music initialized');
        } catch (error) {
            console.error('Web Audio API not supported:', error);
        }
    }
    
    /**
     * Create reverb effect using convolution
     */
    createReverb() {
        const convolver = this.audioContext.createConvolver();
        
        // Create impulse response for reverb (simulates room acoustics)
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 3; // 3 second reverb
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // Exponential decay for natural reverb
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        convolver.buffer = impulse;
        return convolver;
    }
    
    /**
     * Create a single oscillator voice
     */
    createVoice(frequency, startTime, duration) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        // Sine wave for smooth, ethereal sound
        osc.type = 'sine';
        osc.frequency.value = frequency;
        
        // Low-pass filter for warmth
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        filter.Q.value = 1;
        
        // Envelope: slow attack, sustained, slow release
        const attackTime = 2.0;
        const releaseTime = 2.0;
        const now = this.audioContext.currentTime;
        
        gain.gain.setValueAtTime(0, now + startTime);
        gain.gain.linearRampToValueAtTime(0.08, now + startTime + attackTime);
        gain.gain.setValueAtTime(0.08, now + startTime + duration - releaseTime);
        gain.gain.linearRampToValueAtTime(0, now + startTime + duration);
        
        // Connect: oscillator -> filter -> gain -> reverb & dry
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.dryGain);
        gain.connect(this.wetGain);
        
        // Start and stop
        osc.start(now + startTime);
        osc.stop(now + startTime + duration);
        
        return { osc, gain };
    }
    
    /**
     * Play a chord (multiple notes at once)
     */
    playChord(chordIndices, startTime, duration) {
        const voices = [];
        
        // Play each note in the chord
        chordIndices.forEach((index, i) => {
            const frequency = this.scale[index];
            // Slight detuning for richness
            const detune = (Math.random() - 0.5) * 2;
            const voice = this.createVoice(frequency + detune, startTime, duration);
            voices.push(voice);
            
            // Add octave above for some notes (adds depth)
            if (i < 2) {
                const octaveVoice = this.createVoice(frequency * 2 + detune, startTime, duration);
                voices.push(octaveVoice);
            }
        });
        
        return voices;
    }
    
    /**
     * Start the music loop
     */
    start() {
        if (!this.audioContext) {
            this.init();
        }
        
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        // Resume audio context (required for autoplay policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.lastChordChange = Date.now();
        this.playNextChord();
        
        console.log('Ethereal music started');
    }
    
    /**
     * Play next chord in progression
     */
    playNextChord() {
        if (!this.isPlaying) return;
        
        const now = Date.now();
        const timeSinceLastChord = now - this.lastChordChange;
        
        // Time to change chord?
        if (timeSinceLastChord >= this.transitionTime) {
            this.currentChordIndex = (this.currentChordIndex + 1) % this.chordProgressions.length;
            this.lastChordChange = now;
        }
        
        // Get current chord
        const chord = this.chordProgressions[this.currentChordIndex];
        
        // Play chord with overlap for smooth transitions
        const duration = (this.transitionTime / 1000) + 2; // +2 sec overlap
        this.playChord(chord, 0, duration);
        
        // Schedule next chord
        setTimeout(() => this.playNextChord(), this.transitionTime - 1000);
    }
    
    /**
     * Stop the music
     */
    stop() {
        this.isPlaying = false;
        
        // Fade out master gain
        if (this.masterGain) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.linearRampToValueAtTime(0, now + 2);
            
            setTimeout(() => {
                if (this.audioContext) {
                    this.audioContext.close();
                    this.audioContext = null;
                }
            }, 2500);
        }
        
        console.log('Ethereal music stopped');
    }
    
    /**
     * Set volume (0 to 1)
     */
    setVolume(volume) {
        if (this.masterGain) {
            const now = this.audioContext.currentTime;
            this.masterGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.5);
        }
    }
}

// Create global instance
const music = new EtherealMusic();

// Setup music control button
window.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('musicToggle');
    
    if (toggleButton) {
        let musicStarted = false;
        
        // Function to start music and update button
        const startMusic = () => {
            if (!musicStarted) {
                musicStarted = true;
                music.start();
                toggleButton.textContent = '⏸';
                toggleButton.classList.add('playing');
            }
        };
        
        // Any click anywhere starts the music (once)
        document.addEventListener('click', startMusic, { once: true });
        
        // Button click toggles play/pause
        toggleButton.addEventListener('click', () => {
            if (music.isPlaying) {
                music.stop();
                toggleButton.textContent = '⏵';
                toggleButton.classList.remove('playing');
            } else {
                music.start();
                toggleButton.textContent = '⏸';
                toggleButton.classList.add('playing');
            }
        });
    }
});

// Export for external control
window.etherealMusic = music;
