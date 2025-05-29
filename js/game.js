import * as THREE from 'three';
import { Tank } from './tank.js';
import { Projectile } from './projectile.js';
import { generateTrees, generateBuildings } from './sceneSetup.js';
import { ParticleSystem } from './particleSystem.js';

const PLAYER_ID = 'player';
const ENEMY_ID_PREFIX = 'enemy_';

// Difficulty configurations
const DIFFICULTY_SETTINGS = {
    beginner: {
        name: "New Player",
        aiReactionTime: 2000,
        aimAccuracy: 0.3,
        strategicThinking: 0.2,
        aggressiveness: 0.3,
        fuelEfficiency: 0.6,
        coverUsage: 0.3,
        playerHealthBonus: 50,
        playerFuelBonus: 50
    },
    professional: {
        name: "Professional",
        aiReactionTime: 1200,
        aimAccuracy: 0.7,
        strategicThinking: 0.6,
        aggressiveness: 0.6,
        fuelEfficiency: 0.8,
        coverUsage: 0.7,
        playerHealthBonus: 0,
        playerFuelBonus: 0
    },
    veteran: {
        name: "Veteran",
        aiReactionTime: 600,
        aimAccuracy: 0.95,
        strategicThinking: 0.9,
        aggressiveness: 0.8,
        fuelEfficiency: 0.95,
        coverUsage: 0.9,
        playerHealthBonus: -25,
        playerFuelBonus: -25
    }
};

export class Game {
    constructor(scene, camera, renderer, ui) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.ui = ui;

        this.playerTank = null;
        this.enemyTanks = [];
        this.projectiles = [];
        this.buildings = [];
        this.trees = [];

        this.currentPlayerIndex = -1;
        this.activeTank = null;
        this.cameraController = null;
        this.difficulty = 'professional'; // Default difficulty
        this.difficultyConfig = DIFFICULTY_SETTINGS.professional;

        this.gameState = 'DIFFICULTY_SELECTION';

        // Initialize particle system
        this.particleSystem = new ParticleSystem(this.scene);

        this.inputStates = {
            moveForward: false,
            moveBackward: false,
            rotateLeft: false,
            rotateRight: false,
            turretLeft: false,
            turretRight: false,
            fire: false,
            increasePower: false,
            decreasePower: false,
            barrelUp: false,
            barrelDown: false
        };
        
        this.setupInputListeners();
        this.ui.endTurnButton.addEventListener('click', () => this.endPlayerTurn());
        this.ui.onDifficultyChange = (difficulty) => this.setDifficulty(difficulty);
        this.setupControlsInfo();
    }

    setCameraController(controller) {
        this.cameraController = controller;
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.difficultyConfig = DIFFICULTY_SETTINGS[difficulty];
        console.log(`Difficulty set to: ${this.difficultyConfig.name}`);
        this.startGameInitialization();
    }

    async startGameInitialization() {
        this.gameState = 'INITIALIZING';
        await this.initGame();
        this.startGame();
    }

    async initGame() {
        // Clear existing entities
        this.buildings = [];
        this.trees = [];
        this.enemyTanks = [];
        this.projectiles = [];

        // Generate buildings first
        this.buildings = generateBuildings(this.scene, [], 15);
        
        // Generate trees after buildings
        this.trees = generateTrees(this.scene, this.buildings, 30);
        
        const terrainSize = this.scene.userData.terrain ? this.scene.userData.terrain.size : 150;
        const padding = 25;
        const minTankDistance = 12;
        const minTankBuildingDistance = 8;
        const minTankTreeDistance = 6;
        const occupiedPositions = [];
        
        const tankCollisionRadius = 1.5;
        
        const getRandomPosition = () => {
            let position;
            let tooClose;
            let attempts = 0;
            do {
                tooClose = false;
                const x = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
                const z = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
                position = new THREE.Vector3(x, 0, z);
                
                // Check against other tanks
                for (const occupied of occupiedPositions) {
                    if (position.distanceTo(occupied) < minTankDistance) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) {
                    attempts++;
                    continue;
                }
                
                // Check against buildings
                for (const building of this.buildings) {
                    const buildingDistance = position.distanceTo(building.position);
                    const requiredDistance = building.userData.collisionRadius + tankCollisionRadius + minTankBuildingDistance;
                    if (buildingDistance < requiredDistance) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) {
                    attempts++;
                    continue;
                }
                
                // Check against trees
                for (const tree of this.trees) {
                    const treeDistance = position.distanceTo(tree.position);
                    const requiredDistance = tree.userData.collisionRadius + tankCollisionRadius + minTankTreeDistance;
                    if (treeDistance < requiredDistance) {
                        tooClose = true;
                        break;
                    }
                }
                
                attempts++;
            } while (tooClose && attempts < 200);
            
            if (attempts >= 200) {
                console.warn("Could not find a sufficiently spaced random position for a tank after 200 attempts.");
            }
            
            occupiedPositions.push(position.clone());
            return position;
        };
        
        // Create player tank with difficulty bonuses
        const playerInitialPosition = getRandomPosition();
        this.playerTank = new Tank(PLAYER_ID, true, this.scene, playerInitialPosition, 0x00ff00, this);
        
        // Apply difficulty modifiers to player
        const originalPlayerHealth = this.playerTank.currentHealth;
        this.playerTank.maxHealth += this.difficultyConfig.playerHealthBonus;
        
        // Only reset health if it's at full health (initial state)
        if (originalPlayerHealth === this.playerTank.maxHealth - this.difficultyConfig.playerHealthBonus) {
            this.playerTank.currentHealth = this.playerTank.maxHealth;
        } else {
            // Health was already modified, adjust proportionally
            const healthRatio = originalPlayerHealth / (this.playerTank.maxHealth - this.difficultyConfig.playerHealthBonus);
            this.playerTank.currentHealth = Math.floor(this.playerTank.maxHealth * healthRatio);
        }
        
        this.playerTank.maxFuel += this.difficultyConfig.playerFuelBonus;
        this.playerTank.currentFuel = this.playerTank.maxFuel;
        
        // Update health bar after applying bonuses
        if (this.camera) {
            this.playerTank.updateHealthBar(this.camera);
        }
        
        this.scene.add(this.playerTank.mesh);
        
        // Create enemy tanks
        const numEnemies = 3;
        for (let i = 0; i < numEnemies; i++) {
            const enemyInitialPosition = getRandomPosition();
            const enemy = new Tank(ENEMY_ID_PREFIX + i, false, this.scene, enemyInitialPosition, 0xff0000, this);
            
            // Set AI difficulty properties
            enemy.aiDifficulty = this.difficultyConfig;
            enemy.lastKnownPlayerPosition = null;
            enemy.strategicState = 'seeking'; // seeking, engaging, retreating, flanking
            enemy.coverPosition = null;
            enemy.turnsSinceLastShot = 0;
            
            this.enemyTanks.push(enemy);
            this.scene.add(enemy.mesh);
        }
    }

    startGame() {
        this.gameState = 'PLAYER_TURN';
        this.currentPlayerIndex = -1;
        this.activeTank = this.playerTank;
        this.activeTank.resetTurnStats();
        const playerName = this.ui.getPlayerName() || 'Player';
        this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - ${playerName}'s Turn`);
        this.ui.updateFuel(this.activeTank.currentFuel, this.activeTank.maxFuel);
        this.ui.updateHealth(this.activeTank.id, this.activeTank.currentHealth, this.activeTank.maxHealth);
        this.ui.toggleEndTurnButton(true);
        this.ui.updateActionIndicator("Move / Aim / Fire / Adjust Power");
        this.ui.updatePowerIndicator(this.playerTank.currentPower, this.playerTank.minPower, this.playerTank.maxPower);
    }
    
    nextTurn() {
        this.activeTank.hasFiredThisTurn = false;

        if (this.gameState === 'GAME_OVER') return;

        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.enemyTanks.length) {
            this.currentPlayerIndex = -1;
        }

        if (this.currentPlayerIndex === -1) {
            this.activeTank = this.playerTank;
            if (this.activeTank.isDestroyed) {
                this.gameOver(false);
                return;
            }
            this.gameState = 'PLAYER_TURN';
            this.activeTank.resetTurnStats();
            this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - Player's Turn`);
            this.ui.toggleEndTurnButton(true);
        } else {
            this.activeTank = this.enemyTanks[this.currentPlayerIndex];
            if (this.activeTank.isDestroyed) {
                this.nextTurn();
                return;
            }
            this.gameState = 'ENEMY_TURN';
            this.activeTank.resetTurnStats();
            this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - Enemy ${this.currentPlayerIndex + 1}'s Turn`);
            this.ui.updateActionIndicator("Enemy is analyzing battlefield...");
            this.ui.toggleEndTurnButton(false);
            
            // AI reaction time based on difficulty
            setTimeout(() => this.executeEnemyTurn(this.activeTank), this.difficultyConfig.aiReactionTime);
        }
        this.ui.updateFuel(this.activeTank.currentFuel, this.activeTank.maxFuel);
        this.ui.updateHealth(this.activeTank.id, this.activeTank.currentHealth, this.activeTank.maxHealth);
    }

    executeEnemyTurn(enemy) {
        if (enemy.isDestroyed || this.gameState === 'GAME_OVER') {
            this.nextTurn();
            return;
        }

        console.log(`${this.difficultyConfig.name} AI: Enemy ${enemy.id} executing turn`);

        const playerPos = this.playerTank.mesh.position.clone();
        const enemyPos = enemy.mesh.position.clone();
        const distanceToPlayer = enemyPos.distanceTo(playerPos);
        
        // Update AI knowledge
        enemy.lastKnownPlayerPosition = playerPos.clone();
        enemy.turnsSinceLastShot++;
        
        // Advanced AI decision making
        const aiDecision = this.makeAIDecision(enemy, playerPos, distanceToPlayer);
        
        this.ui.updateActionIndicator(`Enemy is ${aiDecision.action}...`);
        
        // Execute AI decision
        this.executeAIDecision(enemy, aiDecision);
        
        // End turn with appropriate delay
        const turnDelay = Math.max(800, 2000 - (this.difficultyConfig.strategicThinking * 1200));
        setTimeout(() => this.nextTurn(), turnDelay);
    }

    // Fixed AI decision making - make enemies more aggressive
    makeAIDecision(enemy, playerPos, distanceToPlayer) {
        const config = enemy.aiDifficulty;
        const enemyPos = enemy.mesh.position.clone();
        
        // Assess current situation
        const lineOfSight = this.hasLineOfSight(enemyPos, playerPos);
        const inCover = this.isInCover(enemyPos);
        const playerInRange = distanceToPlayer <= 60; // Increased range
        const hasAmmo = !enemy.hasFiredThisTurn;
        const lowHealth = enemy.currentHealth < enemy.maxHealth * 0.4;
        const lowFuel = enemy.currentFuel < enemy.maxFuel * 0.3;
        
        // Strategic decision matrix based on difficulty
        let decision = { action: 'thinking', priority: 0 };
        
        // HIGH PRIORITY: Shoot if opportunity exists (more aggressive)
        if (hasAmmo && playerInRange && decision.priority < 9) {
            // Much more lenient shooting conditions
            const canAttemptShot = lineOfSight || (distanceToPlayer < 30);
            
            if (canAttemptShot) {
                // Base accuracy on difficulty rather than complex calculations
                const baseAccuracy = Math.max(0.3, config.aimAccuracy * 0.8);
                decision = {
                    action: 'engaging target',
                    type: 'shoot',
                    accuracy: baseAccuracy,
                    priority: 9
                };
            }
        }
        
        // Emergency retreat if low health (lower priority than shooting)
        if (lowHealth && config.strategicThinking > 0.5 && decision.priority < 8) {
            const coverPosition = this.findBestCover(enemyPos, playerPos);
            if (coverPosition && !inCover) {
                decision = {
                    action: 'retreating to cover',
                    type: 'move',
                    target: coverPosition,
                    priority: 8
                };
            }
        }
        
        // Medium priority: Tactical positioning
        if (config.strategicThinking > 0.6 && decision.priority < 7) {
            if (!inCover && config.coverUsage > Math.random()) {
                const coverPosition = this.findBestCover(enemyPos, playerPos);
                if (coverPosition) {
                    decision = {
                        action: 'seeking tactical position',
                        type: 'move',
                        target: coverPosition,
                        priority: 7
                    };
                }
            } else if (distanceToPlayer > 40 && !lineOfSight) {
                // Move to better position for line of sight
                const flankPosition = this.findFlankingPosition(enemyPos, playerPos);
                if (flankPosition) {
                    decision = {
                        action: 'flanking target',
                        type: 'move',
                        target: flankPosition,
                        priority: 6
                    };
                }
            }
        }
        
        // Low priority: Basic movement
        if (decision.priority < 5) {
            const idealDistance = 25; // Preferred engagement distance
            if (distanceToPlayer > idealDistance + 15) {
                decision = {
                    action: 'advancing on target',
                    type: 'move',
                    target: this.getPositionTowards(enemyPos, playerPos, idealDistance),
                    priority: 4
                };
            } else if (distanceToPlayer < idealDistance - 5) {
                decision = {
                    action: 'maintaining distance',
                    type: 'move',
                    target: this.getPositionAway(enemyPos, playerPos, idealDistance),
                    priority: 3
                };
            }
        }
        
        // Fallback: Wait and aim
        if (decision.priority < 3) {
            decision = {
                action: 'aiming',
                type: 'aim',
                priority: 1
            };
        }
        
        return decision;
    }

    executeAIDecision(enemy, decision) {
        const config = enemy.aiDifficulty;
        
        switch (decision.type) {
            case 'shoot':
                this.executeAIShoot(enemy, decision.accuracy);
                break;
                
            case 'move':
                this.executeAIMove(enemy, decision.target);
                break;
                
            case 'aim':
                this.executeAIAim(enemy);
                break;
        }
    }

    executeAIShoot(enemy, baseAccuracy) {
        const playerPos = this.playerTank.mesh.position.clone();
        const enemyPos = enemy.mesh.position.clone();
        
        // Aim at target horizontally
        enemy.aimTowards(playerPos);
        
        // Calculate proper ballistics
        const distance = enemyPos.distanceTo(playerPos);
        const heightDiff = playerPos.y - enemyPos.y;
        
        // Physics-based elevation calculation
        const optimalElevation = this.calculatePhysicsBasedElevation(distance, heightDiff, enemy);
        
        // Apply accuracy scatter based on difficulty
        const accuracyFactor = baseAccuracy;
        const maxScatter = (1 - accuracyFactor) * 0.2; // Max 20% scatter
        
        // Add scatter to elevation
        const elevationScatter = (Math.random() - 0.5) * maxScatter;
        const finalElevation = optimalElevation + elevationScatter;
        
        // Set barrel elevation
        const targetElevation = Math.max(
            enemy.minBarrelElevation, 
            Math.min(enemy.maxBarrelElevation, finalElevation)
        );
        
        const elevationDifference = targetElevation - enemy.barrelElevation;
        enemy.elevateBarrel(elevationDifference);
        
        // Calculate optimal power for the distance
        const optimalPower = this.calculateOptimalPower(distance, targetElevation, enemy);
        enemy.currentPower = Math.max(enemy.minPower, Math.min(enemy.maxPower, optimalPower));
        
        // Add horizontal scatter for turret aiming
        if (accuracyFactor < 1.0) {
            const horizontalScatter = (Math.random() - 0.5) * maxScatter * 0.5;
            enemy.rotateTurret(horizontalScatter);
        }
        
        // Shoot
        enemy.shoot();
        enemy.turnsSinceLastShot = 0;
        
        console.log(`AI ${enemy.id}: Distance ${distance.toFixed(1)}m, Elevation ${(targetElevation * 180 / Math.PI).toFixed(1)}°, Power ${enemy.currentPower.toFixed(1)}, Accuracy ${(accuracyFactor * 100).toFixed(1)}%`);
    }

    // Physics-based ballistics calculation
    calculatePhysicsBasedElevation(distance, heightDiff, tank) {
        // Use actual projectile physics to calculate required angle
        const g = 9.81 * 2; // Same gravity as projectile
        const v0 = this.calculateProjectileSpeed(tank.currentPower || 50, tank); // Initial velocity
        
        // For projectile motion: range = (v0² * sin(2θ)) / g
        // Solving for angle with height difference
        
        const horizontalDistance = Math.sqrt(Math.max(0, distance * distance - heightDiff * heightDiff));
        
        // Try to solve the ballistics equation
        // For simplicity, use approximation that works well for tank ranges
        const discriminant = Math.pow(v0, 4) - g * (g * horizontalDistance * horizontalDistance + 2 * heightDiff * v0 * v0);
        
        if (discriminant < 0) {
            // Target out of range, use maximum practical angle
            return Math.PI / 4; // 45 degrees
        }
        
        // Calculate the two possible angles (high and low trajectory)
        const angle1 = Math.atan((v0 * v0 + Math.sqrt(discriminant)) / (g * horizontalDistance));
        const angle2 = Math.atan((v0 * v0 - Math.sqrt(discriminant)) / (g * horizontalDistance));
        
        // Prefer the lower trajectory for direct fire
        const preferredAngle = Math.min(angle1, angle2);
        
        // Ensure angle is within tank limitations
        return Math.max(-Math.PI / 12, Math.min(Math.PI / 3, preferredAngle));
    }

    // Calculate projectile speed based on power (should match tank.js logic)
    calculateProjectileSpeed(power, tank) {
        const powerRatio = (power - tank.minPower) / (tank.maxPower - tank.minPower);
        return tank.minProjectileSpeed + powerRatio * (tank.maxProjectileSpeed - tank.minProjectileSpeed);
    }

    // Calculate optimal power for given distance and elevation
    calculateOptimalPower(distance, elevation, tank) {
        // Work backwards from desired range to required initial velocity
        const g = 9.81 * 2;
        const horizontalDistance = distance * Math.cos(Math.atan2(0, distance)); // Approximate
        
        // Required velocity for this range at this angle
        const requiredV0Squared = (g * horizontalDistance) / Math.sin(2 * elevation);
        const requiredV0 = Math.sqrt(Math.max(0, requiredV0Squared));
        
        // Convert velocity back to power setting
        const powerRatio = (requiredV0 - tank.minProjectileSpeed) / (tank.maxProjectileSpeed - tank.minProjectileSpeed);
        const calculatedPower = tank.minPower + powerRatio * (tank.maxPower - tank.minPower);
        
        // Add some extra power for safety margin
        return Math.min(tank.maxPower, calculatedPower * 1.2);
    }

    executeAIMove(enemy, targetPosition) {
        if (!targetPosition || enemy.currentFuel <= 0) return;
        
        const enemyPos = enemy.mesh.position.clone();
        const direction = targetPosition.clone().sub(enemyPos).normalize();
        const moveDistance = Math.min(
            enemy.currentFuel / 20, // Conservative fuel usage
            enemyPos.distanceTo(targetPosition)
        );
        
        // Move towards target
        const fuelEfficiency = enemy.aiDifficulty.fuelEfficiency;
        const actualMoveDistance = moveDistance * fuelEfficiency;
        
        for (let i = 0; i < 5 && enemy.currentFuel > 0; i++) {
            enemy.move(direction, actualMoveDistance / 5);
        }
    }

    executeAIAim(enemy) {
        const playerPos = this.playerTank.mesh.position.clone();
        enemy.aimTowards(playerPos);
        
        // Calculate proper barrel elevation
        const distance = enemy.mesh.position.distanceTo(playerPos);
        const heightDiff = playerPos.y - enemy.mesh.position.y;
        const optimalElevation = this.calculatePhysicsBasedElevation(distance, heightDiff, enemy);
        
        // Apply elevation more directly for aiming
        const targetElevation = Math.max(
            enemy.minBarrelElevation,
            Math.min(enemy.maxBarrelElevation, optimalElevation)
        );
        
        // Smooth elevation adjustment towards target
        const elevationDiff = targetElevation - enemy.barrelElevation;
        const elevationStep = Math.sign(elevationDiff) * Math.min(Math.abs(elevationDiff), enemy.barrelElevateSpeed * 0.2);
        enemy.elevateBarrel(elevationStep);
    }

    // AI Helper Functions
    hasLineOfSight(fromPos, toPos) {
        const direction = toPos.clone().sub(fromPos).normalize();
        const distance = fromPos.distanceTo(toPos);
        
        const raycaster = new THREE.Raycaster(fromPos, direction, 0, distance);
        const obstacles = [
            ...this.buildings.filter(b => !b.userData.isDestroyed),
            ...this.trees.filter(t => !t.userData.isDestroyed)
        ];
        
        const intersects = raycaster.intersectObjects(obstacles, true);
        return intersects.length === 0;
    }

    isInCover(position) {
        const coverDistance = 3;
        for (const building of this.buildings) {
            if (building.userData.isDestroyed) continue;
            if (position.distanceTo(building.position) < coverDistance) {
                return true;
            }
        }
        return false;
    }

    findBestCover(fromPos, threatPos) {
        let bestCover = null;
        let bestScore = 0;
        
        for (const building of this.buildings) {
            if (building.userData.isDestroyed) continue;
            
            const coverPos = building.position.clone();
            const distanceToThreat = coverPos.distanceTo(threatPos);
            const distanceToSelf = coverPos.distanceTo(fromPos);
            
            // Score based on: close to self, far from threat, between self and threat
            const score = (distanceToThreat / 10) - (distanceToSelf / 20);
            
            if (score > bestScore && distanceToSelf > 3) {
                bestScore = score;
                bestCover = coverPos;
            }
        }
        
        return bestCover;
    }

    findFlankingPosition(fromPos, targetPos) {
        const perpendicular = new THREE.Vector3(
            -(targetPos.z - fromPos.z),
            0,
            targetPos.x - fromPos.x
        ).normalize();
        
        // Try both flanking directions
        const flankDistance = 15;
        const leftFlank = fromPos.clone().add(perpendicular.clone().multiplyScalar(flankDistance));
        const rightFlank = fromPos.clone().add(perpendicular.clone().multiplyScalar(-flankDistance));
        
        // Choose the flank with better line of sight
        if (this.hasLineOfSight(leftFlank, targetPos)) {
            return leftFlank;
        } else if (this.hasLineOfSight(rightFlank, targetPos)) {
            return rightFlank;
        }
        
        return null;
    }

    getPositionTowards(fromPos, targetPos, desiredDistance) {
        const direction = targetPos.clone().sub(fromPos).normalize();
        return fromPos.clone().add(direction.multiplyScalar(desiredDistance * 0.3));
    }

    getPositionAway(fromPos, targetPos, desiredDistance) {
        const direction = fromPos.clone().sub(targetPos).normalize();
        return fromPos.clone().add(direction.multiplyScalar(desiredDistance * 0.2));
    }

    // Legacy method kept for compatibility (used in executeAIAim)
    calculateOptimalElevation(distance, heightDiff) {
        // For relatively flat terrain and typical combat ranges
        if (Math.abs(heightDiff) < 3) {
            // Distance-based elevation for flat shots - more realistic for tank combat
            if (distance < 10) return 0;                     // ~0° for very close targets
            if (distance < 20) return Math.PI / 36;          // ~5° for close targets
            if (distance < 30) return Math.PI / 18;          // ~10° for medium targets  
            if (distance < 40) return Math.PI / 12;          // ~15° for far targets
            if (distance < 50) return Math.PI / 9;           // ~20° for very far targets
            return Math.PI / 6;                              // ~30° for maximum range
        }
        
        // For targets with height differences
        const horizontalDistance = Math.sqrt(Math.max(0, distance * distance - heightDiff * heightDiff));
        
        // Base elevation for height difference
        let baseElevation = Math.atan2(heightDiff, Math.max(horizontalDistance, 1));
        
        // Add additional elevation for projectile arc based on distance
        const arcAdjustment = (horizontalDistance / 60) * (Math.PI / 12); // Gradual arc increase
        
        const calculatedElevation = baseElevation + arcAdjustment;
        
        // Clamp to reasonable tank firing angles
        return Math.max(-Math.PI / 24, Math.min(Math.PI / 4, calculatedElevation));
    }

    // Fixed accuracy calculation - less harsh penalties
    calculateShootingAccuracy(enemy, targetPos, distance) {
        let accuracy = 0.9; // Start higher
        
        // Gentler distance penalty
        accuracy -= Math.min(0.2, distance / 200); // Less harsh penalty
        
        // Smaller movement penalty
        if (enemy.currentFuel < enemy.maxFuel * 0.8) {
            accuracy -= 0.05; // Reduced penalty
        }
        
        // Line of sight bonus
        if (this.hasLineOfSight(enemy.mesh.position, targetPos)) {
            accuracy += 0.1;
        }
        
        // Close range bonus
        if (distance < 20) {
            accuracy += 0.15;
        }
        
        return Math.max(0.3, Math.min(1, accuracy)); // Minimum 30% accuracy
    }

    endPlayerTurn() {
        if (this.gameState === 'PLAYER_TURN') {
            this.nextTurn();
        }
    }

    update(deltaTime) {
        if (this.gameState === 'GAME_OVER' || this.gameState === 'DIFFICULTY_SELECTION') return;

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime);
            if (p.shouldBeRemoved) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            } else {
                this.checkProjectileCollision(p);
            }
        }

        if (this.gameState === 'PLAYER_TURN' && this.activeTank === this.playerTank && !this.playerTank.isDestroyed) {
            this.handlePlayerInput(deltaTime);
            this.ui.updateFuel(this.playerTank.currentFuel, this.playerTank.maxFuel);
        }
        
        // Update all tanks
        this.playerTank.update(deltaTime, this.camera);
        this.enemyTanks.forEach(enemy => enemy.update(deltaTime, this.camera));

        // Check for game over conditions
        if (this.playerTank.isDestroyed) {
            this.gameOver(false);
        } else if (this.enemyTanks.every(enemy => enemy.isDestroyed)) {
            this.gameOver(true);
        }
    }

    handlePlayerInput(deltaTime) {
        if (this.playerTank.isDestroyed) return;

        // Movement input handling
        if (this.inputStates.moveForward) {
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(this.playerTank.mesh.quaternion);
            this.playerTank.move(forward, deltaTime);
        }
        if (this.inputStates.moveBackward) {
            const backward = new THREE.Vector3(0, 0, 1);
            backward.applyQuaternion(this.playerTank.mesh.quaternion);
            this.playerTank.move(backward, deltaTime);
        }
        if (this.inputStates.rotateLeft) this.playerTank.rotateBody(this.playerTank.rotateSpeed * deltaTime);
        if (this.inputStates.rotateRight) this.playerTank.rotateBody(-this.playerTank.rotateSpeed * deltaTime);
        if (this.inputStates.turretLeft) this.playerTank.rotateTurret(this.playerTank.turretRotateSpeed * deltaTime);
        if (this.inputStates.turretRight) this.playerTank.rotateTurret(-this.playerTank.turretRotateSpeed * deltaTime);
        
        if (this.inputStates.fire) {
            this.playerTank.shoot();
            this.inputStates.fire = false;
        }
        if (this.inputStates.increasePower) {
            this.playerTank.adjustPower(this.playerTank.powerIncrement);
        }
        if (this.inputStates.decreasePower) {
            this.playerTank.adjustPower(-this.playerTank.powerIncrement);
        }
        if (this.inputStates.barrelUp) {
            this.playerTank.elevateBarrel(this.playerTank.barrelElevateSpeed * deltaTime);
        }
        if (this.inputStates.barrelDown) {
            this.playerTank.elevateBarrel(-this.playerTank.barrelElevateSpeed * deltaTime);
        }
    }
    
    addProjectile(projectile) {
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
    }

    checkProjectileCollision(projectile) {
        const targets = projectile.firedByPlayer ? this.enemyTanks : [this.playerTank];
        
        // Check tank collisions
        for (const tank of targets) {
            if (tank.isDestroyed) continue;

            const distance = projectile.mesh.position.distanceTo(tank.mesh.position);
            if (distance < tank.collisionRadius + projectile.collisionRadius) {
                // Create spectacular tank hit effect
                const hitPosition = projectile.mesh.position.clone();
                hitPosition.y = tank.mesh.position.y + 0.8; // Adjust height to tank center
                
                // Determine hit intensity based on damage and tank health
                const healthPercentage = tank.currentHealth / tank.maxHealth;
                const hitIntensity = 1.2 - (healthPercentage * 0.5); // More intense when tank is more damaged
                
                // Create particle effects
                this.particleSystem.createTankHitEffect(hitPosition, hitIntensity);
                
                // Apply damage
                tank.takeDamage(projectile.damage);
                this.ui.updateHealth(tank.id, tank.currentHealth, tank.maxHealth);
                projectile.shouldBeRemoved = true;
                
                // Additional effects for destroyed tanks
                if (tank.isDestroyed) {
                    // Bigger explosion for destroyed tank
                    setTimeout(() => {
                        this.particleSystem.createTankHitEffect(hitPosition, hitIntensity * 1.5);
                    }, 200);
                    
                    // Screen shake effect (if camera controller exists)
                    if (this.cameraController) {
                        this.createCameraShake(0.3, 1000);
                    }
                }

                return; 
            }
        }

        // Check building collisions
        for (const building of this.buildings) {
            if (building.userData.isDestroyed) continue;
            
            const distance = projectile.mesh.position.distanceTo(building.position);
            if (distance < building.userData.collisionRadius + projectile.collisionRadius) {
                // Building hit effects
                const hitPosition = projectile.mesh.position.clone();
                this.particleSystem.createSmoke(hitPosition, 0.8);
                this.particleSystem.createMetalDebris(hitPosition, 0.6);
                
                this.damageBuilding(building, projectile);
                projectile.shouldBeRemoved = true;
                return;
            }
        }

        // Check tree collisions
        for (const tree of this.trees) {
            if (tree.userData.isDestroyed) continue;
            
            const distance = projectile.mesh.position.distanceTo(tree.position);
            if (distance < tree.userData.collisionRadius + projectile.collisionRadius) {
                // Tree hit effects (simpler)
                const hitPosition = projectile.mesh.position.clone();
                this.particleSystem.createSmoke(hitPosition, 0.3);
                
                this.destroyTree(tree, projectile);
                projectile.shouldBeRemoved = true;
                return;
            }
        }
        
        // Check collision with terrain
        const terrainHeightAtImpact = this.scene.userData.terrain.getHeightAt(
            projectile.mesh.position.x, 
            projectile.mesh.position.z
        );
        if (projectile.mesh.position.y <= terrainHeightAtImpact + projectile.collisionRadius) {
            projectile.shouldBeRemoved = true;
            const craterDepth = 1.5;
            this.scene.userData.terrain.deformTerrain(projectile.mesh.position, 4, Math.abs(craterDepth));
            
            // Ground impact effects
            const hitPosition = projectile.mesh.position.clone();
            hitPosition.y = terrainHeightAtImpact + 0.2;
            
            // Create ground impact particles
            this.particleSystem.createSmoke(hitPosition, 0.5);
            this.particleSystem.createMetalDebris(hitPosition, 0.3);
            
            const dust = new THREE.Mesh(
                new THREE.SphereGeometry(1.5, 12, 12),
                new THREE.MeshStandardMaterial({ 
                    color: 0x964B00,
                    transparent: true, 
                    opacity: 0.6,
                    roughness: 0.8
                })
            );
            dust.position.copy(hitPosition);
            this.scene.add(dust);
            setTimeout(() => this.scene.remove(dust), 500);
            return;
        }
    }
    
    /**
     * Creates camera shake effect for dramatic impacts
     */
    createCameraShake(intensity, duration) {
        if (!this.cameraController || !this.camera) return;
        
        const originalPosition = this.camera.position.clone();
        const startTime = Date.now();
        
        const shakeCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                // Reset camera position
                this.camera.position.copy(originalPosition);
                return;
            }
            
            // Apply diminishing shake
            const currentIntensity = intensity * (1 - progress);
            const shakeX = (Math.random() - 0.5) * currentIntensity;
            const shakeY = (Math.random() - 0.5) * currentIntensity;
            const shakeZ = (Math.random() - 0.5) * currentIntensity;
            
            this.camera.position.copy(originalPosition);
            this.camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
            
            requestAnimationFrame(shakeCamera);
        };
        
        shakeCamera();
    }
    
    // Building and Tree destruction methods (keeping existing implementation)
    damageBuilding(building, projectile) {
        if (building.userData.isDestroyed) return;
        
        building.userData.health -= projectile.damage;
        
        const impact = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 })
        );
        impact.position.copy(projectile.mesh.position);
        this.scene.add(impact);
        setTimeout(() => this.scene.remove(impact), 400);
        
        this.createBuildingDebris(projectile.mesh.position, 5);
        
        if (building.userData.health <= 0) {
            this.destroyBuilding(building);
        }
    }
    
    destroyBuilding(building) {
        if (building.userData.isDestroyed) return;
        
        building.userData.isDestroyed = true;
        building.userData.health = 0;
        
        this.createBuildingDebris(building.position, 15);
        
        const collapseDuration = 3000;
        const startTime = Date.now();
        const originalScale = building.scale.clone();
        
        const animateCollapse = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / collapseDuration, 1);
            
            const scale = THREE.MathUtils.lerp(1, 0.1, progress);
            building.scale.set(scale, scale, scale);
            building.position.y = building.userData.originalPosition ? 
                building.userData.originalPosition.y - (progress * 2) : 
                building.position.y - (progress * 0.1);
            
            if (progress < 1) {
                requestAnimationFrame(animateCollapse);
            } else {
                this.scene.remove(building);
                const index = this.buildings.indexOf(building);
                if (index > -1) {
                    this.buildings.splice(index, 1);
                }
            }
        };
        
        animateCollapse();
    }
    
    createBuildingDebris(position, count = 8) {
        for (let i = 0; i < count; i++) {
            const debrisGeo = new THREE.BoxGeometry(
                Math.random() * 0.5 + 0.2,
                Math.random() * 0.8 + 0.3,
                Math.random() * 0.5 + 0.2
            );
            const debrisMat = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.4),
                roughness: 0.9
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);
            
            debris.position.set(
                position.x + (Math.random() - 0.5) * 6,
                position.y + Math.random() * 3,
                position.z + (Math.random() - 0.5) * 6
            );
            
            debris.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            debris.castShadow = true;
            this.scene.add(debris);
            
            setTimeout(() => this.scene.remove(debris), 15000);
        }
    }
    
    destroyTree(tree, projectile) {
        if (tree.userData.isDestroyed) return;
        
        tree.userData.isDestroyed = true;
        tree.userData.health = 0;
        
        const impactDirection = projectile.velocity.clone().normalize();
        impactDirection.y = 0;
        
        this.createTreeDebris(tree.position, 8);
        
        const fallDuration = 2000;
        const fallAngle = Math.PI / 2;
        const startTime = Date.now();
        const originalRotation = tree.rotation.clone();
        
        const animateFall = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fallDuration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            const fallAxis = Math.abs(impactDirection.x) > Math.abs(impactDirection.z) ? 'z' : 'x';
            const fallDirection = fallAxis === 'z' ? Math.sign(impactDirection.x) : Math.sign(impactDirection.z);
            
            if (fallAxis === 'z') {
                tree.rotation.z = originalRotation.z + (fallAngle * fallDirection * easedProgress);
            } else {
                tree.rotation.x = originalRotation.x + (fallAngle * fallDirection * easedProgress);
            }
            
            tree.position.y = tree.userData.originalPosition.y - (easedProgress * 0.5);
            
            if (progress < 1) {
                requestAnimationFrame(animateFall);
            } else {
                setTimeout(() => this.fadeOutTree(tree), 3000);
            }
        };
        
        animateFall();
        
        const crashEffect = new THREE.Mesh(
            new THREE.SphereGeometry(2, 8, 8),
            new THREE.MeshBasicMaterial({ 
                color: 0x8B4513, 
                transparent: true, 
                opacity: 0.6 
            })
        );
        crashEffect.position.copy(tree.position);
        this.scene.add(crashEffect);
        setTimeout(() => this.scene.remove(crashEffect), 800);
    }
    
    /**
     * Simulates physics for debris pieces
     */
    simulateDebrisPhysics(debrisGroup) {
        const startTime = Date.now();
        const maxSimulationTime = 10000; // 10 seconds of physics simulation
        
        const animateDebris = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > maxSimulationTime || !debrisGroup.parent) {
                return; // Stop simulation
            }
            
            const deltaTime = 0.016; // ~60fps
            
            debrisGroup.userData.debrisPieces.forEach(debris => {
                if (!debris.parent) return;
                
                const velocity = debris.userData.velocity;
                const angularVel = debris.userData.angularVelocity;
                
                // Apply gravity
                velocity.y += debris.userData.gravity * deltaTime;
                
                // Update position
                debris.position.add(velocity.clone().multiplyScalar(deltaTime));
                
                // Update rotation
                debris.rotation.x += angularVel.x * deltaTime;
                debris.rotation.y += angularVel.y * deltaTime;
                debris.rotation.z += angularVel.z * deltaTime;
                
                // Get terrain height at current position
                const terrainHeight = this.scene.userData.terrain.getHeightAt(
                    debris.position.x, 
                    debris.position.z
                );
                
                // Ground collision
                if (debris.position.y <= terrainHeight + 0.1) {
                    debris.position.y = terrainHeight + 0.1;
                    
                    // Bounce
                    if (velocity.y < 0) {
                        velocity.y = -velocity.y * debris.userData.bounce;
                        
                        // Apply horizontal friction
                        velocity.x *= debris.userData.friction;
                        velocity.z *= debris.userData.friction;
                        
                        // Reduce angular velocity on bounce
                        angularVel.multiplyScalar(0.7);
                        
                        // Stop bouncing if velocity is too low
                        if (Math.abs(velocity.y) < 1) {
                            velocity.y = 0;
                            velocity.x *= 0.9;
                            velocity.z *= 0.9;
                        }
                    }
                }
                
                // Fade out debris over time
                if (elapsed > 8000) { // Start fading after 8 seconds
                    const fadeProgress = (elapsed - 8000) / 2000; // 2 seconds fade
                    debris.material.opacity = Math.max(0, 1 - fadeProgress);
                    debris.material.transparent = true;
                }
            });
            
            requestAnimationFrame(animateDebris);
        };
        
        animateDebris();
    }
    
    createTreeDebris(position, count = 6) {
        const debrisGroup = new THREE.Group();
        debrisGroup.userData.debrisPieces = [];
        
        for (let i = 0; i < count; i++) {
            const debrisGeo = new THREE.BoxGeometry(
                Math.random() * 0.3 + 0.1,
                Math.random() * 0.5 + 0.2,
                Math.random() * 0.3 + 0.1
            );
            const debrisMat = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.9
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);
            
            // Initial position with some spread
            debris.position.set(
                position.x + (Math.random() - 0.5) * 4,
                position.y + Math.random() * 2 + 1, // Start higher
                position.z + (Math.random() - 0.5) * 4
            );
            
            // Random initial rotation
            debris.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            debris.castShadow = true;
            debrisGroup.add(debris);
            
            // Add physics properties (lighter than building debris)
            debris.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 6, // Horizontal velocity
                Math.random() * 3 + 2,     // Upward velocity
                (Math.random() - 0.5) * 6  // Horizontal velocity
            );
            debris.userData.angularVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            debris.userData.gravity = -12; // Slightly less gravity (wood is lighter)
            debris.userData.bounce = 0.4;  // More bounce
            debris.userData.friction = 0.7; // Less friction
            
            debrisGroup.userData.debrisPieces.push(debris);
        }
        
        this.scene.add(debrisGroup);
        
        // Start physics simulation
        this.simulateDebrisPhysics(debrisGroup);
        
        // Remove after time
        setTimeout(() => {
            if (debrisGroup.parent) {
                this.scene.remove(debrisGroup);
            }
        }, 10000);
    }
    
    fadeOutTree(tree) {
        const fadeDuration = 3000;
        const startTime = Date.now();
        
        const fadeAnimation = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fadeDuration, 1);
            const opacity = 1 - progress;
            
            tree.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = opacity;
                }
            });
            
            if (progress < 1) {
                requestAnimationFrame(fadeAnimation);
            } else {
                this.scene.remove(tree);
                const index = this.trees.indexOf(tree);
                if (index > -1) {
                    this.trees.splice(index, 1);
                }
            }
        };
        
        fadeAnimation();
    }
    
    gameOver(playerWon) {
        if (this.gameState === 'GAME_OVER') return;
        this.gameState = 'GAME_OVER';
        const difficultyText = this.difficultyConfig.name;
        const message = playerWon ? 
            `Victory on ${difficultyText} Difficulty!\nAll Enemies Destroyed!` : 
            `Defeat on ${difficultyText} Difficulty!\nYour Tank Was Destroyed!`;
        this.ui.showGameOverMessage(message);
        this.ui.toggleEndTurnButton(false);
    }

    setupInputListeners() {
        document.addEventListener('keydown', (event) => {
            if (this.gameState !== 'PLAYER_TURN') return;
            switch(event.code) {
                case 'KeyW': this.inputStates.moveForward = true; break;
                case 'KeyS': this.inputStates.moveBackward = true; break;
                case 'KeyA': this.inputStates.rotateLeft = true; break;
                case 'KeyD': this.inputStates.rotateRight = true; break;
                case 'KeyQ': this.inputStates.turretLeft = true; break;
                case 'KeyE': this.inputStates.turretRight = true; break;
                case 'Space': if (!this.playerTank.hasFiredThisTurn) this.inputStates.fire = true; break;
                case 'ArrowUp': this.inputStates.increasePower = true; break;
                case 'ArrowDown': this.inputStates.decreasePower = true; break;
                case 'ArrowRight': this.inputStates.barrelUp = true; break;
                case 'ArrowLeft': this.inputStates.barrelDown = true; break;
                case 'KeyH': this.toggleControlsInfo(); break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW': this.inputStates.moveForward = false; break;
                case 'KeyS': this.inputStates.moveBackward = false; break;
                case 'KeyA': this.inputStates.rotateLeft = false; break;
                case 'KeyD': this.inputStates.rotateRight = false; break;
                case 'KeyQ': this.inputStates.turretLeft = false; break;
                case 'KeyE': this.inputStates.turretRight = false; break;
                case 'ArrowUp': this.inputStates.increasePower = false; break;
                case 'ArrowDown': this.inputStates.decreasePower = false; break;
                case 'ArrowRight': this.inputStates.barrelUp = false; break;
                case 'ArrowLeft': this.inputStates.barrelDown = false; break;
            }
        });
    }

    setupControlsInfo() {
        setTimeout(() => {
            this.hideControlsInfo();
        }, 10000);
    }

    toggleControlsInfo() {
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo.classList.contains('hidden')) {
            this.showControlsInfo();
        } else {
            this.hideControlsInfo();
        }
    }

    hideControlsInfo() {
        const controlsInfo = document.getElementById('controls-info');
        controlsInfo.classList.add('hidden');
    }

    showControlsInfo() {
        const controlsInfo = document.getElementById('controls-info');
        controlsInfo.classList.remove('hidden');
    }
}