import * as THREE from 'three';

export function setupScene(scene) {
    // Sky background - will be replaced by skybox if image is available
    scene.background = new THREE.Color(0x87CEEB); // Sky blue fallback
    
    // Enhanced fog system for island atmosphere
    scene.fog = new THREE.FogExp2(0x7fb3d5, 0.016); // Slightly blue-tinted fog for ocean atmosphere

    // Generate random seed for consistent randomness within a game
    scene.userData.mapSeed = Math.random() * 1000;
    
    // Create island terrain (same as before)
    const groundSize = 150;
    const segments = 96;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, segments, segments);
    
    // Generate island terrain with coastal features
    const vertices = groundGeo.attributes.position;
    const seed = scene.userData.mapSeed;
    
    for (let i = 0; i < vertices.count; i++) {
        const x_plane = vertices.getX(i);
        const y_plane = vertices.getY(i);
        
        // Distance from center for island shaping
        const distanceFromCenter = Math.sqrt(x_plane * x_plane + y_plane * y_plane);
        const maxDistance = groundSize / 2.2; // Slightly smaller than full size
        
        // Base height with more variation
        const baseHeight = 2.0 + Math.sin(seed + x_plane * 0.02) * 0.5;
        
        // Multiple dune layers for more complex terrain
        const largeDunes = (Math.sin((x_plane + seed * 10) * 0.08) * Math.cos((y_plane + seed * 15) * 0.06) + 1) / 2 * 6.0;
        const mediumDunes = (Math.sin((x_plane + seed * 25) * 0.15) * Math.cos((y_plane + seed * 30) * 0.12) + 1) / 2 * 3.0;
        const smallDunes = (Math.sin((x_plane + seed * 50) * 0.25) * Math.cos((y_plane + seed * 75) * 0.2) + 1) / 2 * 1.5;
        
        // Fine undulations
        const undulation = Math.sin((x_plane + seed * 100) * 0.1 + Math.PI / 4) * Math.cos((y_plane + seed * 125) * 0.15 + Math.PI / 3) * 0.8;
        
        let heightBeforeLakes = baseHeight + largeDunes + mediumDunes + smallDunes + undulation;
        let finalHeight = heightBeforeLakes;
        
        // Create island shape - height decreases towards edges
        if (distanceFromCenter > maxDistance * 0.7) {
            const edgeFactor = Math.max(0, 1 - (distanceFromCenter - maxDistance * 0.7) / (maxDistance * 0.3));
            const smoothEdge = edgeFactor * edgeFactor * (3 - 2 * edgeFactor); // Smooth step function
            finalHeight = finalHeight * smoothEdge;
        }
        
        // Create some inland water areas (oases/lakes)
        const oasisCount = 2; // Fewer for island
        for (let j = 0; j < oasisCount; j++) {
            const oasisCenterX = (seed * (j + 1) * 123.456) % (groundSize * 0.6) - (groundSize * 0.3);
            const oasisCenterY = (seed * (j + 1) * 789.123) % (groundSize * 0.6) - (groundSize * 0.3);
            const oasisSize = 10 + (seed * (j + 1) * 30) % 15;
            
            const distanceToOasis = Math.sqrt(
                Math.pow(x_plane - oasisCenterX, 2) + Math.pow(y_plane - oasisCenterY, 2)
            );
            
            if (distanceToOasis < oasisSize && distanceFromCenter < maxDistance * 0.6) {
                const oasisStrength = 1.0 - (distanceToOasis / oasisSize);
                const oasisDepression = oasisStrength * oasisStrength * 2.0;
                finalHeight = Math.max(0, finalHeight - oasisDepression);
            }
        }
        
        // Ensure minimum height and smooth coastline
        finalHeight = Math.max(finalHeight, 0.1);
        
        vertices.setZ(i, finalHeight);
    }
    
    groundGeo.computeVertexNormals();
    
    // Create island ground material
    const groundTexture = createProceduralGroundTexture();
    const normalTexture = createProceduralNormalTexture();
    const roughnessTexture = createRoughnessTexture();
    
    const groundMat = new THREE.MeshStandardMaterial({
        map: groundTexture,
        normalMap: normalTexture,
        roughnessMap: roughnessTexture,
        color: 0xa8956b, // Realistic battlefield earth tone
        roughness: 0.9,  // High roughness for realistic dirt/soil
        metalness: 0.05, // Very low metalness for organic terrain
        normalScale: new THREE.Vector2(1.2, 1.2), // Enhanced normal mapping
        envMapIntensity: 0.3 // Subtle environmental reflections
    });
    
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
      // Add surrounding water
    createSurroundingWater(scene, groundSize);
    
    // Setup skybox for ocean horizon
    setupOceanSkybox(scene);
    
    // Store terrain data
    scene.userData.terrain = {
        geometry: groundGeo,
        size: groundSize,
        segments: segments,
        getHeightAt: function(worldX, worldZ) {
            const localX = worldX;
            const localY = worldZ;
            if (Math.abs(localX) > this.size / 2 || Math.abs(localY) > this.size / 2) {
                return 0;
            }
            const gridX = Math.floor((localX + this.size / 2) / (this.size / this.segments));
            const gridY = Math.floor((localY + this.size / 2) / (this.size / this.segments));
            
            const vertexIndex = gridX + gridY * (this.segments + 1);
            if (vertexIndex >= 0 && vertexIndex < this.geometry.attributes.position.count) {
                return this.geometry.attributes.position.getZ(vertexIndex);
            }
            return 0;
        },        
        deformTerrain: function(impactPositionWorld, radius, depth) {
            const localImpact = new THREE.Vector3();
            localImpact.x = impactPositionWorld.x;
            localImpact.y = -impactPositionWorld.z;
            const vertices = this.geometry.attributes.position;
            let deformed = false;
            for (let i = 0; i < vertices.count; i++) {
                const planeVertexX = vertices.getX(i);
                const planeVertexY = vertices.getY(i);
                const currentPlaneHeight = vertices.getZ(i);
                const dx = planeVertexX - localImpact.x;
                const dy = planeVertexY - localImpact.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq < radius * radius) {
                    const distFactor = 1.0 - Math.sqrt(distanceSq) / radius;
                    const deformationAmount = -depth * distFactor * distFactor;
                    
                    let newPlaneHeight = currentPlaneHeight + deformationAmount;
                    newPlaneHeight = Math.max(newPlaneHeight, 0.0);
                    
                    vertices.setZ(i, newPlaneHeight);
                    deformed = true;
                }
            }
            if (deformed) {
                this.geometry.attributes.position.needsUpdate = true;
                this.geometry.computeVertexNormals();
            }
        }
    };

    // Enhanced lighting with ocean atmosphere
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.5); // Slightly blue ambient for ocean
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffeaa7, 1.0); // Warm sunlight
    directionalLight.position.set(50, 80, 30);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Add atmospheric particles for ocean atmosphere
    createOceanAtmosphere(scene);
}

/**
 * Creates a realistic battlefield ground texture with multiple layers
 */
function createProceduralGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;  // Higher resolution
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Create base layer with varied terrain colors
    const imageData = ctx.createImageData(1024, 1024);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 1024;
        const y = Math.floor((i / 4) / 1024);
        
        // Multiple noise layers for realistic terrain
        const noise1 = (Math.sin(x * 0.02) * Math.cos(y * 0.02) + 1) / 2;
        const noise2 = (Math.sin(x * 0.05 + 123) * Math.cos(y * 0.05 + 456) + 1) / 2;
        const noise3 = (Math.sin(x * 0.1 + 789) * Math.cos(y * 0.1 + 101) + 1) / 2;
        const noise4 = (Math.sin(x * 0.2 + 321) * Math.cos(y * 0.2 + 654) + 1) / 2;
        
        // Combine noise layers
        const combined = (noise1 * 0.4 + noise2 * 0.3 + noise3 * 0.2 + noise4 * 0.1);
        
        // Create different terrain types based on noise
        let r, g, b;
        
        if (combined > 0.7) {
            // Rocky areas - darker grays and browns
            r = Math.floor(120 + combined * 40);
            g = Math.floor(100 + combined * 35);
            b = Math.floor(80 + combined * 25);
        } else if (combined > 0.4) {
            // Sandy/dirt areas - warmer browns
            r = Math.floor(160 + combined * 50);
            g = Math.floor(140 + combined * 40);
            b = Math.floor(100 + combined * 30);
        } else {
            // Darker soil areas
            r = Math.floor(100 + combined * 30);
            g = Math.floor(85 + combined * 25);
            b = Math.floor(60 + combined * 20);
        }
        
        // Add some random variation for realism
        const variation = (Math.random() - 0.5) * 20;
        r = Math.max(0, Math.min(255, r + variation));
        g = Math.max(0, Math.min(255, g + variation));
        b = Math.max(0, Math.min(255, b + variation));
        
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add detail patterns on top
    addDetailPatterns(ctx, 1024, 1024);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12); // Tile the texture
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Creates a roughness texture for varied surface properties
 */
function createRoughnessTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 512;
        const y = Math.floor((i / 4) / 512);
        
        // Create varied roughness based on terrain type
        const noise1 = (Math.sin(x * 0.03) * Math.cos(y * 0.03) + 1) / 2;
        const noise2 = (Math.sin(x * 0.08 + 50) * Math.cos(y * 0.08 + 100) + 1) / 2;
        
        // Combine noise for roughness variation
        const combined = noise1 * 0.7 + noise2 * 0.3;
        
        let roughness;
        if (combined > 0.6) {
            // Rocky areas - lower roughness (smoother)
            roughness = 180 + combined * 50;
        } else {
            // Dirt/soil areas - higher roughness
            roughness = 220 + combined * 35;
        }
        
        // Ensure we stay in valid range
        roughness = Math.max(150, Math.min(255, roughness));
        
        data[i] = roughness;     // Red
        data[i + 1] = roughness; // Green  
        data[i + 2] = roughness; // Blue
        data[i + 3] = 255;       // Alpha
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
}

/**
 * Adds realistic detail patterns to the ground texture
 */
function addDetailPatterns(ctx, width, height) {
    // Add rock scattered patterns
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 2 + Math.random() * 8;
        
        // Random rock color
        const brightness = 0.3 + Math.random() * 0.4;
        const r = Math.floor(brightness * 140);
        const g = Math.floor(brightness * 120);
        const b = Math.floor(brightness * 100);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add some smaller details around larger rocks
        if (size > 5) {
            for (let j = 0; j < 3; j++) {
                const detailX = x + (Math.random() - 0.5) * size * 3;
                const detailY = y + (Math.random() - 0.5) * size * 3;
                const detailSize = 1 + Math.random() * 3;
                
                ctx.fillStyle = `rgba(${r * 0.8}, ${g * 0.8}, ${b * 0.8}, 0.7)`;
                ctx.beginPath();
                ctx.arc(detailX, detailY, detailSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    // Add dirt/erosion patterns
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const length = 20 + Math.random() * 60;
        const angle = Math.random() * Math.PI * 2;
        
        ctx.strokeStyle = 'rgba(80, 60, 40, 0.3)';
        ctx.lineWidth = 2 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
    }
    
    // Add some vegetation patches (sparse)
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 5 + Math.random() * 15;
        
        // Dark green vegetation patches
        ctx.fillStyle = `rgba(40, 60, 30, ${0.2 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add some texture within vegetation
        for (let j = 0; j < 5; j++) {
            const vegX = x + (Math.random() - 0.5) * size;
            const vegY = y + (Math.random() - 0.5) * size;
            ctx.fillStyle = `rgba(50, 80, 40, ${0.3 + Math.random() * 0.4})`;
            ctx.fillRect(vegX, vegY, 1, 2 + Math.random() * 3);
        }
    }
}

/**
 * Creates a detailed normal map for realistic ground bumps and details
 */
function createProceduralNormalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 512;
        const y = Math.floor((i / 4) / 512);
        
        // Create multiple layers of normal variation for realistic terrain bumps
        const noise1 = Math.sin(x * 0.08) * Math.cos(y * 0.06);
        const noise2 = Math.sin(x * 0.15 + 100) * Math.cos(y * 0.12 + 200);
        const noise3 = Math.sin(x * 0.3 + 300) * Math.cos(y * 0.25 + 400);
        
        // Combine for complex surface detail
        const combinedX = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2);
        const combinedY = (Math.cos(x * 0.06) * Math.sin(y * 0.08) * 0.5 + 
                          Math.cos(x * 0.12 + 150) * Math.sin(y * 0.15 + 250) * 0.3 +
                          Math.cos(x * 0.25 + 350) * Math.sin(y * 0.3 + 450) * 0.2);
        
        // Convert to normal map format (0-255 range, with 128 being neutral)
        const nx = Math.floor((combinedX + 1) * 127.5);
        const ny = Math.floor((combinedY + 1) * 127.5);
        const nz = 200; // Strong upward normal for realistic ground
        
        data[i] = nx;     // Red (X normal)
        data[i + 1] = ny; // Green (Y normal)  
        data[i + 2] = nz; // Blue (Z normal - up)
        data[i + 3] = 255; // Alpha
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add some sharp detail normal features
    addNormalDetails(ctx, 512, 512, data);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
}

/**
 * Adds sharp normal map details for rocks and surface features
 */
function addNormalDetails(ctx, width, height, data) {
    // Add rock bump details to normal map
    for (let i = 0; i < 100; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const size = 3 + Math.random() * 8;
        
        // Create circular rock bump in normal map
        for (let dx = -size; dx <= size; dx++) {
            for (let dy = -size; dy <= size; dy++) {
                const pixelX = x + dx;
                const pixelY = y + dy;
                
                if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= size) {
                        const intensity = 1 - (distance / size);
                        const heightBump = intensity * 0.5;
                        
                        // Calculate normal from height bump
                        const normalX = -dx / size * intensity;
                        const normalY = -dy / size * intensity;
                        
                        const index = (pixelY * width + pixelX) * 4;
                        data[index] = Math.floor((normalX + 1) * 127.5);     // X normal
                        data[index + 1] = Math.floor((normalY + 1) * 127.5); // Y normal
                        data[index + 2] = Math.floor(255 * (0.8 + heightBump)); // Z normal (up)
                    }
                }
            }
        }
    }
    
    // Update the canvas with modified data
    const newImageData = new ImageData(data, width, height);
    ctx.putImageData(newImageData, 0, 0);
}

/**
 * Creates a dynamic sky with animated clouds
 */
function createDynamicSky(scene) {
    // Sky dome
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            sunPosition: { value: new THREE.Vector3(50, 80, 30).normalize() }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 sunPosition;
            varying vec3 vWorldPosition;
            
            vec3 getSkyColor(vec3 dir) {
                float sunDot = dot(dir, sunPosition);
                
                // Sky gradient
                float horizon = abs(dir.y);
                vec3 skyColor = mix(
                    vec3(0.8, 0.9, 1.0),  // Horizon color
                    vec3(0.3, 0.6, 1.0),  // Zenith color
                    horizon
                );
                
                // Sun glow
                float sunGlow = pow(max(sunDot, 0.0), 8.0);
                skyColor += vec3(1.0, 0.8, 0.6) * sunGlow * 0.5;
                
                return skyColor;
            }
            
            void main() {
                vec3 direction = normalize(vWorldPosition);
                vec3 color = getSkyColor(direction);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide,
        fog: false
    });
    
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);
    
    // Animate sky
    function animateSky() {
        skyMat.uniforms.time.value = Date.now() * 0.0001;
        requestAnimationFrame(animateSky);
    }
    animateSky();
    
    // Add cloud layer
    createCloudLayer(scene);
}

/**
 * Creates animated cloud layer
 */
function createCloudLayer(scene) {
    const cloudGroup = new THREE.Group();
    
    // Create multiple cloud sprites
    for (let i = 0; i < 20; i++) {
        const cloudTexture = createCloudTexture();
        const cloudMaterial = new THREE.SpriteMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });
        
        const cloud = new THREE.Sprite(cloudMaterial);
        cloud.scale.set(40 + Math.random() * 30, 20 + Math.random() * 15, 1);
        
        // Random positioning
        cloud.position.set(
            (Math.random() - 0.5) * 800,
            60 + Math.random() * 40,
            (Math.random() - 0.5) * 800
        );
        
        // Animation properties
        cloud.userData = {
            baseY: cloud.position.y,
            driftSpeed: 0.1 + Math.random() * 0.2,
            bobSpeed: 0.5 + Math.random() * 0.5,
            bobAmount: 5 + Math.random() * 10
        };
        
        cloudGroup.add(cloud);
    }
    
    scene.add(cloudGroup);
    
    // Animate clouds
    function animateClouds() {
        const time = Date.now() * 0.001;
        
        cloudGroup.children.forEach((cloud) => {
            // Drift movement
            cloud.position.x += cloud.userData.driftSpeed;
            if (cloud.position.x > 400) cloud.position.x = -400;
            
            // Gentle bobbing
            cloud.position.y = cloud.userData.baseY + 
                Math.sin(time * cloud.userData.bobSpeed) * cloud.userData.bobAmount;
        });
        
        requestAnimationFrame(animateClouds);
    }
    animateClouds();
}

/**
 * Creates a procedural cloud texture
 */
function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Create cloud shape
    const gradient = ctx.createRadialGradient(64, 32, 0, 64, 32, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 64);
    
    // Add some noise for cloud texture
    const imageData = ctx.getImageData(0, 0, 128, 64);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 128;
        const y = Math.floor((i / 4) / 128);
        
        const noise = (Math.sin(x * 0.1) * Math.cos(y * 0.1) + 1) / 2;
        const alpha = data[i + 3] * noise;
        data[i + 3] = alpha;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

/**
 * Creates atmospheric effects for fog of war
 */
function createAtmosphericEffects(scene) {
    // Dust particles system
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 200;
    const positions = new Float32Array(dustCount * 3);
    const velocities = new Float32Array(dustCount * 3);
    
    for (let i = 0; i < dustCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;     // x
        positions[i + 1] = Math.random() * 50;          // y
        positions[i + 2] = (Math.random() - 0.5) * 200; // z
        
        velocities[i] = (Math.random() - 0.5) * 0.1;     // x velocity
        velocities[i + 1] = Math.random() * 0.05;        // y velocity  
        velocities[i + 2] = (Math.random() - 0.5) * 0.1; // z velocity
    }
    
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    const dustMaterial = new THREE.PointsMaterial({
        color: 0xc4a484,
        size: 0.5,
        transparent: true,
        opacity: 0.3,
        sizeAttenuation: true,
        depthWrite: false
    });
    
    const dustSystem = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustSystem);
    
    // Animate dust particles
    function animateDust() {
        const positions = dustGeometry.attributes.position.array;
        const velocities = dustGeometry.attributes.velocity.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];
            
            // Reset particles that go too far
            if (Math.abs(positions[i]) > 100 || positions[i + 1] > 50 || Math.abs(positions[i + 2]) > 100) {
                positions[i] = (Math.random() - 0.5) * 200;
                positions[i + 1] = Math.random() * 50;
                positions[i + 2] = (Math.random() - 0.5) * 200;
            }
        }
        
        dustGeometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateDust);
    }
    animateDust();
    
    // Heat haze effect
    createHeatHaze(scene);
}

/**
 * Creates heat haze effect for desert atmosphere
 */
function createHeatHaze(scene) {
    const hazeGeometry = new THREE.PlaneGeometry(300, 100);
    const hazeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vec3 pos = position;
                pos.y += sin(pos.x * 0.1 + time) * 0.5;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            void main() {
                float alpha = sin(vUv.x * 10.0 + time * 2.0) * 0.1 + 0.1;
                gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    const heatHaze = new THREE.Mesh(hazeGeometry, hazeMaterial);
    heatHaze.position.y = 5;
    heatHaze.rotation.x = -Math.PI / 2;
    scene.add(heatHaze);
    
    // Animate heat haze
    function animateHaze() {
        hazeMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateHaze);
    }
    animateHaze();
}

/**
 * Creates surrounding water around the island
 */
function createSurroundingWater(scene, islandSize) {
    const waterSize = islandSize * 3; // Much larger than the island
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 64, 64);
    
    // Create animated water material
    const waterMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0x006994) },
            opacity: { value: 0.8 }
        },
        vertexShader: `
            uniform float time;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                vUv = uv;
                vPosition = position;
                
                vec3 pos = position;
                // Create wave motion
                pos.z += sin(pos.x * 0.02 + time) * 0.5;
                pos.z += cos(pos.y * 0.03 + time * 0.5) * 0.3;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color;
            uniform float opacity;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                // Create water ripple effect
                float wave1 = sin(vPosition.x * 0.1 + time * 2.0) * 0.5 + 0.5;
                float wave2 = cos(vPosition.y * 0.12 + time * 1.5) * 0.5 + 0.5;
                float waves = wave1 * wave2;
                
                vec3 waterColor = mix(color * 0.7, color * 1.3, waves);
                gl_FragColor = vec4(waterColor, opacity);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.5; // Slightly below island level
    scene.add(water);
    
    // Animate water
    function animateWater() {
        waterMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateWater);
    }
    animateWater();
}

/**
 * Sets up ocean skybox for island atmosphere
 */
function setupOceanSkybox(scene) {
    // Create a simple gradient skybox
    const skyGeometry = new THREE.SphereGeometry(500, 32, 16);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec3 vWorldPosition;
            
            void main() {
                vec3 direction = normalize(vWorldPosition);
                
                // Ocean sky gradient
                float horizon = abs(direction.y);
                vec3 skyColor = mix(
                    vec3(0.6, 0.8, 1.0),  // Ocean horizon color
                    vec3(0.2, 0.5, 0.9),  // Ocean zenith color
                    horizon * horizon
                );
                
                // Add some cloud-like variation
                float clouds = sin(direction.x * 3.0 + time * 0.1) * sin(direction.z * 3.0 + time * 0.15);
                clouds = smoothstep(-0.1, 0.1, clouds) * 0.3;
                skyColor = mix(skyColor, vec3(1.0, 1.0, 1.0), clouds);
                
                gl_FragColor = vec4(skyColor, 1.0);
            }
        `,
        side: THREE.BackSide,
        fog: false
    });
    
    const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skybox);
    
    // Animate skybox
    function animateSkybox() {
        skyMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateSkybox);
    }
    animateSkybox();
}

/**
 * Creates ocean atmosphere effects
 */
function createOceanAtmosphere(scene) {
    // Sea mist particles
    const mistGeometry = new THREE.BufferGeometry();
    const mistCount = 100;
    const positions = new Float32Array(mistCount * 3);
    const velocities = new Float32Array(mistCount * 3);
    
    for (let i = 0; i < mistCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 300;     // x
        positions[i + 1] = Math.random() * 20 + 5;      // y
        positions[i + 2] = (Math.random() - 0.5) * 300; // z
        
        velocities[i] = (Math.random() - 0.5) * 0.05;     // x velocity
        velocities[i + 1] = Math.random() * 0.02;         // y velocity  
        velocities[i + 2] = (Math.random() - 0.5) * 0.05; // z velocity
    }
    
    mistGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    mistGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    const mistMaterial = new THREE.PointsMaterial({
        color: 0xe6f3ff,
        size: 2.0,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
        depthWrite: false
    });
    
    const mistSystem = new THREE.Points(mistGeometry, mistMaterial);
    scene.add(mistSystem);
    
    // Animate mist particles
    function animateMist() {
        const positions = mistGeometry.attributes.position.array;
        const velocities = mistGeometry.attributes.velocity.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];
            
            // Reset particles that go too far
            if (Math.abs(positions[i]) > 150 || positions[i + 1] > 25 || Math.abs(positions[i + 2]) > 150) {
                positions[i] = (Math.random() - 0.5) * 300;
                positions[i + 1] = Math.random() * 20 + 5;
                positions[i + 2] = (Math.random() - 0.5) * 300;
            }
        }
        
        mistGeometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateMist);
    }
    animateMist();
}

// All building and tree functions remain the same...

/**
 * Creates different types of buildings
 */
export function createBuilding(position, type = 'house', scale = 1.0, terrainHeight = 0) {
    const buildingGroup = new THREE.Group();
    
    switch (type) {
        case 'house':
            createHouse(buildingGroup, scale);
            break;
        case 'tower':
            createTower(buildingGroup, scale);
            break;
        case 'warehouse':
            createWarehouse(buildingGroup, scale);
            break;
        case 'mosque':
            createMosque(buildingGroup, scale);
            break;
        case 'ruins':
            createRuins(buildingGroup, scale);
            break;
        default:
            createHouse(buildingGroup, scale);
    }
    
    buildingGroup.position.copy(position);
    buildingGroup.position.y = terrainHeight;
    
    buildingGroup.userData = {
        isBuilding: true,
        type: type,
        health: 100,
        maxHealth: 100,
        collisionRadius: 3 * scale,
        scale: scale,
        isDestroyed: false
    };
    
    return buildingGroup;
}

function createHouse(parent, scale) {
    // Main structure
    const houseGeo = new THREE.BoxGeometry(4 * scale, 3 * scale, 4 * scale);
    const houseMat = new THREE.MeshStandardMaterial({ 
        color: 0xDEB887, // Burlywood
        roughness: 0.8,
        metalness: 0.1
    });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.y = 1.5 * scale;
    house.castShadow = true;
    house.receiveShadow = true;
    parent.add(house);
    
    // Roof (pyramid)
    const roofGeo = new THREE.ConeGeometry(3 * scale, 2 * scale, 4);
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, // Brown
        roughness: 0.9
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4 * scale;
    roof.rotation.y = Math.PI / 4; // Rotate 45 degrees
    roof.castShadow = true;
    parent.add(roof);
    
    // Door
    const doorGeo = new THREE.BoxGeometry(0.8 * scale, 1.8 * scale, 0.1 * scale);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.9 * scale, 2.05 * scale);
    parent.add(door);
    
    // Windows
    const windowGeo = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.1 * scale);
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.7
    });
    
    const window1 = new THREE.Mesh(windowGeo, windowMat);
    window1.position.set(-1.2 * scale, 1.5 * scale, 2.05 * scale);
    parent.add(window1);
    
    const window2 = new THREE.Mesh(windowGeo, windowMat);
    window2.position.set(1.2 * scale, 1.5 * scale, 2.05 * scale);
    parent.add(window2);
}

function createTower(parent, scale) {
    // Main tower
    const towerGeo = new THREE.CylinderGeometry(2 * scale, 2.5 * scale, 8 * scale, 8);
    const towerMat = new THREE.MeshStandardMaterial({ 
        color: 0xA0A0A0, // Light gray stone
        roughness: 0.9,
        metalness: 0.0
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 4 * scale;
    tower.castShadow = true;
    tower.receiveShadow = true;
    parent.add(tower);
    
    // Top battlements
    for (let i = 0; i < 8; i++) {
        const battlementGeo = new THREE.BoxGeometry(0.5 * scale, 1 * scale, 0.5 * scale);
        const battlement = new THREE.Mesh(battlementGeo, towerMat);
        const angle = (i / 8) * Math.PI * 2;
        battlement.position.x = Math.cos(angle) * 2.2 * scale;
        battlement.position.z = Math.sin(angle) * 2.2 * scale;
        battlement.position.y = 8.5 * scale;
        parent.add(battlement);
    }
}

function createWarehouse(parent, scale) {
    // Main building
    const warehouseGeo = new THREE.BoxGeometry(6 * scale, 4 * scale, 8 * scale);
    const warehouseMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B8680, // Gray
        roughness: 0.7,
        metalness: 0.2
    });
    const warehouse = new THREE.Mesh(warehouseGeo, warehouseMat);
    warehouse.position.y = 2 * scale;
    warehouse.castShadow = true;
    warehouse.receiveShadow = true;
    parent.add(warehouse);
    
    // Corrugated roof
    const roofGeo = new THREE.BoxGeometry(6.5 * scale, 0.3 * scale, 8.5 * scale);
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: 0x708090, // Slate gray
        roughness: 0.6,
        metalness: 0.3
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4.15 * scale;
    roof.castShadow = true;
    parent.add(roof);
    
    // Large doors
    const doorGeo = new THREE.BoxGeometry(3 * scale, 3.5 * scale, 0.2 * scale);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.75 * scale, 4.1 * scale);
    parent.add(door);
}

function createMosque(parent, scale) {
    // Main building
    const mosqueGeo = new THREE.BoxGeometry(5 * scale, 4 * scale, 5 * scale);
    const mosqueMat = new THREE.MeshStandardMaterial({ 
        color: 0xF5DEB3, // Wheat color
        roughness: 0.8,
        metalness: 0.0
    });
    const mosque = new THREE.Mesh(mosqueGeo, mosqueMat);
    mosque.position.y = 2 * scale;
    mosque.castShadow = true;
    mosque.receiveShadow = true;
    parent.add(mosque);
    
    // Dome
    const domeGeo = new THREE.SphereGeometry(2.8 * scale, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ 
        color: 0x4169E1, // Royal blue
        roughness: 0.3,
        metalness: 0.1
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 4 * scale;
    dome.castShadow = true;
    parent.add(dome);
    
    // Minaret
    const minaretGeo = new THREE.CylinderGeometry(0.8 * scale, 1 * scale, 6 * scale, 8);
    const minaret = new THREE.Mesh(minaretGeo, mosqueMat);
    minaret.position.set(3.5 * scale, 3 * scale, 3.5 * scale);
    minaret.castShadow = true;
    parent.add(minaret);
    
    // Minaret top
    const minaretTopGeo = new THREE.SphereGeometry(0.6 * scale, 8, 8);
    const minaretTop = new THREE.Mesh(minaretTopGeo, domeMat);
    minaretTop.position.set(3.5 * scale, 6.5 * scale, 3.5 * scale);
    parent.add(minaretTop);
}

function createRuins(parent, scale) {
    // Broken walls
    const wallMat = new THREE.MeshStandardMaterial({ 
        color: 0x696969, // Dim gray
        roughness: 1.0,
        metalness: 0.0
    });
    
    // Wall 1 (partial)
    const wall1Geo = new THREE.BoxGeometry(4 * scale, 2.5 * scale, 0.5 * scale);
    const wall1 = new THREE.Mesh(wall1Geo, wallMat);
    wall1.position.set(0, 1.25 * scale, 2 * scale);
    wall1.rotation.z = Math.PI / 20; // Slight tilt
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    parent.add(wall1);
    
    // Wall 2 (broken)
    const wall2Geo = new THREE.BoxGeometry(0.5 * scale, 3 * scale, 3 * scale);
    const wall2 = new THREE.Mesh(wall2Geo, wallMat);
    wall2.position.set(2 * scale, 1.5 * scale, 0);
    wall2.rotation.x = -Math.PI / 25;
    wall2.castShadow = true;
    parent.add(wall2);
    
    // Rubble
    for (let i = 0; i < 5; i++) {
        const rubbleGeo = new THREE.BoxGeometry(
            (0.3 + Math.random() * 0.4) * scale,
            (0.2 + Math.random() * 0.3) * scale,
            (0.3 + Math.random() * 0.4) * scale
        );
        const rubble = new THREE.Mesh(rubbleGeo, wallMat);
        rubble.position.set(
            (Math.random() - 0.5) * 4 * scale,
            (Math.random() * 0.3) * scale,
            (Math.random() - 0.5) * 4 * scale
        );
        rubble.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rubble.castShadow = true;
        parent.add(rubble);
    }
}

/**
 * Creates a realistic tree with trunk and foliage
 */
export function createTree(position, scale = 1.0, terrainHeight = 0) {
    const treeGroup = new THREE.Group();
    
    // Trunk
    const trunkHeight = 3 * scale;
    const trunkRadius = 0.3 * scale;
    const trunkGeo = new THREE.CylinderGeometry(
        trunkRadius * 0.8,
        trunkRadius,
        trunkHeight,
        8,
        1
    );
    const trunkMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);
    
    // Foliage
    const foliageColors = [0x228B22, 0x32CD32, 0x006400];
    const numFoliageSpheres = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numFoliageSpheres; i++) {
        const foliageRadius = (1.2 + Math.random() * 0.8) * scale;
        const foliageGeo = new THREE.SphereGeometry(foliageRadius, 8, 6);
        const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const foliageMat = new THREE.MeshStandardMaterial({ 
            color: foliageColor,
            roughness: 0.7,
            metalness: 0.0
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        
        const foliageY = trunkHeight * 0.6 + (i * 0.8 * scale) + (Math.random() - 0.5) * scale;
        const offsetX = (Math.random() - 0.5) * 0.8 * scale;
        const offsetZ = (Math.random() - 0.5) * 0.8 * scale;
        
        foliage.position.set(offsetX, foliageY, offsetZ);
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        treeGroup.add(foliage);
    }
    
    treeGroup.position.copy(position);
    treeGroup.position.y = terrainHeight;
    
    treeGroup.userData = {
        isTree: true,
        health: 50,
        maxHealth: 50,
        collisionRadius: 1.5 * scale,
        originalPosition: position.clone(),
        originalRotation: treeGroup.rotation.clone(),
        scale: scale,
        isDestroyed: false
    };
    
    return treeGroup;
}

/**
 * Generates random buildings across the terrain
 */
export function generateBuildings(scene, existingObstacles = [], numBuildings = 12) {
    const buildings = [];
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 150;
    const padding = 20; // Distance from map edge
    const minBuildingDistance = 8; // Minimum distance between buildings
    const occupiedPositions = [];
    
    // Building types and their probabilities
    const buildingTypes = [
        { type: 'house', weight: 0.4 },
        { type: 'warehouse', weight: 0.2 },
        { type: 'tower', weight: 0.15 },
        { type: 'mosque', weight: 0.15 },
        { type: 'ruins', weight: 0.1 }
    ];
    
    // Add existing obstacles to occupied positions
    existingObstacles.forEach(obstacle => {
        occupiedPositions.push({
            position: obstacle.position.clone(),
            radius: 4
        });
    });
    
    let attempts = 0;
    const maxAttempts = numBuildings * 15;
    
    while (buildings.length < numBuildings && attempts < maxAttempts) {
        attempts++;
        
        // Generate random position
        const x = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
        const z = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
        const position = new THREE.Vector3(x, 0, z);
        
        // Check distance from other buildings
        let tooClose = false;
        for (const occupied of occupiedPositions) {
            const distance = position.distanceTo(occupied.position);
            if (distance < occupied.radius + minBuildingDistance) {
                tooClose = true;
                break;
            }
        }
        
        if (tooClose) continue;
        
        // Get terrain height
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        
        // Skip if terrain is too low (water areas)
        if (terrainHeight < 1.0) continue;
        
        // Select random building type
        const rand = Math.random();
        let cumulativeWeight = 0;
        let selectedType = 'house';
        
        for (const buildingType of buildingTypes) {
            cumulativeWeight += buildingType.weight;
            if (rand <= cumulativeWeight) {
                selectedType = buildingType.type;
                break;
            }
        }
        
        // Create building with random scale
        const scale = THREE.MathUtils.randFloat(0.8, 1.3);
        const building = createBuilding(position, selectedType, scale, terrainHeight);
        
        scene.add(building);
        buildings.push(building);
        
        // Add to occupied positions
        occupiedPositions.push({
            position: position.clone(),
            radius: building.userData.collisionRadius
        });
    }
    
    console.log(`Generated ${buildings.length} buildings in ${attempts} attempts`);
    return buildings;
}

/**
 * Generates trees with smart placement
 */
export function generateTrees(scene, existingObstacles = [], numTrees = 25) {
    const trees = [];
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 150;
    const padding = 12;
    const minTreeDistance = 4;
    const minObstacleDistance = 6;
    const occupiedPositions = [];
    
    // Add existing obstacles to occupied positions
    existingObstacles.forEach(obstacle => {
        occupiedPositions.push({
            position: obstacle.position.clone(),
            radius: obstacle.userData ? obstacle.userData.collisionRadius : 3
        });
    });
    
    let attempts = 0;
    const maxAttempts = numTrees * 15;
    
    while (trees.length < numTrees && attempts < maxAttempts) {
        attempts++;
        
        const x = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
        const z = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
        const position = new THREE.Vector3(x, 0, z);
        
        // Check distance from other objects
        let tooClose = false;
        for (const occupied of occupiedPositions) {
            const distance = position.distanceTo(occupied.position);
            const requiredDistance = occupied.radius + minTreeDistance;
            if (distance < requiredDistance) {
                tooClose = true;
                break;
            }
        }
        
        if (tooClose) continue;
        
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        if (terrainHeight < 0.8) continue; // Skip low areas
        
        const scale = THREE.MathUtils.randFloat(0.8, 1.5);
        const tree = createTree(position, scale, terrainHeight);
        
        scene.add(tree);
        trees.push(tree);
        
        occupiedPositions.push({
            position: position.clone(),
            radius: tree.userData.collisionRadius
        });
    }
    
    console.log(`Generated ${trees.length} trees in ${attempts} attempts`);
    return trees;
}