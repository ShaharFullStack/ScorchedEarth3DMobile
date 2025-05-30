export class UI {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.turnIndicator = document.getElementById('turn-indicator');
        this.fuelIndicator = document.getElementById('fuel-indicator');
        this.healthIndicator = document.getElementById('health-indicator');
        this.actionIndicator = document.getElementById('action-indicator');        this.powerIndicator = document.getElementById('power-indicator');
        this.endTurnButton = document.getElementById('end-turn-button');
        this.stopMusicButton = document.getElementById('stop-music-button');
        this.messageOverlay = document.getElementById('message-overlay');
        
        this.playerName = '';
        
        this.setupLoginScreen();
        this.setupDifficultySelector();
    }
    
    setupLoginScreen() {
        // Create login overlay
        this.loginOverlay = document.createElement('div');
        this.loginOverlay.id = 'login-overlay';
        this.loginOverlay.innerHTML = `
            <div class="login-content">
                <h1>Scorched Earth</h1>
                <h1>Return</h1>
                <img class="startupImage" src="assets/images/tankTrans.png" alt="Scorched Earth Logo" class="logo">
                <p class="subtitle">Identify yourself, soldier!</p>
                <div class="login-form">
                    <label for="player-name">What's your name?</label>
                    <input type="text" id="player-name" placeholder="Enter your callsign..." maxlength="20" autocomplete="off">
                </div>
                <button class="login-btn" id="login-submit">ENTER BATTLEFIELD</button>
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
        
        this.playerNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.playerNameInput.value.trim().length >= 2) {
                    this.onLoginSubmit();
                }
            }
        });
          this.loginSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Login button clicked');
            
            // Play button click sound
            if (this.audioManager) {
                this.audioManager.playSound('enterTank', 0.4);
            }
            
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
        });
        
        // Set initial button state
        this.loginSubmitBtn.disabled = true;
        this.loginSubmitBtn.style.opacity = '0.6';
        this.loginSubmitBtn.style.cursor = 'not-allowed';
        this.loginSubmitBtn.style.backgroundColor = '#666';
        
        // Auto-focus the input after a short delay
        setTimeout(() => {
            if (this.playerNameInput) {
                this.playerNameInput.focus();
            }
        }, 500);
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
            this.playerNameInput.focus();
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
        setTimeout(() => {
            this.playerNameInput.focus();
        }, 100);
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
                        <p>• Perfect for learning!</p>
                    </button>
                    <button class="difficulty-btn" data-difficulty="professional">
                        <h3>🟡 Professional</h3>
                        <p>• Balanced challenge</p>
                        <p>• Smart enemy tactics</p>
                        <p>• Strategic positioning</p>
                        <p>• Standard experience</p>
                    </button>
                    <button class="difficulty-btn" data-difficulty="veteran">
                        <h3>🔴 Veteran</h3>
                        <p>• Lightning-fast AI</p>
                        <p>• Deadly accurate shots</p>
                        <p>• Advanced battle tactics</p>
                        <p>• Maximum challenge!</p>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.difficultyOverlay);
        
        // Initially hide it
        this.difficultyOverlay.style.display = 'none';
          // Add event listeners
        this.difficultyOverlay.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = e.currentTarget.dataset.difficulty;
                
                // Play button click sound
                if (this.audioManager) {
                    this.audioManager.playSound('enterTank', 0.5);
                }
                
                this.onDifficultySelected(difficulty);
            });
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
    
    updateTurnIndicator(text) {
        this.turnIndicator.textContent = `Turn: ${text}`;
    }    updateFuel(current, max) {
        // Use shorter format for mobile - just show current value
        this.fuelIndicator.textContent = `Fuel: ${Math.floor(current)}`;
    }    updateHealth(tankId, current, max) {
        // Simplified format for mobile - just show HP value
        this.healthIndicator.textContent = `HP: ${current}`;
    }
    
    updateActionIndicator(text) {
        this.actionIndicator.textContent = `Actions: ${text}`;
    }
      updatePowerIndicator(current, min, max) {
        // Simplified format for mobile - just show current power
        this.powerIndicator.textContent = `Power: ${current}%`;
    }
      updateBarrelElevation(elevationRadians) {
        // Convert radians to degrees for display
        const elevationDegrees = Math.round(elevationRadians * 180 / Math.PI);
        
        // Find or create barrel elevation indicator
        let barrelIndicator = document.getElementById('barrel-indicator');
        if (!barrelIndicator) {
            barrelIndicator = document.createElement('p');
            barrelIndicator.id = 'barrel-indicator';
            barrelIndicator.style.margin = '5px 0';
            barrelIndicator.className = 'mobile-hidden'; // Hide on mobile for space
            // Insert after power indicator
            this.powerIndicator.parentNode.insertBefore(barrelIndicator, this.powerIndicator.nextSibling);
        }
        
        // Compact format for mobile - just show angle
        barrelIndicator.textContent = `Barrel: ${elevationDegrees}°`;
    }
    
    toggleEndTurnButton(enabled) {
        this.endTurnButton.disabled = !enabled;
    }
    
    toggleStopMusicButton(enabled) {
        this.stopMusicButton.disabled = !enabled;
        if (enabled) {
            this.stopMusicButton.textContent = '🔇 Stop Music';
        } else {
            this.stopMusicButton.textContent = '🔇 No Music';
        }
    }
    
    showGameOverMessage(message) {
        this.messageOverlay.textContent = message;
        this.messageOverlay.style.display = 'block';
    }
    
    hideGameOverMessage() {
        this.messageOverlay.style.display = 'none';
    }
}