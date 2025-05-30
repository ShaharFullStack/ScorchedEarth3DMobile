import * as THREE from 'three';
const GRAVITY = 9.81 * 2; // Slightly exaggerated gravity for game feel
export class Projectile {
    constructor(startPosition, initialVelocity, firedByPlayer, scene) {
        this.scene = scene;
        this.firedByPlayer = firedByPlayer;
        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: firedByPlayer ? 0x00ffff : 0xff8800 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPosition);
        this.velocity = initialVelocity.clone(); // Initial velocity set by the tank
        this.lifespan = 5; // seconds, increased to allow for arcs
        this.age = 0;        this.shouldBeRemoved = false;
        this.damage = 25;
        this.collisionRadius = 0.3;
        
        // Max height tracking for debugging
        this.startPosition = startPosition.clone(); // Store start position for distance calculation
        this.startHeight = startPosition.y;
        this.maxHeight = startPosition.y;
        this.maxHeightReached = false;
        this.timeToMaxHeight = 0;
        
        // Debug logging for projectile creation
        console.log(`PROJECTILE CREATED:`, {
            startPos: `(${startPosition.x.toFixed(2)}, ${startPosition.y.toFixed(2)}, ${startPosition.z.toFixed(2)})`,
            velocity: `(${initialVelocity.x.toFixed(1)}, ${initialVelocity.y.toFixed(1)}, ${initialVelocity.z.toFixed(1)})`,
            speed: `${initialVelocity.length().toFixed(1)} m/s`,
            firedByPlayer: firedByPlayer
        });
    }    update(deltaTime) {
        if (this.shouldBeRemoved) return;
        
        // Store previous position for max height tracking
        const previousY = this.mesh.position.y;
        
        // Apply gravity
        this.velocity.y -= GRAVITY * deltaTime;
        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.age += deltaTime;
        
        // Track maximum height reached
        if (this.mesh.position.y > this.maxHeight) {
            this.maxHeight = this.mesh.position.y;
            this.timeToMaxHeight = this.age;
        }
        
        // Detect when projectile starts falling (reached max height)
        if (!this.maxHeightReached && this.velocity.y <= 0 && this.mesh.position.y <= previousY) {
            this.maxHeightReached = true;
            const heightGain = this.maxHeight - this.startHeight;
            const shooterType = this.firedByPlayer ? 'PLAYER' : 'AI';
            console.log(`${shooterType} PROJECTILE MAX HEIGHT REACHED:`, {
                startHeight: `${this.startHeight.toFixed(2)} m`,
                maxHeight: `${this.maxHeight.toFixed(2)} m`, 
                heightGain: `${heightGain.toFixed(2)} m`,
                timeToMaxHeight: `${this.timeToMaxHeight.toFixed(2)} s`,
                currentVelocityY: `${this.velocity.y.toFixed(2)} m/s`,
                trajectory: `(${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.y.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`
            });
        }
        
        if (this.age > this.lifespan) {
            this.shouldBeRemoved = true;
        }
        // Remove if it goes too far or too low (e.g. under terrain)
        if (Math.abs(this.mesh.position.x) > 75 || Math.abs(this.mesh.position.z) > 75 || this.mesh.position.y < -5) {
            this.shouldBeRemoved = true;
              // Log final flight stats when projectile is removed
            if (this.maxHeightReached) {
                const totalFlightTime = this.age;
                const horizontalDistance = Math.sqrt(
                    Math.pow(this.mesh.position.x - this.startPosition.x, 2) + 
                    Math.pow(this.mesh.position.z - this.startPosition.z, 2)
                );
                const shooterType = this.firedByPlayer ? 'PLAYER' : 'AI';
                console.log(`${shooterType} PROJECTILE FLIGHT ENDED:`, {
                    totalFlightTime: `${totalFlightTime.toFixed(2)} s`,
                    horizontalDistance: `${horizontalDistance.toFixed(1)} m`,
                    finalPosition: `(${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.y.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`,
                    maxHeightAchieved: `${this.maxHeight.toFixed(2)} m`
                });
            }
        }
    }
}