export class UI {
    constructor() {
        // Desktop UI elements
        this.turnIndicator = document.getElementById('turn-indicator');
        this.fuelIndicator = document.getElementById('fuel-indicator');
        this.healthIndicator = document.getElementById('health-indicator');
        this.actionIndicator = document.getElementById('action-indicator');
        this.powerIndicator = document.getElementById('power-indicator');
        this.endTurnButton = document.getElementById('end-turn-button');
        this.messageOverlay = document.getElementById('message-overlay');
        
        // Mobile UI elements
        this.mobileFuel = document.getElementById('mobile-fuel');
        this.mobileHealth = document.getElementById('mobile-health');
        this.mobileTurn = document.getElementById('mobile-turn');
        this.mobilePowerDisplay = document.getElementById('mobile-power-display');
        this.mobileEnemies = document.getElementById('mobile-enemies');
        this.mobileEndTurn = document.getElementById('mobile-end-turn');
        
        this.playerName = '';
        this.isMobile = this.detectMobile();
        
        this.setupLoginScreen();
        this.setupDifficultySelector();
        
        console.log(`UI initialized for ${this.isMobile ? 'mobile' : 'desktop'} device`);
    }
    
    detectMobile() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const noHover = window.matchMedia('(hover: none)').matches;
        
        const mobileScore = [
            isTouchDevice,
            isSmallScreen,
            isMobileUserAgent,
            hasCoarsePointer,
            noHover
        ].filter(Boolean).length;
        
        return mobileScore >= 2;
    }
    
    setupLoginScreen() {
        // Create login overlay
        this.loginOverlay = document.createElement('div');
        this.loginOverlay.id = 'login-overlay';
        this.loginOverlay.innerHTML = `
            <div class="login-content">
                <h1>Tank Commander</h1>
                <p class="subtitle">${this.isMobile ? 'Ready for mobile combat?' : 'Identify yourself, soldier!'}</p>
                <div class="login-form">
                    <label for="player-name">${this.isMobile ? 'Commander name:' : 'What\'s your name?'}</label>
                    <input type="text" id="player-name" placeholder="${this.isMobile ? 'Your callsign...' : 'Enter your callsign...'}" maxlength="20" autocomplete="off">
                </div>
                <button class="login-btn" id="login-submit">ENTER BATTLEFIELD</button>
                ${this.isMobile ? '<p style="font-size: 12px; color: #888; margin-top: 15px;">📱 Optimized for mobile play</p>' : ''}
            </div>
        `;
        
        document.body.appendChild(this.loginOverlay);
        
        // Get elements
        this.playerNameInput = document.getElementById('player-name');
        this.loginSubmitBtn = document.getElementById('login-submit');
        
        // Add event listeners
        this.playerNameInput.addEventListener('input', (e) => {
            const name = e.target.value.trim();
            const isValid = name.length >= 2;
            
            this.loginSubmitBtn.disabled = !isValid;
            
            // Visual feedback
            if (isValid) {
                this.loginSubmitBtn.style.opacity = '1';
                this.loginSubmitBtn.style.cursor = 'pointer';
                this.loginSubmitBtn.style.backgroundColor = '';
            } else {
                this.loginSubmitBtn.style.opacity = '0.6';
                this.loginSubmitBtn.style.cursor = 'not-allowed';
                this.loginSubmitBtn.style.backgroundColor = '#666';
            }
        });
        
        // Handle both keyboard and touch events
        this.playerNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.playerNameInput.value.trim().length >= 2) {
                    this.onLoginSubmit();
                }
            }
        });
        
        // Touch-friendly event handling
        const submitHandler = (e) => {
            e.preventDefault();
            console.log('Login button activated');
            if (this.playerNameInput.value.trim().length >= 2) {
                this.onLoginSubmit();
            } else {
                // Show error feedback
                this.playerNameInput.style.borderColor = '#ff4444';
                this.playerNameInput.focus();
                setTimeout(() => {
                    this.playerNameInput.style.borderColor = '#4a5d23';
                }, 1000);
            }
        };
        
        if (this.isMobile) {
            this.loginSubmitBtn.addEventListener('touchstart', submitHandler, { passive: false });
        } else {
            this.loginSubmitBtn.addEventListener('click', submitHandler);
        }
        
        // Set initial button state
        this.loginSubmitBtn.disabled = true;
        this.loginSubmitBtn.style.opacity = '0.6';
        this.loginSubmitBtn.style.cursor = 'not-allowed';
        this.loginSubmitBtn.style.backgroundColor = '#666';
        
        // Auto-focus the input after a short delay (not on mobile to prevent keyboard popup)
        if (!this.isMobile) {
            setTimeout(() => {
                if (this.playerNameInput) {
                    this.playerNameInput.focus();
                }
            }, 500);
        }
    }
    
    onLoginSubmit() {
        const name = this.playerNameInput.value.trim();
        console.log('Attempting login with name:', name);
        
        if (name.length >= 2) {
            this.playerName = name;
            console.log('Player name set to:', this.playerName);
            
            // Add exit animation
            this.loginOverlay.style.transform = 'scale(0.95)';
            this.loginOverlay.style.opacity = '0';
            this.loginOverlay.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                this.loginOverlay.style.display = 'none';
                console.log('Showing difficulty selector');
                this.showDifficultySelector();
            }, 500);
        } else {
            console.log('Name too short:', name);
            // Show error
            this.playerNameInput.style.borderColor = '#ff4444';
            if (!this.isMobile) {
                this.playerNameInput.focus();
            }
            setTimeout(() => {
                this.playerNameInput.style.borderColor = '#4a5d23';
            }, 1000);
        }
    }
    
    getPlayerName() {
        return this.playerName;
    }
    
    showLoginScreen() {
        this.loginOverlay.style.display = 'flex';
        this.loginOverlay.style.transform = 'scale(1)';
        this.loginOverlay.style.opacity = '1';
        
        if (!this.isMobile) {
            setTimeout(() => {
                this.playerNameInput.focus();
            }, 100);
        }
    }
    
    setupDifficultySelector() {
        // Create difficulty selection overlay
        this.difficultyOverlay = document.createElement('div');
        this.difficultyOverlay.id = 'difficulty-overlay';
        this.difficultyOverlay.innerHTML = `
            <div class="difficulty-content">
                <h2>Select Difficulty Level</h2>
                <div class="difficulty-options">
                    <button class="difficulty-btn" data-difficulty="beginner">
                        <h3>🟢 New Player</h3>
                        <p>• Slower enemy reactions</p>
                        <p>• Less accurate shooting</p>
                        <p>• More forgiving mechanics</p>
                        <p>• ${this.isMobile ? 'Perfect for mobile!' : 'Perfect for learning!'}</p>
                    </button>
                    <button class="difficulty-btn" data-difficulty="professional">
                        <h3>🟡 Professional</h3>
                        <p>• Balanced challenge</p>
                        <p>• Smart enemy tactics</p>
                        <p>• Strategic positioning</p>
                        <p>• ${this.isMobile ? 'Great mobile experience' : 'Standard experience'}</p>
                    </button>
                    <button class="difficulty-btn" data-difficulty="veteran">
                        <h3>🔴 Veteran</h3>
                        <p>• Lightning-fast AI</p>
                        <p>• Deadly accurate shots</p>
                        <p>• Advanced battle tactics</p>
                        <p>• ${this.isMobile ? 'Mobile master level!' : 'Maximum challenge!'}</p>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.difficultyOverlay);
        
        // Initially hide it
        this.difficultyOverlay.style.display = 'none';
        
        // Add event listeners for both touch and click
        this.difficultyOverlay.querySelectorAll('.difficulty-btn').forEach(btn => {
            const difficultyHandler = (e) => {
                e.preventDefault();
                const difficulty = e.currentTarget.dataset.difficulty;
                this.onDifficultySelected(difficulty);
            };
            
            if (this.isMobile) {
                btn.addEventListener('touchstart', difficultyHandler, { passive: false });
            } else {
                btn.addEventListener('click', difficultyHandler);
            }
        });
    }
    
    onDifficultySelected(difficulty) {
        this.selectedDifficulty = difficulty;
        
        // Add exit animation
        this.difficultyOverlay.style.transform = 'scale(0.95)';
        this.difficultyOverlay.style.opacity = '0';
        this.difficultyOverlay.style.transition = 'all 0.5s ease';
        
        setTimeout(() => {
            this.difficultyOverlay.style.display = 'none';
            
            // Trigger game start with selected difficulty
            if (this.onDifficultyChange) {
                this.onDifficultyChange(difficulty);
            }
        }, 500);
    }
    
    showDifficultySelector() {
        this.difficultyOverlay.style.display = 'flex';
        this.difficultyOverlay.style.transform = 'scale(1)';
        this.difficultyOverlay.style.opacity = '1';
        this.difficultyOverlay.style.transition = 'all 0.5s ease';
    }
    
    // Universal update methods (work for both mobile and desktop)
    updateTurnIndicator(text) {
        if (this.turnIndicator) {
            this.turnIndicator.textContent = `Turn: ${text}`;
        }
        
        if (this.mobileTurn) {
            // Shorter text for mobile
            const mobileText = text.replace(/New Player|Professional|Veteran/, '').replace(' - ', '').trim();
            this.mobileTurn.textContent = mobileText;
        }
    }

    updateFuel(current, max) {
        const fuelText = `Fuel: ${Math.floor(current)}/${max}`;
        
        if (this.fuelIndicator) {
            this.fuelIndicator.textContent = fuelText;
        }
        
        if (this.mobileFuel) {
            this.mobileFuel.textContent = fuelText;
        }
    }

    updateHealth(tankId, current, max) {
        let tankName = "Unknown Tank";
        if (tankId === 'player') {
            tankName = this.playerName ? this.playerName : "Player";
        } else if (tankId.startsWith('enemy_')) {
            tankName = `Enemy ${parseInt(tankId.split('_')[1]) + 1}`;
        }
        
        const healthText = `${tankName} HP: ${current}/${max}`;
        
        if (this.healthIndicator) {
            this.healthIndicator.textContent = healthText;
        }
        
        if (this.mobileHealth && tankId === 'player') {
            // Mobile shows shorter player health
            this.mobileHealth.textContent = `HP: ${current}/${max}`;
        }
    }
    
    updateActionIndicator(text) {
        if (this.actionIndicator) {
            this.actionIndicator.textContent = `Actions: ${text}`;
        }
        
        // Mobile has its own action indicator handling
        if (this.isMobile) {
            this.updateMobileActionIndicator(text);
        }
    }
    
    updatePowerIndicator(current, min, max) {
        const powerText = `Power: ${current}% (${min}-${max}%)`;
        
        if (this.powerIndicator) {
            this.powerIndicator.textContent = powerText;
        }
        
        if (this.mobilePowerDisplay) {
            this.mobilePowerDisplay.textContent = `Power: ${current}%`;
        }
    }
    
    updateBarrelElevation(elevationRadians) {
        // Desktop only feature
        if (this.isMobile) return;
        
        // Convert radians to degrees for display
        const elevationDegrees = Math.round(elevationRadians * 180 / Math.PI);
        
        // Find or create barrel elevation indicator
        let barrelIndicator = document.getElementById('barrel-indicator');
        if (!barrelIndicator) {
            barrelIndicator = document.createElement('p');
            barrelIndicator.id = 'barrel-indicator';
            barrelIndicator.style.margin = '5px 0';
            // Insert after power indicator
            if (this.powerIndicator && this.powerIndicator.parentNode) {
                this.powerIndicator.parentNode.insertBefore(barrelIndicator, this.powerIndicator.nextSibling);
            }
        }
        
        barrelIndicator.textContent = `Barrel: ${elevationDegrees}° (-15° to 60°)`;
    }
    
    toggleEndTurnButton(enabled) {
        if (this.endTurnButton) {
            this.endTurnButton.disabled = !enabled;
        }
        
        if (this.mobileEndTurn) {
            this.mobileEndTurn.disabled = !enabled;
            this.mobileEndTurn.style.display = enabled ? 'block' : 'none';
        }
    }
    
    showGameOverMessage(message) {
        this.messageOverlay.textContent = message;
        this.messageOverlay.style.display = 'block';
        
        // Mobile-specific game over styling
        if (this.isMobile) {
            this.messageOverlay.style.fontSize = '18px';
            this.messageOverlay.style.padding = '20px 25px';
            this.messageOverlay.style.maxWidth = '85%';
        }
    }
    
    hideGameOverMessage() {
        this.messageOverlay.style.display = 'none';
    }
    
    // Mobile-specific methods
    updateMobileActionIndicator(text) {
        // Update mobile action indicator if it exists
        // This could be implemented as a toast or status update
        console.log('Mobile action:', text);
    }
    
    updateMobilePower(power) {
        if (this.mobilePowerDisplay) {
            this.mobilePowerDisplay.textContent = `Power: ${power}%`;
        }
    }
    
    updateMobileEnemyCount(count) {
        if (this.mobileEnemies) {
            this.mobileEnemies.textContent = `Enemies: ${count}`;
        }
    }
    
    updateMobileLayout() {
        // Handle mobile layout updates on orientation change
        console.log('Updating mobile layout for orientation change');
        
        // Force redraw of mobile elements
        if (this.isMobile) {
            const mobileContainer = document.getElementById('mobile-container');
            if (mobileContainer) {
                mobileContainer.style.display = 'none';
                setTimeout(() => {
                    mobileContainer.style.display = 'block';
                }, 10);
            }
        }
    }
    
    // Show mobile control hints
    showMobileHint(message, duration = 3000) {
        if (!this.isMobile) return;
        
        // Create or update hint element
        let hint = document.getElementById('mobile-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'mobile-hint';
            hint.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: #00ff41;
                padding: 15px 20px;
                border-radius: 10px;
                font-size: 14px;
                z-index: 1500;
                text-align: center;
                border: 2px solid #4a5d23;
                max-width: 80%;
            `;
            document.body.appendChild(hint);
        }
        
        hint.textContent = message;
        hint.style.display = 'block';
        
        setTimeout(() => {
            if (hint) {
                hint.style.display = 'none';
            }
        }, duration);
    }
    
    // Mobile tutorial/help system
    showMobileTutorial() {
        if (!this.isMobile) return;
        
        const tutorialSteps = [
            "🕹️ Use the left joystick to move your tank",
            "🎯 Touch the screen to aim your turret",
            "⚡ Adjust power with the slider",
            "🔥 Tap the fire button to shoot",
            "📷 Use two fingers to zoom camera",
            "Ready for battle!"
        ];
        
        let currentStep = 0;
        
        const showStep = () => {
            if (currentStep < tutorialSteps.length) {
                this.showMobileHint(tutorialSteps[currentStep], 2500);
                currentStep++;
                setTimeout(showStep, 2800);
            }
        };
        
        setTimeout(showStep, 1000);
    }
    
    // Haptic feedback helper
    vibrate(pattern) {
        if (this.isMobile && 'vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // Mobile performance indicator
    showPerformanceWarning() {
        if (!this.isMobile) return;
        
        this.showMobileHint("⚠️ Performance optimized for smoother play", 4000);
    }
    
    // Mobile connectivity indicator
    updateConnectionStatus(isOnline) {
        if (!this.isMobile) return;
        
        if (!isOnline) {
            this.showMobileHint("📶 Connection lost - playing offline", 3000);
        }
    }
    
    // Debug information for mobile
    getMobileDebugInfo() {
        return {
            isMobile: this.isMobile,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            orientation: window.screen.orientation ? window.screen.orientation.angle : 'unknown',
            pixelRatio: window.devicePixelRatio,
            userAgent: navigator.userAgent,
            touchSupport: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints,
            elements: {
                mobileFuel: !!this.mobileFuel,
                mobileHealth: !!this.mobileHealth,
                mobileTurn: !!this.mobileTurn,
                mobilePowerDisplay: !!this.mobilePowerDisplay,
                mobileEnemies: !!this.mobileEnemies,
                mobileEndTurn: !!this.mobileEndTurn
            }
        };
    }
    
    // Show mobile-specific error messages
    showMobileError(error) {
        const errorMessage = typeof error === 'string' ? error : error.message || 'An error occurred';
        this.showMobileHint(`❌ ${errorMessage}`, 5000);
        console.error('Mobile game error:', error);
    }
    
    // Mobile settings/preferences
    saveMobilePreferences() {
        if (!this.isMobile) return;
        
        const preferences = {
            playerName: this.playerName,
            lastDifficulty: this.selectedDifficulty,
            tutorialShown: true,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('tankGameMobilePrefs', JSON.stringify(preferences));
        } catch (e) {
            console.warn('Could not save mobile preferences:', e);
        }
    }
    
    loadMobilePreferences() {
        if (!this.isMobile) return null;
        
        try {
            const prefs = localStorage.getItem('tankGameMobilePrefs');
            return prefs ? JSON.parse(prefs) : null;
        } catch (e) {
            console.warn('Could not load mobile preferences:', e);
            return null;
        }
    }
}