import * as THREE from 'three';

/**
 * PlayerController - Handles player movement and physics (Desktop Only)
 * Mobile movement is handled by MobileControls class
 */
class PlayerController {
  constructor(player, options = {}) {
    this.player = player;
    this.isMobile = options.isMobile || false;

    // Skip setup for mobile devices
    if (this.isMobile) {
      console.log('PlayerController: Skipping desktop controls setup for mobile device');
      return;
    }

    // Configuration
    this.moveSpeed = options.moveSpeed || 10;
    this.jumpForce = options.jumpForce || 15;
    this.gravity = options.gravity || 30;
    this.groundLevel = options.groundLevel || 1;

    // State
    this.velocity = new THREE.Vector3();
    this.isOnGround = true;
    this.canJump = true;
    this.keys = {};
    this.cameraMode = 'third-person';

    // Setup input handlers for desktop only
    this.setupInput();
  }

  setupInput() {
    if (this.isMobile) return;

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  update(deltaTime, cameraRotation) {
    if (this.isMobile) return; // Mobile movement handled elsewhere

    // Apply gravity
    if (this.player.position.y > this.groundLevel) {
      this.velocity.y -= this.gravity * deltaTime;
      this.isOnGround = false;
    } else {
      this.velocity.y = Math.max(0, this.velocity.y);
      this.player.position.y = this.groundLevel;
      this.isOnGround = true;
      this.canJump = true;
    }

    // Handle jumping
    if (this.keys['Space'] && this.isOnGround && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.canJump = false;
    }

    // Horizontal Movement
    let moveX = 0;
    let moveZ = 0;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

    const currentMoveSpeed = this.moveSpeed;

    if (this.keys['KeyW']) {
      moveX += forward.x;
      moveZ += forward.z;
    }
    if (this.keys['KeyS']) {
      moveX -= forward.x;
      moveZ -= forward.z;
    }
    if (this.keys['KeyA']) {
      moveX -= right.x;
      moveZ -= right.z;
    }
    if (this.keys['KeyD']) {
      moveX += right.x;
      moveZ += right.z;
    }

    const moveDirection = new THREE.Vector3(moveX, 0, moveZ);
    if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
    }

    this.velocity.x = moveDirection.x * currentMoveSpeed;
    this.velocity.z = moveDirection.z * currentMoveSpeed;

    // Update Player Position
    this.player.position.x += this.velocity.x * deltaTime;
    this.player.position.y += this.velocity.y * deltaTime;
    this.player.position.z += this.velocity.z * deltaTime;

    // Update Player Rotation
    if (this.cameraMode === 'third-person' && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.player.rotation.y = angle + Math.PI;
    }
  }
}

/**
 * ThirdPersonCameraController - Handles third-person camera with mobile support
 */
class ThirdPersonCameraController {
  constructor(camera, target, domElement, options = {}) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;
    this.isMobile = options.isMobile || this.detectMobile();

    // Configuration with mobile optimizations
    this.distance = options.distance || (this.isMobile ? 15 : 7);
    this.height = options.height || (this.isMobile ? 12 : 3);
    this.rotationSpeed = options.rotationSpeed || (this.isMobile ? 0.004 : 0.003);

    // State
    this.rotation = 0;
    this.isDragging = false;
    this.mousePosition = { x: 0, y: 0 };
    this.enabled = true;

    // Mobile-specific properties
    this.minDistance = this.isMobile ? 8 : 5;
    this.maxDistance = this.isMobile ? 30 : 15;
    this.smoothingFactor = this.isMobile ? 0.1 : 0.05;

    // Setup controls based on device type
    if (this.isMobile) {
      this.setupMobileControls();
    } else {
      this.setupMouseControls();
    }

    console.log(`ThirdPersonCamera initialized for ${this.isMobile ? 'mobile' : 'desktop'}`);
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (window.innerWidth <= 768);
  }

  setupMouseControls() {
    if (this.isMobile) return;

    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.isDragging = true;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isDragging) return;

      const deltaX = e.clientX - this.mousePosition.x;
      this.rotation -= deltaX * this.rotationSpeed;

      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    // Mouse wheel for zoom on desktop
    this.domElement.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      
      const zoomSpeed = 0.1;
      this.distance += e.deltaY * zoomSpeed;
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    });
  }

  setupMobileControls() {
    // Mobile camera controls are handled by MobileControls class
    // This controller just responds to distance changes
    console.log('Mobile camera control setup - handled by MobileControls');
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.isDragging = false;
  }

  // Method for mobile controls to set camera distance
  setDistance(distance) {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
  }

  // Method for mobile controls to set rotation
  setRotation(rotation) {
    this.rotation = rotation;
  }

  update() {
    if (!this.enabled || !this.target) return 0;

    // Calculate camera position with mobile-optimized smoothing
    const targetOffset = new THREE.Vector3(
      Math.sin(this.rotation) * this.distance,
      this.height,
      Math.cos(this.rotation) * this.distance
    );

    const targetPosition = this.target.position.clone().add(targetOffset);

    // Smooth camera movement (more aggressive on mobile for responsiveness)
    if (this.isMobile) {
      this.camera.position.lerp(targetPosition, this.smoothingFactor);
    } else {
      this.camera.position.copy(targetPosition);
    }

    // Look at target with slight offset for better view
    const lookAtTarget = this.target.position.clone();
    lookAtTarget.y += this.isMobile ? 0.8 : 1;
    this.camera.lookAt(lookAtTarget);

    return this.rotation;
  }

  // Mobile-specific methods
  handlePinchZoom(scale) {
    if (!this.isMobile) return;
    
    const zoomSpeed = 2;
    const deltaDistance = (1 - scale) * zoomSpeed;
    this.distance += deltaDistance;
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
  }

  // Get current camera state for mobile UI
  getCameraState() {
    return {
      distance: this.distance,
      height: this.height,
      rotation: this.rotation,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance,
      enabled: this.enabled
    };
  }

  // Smooth transition to new target (useful for mobile)
  setTarget(newTarget, smooth = true) {
    if (smooth && this.isMobile) {
      // Implement smooth target transition for mobile
      this.target = newTarget;
    } else {
      this.target = newTarget;
    }
  }
}

/**
 * FirstPersonCameraController - Handles first-person camera (Desktop Only)
 * Mobile devices don't use first-person mode for tank game
 */
class FirstPersonCameraController {
  constructor(camera, player, domElement, options = {}) {
    this.camera = camera;
    this.player = player;
    this.domElement = domElement;
    this.isMobile = options.isMobile || this.detectMobile();

    // Skip first-person setup on mobile
    if (this.isMobile) {
      console.log('FirstPersonCamera: Disabled for mobile device');
      this.enabled = false;
      return;
    }

    // Configuration
    this.eyeHeight = options.eyeHeight || 1.6;
    this.mouseSensitivity = options.mouseSensitivity || 0.002;

    // State
    this.enabled = false;
    this.rotationY = 0;
    this.rotationX = 0;

    // Setup mouse controls for desktop only
    this.setupMouseControls();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  setupMouseControls() {
    if (this.isMobile) return;

    this.domElement.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.domElement) return;

      this.rotationY -= e.movementX * this.mouseSensitivity;
      this.rotationX -= e.movementY * this.mouseSensitivity;

      // Limit vertical rotation
      this.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.rotationX));
    });
  }

  enable() {
    if (this.isMobile) {
      console.log('FirstPersonCamera: Cannot enable on mobile device');
      return;
    }
    
    this.enabled = true;
    this.rotationX = 0;
    this.hidePlayer();
  }

  disable() {
    this.enabled = false;
    this.showPlayer();

    if (!this.isMobile && document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  hidePlayer() {
    if (this.isMobile) return;
    
    this.originalVisibility = [];
    this.player.traverse(child => {
      if (child.isMesh) {
        this.originalVisibility.push({
          object: child,
          visible: child.visible
        });
        child.visible = false;
      }
    });
  }

  showPlayer() {
    if (this.isMobile) return;
    
    if (this.originalVisibility) {
      this.originalVisibility.forEach(item => {
        item.object.visible = item.visible;
      });
      this.originalVisibility = null;
    }
  }

  update() {
    if (!this.enabled || this.isMobile) return 0;

    // Set player rotation to match camera's horizontal rotation
    this.player.rotation.y = this.rotationY;

    // Position camera at player eye height
    this.camera.position.x = this.player.position.x;
    this.camera.position.y = this.player.position.y + this.eyeHeight;
    this.camera.position.z = this.player.position.z;

    // Set camera rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    return this.rotationY;
  }
}

/**
 * Mobile Camera Helper - Additional utilities for mobile camera control
 */
class MobileCameraHelper {
  constructor(camera, options = {}) {
    this.camera = camera;
    this.smoothness = options.smoothness || 0.1;
    this.targetFOV = this.camera.fov;
    this.originalFOV = this.camera.fov;
    
    // Mobile-specific camera settings
    this.mobileFOV = options.mobileFOV || 85; // Wider FOV for mobile
    this.performanceMode = false;
  }

  // Smooth FOV transitions for mobile zoom
  updateFOV(targetFOV, smooth = true) {
    this.targetFOV = targetFOV;
    
    if (smooth) {
      this.animateFOV();
    } else {
      this.camera.fov = targetFOV;
      this.camera.updateProjectionMatrix();
    }
  }

  animateFOV() {
    const animate = () => {
      const diff = this.targetFOV - this.camera.fov;
      if (Math.abs(diff) > 0.1) {
        this.camera.fov += diff * this.smoothness;
        this.camera.updateProjectionMatrix();
        requestAnimationFrame(animate);
      } else {
        this.camera.fov = this.targetFOV;
        this.camera.updateProjectionMatrix();
      }
    };
    animate();
  }

  // Optimize camera for mobile performance
  enablePerformanceMode() {
    this.performanceMode = true;
    
    // Reduce far plane for better performance
    this.camera.far = 800; // Reduced from default
    this.camera.updateProjectionMatrix();
    
    console.log('Mobile camera: Performance mode enabled');
  }

  disablePerformanceMode() {
    this.performanceMode = false;
    
    // Restore original far plane
    this.camera.far = 1500;
    this.camera.updateProjectionMatrix();
    
    console.log('Mobile camera: Performance mode disabled');
  }

  // Get camera debug info
  getDebugInfo() {
    return {
      fov: this.camera.fov,
      targetFOV: this.targetFOV,
      position: this.camera.position.clone(),
      rotation: this.camera.rotation.clone(),
      performanceMode: this.performanceMode,
      far: this.camera.far,
      near: this.camera.near
    };
  }
}

/**
 * Device-aware camera factory
 */
export function createCameraController(type, camera, target, domElement, options = {}) {
  const isMobile = options.isMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  switch (type) {
    case 'third-person':
      return new ThirdPersonCameraController(camera, target, domElement, { ...options, isMobile });
    
    case 'first-person':
      if (isMobile) {
        console.warn('First-person camera not supported on mobile, falling back to third-person');
        return new ThirdPersonCameraController(camera, target, domElement, { ...options, isMobile });
      }
      return new FirstPersonCameraController(camera, target, domElement, { ...options, isMobile });
    
    case 'mobile-helper':
      return new MobileCameraHelper(camera, options);
    
    default:
      return new ThirdPersonCameraController(camera, target, domElement, { ...options, isMobile });
  }
}

export { PlayerController, ThirdPersonCameraController, FirstPersonCameraController, MobileCameraHelper };