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
        
        this.setupDifficultySelector();
    }
    
    setPlayerName(name) {
        this.playerName = name;
    }
      getPlayerName() {
        return this.playerName;
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