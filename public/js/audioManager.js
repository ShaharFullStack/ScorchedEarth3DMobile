export class AudioManager {
    constructor() {
        this.sounds = {};
        this.musicVolume = 0.3;
        this.sfxVolume = 0.7;
        this.currentMusic = null;
        this.isInitialized = false;
        this.continuousSounds = {}; // Track playing continuous sounds
        
        // Load all sounds
        this.loadSounds();
    }
      async loadSounds() {
        const soundFiles = {
            openingScreen: './assets/sounds/OpeningTune.mp3',
            gameplayBg: './assets/sounds/OpeningTune.mp3', // Reuse opening tune for background music
            enterTank: './assets/sounds/EnterTank.wav',
            turrentRotate: './assets/sounds/TurrentRotate.mp3',
            tankMove: './assets/sounds/TankMove.mp3',
            shoot: './assets/sounds/shoot.mp3',
            tankHit: './assets/sounds/HitTank.mp3',
            explosion: './assets/sounds/KaBoom.mp3',
            groundHit: './assets/sounds/HitGround.mp3',
            hitBuilding: './assets/sounds/HitBuilding.mp3',
            hitTree: './assets/sounds/HitTree.mp3'
        };
        
        try {
            for (const [name, path] of Object.entries(soundFiles)) {
                await this.loadSound(name, path);
            }
            console.log('All sounds loaded successfully');
            this.isInitialized = true;
        } catch (error) {
            console.warn('Some sounds failed to load:', error);
            this.isInitialized = true; // Continue even if sounds fail to load
        }
    }
    
    loadSound(name, path) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(path);
            
            audio.addEventListener('canplaythrough', () => {
                this.sounds[name] = audio;
                console.log(`Sound loaded: ${name}`);
                resolve();
            });
            
            audio.addEventListener('error', (e) => {
                console.warn(`Failed to load sound: ${name} from ${path}`, e);
                // Create a silent audio object as fallback
                this.sounds[name] = {
                    play: () => {},
                    pause: () => {},
                    currentTime: 0,
                    volume: 0,
                    loop: false
                };
                resolve(); // Don't reject to allow game to continue
            });
            
            // Preload the audio
            audio.preload = 'auto';
            audio.load();
        });
    }
    
    // Initialize audio context (required for autoplay policies)
    async initializeAudioContext() {
        if (this.audioContext || this.isAudioContextInitialized) return;
        
        try {
            // Create audio context to comply with browser autoplay policies
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isAudioContextInitialized = true;
            console.log('Audio context initialized');
        } catch (error) {
            console.warn('Could not initialize audio context:', error);
        }
    }
    
    // Play background music (loops)
    playMusic(soundName, fadeIn = true) {
        if (!this.isInitialized || !this.sounds[soundName]) {
            console.warn(`Music not found: ${soundName}`);
            return;
        }
        
        // Stop current music
        this.stopMusic();
        
        const audio = this.sounds[soundName];
        audio.volume = fadeIn ? 0 : this.musicVolume;
        audio.loop = true;
        audio.currentTime = 0;
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.currentMusic = audio;
                    
                    // Fade in effect
                    if (fadeIn) {
                        this.fadeIn(audio, this.musicVolume, 2000);
                    }
                }).catch(error => {
                    console.warn('Music playback failed:', error);
                });
            }
        } catch (error) {
            console.warn('Could not play music:', error);
        }
    }
      // Stop background music
    stopMusic(fadeOut = true) {
        if (this.currentMusic) {
            if (fadeOut) {
                const musicToStop = this.currentMusic;
                this.currentMusic = null; // Clear reference immediately
                this.fadeOut(musicToStop, 1000, () => {
                    if (musicToStop) {
                        musicToStop.pause();
                        musicToStop.currentTime = 0;
                    }
                });
            } else {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
                this.currentMusic = null;
            }
        }
    }

    // Alias for stopMusic to maintain compatibility
    stopAllMusic(fadeOut = true) {
        this.stopMusic(fadeOut);
    }
    
    // Play sound effect (one-shot)
    playSFX(soundName, volume = null) {
        if (!this.isInitialized || !this.sounds[soundName]) {
            console.warn(`SFX not found: ${soundName}`);
            return;
        }
        
        const audio = this.sounds[soundName].cloneNode ? 
                     this.sounds[soundName].cloneNode() : 
                     this.sounds[soundName];
        
        audio.volume = volume !== null ? volume : this.sfxVolume;
        audio.loop = false;
        audio.currentTime = 0;
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn(`SFX playback failed for ${soundName}:`, error);
                });
            }
        } catch (error) {
            console.warn('Could not play SFX:', error);
        }
    }

    // Alias for playSFX to maintain compatibility
    playSound(soundName, volume = null) {
        this.playSFX(soundName, volume);    }

    // Play continuous sound (loops until stopped)
    playContinuousSound(soundName, volume = null) {
        if (!this.isInitialized || !this.sounds[soundName]) {
            console.warn(`Continuous sound not found: ${soundName}`);
            return;
        }

        // If already playing, don't restart
        if (this.isContinuousSoundPlaying(soundName)) {
            console.log(`DEBUG: Continuous sound ${soundName} already playing, skipping`);
            return;
        }

        console.log(`DEBUG: Playing continuous sound: ${soundName}`);

        const audio = this.sounds[soundName].cloneNode ? 
                     this.sounds[soundName].cloneNode() : 
                     this.sounds[soundName];
        
        audio.volume = volume !== null ? volume : this.sfxVolume;
        audio.loop = true;
        audio.currentTime = 0;
        
        // Add to continuousSounds before playing
        this.continuousSounds[soundName] = audio;
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Check if the sound is still in our continuousSounds (not stopped while loading)
                    if (this.continuousSounds[soundName] === audio) {
                        console.log(`DEBUG: Successfully started continuous sound: ${soundName}`);
                    }
                }).catch(error => {
                    console.warn(`Continuous sound playback failed for ${soundName}:`, error);
                    // Only remove if it's still our audio instance
                    if (this.continuousSounds[soundName] === audio) {
                        delete this.continuousSounds[soundName];
                    }
                });
            } else {
                console.log(`DEBUG: Successfully started continuous sound (no promise): ${soundName}`);
            }
        } catch (error) {
            console.warn(`Error playing continuous sound ${soundName}:`, error);
            // Only remove if it's still our audio instance
            if (this.continuousSounds[soundName] === audio) {
                delete this.continuousSounds[soundName];
            }
        }    }

    // Stop specific continuous sound
    stopContinuousSound(soundName) {
        console.log(`DEBUG: Attempting to stop continuous sound: ${soundName}`);
        if (this.continuousSounds[soundName]) {
            console.log(`DEBUG: Found sound ${soundName}, stopping it`);
            const audio = this.continuousSounds[soundName];
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                console.warn(`Error stopping continuous sound ${soundName}:`, error);
            }
            delete this.continuousSounds[soundName];
            console.log(`DEBUG: Successfully stopped ${soundName}`);
        } else {
            console.log(`DEBUG: Sound ${soundName} not found in continuousSounds:`, Object.keys(this.continuousSounds));
        }
    }

    // Stop all continuous sounds
    stopAllContinuousSounds() {
        for (const soundName in this.continuousSounds) {
            this.stopContinuousSound(soundName);
        }
    }

    // Check if a continuous sound is playing
    isContinuousSoundPlaying(soundName) {
        return !!this.continuousSounds[soundName];
    }
      // Fade in audio
    fadeIn(audio, targetVolume, duration) {
        if (!audio) return;
        
        const steps = 50;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;
        
        const fadeInterval = setInterval(() => {
            currentStep++;
            if (audio) {
                audio.volume = Math.min(volumeStep * currentStep, targetVolume);
            }
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
            }
        }, stepTime);
    }
      // Fade out audio
    fadeOut(audio, duration, callback) {
        if (!audio) {
            if (callback) callback();
            return;
        }
        
        const steps = 50;
        const stepTime = duration / steps;
        const startVolume = audio.volume;
        const volumeStep = startVolume / steps;
        let currentStep = 0;
        
        const fadeInterval = setInterval(() => {
            currentStep++;
            if (audio) {
                audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
            }
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                if (callback) callback();
            }
        }, stepTime);
    }
    
    // Set volume levels
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume;
        }
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }
    
    // Mute/unmute
    muteMusic() {
        if (this.currentMusic) {
            this.currentMusic.volume = 0;
        }
    }
    
    unmuteMusic() {
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume;
        }
    }
    
    // Check if music is currently playing
    isMusicPlaying() {
        return this.currentMusic && !this.currentMusic.paused;
    }
}
