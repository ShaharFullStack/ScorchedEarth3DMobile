import * as THREE from 'three';

export function setupScene(scene, isMobile = false) {
    console.log(`Setting up scene for ${isMobile ? 'mobile' : 'desktop'} device`);
    
    // Sky background - simplified for mobile
    scene.background = new THREE.Color(0x87CEEB);
    
    // Enhanced fog system - lighter for mobile performance
    const fogIntensity = isMobile ? 0.012 : 0.016;
    scene.fog = new THREE.FogExp2(0x7fb3d5, fogIntensity);

    // Generate random seed for consistent randomness
    scene.userData.mapSeed = Math.random() * 1000;
    
    // Create terrain with mobile optimizations
    const groundSize = isMobile ? 100 : 150;  // Smaller terrain for mobile
    const segments = isMobile ? 48 : 96;      // Fewer segments for mobile performance
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, segments, segments);
    
    // Generate terrain with same algorithm but optimized complexity
    const vertices = groundGeo.attributes.position;
    const seed = scene.userData.mapSeed;
    
    for (let i = 0; i < vertices.count; i++) {
        const x_plane = vertices.getX(i);
        const y_plane = vertices.getY(i);
        
        // Distance from center for island shaping
        const distanceFromCenter = Math.sqrt(x_plane * x_plane + y_plane * y_plane);
        const maxDistance = groundSize / 2.2;
        
        // Simplified terrain generation for mobile
        const baseHeight = 2.0 + Math.sin(seed + x_plane * 0.02) * 0.5;
        
        let heightLayers;
        if (isMobile) {
            // Simplified terrain for mobile
            const largeDunes = (Math.sin((x_plane + seed * 10) * 0.08) * Math.cos((y_plane + seed * 15) * 0.06) + 1) / 2 * 4.0;
            const mediumDunes = (Math.sin((x_plane + seed * 25) * 0.15) * Math.cos((y_plane + seed * 30) * 0.12) + 1) / 2 * 2.0;
            heightLayers = largeDunes + mediumDunes;
        } else {
            // Full terrain complexity for desktop
            const largeDunes = (Math.sin((x_plane + seed * 10) * 0.08) * Math.cos((y_plane + seed * 15) * 0.06) + 1) / 2 * 6.0;
            const mediumDunes = (Math.sin((x_plane + seed * 25) * 0.15) * Math.cos((y_plane + seed * 30) * 0.12) + 1) / 2 * 3.0;
            const smallDunes = (Math.sin((x_plane + seed * 50) * 0.25) * Math.cos((y_plane + seed * 75) * 0.2) + 1) / 2 * 1.5;
            const undulation = Math.sin((x_plane + seed * 100) * 0.1 + Math.PI / 4) * Math.cos((y_plane + seed * 125) * 0.15 + Math.PI / 3) * 0.8;
            heightLayers = largeDunes + mediumDunes + smallDunes + undulation;
        }
        
        let heightBeforeLakes = baseHeight + heightLayers;
        let finalHeight = heightBeforeLakes;
        
        // Create island shape
        if (distanceFromCenter > maxDistance * 0.7) {
            const edgeFactor = Math.max(0, 1 - (distanceFromCenter - maxDistance * 0.7) / (maxDistance * 0.3));
            const smoothEdge = edgeFactor * edgeFactor * (3 - 2 * edgeFactor);
            finalHeight = finalHeight * smoothEdge;
        }
        
        // Create fewer water areas on mobile
        const oasisCount = isMobile ? 1 : 2;
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
        
        finalHeight = Math.max(finalHeight, 0.1);
        vertices.setZ(i, finalHeight);
    }
    
    groundGeo.computeVertexNormals();
    
    // Create ground material with mobile optimizations
    const groundTexture = createProceduralGroundTexture(isMobile);
    const normalTexture = isMobile ? null : createProceduralNormalTexture();
    const roughnessTexture = isMobile ? null : createRoughnessTexture();
    
    const materialConfig = {
        map: groundTexture,
        color: 0xa8956b,
        roughness: 0.9,
        metalness: 0.05
    };
    
    // Add normal and roughness maps only on desktop
    if (!isMobile) {
        materialConfig.normalMap = normalTexture;
        materialConfig.roughnessMap = roughnessTexture;
        materialConfig.normalScale = new THREE.Vector2(1.2, 1.2);
        materialConfig.envMapIntensity = 0.3;
    }
    
    const groundMat = new THREE.MeshStandardMaterial(materialConfig);
    
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !isMobile; // Disable shadow receiving on mobile
    scene.add(ground);
    
    // Add surrounding water (simplified for mobile)
    createSurroundingWater(scene, groundSize, isMobile);
    
    // Setup skybox (simplified for mobile)
    if (isMobile) {
        setupSimpleSkybox(scene);
    } else {
        setupOceanSkybox(scene);
    }
    
    // Store terrain data
    scene.userData.terrain = {
        geometry: groundGeo,
        size: groundSize,
        segments: segments,
        isMobile: isMobile,
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
            
            // Smaller deformation radius on mobile for performance
            const adjustedRadius = this.isMobile ? radius * 0.8 : radius;
            
            for (let i = 0; i < vertices.count; i++) {
                const planeVertexX = vertices.getX(i);
                const planeVertexY = vertices.getY(i);
                const currentPlaneHeight = vertices.getZ(i);
                const dx = planeVertexX - localImpact.x;
                const dy = planeVertexY - localImpact.y;
                const distanceSq = dx * dx + dy * dy;
                
                if (distanceSq < adjustedRadius * adjustedRadius) {
                    const distFactor = 1.0 - Math.sqrt(distanceSq) / adjustedRadius;
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
        },
        reduceQuality: function() {
            // Further reduce terrain quality if needed for performance
            console.log('Reducing terrain quality for better performance');
        }
    };

    // Enhanced lighting with mobile optimizations
    const ambientLight = new THREE.AmbientLight(0xddeeff, isMobile ? 0.7 : 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffeaa7, isMobile ? 0.8 : 1.0);
    directionalLight.position.set(50, 80, 30);
    
    if (!isMobile) {
        // Only enable shadows on desktop
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;  // Reduced from 4096 for performance
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        directionalLight.shadow.bias = -0.0001;
    }
    
    scene.add(directionalLight);
    
    // Add atmospheric particles only on desktop
    if (!isMobile) {
        createOceanAtmosphere(scene);
    }
}

/**
 * Creates a ground texture optimized for the target device
 */
function createProceduralGroundTexture(isMobile = false) {
    const canvas = document.createElement('canvas');
    const size = isMobile ? 512 : 1024; // Smaller texture for mobile
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Create base layer with varied terrain colors
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % size;
        const y = Math.floor((i / 4) / size);
        
        // Simplified noise for mobile
        const noiseComplexity = isMobile ? 2 : 4;
        let combined = 0;
        
        for (let j = 0; j < noiseComplexity; j++) {
            const scale = Math.pow(2, j) * 0.02;
            const amplitude = Math.pow(0.5, j);
            const noise = (Math.sin(x * scale + j * 123) * Math.cos(y * scale + j * 456) + 1) / 2;
            combined += noise * amplitude;
        }
        
        // Create different terrain types based on noise
        let r, g, b;
        
        if (combined > 0.7) {
            // Rocky areas
            r = Math.floor(120 + combined * 40);
            g = Math.floor(100 + combined * 35);
            b = Math.floor(80 + combined * 25);
        } else if (combined > 0.4) {
            // Sandy/dirt areas
            r = Math.floor(160 + combined * 50);
            g = Math.floor(140 + combined * 40);
            b = Math.floor(100 + combined * 30);
        } else {
            // Darker soil areas
            r = Math.floor(100 + combined * 30);
            g = Math.floor(85 + combined * 25);
            b = Math.floor(60 + combined * 20);
        }
        
        // Add random variation
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
    
    // Add detail patterns (fewer on mobile)
    if (!isMobile) {
        addDetailPatterns(ctx, size, size);
    } else {
        addMobileDetailPatterns(ctx, size, size);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(isMobile ? 8 : 12, isMobile ? 8 : 12);
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Simplified detail patterns for mobile
 */
function addMobileDetailPatterns(ctx, width, height) {
    // Simplified rock patterns for mobile
    for (let i = 0; i < 50; i++) { // Fewer than desktop
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 2 + Math.random() * 6; // Smaller sizes
        
        const brightness = 0.3 + Math.random() * 0.4;
        const r = Math.floor(brightness * 140);
        const g = Math.floor(brightness * 120);
        const b = Math.floor(brightness * 100);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Simplified dirt patterns
    for (let i = 0; i < 20; i++) { // Fewer than desktop
        const x = Math.random() * width;
        const y = Math.random() * height;
        const length = 10 + Math.random() * 30; // Shorter lines
        const angle = Math.random() * Math.PI * 2;
        
        ctx.strokeStyle = 'rgba(80, 60, 40, 0.2)'; // More transparent
        ctx.lineWidth = 1 + Math.random() * 2; // Thinner lines
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
    }
}

/**
 * Desktop detail patterns (keeping original implementation)
 */
function addDetailPatterns(ctx, width, height) {
    // Add rock scattered patterns
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 2 + Math.random() * 8;
        
        const brightness = 0.3 + Math.random() * 0.4;
        const r = Math.floor(brightness * 140);
        const g = Math.floor(brightness * 120);
        const b = Math.floor(brightness * 100);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
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
    
    // Add vegetation patches
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 5 + Math.random() * 15;
        
        ctx.fillStyle = `rgba(40, 60, 30, ${0.2 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        for (let j = 0; j < 5; j++) {
            const vegX = x + (Math.random() - 0.5) * size;
            const vegY = y + (Math.random() - 0.5) * size;
            ctx.fillStyle = `rgba(50, 80, 40, ${0.3 + Math.random() * 0.4})`;
            ctx.fillRect(vegX, vegY, 1, 2 + Math.random() * 3);
        }
    }
}

/**
 * Desktop-only normal texture
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
        
        const noise1 = Math.sin(x * 0.08) * Math.cos(y * 0.06);
        const noise2 = Math.sin(x * 0.15 + 100) * Math.cos(y * 0.12 + 200);
        const noise3 = Math.sin(x * 0.3 + 300) * Math.cos(y * 0.25 + 400);
        
        const combinedX = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2);
        const combinedY = (Math.cos(x * 0.06) * Math.sin(y * 0.08) * 0.5 + 
                          Math.cos(x * 0.12 + 150) * Math.sin(y * 0.15 + 250) * 0.3 +
                          Math.cos(x * 0.25 + 350) * Math.sin(y * 0.3 + 450) * 0.2);
        
        const nx = Math.floor((combinedX + 1) * 127.5);
        const ny = Math.floor((combinedY + 1) * 127.5);
        const nz = 200;
        
        data[i] = nx;
        data[i + 1] = ny;
        data[i + 2] = nz;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
}

/**
 * Desktop-only roughness texture
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
        
        const noise1 = (Math.sin(x * 0.03) * Math.cos(y * 0.03) + 1) / 2;
        const noise2 = (Math.sin(x * 0.08 + 50) * Math.cos(y * 0.08 + 100) + 1) / 2;
        
        const combined = noise1 * 0.7 + noise2 * 0.3;
        
        let roughness;
        if (combined > 0.6) {
            roughness = 180 + combined * 50;
        } else {
            roughness = 220 + combined * 35;
        }
        
        roughness = Math.max(150, Math.min(255, roughness));
        
        data[i] = roughness;
        data[i + 1] = roughness;
        data[i + 2] = roughness;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
}

/**
 * Simplified water for mobile
 */
function createSurroundingWater(scene, islandSize, isMobile = false) {
    const waterSize = islandSize * 3;
    const waterSegments = isMobile ? 32 : 64; // Fewer segments for mobile
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, waterSegments, waterSegments);
    
    let waterMaterial;
    
    if (isMobile) {
        // Simple water material for mobile
        waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x006994,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.9
        });
    } else {
        // Animated water material for desktop
        waterMaterial = new THREE.ShaderMaterial({
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
    }
    
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.5;
    scene.add(water);
    
    // Animate water only on desktop
    if (!isMobile && waterMaterial.uniforms) {
        function animateWater() {
            waterMaterial.uniforms.time.value = Date.now() * 0.001;
            requestAnimationFrame(animateWater);
        }
        animateWater();
    }
}

/**
 * Simple skybox for mobile
 */
function setupSimpleSkybox(scene) {
    const skyGeometry = new THREE.SphereGeometry(300, 16, 8); // Lower poly for mobile
    const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87CEEB,
        side: THREE.BackSide,
        fog: false
    });
    
    const skybox = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skybox);
}

/**
 * Advanced skybox for desktop
 */
function setupOceanSkybox(scene) {
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
                
                float horizon = abs(direction.y);
                vec3 skyColor = mix(
                    vec3(0.6, 0.8, 1.0),
                    vec3(0.2, 0.5, 0.9),
                    horizon * horizon
                );
                
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
    
    function animateSkybox() {
        skyMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateSkybox);
    }
    animateSkybox();
}

/**
 * Desktop-only atmospheric effects
 */
function createOceanAtmosphere(scene) {
    const mistGeometry = new THREE.BufferGeometry();
    const mistCount = 100;
    const positions = new Float32Array(mistCount * 3);
    const velocities = new Float32Array(mistCount * 3);
    
    for (let i = 0; i < mistCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 300;
        positions[i + 1] = Math.random() * 20 + 5;
        positions[i + 2] = (Math.random() - 0.5) * 300;
        
        velocities[i] = (Math.random() - 0.5) * 0.05;
        velocities[i + 1] = Math.random() * 0.02;
        velocities[i + 2] = (Math.random() - 0.5) * 0.05;
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
    
    function animateMist() {
        const positions = mistGeometry.attributes.position.array;
        const velocities = mistGeometry.attributes.velocity.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];
            
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

// Building and tree generation functions (optimized for mobile)

/**
 * Creates different types of buildings with mobile optimizations
 */
export function createBuilding(position, type = 'house', scale = 1.0, terrainHeight = 0, isMobile = false) {
    const buildingGroup = new THREE.Group();
    
    // Reduce building complexity on mobile
    const complexityMultiplier = isMobile ? 0.7 : 1.0;
    
    switch (type) {
        case 'house':
            createHouse(buildingGroup, scale * complexityMultiplier, isMobile);
            break;
        case 'tower':
            createTower(buildingGroup, scale * complexityMultiplier, isMobile);
            break;
        case 'warehouse':
            createWarehouse(buildingGroup, scale * complexityMultiplier, isMobile);
            break;
        case 'mosque':
            createMosque(buildingGroup, scale * complexityMultiplier, isMobile);
            break;
        case 'ruins':
            createRuins(buildingGroup, scale * complexityMultiplier, isMobile);
            break;
        default:
            createHouse(buildingGroup, scale * complexityMultiplier, isMobile);
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
        isDestroyed: false,
        isMobile: isMobile
    };
    
    return buildingGroup;
}

function createHouse(parent, scale, isMobile = false) {
    // Main structure
    const houseGeo = new THREE.BoxGeometry(4 * scale, 3 * scale, 4 * scale);
    const houseMat = new THREE.MeshStandardMaterial({ 
        color: 0xDEB887,
        roughness: 0.8,
        metalness: 0.1
    });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.y = 1.5 * scale;
    house.castShadow = !isMobile;
    house.receiveShadow = !isMobile;
    parent.add(house);
    
    // Roof (simplified for mobile)
    const roofGeometry = isMobile ? 
        new THREE.ConeGeometry(3 * scale, 2 * scale, 4) :  // Low poly for mobile
        new THREE.ConeGeometry(3 * scale, 2 * scale, 8);   // Higher poly for desktop
    
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9
    });
    const roof = new THREE.Mesh(roofGeometry, roofMat);
    roof.position.y = 4 * scale;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = !isMobile;
    parent.add(roof);
    
    // Simplified details for mobile
    if (!isMobile) {
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
}

function createTower(parent, scale, isMobile = false) {
    // Main tower (simplified geometry for mobile)
    const segments = isMobile ? 6 : 8;
    const towerGeo = new THREE.CylinderGeometry(2 * scale, 2.5 * scale, 8 * scale, segments);
    const towerMat = new THREE.MeshStandardMaterial({ 
        color: 0xA0A0A0,
        roughness: 0.9,
        metalness: 0.0
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 4 * scale;
    tower.castShadow = !isMobile;
    tower.receiveShadow = !isMobile;
    parent.add(tower);
    
    // Battlements (fewer for mobile)
    const battlementCount = isMobile ? 4 : 8;
    for (let i = 0; i < battlementCount; i++) {
        const battlementGeo = new THREE.BoxGeometry(0.5 * scale, 1 * scale, 0.5 * scale);
        const battlement = new THREE.Mesh(battlementGeo, towerMat);
        const angle = (i / battlementCount) * Math.PI * 2;
        battlement.position.x = Math.cos(angle) * 2.2 * scale;
        battlement.position.z = Math.sin(angle) * 2.2 * scale;
        battlement.position.y = 8.5 * scale;
        parent.add(battlement);
    }
}

function createWarehouse(parent, scale, isMobile = false) {
    // Main building
    const warehouseGeo = new THREE.BoxGeometry(6 * scale, 4 * scale, 8 * scale);
    const warehouseMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B8680,
        roughness: 0.7,
        metalness: 0.2
    });
    const warehouse = new THREE.Mesh(warehouseGeo, warehouseMat);
    warehouse.position.y = 2 * scale;
    warehouse.castShadow = !isMobile;
    warehouse.receiveShadow = !isMobile;
    parent.add(warehouse);
    
    // Roof
    const roofGeo = new THREE.BoxGeometry(6.5 * scale, 0.3 * scale, 8.5 * scale);
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: 0x708090,
        roughness: 0.6,
        metalness: 0.3
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4.15 * scale;
    roof.castShadow = !isMobile;
    parent.add(roof);
    
    // Door (desktop only for simplicity)
    if (!isMobile) {
        const doorGeo = new THREE.BoxGeometry(3 * scale, 3.5 * scale, 0.2 * scale);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 1.75 * scale, 4.1 * scale);
        parent.add(door);
    }
}

function createMosque(parent, scale, isMobile = false) {
    // Main building
    const mosqueGeo = new THREE.BoxGeometry(5 * scale, 4 * scale, 5 * scale);
    const mosqueMat = new THREE.MeshStandardMaterial({ 
        color: 0xF5DEB3,
        roughness: 0.8,
        metalness: 0.0
    });
    const mosque = new THREE.Mesh(mosqueGeo, mosqueMat);
    mosque.position.y = 2 * scale;
    mosque.castShadow = !isMobile;
    mosque.receiveShadow = !isMobile;
    parent.add(mosque);
    
    // Dome (simplified for mobile)
    const domeSegments = isMobile ? 8 : 16;
    const domeGeo = new THREE.SphereGeometry(2.8 * scale, domeSegments, domeSegments / 2, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ 
        color: 0x4169E1,
        roughness: 0.3,
        metalness: 0.1
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 4 * scale;
    dome.castShadow = !isMobile;
    parent.add(dome);
    
    // Minaret (simplified for mobile)
    const minaretSegments = isMobile ? 6 : 8;
    const minaretGeo = new THREE.CylinderGeometry(0.8 * scale, 1 * scale, 6 * scale, minaretSegments);
    const minaret = new THREE.Mesh(minaretGeo, mosqueMat);
    minaret.position.set(3.5 * scale, 3 * scale, 3.5 * scale);
    minaret.castShadow = !isMobile;
    parent.add(minaret);
    
    // Minaret top
    const minaretTopSegments = isMobile ? 6 : 8;
    const minaretTopGeo = new THREE.SphereGeometry(0.6 * scale, minaretTopSegments, minaretTopSegments);
    const minaretTop = new THREE.Mesh(minaretTopGeo, domeMat);
    minaretTop.position.set(3.5 * scale, 6.5 * scale, 3.5 * scale);
    parent.add(minaretTop);
}

function createRuins(parent, scale, isMobile = false) {
    // Broken walls
    const wallMat = new THREE.MeshStandardMaterial({ 
        color: 0x696969,
        roughness: 1.0,
        metalness: 0.0
    });
    
    // Wall 1 (partial)
    const wall1Geo = new THREE.BoxGeometry(4 * scale, 2.5 * scale, 0.5 * scale);
    const wall1 = new THREE.Mesh(wall1Geo, wallMat);
    wall1.position.set(0, 1.25 * scale, 2 * scale);
    wall1.rotation.z = Math.PI / 20;
    wall1.castShadow = !isMobile;
    wall1.receiveShadow = !isMobile;
    parent.add(wall1);
    
    // Wall 2 (broken)
    const wall2Geo = new THREE.BoxGeometry(0.5 * scale, 3 * scale, 3 * scale);
    const wall2 = new THREE.Mesh(wall2Geo, wallMat);
    wall2.position.set(2 * scale, 1.5 * scale, 0);
    wall2.rotation.x = -Math.PI / 25;
    wall2.castShadow = !isMobile;
    parent.add(wall2);
    
    // Rubble (fewer pieces on mobile)
    const rubbleCount = isMobile ? 3 : 5;
    for (let i = 0; i < rubbleCount; i++) {
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
        rubble.castShadow = !isMobile;
        parent.add(rubble);
    }
}

/**
 * Creates trees with mobile optimizations
 */
export function createTree(position, scale = 1.0, terrainHeight = 0, isMobile = false) {
    const treeGroup = new THREE.Group();
    
    // Trunk
    const trunkHeight = 3 * scale;
    const trunkRadius = 0.3 * scale;
    const trunkSegments = isMobile ? 6 : 8; // Fewer segments for mobile
    const trunkGeo = new THREE.CylinderGeometry(
        trunkRadius * 0.8,
        trunkRadius,
        trunkHeight,
        trunkSegments,
        1
    );
    const trunkMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = !isMobile;
    trunk.receiveShadow = !isMobile;
    treeGroup.add(trunk);
    
    // Foliage (simplified for mobile)
    const foliageColors = [0x228B22, 0x32CD32, 0x006400];
    const numFoliageSpheres = isMobile ? 2 : 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numFoliageSpheres; i++) {
        const foliageRadius = (1.2 + Math.random() * 0.8) * scale;
        const foliageSegments = isMobile ? 6 : 8; // Lower poly for mobile
        const foliageGeo = new THREE.SphereGeometry(foliageRadius, foliageSegments, foliageSegments);
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
        foliage.castShadow = !isMobile;
        foliage.receiveShadow = !isMobile;
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
        isDestroyed: false,
        isMobile: isMobile
    };
    
    return treeGroup;
}

/**
 * Generates buildings with mobile optimizations
 */
export function generateBuildings(scene, existingObstacles = [], numBuildings = 12) {
    const buildings = [];
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 150;
    const isMobile = terrain ? terrain.isMobile : false;
    
    // Adjust parameters based on device
    const padding = isMobile ? 15 : 20;
    const minBuildingDistance = isMobile ? 6 : 8;
    const occupiedPositions = [];
    
    // Building types and their probabilities (simplified for mobile)
    const buildingTypes = isMobile ? [
        { type: 'house', weight: 0.5 },
        { type: 'warehouse', weight: 0.3 },
        { type: 'ruins', weight: 0.2 }
    ] : [
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
    const maxAttempts = numBuildings * (isMobile ? 10 : 15); // Fewer attempts on mobile
    
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
        
        // Skip if terrain is too low
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
        
        // Create building with random scale (smaller range for mobile)
        const scaleRange = isMobile ? [0.9, 1.2] : [0.8, 1.3];
        const scale = THREE.MathUtils.randFloat(scaleRange[0], scaleRange[1]);
        const building = createBuilding(position, selectedType, scale, terrainHeight, isMobile);
        
        scene.add(building);
        buildings.push(building);
        
        // Add to occupied positions
        occupiedPositions.push({
            position: position.clone(),
            radius: building.userData.collisionRadius
        });
    }
    
    console.log(`Generated ${buildings.length} buildings in ${attempts} attempts for ${isMobile ? 'mobile' : 'desktop'}`);
    return buildings;
}

/**
 * Generates trees with mobile optimizations
 */
export function generateTrees(scene, existingObstacles = [], numTrees = 25) {
    const trees = [];
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 150;
    const isMobile = terrain ? terrain.isMobile : false;
    
    const padding = isMobile ? 8 : 12;
    const minTreeDistance = isMobile ? 3 : 4;
    const minObstacleDistance = isMobile ? 4 : 6;
    const occupiedPositions = [];
    
    // Add existing obstacles to occupied positions
    existingObstacles.forEach(obstacle => {
        occupiedPositions.push({
            position: obstacle.position.clone(),
            radius: obstacle.userData ? obstacle.userData.collisionRadius : 3
        });
    });
    
    let attempts = 0;
    const maxAttempts = numTrees * (isMobile ? 10 : 15);
    
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
        if (terrainHeight < 0.8) continue;
        
        // Smaller scale range for mobile
        const scaleRange = isMobile ? [0.9, 1.3] : [0.8, 1.5];
        const scale = THREE.MathUtils.randFloat(scaleRange[0], scaleRange[1]);
        const tree = createTree(position, scale, terrainHeight, isMobile);
        
        scene.add(tree);
        trees.push(tree);
        
        occupiedPositions.push({
            position: position.clone(),
            radius: tree.userData.collisionRadius
        });
    }
    
    console.log(`Generated ${trees.length} trees in ${attempts} attempts for ${isMobile ? 'mobile' : 'desktop'}`);
    return trees;
}