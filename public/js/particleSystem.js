import * as THREE from 'three';

/**
 * Particle System for Tank Hit Effects
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
    }
    
    /**
     * Creates sparks effect when projectile hits tank
     */
    createSparks(position, intensity = 1.0) {
        const sparkCount = Math.floor(15 * intensity);
        const sparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            // Create individual spark
            const sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);
            const sparkMat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color().setHSL(0.1 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.5),
                transparent: true,
                opacity: 1
            });
            
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.position.copy(position);
            
            // Random spark direction
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5 + 0.5,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            // Spark properties
            spark.userData = {
                velocity: direction.clone().multiplyScalar(8 + Math.random() * 12),
                life: 0.8 + Math.random() * 0.4,
                maxLife: 0.8 + Math.random() * 0.4,
                gravity: -25
            };
            
            this.scene.add(spark);
            sparks.push(spark);
        }
        
        // Animate sparks
        this.animateSparks(sparks);
    }
    
    animateSparks(sparks) {
        const startTime = Date.now();
        
        const updateSparks = () => {
            const deltaTime = 0.016; // ~60fps
            let activeSparks = 0;
            
            sparks.forEach(spark => {
                if (!spark.parent) return; // Already removed
                
                const userData = spark.userData;
                userData.life -= deltaTime;
                
                if (userData.life <= 0) {
                    this.scene.remove(spark);
                    return;
                }
                
                activeSparks++;
                
                // Update position
                userData.velocity.y += userData.gravity * deltaTime;
                spark.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Fade out
                const lifeRatio = userData.life / userData.maxLife;
                spark.material.opacity = lifeRatio;
                
                // Color transition (yellow to red to dark)
                const hue = 0.15 * lifeRatio; // Yellow to red
                spark.material.color.setHSL(hue, 1, 0.5 * lifeRatio);
                
                // Scale down
                const scale = 0.5 + lifeRatio * 0.5;
                spark.scale.setScalar(scale);
            });
            
            if (activeSparks > 0) {
                requestAnimationFrame(updateSparks);
            }
        };
        
        updateSparks();
    }
    
    /**
     * Creates smoke effect for tank damage
     */
    createSmoke(position, intensity = 1.0) {
        const smokeCount = Math.floor(8 * intensity);
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            // Create smoke particle
            const smokeGeo = new THREE.PlaneGeometry(1, 1);
            const smokeMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.2 + Math.random() * 0.3),
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            
            const smoke = new THREE.Mesh(smokeGeo, smokeMat);
            smoke.position.copy(position);
            smoke.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 2
            ));
            
            // Smoke properties
            smoke.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    2 + Math.random() * 3,
                    (Math.random() - 0.5) * 3
                ),
                life: 2 + Math.random() * 1,
                maxLife: 2 + Math.random() * 1,
                rotationSpeed: (Math.random() - 0.5) * 2,
                expansionRate: 0.5 + Math.random() * 0.5
            };
            
            this.scene.add(smoke);
            smokeParticles.push(smoke);
        }
        
        // Animate smoke
        this.animateSmoke(smokeParticles);
    }
    
    animateSmoke(smokeParticles) {
        const updateSmoke = () => {
            const deltaTime = 0.016;
            let activeSmoke = 0;
            
            smokeParticles.forEach(smoke => {
                if (!smoke.parent) return;
                
                const userData = smoke.userData;
                userData.life -= deltaTime;
                
                if (userData.life <= 0) {
                    this.scene.remove(smoke);
                    return;
                }
                
                activeSmoke++;
                
                // Update position
                smoke.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Expand and slow down
                const lifeRatio = userData.life / userData.maxLife;
                userData.velocity.multiplyScalar(0.98); // Gradual slowdown
                
                // Expand size
                const scale = (1 - lifeRatio) * userData.expansionRate + 0.5;
                smoke.scale.setScalar(scale);
                
                // Fade out
                smoke.material.opacity = 0.6 * lifeRatio;
                
                // Rotate
                smoke.rotation.z += userData.rotationSpeed * deltaTime;
                
                // Make sure it faces camera approximately
                if (this.scene.userData.camera) {
                    smoke.lookAt(this.scene.userData.camera.position);
                }
            });
            
            if (activeSmoke > 0) {
                requestAnimationFrame(updateSmoke);
            }
        };
        
        updateSmoke();
    }
    
    /**
     * Creates metal debris effect
     */
    createMetalDebris(position, intensity = 1.0) {
        const debrisCount = Math.floor(12 * intensity);
        const debris = [];
        
        for (let i = 0; i < debrisCount; i++) {
            // Create debris piece
            const debrisGeo = new THREE.BoxGeometry(
                0.1 + Math.random() * 0.2,
                0.05 + Math.random() * 0.1,
                0.1 + Math.random() * 0.2
            );
            
            const debrisMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.4 + Math.random() * 0.3),
                metalness: 0.8,
                roughness: 0.3
            });
            
            const debrisPiece = new THREE.Mesh(debrisGeo, debrisMat);
            debrisPiece.position.copy(position);
            debrisPiece.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 1,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 1
            ));
            
            // Debris properties
            debrisPiece.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    Math.random() * 8 + 2,
                    (Math.random() - 0.5) * 10
                ),
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                life: 3 + Math.random() * 2,
                gravity: -15,
                bounce: 0.3,
                grounded: false
            };
            
            debrisPiece.castShadow = true;
            this.scene.add(debrisPiece);
            debris.push(debrisPiece);
        }
        
        // Animate debris
        this.animateDebris(debris);
    }
    
    animateDebris(debris) {
        const updateDebris = () => {
            const deltaTime = 0.016;
            let activeDebris = 0;
            
            debris.forEach(piece => {
                if (!piece.parent) return;
                
                const userData = piece.userData;
                userData.life -= deltaTime;
                
                if (userData.life <= 0) {
                    this.scene.remove(piece);
                    return;
                }
                
                activeDebris++;
                
                // Apply gravity
                if (!userData.grounded) {
                    userData.velocity.y += userData.gravity * deltaTime;
                }
                
                // Update position
                piece.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Update rotation
                piece.rotation.x += userData.angularVelocity.x * deltaTime;
                piece.rotation.y += userData.angularVelocity.y * deltaTime;
                piece.rotation.z += userData.angularVelocity.z * deltaTime;
                
                // Ground collision (simplified)
                if (piece.position.y <= 0.1 && userData.velocity.y < 0) {
                    piece.position.y = 0.1;
                    userData.velocity.y = -userData.velocity.y * userData.bounce;
                    userData.velocity.x *= 0.8; // Friction
                    userData.velocity.z *= 0.8;
                    userData.angularVelocity.multiplyScalar(0.7);
                    
                    if (Math.abs(userData.velocity.y) < 1) {
                        userData.grounded = true;
                        userData.velocity.y = 0;
                    }
                }
                
                // Fade out in last second
                if (userData.life < 1) {
                    piece.material.transparent = true;
                    piece.material.opacity = userData.life;
                }
            });
            
            if (activeDebris > 0) {
                requestAnimationFrame(updateDebris);
            }
        };
        
        updateDebris();
    }
    
    /**
     * Creates complete tank hit effect combining multiple particle types
     */
    createTankHitEffect(position, intensity = 1.0) {
        // Stagger effects for more realistic impact
        this.createSparks(position, intensity);
        
        setTimeout(() => {
            this.createMetalDebris(position, intensity * 0.8);
        }, 50);
        
        setTimeout(() => {
            this.createSmoke(position, intensity * 0.6);
        }, 100);
        
        // Main explosion flash
        this.createExplosionFlash(position, intensity);
    }
    
    /**
     * Creates bright explosion flash
     */
    createExplosionFlash(position, intensity = 1.0) {
        const flashGeo = new THREE.SphereGeometry(1.5 * intensity, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // Animate flash
        let life = 0.3;
        const maxLife = 0.3;
        
        const updateFlash = () => {
            life -= 0.016;
            
            if (life <= 0) {
                this.scene.remove(flash);
                return;
            }
            
            const lifeRatio = life / maxLife;
            flash.material.opacity = lifeRatio * 0.9;
            flash.scale.setScalar(1 + (1 - lifeRatio) * 2);
            
            // Color transition from white-yellow to orange-red
            const hue = 0.15 - (1 - lifeRatio) * 0.1;
            flash.material.color.setHSL(hue, 1, 0.7);
            
            requestAnimationFrame(updateFlash);
        };
        
        updateFlash();
    }
}