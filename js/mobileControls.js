/**
 * Mobile Touch Controls Handler
 * Provides virtual joystick and touch button controls for mobile devices
 */

export class MobileControls {    constructor(game) {
        this.game = game;
        this.isEnabled = this.isMobileDevice();
        
        console.log('Mobile device detection:', this.isEnabled);
        console.log('User agent:', navigator.userAgent);
        console.log('Window width:', window.innerWidth);
        console.log('Touch support:', 'ontouchstart' in window);
        
        // Joystick state
        this.joystickState = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0,
            distance: 0,
            angle: 0
        };
        
        // Button states
        this.buttonStates = {
            turretLeft: false,
            turretRight: false,
            barrelUp: false,
            barrelDown: false,
            powerUp: false,
            powerDown: false,
            fire: false
        };
        
        // Touch tracking
        this.activeTouches = new Map();
        
        if (this.isEnabled) {
            this.setupMobileControls();
        } else {
            console.log('Mobile controls not enabled - not a mobile device');
        }
    }
      isMobileDevice() {
        const isMobile = (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            window.innerWidth <= 768
        );
        
        // For testing purposes, also enable if localStorage has a flag
        const forceEnable = localStorage.getItem('forceMobileControls') === 'true';
        
        return isMobile || forceEnable;
    }
      setupMobileControls() {
        // Show mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'flex';
            mobileControls.style.visibility = 'visible';
            console.log('Mobile controls enabled and displayed');
        } else {
            console.error('Mobile controls element not found');
        }
        
        this.setupJoystick();
        this.setupActionButtons();
        this.setupTouchCamera();
    }
      setupJoystick() {
        const joystickOuter = document.getElementById('joystick-outer');
        const joystickInner = document.getElementById('joystick-inner');
        
        if (!joystickOuter || !joystickInner) {
            console.error('Joystick elements not found');
            return;
        }
        
        console.log('Setting up joystick controls');
        
        // Prevent context menu on long press
        joystickOuter.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Touch start
        joystickOuter.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const touch = e.touches[0];
            const rect = joystickOuter.getBoundingClientRect();
            
            this.joystickState.active = true;
            this.joystickState.startX = rect.left + rect.width / 2;
            this.joystickState.startY = rect.top + rect.height / 2;
            this.joystickState.currentX = touch.clientX;
            this.joystickState.currentY = touch.clientY;
            
            this.activeTouches.set(touch.identifier, 'joystick');
            this.updateJoystickPosition(touch.clientX, touch.clientY);
            
            // Visual feedback
            joystickOuter.classList.add('active');
            
            console.log('Joystick touch started');
        });
        
        // Touch move - attach to document to track outside joystick area
        document.addEventListener('touchmove', (e) => {
            for (const touch of e.touches) {
                if (this.activeTouches.get(touch.identifier) === 'joystick') {
                    e.preventDefault();
                    this.updateJoystickPosition(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });
        
        // Touch end
        document.addEventListener('touchend', (e) => {
            for (const touch of e.changedTouches) {
                if (this.activeTouches.get(touch.identifier) === 'joystick') {
                    this.resetJoystick();
                    this.activeTouches.delete(touch.identifier);
                    
                    // Remove visual feedback
                    joystickOuter.classList.remove('active');
                    
                    console.log('Joystick touch ended');
                    break;
                }
            }
        });
        
        // Touch cancel
        document.addEventListener('touchcancel', (e) => {
            for (const touch of e.changedTouches) {
                if (this.activeTouches.get(touch.identifier) === 'joystick') {
                    this.resetJoystick();
                    this.activeTouches.delete(touch.identifier);
                    joystickOuter.classList.remove('active');
                    break;
                }
            }
        });
        
        // Mouse events for desktop testing
        joystickOuter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const rect = joystickOuter.getBoundingClientRect();
            
            this.joystickState.active = true;
            this.joystickState.startX = rect.left + rect.width / 2;
            this.joystickState.startY = rect.top + rect.height / 2;
            
            joystickOuter.classList.add('active');
            this.updateJoystickPosition(e.clientX, e.clientY);
            
            const handleMouseMove = (e) => {
                this.updateJoystickPosition(e.clientX, e.clientY);
            };
            
            const handleMouseUp = () => {
                this.resetJoystick();
                joystickOuter.classList.remove('active');
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }
      updateJoystickPosition(clientX, clientY) {
        const deltaX = clientX - this.joystickState.startX;
        const deltaY = clientY - this.joystickState.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = 40; // Increased for better control range
        
        // Clamp to circle
        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            this.joystickState.deltaX = Math.cos(angle) * maxDistance;
            this.joystickState.deltaY = Math.sin(angle) * maxDistance;
        } else {
            this.joystickState.deltaX = deltaX;
            this.joystickState.deltaY = deltaY;
        }
        
        this.joystickState.distance = Math.min(distance, maxDistance);
        this.joystickState.angle = Math.atan2(-this.joystickState.deltaY, this.joystickState.deltaX);
        
        // Update visual position - fix the translation calculation
        const joystickInner = document.getElementById('joystick-inner');
        if (joystickInner) {
            // Use proper centering with transform origin
            joystickInner.style.transform = `translate(-50%, -50%) translate(${this.joystickState.deltaX}px, ${this.joystickState.deltaY}px)`;
        }
        
        // Update game input states
        this.updateMovementFromJoystick();
    }
    
    resetJoystick() {
        this.joystickState.active = false;
        this.joystickState.deltaX = 0;
        this.joystickState.deltaY = 0;
        this.joystickState.distance = 0;
        
        // Reset visual position
        const joystickInner = document.getElementById('joystick-inner');
        if (joystickInner) {
            joystickInner.style.transform = 'translate(-50%, -50%)';
        }
        
        // Clear movement input states
        this.game.inputStates.moveForward = false;
        this.game.inputStates.moveBackward = false;
        this.game.inputStates.rotateLeft = false;
        this.game.inputStates.rotateRight = false;
    }    updateMovementFromJoystick() {
        // Clear movement states first
        this.game.inputStates.moveForward = false;
        this.game.inputStates.moveBackward = false;
        this.game.inputStates.rotateLeft = false;
        this.game.inputStates.rotateRight = false;
        
        // Check if joystick is active and moved beyond deadzone
        const deadzone = 5; // Smaller deadzone for better responsiveness
        if (!this.joystickState.active || this.joystickState.distance < deadzone) {
            return;
        }
        
        const normalizedDistance = this.joystickState.distance / 40; // Use new max distance
        
        // Use deltaX and deltaY directly instead of angle calculations
        const normalizedX = this.joystickState.deltaX / 40; // Left/right movement
        const normalizedY = this.joystickState.deltaY / 40; // Up/down movement
        
        // Lower threshold for more responsive control
        const threshold = 0.15;
          // Forward/backward movement - UP is negative Y (forward), DOWN is positive Y (backward)
        this.game.inputStates.moveForward = normalizedY < -threshold;
        this.game.inputStates.moveBackward = normalizedY > threshold;
        
        // Rotation (left/right) - LEFT is negative X (rotate left), RIGHT is positive X (rotate right)
        this.game.inputStates.rotateLeft = normalizedX < -threshold;
        this.game.inputStates.rotateRight = normalizedX > threshold;
    }
    
    setupActionButtons() {
        // Turret controls
        this.setupButton('turret-left-btn', 'turretLeft');
        this.setupButton('turret-right-btn', 'turretRight');
        
        // Barrel controls
        this.setupButton('barrel-up-btn', 'barrelUp');
        this.setupButton('barrel-down-btn', 'barrelDown');
        
        // Power controls
        this.setupButton('power-up-btn', 'powerUp');
        this.setupButton('power-down-btn', 'powerDown');
        
        // Fire button
        this.setupButton('fire-btn', 'fire');
    }
      setupButton(buttonId, actionName) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.error(`Button not found: ${buttonId}`);
            return;
        }
        
        console.log(`Setting up button: ${buttonId} for action: ${actionName}`);
          // Touch start
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            console.log(`Touch start on ${buttonId}`);
            
            // Play button press sound for all buttons except fire (fire has its own sound)
            if (this.game.audioManager && actionName !== 'fire') {
                this.game.audioManager.playSound('enterTank', 0.2);
            }
            
            this.setButtonState(actionName, true);
            button.classList.add('active');
        });
        
        // Touch end
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            console.log(`Touch end on ${buttonId}`);
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });
        
        // Touch cancel (when finger moves off button)
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            console.log(`Touch cancel on ${buttonId}`);
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });
        
        // Mouse events for testing on desktop
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            console.log(`Mouse down on ${buttonId}`);
            this.setButtonState(actionName, true);
            button.classList.add('active');
        });
        
        button.addEventListener('mouseup', (e) => {
            e.preventDefault();
            console.log(`Mouse up on ${buttonId}`);
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });
        
        button.addEventListener('mouseleave', (e) => {
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });
    }
      setButtonState(actionName, active) {
        this.buttonStates[actionName] = active;
        console.log(`Setting ${actionName} to ${active}`);
        
        // Map to game input states
        switch (actionName) {
            case 'turretLeft':
                this.game.inputStates.turretLeft = active;
                break;
            case 'turretRight':
                this.game.inputStates.turretRight = active;
                break;
            case 'barrelUp':
                this.game.inputStates.barrelUp = active;
                break;
            case 'barrelDown':
                this.game.inputStates.barrelDown = active;
                break;
            case 'powerUp':
                this.game.inputStates.increasePower = active;
                break;
            case 'powerDown':
                this.game.inputStates.decreasePower = active;
                break;
            case 'fire':
                if (active && !this.game.playerTank.hasFiredThisTurn) {
                    this.game.inputStates.fire = true;
                    console.log('Fire button pressed, setting fire state to true');
                }
                break;
        }
    }
    
    setupTouchCamera() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        let lastTouchDistance = 0;
        let lastTouchCenter = { x: 0, y: 0 };
        let cameraRotation = 0;
        
        // Handle pinch-to-zoom and camera rotation
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Two-finger gesture
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                lastTouchDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) + 
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                lastTouchCenter = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
            } else if (e.touches.length === 1) {
                // Single finger camera rotation
                const touch = e.touches[0];
                lastTouchCenter = { x: touch.clientX, y: touch.clientY };
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            
            if (e.touches.length === 2) {
                // Pinch to zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) + 
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                const scale = currentDistance / lastTouchDistance;
                if (this.game.cameraController && this.game.cameraController.camera) {
                    // Adjust camera distance
                    if (this.game.cameraController.distance) {
                        this.game.cameraController.distance = Math.max(3, Math.min(15, 
                            this.game.cameraController.distance / scale));
                    }
                }
                
                lastTouchDistance = currentDistance;
            } else if (e.touches.length === 1 && !this.joystickState.active) {
                // Single finger camera rotation (only if not using joystick)
                const touch = e.touches[0];
                const deltaX = touch.clientX - lastTouchCenter.x;
                
                if (this.game.cameraController && this.game.cameraController.rotation !== undefined) {
                    this.game.cameraController.rotation -= deltaX * 0.01;
                }
                
                lastTouchCenter = { x: touch.clientX, y: touch.clientY };
            }
        });
    }
    
    // Update method called from game loop
    update(deltaTime) {
        if (!this.isEnabled) return;
        
        // The joystick and button states are already being applied to game.inputStates
        // in real-time through the event handlers, so no additional update logic needed
    }
    
    // Enable/disable mobile controls
    enable() {
        this.isEnabled = true;
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'flex';
        }
    }
    
    disable() {
        this.isEnabled = false;
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'none';
        }
        this.resetJoystick();
    }
      // Force enable mobile controls for testing
    forceEnable() {
        console.log('Force enabling mobile controls');
        localStorage.setItem('forceMobileControls', 'true');
        this.isEnabled = true;
        this.setupMobileControls();
    }
}
