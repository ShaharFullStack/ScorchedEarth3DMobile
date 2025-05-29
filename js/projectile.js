import * as THREE from 'three';

const GRAVITY = 9.81 * 2; // Slightly exaggerated gravity for game feel

export class Projectile {
    constructor(startPosition, initialVelocity, firedByPlayer, scene, isMobile = false) {
        this.scene = scene;
        this.firedByPlayer = firedByPlayer;
        this.isMobile = isMobile;
        
        // Create projectile geometry with mobile optimizations
        const projectileGeometry = this.isMobile ? 
            new THREE.SphereGeometry(0.3, 6, 6) :  // Lower poly for mobile
            new THREE.SphereGeometry(0.3, 8, 8);   // Higher poly for desktop
            
        // Simpler materials for mobile
        const materialConfig = {
            color: firedByPlayer ? 0x00ffff : 0xff8800
        };
        
        // Add material enhancements only on desktop
        if (!this.isMobile) {
            materialConfig.emissive = firedByPlayer ? 0x002222 : 0x221100;
            materialConfig.emissiveIntensity = 0.3;
        }
        
        const projectileMat = new THREE.MeshBasicMaterial(materialConfig);
        this.mesh = new THREE.Mesh(projectileGeometry, projectileMat);
        this.mesh.position.copy(startPosition);
        
        // Physics properties
        this.velocity = initialVelocity.clone(); // Initial velocity set by the tank
        this.lifespan = this.isMobile ? 4 : 5; // Shorter lifespan on mobile to save performance
        this.age = 0;
        this.shouldBeRemoved = false;
        this.damage = 25;
        this.collisionRadius = 0.3;
        
        // Mobile-specific optimizations
        this.updateInterval = this.isMobile ? 33 : 16; // 30fps vs 60fps updates
        this.lastUpdate = Date.now();
        
        // Trail effect (desktop only for performance)
        if (!this.isMobile) {
            this.createTrailEffect();
        }
        
        // Sound effect (mobile gets simpler audio handling)
        if (this.isMobile) {
            this.playMobileFireSound();
        }
        
        console.log(`Projectile created for ${this.isMobile ? 'mobile' : 'desktop'} device`);
    }
    
    createTrailEffect() {
        // Desktop only - create a simple trail effect
        this.trailPoints = [];
        this.maxTrailPoints = 8;
        
        // Create trail geometry
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailMaterial = new THREE.LineBasicMaterial({
            color: this.firedByPlayer ? 0x00ffff : 0xff8800,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        
        this.trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
        this.scene.add(this.trailLine);
    }
    
    updateTrailEffect() {
        if (this.isMobile || !this.trailLine) return;
        
        // Add current position to trail
        this.trailPoints.push(this.mesh.position.clone());
        
        // Remove old points
        if (this.trailPoints.length > this.maxTrailPoints) {
            this.trailPoints.shift();
        }
        
        // Update trail geometry
        if (this.trailPoints.length > 1) {
            const positions = new Float32Array(this.trailPoints.length * 3);
            for (let i = 0; i < this.trailPoints.length; i++) {
                positions[i * 3] = this.trailPoints[i].x;
                positions[i * 3 + 1] = this.trailPoints[i].y;
                positions[i * 3 + 2] = this.trailPoints[i].z;
            }
            
            this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.trailGeometry.setDrawRange(0, this.trailPoints.length);
            
            // Fade trail based on projectile age
            const fadeRatio = 1 - (this.age / this.lifespan);
            this.trailMaterial.opacity = 0.6 * fadeRatio;
        }
    }
    
    playMobileFireSound() {
        // Simplified sound for mobile - using Web Audio API if available
        if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
            try {
                const audioContext = new (AudioContext || webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                // Simple fire sound
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                // Fallback - no sound on mobile if audio context fails
                console.log('Mobile audio not available');
            }
        }
    }
    
    update(deltaTime) {
        if (this.shouldBeRemoved) return;
        
        // Limit update frequency on mobile
        const now = Date.now();
        if (this.isMobile && (now - this.lastUpdate) < this.updateInterval) {
            return;
        }
        this.lastUpdate = now;
        
        // Apply gravity
        this.velocity.y -= GRAVITY * deltaTime;
        
        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Update trail effect (desktop only)
        this.updateTrailEffect();
        
        // Age the projectile
        this.age += deltaTime;
        
        // Check lifespan
        if (this.age > this.lifespan) {
            this.shouldBeRemoved = true;
            this.cleanup();
            return;
        }
        
        // Boundary checks with mobile-optimized terrain size
        const maxDistance = this.isMobile ? 50 : 75;
        if (Math.abs(this.mesh.position.x) > maxDistance || 
            Math.abs(this.mesh.position.z) > maxDistance || 
            this.mesh.position.y < -5) {
            this.shouldBeRemoved = true;
            this.cleanup();
            return;
        }
        
        // Visual effects based on age (desktop only for performance)
        if (!this.isMobile) {
            this.updateVisualEffects();
        }
    }
    
    updateVisualEffects() {
        // Desktop only visual enhancements
        const ageRatio = this.age / this.lifespan;
        
        // Fade the projectile as it ages
        if (this.mesh.material.transparent === undefined) {
            this.mesh.material.transparent = true;
        }
        this.mesh.material.opacity = 1 - (ageRatio * 0.3); // Slight fade
        
        // Add rotation for visual interest
        this.mesh.rotation.x += 0.1;
        this.mesh.rotation.y += 0.05;
        
        // Slight scale change for impact anticipation
        const scaleVariation = 1 + Math.sin(this.age * 10) * 0.05;
        this.mesh.scale.setScalar(scaleVariation);
    }
    
    cleanup() {
        // Clean up trail effect
        if (this.trailLine && this.scene) {
            this.scene.remove(this.trailLine);
            if (this.trailGeometry) {
                this.trailGeometry.dispose();
            }
            if (this.trailMaterial) {
                this.trailMaterial.dispose();
            }
        }
        
        // Dispose of projectile geometry and material
        if (this.mesh.geometry) {
            this.mesh.geometry.dispose();
        }
        if (this.mesh.material) {
            this.mesh.material.dispose();
        }
        
        console.log(`Projectile cleaned up (${this.isMobile ? 'mobile' : 'desktop'})`);
    }
    
    // Create impact effect when projectile hits something
    createImpactEffect(position, target = 'ground') {
        if (!this.scene) return;
        
        // Simplified impact effect for mobile
        const impactGeometry = this.isMobile ? 
            new THREE.SphereGeometry(0.5, 6, 6) :
            new THREE.SphereGeometry(0.8, 8, 8);
            
        const impactMaterial = new THREE.MeshBasicMaterial({
            color: target === 'tank' ? 0xff4444 : 0xffaa00,
            transparent: true,
            opacity: 0.8
        });
        
        const impactFlash = new THREE.Mesh(impactGeometry, impactMaterial);
        impactFlash.position.copy(position);
        this.scene.add(impactFlash);
        
        // Animate impact effect
        const startTime = Date.now();
        const duration = this.isMobile ? 300 : 500;
        
        const animateImpact = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                this.scene.remove(impactFlash);
                impactFlash.geometry.dispose();
                impactFlash.material.dispose();
                return;
            }
            
            // Scale and fade
            const scale = 1 + progress * 2;
            const opacity = 0.8 * (1 - progress);
            
            impactFlash.scale.setScalar(scale);
            impactFlash.material.opacity = opacity;
            
            // Color transition (desktop only)
            if (!this.isMobile) {
                const hue = target === 'tank' ? 0 : 0.1; // Red for tank, orange for ground
                const saturation = 1 - progress * 0.5;
                const lightness = 0.5 + progress * 0.3;
                impactFlash.material.color.setHSL(hue, saturation, lightness);
            }
            
            requestAnimationFrame(animateImpact);
        };
        
        animateImpact();
    }
    
    // Get projectile status for debugging
    getStatus() {
        return {
            position: this.mesh.position.clone(),
            velocity: this.velocity.clone(),
            age: this.age,
            lifespan: this.lifespan,
            shouldBeRemoved: this.shouldBeRemoved,
            firedByPlayer: this.firedByPlayer,
            damage: this.damage,
            isMobile: this.isMobile,
            hasTrail: !!this.trailLine
        };
    }
    
    // Mobile-specific method to check if projectile is still visible
    isVisible(camera) {
        if (!camera) return true;
        
        // Simple frustum check for mobile optimization
        const distance = this.mesh.position.distanceTo(camera.position);
        const maxVisibleDistance = this.isMobile ? 50 : 100;
        
        return distance <= maxVisibleDistance;
    }
    
    // Force removal of projectile (useful for mobile performance management)
    forceRemove() {
        this.shouldBeRemoved = true;
        this.cleanup();
        console.log('Projectile force removed for performance');
    }
    
    // Reduce quality for better mobile performance
    reduceQuality() {
        if (!this.isMobile) return;
        
        // Remove any remaining visual effects
        if (this.trailLine) {
            this.scene.remove(this.trailLine);
            this.trailLine = null;
        }
        
        // Simplify material
        if (this.mesh.material.emissive) {
            this.mesh.material.emissive.setHex(0x000000);
            this.mesh.material.emissiveIntensity = 0;
        }
        
        // Reduce update frequency further
        this.updateInterval = 50; // 20fps
        
        console.log('Projectile quality reduced for mobile performance');
    }
}