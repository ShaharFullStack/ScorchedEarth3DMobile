import * as THREE from 'three';

/**
 * Particle System for Tank Hit Effects with Mobile Optimizations
 */
export class ParticleSystem {
    constructor(scene, isMobile = false) {
        this.scene = scene;
        this.isMobile = isMobile;
        this.qualityLevel = isMobile ? 'low' : 'high';
        
        // Performance tracking for mobile
        this.activeParticles = 0;
        this.maxParticles = isMobile ? 50 : 200;
        this.framesBelowTarget = 0;
        this.lastPerformanceCheck = Date.now();
        
        console.log(`Particle system initialized for ${isMobile ? 'mobile' : 'desktop'} with ${this.qualityLevel} quality`);
    }
    
    /**
     * Reduces particle quality for better mobile performance
     */
    reduceQuality() {
        if (this.qualityLevel === 'high') {
            this.qualityLevel = 'medium';
            this.maxParticles = Math.floor(this.maxParticles * 0.7);
            console.log('Particle system: Quality reduced to medium');
        } else if (this.qualityLevel === 'medium') {
            this.qualityLevel = 'low';
            this.maxParticles = Math.floor(this.maxParticles * 0.5);
            console.log('Particle system: Quality reduced to low');
        }
    }
    
    /**
     * Checks if we can spawn more particles
     */
    canSpawnParticles(count = 1) {
        return this.activeParticles + count <= this.maxParticles;
    }
    
    /**
     * Creates sparks effect when projectile hits tank
     */
    createSparks(position, intensity = 1.0) {
        if (!this.canSpawnParticles()) return;
        
        // Adjust spark count based on device and quality
        let sparkCount;
        if (this.isMobile) {
            sparkCount = Math.floor((this.qualityLevel === 'low' ? 5 : 8) * intensity);
        } else {
            sparkCount = Math.floor(15 * intensity);
        }
        
        const sparks = [];
        
        for (let i = 0; i < sparkCount && this.canSpawnParticles(); i++) {
            // Create individual spark with simpler geometry for mobile
            const sparkGeo = this.isMobile ? 
                new THREE.SphereGeometry(0.02, 3, 3) :  // Low poly for mobile
                new THREE.SphereGeometry(0.02, 4, 4);   // Standard for desktop
                
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
            
            // Spark properties (adjusted for mobile)
            const maxLife = this.isMobile ? 0.6 : 0.8 + Math.random() * 0.4;
            spark.userData = {
                velocity: direction.clone().multiplyScalar(this.isMobile ? 6 : 8 + Math.random() * 12),
                life: maxLife,
                maxLife: maxLife,
                gravity: this.isMobile ? -20 : -25
            };
            
            this.scene.add(spark);
            sparks.push(spark);
            this.activeParticles++;
        }
        
        // Animate sparks
        this.animateSparks(sparks);
    }
    
    animateSparks(sparks) {
        const updateInterval = this.isMobile ? 33 : 16; // 30fps vs 60fps
        let lastUpdate = Date.now();
        
        const updateSparks = () => {
            const now = Date.now();
            const deltaTime = Math.min((now - lastUpdate) / 1000, 0.05); // Cap delta time
            lastUpdate = now;
            
            let activeSparks = 0;
            
            sparks.forEach(spark => {
                if (!spark.parent) return; // Already removed
                
                const userData = spark.userData;
                userData.life -= deltaTime;
                
                if (userData.life <= 0) {
                    this.scene.remove(spark);
                    this.activeParticles--;
                    return;
                }
                
                activeSparks++;
                
                // Update position
                userData.velocity.y += userData.gravity * deltaTime;
                spark.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Fade out
                const lifeRatio = userData.life / userData.maxLife;
                spark.material.opacity = lifeRatio;
                
                // Color transition (simplified for mobile)
                if (!this.isMobile || this.qualityLevel !== 'low') {
                    const hue = 0.15 * lifeRatio; // Yellow to red
                    spark.material.color.setHSL(hue, 1, 0.5 * lifeRatio);
                }
                
                // Scale down
                const scale = 0.5 + lifeRatio * 0.5;
                spark.scale.setScalar(scale);
            });
            
            if (activeSparks > 0) {
                setTimeout(updateSparks, updateInterval);
            }
        };
        
        updateSparks();
    }
    
    /**
     * Creates smoke effect for tank damage
     */
    createSmoke(position, intensity = 1.0) {
        if (!this.canSpawnParticles()) return;
        
        // Adjust smoke count based on device
        let smokeCount;
        if (this.isMobile) {
            smokeCount = Math.floor((this.qualityLevel === 'low' ? 3 : 5) * intensity);
        } else {
            smokeCount = Math.floor(8 * intensity);
        }
        
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount && this.canSpawnParticles(); i++) {
            // Create smoke particle with simpler geometry for mobile
            const smokeGeo = this.isMobile ? 
                new THREE.PlaneGeometry(0.8, 0.8) :  // Smaller for mobile
                new THREE.PlaneGeometry(1, 1);       // Standard for desktop
                
            const smokeMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.2 + Math.random() * 0.3),
                transparent: true,
                opacity: this.isMobile ? 0.4 : 0.6,  // More transparent on mobile
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
            
            // Smoke properties (optimized for mobile)
            const maxLife = this.isMobile ? 1.5 : 2 + Math.random() * 1;
            smoke.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * (this.isMobile ? 2 : 3),
                    this.isMobile ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
                    (Math.random() - 0.5) * (this.isMobile ? 2 : 3)
                ),
                life: maxLife,
                maxLife: maxLife,
                rotationSpeed: (Math.random() - 0.5) * (this.isMobile ? 1 : 2),
                expansionRate: this.isMobile ? 0.3 : 0.5 + Math.random() * 0.5
            };
            
            this.scene.add(smoke);
            smokeParticles.push(smoke);
            this.activeParticles++;
        }
        
        // Animate smoke
        this.animateSmoke(smokeParticles);
    }
    
    animateSmoke(smokeParticles) {
        const updateInterval = this.isMobile ? 33 : 16;
        let lastUpdate = Date.now();
        
        const updateSmoke = () => {
            const now = Date.now();
            const deltaTime = Math.min((now - lastUpdate) / 1000, 0.05);
            lastUpdate = now;
            
            let activeSmoke = 0;
            
            smokeParticles.forEach(smoke => {
                if (!smoke.parent) return;
                
                const userData = smoke.userData;
                userData.life -= deltaTime;
                
                if (userData.life <= 0) {
                    this.scene.remove(smoke);
                    this.activeParticles--;
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
                smoke.material.opacity = (this.isMobile ? 0.4 : 0.6) * lifeRatio;
                
                // Rotate (simplified for mobile)
                if (!this.isMobile || this.qualityLevel !== 'low') {
                    smoke.rotation.z += userData.rotationSpeed * deltaTime;
                }
                
                // Make sure it faces camera approximately (desktop only for performance)
                if (!this.isMobile && this.scene.userData.camera) {
                    smoke.lookAt(this.scene.userData.camera.position);
                }
            });
            
            if (activeSmoke > 0) {
                setTimeout(updateSmoke, updateInterval);
            }
        };
        
        updateSmoke();
    }
    
    /**
     * Creates metal debris effect
     */
    createMetalDebris(position, intensity = 1.0) {
        if (!this.canSpawnParticles()) return;
        
        // Significantly reduce debris count on mobile
        let debrisCount;
        if (this.isMobile) {
            debrisCount = Math.floor((this.qualityLevel === 'low' ? 3 : 6) * intensity);
        } else {
            debrisCount = Math.floor(12 * intensity);
        }
        
        const debris = [];
        
        for (let i = 0; i < debrisCount && this.canSpawnParticles(); i++) {
            // Create debris piece with simpler geometry for mobile
            const debrisGeo = this.isMobile ?
                new THREE.BoxGeometry(0.1, 0.05, 0.1) :  // Fixed size for mobile
                new THREE.BoxGeometry(
                    0.1 + Math.random() * 0.2,
                    0.05 + Math.random() * 0.1,
                    0.1 + Math.random() * 0.2
                );
            
            const debrisMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.4 + Math.random() * 0.3),
                metalness: this.isMobile ? 0.5 : 0.8,  // Reduced metalness for mobile performance
                roughness: this.isMobile ? 0.5 : 0.3
            });
            
            const debrisPiece = new THREE.Mesh(debrisGeo, debrisMat);
            debrisPiece.position.copy(position);
            debrisPiece.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 1,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 1
            ));
            
            // Debris properties (optimized for mobile)
            const maxLife = this.isMobile ? 2 : 3 + Math.random() * 2;
            debrisPiece.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * (this.isMobile ? 6 : 10),
                    Math.random() * (this.isMobile ? 5 : 8) + 2,
                    (Math.random() - 0.5) * (this.isMobile ? 6 : 10)
                ),
                angularVelocity: this.isMobile ? 
                    new THREE.Vector3(0, 0, (Math.random() - 0.5) * 5) :  // Only Z rotation for mobile
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10
                    ),
                life: maxLife,
                gravity: this.isMobile ? -10 : -15,
                bounce: 0.3,
                grounded: false
            };
            
            debrisPiece.castShadow = !this.isMobile; // No shadows on mobile
            this.scene.add(debrisPiece);
            debris.push(debrisPiece);
            this.activeParticles++;
        }
        
        // Animate debris
        this.animateDebris(debris);
    }
    
    animateDebris(debris) {
        const updateInterval = this.isMobile ? 33 : 16;
        let lastUpdate = Date.now();
        
        const updateDebris = () => {
            const now = Date.now();
            const deltaTime = Math.min((now - lastUpdate) / 1000, 0.05);
            lastUpdate = now;
            
            let activeDebris = 0;
            
            debris.forEach(piece => {
                if (!piece.parent) return;
                
                const userData = piece.userData;
                userData.life -= deltaTime;
                
                if (userData.life <= 0) {
                    this.scene.remove(piece);
                    this.activeParticles--;
                    return;
                }
                
                activeDebris++;
                
                // Apply gravity
                if (!userData.grounded) {
                    userData.velocity.y += userData.gravity * deltaTime;
                }
                
                // Update position
                piece.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
                
                // Update rotation (simplified for mobile)
                if (this.isMobile) {
                    piece.rotation.z += userData.angularVelocity.z * deltaTime;
                } else {
                    piece.rotation.x += userData.angularVelocity.x * deltaTime;
                    piece.rotation.y += userData.angularVelocity.y * deltaTime;
                    piece.rotation.z += userData.angularVelocity.z * deltaTime;
                }
                
                // Ground collision (simplified)
                if (piece.position.y <= 0.1 && userData.velocity.y < 0) {
                    piece.position.y = 0.1;
                    userData.velocity.y = -userData.velocity.y * userData.bounce;
                    userData.velocity.x *= 0.8; // Friction
                    userData.velocity.z *= 0.8;
                    
                    if (this.isMobile) {
                        userData.angularVelocity.z *= 0.7;
                    } else {
                        userData.angularVelocity.multiplyScalar(0.7);
                    }
                    
                    if (Math.abs(userData.velocity.y) < 1) {
                        userData.grounded = true;
                        userData.velocity.y = 0;
                    }
                }
                
                // Fade out in last portion of life
                const fadeThreshold = this.isMobile ? 0.5 : 1;
                if (userData.life < fadeThreshold) {
                    piece.material.transparent = true;
                    piece.material.opacity = userData.life / fadeThreshold;
                }
            });
            
            if (activeDebris > 0) {
                setTimeout(updateDebris, updateInterval);
            }
        };
        
        updateDebris();
    }
    
    /**
     * Creates complete tank hit effect combining multiple particle types
     */
    createTankHitEffect(position, intensity = 1.0) {
        // Adjust intensity based on device capabilities
        const adjustedIntensity = this.isMobile ? intensity * 0.6 : intensity;
        
        // Stagger effects for more realistic impact (with shorter delays on mobile)
        this.createSparks(position, adjustedIntensity);
        
        const debrisDelay = this.isMobile ? 25 : 50;
        setTimeout(() => {
            this.createMetalDebris(position, adjustedIntensity * 0.8);
        }, debrisDelay);
        
        const smokeDelay = this.isMobile ? 50 : 100;
        setTimeout(() => {
            this.createSmoke(position, adjustedIntensity * 0.6);
        }, smokeDelay);
        
        // Main explosion flash
        this.createExplosionFlash(position, adjustedIntensity);
    }
    
    /**
     * Creates bright explosion flash
     */
    createExplosionFlash(position, intensity = 1.0) {
        if (!this.canSpawnParticles()) return;
        
        // Simpler flash geometry for mobile
        const flashSize = (this.isMobile ? 1.2 : 1.5) * intensity;
        const flashSegments = this.isMobile ? 6 : 8;
        const flashGeo = new THREE.SphereGeometry(flashSize, flashSegments, flashSegments);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffaa44,
            transparent: true,
            opacity: this.isMobile ? 0.7 : 0.9,
            depthWrite: false
        });
        
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);
        this.activeParticles++;
        
        // Animate flash (shorter duration on mobile)
        const maxLife = this.isMobile ? 0.2 : 0.3;
        let life = maxLife;
        
        const updateFlash = () => {
            life -= this.isMobile ? 0.02 : 0.016;
            
            if (life <= 0) {
                this.scene.remove(flash);
                this.activeParticles--;
                return;
            }
            
            const lifeRatio = life / maxLife;
            flash.material.opacity = lifeRatio * (this.isMobile ? 0.7 : 0.9);
            flash.scale.setScalar(1 + (1 - lifeRatio) * 2);
            
            // Color transition from white-yellow to orange-red (simplified for mobile)
            if (!this.isMobile || this.qualityLevel !== 'low') {
                const hue = 0.15 - (1 - lifeRatio) * 0.1;
                flash.material.color.setHSL(hue, 1, 0.7);
            }
            
            setTimeout(updateFlash, this.isMobile ? 20 : 16);
        };
        
        updateFlash();
    }
    
    /**
     * Creates a simplified explosion effect for mobile
     */
    createSimpleExplosion(position, intensity = 1.0) {
        if (!this.canSpawnParticles(3)) return;
        
        // Very simple explosion for low-end mobile devices
        const flashGeo = new THREE.SphereGeometry(intensity, 4, 4);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8
        });
        
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);
        this.activeParticles++;
        
        // Simple fade out
        let opacity = 0.8;
        const fadeOut = () => {
            opacity -= 0.05;
            if (opacity <= 0) {
                this.scene.remove(flash);
                this.activeParticles--;
                return;
            }
            flash.material.opacity = opacity;
            flash.scale.setScalar(1 + (0.8 - opacity) * 3);
            setTimeout(fadeOut, 33);
        };
        
        fadeOut();
    }
    
    /**
     * Monitor performance and adjust quality automatically
     */
    monitorPerformance(fps) {
        if (!this.isMobile) return;
        
        const now = Date.now();
        if (now - this.lastPerformanceCheck < 2000) return; // Check every 2 seconds
        
        if (fps < 25) {
            this.framesBelowTarget++;
            if (this.framesBelowTarget >= 3) {
                this.reduceQuality();
                this.framesBelowTarget = 0;
            }
        } else {
            this.framesBelowTarget = 0;
        }
        
        this.lastPerformanceCheck = now;
    }
    
    /**
     * Clean up all particles (useful for scene transitions)
     */
    cleanup() {
        // Find and remove all active particles
        const objectsToRemove = [];
        this.scene.traverse((object) => {
            if (object.userData && (
                object.userData.velocity || 
                object.userData.life !== undefined ||
                object.userData.isParticle
            )) {
                objectsToRemove.push(object);
            }
        });
        
        objectsToRemove.forEach(object => {
            this.scene.remove(object);
        });
        
        this.activeParticles = 0;
        console.log('Particle system: Cleaned up all particles');
    }
    
    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            isMobile: this.isMobile,
            qualityLevel: this.qualityLevel,
            activeParticles: this.activeParticles,
            maxParticles: this.maxParticles,
            framesBelowTarget: this.framesBelowTarget
        };
    }
}