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
        
        this.moveSpeed = 5; // units per second
        this.rotateSpeed = Math.PI / 2; // radians per second (90 degrees/sec)
        this.turretRotateSpeed = Math.PI; // radians per second (180 degrees/sec)

        this.hasFiredThisTurn = false;
        this.collisionRadius = 1.5; // For simple sphere collision
        
        // Firing properties
        this.minPower = 5;
        this.maxPower = 100;
        this.currentPower = 50; // Default power
        this.powerIncrement = 1;
        this.minProjectileSpeed = 5; // m/s at minPower
        this.maxProjectileSpeed = 100; // m/s at maxPower
        
        // Barrel elevation - Fixed ranges for proper aiming
        this.barrelElevation = Math.PI / 36; // Approx 5 degrees (slightly up) - CHANGED from 0
        this.minBarrelElevation = -Math.PI / 12; // Approx -15 degrees (slightly down)
        this.maxBarrelElevation = Math.PI / 3;   // Approx 60 degrees (up) - increased for better range
        this.barrelElevateSpeed = Math.PI / 6; // Faster elevation adjustment
        
        this.createMesh(color);
        this.mesh.position.copy(initialPosition);
        // Adjust initial Y position based on terrain
        if (this.scene.userData.terrain) {
            this.mesh.position.y = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.5; // 0.5 is tank half-height approx.
        }
        
        // Create name label if this is a player tank
        if (this.isPlayer) {
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
    }

    createMesh(color) {
        // Body
        const bodyGeo = new THREE.BoxGeometry(2, 1, 3);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.6 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);

        // Turret
        const turretGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2); // Smaller than body
        const turretMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0,0,-0.2) , metalness: 0.4, roughness: 0.5});
        const turretMesh = new THREE.Mesh(turretGeo, turretMat);
        turretMesh.position.y = 0.5 + 0.4; // On top of body
        turretMesh.castShadow = true;
        this.turret.add(turretMesh);        // Barrel - FIXED geometry and positioning  
        // Use BoxGeometry for clearer barrel orientation - length along Z-axis
        const barrelGeo = new THREE.BoxGeometry(0.3, 0.3, 2); // Width, Height, Length (forward)
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 });
        this.barrel = new THREE.Mesh(barrelGeo, barrelMat);
        
        // Create a pivot group for proper barrel rotation
        this.barrelPivot = new THREE.Group();        // CRITICAL FIX: Position the barrel correctly - the pivot point should be at the turret
        this.barrel.position.set(0, 0, 1); // Move barrel forward from pivot
        // No rotation needed - BoxGeometry naturally extends along Z-axis (forward)
          // Add barrel to pivot, pivot to turret
        this.barrelPivot.add(this.barrel);
        turretMesh.add(this.barrelPivot);
        
        // Store reference to pivot for elevation control
        this.barrelPivotRef = this.barrelPivot;
        
        // Apply the initial barrel elevation that was set in constructor
        if (this.barrelPivotRef) {
            this.barrelPivotRef.rotation.x = this.barrelElevation;
        }
        
        this.mesh.add(this.turret);
        
        // Create health bar for all tanks
        this.createHealthBar();
    }
    
    createHealthBar() {
        // Create canvas for health bar
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
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
        
        // Create sprite
        this.healthBarSprite = new THREE.Sprite(spriteMaterial);
        this.healthBarSprite.scale.set(3, 0.75, 1); // Adjust scale as needed
        
        // Position above tank (below name label if player)
        const yOffset = this.isPlayer ? 2.8 : 3.2;
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
        
        // Background (black with border)
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Border
        context.strokeStyle = this.isPlayer ? '#00ff41' : '#ff4444';
        context.lineWidth = 3;
        context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Health bar background (dark)
        const barWidth = canvas.width - 40;
        const barHeight = 20;
        const barX = 20;
        const barY = 22;
        
        context.fillStyle = 'rgba(60, 60, 60, 0.9)';
        context.fillRect(barX, barY, barWidth, barHeight);
        
        // Health bar fill
        const fillWidth = barWidth * healthPercent;
        
        // Color based on health percentage
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = this.isPlayer ? '#00ff41' : '#ff6b6b'; // Green for player, red for enemy
        } else if (healthPercent > 0.3) {
            healthColor = '#ffaa00'; // Orange for medium health
        } else {
            healthColor = '#ff4444'; // Red for low health
        }
        
        // Create gradient for health bar
        const gradient = context.createLinearGradient(barX, barY, barX, barY + barHeight);
        gradient.addColorStop(0, healthColor);
        gradient.addColorStop(0.5, healthColor + 'CC'); // Slightly transparent middle
        gradient.addColorStop(1, healthColor);
        
        context.fillStyle = gradient;
        context.fillRect(barX, barY, fillWidth, barHeight);
        
        // Health text
        context.font = 'bold 14px "Orbitron", monospace';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`${this.currentHealth}/${this.maxHealth}`, canvas.width / 2, barY + barHeight / 2);
        
        // Add glow effect to text
        context.shadowColor = healthColor;
        context.shadowBlur = 5;
        context.fillText(`${this.currentHealth}/${this.maxHealth}`, canvas.width / 2, barY + barHeight / 2);
        context.shadowBlur = 0;
        
        // Tank identifier (small text above bar)
        context.font = 'bold 10px "Rajdhani", monospace';
        context.fillStyle = this.isPlayer ? '#00ff41' : '#ff4444';
        context.textAlign = 'center';
        
        let tankName;
        if (this.isPlayer) {
            tankName = this.game.ui.getPlayerName() || 'PLAYER';
        } else {
            const enemyIndex = this.id.replace('enemy_', '');
            tankName = `ENEMY ${parseInt(enemyIndex) + 1}`;
        }
        
        context.fillText(tankName, canvas.width / 2, 16);
        
        // Update texture
        this.healthBarTexture.needsUpdate = true;
    }
    
    updateHealthBar(camera) {
        // Force update the visual (used when taking damage)
        this.updateHealthBarVisual();
        this.previousHealth = this.currentHealth; // Update tracking
        
        // Update health in the UI (this doesn't need camera)
        if (this.game && this.game.ui) {
            this.game.ui.updateHealth(this.id, this.currentHealth, this.maxHealth);
        }
    }
    
    createNameLabel() {
        // Get player name from game UI
        const playerName = this.game.ui.getPlayerName() || 'COMMANDER';
        
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Style the text
        context.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Semi-transparent background
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Text styling
        context.fillStyle = '#00ff41'; // Military green
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
        this.nameLabel.scale.set(4, 1, 1); // Adjust scale as needed
        this.nameLabel.position.set(0, 3.5, 0); // Position above tank
        
        // Add to tank mesh
        this.mesh.add(this.nameLabel);
    }
    
    updateNameLabel(camera) {
        if (this.nameLabel && camera) {
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
        }    }
      // FIXED elevateBarrel method with debug logging
    elevateBarrel(angleChange) {
        if (this.isDestroyed) return;
        
        const oldElevation = this.barrelElevation;
        this.barrelElevation += angleChange;
        
        let hitLimit = false;
        let limitType = '';
        
        if (this.barrelElevation < this.minBarrelElevation) {
            this.barrelElevation = this.minBarrelElevation;
            hitLimit = true;
            limitType = 'MIN';
        } else if (this.barrelElevation > this.maxBarrelElevation) {
            this.barrelElevation = this.maxBarrelElevation;
            hitLimit = true;
            limitType = 'MAX';
        }
        
        // Apply elevation to the barrel pivot - positive elevation raises barrel up
        if (this.barrelPivotRef) {
            this.barrelPivotRef.rotation.x = this.barrelElevation;
        }
        
        // Debug logging to verify elevation is being applied correctly
        if (this.isPlayer) {
            const msg = `PLAYER barrel elevation: ${(oldElevation * 180 / Math.PI).toFixed(1)}° -> ${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°, angleChange: ${(angleChange * 180 / Math.PI).toFixed(3)}°`;
            if (hitLimit) {
                console.log(`${msg} [HIT ${limitType} LIMIT]`);
            } else {
                console.log(msg);
            }
        } else {
            console.log(`AI ${this.id} barrel elevation: ${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`);
        }
    }
    
    move(direction, deltaTime) {
        if (this.isDestroyed || this.currentFuel <= 0) return;

        // Reduced fuel cost for better movement
        const fuelCost = FUEL_PER_MOVE_ACTION * deltaTime * 2; // Reduced from 5 to 2
        if (this.currentFuel < fuelCost) return;

        const moveDistance = this.moveSpeed * deltaTime;
        
        // IMPORTANT: Clone the direction to avoid modifying the original vector
        const moveVector = direction.clone().multiplyScalar(moveDistance);
        const newPosition = this.mesh.position.clone().add(moveVector);
        
        // Increased boundary check for larger map
        if (newPosition.x < -70 || newPosition.x > 70 || newPosition.z < -70 || newPosition.z > 70) {
            return; // Hit boundary
        }

        // Check collision with buildings using sphere collision for performance
        for (const building of this.game.buildings) {
            if (building.userData.isDestroyed) continue;
            
            const buildingCenter = building.position.clone();
            buildingCenter.y += 2; // Adjust for building center height
            
            const distance = newPosition.distanceTo(buildingCenter);
            const combinedRadius = this.collisionRadius + building.userData.collisionRadius;
            
            if (distance < combinedRadius) {
                return; // Collision with building - block movement
            }
        }
        
        // Check collision with trees
        const newTankCenter = newPosition.clone();
        newTankCenter.y += 0.5; // Adjust for tank center height
        
        for (const tree of this.game.trees) {
            if (tree.userData.isDestroyed) continue;
            
            const treeCenter = tree.position.clone();
            treeCenter.y += 2; // Adjust for tree center height
            
            const distance = newTankCenter.distanceTo(treeCenter);
            const combinedRadius = this.collisionRadius + tree.userData.collisionRadius;
            
            if (distance < combinedRadius) {
                return; // Collision with tree - block movement
            }
        }
        
        // Apply the movement
        this.mesh.position.add(moveVector);
        
        // Update Y position based on terrain height
        if (this.scene.userData.terrain) {
            this.mesh.position.y = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.5;
        }
        
        // Reduce fuel consumption
        this.currentFuel -= fuelCost;
        if (this.currentFuel < 0) this.currentFuel = 0;
        if (this.isPlayer) this.game.ui.updateFuel(this.currentFuel, this.maxFuel);
        
        // Debug logging for movement
        if (this.isPlayer) {
            console.log(`Player moved: ${moveVector.length().toFixed(2)} units, fuel: ${this.currentFuel.toFixed(1)}`);
        }
    }

    rotateBody(angle) {
        if (this.isDestroyed || this.currentFuel <= 0) return;
        const fuelCost = FUEL_PER_ROTATE_ACTION * Math.abs(angle) * 2; // Scale cost with rotation
        if (this.currentFuel < fuelCost && this.isPlayer) return; // AI can ignore fuel for rotation for simplicity

        this.mesh.rotation.y += angle;
        
        if(this.isPlayer){
            this.currentFuel -= fuelCost;
            if (this.currentFuel < 0) this.currentFuel = 0;
            this.game.ui.updateFuel(this.currentFuel, this.maxFuel);
        }
    }

    rotateTurret(angle) {
        if (this.isDestroyed) return;
        // Turret rotation does not consume fuel (strategic choice)
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
    }    shoot() {
        if (this.isDestroyed || this.hasFiredThisTurn) return;

        // Get the world position of the barrel tip
        const barrelTip = new THREE.Vector3(0, 0.9, 1); // Local position at barrel tip (barrel extends in +Z direction)
        this.barrel.localToWorld(barrelTip);

        // CRITICAL FIX: The issue is that we need to understand the coordinate system properly
        // The barrel cylinder by default points along Y-axis (0, 1, 0)
        // With rotation.x = -Math.PI/2, it gets rotated to point along +Z axis
        // So the barrel's local "forward" direction is (0, 1, 0) in the barrel's local space
        // This gets transformed by the barrel's world matrix to account for elevation and turret rotation
          // Make sure the barrel's world matrix is up to date
        this.barrel.updateMatrixWorld(true);        // CORRECTED: Since the barrel now uses BoxGeometry without rotation,
        // its local forward direction is naturally (0, 0, 1) along the Z-axis
        const localForward = new THREE.Vector3(0, 0, 1);// Transform the local direction to world space using the barrel's world matrix
        const barrelDirection = localForward.clone();
        barrelDirection.transformDirection(this.barrel.matrixWorld);
        
        // Normalize the direction
        barrelDirection.normalize();
          // Debug: Log the transformation details for both player and AI tanks
        const debugInfo = {
            localForward: `(${localForward.x.toFixed(3)}, ${localForward.y.toFixed(3)}, ${localForward.z.toFixed(3)})`,
            barrelElevation: `${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`,
            barrelPivotRotation: `${(this.barrelPivotRef.rotation.x * 180 / Math.PI).toFixed(1)}°`,
            transformedDirection: `(${barrelDirection.x.toFixed(3)}, ${barrelDirection.y.toFixed(3)}, ${barrelDirection.z.toFixed(3)})`
        };
        
        if (this.isPlayer) {
            console.log(`PLAYER DIRECTION DEBUG:`, debugInfo);
        } else {
            console.log(`${this.id} DIRECTION DEBUG:`, debugInfo);
        }
        // Calculate initial speed based on current power
        const powerRatio = (this.currentPower - this.minPower) / (this.maxPower - this.minPower);
        const initialSpeed = this.minProjectileSpeed + powerRatio * (this.maxProjectileSpeed - this.minProjectileSpeed);
        const initialVelocity = barrelDirection.clone().multiplyScalar(initialSpeed);
        
        // Log shooting position and details
        const tankPosition = this.mesh.position.clone();
        const tankName = this.isPlayer ? 'PLAYER' : this.id;
        
        // Calculate theoretical range for this shot
        const g = 9.81 * 2; // Same gravity as projectile
        const v0 = initialSpeed;
        const angle = this.barrelElevation;
        const theoreticalRange = (v0 * v0 * Math.sin(2 * angle)) / g;
        const maxHeight = (v0 * v0 * Math.sin(angle) * Math.sin(angle)) / (2 * g);
        const timeOfFlight = (2 * v0 * Math.sin(angle)) / g;          console.log(`${tankName} SHOOTING:`, {
            tankPosition: `(${tankPosition.x.toFixed(2)}, ${tankPosition.y.toFixed(2)}, ${tankPosition.z.toFixed(2)})`,
            barrelTip: `(${barrelTip.x.toFixed(2)}, ${barrelTip.y.toFixed(2)}, ${barrelTip.z.toFixed(2)})`,
            power: `${this.currentPower}%`,
            elevation: `${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`,
            turretRotation: `${(this.turret.rotation.y * 180 / Math.PI).toFixed(1)}°`,
            tankRotation: `${(this.mesh.rotation.y * 180 / Math.PI).toFixed(1)}°`,
            direction: `(${barrelDirection.x.toFixed(3)}, ${barrelDirection.y.toFixed(3)}, ${barrelDirection.z.toFixed(3)})`,
            velocity: `(${initialVelocity.x.toFixed(1)}, ${initialVelocity.y.toFixed(1)}, ${initialVelocity.z.toFixed(1)})`,
            initialSpeed: `${initialSpeed.toFixed(1)} m/s`,
            theoreticalRange: `${theoreticalRange.toFixed(1)} units`,
            maxHeight: `${maxHeight.toFixed(1)} units`,
            timeOfFlight: `${timeOfFlight.toFixed(2)} seconds`
        });
        
        const projectile = new Projectile(
            barrelTip,
            initialVelocity,
            this.isPlayer,
            this.scene
        );
        // Store reference to shooting tank for impact logging
        projectile.shootingTank = this;
        this.game.addProjectile(projectile);
        this.hasFiredThisTurn = true;
        if (this.isPlayer) this.game.ui.updateActionIndicator("Aim / Move (Fired)");
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
        // Get camera from game if available
        const camera = this.game && this.game.camera ? this.game.camera : null;
        this.updateHealthBar(camera);
        
        // Create damage flash effect on health bar
        if (this.healthBarSprite) {
            const originalScale = this.healthBarSprite.scale.clone();
            
            // Flash animation
            const flashDuration = 300;
            const startTime = Date.now();
            
            const animateFlash = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / flashDuration;
                
                if (progress >= 1) {
                    this.healthBarSprite.scale.copy(originalScale);
                    return;
                }
                
                // Pulse effect
                const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
                this.healthBarSprite.scale.copy(originalScale).multiplyScalar(pulse);
                
                requestAnimationFrame(animateFlash);
            };
            
            animateFlash();
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
        
        // Simple visual effect: sink into ground and fade
        let sinkSpeed = 0.5;
        let opacitySpeed = 1.0;
        const interval = setInterval(() => {
            this.mesh.position.y -= sinkSpeed * 0.05; // Adjust interval for speed
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    if (child.material.opacity <= 0) {
                         child.material.opacity = 0;
                    } else {
                        child.material.opacity -= opacitySpeed * 0.05;
                        child.material.transparent = true;
                    }
                }
            });
            if (this.mesh.position.y < -2 || (this.mesh.children[0].material && this.mesh.children[0].material.opacity <= 0)) {
                clearInterval(interval);
                this.scene.remove(this.mesh);
            }
        }, 50);
        console.log(`${this.id} destroyed!`);
    }
    
    resetTurnStats() {
        this.currentFuel = this.maxFuel;
        // Don't reset power here, player should set it per turn or it persists
        this.hasFiredThisTurn = false;
        
        if(this.isPlayer) {
            this.game.ui.updateActionIndicator("Move / Aim / Fire / Adjust Power");
            this.game.ui.updatePowerIndicator(this.currentPower, this.minPower, this.maxPower);
        }
    }
    
    adjustPower(amount) {
        if (this.isDestroyed || !this.isPlayer) return;
        this.currentPower += amount;
        if (this.currentPower < this.minPower) this.currentPower = this.minPower;
        if (this.currentPower > this.maxPower) this.currentPower = this.maxPower;
        this.game.ui.updatePowerIndicator(this.currentPower, this.minPower, this.maxPower);
    }
    
    update(deltaTime, camera) {
        // Update name label to face camera
        if (this.isPlayer && this.nameLabel && camera) {
            this.updateNameLabel(camera);
        }
        
        // Only update health bar visual if health has changed
        if (this.healthBarSprite && camera) {
            // Always make it face the camera
            this.healthBarSprite.lookAt(camera.position);
            
            // Adjust opacity based on distance to camera
            const distance = this.mesh.position.distanceTo(camera.position);
            const maxDistance = 60;
            const minDistance = 5;
            
            let opacity = 1.0;
            if (distance > maxDistance) {
                opacity = 0.2;
            } else if (distance > minDistance) {
                opacity = 1.0 - ((distance - minDistance) / (maxDistance - minDistance)) * 0.8;
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
}