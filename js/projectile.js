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
        this.age = 0;
        this.shouldBeRemoved = false;
        this.damage = 25;
        this.collisionRadius = 0.3;
    }
    update(deltaTime) {
        if (this.shouldBeRemoved) return;
        // Apply gravity
        this.velocity.y -= GRAVITY * deltaTime;
        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.age += deltaTime;
        if (this.age > this.lifespan) {
            this.shouldBeRemoved = true;
        }
        // Remove if it goes too far or too low (e.g. under terrain)
        if (Math.abs(this.mesh.position.x) > 75 || Math.abs(this.mesh.position.z) > 75 || this.mesh.position.y < -5) {
            this.shouldBeRemoved = true;
        }
    }
}