import * as THREE from 'three';

/**
 * Mobile Controls System for Tank Game
 * Handles sophisticated touch controls for mobile devices
 */
export class MobileControls {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        
        // Touch state tracking
        this.touches = new Map();
        this.joystickActive = false;
        this.joystickCenter = { x: 0, y: 0 };
        this.joystickValue = { x: 0, y: 0 };
        
        // Power slider state
        this.powerSliderActive = false;
        this.currentPower = 50;
        
        // Aiming state
        this.aimingActive = false;
        this.lastAimPosition = { x: 0, y: 0 };
        this.showTrajectory = false;
        this.trajectoryPoints = [];
        
        // Camera controls
        this.cameraZoomActive = false;
        this.lastPinchDistance = 0;
        this.cameraDistance = 15;
        this.minCameraDistance = 8;
        this.maxCameraDistance = 30;
        
        // Fire button state
        this.canFire = true;
        
        // DOM elements
        this.getElements();
        this.setupEventListeners();
        
        // Initialize UI
        this.updatePowerSlider();
    }
    
    getElements() {
        this.joystick = document.getElementById('virtual-joystick');
        this.joystickKnob = document.getElementById('joystick-knob');
        this.powerSliderContainer = document.getElementById('power-slider-container');
        this.powerSliderThumb = document.getElementById('power-slider-thumb');
        this.powerValue = document.getElementById('power-value');
        this.fireButton = document.getElementById('mobile-fire-btn');
        this.gameCanvas = this.game.renderer.domElement;
        this.trajectorySvg = document.getElementById('trajectory-svg');
        this.trajectoryPath = document.getElementById('trajectory-path');
        this.trajectoryTarget = document.getElementById('trajectory-target');
        this.aimCrosshair = document.getElementById('aim-crosshair');
    }
    
    setupEventListeners() {
        // Virtual joystick
        this.setupVirtualJoystick();
        
        // Power slider
        this.setupPowerSlider();
        
        // Fire button
        this.setupFireButton();
        
        // Main game area (aiming and camera)
        this.setupGameAreaControls();
        
        // Prevent default behaviors
        this.setupDefaultPrevention();
    }
    
    setupVirtualJoystick() {
        const startTouch = (e) => {
            e.preventDefault();
            if (!this.isActive) return;
            
            this.joystickActive = true;
            const rect = this.joystick.getBoundingClientRect();
            this.joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            
            this.game.vibrate(10);
        };
        
        const moveTouch = (e) => {
            if (!this.joystickActive || !this.isActive) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            if (!touch) return;
            
            const deltaX = touch.clientX - this.joystickCenter.x;
            const deltaY = touch.clientY - this.joystickCenter.y;
            
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 30; // Maximum knob distance from center
            
            if (distance <= maxDistance) {
                this.joystickValue.x = deltaX / maxDistance;
                this.joystickValue.y = deltaY / maxDistance;
                this.joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            } else {
                const angle = Math.atan2(deltaY, deltaX);
                const clampedX = Math.cos(angle) * maxDistance;
                const clampedY = Math.sin(angle) * maxDistance;
                
                this.joystickValue.x = clampedX / maxDistance;
                this.joystickValue.y = clampedY / maxDistance;
                this.joystickKnob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
            }
            
            this.handleJoystickInput();
        };
        
        const endTouch = (e) => {
            e.preventDefault();
            this.joystickActive = false;
            this.joystickValue = { x: 0, y: 0 };
            this.joystickKnob.style.transform = 'translate(0px, 0px)';
        };
        
        this.joystick.addEventListener('touchstart', startTouch, { passive: false });
        document.addEventListener('touchmove', moveTouch, { passive: false });
        document.addEventListener('touchend', endTouch, { passive: false });
        document.addEventListener('touchcancel', endTouch, { passive: false });
    }
    
    setupPowerSlider() {
        const startTouch = (e) => {
            e.preventDefault();
            if (!this.isActive) return;
            
            this.powerSliderActive = true;
            this.game.vibrate(10);
        };
        
        const moveTouch = (e) => {
            if (!this.powerSliderActive || !this.isActive) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            if (!touch) return;
            
            const rect = this.powerSliderContainer.getBoundingClientRect();
            const relativeY = touch.clientY - rect.top;
            const percentage = Math.max(0, Math.min(1, 1 - (relativeY / rect.height)));
            
            this.currentPower = Math.round(10 + percentage * 90); // 10-100%
            this.updatePowerSlider();
            
            // Update game tank power
            if (this.game.playerTank) {
                this.game.playerTank.currentPower = this.currentPower;
            }
        };
        
        const endTouch = (e) => {
            e.preventDefault();
            this.powerSliderActive = false;
        };
        
        this.powerSliderContainer.addEventListener('touchstart', startTouch, { passive: false });
        this.powerSliderThumb.addEventListener('touchstart', startTouch, { passive: false });
        document.addEventListener('touchmove', moveTouch, { passive: false });
        document.addEventListener('touchend', endTouch, { passive: false });
        document.addEventListener('touchcancel', endTouch, { passive: false });
    }
    
    setupFireButton() {
        this.fireButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.isActive || !this.canFire) return;
            
            if (this.game.gameState === 'PLAYER_TURN' && this.game.playerTank && !this.game.playerTank.hasFiredThisTurn) {
                this.fire();
                this.game.vibrate(80);
            }
        }, { passive: false });
    }
    
    setupGameAreaControls() {
        let touchStartPositions = [];
        let initialPinchDistance = 0;
        
        const startTouch = (e) => {
            e.preventDefault();
            if (!this.isActive) return;
            
            touchStartPositions = Array.from(e.touches).map(touch => ({
                x: touch.clientX,
                y: touch.clientY,
                id: touch.identifier
            }));
            
            if (e.touches.length === 1) {
                // Single touch - start aiming
                this.startAiming(e.touches[0]);
            } else if (e.touches.length === 2) {
                // Two finger touch - camera zoom
                this.startCameraZoom(e.touches);
            }
        };
        
        const moveTouch = (e) => {
            e.preventDefault();
            if (!this.isActive) return;
            
            if (e.touches.length === 1 && this.aimingActive) {
                // Single finger aiming
                this.updateAiming(e.touches[0]);
            } else if (e.touches.length === 2 && this.cameraZoomActive) {
                // Two finger camera zoom
                this.updateCameraZoom(e.touches);
            }
        };
        
        const endTouch = (e) => {
            e.preventDefault();
            
            if (e.touches.length === 0) {
                this.endAiming();
                this.endCameraZoom();
            } else if (e.touches.length === 1 && this.cameraZoomActive) {
                // Switched from two fingers to one - start aiming
                this.endCameraZoom();
                this.startAiming(e.touches[0]);
            }
        };
        
        this.gameCanvas.addEventListener('touchstart', startTouch, { passive: false });
        this.gameCanvas.addEventListener('touchmove', moveTouch, { passive: false });
        this.gameCanvas.addEventListener('touchend', endTouch, { passive: false });
        this.gameCanvas.addEventListener('touchcancel', endTouch, { passive: false });
    }
    
    setupDefaultPrevention() {
        // Prevent zoom and scroll
        document.addEventListener('gesturestart', e => e.preventDefault());
        document.addEventListener('gesturechange', e => e.preventDefault());
        document.addEventListener('gestureend', e => e.preventDefault());
        
        // Prevent context menu
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
    
    startAiming(touch) {
        this.aimingActive = true;
        this.lastAimPosition = {
            x: touch.clientX,
            y: touch.clientY
        };
        this.showTrajectory = true;
        this.aimCrosshair.classList.add('active');
        this.createTouchFeedback(touch.clientX, touch.clientY);
        this.calculateTrajectory();
    }
    
    updateAiming(touch) {
        if (!this.aimingActive) return;
        
        const deltaX = touch.clientX - this.lastAimPosition.x;
        const deltaY = touch.clientY - this.lastAimPosition.y;
        
        // Update turret rotation (horizontal movement)
        if (this.game.playerTank) {
            const turretSensitivity = 0.01;
            this.game.playerTank.rotateTurret(deltaX * turretSensitivity);
            
            // Update barrel elevation (vertical movement)
            const barrelSensitivity = 0.008;
            this.game.playerTank.elevateBarrel(-deltaY * barrelSensitivity);
        }
        
        this.lastAimPosition = {
            x: touch.clientX,
            y: touch.clientY
        };
        
        this.calculateTrajectory();
    }
    
    endAiming() {
        this.aimingActive = false;
        this.showTrajectory = false;
        this.aimCrosshair.classList.remove('active');
        this.updateTrajectoryDisplay();
    }
    
    startCameraZoom(touches) {
        this.cameraZoomActive = true;
        this.lastPinchDistance = this.getPinchDistance(touches);
        this.endAiming(); // Stop aiming when zooming
    }
    
    updateCameraZoom(touches) {
        if (!this.cameraZoomActive) return;
        
        const currentPinchDistance = this.getPinchDistance(touches);
        const deltaDistance = currentPinchDistance - this.lastPinchDistance;
        
        // Adjust camera distance
        const zoomSensitivity = 0.05;
        this.cameraDistance -= deltaDistance * zoomSensitivity;
        this.cameraDistance = Math.max(this.minCameraDistance, Math.min(this.maxCameraDistance, this.cameraDistance));
        
        // Apply to camera controller
        if (this.game.cameraController && this.game.cameraController.distance !== undefined) {
            this.game.cameraController.distance = this.cameraDistance;
        }
        
        this.lastPinchDistance = currentPinchDistance;
    }
    
    endCameraZoom() {
        this.cameraZoomActive = false;
    }
    
    getPinchDistance(touches) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        const deltaX = touch2.clientX - touch1.clientX;
        const deltaY = touch2.clientY - touch1.clientY;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }
    
    handleJoystickInput() {
        if (!this.isActive || !this.game.playerTank) return;
        
        const moveThreshold = 0.1;
        
        // Forward/backward movement
        if (Math.abs(this.joystickValue.y) > moveThreshold) {
            const direction = new THREE.Vector3(0, 0, this.joystickValue.y > 0 ? 1 : -1);
            direction.applyQuaternion(this.game.playerTank.mesh.quaternion);
            this.game.playerTank.move(direction, Math.abs(this.joystickValue.y) * 0.016); // Scaled movement
        }
        
        // Left/right rotation
        if (Math.abs(this.joystickValue.x) > moveThreshold) {
            const rotationSpeed = this.game.playerTank.rotateSpeed * 0.016; // Per frame
            this.game.playerTank.rotateBody(this.joystickValue.x * rotationSpeed);
        }
        
        // Update UI
        this.game.ui.updateFuel(this.game.playerTank.currentFuel, this.game.playerTank.maxFuel);
    }
    
    calculateTrajectory() {
        if (!this.showTrajectory || !this.game.playerTank) {
            this.trajectoryPoints = [];
            this.updateTrajectoryDisplay();
            return;
        }
        
        // Get firing parameters
        const tank = this.game.playerTank;
        const barrelTip = new THREE.Vector3(0, 0, 1);
        tank.barrel.localToWorld(barrelTip);
        
        // Calculate direction
        const localDirection = new THREE.Vector3(0, 0, 1);
        localDirection.applyAxisAngle(new THREE.Vector3(1, 0, 0), tank.barrelElevation);
        localDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.turret.rotation.y);
        localDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.mesh.rotation.y);
        localDirection.normalize();
        
        // Calculate initial velocity
        const powerRatio = (tank.currentPower - tank.minPower) / (tank.maxPower - tank.minPower);
        const initialSpeed = tank.minProjectileSpeed + powerRatio * (tank.maxProjectileSpeed - tank.minProjectileSpeed);
        const initialVelocity = localDirection.clone().multiplyScalar(initialSpeed);
        
        // Simulate trajectory
        this.trajectoryPoints = [];
        const startPos = barrelTip.clone();
        let currentPos = startPos.clone();
        let currentVel = initialVelocity.clone();
        const gravity = 9.81 * 2; // Match projectile gravity
        const timeStep = 0.1;
        const maxTime = 3.0;
        
        for (let t = 0; t < maxTime; t += timeStep) {
            // Apply gravity
            currentVel.y -= gravity * timeStep;
            
            // Update position
            currentPos.add(currentVel.clone().multiplyScalar(timeStep));
            
            // Convert world position to screen coordinates
            const screenPos = this.worldToScreen(currentPos);
            if (screenPos) {
                this.trajectoryPoints.push(screenPos);
            }
            
            // Stop if hits ground
            const terrainHeight = this.game.scene.userData.terrain.getHeightAt(currentPos.x, currentPos.z);
            if (currentPos.y <= terrainHeight) {
                break;
            }
        }
        
        this.updateTrajectoryDisplay();
    }
    
    worldToScreen(worldPos) {
        const vector = worldPos.clone();
        vector.project(this.game.camera);
        
        const canvas = this.game.renderer.domElement;
        const x = (vector.x + 1) * canvas.offsetWidth / 2;
        const y = (-vector.y + 1) * canvas.offsetHeight / 2;
        
        // Only return if point is in front of camera
        if (vector.z < 1) {
            return { x, y };
        }
        return null;
    }
    
    updateTrajectoryDisplay() {
        if (!this.showTrajectory || this.trajectoryPoints.length === 0) {
            this.trajectoryPath.setAttribute('d', '');
            this.trajectoryTarget.style.display = 'none';
            return;
        }
        
        // Create SVG path
        let pathData = `M ${this.trajectoryPoints[0].x} ${this.trajectoryPoints[0].y}`;
        for (let i = 1; i < this.trajectoryPoints.length; i++) {
            pathData += ` L ${this.trajectoryPoints[i].x} ${this.trajectoryPoints[i].y}`;
        }
        
        this.trajectoryPath.setAttribute('d', pathData);
        
        // Show target at end point
        if (this.trajectoryPoints.length > 0) {
            const lastPoint = this.trajectoryPoints[this.trajectoryPoints.length - 1];
            this.trajectoryTarget.setAttribute('cx', lastPoint.x);
            this.trajectoryTarget.setAttribute('cy', lastPoint.y);
            this.trajectoryTarget.style.display = 'block';
        }
    }
    
    updatePowerSlider() {
        const percentage = (this.currentPower - 10) / 90; // Normalize to 0-1
        const containerHeight = this.powerSliderContainer.clientHeight || 80;
        const thumbHeight = 16;
        const position = (1 - percentage) * (containerHeight - thumbHeight);
        
        this.powerSliderThumb.style.top = `${position}px`;
        this.powerValue.textContent = `${this.currentPower}%`;
        
        // Update main UI
        if (this.game.ui) {
            this.game.ui.updateMobilePower(this.currentPower);
        }
    }
    
    fire() {
        if (!this.canFire || !this.game.playerTank || this.game.playerTank.hasFiredThisTurn) return;
        
        // Update tank power before firing
        this.game.playerTank.currentPower = this.currentPower;
        
        // Fire the projectile
        this.game.playerTank.shoot();
        
        // Visual feedback
        this.canFire = false;
        this.showTrajectory = false;
        this.updateTrajectoryDisplay();
        
        // Update fire button
        this.fireButton.style.background = 'linear-gradient(135deg, #ffaa00 0%, #ff6600 100%)';
        this.fireButton.querySelector('.fire-text').textContent = 'FIRED';
        this.fireButton.querySelector('.fire-icon').textContent = '💥';
        
        // Reset button after delay
        setTimeout(() => {
            this.fireButton.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
            this.fireButton.querySelector('.fire-text').textContent = 'FIRE';
            this.fireButton.querySelector('.fire-icon').textContent = '🔥';
            this.canFire = true;
        }, 2000);
    }
    
    createTouchFeedback(x, y) {
        const feedback = document.createElement('div');
        feedback.className = 'touch-feedback';
        feedback.style.left = `${x}px`;
        feedback.style.top = `${y}px`;
        feedback.style.position = 'fixed';
        feedback.style.pointerEvents = 'none';
        feedback.style.zIndex = '1000';
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 600);
    }
    
    startPlayerTurn() {
        this.isActive = true;
        this.canFire = true;
        
        // Reset controls
        this.joystickValue = { x: 0, y: 0 };
        this.joystickKnob.style.transform = 'translate(0px, 0px)';
        
        // Show controls hint briefly
        const hint = document.getElementById('camera-hint');
        if (hint) {
            hint.style.display = 'block';
            setTimeout(() => {
                hint.style.display = 'none';
            }, 3000);
        }
        
        console.log('Mobile controls activated for player turn');
    }
    
    endPlayerTurn() {
        this.isActive = false;
        this.canFire = false;
        this.endAiming();
        this.endCameraZoom();
        
        console.log('Mobile controls deactivated');
    }
    
    update(deltaTime) {
        // Continuous joystick input handling
        if (this.isActive && this.joystickActive) {
            this.handleJoystickInput();
        }
        
        // Update trajectory if aiming
        if (this.aimingActive && this.showTrajectory) {
            // Recalculate trajectory occasionally for accuracy
            if (Math.random() < 0.1) { // 10% chance per frame
                this.calculateTrajectory();
            }
        }
    }
    
    updateCamera(camera, deltaTime) {
        // Handle camera updates if needed
        if (this.cameraZoomActive && this.game.cameraController) {
            // Camera updates are handled in the camera zoom methods
        }
    }
    
    // Public methods for game integration
    getPowerLevel() {
        return this.currentPower;
    }
    
    setPowerLevel(power) {
        this.currentPower = Math.max(10, Math.min(100, power));
        this.updatePowerSlider();
    }
    
    isControlActive() {
        return this.isActive;
    }
    
    // Debug information
    getDebugInfo() {
        return {
            isActive: this.isActive,
            joystickActive: this.joystickActive,
            joystickValue: this.joystickValue,
            aimingActive: this.aimingActive,
            powerSliderActive: this.powerSliderActive,
            currentPower: this.currentPower,
            showTrajectory: this.showTrajectory,
            trajectoryPointCount: this.trajectoryPoints.length,
            cameraDistance: this.cameraDistance,
            canFire: this.canFire
        };
    }
}