import * as THREE from 'three';
import { ThirdPersonCameraController, FirstPersonCameraController } from './controls.js';
import { Game } from './game.js';
import { setupScene } from './sceneSetup.js';
import { UI } from './ui.js';
import { AudioManager } from './audioManager.js';
import { AuthManager } from './auth.js';

class MainApp {    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500); // Extended far plane for larger map
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
          this.thirdPersonController = null;
        this.activeCameraTarget = null;        this.audioManager = new AudioManager();
        this.ui = new UI(this.audioManager);
        this.game = null;
        
        // Initialize authentication system
        this.authManager = new AuthManager((user) => this.onAuthStateChanged(user));

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
        document.body.appendChild(this.renderer.domElement);

        setupScene(this.scene);
          // Position camera initially for a good overview of larger map
        this.camera.position.set(0, 35, 40);
        this.camera.lookAt(0, 0, 0);        this.game = new Game(this.scene, this.camera, this.renderer, this.ui, this.audioManager);
        
        // Make game instance available globally for debugging
        window.gameInstance = this.game;
        
        // Initialize audio on first user interaction
        this.initializeAudio();
        
        // Set up difficulty selection handler (called after login)
        this.ui.onDifficultyChange = async (difficulty) => {
            await this.game.startGameInitialization();
            this.activeCameraTarget = this.game.playerTank.mesh;
            this.setupControllers();
            this.game.setCameraController(this.thirdPersonController);
            this.animate();
        };

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }
    
    onAuthStateChanged(user) {
        if (user) {
            // User is logged in, proceed to difficulty selection
            console.log('User authenticated:', user.displayName);
            this.ui.setPlayerName(user.displayName);
            this.ui.showDifficultySelector();
        } else {
            // User logged out, authentication screen will be shown by AuthManager
            console.log('User logged out');
        }
    }

    async initializeAudio() {
        // Initialize audio context on first user interaction (required by browsers)
        const initAudio = async () => {
            await this.audioManager.initializeAudioContext();
            
            // Start playing opening music
            this.audioManager.playMusic('openingScreen');
            
            // Remove event listeners after first interaction
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
            document.removeEventListener('keydown', initAudio);
        };

        // Add event listeners for user interaction
        document.addEventListener('click', initAudio);
        document.addEventListener('touchstart', initAudio);
        document.addEventListener('keydown', initAudio);
    }

    setupControllers() {
        if (!this.activeCameraTarget) {
            console.error("Cannot setup ThirdPersonCameraController without an active target.");
            return;
        }
        this.thirdPersonController = new ThirdPersonCameraController(this.camera, this.activeCameraTarget, this.renderer.domElement, {
            distance: 20, // Increased distance for larger map
            height: 15,   // Higher camera for better overview
            rotationSpeed: 0.003
        });
        this.firstPersonController = new FirstPersonCameraController(this.camera, this.activeCameraTarget, this.renderer.domElement, {
            height: 1.5,
            rotationSpeed: 0.003
        });
        // Set up initial camera controller
        this.thirdPersonController.enable();
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const deltaTime = this.clock.getDelta();

        if (this.game) {
            this.game.update(deltaTime);
            
            // Update music button state periodically (every few frames)
            if (Math.random() < 0.01) { // ~1% chance per frame for light checking
                this.game.updateMusicButtonState();
            }
        }
        
        if (this.thirdPersonController && this.thirdPersonController.enabled) {
             // Ensure the camera target is always up-to-date
            if (this.game && this.game.activeTank && this.thirdPersonController.target !== this.game.activeTank.mesh) {
                 this.thirdPersonController.target = this.game.activeTank.mesh;
            }
            this.thirdPersonController.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new MainApp();