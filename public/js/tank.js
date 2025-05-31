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
        this.turretGroup = new THREE.Group();
        this.barrelGroup = new THREE.Group();
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
        this.collisionRadius = 0.75; // For simple sphere collision - reduced for smaller tanks
        
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
        
        this.createAdvancedTank(color);
        this.mesh.position.copy(initialPosition);
        // Adjust initial Y position based on terrain
        if (this.scene.userData.terrain) {
            this.mesh.position.y = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.25; // 0.25 is smaller tank half-height approx.
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
    }    createAdvancedTank(color) {
        // Create main hull
        this.createHull(color);
        
        // Create track system
        this.createTracks();
        
        // Create turret
        this.createTurret(color);
        
        // Create barrel
        this.createBarrel();
        
        // Create additional details
        this.createDetails();
        
        // Add turret and barrel to main group
        this.mesh.add(this.turretGroup);
        this.turretGroup.add(this.barrelGroup);
        
        // Create health bar for all tanks
        this.createHealthBar();
    }
      createHull(color) {
        // Main hull body - smaller, more realistic proportions
        const hullGeometry = new THREE.BoxGeometry(1.75, 0.6, 3);
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.7,
            roughness: 0.3
        });
        
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        hull.position.y = 0.3;
        hull.castShadow = true;
        hull.receiveShadow = true;
        this.mesh.add(hull);
        
        // Hull front slope
        const frontSlopeGeometry = new THREE.BoxGeometry(1.75, 0.4, 0.75);
        const frontSlope = new THREE.Mesh(frontSlopeGeometry, hullMaterial);
        frontSlope.position.set(0, 0.5, 1.625);
        frontSlope.rotation.x = -Math.PI / 6;
        frontSlope.castShadow = true;
        this.mesh.add(frontSlope);
        
        // Hull rear slope
        const rearSlopeGeometry = new THREE.BoxGeometry(1.75, 0.3, 0.5);
        const rearSlope = new THREE.Mesh(rearSlopeGeometry, hullMaterial);
        rearSlope.position.set(0, 0.4, -1.5);
        rearSlope.rotation.x = Math.PI / 8;
        rearSlope.castShadow = true;
        this.mesh.add(rearSlope);
          // Side armor plates
        for (let side of [-1, 1]) {
            const sideArmorGeometry = new THREE.BoxGeometry(0.15, 0.5, 2.75);
            const sideArmor = new THREE.Mesh(sideArmorGeometry, hullMaterial);
            sideArmor.position.set(side * 0.95, 0.3, 0);
            sideArmor.castShadow = true;
            this.mesh.add(sideArmor);
        }
    }
    
    createTracks() {
        // Track assemblies on both sides
        for (let side of [-1, 1]) {
            const trackGroup = new THREE.Group();
              // Track base
            const trackGeometry = new THREE.BoxGeometry(0.4, 0.3, 3.25);
            const trackMaterial = new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                metalness: 0.9,
                roughness: 0.8
            });
            
            const track = new THREE.Mesh(trackGeometry, trackMaterial);
            track.position.set(side * 1.075, 0.15, 0);
            track.castShadow = true;
            trackGroup.add(track);
            
            // Road wheels (5 wheels per side - scaled down)
            for (let i = 0; i < 5; i++) {
                const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 12);
                const wheelMaterial = new THREE.MeshStandardMaterial({
                    color: 0x333333,
                    metalness: 0.8,
                    roughness: 0.2
                });
                
                const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                wheel.position.set(side * 1.075, 0.15, -1.2 + i * 0.6);
                wheel.rotation.z = Math.PI / 2;
                wheel.castShadow = true;
                trackGroup.add(wheel);
                
                // Wheel details
                const hubGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.175, 8);
                const hubMaterial = new THREE.MeshStandardMaterial({
                    color: 0x666666,
                    metalness: 0.9,
                    roughness: 0.1
                });
                
                const hub = new THREE.Mesh(hubGeometry, hubMaterial);
                hub.position.copy(wheel.position);
                hub.rotation.z = Math.PI / 2;
                trackGroup.add(hub);
            }
              // Drive sprocket (front)
            const sprocketGeometry = new THREE.CylinderGeometry(0.225, 0.225, 0.2, 8);
            const sprocketMaterial = new THREE.MeshStandardMaterial({
                color: 0x444444,
                metalness: 0.8,
                roughness: 0.3
            });
            
            const sprocket = new THREE.Mesh(sprocketGeometry, sprocketMaterial);
            sprocket.position.set(side * 1.075, 0.15, 1.6);
            sprocket.rotation.z = Math.PI / 2;
            sprocket.castShadow = true;
            trackGroup.add(sprocket);
              // Idler wheel (rear)
            const idler = new THREE.Mesh(sprocketGeometry, sprocketMaterial);
            idler.position.set(side * 1.075, 0.15, -1.6);
            idler.rotation.z = Math.PI / 2;
            idler.castShadow = true;
            trackGroup.add(idler);
            
            this.mesh.add(trackGroup);
        }
    }
      createTurret(color) {
        // Main turret body
        const turretGeometry = new THREE.BoxGeometry(1.25, 0.6, 1.25);
        const turretMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).offsetHSL(0, 0, -0.1),
            metalness: 0.8,
            roughness: 0.2
        });
        
        const turret = new THREE.Mesh(turretGeometry, turretMaterial);
        turret.position.set(0, 0.9, -0.15);
        turret.castShadow = true;
        this.turretGroup.add(turret);
        
        // Turret front armor
        const frontArmorGeometry = new THREE.BoxGeometry(1.25, 0.5, 0.4);
        const frontArmor = new THREE.Mesh(frontArmorGeometry, turretMaterial);
        frontArmor.position.set(0, 0.9, 0.4);
        frontArmor.rotation.x = -Math.PI / 12;
        frontArmor.castShadow = true;
        this.turretGroup.add(frontArmor);
        
        // Turret sides
        for (let side of [-1, 1]) {
            const sideArmorGeometry = new THREE.BoxGeometry(0.2, 0.5, 1.1);
            const sideArmor = new THREE.Mesh(sideArmorGeometry, turretMaterial);
            sideArmor.position.set(side * 0.725, 0.9, -0.1);
            sideArmor.castShadow = true;
            this.turretGroup.add(sideArmor);
        }
          // Commander's cupola
        const cupolaGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12);
        const cupola = new THREE.Mesh(cupolaGeometry, turretMaterial);
        cupola.position.set(-0.4, 1.25, -0.4);
        cupola.castShadow = true;
        this.turretGroup.add(cupola);
        
        // Position turret group
        this.turretGroup.position.set(0, 0, 0);
    }
    
    createBarrel() {        // Main gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.06, 0.075, 2.25, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            metalness: 0.9,
            roughness: 0.1
        });
        
        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.position.set(0, 0.9, 1.25);
        this.barrel.rotation.x = Math.PI / 2;
        this.barrel.castShadow = true;
        this.barrelGroup.add(this.barrel);
        
        // Barrel muzzle brake
        const muzzleBrakeGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8);
        const muzzleBrake = new THREE.Mesh(muzzleBrakeGeometry, barrelMaterial);
        muzzleBrake.position.set(0, 0.9, 2.25);
        muzzleBrake.rotation.x = Math.PI / 2;
        muzzleBrake.castShadow = true;
        this.barrelGroup.add(muzzleBrake);          // Mantlet (gun shield)
        const mantletGeometry = new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const mantletMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444, // Use a standard color since color parameter isn't available here
            metalness: 0.8,
            roughness: 0.3
        });
        
        const mantlet = new THREE.Mesh(mantletGeometry, mantletMaterial);
        mantlet.position.set(0, 0.9, 0.6);
        mantlet.castShadow = true;
        this.barrelGroup.add(mantlet);
        
        // Position barrel group
        this.barrelGroup.position.set(0, 0, 0);
          // Apply the initial barrel elevation that was set in constructor
        this.barrelGroup.rotation.x = -this.barrelElevation;
    }
      createDetails() {
        // Antenna
        const antennaGeometry = new THREE.CylinderGeometry(0.01, 0.01, 1, 8);
        const antennaMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0.6, 1.75, -0.75);
        antenna.rotation.z = Math.PI / 8;
        this.mesh.add(antenna);
        
        // External fuel tanks
        for (let i = 0; i < 2; i++) {
            const tankGeometry = new THREE.CylinderGeometry(0.125, 0.125, 0.75, 12);
            const tankMaterial = new THREE.MeshStandardMaterial({
                color: 0x3a3a3a,
                metalness: 0.6,
                roughness: 0.4
            });
            
            const fuelTank = new THREE.Mesh(tankGeometry, tankMaterial);
            fuelTank.position.set(0.9, 0.6, -1 + i * 0.4);
            fuelTank.rotation.z = Math.PI / 2;
            fuelTank.castShadow = true;
            this.mesh.add(fuelTank);
        }
        
        // Headlights
        for (let side of [-1, 1]) {
            const lightGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12);
            const lightMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffcc,
                emissive: 0x333300,
                metalness: 0.1,
                roughness: 0.1
            });            
            const headlight = new THREE.Mesh(lightGeometry, lightMaterial);
            headlight.position.set(side * 0.6, 0.75, 1.9);
            headlight.rotation.x = Math.PI / 2;
            this.mesh.add(headlight);
        }
        
        // Tool attachments on hull
        const toolGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.75);
        const toolMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            metalness: 0.1,
            roughness: 0.8
        });
        
        const tool = new THREE.Mesh(toolGeometry, toolMaterial);
        tool.position.set(-0.9, 0.65, 0.5);
        tool.rotation.y = Math.PI / 4;
        this.mesh.add(tool);
        
        // Spare track links
        for (let i = 0; i < 3; i++) {
            const linkGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.2);
            const linkMaterial = new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                metalness: 0.9,
                roughness: 0.8
            });
            
            const link = new THREE.Mesh(linkGeometry, linkMaterial);
            link.position.set(0.8, 0.7, -0.75 + i * 0.25);
            this.mesh.add(link);
        }
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
        }    }      // FIXED elevateBarrel method with debug logging for new barrel group structure
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
          // Apply elevation to the barrel group - negative elevation raises barrel up (Three.js coordinate system)
        if (this.barrelGroup) {
            this.barrelGroup.rotation.x = -this.barrelElevation;
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
        }        // Apply the movement
        this.mesh.position.add(moveVector);
        
        // Update Y position based on terrain height
        if (this.scene.userData.terrain) {
            this.mesh.position.y = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.25;
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
    }    rotateTurret(angle) {
        if (this.isDestroyed) return;
        // Turret rotation does not consume fuel (strategic choice)
        this.turretGroup.rotation.y += angle;
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
        this.turretGroup.rotation.y = angleToTarget;
    }    shoot() {
        if (this.isDestroyed || this.hasFiredThisTurn) return;

        // Get the world position of the barrel tip
        // Since the barrel is a cylinder rotated 90 degrees on X axis, we need to account for this
        const barrelTip = new THREE.Vector3(0, 0, 1.125); // Local position at barrel tip in rotated cylinder coordinates (half of 2.25)
        this.barrel.localToWorld(barrelTip);

        // Make sure the barrel's world matrix is up to date
        this.barrel.updateMatrixWorld(true);
          // For the rotated cylinder barrel, the forward direction in local space is (0, 1, 0) before rotation
        // After rotation by 90 degrees around X axis, it becomes (0, 0, 1)
        const localForward = new THREE.Vector3(0, 1, 0);
        
        // Transform the local direction to world space using the barrel's world matrix
        const barrelDirection = localForward.clone();
        barrelDirection.transformDirection(this.barrel.matrixWorld);
        
        // Normalize the direction
        barrelDirection.normalize();
        
        // Debug: Log the transformation details for both player and AI tanks
        const debugInfo = {
            localForward: `(${localForward.x.toFixed(3)}, ${localForward.y.toFixed(3)}, ${localForward.z.toFixed(3)})`,
            barrelElevation: `${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`,
            barrelGroupRotation: `${(this.barrelGroup.rotation.x * 180 / Math.PI).toFixed(1)}°`,
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
        const timeOfFlight = (2 * v0 * Math.sin(angle)) / g;
        
        console.log(`${tankName} SHOOTING:`, {
            tankPosition: `(${tankPosition.x.toFixed(2)}, ${tankPosition.y.toFixed(2)}, ${tankPosition.z.toFixed(2)})`,
            barrelTip: `(${barrelTip.x.toFixed(2)}, ${barrelTip.y.toFixed(2)}, ${barrelTip.z.toFixed(2)})`,
            power: `${this.currentPower}%`,
            elevation: `${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`,
            turretRotation: `${(this.turretGroup.rotation.y * 180 / Math.PI).toFixed(1)}°`,
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
        
        // Play shooting sound effect
        if (this.game.audioManager) {
            this.game.audioManager.playSound('shoot');
        }
        
        if (this.isPlayer) this.game.ui.updateActionIndicator("Aim / Move (Fired)");
    }
      takeDamage(amount) {
        if (this.isDestroyed) return;
        
        const oldHealth = this.currentHealth;
        this.currentHealth -= amount;
        
        console.log(`Tank ${this.id}: Taking ${amount} damage. Health: ${oldHealth} -> ${this.currentHealth}`);
        
        // Play tank hit sound effect
        if (this.game.audioManager) {
            this.game.audioManager.playSound('tankHit');
        }
        
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.isDestroyed = true;
            
            // Play explosion sound for destroyed tank
            if (this.game.audioManager) {
                this.game.audioManager.playSound('explosion');
            }
            
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
            this.game.ui.updateActionIndicator("Move/Aim/Fire");
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