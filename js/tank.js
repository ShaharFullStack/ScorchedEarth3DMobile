import * as THREE from 'three';
import { Projectile } from './projectile.js';

const FUEL_PER_MOVE_ACTION = 10; // Cost for one 'tick' of movement
const FUEL_PER_ROTATE_ACTION = 5; // Cost for one 'tick' of rotation

export class Tank {
    constructor(id, isPlayer, scene, initialPosition, color, gameInstance) {
        this.id = id;
        this.isPlayer = isPlayer;
        this.scene = scene;
        this.game = gameInstance; // Reference to the game instance
        this.isMobile = gameInstance.isMobile || false;

        this.mesh = new THREE.Group();
        this.turret = new THREE.Group();
        this.barrel = null;
        this.nameLabel = null; // For player name display
        this.previousHealth = 0; // Track health changes

        this.maxHealth = 100;
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;

        this.maxFuel = 100;
        this.currentFuel = this.maxFuel;
        
        // Movement and rotation speeds (adjusted for mobile)
        this.moveSpeed = this.isMobile ? 4 : 5; // Slightly slower on mobile for better control
        this.rotateSpeed = Math.PI / 2; // radians per second (90 degrees/sec)
        this.turretRotateSpeed = this.isMobile ? Math.PI * 0.8 : Math.PI; // Slightly slower turret on mobile

        this.hasFiredThisTurn = false;
        this.collisionRadius = 1.5; // For simple sphere collision
        
        // Firing properties
        this.minPower = 10;
        this.maxPower = 100;
        this.currentPower = 50; // Default power
        this.powerIncrement = this.isMobile ? 3 : 5; // Smaller increments for finer mobile control
        this.minProjectileSpeed = 15; // m/s at minPower
        this.maxProjectileSpeed = 40; // m/s at maxPower
        
        // Barrel elevation - optimized for mobile control
        this.barrelElevation = 0; // Radians
        this.minBarrelElevation = -Math.PI / 12; // Approx -15 degrees
        this.maxBarrelElevation = Math.PI / 3;   // Approx 60 degrees
        this.barrelElevateSpeed = this.isMobile ? Math.PI / 8 : Math.PI / 6; // Slightly slower for mobile precision
        
        this.createMesh(color);
        this.mesh.position.copy(initialPosition);
        
        // Adjust initial Y position based on terrain
        if (this.scene.userData.terrain) {
            this.mesh.position.y = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.5;
        }
        
        // Create name label if this is a player tank (desktop only to save mobile performance)
        if (this.isPlayer && !this.isMobile) {
            this.createNameLabel();
        }
        
        // Set initial previous health
        this.previousHealth = this.currentHealth;
        
        // Initial health bar update
        setTimeout(() => {
            if (this.healthBarSprite && this.game.camera) {
                this.updateHealthBar(this.game.camera);
            }
        }, 100);
        
        console.log(`Tank ${id} created for ${this.isMobile ? 'mobile' : 'desktop'} device`);
    }

    createMesh(color) {
        // Body - simplified geometry for mobile
        const bodySegments = this.isMobile ? 1 : 1; // Keep same for compatibility
        const bodyGeo = new THREE.BoxGeometry(2, 1, 3);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            metalness: this.isMobile ? 0.2 : 0.3, // Reduced metalness for mobile performance
            roughness: this.isMobile ? 0.8 : 0.6
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.castShadow = !this.isMobile;
        bodyMesh.receiveShadow = !this.isMobile;
        this.mesh.add(bodyMesh);

        // Turret - simplified for mobile
        const turretGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
        const turretColor = new THREE.Color(color).offsetHSL(0, 0, -0.2);
        const turretMat = new THREE.MeshStandardMaterial({ 
            color: turretColor, 
            metalness: this.isMobile ? 0.3 : 0.4, 
            roughness: this.isMobile ? 0.7 : 0.5
        });
        const turretMesh = new THREE.Mesh(turretGeo, turretMat);
        turretMesh.position.y = 0.5 + 0.4; // On top of body
        turretMesh.castShadow = !this.isMobile;
        this.turret.add(turretMesh);

        // Barrel - optimized geometry for mobile
        const barrelSegments = this.isMobile ? 6 : 8;
        const barrelGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, barrelSegments);
        const barrelMat = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            metalness: this.isMobile ? 0.5 : 0.7, 
            roughness: this.isMobile ? 0.5 : 0.3 
        });
        this.barrel = new THREE.Mesh(barrelGeo, barrelMat);
        
        // Create a pivot group for proper barrel rotation
        this.barrelPivot = new THREE.Group();
        
        // Position the barrel correctly
        this.barrel.position.set(0, 0, 1);
        this.barrel.rotation.x = -Math.PI / 2;
        
        // Set initial elevation
        this.barrelPivot.rotation.x = this.barrelElevation;
        
        // Add barrel to pivot, pivot to turret
        this.barrelPivot.add(this.barrel);
        turretMesh.add(this.barrelPivot);
        
        // Store reference to pivot for elevation control
        this.barrelPivotRef = this.barrelPivot;
        
        this.mesh.add(this.turret);
        
        // Create health bar for all tanks
        this.createHealthBar();
    }
    
    createHealthBar() {
        // Create canvas for health bar with mobile optimizations
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Smaller canvas for mobile to save memory
        const canvasWidth = this.isMobile ? 128 : 256;
        const canvasHeight = this.isMobile ? 32 : 64;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Store canvas and context for updates
        this.healthBarCanvas = canvas;
        this.healthBarContext = context;
        
        // Create texture from canvas
        this.healthBarTexture = new THREE.CanvasTexture(canvas);
        this.healthBarTexture.needsUpdate = true;
        
        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({
            map: this.healthBarTexture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: false
        });
        
        // Create sprite with mobile-optimized scaling
        this.healthBarSprite = new THREE.Sprite(spriteMaterial);
        const spriteScale = this.isMobile ? 2.5 : 3;
        const spriteHeight = this.isMobile ? 0.6 : 0.75;
        this.healthBarSprite.scale.set(spriteScale, spriteHeight, 1);
        
        // Position above tank (adjusted for mobile)
        const yOffset = this.isPlayer ? (this.isMobile ? 2.5 : 2.8) : (this.isMobile ? 2.8 : 3.2);
        this.healthBarSprite.position.set(0, yOffset, 0);
        
        // Add to tank mesh
        this.mesh.add(this.healthBarSprite);
        
        // Initial health bar render
        this.updateHealthBarVisual();
    }
    
    updateHealthBarVisual() {
        if (!this.healthBarContext || !this.healthBarTexture) {
            console.warn(`Tank ${this.id}: Health bar components missing`);
            return;
        }
        
        const context = this.healthBarContext;
        const canvas = this.healthBarCanvas;
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Health percentage
        const healthPercent = this.currentHealth / this.maxHealth;
        
        // Simplified styling for mobile
        const borderWidth = this.isMobile ? 2 : 3;
        const barHeight = this.isMobile ? 12 : 20;
        const padding = this.isMobile ? 8 : 20;
        
        // Background (black with border)
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Border
        context.strokeStyle = this.isPlayer ? '#00ff41' : '#ff4444';
        context.lineWidth = borderWidth;
        context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Health bar background (dark)
        const barWidth = canvas.width - (padding * 2);
        const barX = padding;
        const barY = this.isMobile ? 10 : 22;
        
        context.fillStyle = 'rgba(60, 60, 60, 0.9)';
        context.fillRect(barX, barY, barWidth, barHeight);
        
        // Health bar fill
        const fillWidth = barWidth * healthPercent;
        
        // Color based on health percentage
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = this.isPlayer ? '#00ff41' : '#ff6b6b';
        } else if (healthPercent > 0.3) {
            healthColor = '#ffaa00';
        } else {
            healthColor = '#ff4444';
        }
        
        // Simplified gradient for mobile
        if (this.isMobile) {
            context.fillStyle = healthColor;
        } else {
            const gradient = context.createLinearGradient(barX, barY, barX, barY + barHeight);
            gradient.addColorStop(0, healthColor);
            gradient.addColorStop(0.5, healthColor + 'CC');
            gradient.addColorStop(1, healthColor);
            context.fillStyle = gradient;
        }
        
        context.fillRect(barX, barY, fillWidth, barHeight);
        
        // Health text (smaller for mobile)
        const fontSize = this.isMobile ? 8 : 14;
        context.font = `bold ${fontSize}px "Orbitron", monospace`;
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`${this.currentHealth}/${this.maxHealth}`, canvas.width / 2, barY + barHeight / 2);
        
        // Add glow effect only on desktop
        if (!this.isMobile) {
            context.shadowColor = healthColor;
            context.shadowBlur = 5;
            context.fillText(`${this.currentHealth}/${this.maxHealth}`, canvas.width / 2, barY + barHeight / 2);
            context.shadowBlur = 0;
        }
        
        // Tank identifier (smaller text above bar)
        const labelFontSize = this.isMobile ? 6 : 10;
        context.font = `bold ${labelFontSize}px "Rajdhani", monospace`;
        context.fillStyle = this.isPlayer ? '#00ff41' : '#ff4444';
        context.textAlign = 'center';
        
        let tankName;
        if (this.isPlayer) {
            tankName = this.game.ui.getPlayerName() || 'PLAYER';
            // Truncate long names on mobile
            if (this.isMobile && tankName.length > 8) {
                tankName = tankName.substring(0, 8) + '...';
            }
        } else {
            const enemyIndex = this.id.replace('enemy_', '');
            tankName = this.isMobile ? `E${parseInt(enemyIndex) + 1}` : `ENEMY ${parseInt(enemyIndex) + 1}`;
        }
        
        context.fillText(tankName, canvas.width / 2, this.isMobile ? 8 : 16);
        
        // Update texture
        this.healthBarTexture.needsUpdate = true;
    }
    
    updateHealthBar(camera) {
        // Force update the visual
        this.updateHealthBarVisual();
        this.previousHealth = this.currentHealth;
        
        // Update health in the UI
        if (this.game && this.game.ui) {
            this.game.ui.updateHealth(this.id, this.currentHealth, this.maxHealth);
        }
    }
    
    createNameLabel() {
        // Desktop only feature for performance
        if (this.isMobile) return;
        
        // Get player name from game UI
        const playerName = this.game.ui.getPlayerName() || 'COMMANDER';
        
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Style the text
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Text styling
        context.fillStyle = '#00ff41';
        context.font = 'bold 48px "Orbitron", monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add glow effect
        context.shadowColor = '#00ff41';
        context.shadowBlur = 10;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw the text
        context.fillText(playerName, canvas.width / 2, canvas.height / 2);
        
        // Add border
        context.strokeStyle = '#004400';
        context.lineWidth = 3;
        context.strokeText(playerName, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: false
        });
        
        // Create sprite
        this.nameLabel = new THREE.Sprite(spriteMaterial);
        this.nameLabel.scale.set(4, 1, 1);
        this.nameLabel.position.set(0, 3.5, 0);
        
        // Add to tank mesh
        this.mesh.add(this.nameLabel);
    }
    
    updateNameLabel(camera) {
        // Desktop only
        if (this.isMobile || !this.nameLabel || !camera) return;
        
        // Make the label always face the camera
        this.nameLabel.lookAt(camera.position);
        
        // Adjust opacity based on distance to camera
        const distance = this.mesh.position.distanceTo(camera.position);
        const maxDistance = 50;
        const minDistance = 10;
        
        let opacity = 1.0;
        if (distance > maxDistance) {
            opacity = 0.3;
        } else if (distance > minDistance) {
            opacity = 1.0 - ((distance - minDistance) / (maxDistance - minDistance)) * 0.7;
        }
        
        this.nameLabel.material.opacity = opacity;
    }
    
    elevateBarrel(angleChange) {
        if (this.isDestroyed) return;
        
        this.barrelElevation += angleChange;
        this.barrelElevation = Math.max(this.minBarrelElevation, Math.min(this.maxBarrelElevation, this.barrelElevation));
        
        // Apply elevation to the barrel pivot
        if (this.barrelPivotRef) {
            this.barrelPivotRef.rotation.x = this.barrelElevation;
        }
        
        // Update mobile UI if this is the player tank
        if (this.isPlayer && this.isMobile && this.game && this.game.ui) {
            this.game.ui.updateBarrelElevation(this.barrelElevation);
        }
    }
    
    move(direction, deltaTime) {
        if (this.isDestroyed || this.currentFuel <= 0) return;

        const fuelCost = FUEL_PER_MOVE_ACTION * deltaTime * 5;
        if (this.currentFuel < fuelCost) return;

        const moveDistance = this.moveSpeed * deltaTime;
        
        // Clone the direction to avoid modifying the original vector
        const moveVector = direction.clone().multiplyScalar(moveDistance);
        const newPosition = this.mesh.position.clone().add(moveVector);
        
        // Boundary check adapted for mobile map size
        const mapSize = this.isMobile ? 30 : 39.5;
        if (newPosition.x < -mapSize || newPosition.x > mapSize || newPosition.z < -mapSize || newPosition.z > mapSize) {
            return; // Hit boundary
        }

        // Check collision with buildings using sphere collision
        const collisionTolerance = this.isMobile ? 1.1 : 1.0; // Slightly more forgiving on mobile
        for (const building of this.game.buildings) {
            if (building.userData.isDestroyed) continue;
            
            const buildingCenter = building.position.clone();
            buildingCenter.y += 2;
            
            const distance = newPosition.distanceTo(buildingCenter);
            const combinedRadius = (this.collisionRadius + building.userData.collisionRadius) * collisionTolerance;
            
            if (distance < combinedRadius) {
                return; // Collision with building
            }
        }
        
        // Check collision with trees
        const newTankCenter = newPosition.clone();
        newTankCenter.y += 0.5;
        
        for (const tree of this.game.trees) {
            if (tree.userData.isDestroyed) continue;
            
            const treeCenter = tree.position.clone();
            treeCenter.y += 2;
            
            const distance = newTankCenter.distanceTo(treeCenter);
            const combinedRadius = (this.collisionRadius + tree.userData.collisionRadius) * collisionTolerance;
            
            if (distance < combinedRadius) {
                return; // Collision with tree
            }
        }
        
        // Apply the movement
        this.mesh.position.add(moveVector);
        
        // Update Y position based on terrain height
        if (this.scene.userData.terrain) {
            this.mesh.position.y = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.5;
        }
        
        this.currentFuel -= fuelCost;
        if (this.currentFuel < 0) this.currentFuel = 0;
        
        // Update UI for player tank
        if (this.isPlayer) {
            this.game.ui.updateFuel(this.currentFuel, this.maxFuel);
        }
    }

    rotateBody(angle) {
        if (this.isDestroyed || this.currentFuel <= 0) return;
        
        const fuelCost = FUEL_PER_ROTATE_ACTION * Math.abs(angle) * 2;
        if (this.currentFuel < fuelCost && this.isPlayer) return;

        this.mesh.rotation.y += angle;
        
        if (this.isPlayer) {
            this.currentFuel -= fuelCost;
            if (this.currentFuel < 0) this.currentFuel = 0;
            this.game.ui.updateFuel(this.currentFuel, this.maxFuel);
        }
    }

    rotateTurret(angle) {
        if (this.isDestroyed) return;
        // Turret rotation does not consume fuel
        this.turret.rotation.y += angle;
    }
    
    aimTowards(targetPosition) {
        if (this.isDestroyed) return;
        
        // Get tank position
        const tankPos = this.mesh.position.clone();
        
        // Calculate direction vector from tank to target
        const direction = targetPosition.clone().sub(tankPos);
        direction.y = 0; // Remove vertical component for horizontal aiming
        direction.normalize();
        
        // Calculate angle to target
        const angleToTarget = Math.atan2(direction.x, direction.z);
        
        // Set turret rotation directly to face target
        this.turret.rotation.y = angleToTarget;
    }
    
    shoot() {
        if (this.isDestroyed || this.hasFiredThisTurn) return;

        // Get the world position of the barrel tip
        const barrelTip = new THREE.Vector3(0, 0, 1);
        this.barrel.localToWorld(barrelTip);

        // Calculate the shooting direction properly
        const localDirection = new THREE.Vector3(0, 0, 1);
        
        // Apply barrel elevation
        localDirection.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.barrelElevation);
        
        // Apply turret rotation
        localDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.turret.rotation.y);
        
        // Apply tank body rotation
        localDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        
        // Normalize the direction
        localDirection.normalize();
        
        // Calculate initial speed based on current power
        const powerRatio = (this.currentPower - this.minPower) / (this.maxPower - this.minPower);
        const initialSpeed = this.minProjectileSpeed + powerRatio * (this.maxProjectileSpeed - this.minProjectileSpeed);
        const initialVelocity = localDirection.clone().multiplyScalar(initialSpeed);
        
        const projectile = new Projectile(
            barrelTip,
            initialVelocity,
            this.isPlayer,
            this.scene,
            this.isMobile
        );
        this.game.addProjectile(projectile);
        this.hasFiredThisTurn = true;
        
        // Update UI for player
        if (this.isPlayer) {
            if (this.isMobile) {
                // Mobile UI update handled by mobile controls
            } else {
                this.game.ui.updateActionIndicator("Aim / Move (Fired)");
            }
        }
        
        console.log(`Tank ${this.id} fired projectile with power ${this.currentPower}% and elevation ${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`);
    }
    
    takeDamage(amount) {
        if (this.isDestroyed) return;
        
        const oldHealth = this.currentHealth;
        this.currentHealth -= amount;
        
        console.log(`Tank ${this.id}: Taking ${amount} damage. Health: ${oldHealth} -> ${this.currentHealth}`);
        
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.isDestroyed = true;
            this.destroy();
        }
        
        // Update health bar immediately when taking damage
        const camera = this.game && this.game.camera ? this.game.camera : null;
        this.updateHealthBar(camera);
        
        // Create damage flash effect on health bar (simplified for mobile)
        if (this.healthBarSprite) {
            const originalScale = this.healthBarSprite.scale.clone();
            
            // Flash animation (shorter on mobile)
            const flashDuration = this.isMobile ? 200 : 300;
            const startTime = Date.now();
            
            const animateFlash = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / flashDuration;
                
                if (progress >= 1) {
                    this.healthBarSprite.scale.copy(originalScale);
                    return;
                }
                
                // Pulse effect (reduced intensity on mobile)
                const pulseIntensity = this.isMobile ? 0.05 : 0.1;
                const pulse = 1 + Math.sin(progress * Math.PI * 4) * pulseIntensity;
                this.healthBarSprite.scale.copy(originalScale).multiplyScalar(pulse);
                
                requestAnimationFrame(animateFlash);
            };
            
            animateFlash();
        }
        
        // Mobile haptic feedback
        if (this.isMobile && this.game && this.game.vibrate) {
            this.game.vibrate(this.isPlayer ? 100 : 50);
        }
    }

    destroy() {
        // Hide name label and health bar if they exist
        if (this.nameLabel) {
            this.nameLabel.visible = false;
        }
        if (this.healthBarSprite) {
            this.healthBarSprite.visible = false;
        }
        
        // Simple visual effect: sink into ground and fade (faster on mobile)
        const sinkSpeed = this.isMobile ? 0.7 : 0.5;
        const opacitySpeed = this.isMobile ? 1.5 : 1.0;
        const intervalDelay = this.isMobile ? 33 : 50; // 30fps vs 20fps
        
        const interval = setInterval(() => {
            this.mesh.position.y -= sinkSpeed * (intervalDelay / 1000);
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    if (child.material.opacity <= 0) {
                         child.material.opacity = 0;
                    } else {
                        child.material.opacity -= opacitySpeed * (intervalDelay / 1000);
                        child.material.transparent = true;
                    }
                }
            });
            
            if (this.mesh.position.y < -2 || (this.mesh.children[0].material && this.mesh.children[0].material.opacity <= 0)) {
                clearInterval(interval);
                this.scene.remove(this.mesh);
            }
        }, intervalDelay);
        
        console.log(`${this.id} destroyed!`);
        
        // Mobile destruction feedback
        if (this.isMobile && this.game && this.game.vibrate) {
            if (this.isPlayer) {
                // Player tank destroyed - strong vibration
                this.game.vibrate(300);
            } else {
                // Enemy tank destroyed - celebration vibration
                this.game.vibrate([100, 50, 100]);
            }
        }
    }
    
    resetTurnStats() {
        this.currentFuel = this.maxFuel;
        this.hasFiredThisTurn = false;
        
        if (this.isPlayer) {
            if (this.isMobile) {
                // Mobile UI updates handled by mobile controls
            } else {
                this.game.ui.updateActionIndicator("Move / Aim / Fire / Adjust Power");
            }
            this.game.ui.updatePowerIndicator(this.currentPower, this.minPower, this.maxPower);
        }
    }
    
    adjustPower(amount) {
        if (this.isDestroyed || !this.isPlayer) return;
        
        this.currentPower += amount;
        if (this.currentPower < this.minPower) this.currentPower = this.minPower;
        if (this.currentPower > this.maxPower) this.currentPower = this.maxPower;
        
        this.game.ui.updatePowerIndicator(this.currentPower, this.minPower, this.maxPower);
        
        // Update mobile controls if on mobile
        if (this.isMobile && this.game.mobileControls) {
            this.game.mobileControls.setPowerLevel(this.currentPower);
        }
    }
    
    update(deltaTime, camera) {
        // Update name label to face camera (desktop only)
        if (this.isPlayer && this.nameLabel && camera && !this.isMobile) {
            this.updateNameLabel(camera);
        }
        
        // Health bar updates
        if (this.healthBarSprite && camera) {
            // Always make it face the camera
            this.healthBarSprite.lookAt(camera.position);
            
            // Adjust opacity based on distance to camera
            const distance = this.mesh.position.distanceTo(camera.position);
            const maxDistance = this.isMobile ? 40 : 60; // Closer max distance on mobile
            const minDistance = this.isMobile ? 3 : 5;   // Closer min distance on mobile
            
            let opacity = 1.0;
            if (distance > maxDistance) {
                opacity = this.isMobile ? 0.3 : 0.2;
            } else if (distance > minDistance) {
                opacity = 1.0 - ((distance - minDistance) / (maxDistance - minDistance)) * (this.isMobile ? 0.7 : 0.8);
            }
            
            this.healthBarSprite.material.opacity = opacity;
            
            // Only update the visual if health has changed
            if (this.currentHealth !== this.previousHealth) {
                console.log(`Tank ${this.id}: Health changed from ${this.previousHealth} to ${this.currentHealth}`);
                this.updateHealthBarVisual();
                this.previousHealth = this.currentHealth;
            }
        }
    }
    
    // Mobile-specific methods
    getCurrentStats() {
        return {
            id: this.id,
            isPlayer: this.isPlayer,
            position: this.mesh.position.clone(),
            rotation: this.mesh.rotation.y,
            turretRotation: this.turret.rotation.y,
            barrelElevation: this.barrelElevation,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            currentFuel: this.currentFuel,
            maxFuel: this.maxFuel,
            currentPower: this.currentPower,
            isDestroyed: this.isDestroyed,
            hasFiredThisTurn: this.hasFiredThisTurn
        };
    }
    
    // Debug information for mobile
    getDebugInfo() {
        return {
            ...this.getCurrentStats(),
            isMobile: this.isMobile,
            collisionRadius: this.collisionRadius,
            moveSpeed: this.moveSpeed,
            rotateSpeed: this.rotateSpeed,
            turretRotateSpeed: this.turretRotateSpeed,
            barrelElevateSpeed: this.barrelElevateSpeed,
            powerRange: `${this.minPower}-${this.maxPower}`,
            elevationRange: `${(this.minBarrelElevation * 180 / Math.PI).toFixed(1)}° to ${(this.maxBarrelElevation * 180 / Math.PI).toFixed(1)}°`,
            hasNameLabel: !!this.nameLabel,
            hasHealthBar: !!this.healthBarSprite
        };
    }
}