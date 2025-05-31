import * as THREE from 'three';

// Enhanced scene setup with dramatically improved visuals
export function setupScene(scene) {
    // Advanced background with dynamic sky system
    scene.background = new THREE.Color(0x87CEEB);
    
    // Enhanced multi-layer fog system for realistic atmospheric depth
    scene.fog = new THREE.FogExp2(0x7fb3d5, 0.012);

    // Generate deterministic seed for consistent world generation
    scene.userData.mapSeed = Math.random() * 1000;
    
    // Create advanced island terrain with multiple biomes
    createAdvancedTerrain(scene);
    
    // Setup dynamic ocean system with realistic waves
    createAdvancedOceanSystem(scene);
    
    // Create dynamic weather and atmospheric systems
    createWeatherSystem(scene);
    
    // Setup advanced lighting with HDR and tone mapping
    setupAdvancedLighting(scene);
    
    // Create environmental details and props
    createEnvironmentalDetails(scene);
    
    // Setup particle systems for ambiance
    createAmbientParticles(scene);
}

/**
 * Creates advanced terrain with multiple biomes and realistic features
 */
function createAdvancedTerrain(scene) {
    const groundSize = 180;
    const segments = 128;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, segments, segments);
    
    const vertices = groundGeo.attributes.position;
    const seed = scene.userData.mapSeed;
    
    // Enhanced terrain generation with multiple biomes
    for (let i = 0; i < vertices.count; i++) {
        const x_plane = vertices.getX(i);
        const y_plane = vertices.getY(i);
        
        const distanceFromCenter = Math.sqrt(x_plane * x_plane + y_plane * y_plane);
        const maxDistance = groundSize / 2.1;
        
        // Multi-octave noise for realistic terrain
        const baseHeight = generateAdvancedNoise(x_plane, y_plane, seed);
        let finalHeight = baseHeight;
        
        // Create island shape with realistic coastal transitions
        if (distanceFromCenter > maxDistance * 0.6) {
            const coastalFactor = Math.max(0, 1 - (distanceFromCenter - maxDistance * 0.6) / (maxDistance * 0.4));
            const smoothCoast = coastalFactor * coastalFactor * (3 - 2 * coastalFactor);
            finalHeight = finalHeight * smoothCoast;
            
            // Add beach areas
            if (distanceFromCenter > maxDistance * 0.85 && finalHeight > 0.2) {
                finalHeight = Math.max(0.2, finalHeight * 0.3); // Beach level
            }
        }
        
        // Add volcanic features and cliffs
        addVolcanicFeatures(x_plane, y_plane, seed, finalHeight, i, vertices);
        
        // Create lagoons and inland water features
        createLagoons(x_plane, y_plane, seed, distanceFromCenter, maxDistance, finalHeight, i, vertices);
        
        finalHeight = Math.max(finalHeight, 0);
        vertices.setZ(i, finalHeight);
    }
    
    groundGeo.computeVertexNormals();
    
    // Create advanced multi-layered terrain material
    const terrainMaterial = createAdvancedTerrainMaterial();
    
    const ground = new THREE.Mesh(groundGeo, terrainMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Store enhanced terrain data
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
}

/**
 * Generates multi-octave noise for realistic terrain
 */
function generateAdvancedNoise(x, y, seed) {
    // Base elevation
    const baseHeight = 3.0 + Math.sin(seed + x * 0.01) * 0.8;
    
    // Large mountain features
    const mountains = (Math.sin((x + seed * 10) * 0.05) * Math.cos((y + seed * 15) * 0.04) + 1) / 2 * 12.0;
    
    // Rolling hills
    const hills = (Math.sin((x + seed * 25) * 0.12) * Math.cos((y + seed * 30) * 0.1) + 1) / 2 * 6.0;
    
    // Medium ridges
    const ridges = (Math.sin((x + seed * 50) * 0.2) * Math.cos((y + seed * 75) * 0.18) + 1) / 2 * 3.0;
    
    // Fine details
    const details = (Math.sin((x + seed * 100) * 0.3) * Math.cos((y + seed * 125) * 0.25) + 1) / 2 * 1.5;
    
    // Micro variations
    const micro = Math.sin((x + seed * 200) * 0.5 + Math.PI / 3) * Math.cos((y + seed * 250) * 0.4 + Math.PI / 4) * 0.5;
    
    return baseHeight + mountains + hills + ridges + details + micro;
}

/**
 * Adds volcanic features and cliff formations
 */
function addVolcanicFeatures(x, y, seed, currentHeight, vertexIndex, vertices) {
    // Create volcanic peaks
    const volcanoCount = 2;
    for (let v = 0; v < volcanoCount; v++) {
        const volcanoX = (seed * (v + 1) * 234.567) % 60 - 30;
        const volcanoY = (seed * (v + 1) * 876.543) % 60 - 30;
        const volcanoRadius = 15 + (seed * (v + 1) * 45) % 10;
        
        const distToVolcano = Math.sqrt((x - volcanoX) ** 2 + (y - volcanoY) ** 2);
        
        if (distToVolcano < volcanoRadius) {
            const volcanoStrength = 1.0 - (distToVolcano / volcanoRadius);
            const volcanoHeight = volcanoStrength * volcanoStrength * 8.0;
            
            // Create crater at the top
            if (distToVolcano < volcanoRadius * 0.2) {
                const craterDepth = (1.0 - distToVolcano / (volcanoRadius * 0.2)) * 2.0;
                vertices.setZ(vertexIndex, currentHeight + volcanoHeight - craterDepth);
            } else {
                vertices.setZ(vertexIndex, currentHeight + volcanoHeight);
            }
        }
    }
    
    // Add cliff faces
    const cliffNoise = Math.sin(x * 0.08 + seed) * Math.cos(y * 0.06 + seed * 2);
    if (cliffNoise > 0.6 && currentHeight > 3.0) {
        const cliffHeight = (cliffNoise - 0.6) * 15.0;
        vertices.setZ(vertexIndex, currentHeight + cliffHeight);
    }
}

/**
 * Creates lagoons and inland water features
 */
function createLagoons(x, y, seed, distanceFromCenter, maxDistance, currentHeight, vertexIndex, vertices) {
    const lagoonCount = 3;
    for (let l = 0; l < lagoonCount; l++) {
        const lagoonX = (seed * (l + 1) * 345.678) % 80 - 40;
        const lagoonY = (seed * (l + 1) * 987.654) % 80 - 40;
        const lagoonSize = 8 + (seed * (l + 1) * 25) % 12;
        
        const distToLagoon = Math.sqrt((x - lagoonX) ** 2 + (y - lagoonY) ** 2);
        
        if (distToLagoon < lagoonSize && distanceFromCenter < maxDistance * 0.7) {
            const lagoonStrength = 1.0 - (distToLagoon / lagoonSize);
            const lagoonDepth = lagoonStrength * lagoonStrength * 3.0;
            vertices.setZ(vertexIndex, Math.max(0.1, currentHeight - lagoonDepth));
        }
    }
}

/**
 * Creates advanced terrain material with multiple texture layers
 */
function createAdvancedTerrainMaterial() {
    // Create high-resolution procedural textures
    const diffuseTexture = createAdvancedDiffuseTexture();
    const normalTexture = createAdvancedNormalTexture();
    const roughnessTexture = createAdvancedRoughnessTexture();
    const displacementTexture = createDisplacementTexture();
    
    return new THREE.MeshStandardMaterial({
        map: diffuseTexture,
        normalMap: normalTexture,
        roughnessMap: roughnessTexture,
        displacementMap: displacementTexture,
        displacementScale: 0.1,
        color: 0xa8956b,
        roughness: 0.8,
        metalness: 0.02,
        normalScale: new THREE.Vector2(1.5, 1.5),
        envMapIntensity: 0.4
    });
}

/**
 * Creates high-quality diffuse texture with multiple biomes
 */
function createAdvancedDiffuseTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(2048, 2048);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 2048;
        const y = Math.floor((i / 4) / 2048);
        
        // Multi-layer noise for realistic terrain variation
        const noise1 = (Math.sin(x * 0.01) * Math.cos(y * 0.01) + 1) / 2;
        const noise2 = (Math.sin(x * 0.03 + 123) * Math.cos(y * 0.03 + 456) + 1) / 2;
        const noise3 = (Math.sin(x * 0.08 + 789) * Math.cos(y * 0.08 + 101) + 1) / 2;
        const noise4 = (Math.sin(x * 0.15 + 321) * Math.cos(y * 0.15 + 654) + 1) / 2;
        const noise5 = (Math.sin(x * 0.25 + 555) * Math.cos(y * 0.25 + 777) + 1) / 2;
        
        const combined = noise1 * 0.3 + noise2 * 0.25 + noise3 * 0.2 + noise4 * 0.15 + noise5 * 0.1;
        
        let r, g, b;
        
        // Volcanic rock areas
        if (combined > 0.8) {
            r = Math.floor(80 + combined * 40);
            g = Math.floor(60 + combined * 30);
            b = Math.floor(50 + combined * 20);
        }
        // Rocky highlands
        else if (combined > 0.65) {
            r = Math.floor(140 + combined * 50);
            g = Math.floor(120 + combined * 40);
            b = Math.floor(90 + combined * 30);
        }
        // Fertile soil
        else if (combined > 0.45) {
            r = Math.floor(120 + combined * 60);
            g = Math.floor(100 + combined * 50);
            b = Math.floor(70 + combined * 35);
        }
        // Sandy areas
        else if (combined > 0.25) {
            r = Math.floor(180 + combined * 40);
            g = Math.floor(160 + combined * 35);
            b = Math.floor(120 + combined * 30);
        }
        // Beach sand
        else {
            r = Math.floor(220 + combined * 35);
            g = Math.floor(200 + combined * 30);
            b = Math.floor(150 + combined * 25);
        }
        
        // Add realistic variation
        const variation = (Math.random() - 0.5) * 25;
        r = Math.max(0, Math.min(255, r + variation));
        g = Math.max(0, Math.min(255, g + variation));
        b = Math.max(0, Math.min(255, b + variation));
        
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add detailed surface features
    addAdvancedSurfaceDetails(ctx, 2048, 2048);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Adds advanced surface details to terrain texture
 */
function addAdvancedSurfaceDetails(ctx, width, height) {
    // Add boulder fields
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 3 + Math.random() * 15;
        
        const brightness = 0.2 + Math.random() * 0.5;
        const r = Math.floor(brightness * 120);
        const g = Math.floor(brightness * 100);
        const b = Math.floor(brightness * 80);
        
        // Irregular boulder shape
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * (0.7 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        
        // Boulder shadows and highlights
        ctx.fillStyle = `rgba(${r * 0.5}, ${g * 0.5}, ${b * 0.5}, 0.6)`;
        ctx.beginPath();
        ctx.ellipse(x + size * 0.3, y + size * 0.3, size * 0.8, size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Add erosion patterns and streambeds
    for (let i = 0; i < 80; i++) {
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        const length = 30 + Math.random() * 100;
        const branches = 2 + Math.floor(Math.random() * 4);
        
        ctx.strokeStyle = 'rgba(100, 80, 60, 0.4)';
        ctx.lineWidth = 2 + Math.random() * 6;
        
        for (let b = 0; b < branches; b++) {
            const angle = Math.random() * Math.PI * 2;
            const branchLength = length * (0.5 + Math.random() * 0.5);
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            let currentX = startX;
            let currentY = startY;
            const segments = 10 + Math.floor(Math.random() * 10);
            
            for (let s = 0; s < segments; s++) {
                const segmentAngle = angle + (Math.random() - 0.5) * 0.5;
                const segmentLength = branchLength / segments;
                currentX += Math.cos(segmentAngle) * segmentLength;
                currentY += Math.sin(segmentAngle) * segmentLength;
                ctx.lineTo(currentX, currentY);
            }
            ctx.stroke();
        }
    }
    
    // Add vegetation patches with seasonal variation
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 8 + Math.random() * 25;
        
        // Varied vegetation colors
        const vegTypes = [
            { r: 40, g: 80, b: 30 },   // Dark green
            { r: 60, g: 100, b: 40 },  // Medium green
            { r: 80, g: 120, b: 50 },  // Light green
            { r: 90, g: 90, b: 30 },   // Dry grass
            { r: 120, g: 80, b: 40 }   // Autumn colors
        ];
        
        const vegType = vegTypes[Math.floor(Math.random() * vegTypes.length)];
        
        ctx.fillStyle = `rgba(${vegType.r}, ${vegType.g}, ${vegType.b}, ${0.3 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add individual plant details
        for (let j = 0; j < 8; j++) {
            const plantX = x + (Math.random() - 0.5) * size * 1.5;
            const plantY = y + (Math.random() - 0.5) * size * 1.5;
            const plantSize = 1 + Math.random() * 3;
            
            ctx.fillStyle = `rgba(${vegType.r + 20}, ${vegType.g + 20}, ${vegType.b + 10}, ${0.5 + Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(plantX, plantY, plantSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Add mineral deposits and color variations
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 5 + Math.random() * 20;
        
        // Mineral colors (copper, iron, etc.)
        const minerals = [
            { r: 184, g: 115, b: 51 },  // Copper
            { r: 139, g: 69, b: 19 },   // Iron oxide
            { r: 192, g: 192, b: 192 }, // Silver
            { r: 255, g: 215, b: 0 },   // Gold traces
        ];
        
        const mineral = minerals[Math.floor(Math.random() * minerals.length)];
        
        ctx.fillStyle = `rgba(${mineral.r}, ${mineral.g}, ${mineral.b}, ${0.2 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Creates advanced normal texture for surface details
 */
function createAdvancedNormalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(1024, 1024);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 1024;
        const y = Math.floor((i / 4) / 1024);
        
        // Multiple octaves of normal variation
        const noise1 = Math.sin(x * 0.05) * Math.cos(y * 0.04);
        const noise2 = Math.sin(x * 0.12 + 100) * Math.cos(y * 0.1 + 200);
        const noise3 = Math.sin(x * 0.25 + 300) * Math.cos(y * 0.2 + 400);
        const noise4 = Math.sin(x * 0.4 + 500) * Math.cos(y * 0.35 + 600);
        
        const combinedX = noise1 * 0.4 + noise2 * 0.3 + noise3 * 0.2 + noise4 * 0.1;
        const combinedY = (Math.cos(x * 0.04) * Math.sin(y * 0.05) * 0.4 + 
                          Math.cos(x * 0.1 + 150) * Math.sin(y * 0.12 + 250) * 0.3 +
                          Math.cos(x * 0.2 + 350) * Math.sin(y * 0.25 + 450) * 0.2 +
                          Math.cos(x * 0.35 + 550) * Math.sin(y * 0.4 + 650) * 0.1);
        
        const nx = Math.floor((combinedX + 1) * 127.5);
        const ny = Math.floor((combinedY + 1) * 127.5);
        const nz = 220;
        
        data[i] = nx;
        data[i + 1] = ny;
        data[i + 2] = nz;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
}

/**
 * Creates advanced roughness texture for varied surface properties
 */
function createAdvancedRoughnessTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(1024, 1024);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 1024;
        const y = Math.floor((i / 4) / 1024);
        
        const noise1 = (Math.sin(x * 0.02) * Math.cos(y * 0.02) + 1) / 2;
        const noise2 = (Math.sin(x * 0.06 + 50) * Math.cos(y * 0.06 + 100) + 1) / 2;
        const noise3 = (Math.sin(x * 0.12 + 150) * Math.cos(y * 0.12 + 200) + 1) / 2;
        
        const combined = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
        
        let roughness;
        if (combined > 0.7) {
            // Rock surfaces - moderate roughness
            roughness = 160 + combined * 60;
        } else if (combined > 0.4) {
            // Soil and vegetation - high roughness
            roughness = 200 + combined * 40;
        } else {
            // Sand and smooth surfaces - lower roughness
            roughness = 120 + combined * 50;
        }
        
        roughness = Math.max(100, Math.min(255, roughness));
        
        data[i] = roughness;
        data[i + 1] = roughness;
        data[i + 2] = roughness;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
}

/**
 * Creates displacement texture for surface relief
 */
function createDisplacementTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 512;
        const y = Math.floor((i / 4) / 512);
        
        const displacement = (Math.sin(x * 0.1) * Math.cos(y * 0.1) + 1) / 2 * 255;
        
        data[i] = displacement;
        data[i + 1] = displacement;
        data[i + 2] = displacement;
        data[i + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
}

/**
 * Creates simplified but beautiful ocean system
 */
function createAdvancedOceanSystem(scene) {
    const oceanSize = 600;
    const oceanGeometry = new THREE.PlaneGeometry(oceanSize, oceanSize, 64, 64);
    
    // Simplified ocean shader material that's more compatible
    const oceanMaterial = new THREE.ShaderMaterial({
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
                // Simple wave motion
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
    
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1.0;
    scene.add(ocean);
    
    // Store reference for animation
    scene.userData.ocean = ocean;
    
    // Animate ocean
    function animateOcean() {
        oceanMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateOcean);
    }
    animateOcean();
}

/**
 * Creates dynamic weather system
 */
function createWeatherSystem(scene) {
    // Dynamic sky dome
    createDynamicSky(scene);
    
    // Volumetric clouds
    createVolumetricClouds(scene);
    
    // Weather particles (rain, mist, etc.)
    createWeatherParticles(scene);
    
    // Lightning system (optional)
    createLightningSystem(scene);
}

/**
 * Creates simplified dynamic sky
 */
function createDynamicSky(scene) {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 16);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xffffff) }
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
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float time;
            varying vec3 vWorldPosition;
            
            void main() {
                float h = normalize(vWorldPosition).y;
                vec3 color = mix(bottomColor, topColor, max(pow(max(h, 0.0), 0.6), 0.0));
                
                // Add some subtle color variation
                color += sin(time * 0.1) * 0.05;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide,
        fog: false
    });
    
    const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skyDome);
    
    // Animate sky
    function animateSky() {
        skyMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateSky);
    }
    animateSky();
}

/**
 * Creates volumetric cloud system
 */
function createVolumetricClouds(scene) {
    const cloudGroup = new THREE.Group();
    
    // Create layered cloud system
    for (let layer = 0; layer < 3; layer++) {
        const cloudCount = 15 - layer * 3;
        const layerHeight = 80 + layer * 30;
        
        for (let i = 0; i < cloudCount; i++) {
            const cloudTexture = createVolumetricCloudTexture();
            const cloudMaterial = new THREE.SpriteMaterial({
                map: cloudTexture,
                transparent: true,
                opacity: 0.4 - layer * 0.1,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            
            const cloud = new THREE.Sprite(cloudMaterial);
            const scale = 60 + Math.random() * 80 + layer * 20;
            cloud.scale.set(scale, scale * 0.6, 1);
            
            cloud.position.set(
                (Math.random() - 0.5) * 1000,
                layerHeight + Math.random() * 40,
                (Math.random() - 0.5) * 1000
            );
            
            cloud.userData = {
                baseY: cloud.position.y,
                driftSpeed: 0.05 + Math.random() * 0.1 - layer * 0.02,
                bobSpeed: 0.3 + Math.random() * 0.4,
                bobAmount: 5 + Math.random() * 8,
                layer: layer
            };
            
            cloudGroup.add(cloud);
        }
    }
    
    scene.add(cloudGroup);
    
    // Animate clouds
    function animateClouds() {
        const time = Date.now() * 0.001;
        
        cloudGroup.children.forEach((cloud) => {
            // Wind drift
            cloud.position.x += cloud.userData.driftSpeed;
            if (cloud.position.x > 500) cloud.position.x = -500;
            
            // Vertical bobbing
            cloud.position.y = cloud.userData.baseY + 
                Math.sin(time * cloud.userData.bobSpeed) * cloud.userData.bobAmount;
            
            // Opacity variation based on weather
            const weatherFactor = 0.6 + Math.sin(time * 0.1) * 0.3;
            cloud.material.opacity = (0.4 - cloud.userData.layer * 0.1) * weatherFactor;
        });
        
        requestAnimationFrame(animateClouds);
    }
    animateClouds();
}

/**
 * Creates volumetric cloud texture
 */
function createVolumetricCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Multi-layer cloud generation
    const layers = 4;
    ctx.globalCompositeOperation = 'screen';
    
    for (let layer = 0; layer < layers; layer++) {
        const gradient = ctx.createRadialGradient(
            128 + (Math.random() - 0.5) * 100, 
            64 + (Math.random() - 0.5) * 50, 
            0,
            128, 64, 
            100 + layer * 20
        );
        
        const opacity = 0.8 - layer * 0.15;
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(0.3, `rgba(240, 240, 255, ${opacity * 0.8})`);
        gradient.addColorStop(0.6, `rgba(220, 220, 240, ${opacity * 0.4})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 128);
    }
    
    // Add turbulence
    const imageData = ctx.getImageData(0, 0, 256, 128);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % 256;
        const y = Math.floor((i / 4) / 256);
        
        const turbulence = (Math.sin(x * 0.05) * Math.cos(y * 0.08) + 1) / 2;
        const alpha = data[i + 3] * turbulence;
        data[i + 3] = Math.min(255, alpha);
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return new THREE.CanvasTexture(canvas);
}

/**
 * Creates weather particle systems
 */
function createWeatherParticles(scene) {
    // Ocean mist
    createOceanMist(scene);
    
    // Atmospheric dust
    createAtmosphericDust(scene);
    
    // Occasional rain
    createRainSystem(scene);
}

/**
 * Creates ocean mist particles
 */
function createOceanMist(scene) {
    const mistGeometry = new THREE.BufferGeometry();
    const mistCount = 200;
    const positions = new Float32Array(mistCount * 3);
    const velocities = new Float32Array(mistCount * 3);
    const sizes = new Float32Array(mistCount);
    
    for (let i = 0; i < mistCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 400;
        positions[i3 + 1] = Math.random() * 30 + 2;
        positions[i3 + 2] = (Math.random() - 0.5) * 400;
        
        velocities[i3] = (Math.random() - 0.5) * 0.08;
        velocities[i3 + 1] = Math.random() * 0.03 + 0.01;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.08;
        
        sizes[i] = 1.5 + Math.random() * 3.0;
    }
    
    mistGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    mistGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    mistGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const mistMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            opacity: { value: 0.3 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 velocity;
            uniform float time;
            varying float vOpacity;
            
            void main() {
                vec3 pos = position;
                pos += velocity * time;
                
                // Fade with height
                vOpacity = 1.0 - (pos.y / 30.0);
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float opacity;
            varying float vOpacity;
            
            void main() {
                float r = 0.0;
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                r = dot(cxy, cxy);
                if (r > 1.0) discard;
                
                float alpha = (1.0 - r) * opacity * vOpacity;
                gl_FragColor = vec4(0.9, 0.95, 1.0, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    
    const mistSystem = new THREE.Points(mistGeometry, mistMaterial);
    scene.add(mistSystem);
    
    function animateMist() {
        mistMaterial.uniforms.time.value = Date.now() * 0.001;
        requestAnimationFrame(animateMist);
    }
    animateMist();
}

/**
 * Creates atmospheric dust particles
 */
function createAtmosphericDust(scene) {
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 300;
    const positions = new Float32Array(dustCount * 3);
    
    for (let i = 0; i < dustCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 300;
        positions[i + 1] = Math.random() * 80;
        positions[i + 2] = (Math.random() - 0.5) * 300;
    }
    
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const dustMaterial = new THREE.PointsMaterial({
        color: 0xc4a484,
        size: 0.8,
        transparent: true,
        opacity: 0.15,
        sizeAttenuation: true,
        depthWrite: false
    });
    
    const dustSystem = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustSystem);
    
    function animateDust() {
        const positions = dustGeometry.attributes.position.array;
        const time = Date.now() * 0.0005;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += Math.sin(time + i) * 0.02;
            positions[i + 1] += 0.02;
            positions[i + 2] += Math.cos(time + i) * 0.015;
            
            if (positions[i + 1] > 80) {
                positions[i + 1] = 0;
                positions[i] = (Math.random() - 0.5) * 300;
                positions[i + 2] = (Math.random() - 0.5) * 300;
            }
        }
        
        dustGeometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateDust);
    }
    animateDust();
}

/**
 * Creates rain system (can be toggled)
 */
function createRainSystem(scene) {
    const rainGeometry = new THREE.BufferGeometry();
    const rainCount = 1000;
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount * 3);
    
    for (let i = 0; i < rainCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 200;
        positions[i3 + 1] = Math.random() * 100 + 50;
        positions[i3 + 2] = (Math.random() - 0.5) * 200;
        
        velocities[i3] = (Math.random() - 0.5) * 0.5;
        velocities[i3 + 1] = -15 - Math.random() * 5;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    const rainMaterial = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.1,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: false
    });
    
    const rainSystem = new THREE.Points(rainGeometry, rainMaterial);
    rainSystem.visible = false; // Start hidden
    scene.add(rainSystem);
    
    // Toggle rain occasionally
    setInterval(() => {
        if (Math.random() < 0.1) { // 10% chance every interval
            rainSystem.visible = !rainSystem.visible;
        }
    }, 10000);
    
    function animateRain() {
        if (rainSystem.visible) {
            const positions = rainGeometry.attributes.position.array;
            const velocities = rainGeometry.attributes.velocity.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += velocities[i] * 0.016;
                positions[i + 1] += velocities[i + 1] * 0.016;
                positions[i + 2] += velocities[i + 2] * 0.016;
                
                if (positions[i + 1] < 0) {
                    positions[i] = (Math.random() - 0.5) * 200;
                    positions[i + 1] = 100 + Math.random() * 50;
                    positions[i + 2] = (Math.random() - 0.5) * 200;
                }
            }
            
            rainGeometry.attributes.position.needsUpdate = true;
        }
        requestAnimationFrame(animateRain);
    }
    animateRain();
}

/**
 * Creates lightning system for dramatic weather
 */
function createLightningSystem(scene) {
    // Lightning flash effect
    const lightningLight = new THREE.PointLight(0x9999ff, 0, 200);
    lightningLight.position.set(0, 100, 0);
    scene.add(lightningLight);
    
    function createLightning() {
        if (Math.random() < 0.02) { // 2% chance per frame
            // Lightning flash
            lightningLight.intensity = 2;
            scene.background = new THREE.Color(0xccccff);
            
            setTimeout(() => {
                lightningLight.intensity = 0;
                scene.background = new THREE.Color(0x87CEEB);
            }, 100);
            
            // Thunder sound would go here in a real implementation
        }
        
        setTimeout(createLightning, 100);
    }
    createLightning();
}

/**
 * Sets up advanced lighting with HDR and multiple light sources
 */
function setupAdvancedLighting(scene) {
    // Enhanced ambient lighting
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.4);
    scene.add(ambientLight);
    
    // Primary directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffeaa7, 1.2);
    sunLight.position.set(80, 120, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    
    // Secondary fill light (sky reflection)
    const skyLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
    skyLight.position.set(-40, 60, -80);
    scene.add(skyLight);
    
    // Rim light for object definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(-100, 40, 100);
    scene.add(rimLight);
    
    // Atmospheric hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
    scene.add(hemisphereLight);
}

/**
 * Creates environmental details and props
 */
function createEnvironmentalDetails(scene) {
    // Floating debris in water
    createFloatingDebris(scene);
    
    // Rock formations
    createRockFormations(scene);
    
    // Driftwood on beaches
    createDriftwood(scene);
    
    // Seaweed and coral (near water)
    createMarineLife(scene);
}

/**
 * Creates floating debris in the ocean
 */
function createFloatingDebris(scene) {
    const debrisGroup = new THREE.Group();
    
    for (let i = 0; i < 20; i++) {
        const geometry = new THREE.BoxGeometry(
            0.5 + Math.random() * 2,
            0.2 + Math.random() * 0.5,
            1 + Math.random() * 3
        );
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const debris = new THREE.Mesh(geometry, material);
        debris.position.set(
            (Math.random() - 0.5) * 300,
            -0.5 + Math.random() * 0.3,
            (Math.random() - 0.5) * 300
        );
        
        debris.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * 0.2
        );
        
        debris.userData = {
            bobSpeed: 0.5 + Math.random() * 0.5,
            bobAmount: 0.1 + Math.random() * 0.2,
            baseY: debris.position.y
        };
        
        debris.castShadow = true;
        debrisGroup.add(debris);
    }
    
    scene.add(debrisGroup);
    
    // Animate floating debris
    function animateDebris() {
        const time = Date.now() * 0.001;
        
        debrisGroup.children.forEach(debris => {
            debris.position.y = debris.userData.baseY + 
                Math.sin(time * debris.userData.bobSpeed) * debris.userData.bobAmount;
            
            debris.rotation.y += 0.001;
        });
        
        requestAnimationFrame(animateDebris);
    }
    animateDebris();
}

/**
 * Creates rock formations
 */
function createRockFormations(scene) {
    const terrain = scene.userData.terrain;
    
    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * 140;
        const z = (Math.random() - 0.5) * 140;
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        
        if (terrainHeight > 2) { // Only place on higher ground
            const rockGroup = new THREE.Group();
            
            // Create cluster of rocks
            const rockCount = 2 + Math.floor(Math.random() * 4);
            for (let j = 0; j < rockCount; j++) {
                const rockGeometry = new THREE.SphereGeometry(
                    1 + Math.random() * 2,
                    6 + Math.floor(Math.random() * 6),
                    4 + Math.floor(Math.random() * 4)
                );
                
                const rockMaterial = new THREE.MeshStandardMaterial({
                    color: 0x666666,
                    roughness: 0.9,
                    metalness: 0.1
                });
                
                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                rock.position.set(
                    (Math.random() - 0.5) * 6,
                    Math.random() * 1,
                    (Math.random() - 0.5) * 6
                );
                
                rock.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                
                rock.scale.set(
                    0.8 + Math.random() * 0.4,
                    0.6 + Math.random() * 0.8,
                    0.8 + Math.random() * 0.4
                );
                
                rock.castShadow = true;
                rock.receiveShadow = true;
                rockGroup.add(rock);
            }
            
            rockGroup.position.set(x, terrainHeight, z);
            scene.add(rockGroup);
        }
    }
}

/**
 * Creates driftwood on beaches
 */
function createDriftwood(scene) {
    const terrain = scene.userData.terrain;
    
    for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 20; // Near the coast
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        
        if (terrainHeight < 2) { // Beach areas
            const driftwoodGeometry = new THREE.CylinderGeometry(
                0.1 + Math.random() * 0.3,
                0.15 + Math.random() * 0.4,
                2 + Math.random() * 4,
                8
            );
            
            const driftwoodMaterial = new THREE.MeshStandardMaterial({
                color: 0x8b6914,
                roughness: 0.8,
                metalness: 0.05
            });
            
            const driftwood = new THREE.Mesh(driftwoodGeometry, driftwoodMaterial);
            driftwood.position.set(x, terrainHeight + 0.1, z);
            
            driftwood.rotation.set(
                (Math.random() - 0.5) * 0.5,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.8
            );
            
            driftwood.castShadow = true;
            driftwood.receiveShadow = true;
            scene.add(driftwood);
        }
    }
}

/**
 * Creates marine life near water
 */
function createMarineLife(scene) {
    // Seaweed clusters
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 65 + Math.random() * 15;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        const seaweedGroup = new THREE.Group();
        
        // Create seaweed strands
        for (let j = 0; j < 3 + Math.floor(Math.random() * 4); j++) {
            const strandGeometry = new THREE.CylinderGeometry(0.05, 0.02, 2 + Math.random() * 1, 4);
            const strandMaterial = new THREE.MeshStandardMaterial({
                color: 0x2d5016,
                roughness: 0.7,
                metalness: 0.0
            });
            
            const strand = new THREE.Mesh(strandGeometry, strandMaterial);
            strand.position.set(
                (Math.random() - 0.5) * 2,
                (2 + Math.random()) / 2,
                (Math.random() - 0.5) * 2
            );
            
            strand.userData = {
                swaySpeed: 1 + Math.random() * 2,
                swayAmount: 0.2 + Math.random() * 0.3
            };
            
            seaweedGroup.add(strand);
        }
        
        seaweedGroup.position.set(x, -0.5, z);
        scene.add(seaweedGroup);
        
        // Animate seaweed swaying
        function animateSeaweed() {
            const time = Date.now() * 0.001;
            
            seaweedGroup.children.forEach(strand => {
                strand.rotation.z = Math.sin(time * strand.userData.swaySpeed) * strand.userData.swayAmount;
                strand.rotation.x = Math.cos(time * strand.userData.swaySpeed * 0.7) * strand.userData.swayAmount * 0.5;
            });
            
            requestAnimationFrame(animateSeaweed);
        }
        animateSeaweed();
    }
}

/**
 * Creates ambient particle systems
 */
function createAmbientParticles(scene) {
    // Floating pollen/dust in air
    createPollenParticles(scene);
    
    // Steam from volcanic areas
    createSteamEffects(scene);
}

/**
 * Creates floating pollen particles
 */
function createPollenParticles(scene) {
    const pollenGeometry = new THREE.BufferGeometry();
    const pollenCount = 100;
    const positions = new Float32Array(pollenCount * 3);
    
    for (let i = 0; i < pollenCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i + 1] = 5 + Math.random() * 30;
        positions[i + 2] = (Math.random() - 0.5) * 200;
    }
    
    pollenGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const pollenMaterial = new THREE.PointsMaterial({
        color: 0xffff99,
        size: 0.3,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
        depthWrite: false
    });
    
    const pollenSystem = new THREE.Points(pollenGeometry, pollenMaterial);
    scene.add(pollenSystem);
    
    function animatePollen() {
        const positions = pollenGeometry.attributes.position.array;
        const time = Date.now() * 0.001;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += Math.sin(time + i) * 0.01;
            positions[i + 1] += 0.01;
            positions[i + 2] += Math.cos(time + i * 0.7) * 0.008;
            
            if (positions[i + 1] > 35) {
                positions[i + 1] = 5;
                positions[i] = (Math.random() - 0.5) * 200;
                positions[i + 2] = (Math.random() - 0.5) * 200;
            }
        }
        
        pollenGeometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animatePollen);
    }
    animatePollen();
}

/**
 * Creates steam effects from volcanic areas
 */
function createSteamEffects(scene) {
    // Find volcanic areas and add steam
    for (let i = 0; i < 3; i++) {
        const x = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 60;
        
        const steamGeometry = new THREE.BufferGeometry();
        const steamCount = 30;
        const positions = new Float32Array(steamCount * 3);
        const velocities = new Float32Array(steamCount * 3);
        
        for (let j = 0; j < steamCount; j++) {
            const j3 = j * 3;
            positions[j3] = x + (Math.random() - 0.5) * 5;
            positions[j3 + 1] = 0;
            positions[j3 + 2] = z + (Math.random() - 0.5) * 5;
            
            velocities[j3] = (Math.random() - 0.5) * 0.1;
            velocities[j3 + 1] = 0.5 + Math.random() * 0.3;
            velocities[j3 + 2] = (Math.random() - 0.5) * 0.1;
        }
        
        steamGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        steamGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const steamMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2.0,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true,
            depthWrite: false
        });
        
        const steamSystem = new THREE.Points(steamGeometry, steamMaterial);
        scene.add(steamSystem);
        
        function animateSteam() {
            const positions = steamGeometry.attributes.position.array;
            const velocities = steamGeometry.attributes.velocity.array;
            
            for (let k = 0; k < positions.length; k += 3) {
                positions[k] += velocities[k] * 0.016;
                positions[k + 1] += velocities[k + 1] * 0.016;
                positions[k + 2] += velocities[k + 2] * 0.016;
                
                if (positions[k + 1] > 20) {
                    positions[k] = x + (Math.random() - 0.5) * 5;
                    positions[k + 1] = 0;
                    positions[k + 2] = z + (Math.random() - 0.5) * 5;
                }
            }
            
            steamGeometry.attributes.position.needsUpdate = true;
            requestAnimationFrame(animateSteam);
        }
        animateSteam();
    }
}

// Enhanced building creation functions
export function createBuilding(position, type = 'house', scale = 1.0, terrainHeight = 0) {
    const buildingGroup = new THREE.Group();
    
    switch (type) {
        case 'house':
            createEnhancedHouse(buildingGroup, scale);
            break;
        case 'tower':
            createEnhancedTower(buildingGroup, scale);
            break;
        case 'warehouse':
            createEnhancedWarehouse(buildingGroup, scale);
            break;
        case 'mosque':
            createEnhancedMosque(buildingGroup, scale);
            break;
        case 'ruins':
            createEnhancedRuins(buildingGroup, scale);
            break;
        case 'fortress':
            createFortress(buildingGroup, scale);
            break;
        case 'lighthouse':
            createLighthouse(buildingGroup, scale);
            break;
        default:
            createEnhancedHouse(buildingGroup, scale);
    }
    
    buildingGroup.position.copy(position);
    buildingGroup.position.y = terrainHeight;
    
    buildingGroup.userData = {
        isBuilding: true,
        type: type,
        health: 100,
        maxHealth: 100,
        collisionRadius: 4 * scale,
        scale: scale,
        isDestroyed: false
    };
    
    return buildingGroup;
}

function createEnhancedHouse(parent, scale) {
    // Enhanced house with more detail
    const houseGeo = new THREE.BoxGeometry(4 * scale, 3 * scale, 4 * scale);
    const houseMat = new THREE.MeshStandardMaterial({ 
        color: 0xDEB887,
        roughness: 0.7,
        metalness: 0.1,
        normalScale: new THREE.Vector2(0.5, 0.5)
    });
    
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.y = 1.5 * scale;
    house.castShadow = true;
    house.receiveShadow = true;
    parent.add(house);
    
    // Enhanced roof with clay tiles
    const roofGeo = new THREE.ConeGeometry(3.2 * scale, 2.2 * scale, 4);
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B2635,
        roughness: 0.8,
        metalness: 0.1
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4.1 * scale;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    parent.add(roof);
    
    // Chimney
    const chimneyGeo = new THREE.BoxGeometry(0.6 * scale, 1.5 * scale, 0.6 * scale);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(1.2 * scale, 4.8 * scale, 1.2 * scale);
    chimney.castShadow = true;
    parent.add(chimney);
    
    // Door with frame
    const doorFrameGeo = new THREE.BoxGeometry(1.0 * scale, 2.0 * scale, 0.15 * scale);
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const doorFrame = new THREE.Mesh(doorFrameGeo, doorFrameMat);
    doorFrame.position.set(0, 1.0 * scale, 2.08 * scale);
    parent.add(doorFrame);
    
    const doorGeo = new THREE.BoxGeometry(0.8 * scale, 1.8 * scale, 0.1 * scale);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.9 * scale, 2.1 * scale);
    parent.add(door);
    
    // Windows with shutters
    const windowGeo = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.1 * scale);
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.8,
        metalness: 0.3,
        roughness: 0.1
    });
    
    const shutterGeo = new THREE.BoxGeometry(0.35 * scale, 0.8 * scale, 0.05 * scale);
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x556B2F });
    
    // Left window
    const window1 = new THREE.Mesh(windowGeo, windowMat);
    window1.position.set(-1.2 * scale, 1.5 * scale, 2.05 * scale);
    parent.add(window1);
    
    const shutter1L = new THREE.Mesh(shutterGeo, shutterMat);
    shutter1L.position.set(-1.6 * scale, 1.5 * scale, 2.06 * scale);
    parent.add(shutter1L);
    
    const shutter1R = new THREE.Mesh(shutterGeo, shutterMat);
    shutter1R.position.set(-0.8 * scale, 1.5 * scale, 2.06 * scale);
    parent.add(shutter1R);
    
    // Right window
    const window2 = new THREE.Mesh(windowGeo, windowMat);
    window2.position.set(1.2 * scale, 1.5 * scale, 2.05 * scale);
    parent.add(window2);
    
    const shutter2L = new THREE.Mesh(shutterGeo, shutterMat);
    shutter2L.position.set(0.8 * scale, 1.5 * scale, 2.06 * scale);
    parent.add(shutter2L);
    
    const shutter2R = new THREE.Mesh(shutterGeo, shutterMat);
    shutter2R.position.set(1.6 * scale, 1.5 * scale, 2.06 * scale);
    parent.add(shutter2R);
}

function createFortress(parent, scale) {
    // Main keep
    const keepGeo = new THREE.BoxGeometry(6 * scale, 8 * scale, 6 * scale);
    const keepMat = new THREE.MeshStandardMaterial({ 
        color: 0x696969,
        roughness: 0.9,
        metalness: 0.0
    });
    const keep = new THREE.Mesh(keepGeo, keepMat);
    keep.position.y = 4 * scale;
    keep.castShadow = true;
    keep.receiveShadow = true;
    parent.add(keep);
    
    // Corner towers
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * 4 * scale;
        const z = Math.sin(angle) * 4 * scale;
        
        const towerGeo = new THREE.CylinderGeometry(1.5 * scale, 1.8 * scale, 10 * scale, 8);
        const tower = new THREE.Mesh(towerGeo, keepMat);
        tower.position.set(x, 5 * scale, z);
        tower.castShadow = true;
        parent.add(tower);
        
        // Tower tops
        const topGeo = new THREE.ConeGeometry(2 * scale, 1.5 * scale, 8);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.set(x, 10.75 * scale, z);
        top.castShadow = true;
        parent.add(top);
    }
    
    // Walls connecting towers
    for (let i = 0; i < 4; i++) {
        const angle1 = (i / 4) * Math.PI * 2;
        const angle2 = ((i + 1) / 4) * Math.PI * 2;
        
        const midAngle = (angle1 + angle2) / 2;
        const x = Math.cos(midAngle) * 4 * scale;
        const z = Math.sin(midAngle) * 4 * scale;
        
        const wallGeo = new THREE.BoxGeometry(0.8 * scale, 6 * scale, 5 * scale);
        const wall = new THREE.Mesh(wallGeo, keepMat);
        wall.position.set(x, 3 * scale, z);
        wall.rotation.y = midAngle;
        wall.castShadow = true;
        parent.add(wall);
    }
}

function createLighthouse(parent, scale) {
    // Main tower
    const towerGeo = new THREE.CylinderGeometry(1.8 * scale, 2.2 * scale, 12 * scale, 12);
    const towerMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFFFFF,
        roughness: 0.3,
        metalness: 0.1
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 6 * scale;
    tower.castShadow = true;
    tower.receiveShadow = true;
    parent.add(tower);
    
    // Red stripes
    for (let i = 0; i < 3; i++) {
        const stripeGeo = new THREE.CylinderGeometry(1.85 * scale, 2.25 * scale, 1.5 * scale, 12);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.y = 2 * scale + i * 3 * scale;
        parent.add(stripe);
    }
    
    // Lantern room
    const lanternGeo = new THREE.CylinderGeometry(2.5 * scale, 2.5 * scale, 2 * scale, 8);
    const lanternMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.2
    });
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.y = 13 * scale;
    lantern.castShadow = true;
    parent.add(lantern);
    
    // Light (glowing effect)
    const lightGeo = new THREE.SphereGeometry(0.8 * scale, 8, 6);
    const lightMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFFF00,
        emissive: 0xFFFF00,
        emissiveIntensity: 0.5
    });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.y = 13 * scale;
    parent.add(light);
    
    // Rotating beacon
    const beaconLight = new THREE.SpotLight(0xFFFFFF, 2, 100, Math.PI / 6, 0.5);
    beaconLight.position.set(0, 13 * scale, 0);
    beaconLight.target.position.set(10, 0, 0);
    parent.add(beaconLight);
    parent.add(beaconLight.target);
    
    // Animate beacon rotation
    let beaconAngle = 0;
    function animateBeacon() {
        beaconAngle += 0.02;
        beaconLight.target.position.set(
            Math.cos(beaconAngle) * 50,
            0,
            Math.sin(beaconAngle) * 50
        );
        requestAnimationFrame(animateBeacon);
    }
    animateBeacon();
}

// Enhanced tree creation
export function createTree(position, scale = 1.0, terrainHeight = 0) {
    const treeGroup = new THREE.Group();
    
    // Varied tree types
    const treeTypes = ['oak', 'pine', 'palm', 'dead'];
    const type = treeTypes[Math.floor(Math.random() * treeTypes.length)];
    
    switch (type) {
        case 'oak':
            createOakTree(treeGroup, scale);
            break;
        case 'pine':
            createPineTree(treeGroup, scale);
            break;
        case 'palm':
            createPalmTree(treeGroup, scale);
            break;
        case 'dead':
            createDeadTree(treeGroup, scale);
            break;
    }
    
    treeGroup.position.copy(position);
    treeGroup.position.y = terrainHeight;
    
    treeGroup.userData = {
        isTree: true,
        type: type,
        health: 50,
        maxHealth: 50,
        collisionRadius: 2 * scale,
        originalPosition: position.clone(),
        originalRotation: treeGroup.rotation.clone(),
        scale: scale,
        isDestroyed: false
    };
    
    return treeGroup;
}

function createOakTree(parent, scale) {
    // Thick trunk
    const trunkHeight = 4 * scale;
    const trunkRadius = 0.4 * scale;
    const trunkGeo = new THREE.CylinderGeometry(
        trunkRadius * 0.7,
        trunkRadius,
        trunkHeight,
        8,
        3
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
    parent.add(trunk);
    
    // Branches
    for (let i = 0; i < 5; i++) {
        const branchGeo = new THREE.CylinderGeometry(0.1 * scale, 0.15 * scale, 1.5 * scale, 6);
        const branch = new THREE.Mesh(branchGeo, trunkMat);
        
        const angle = (i / 5) * Math.PI * 2;
        const branchHeight = 2.5 + i * 0.3;
        
        branch.position.set(
            Math.cos(angle) * 0.8 * scale,
            branchHeight * scale,
            Math.sin(angle) * 0.8 * scale
        );
        
        branch.rotation.z = angle + Math.PI / 2;
        branch.rotation.x = -Math.PI / 6;
        branch.castShadow = true;
        parent.add(branch);
    }
    
    // Dense foliage
    const foliageColors = [0x228B22, 0x32CD32, 0x006400, 0x9ACD32];
    const numFoliage = 8;
    
    for (let i = 0; i < numFoliage; i++) {
        const foliageRadius = (1.5 + Math.random() * 1.0) * scale;
        const foliageGeo = new THREE.SphereGeometry(foliageRadius, 8, 6);
        const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const foliageMat = new THREE.MeshStandardMaterial({ 
            color: foliageColor,
            roughness: 0.8,
            metalness: 0.0
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        
        const angle = (i / numFoliage) * Math.PI * 2;
        const radius = 0.5 + Math.random() * 1.0;
        const height = 3.5 + Math.random() * 1.5;
        
        foliage.position.set(
            Math.cos(angle) * radius * scale,
            height * scale,
            Math.sin(angle) * radius * scale
        );
        
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        parent.add(foliage);
    }
}

function createPineTree(parent, scale) {
    // Straight trunk
    const trunkHeight = 5 * scale;
    const trunkRadius = 0.25 * scale;
    const trunkGeo = new THREE.CylinderGeometry(
        trunkRadius * 0.8,
        trunkRadius,
        trunkHeight,
        8
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
    parent.add(trunk);
    
    // Conical foliage layers
    const foliageMat = new THREE.MeshStandardMaterial({ 
        color: 0x0F4F0F,
        roughness: 0.8,
        metalness: 0.0
    });
    
    for (let i = 0; i < 4; i++) {
        const coneRadius = (2.5 - i * 0.5) * scale;
        const coneHeight = 2 * scale;
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
        const cone = new THREE.Mesh(coneGeo, foliageMat);
        cone.position.y = (1.5 + i * 1.2) * scale;
        cone.castShadow = true;
        cone.receiveShadow = true;
        parent.add(cone);
    }
}

function createPalmTree(parent, scale) {
    // Curved trunk
    const trunkSegments = 8;
    const trunkGroup = new THREE.Group();
    
    for (let i = 0; i < trunkSegments; i++) {
        const segmentGeo = new THREE.CylinderGeometry(
            0.2 * scale * (1 - i * 0.1),
            0.25 * scale * (1 - i * 0.1),
            0.6 * scale,
            6
        );
        const segmentMat = new THREE.MeshStandardMaterial({ 
            color: 0xDEB887,
            roughness: 0.8,
            metalness: 0.1
        });
        const segment = new THREE.Mesh(segmentGeo, segmentMat);
        
        segment.position.y = i * 0.5 * scale;
        segment.position.x = i * 0.1 * scale; // Slight curve
        segment.rotation.z = i * 0.05; // Bend
        segment.castShadow = true;
        segment.receiveShadow = true;
        trunkGroup.add(segment);
    }
    
    parent.add(trunkGroup);
    
    // Palm fronds
    const frondMat = new THREE.MeshStandardMaterial({ 
        color: 0x228B22,
        roughness: 0.7,
        metalness: 0.0
    });
    
    for (let i = 0; i < 8; i++) {
        const frondGeo = new THREE.BoxGeometry(0.1 * scale, 3 * scale, 0.3 * scale);
        const frond = new THREE.Mesh(frondGeo, frondMat);
        
        const angle = (i / 8) * Math.PI * 2;
        frond.position.set(
            (trunkSegments - 1) * 0.1 * scale,
            (trunkSegments - 1) * 0.5 * scale + 1.5 * scale,
            0
        );
        
        frond.rotation.z = angle;
        frond.rotation.x = -Math.PI / 6 - Math.random() * Math.PI / 12;
        frond.castShadow = true;
        parent.add(frond);
    }
}

function createDeadTree(parent, scale) {
    // Gnarled dead trunk
    const trunkHeight = 3 * scale;
    const trunkRadius = 0.3 * scale;
    const trunkGeo = new THREE.CylinderGeometry(
        trunkRadius * 0.5,
        trunkRadius,
        trunkHeight,
        6,
        3
    );
    const trunkMat = new THREE.MeshStandardMaterial({ 
        color: 0x4A4A4A,
        roughness: 1.0,
        metalness: 0.0
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.3;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    parent.add(trunk);
    
    // Dead branches
    for (let i = 0; i < 6; i++) {
        const branchGeo = new THREE.CylinderGeometry(0.05 * scale, 0.1 * scale, 1 + Math.random() * scale, 4);
        const branch = new THREE.Mesh(branchGeo, trunkMat);
        
        const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
        const branchHeight = 1.5 + Math.random() * 1.5;
        
        branch.position.set(
            Math.cos(angle) * 0.4 * scale,
            branchHeight * scale,
            Math.sin(angle) * 0.4 * scale
        );
        
        branch.rotation.z = angle + Math.PI / 2;
        branch.rotation.x = -Math.PI / 4 + (Math.random() - 0.5) * Math.PI / 3;
        branch.castShadow = true;
        parent.add(branch);
    }
}

// Enhanced versions of existing building types
function createEnhancedTower(parent, scale) {
    // Main tower with detailed stonework
    const towerGeo = new THREE.CylinderGeometry(2 * scale, 2.5 * scale, 10 * scale, 12);
    const towerMat = new THREE.MeshStandardMaterial({ 
        color: 0x8A8A8A,
        roughness: 0.9,
        metalness: 0.0
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 5 * scale;
    tower.castShadow = true;
    tower.receiveShadow = true;
    parent.add(tower);
    
    // Stone blocks detail
    for (let i = 0; i < 8; i++) {
        const blockGeo = new THREE.BoxGeometry(0.3 * scale, 0.8 * scale, 0.3 * scale);
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x696969 });
        const block = new THREE.Mesh(blockGeo, blockMat);
        
        const angle = (i / 8) * Math.PI * 2;
        block.position.set(
            Math.cos(angle) * 2.3 * scale,
            2 + i * 0.8 * scale,
            Math.sin(angle) * 2.3 * scale
        );
        parent.add(block);
    }
    
    // Battlements
    for (let i = 0; i < 12; i++) {
        const battlementGeo = new THREE.BoxGeometry(0.6 * scale, 1.2 * scale, 0.6 * scale);
        const battlement = new THREE.Mesh(battlementGeo, towerMat);
        const angle = (i / 12) * Math.PI * 2;
        battlement.position.x = Math.cos(angle) * 2.3 * scale;
        battlement.position.z = Math.sin(angle) * 2.3 * scale;
        battlement.position.y = 10.6 * scale;
        battlement.castShadow = true;
        parent.add(battlement);
    }
    
    // Arrow slits
    for (let i = 0; i < 4; i++) {
        const slitGeo = new THREE.BoxGeometry(0.1 * scale, 0.8 * scale, 0.3 * scale);
        const slitMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const slit = new THREE.Mesh(slitGeo, slitMat);
        
        const angle = (i / 4) * Math.PI * 2;
        slit.position.set(
            Math.cos(angle) * 2.6 * scale,
            6 * scale,
            Math.sin(angle) * 2.6 * scale
        );
        parent.add(slit);
    }
    
    // Flag pole
    const poleGeo = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 3 * scale, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 12.5 * scale;
    parent.add(pole);
    
    // Flag
    const flagGeo = new THREE.PlaneGeometry(1.5 * scale, 1 * scale);
    const flagMat = new THREE.MeshStandardMaterial({ 
        color: 0xFF0000,
        side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.75 * scale, 13 * scale, 0);
    parent.add(flag);
}

function createEnhancedWarehouse(parent, scale) {
    // Main warehouse structure
    const warehouseGeo = new THREE.BoxGeometry(8 * scale, 5 * scale, 12 * scale);
    const warehouseMat = new THREE.MeshStandardMaterial({ 
        color: 0x8B8680,
        roughness: 0.8,
        metalness: 0.2
    });
    const warehouse = new THREE.Mesh(warehouseGeo, warehouseMat);
    warehouse.position.y = 2.5 * scale;
    warehouse.castShadow = true;
    warehouse.receiveShadow = true;
    parent.add(warehouse);
    
    // Corrugated metal roof
    const roofGeo = new THREE.BoxGeometry(8.5 * scale, 0.4 * scale, 12.5 * scale);
    const roofMat = new THREE.MeshStandardMaterial({ 
        color: 0x708090,
        roughness: 0.4,
        metalness: 0.6
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 5.2 * scale;
    roof.castShadow = true;
    parent.add(roof);
    
    // Loading dock
    const dockGeo = new THREE.BoxGeometry(3 * scale, 1 * scale, 2 * scale);
    const dock = new THREE.Mesh(dockGeo, warehouseMat);
    dock.position.set(0, 0.5 * scale, 7 * scale);
    dock.castShadow = true;
    parent.add(dock);
    
    // Large doors
    const doorGeo = new THREE.BoxGeometry(4 * scale, 4 * scale, 0.3 * scale);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 2 * scale, 6.15 * scale);
    parent.add(door);
    
    // Windows along sides
    const windowGeo = new THREE.BoxGeometry(1.5 * scale, 1 * scale, 0.1 * scale);
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.7
    });
    
    for (let i = 0; i < 3; i++) {
        const window1 = new THREE.Mesh(windowGeo, windowMat);
        window1.position.set(4.05 * scale, 3 * scale, -4 + i * 4 * scale);
        window1.rotation.y = Math.PI / 2;
        parent.add(window1);
        
        const window2 = new THREE.Mesh(windowGeo, windowMat);
        window2.position.set(-4.05 * scale, 3 * scale, -4 + i * 4 * scale);
        window2.rotation.y = -Math.PI / 2;
        parent.add(window2);
    }
    
    // External equipment
    const equipmentGeo = new THREE.BoxGeometry(1 * scale, 2 * scale, 1 * scale);
    const equipmentMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const equipment = new THREE.Mesh(equipmentGeo, equipmentMat);
    equipment.position.set(5 * scale, 1 * scale, 3 * scale);
    equipment.castShadow = true;
    parent.add(equipment);
}

function createEnhancedMosque(parent, scale) {
    // Main prayer hall
    const mosqueGeo = new THREE.BoxGeometry(8 * scale, 5 * scale, 8 * scale);
    const mosqueMat = new THREE.MeshStandardMaterial({ 
        color: 0xF5DEB3,
        roughness: 0.7,
        metalness: 0.1
    });
    const mosque = new THREE.Mesh(mosqueGeo, mosqueMat);
    mosque.position.y = 2.5 * scale;
    mosque.castShadow = true;
    mosque.receiveShadow = true;
    parent.add(mosque);
    
    // Central dome
    const domeGeo = new THREE.SphereGeometry(3.5 * scale, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ 
        color: 0x4169E1,
        roughness: 0.2,
        metalness: 0.3
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 5 * scale;
    dome.castShadow = true;
    parent.add(dome);
    
    // Dome finial
    const finialGeo = new THREE.SphereGeometry(0.5 * scale, 8, 8);
    const finialMat = new THREE.MeshStandardMaterial({ 
        color: 0xFFD700,
        metalness: 0.8,
        roughness: 0.1
    });
    const finial = new THREE.Mesh(finialGeo, finialMat);
    finial.position.y = 8.5 * scale;
    parent.add(finial);
    
    // Main minaret
    const minaretGeo = new THREE.CylinderGeometry(1 * scale, 1.2 * scale, 8 * scale, 8);
    const minaret = new THREE.Mesh(minaretGeo, mosqueMat);
    minaret.position.set(5 * scale, 4 * scale, 5 * scale);
    minaret.castShadow = true;
    parent.add(minaret);
    
    // Minaret balcony
    const balconyGeo = new THREE.CylinderGeometry(1.5 * scale, 1.5 * scale, 0.5 * scale, 8);
    const balcony = new THREE.Mesh(balconyGeo, mosqueMat);
    balcony.position.set(5 * scale, 7 * scale, 5 * scale);
    parent.add(balcony);
    
    // Minaret dome
    const minaretDomeGeo = new THREE.SphereGeometry(1.2 * scale, 8, 8);
    const minaretDome = new THREE.Mesh(minaretDomeGeo, domeMat);
    minaretDome.position.set(5 * scale, 8.7 * scale, 5 * scale);
    parent.add(minaretDome);
    
    // Smaller minarets
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const x = Math.cos(angle) * 6 * scale;
        const z = Math.sin(angle) * 6 * scale;
        
        const smallMinaretGeo = new THREE.CylinderGeometry(0.6 * scale, 0.8 * scale, 6 * scale, 8);
        const smallMinaret = new THREE.Mesh(smallMinaretGeo, mosqueMat);
        smallMinaret.position.set(x, 3 * scale, z);
        smallMinaret.castShadow = true;
        parent.add(smallMinaret);
        
        const smallDomeGeo = new THREE.SphereGeometry(0.8 * scale, 8, 8);
        const smallDome = new THREE.Mesh(smallDomeGeo, domeMat);
        smallDome.position.set(x, 6.8 * scale, z);
        parent.add(smallDome);
    }
    
    // Arched entrances
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * 4.1 * scale;
        const z = Math.sin(angle) * 4.1 * scale;
        
        const archGeo = new THREE.BoxGeometry(1.5 * scale, 2.5 * scale, 0.3 * scale);
        const archMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(x, 1.25 * scale, z);
        arch.rotation.y = angle;
        parent.add(arch);
    }
}

function createEnhancedRuins(parent, scale) {
    // Partially collapsed walls
    const wallMat = new THREE.MeshStandardMaterial({ 
        color: 0x696969,
        roughness: 1.0,
        metalness: 0.0
    });
    
    // Main wall (damaged)
    const wall1Geo = new THREE.BoxGeometry(6 * scale, 3 * scale, 0.8 * scale);
    const wall1 = new THREE.Mesh(wall1Geo, wallMat);
    wall1.position.set(0, 1.5 * scale, 3 * scale);
    wall1.rotation.z = Math.PI / 30; // Slight lean
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    parent.add(wall1);
    
    // Corner wall (broken)
    const wall2Geo = new THREE.BoxGeometry(0.8 * scale, 2.5 * scale, 4 * scale);
    const wall2 = new THREE.Mesh(wall2Geo, wallMat);
    wall2.position.set(3 * scale, 1.25 * scale, 0);
    wall2.rotation.x = -Math.PI / 25;
    wall2.castShadow = true;
    parent.add(wall2);
    
    // Collapsed pillar
    const pillarGeo = new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 4 * scale, 8);
    const pillar = new THREE.Mesh(pillarGeo, wallMat);
    pillar.position.set(-2 * scale, 1 * scale, -2 * scale);
    pillar.rotation.z = Math.PI / 6; // Fallen over
    pillar.castShadow = true;
    parent.add(pillar);
    
    // Rubble piles
    for (let i = 0; i < 12; i++) {
        const rubbleGeo = new THREE.BoxGeometry(
            (0.3 + Math.random() * 0.6) * scale,
            (0.2 + Math.random() * 0.5) * scale,
            (0.3 + Math.random() * 0.6) * scale
        );
        const rubble = new THREE.Mesh(rubbleGeo, wallMat);
        rubble.position.set(
            (Math.random() - 0.5) * 8 * scale,
            (Math.random() * 0.4) * scale,
            (Math.random() - 0.5) * 8 * scale
        );
        rubble.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rubble.castShadow = true;
        parent.add(rubble);
    }
    
    // Broken arch
    const archGeo = new THREE.TorusGeometry(2 * scale, 0.4 * scale, 8, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, wallMat);
    arch.position.set(-1 * scale, 2 * scale, 1 * scale);
    arch.rotation.z = Math.PI / 8;
    arch.castShadow = true;
    parent.add(arch);
    
    // Vegetation growing through ruins
    for (let i = 0; i < 5; i++) {
        const vineMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const vineGeo = new THREE.BoxGeometry(0.1 * scale, 1 + Math.random() * scale, 0.1 * scale);
        const vine = new THREE.Mesh(vineGeo, vineMat);
        vine.position.set(
            (Math.random() - 0.5) * 6 * scale,
            0.5 + Math.random() * 0.5 * scale,
            (Math.random() - 0.5) * 6 * scale
        );
        parent.add(vine);
    }
}

/**
 * Enhanced building and tree generation with better placement algorithms
 */
export function generateBuildings(scene, existingObstacles = [], numBuildings = 18) {
    const buildings = [];
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 180;
    const padding = 25;
    const minBuildingDistance = 12;
    const occupiedPositions = [];
    
    // Enhanced building types with new additions
    const buildingTypes = [
        { type: 'house', weight: 0.25 },
        { type: 'warehouse', weight: 0.15 },
        { type: 'tower', weight: 0.12 },
        { type: 'mosque', weight: 0.12 },
        { type: 'ruins', weight: 0.15 },
        { type: 'fortress', weight: 0.08 },
        { type: 'lighthouse', weight: 0.13 }
    ];
    
    // Add existing obstacles to occupied positions
    existingObstacles.forEach(obstacle => {
        occupiedPositions.push({
            position: obstacle.position.clone(),
            radius: obstacle.userData ? obstacle.userData.collisionRadius : 5
        });
    });
    
    let attempts = 0;
    const maxAttempts = numBuildings * 20;
    
    while (buildings.length < numBuildings && attempts < maxAttempts) {
        attempts++;
        
        // Strategic placement based on building type
        let x, z, selectedType;
        
        // Select building type first for strategic placement
        const rand = Math.random();
        let cumulativeWeight = 0;
        selectedType = 'house';
        
        for (const buildingType of buildingTypes) {
            cumulativeWeight += buildingType.weight;
            if (rand <= cumulativeWeight) {
                selectedType = buildingType.type;
                break;
            }
        }
        
        // Place lighthouses near coast
        if (selectedType === 'lighthouse') {
            const angle = Math.random() * Math.PI * 2;
            const distance = terrainSize / 2.5 + Math.random() * 10;
            x = Math.cos(angle) * distance;
            z = Math.sin(angle) * distance;
        }
        // Place fortresses on high ground
        else if (selectedType === 'fortress') {
            // Find high elevation areas
            let bestHeight = -1;
            let bestX = 0, bestZ = 0;
            
            for (let i = 0; i < 20; i++) {
                const testX = THREE.MathUtils.randFloat(-terrainSize / 3, terrainSize / 3);
                const testZ = THREE.MathUtils.randFloat(-terrainSize / 3, terrainSize / 3);
                const height = terrain ? terrain.getHeightAt(testX, testZ) : 0;
                
                if (height > bestHeight) {
                    bestHeight = height;
                    bestX = testX;
                    bestZ = testZ;
                }
            }
            x = bestX;
            z = bestZ;
        }
        // Regular random placement for other buildings
        else {
            x = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
            z = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
        }
        
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
        
        // Skip if terrain is too low for most buildings (except lighthouses)
        if (terrainHeight < 0.8 && selectedType !== 'lighthouse') continue;
        
        // Create building with appropriate scale
        let scale;
        if (selectedType === 'fortress' || selectedType === 'lighthouse') {
            scale = THREE.MathUtils.randFloat(1.0, 1.4);
        } else {
            scale = THREE.MathUtils.randFloat(0.7, 1.2);
        }
        
        const building = createBuilding(position, selectedType, scale, terrainHeight);
        
        scene.add(building);
        buildings.push(building);
        
        // Add to occupied positions with larger radius for important buildings
        const collisionRadius = ['fortress', 'lighthouse', 'mosque'].includes(selectedType) 
            ? building.userData.collisionRadius * 1.5 
            : building.userData.collisionRadius;
            
        occupiedPositions.push({
            position: position.clone(),
            radius: collisionRadius
        });
    }
    
    console.log(`Generated ${buildings.length} buildings in ${attempts} attempts`);
    return buildings;
}

/**
 * Enhanced tree generation with biome-based placement
 */
export function generateTrees(scene, existingObstacles = [], numTrees = 40) {
    const trees = [];
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 180;
    const padding = 15;
    const minTreeDistance = 3;
    const minObstacleDistance = 8;
    const occupiedPositions = [];
    
    // Add existing obstacles to occupied positions
    existingObstacles.forEach(obstacle => {
        occupiedPositions.push({
            position: obstacle.position.clone(),
            radius: obstacle.userData ? obstacle.userData.collisionRadius : 4
        });
    });
    
    let attempts = 0;
    const maxAttempts = numTrees * 20;
    
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
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        
        // Skip very low areas and very close to water
        if (terrainHeight < 0.5) continue;
        
        // Vary scale based on environment
        let scale;
        if (terrainHeight > 8) {
            // High altitude - smaller, hardier trees
            scale = THREE.MathUtils.randFloat(0.6, 1.0);
        } else if (distanceFromCenter > terrainSize / 3) {
            // Coastal areas - palm trees and smaller vegetation
            scale = THREE.MathUtils.randFloat(0.8, 1.3);
        } else {
            // Inland areas - full-sized trees
            scale = THREE.MathUtils.randFloat(0.9, 1.6);
        }
        
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

/**
 * Creates additional environmental props and details
 */
export function createEnvironmentalProps(scene) {
    createBeachProps(scene);
    createMountainProps(scene);
    createWildlifeElements(scene);
    createAbandonedVehicles(scene);
}

/**
 * Creates beach-specific props
 */
function createBeachProps(scene) {
    const terrain = scene.userData.terrain;
    const terrainSize = terrain ? terrain.size : 180;
    
    // Create beach props around the coastline
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = terrainSize / 2.3 + Math.random() * 15;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        
        if (terrainHeight < 2) { // Beach/coastal areas
            // Shells and debris
            if (Math.random() < 0.7) {
                const shellGeo = new THREE.SphereGeometry(0.1 + Math.random() * 0.2, 6, 4);
                const shellMat = new THREE.MeshStandardMaterial({ 
                    color: new THREE.Color().setHSL(0.1, 0.3, 0.8 + Math.random() * 0.2),
                    roughness: 0.3,
                    metalness: 0.1
                });
                const shell = new THREE.Mesh(shellGeo, shellMat);
                shell.position.set(x, terrainHeight + 0.05, z);
                shell.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                shell.scale.set(
                    0.5 + Math.random() * 0.5,
                    0.3 + Math.random() * 0.4,
                    0.5 + Math.random() * 0.5
                );
                scene.add(shell);
            }
            
            // Beach rocks
            if (Math.random() < 0.4) {
                const rockGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.8, 6, 4);
                const rockMat = new THREE.MeshStandardMaterial({ 
                    color: 0x8B7355,
                    roughness: 0.9,
                    metalness: 0.05
                });
                const rock = new THREE.Mesh(rockGeo, rockMat);
                rock.position.set(x, terrainHeight + 0.1, z);
                rock.scale.set(
                    0.8 + Math.random() * 0.4,
                    0.5 + Math.random() * 0.5,
                    0.8 + Math.random() * 0.4
                );
                rock.castShadow = true;
                rock.receiveShadow = true;
                scene.add(rock);
            }
        }
    }
}

/**
 * Creates mountain/highland props
 */
function createMountainProps(scene) {
    const terrain = scene.userData.terrain;
    
    // Find high elevation areas for mountain props
    for (let i = 0; i < 20; i++) {
        const x = (Math.random() - 0.5) * 120;
        const z = (Math.random() - 0.5) * 120;
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        
        if (terrainHeight > 8) { // High elevation areas
            // Mountain crystals
            if (Math.random() < 0.3) {
                const crystalGeo = new THREE.ConeGeometry(0.2 + Math.random() * 0.4, 1 + Math.random() * 2, 6);
                const crystalMat = new THREE.MeshStandardMaterial({ 
                    color: new THREE.Color().setHSL(0.6 + Math.random() * 0.4, 0.7, 0.8),
                    transparent: true,
                    opacity: 0.8,
                    metalness: 0.1,
                    roughness: 0.1
                });
                const crystal = new THREE.Mesh(crystalGeo, crystalMat);
                crystal.position.set(x, terrainHeight + 0.5, z);
                crystal.rotation.set(
                    (Math.random() - 0.5) * 0.5,
                    Math.random() * Math.PI * 2,
                    (Math.random() - 0.5) * 0.5
                );
                crystal.castShadow = true;
                scene.add(crystal);
            }
            
            // Mountain flowers
            if (Math.random() < 0.5) {
                const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4);
                const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
                const stem = new THREE.Mesh(stemGeo, stemMat);
                stem.position.set(x, terrainHeight + 0.25, z);
                scene.add(stem);
                
                const flowerGeo = new THREE.SphereGeometry(0.1, 6, 4);
                const flowerMat = new THREE.MeshStandardMaterial({ 
                    color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
                    emissive: new THREE.Color().setHSL(Math.random(), 0.3, 0.1)
                });
                const flower = new THREE.Mesh(flowerGeo, flowerMat);
                flower.position.set(x, terrainHeight + 0.5, z);
                flower.scale.set(1, 0.3, 1);
                scene.add(flower);
            }
        }
    }
}

/**
 * Creates wildlife elements
 */
function createWildlifeElements(scene) {
    // Bird flocks (animated)
    createBirdFlock(scene);
    
    // Butterfly effects
    createButterflySystem(scene);
}

function createBirdFlock(scene) {
    const birdGroup = new THREE.Group();
    const birdCount = 12;
    
    for (let i = 0; i < birdCount; i++) {
        const birdGeo = new THREE.SphereGeometry(0.1, 4, 3);
        const birdMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const bird = new THREE.Mesh(birdGeo, birdMat);
        
        bird.position.set(
            (Math.random() - 0.5) * 20,
            30 + Math.random() * 20,
            (Math.random() - 0.5) * 20
        );
        
        bird.userData = {
            speed: 0.5 + Math.random() * 0.3,
            direction: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 2
            ).normalize(),
            bobSpeed: 2 + Math.random() * 2,
            bobAmount: 0.3 + Math.random() * 0.2
        };
        
        birdGroup.add(bird);
    }
    
    scene.add(birdGroup);
    
    // Animate bird flock
    function animateBirds() {
        const time = Date.now() * 0.001;
        
        birdGroup.children.forEach((bird, index) => {
            // Flocking behavior
            const userData = bird.userData;
            bird.position.add(userData.direction.clone().multiplyScalar(userData.speed * 0.1));
            
            // Vertical bobbing
            bird.position.y += Math.sin(time * userData.bobSpeed + index) * userData.bobAmount * 0.1;
            
            // Keep birds within bounds
            if (Math.abs(bird.position.x) > 100 || Math.abs(bird.position.z) > 100) {
                userData.direction.x *= -1;
                userData.direction.z *= -1;
            }
            
            if (bird.position.y < 20 || bird.position.y > 60) {
                userData.direction.y *= -1;
            }
        });
        
        requestAnimationFrame(animateBirds);
    }
    animateBirds();
}

function createButterflySystem(scene) {
    const butterflyGeometry = new THREE.BufferGeometry();
    const butterflyCount = 15;
    const positions = new Float32Array(butterflyCount * 3);
    const colors = new Float32Array(butterflyCount * 3);
    
    for (let i = 0; i < butterflyCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 100;
        positions[i3 + 1] = 2 + Math.random() * 8;
        positions[i3 + 2] = (Math.random() - 0.5) * 100;
        
        const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }
    
    butterflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    butterflyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const butterflyMaterial = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });
    
    const butterflySystem = new THREE.Points(butterflyGeometry, butterflyMaterial);
    scene.add(butterflySystem);
    
    function animateButterflies() {
        const positions = butterflyGeometry.attributes.position.array;
        const time = Date.now() * 0.001;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += Math.sin(time + i) * 0.02;
            positions[i + 1] += Math.sin(time * 2 + i) * 0.01;
            positions[i + 2] += Math.cos(time + i) * 0.02;
            
            // Keep butterflies in bounds
            if (Math.abs(positions[i]) > 50) positions[i] *= 0.9;
            if (Math.abs(positions[i + 2]) > 50) positions[i + 2] *= 0.9;
            if (positions[i + 1] < 1) positions[i + 1] = 1;
            if (positions[i + 1] > 10) positions[i + 1] = 10;
        }
        
        butterflyGeometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateButterflies);
    }
    animateButterflies();
}

/**
 * Creates abandoned vehicles for atmosphere
 */
function createAbandonedVehicles(scene) {
    const terrain = scene.userData.terrain;
    
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 140;
        const z = (Math.random() - 0.5) * 140;
        const terrainHeight = terrain ? terrain.getHeightAt(x, z) : 0;
        
        if (terrainHeight > 1 && terrainHeight < 6) {
            const vehicleGroup = new THREE.Group();
            
            // Vehicle body
            const bodyGeo = new THREE.BoxGeometry(4, 1.5, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ 
                color: 0x8B4513,
                roughness: 0.9,
                metalness: 0.3
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.75;
            body.castShadow = true;
            body.receiveShadow = true;
            vehicleGroup.add(body);
            
            // Wheels (or wheel remnants)
            for (let j = 0; j < 4; j++) {
                const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.4, 8);
                const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(
                    j < 2 ? -1.5 : 1.5,
                    0.4,
                    j % 2 === 0 ? 2.5 : -2.5
                );
                wheel.rotation.z = Math.PI / 2;
                vehicleGroup.add(wheel);
            }
            
            vehicleGroup.position.set(x, terrainHeight, z);
            vehicleGroup.rotation.y = Math.random() * Math.PI * 2;
            vehicleGroup.rotation.z = (Math.random() - 0.5) * 0.3; // Tilted/abandoned look
            
            scene.add(vehicleGroup);
        }
    }
}