import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

// Final Polished Prototype

// ======== HUD & GAME STATE ========
const hudDiv = document.createElement('div');
hudDiv.id = 'stats-hud';
hudDiv.style.position = 'absolute';
hudDiv.style.top = '10px';
hudDiv.style.right = '10px';
hudDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
hudDiv.style.color = 'white';
hudDiv.style.padding = '10px';
hudDiv.style.fontFamily = 'monospace';
hudDiv.style.borderRadius = '5px';
document.body.appendChild(hudDiv);

let hunger = 100;
let isDead = false;

// ======== SCENE SETUP ========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 25);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ======== UI ========
const statsDiv = document.createElement('div');
statsDiv.id = 'stats';
statsDiv.style.position = 'absolute';
statsDiv.style.top = '10px';
statsDiv.style.left = '10px';
statsDiv.style.color = 'white';
statsDiv.style.fontFamily = 'Arial, sans-serif';
statsDiv.style.fontSize = '20px';
statsDiv.innerHTML = 'Energy: 100%';
document.body.appendChild(statsDiv);

// ======== CONTROLS ========
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 100;

// ======== LIGHTING ========
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(100, 100, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

// ======== PHYSICS WORLD & MATERIALS ========
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -80, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
(world.solver as CANNON.GSSolver).iterations = 10;

const groundMaterial = new CANNON.Material('ground');
const penguinMaterial = new CANNON.Material('penguin');
const penguinSlidingMaterial = new CANNON.Material('penguinSliding');

const groundPenguinContact = new CANNON.ContactMaterial(groundMaterial, penguinMaterial, { friction: 0.2, restitution: 0.1 });
const groundPenguinSlidingContact = new CANNON.ContactMaterial(groundMaterial, penguinSlidingMaterial, { friction: 0.01, restitution: 0.1 });

world.addContactMaterial(groundPenguinContact);
world.addContactMaterial(groundPenguinSlidingContact);

// ======== PROCEDURAL TERRAIN ========
const noise2D = createNoise2D();
const terrainSize = 64; // Reduced from 128
const terrainMaxHeight = 20; 
const visResolution = 64; // Match terrain size

function getHeight(x: number, z: number): number {
    // Scaled for smaller world (divisors halved)
    const baseNoise = noise2D(x / 40, z / 40) * 12; 
    
    // Transition parameter (sigmoid-like) based on X
    // x < 0 is land, x > 0 is sea generally
    const t = 1 / (1 + Math.exp(x / 5)); // Sharper transition
    
    // Modulate the transition steepness with Z
    // fast transition = cliff, slow transition = slope
    const coastVar = noise2D(z / 20, 100) * 0.5 + 0.5; 
    
    let height = 0;
    
    if (x < -5) {
        // High Ground (Snowy)
        height = 10 + baseNoise + noise2D(x / 10, z / 10) * 1.5; 
    } else if (x > 5) {
        // Deep Sea
        return -15 + baseNoise * 0.5;
    } else {
        // Transition Zone (-5 to 5)
        const landH = 10 + baseNoise;
        const seaH = -15 + baseNoise * 0.5;
        const u = (x + 5) / 10;
        
        let blend = u;
        
        // Mega Ramp in the center (Z between -10 and 10)
        if (Math.abs(z) < 10) {
            // Smooth Ramp
            blend = u; 
        } else if (coastVar < 0.3) {
             // Cliff: Sharp step
             blend = u < 0.5 ? 0 : 1; 
             blend = 1 / (1 + Math.exp(-(x) * 2)); 
        } else {
             // Gradual Slope elsewhere
             blend = u;
        }
        
        height = landH * (1 - blend) + seaH * blend;
        
        // Less noise on the ramp for smooth sliding
        if (Math.abs(z) < 10) {
             height += noise2D(x, z) * 0.2; 
        } else {
             height += noise2D(x, z) * 1.0;
        }
    }
    
    return height;
}

// 1. Top Surface (Detailed)
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, visResolution - 1, visResolution - 1);
const vertices = terrainGeometry.attributes.position.array as unknown as number[];
for (let i = 0, j = 0; i < vertices.length / 3; i++, j += 3) {
    const worldX = vertices[j];
    const worldZ = -vertices[j + 1]; // Local Y is World -Z (due to -90 X rot later)
    vertices[j + 2] = getHeight(worldX, -worldZ); 
}
terrainGeometry.computeVertexNormals();

const terrainGroup = new THREE.Group();
scene.add(terrainGroup);

const topMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 });
const topMesh = new THREE.Mesh(terrainGeometry, topMaterial);
topMesh.rotation.x = -Math.PI / 2;
topMesh.receiveShadow = true;
terrainGroup.add(topMesh);

// 2. Dynamic Terrain Skirt (Seamless)
const skirtGeometry = new THREE.BufferGeometry();
const skirtVertices: number[] = [];
const skirtIndices: number[] = [];
const skirtDepth = -50;

// Access the generated vertices from the PlaneGeometry
const planeVerts = terrainGeometry.attributes.position.array;
const widthSegs = visResolution - 1;
const heightSegs = visResolution - 1;
const stride = 3;
const rowStride = (widthSegs + 1) * stride;

let vertIdx = 0;

// Helper to push a quad
function pushQuad(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    // P1 (Top Left)
    skirtVertices.push(x1, y1, z1);
    // P2 (Bottom Left)
    skirtVertices.push(x1, y1, skirtDepth);
    // P3 (Top Right)
    skirtVertices.push(x2, y2, z2);
    // P4 (Bottom Right)
    skirtVertices.push(x2, y2, skirtDepth);

    skirtIndices.push(vertIdx, vertIdx + 1, vertIdx + 2);
    skirtIndices.push(vertIdx + 2, vertIdx + 1, vertIdx + 3);
    vertIdx += 4;
}

// Side 1: Top Edge (Local +Y, World -Z) - Row (heightSegs)
// Iterate X from 0 to widthSegs
const topRowOffset = heightSegs * rowStride;
for (let i = 0; i < widthSegs; i++) {
    const idx1 = topRowOffset + i * stride;
    const idx2 = topRowOffset + (i + 1) * stride;
    pushQuad(planeVerts[idx2], planeVerts[idx2+1], planeVerts[idx2+2], 
             planeVerts[idx1], planeVerts[idx1+1], planeVerts[idx1+2]);
}

// Side 2: Right Edge (Local +X, World +X) - Column (widthSegs)
// Iterate Y from heightSegs down to 0
for (let i = heightSegs; i > 0; i--) {
    const idx1 = i * rowStride + widthSegs * stride;
    const idx2 = (i - 1) * rowStride + widthSegs * stride;
    pushQuad(planeVerts[idx2], planeVerts[idx2+1], planeVerts[idx2+2], 
             planeVerts[idx1], planeVerts[idx1+1], planeVerts[idx1+2]);
}

// Side 3: Bottom Edge (Local -Y, World +Z) - Row 0
// Iterate X from widthSegs down to 0
for (let i = widthSegs; i > 0; i--) {
    const idx1 = i * stride;
    const idx2 = (i - 1) * stride;
    pushQuad(planeVerts[idx2], planeVerts[idx2+1], planeVerts[idx2+2], 
             planeVerts[idx1], planeVerts[idx1+1], planeVerts[idx1+2]);
}

// Side 4: Left Edge (Local -X, World -X) - Column 0
// Iterate Y from 0 to heightSegs
for (let i = 0; i < heightSegs; i++) {
    const idx1 = i * rowStride;
    const idx2 = (i + 1) * rowStride;
    pushQuad(planeVerts[idx2], planeVerts[idx2+1], planeVerts[idx2+2], 
             planeVerts[idx1], planeVerts[idx1+1], planeVerts[idx1+2]);
}

skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skirtVertices, 3));
skirtGeometry.setIndex(skirtIndices);
skirtGeometry.computeVertexNormals();

const skirtMaterial = new THREE.MeshLambertMaterial({ color: 0x505060, side: THREE.DoubleSide });
const skirtMesh = new THREE.Mesh(skirtGeometry, skirtMaterial);
topMesh.add(skirtMesh); 

// 3. Bottom Cap
const bottomGeom = new THREE.PlaneGeometry(terrainSize, terrainSize);
const bottomMesh = new THREE.Mesh(bottomGeom, skirtMaterial);
bottomMesh.position.z = skirtDepth; 
topMesh.add(bottomMesh); 


const trimeshShape = new CANNON.Trimesh(Array.from(vertices), Array.from(terrainGeometry.index!.array));
const terrainBody = new CANNON.Body({ mass: 0, material: groundMaterial, shape: trimeshShape });
// Add a thick base box to prevent tunneling through the mesh
const baseShape = new CANNON.Box(new CANNON.Vec3(terrainSize/2, 2, terrainSize/2));
terrainBody.addShape(baseShape, new CANNON.Vec3(0, -17, 0)); // Solid floor at bottom
terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(terrainBody);

// ======== CATCH PLANE ========

const catchPlaneGeometry = new THREE.PlaneGeometry(terrainSize * 2, terrainSize * 2);

// ======== WATER ========
const waterLevel = 0;
const waterDepth = 20;
const waterGeometry = new THREE.BoxGeometry(terrainSize - 0.2, waterDepth, terrainSize - 0.2, 64, 1, 64);

const sideMat = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff, // Brighter
    transparent: true,
    transmission: 1.0, // Fully transmissive
    opacity: 1,
    metalness: 0.0,
    roughness: 0.0, // No blur
    ior: 1.33,
    thickness: 0.5, // Less absorption
    side: THREE.FrontSide
});

const topMat = new THREE.MeshStandardMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.6,
    metalness: 0.1,
    roughness: 0.0, // Shiny top
    side: THREE.DoubleSide
});

const waterMaterials = [
    sideMat, // Right
    sideMat, // Left
    topMat,  // Top
    topMat,  // Bottom
    sideMat, // Front
    sideMat  // Back
];

const waterMesh = new THREE.Mesh(waterGeometry, waterMaterials);
waterMesh.position.y = waterLevel - waterDepth / 2;
scene.add(waterMesh);

// ======== PENGUIN ========
const penguinRadius = 0.5;
const penguinHeight = 1.0;

// Using a single Sphere for the smoothest possible movement
const penguinBody = new CANNON.Body({
    mass: 6,
    position: new CANNON.Vec3(-40, 20, 0), // Safe spawn on plateau
    linearDamping: 0.1,
    angularDamping: 0.5,
    material: penguinMaterial,
    shape: new CANNON.Sphere(penguinRadius)
});
world.addBody(penguinBody);

const penguinGroup = new THREE.Group();
scene.add(penguinGroup);
const visualsGroup = new THREE.Group(); // For visual-only animations
penguinGroup.add(visualsGroup);

function generatePenguinTexture(backColor: string = '#333333'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#eeeeee'; // White background
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = backColor;
    context.fillRect(16, 0, 32, 64);
    return new THREE.CanvasTexture(canvas);
}
const penguinTexture = generatePenguinTexture();

const penguinBodyMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(penguinRadius, penguinHeight, 8, 16),
    new THREE.MeshStandardMaterial({ map: penguinTexture })
);
penguinBodyMesh.castShadow = true;
visualsGroup.add(penguinBodyMesh);

const penguinNoseMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xffa500 })
);
penguinNoseMesh.position.set(0, 0.2, penguinRadius + 0.1);
penguinNoseMesh.rotation.x = Math.PI / 2;
visualsGroup.add(penguinNoseMesh);

const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.8 });
const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16); // Bigger eyes

const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
leftEye.position.set(0.2, 0.5, penguinRadius); // Wider and higher
visualsGroup.add(leftEye);

const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
rightEye.position.set(-0.2, 0.5, penguinRadius); // Wider and higher
visualsGroup.add(rightEye);


// ======== SNOW PARTICLES ========
const particleCount = 50;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleVelocities = Array.from({ length: particleCount }, () => new THREE.Vector3());
const particleLifespans = new Float32Array(particleCount);
let nextParticle = 0;

function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.beginPath();
    context.arc(16, 16, 14, 0, 2 * Math.PI);
    context.fillStyle = 'white';
    context.fill();
    return new THREE.CanvasTexture(canvas);
}

for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = 0;
    particlePositions[i * 3 + 1] = -100; // Start off-screen
    particlePositions[i * 3 + 2] = 0;
    particleLifespans[i] = 0;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

const particleMaterial = new THREE.PointsMaterial({
    map: createCircleTexture(),
    color: 0xffffff, // White snow particles
    size: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.7
});

const snowParticles = new THREE.Points(particleGeometry, particleMaterial);
snowParticles.frustumCulled = false;
scene.add(snowParticles);


// ======== SPLASH PARTICLES ========
const splashParticleCount = 100;
const splashParticleGeometry = new THREE.BufferGeometry();
const splashParticlePositions = new Float32Array(splashParticleCount * 3);
const splashParticleVelocities = Array.from({ length: splashParticleCount }, () => new THREE.Vector3());
const splashParticleLifespans = new Float32Array(splashParticleCount);
let nextSplashParticle = 0;

for (let i = 0; i < splashParticleCount; i++) {
    splashParticlePositions[i * 3] = 0;
    splashParticlePositions[i * 3 + 1] = -100; // Start off-screen
    splashParticlePositions[i * 3 + 2] = 0;
    splashParticleLifespans[i] = 0;
}

splashParticleGeometry.setAttribute('position', new THREE.BufferAttribute(splashParticlePositions, 3));

const splashParticleMaterial = new THREE.PointsMaterial({
    map: createCircleTexture(),
    color: 0x00aaff, // Blue splashes
    size: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8
});

const splashParticles = new THREE.Points(splashParticleGeometry, splashParticleMaterial);
splashParticles.frustumCulled = false;
scene.add(splashParticles);

// ======== MARINE SNOW ========
const marineSnowCount = 3000;
const marineSnowGeom = new THREE.BufferGeometry();
const marineSnowPos = new Float32Array(marineSnowCount * 3);
const marineSnowColors = new Float32Array(marineSnowCount * 3);
const marineSnowDepths = new Float32Array(marineSnowCount); // Depth below surface

const colorPalette = [
    new THREE.Color(0xffffff), // White
    new THREE.Color(0xaaccff), // Light Blue
    new THREE.Color(0x00ffff), // Cyan
    new THREE.Color(0x88ffaa)  // Seafoam
];

for(let i=0; i<marineSnowCount; i++) {
    const x = (Math.random() - 0.5) * terrainSize;
    const z = (Math.random() - 0.5) * terrainSize;
    const depth = Math.random() * waterDepth;
    
    marineSnowPos[i*3] = x;
    marineSnowPos[i*3+1] = waterLevel - depth;
    marineSnowPos[i*3+2] = z;
    
    marineSnowDepths[i] = depth;
    
    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    marineSnowColors[i*3] = col.r;
    marineSnowColors[i*3+1] = col.g;
    marineSnowColors[i*3+2] = col.b;
}
marineSnowGeom.setAttribute('position', new THREE.BufferAttribute(marineSnowPos, 3));
marineSnowGeom.setAttribute('color', new THREE.BufferAttribute(marineSnowColors, 3));

const marineSnowMat = new THREE.PointsMaterial({
    vertexColors: true,
    size: 0.2,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});
const marineSnowSystem = new THREE.Points(marineSnowGeom, marineSnowMat);
marineSnowSystem.frustumCulled = false;
scene.add(marineSnowSystem);

function updateMarineSnow() {
    const pos = marineSnowSystem.geometry.attributes.position.array as Float32Array;
    const time = clock.getElapsedTime(); // Use global clock
    
    for(let i=0; i<marineSnowCount; i++) {
        const x = pos[i*3];
        const z = pos[i*3+2];
        const depth = marineSnowDepths[i];
        
        // Calculate Surface Height (Same as Water)
        let surfaceY = waterLevel; // Base level (0)
        // Note: Water Mesh is at y = waterLevel - waterDepth/2 = -10. 
        // Top vertex local y is +10. So world Y is 0.
        // We replicate the wave function:
        surfaceY += Math.sin(x * 0.05 + time * 0.5) * 0.8;
        surfaceY += Math.cos(z * 0.07 + time * 0.4) * 0.6;
        surfaceY += Math.sin((x + z) * 0.2 + time * 1.2) * 0.3;
        surfaceY += Math.cos((x - z) * 0.5 + time * 2.0) * 0.1;
        
        // Bob with wave
        pos[i*3+1] = surfaceY - depth;
    }
    marineSnowSystem.geometry.attributes.position.needsUpdate = true;
}

// ======== SQUID ========
// ======== SQUID ========
class Squid {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    visuals: THREE.Group;
    type: number;

    constructor(spawnPos: THREE.Vector3, type: number = 0) {
        this.position = spawnPos.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.type = type;

        this.visuals = new THREE.Group();
        
        let bodyGeom = new THREE.SphereGeometry(0.2, 16, 16);
        let color = 0xffa500;
        
        // Define scales (x, y, z) - assume Z is length (forward/back)
        let scale = new THREE.Vector3(0.6, 0.4, 1.0);

        if (type === 1) { // Blue (Sleek)
            scale.set(0.6, 0.6, 1.5);
            color = 0x0000ff;
        } else if (type === 2) { // Red (Small Round)
            scale.set(0.7, 0.7, 0.7);
            color = 0xff0000;
        } else if (type === 3) { // Green (Flat)
            scale.set(1.2, 0.3, 1.2);
            color = 0x00ff00;
        } else { // Squid (Orange)
            scale.set(0.6, 0.4, 1.0);
        }

        bodyGeom.scale(scale.x, scale.y, scale.z);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, metalness: 0.5 });
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        this.visuals.add(bodyMesh);

        // Eyes: Black spheres (Front is -Z)
        const eyeGeom = new THREE.SphereGeometry(0.02, 8, 8); 
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(0.08, 0.05, -0.15 * scale.z); // Front (-Z)
        this.visuals.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(-0.08, 0.05, -0.15 * scale.z); // Front (-Z)
        this.visuals.add(rightEye);

        // Tail: Cone pointing back (+Z)
        const tailGeom = new THREE.ConeGeometry(0.15, 0.4, 8); 
        tailGeom.rotateX(Math.PI / 2); // Cone points Y -> Rotate X 90 -> Points +Z
        const tailMesh = new THREE.Mesh(tailGeom, bodyMat);
        tailMesh.position.set(0, 0, 0.25 * scale.z); // Back (+Z)
        this.visuals.add(tailMesh);

        this.visuals.frustumCulled = false; 
        scene.add(this.visuals);
    }

    update(allSquids: Squid[]) {
        // Orient visuals to face velocity
        if (this.velocity.length() > 0.01) {
            const target = this.position.clone().add(this.velocity);
            this.visuals.lookAt(target);
        }

        const speed = 0.05; 
        
        // --- LOCAL FLOCKING (Boids) ---
        const neighborDist = 10;
        const separationDist = 2;
        
        let cohesion = new THREE.Vector3();
        let alignment = new THREE.Vector3();
        let separation = new THREE.Vector3();
        let count = 0;

        for (const other of allSquids) {
            if (other === this) continue;
            if (other.type !== this.type) continue; // Only swarm with same species
            const d = this.position.distanceTo(other.position);
            
            if (d < neighborDist) {
                cohesion.add(other.position);
                alignment.add(other.velocity);
                count++;
                
                if (d < separationDist) {
                    const push = this.position.clone().sub(other.position).normalize();
                    // Weight separation by distance (closer = stronger push)
                    push.divideScalar(d); 
                    separation.add(push);
                }
            }
        }

        if (count > 0) {
            // Move towards center of neighbors
            cohesion.divideScalar(count).sub(this.position).multiplyScalar(0.001); 
            // Match velocity of neighbors
            alignment.divideScalar(count).sub(this.velocity).multiplyScalar(0.01); 
            
            this.velocity.add(cohesion);
            this.velocity.add(alignment);
            this.velocity.add(separation.multiplyScalar(0.005));
        }

        // --- PREDATOR AVOIDANCE ---
        const avoidDist = 5;
        const avoidForce = 0.02;

        // Avoid Player
        const distToPlayer = this.position.distanceTo(penguinBody.position);
        if (distToPlayer < avoidDist) {
             const push = this.position.clone().sub(penguinBody.position).normalize().multiplyScalar(avoidForce);
             this.velocity.add(push);
        }

        // Avoid NPCs
        for (const npc of npcPenguins) {
             const dist = this.position.distanceTo(npc.body.position);
             if (dist < avoidDist) {
                  const push = this.position.clone().sub(npc.body.position).normalize().multiplyScalar(avoidForce);
                  this.velocity.add(push);
             }
        }

        // Random wander still needed for liveliness
        if (Math.random() > 0.95) {
             const angle = Math.random() * Math.PI * 2;
             this.velocity.x += Math.cos(angle) * 0.005;
             this.velocity.z += Math.sin(angle) * 0.005;
        }
        
        // Normalize speed
        const currentSpeed = this.velocity.length();
        if (currentSpeed > 0.001) {
             this.velocity.multiplyScalar(speed / currentSpeed);
        }

        // --- CONTAINMENT ---
        const nextPos = this.position.clone().add(this.velocity);
        const terrainH = getHeight(nextPos.x, -nextPos.z);

        // Shoreline bounce logic: if next position is land, bounce back
        if (terrainH > waterLevel - 0.5) {
             // Reflect velocity away from shore (simplified: push to center of map is safe fallback if stranded)
             // Better: invert velocity components?
             this.velocity.multiplyScalar(-1);
        } else {
             this.position.add(this.velocity);
        }
        
        // World Boundary Check (Cube Walls)
        const halfSize = terrainSize / 2 - 1.0;
        if (Math.abs(this.position.x) > halfSize) {
            this.position.x = Math.sign(this.position.x) * halfSize;
            this.velocity.x *= -1; // Bounce
        }
        if (Math.abs(this.position.z) > halfSize) {
            this.position.z = Math.sign(this.position.z) * halfSize;
            this.velocity.z *= -1; // Bounce
        }

        // Update visuals
        this.visuals.position.copy(this.position);

        // Vertical Clamping
        if (this.position.y > waterLevel - 0.2) {
            this.position.y = waterLevel - 0.2;
            this.velocity.y *= -0.5; 
        }
        
        const currentTerrainH = getHeight(this.position.x, -this.position.z);
        if (this.position.y < currentTerrainH + 0.5) {
             this.position.y = currentTerrainH + 0.5;
             this.velocity.y *= -0.5; 
        }
    }
}

const squids: Squid[] = [];
const maxSquids = 120;

// ======== NPC PENGUINS ========
class NpcPenguin {
    body: CANNON.Body;
    visuals: THREE.Group;
    isFollowing = false;
    isInWater = false;
    isSliding = false;
    slideTimer = 0;
    slideDelay = Math.random() * 0.5;
    isBaby = false;

    constructor(position: THREE.Vector3, scale: number = 1) {
        this.isBaby = scale < 0.8;
        const radius = penguinRadius * scale;
        const height = penguinHeight * scale;
        
        this.body = new CANNON.Body({
            mass: 6 * scale, // Lighter babies
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.9,
            material: penguinMaterial,
            shape: new CANNON.Sphere(radius)
        });
        world.addBody(this.body);

        this.visuals = new THREE.Group();
        const randomHue = Math.random() * 360;
        const backColor = `hsl(${randomHue}, 30%, 15%)`;
        const npcTexture = generatePenguinTexture(backColor);
        
        const bodyMesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(radius, height, 8, 16),
            new THREE.MeshStandardMaterial({ map: npcTexture })
        );
        bodyMesh.castShadow = true;
        this.visuals.add(bodyMesh);

        const noseMesh = new THREE.Mesh(
            new THREE.ConeGeometry(0.2 * scale, 0.4 * scale, 8),
            new THREE.MeshStandardMaterial({ color: 0xffa500 })
        );
        noseMesh.position.set(0, 0.2 * scale, radius + 0.1 * scale);
        noseMesh.rotation.x = Math.PI / 2;
        this.visuals.add(noseMesh);
        
        const eyeGeom = new THREE.SphereGeometry(0.08 * scale, 16, 16);
        const npcLeftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
        npcLeftEye.position.set(0.15 * scale, 0.4 * scale, radius);
        this.visuals.add(npcLeftEye);

        const npcRightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
        npcRightEye.position.set(-0.15 * scale, 0.4 * scale, radius);
        this.visuals.add(npcRightEye);
        
        scene.add(this.visuals);
    }

    update() {
        this.visuals.position.copy(this.body.position as any);
        this.visuals.quaternion.copy(this.body.quaternion as any);
    }
}

// ======== LEVEL SYSTEM ========
const npcPenguins: NpcPenguin[] = [];

function clearEntities() {
    // Clear NPCs
    npcPenguins.forEach(npc => {
        if (npc.body) world.removeBody(npc.body);
        if (npc.visuals) scene.remove(npc.visuals);
    });
    npcPenguins.length = 0;

    // Clear Squids
    squids.forEach(squid => {
        if (squid.body) world.removeBody(squid.body);
        if (squid.visuals) scene.remove(squid.visuals);
    });
    squids.length = 0;
}

function spawnNpcs() {
    let spawnedCount = 0;
    while (spawnedCount < 30) {
        const x = (Math.random() - 0.5) * terrainSize * 0.9;
        const z = (Math.random() - 0.5) * terrainSize * 0.9;
        const y = getHeight(x, -z);
        
        // Check if Land (Above water)
        if (y > waterLevel + 0.5) {
            const isBaby = Math.random() > 0.5;
            const scale = isBaby ? 0.5 : 1.0;
            const npc = new NpcPenguin(new THREE.Vector3(x, y + 1, z), scale);
            npc.body.quaternion.set(0, 0, 0, 1); // Force upright
            npc.body.angularVelocity.set(0, 0, 0); // No spin
            npc.body.angularDamping = 0.99; // Keep upright
            npcPenguins.push(npc);
            spawnedCount++;
        }
    }
}

function spawnSquids() {
    let attempts = 0;
    while (squids.length < maxSquids && attempts < 5000) { 
        attempts++;
        const x = (Math.random() - 0.5) * terrainSize * 0.9;
        const z = (Math.random() - 0.5) * terrainSize * 0.9;
        const terrainY = getHeight(x, -z);
        
        if (waterLevel > terrainY + 1.5) {
            const minY = terrainY + 0.8;
            const maxY = waterLevel - 0.5;
            const y = minY + Math.random() * (maxY - minY);
            const type = Math.floor(Math.random() * 4);
            squids.push(new Squid(new THREE.Vector3(x, y, z), type));
        }
    }
}

function resetPlayer() {
    penguinBody.position.set(-25, 20, 0);
    penguinBody.velocity.set(0, 0, 0);
    penguinBody.angularVelocity.set(0, 0, 0);
    penguinBody.quaternion.set(0, 0, 0, 1);
    hunger = 100;
    isDead = false;
}

function setLevel(id: number) {
    clearEntities();
    resetPlayer();
    
    // Default: Show Water & Snow (Level 2 & 3)
    waterMesh.visible = true;
    marineSnowSystem.visible = true;

    if (id === 1) {
        // Level 1: Snow Terrain + NPCs (No Water Visuals/Effects)
        spawnNpcs();
        waterMesh.visible = false;
        marineSnowSystem.visible = false;
        console.log("Level 1 Loaded: Snow + NPCs");
    } else if (id === 2) {
        // Level 2: Snow + Water (No Entities)
        console.log("Level 2 Loaded: Water Debug");
    } else if (id === 3) {
        // Level 3: Full Game
        spawnNpcs();
        spawnSquids();
        console.log("Level 3 Loaded: Full Game");
    }
}

// Initial Load
setLevel(3);

// Input for Levels
document.addEventListener('keydown', (e) => {
    if (e.key === '1') setLevel(1);
    if (e.key === '2') setLevel(2);
    if (e.key === '3') setLevel(3);
});

// ======== CATCH PLANE ========
/* Predator removed */

// ======== CONTROLS & MOVEMENT ========
const keys: { [key: string]: boolean } = {};
const lastKeyUpTime: { [key: string]: number } = { w: 0, a: 0, s: 0, d: 0 };
const doubleTapWindow = 300; // ms

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (['w', 'a', 's', 'd'].includes(key)) {
        const now = Date.now();
        if (now - lastKeyUpTime[key] < doubleTapWindow) {
            isSprinting = true;
        }
    }

    if (key === 'shift' && !isSliding) {
        isSliding = true;
    }
    
    if (key === ' ' && !event.repeat) {
        if ((canJump && penguinBody.velocity.y < 5) || playerIsInWater) {
            // Anticipatory tilt (Stronger)
            const tilt = new CANNON.Quaternion();
            tilt.setFromEuler(-0.8, 0, 0); // Tilt back more
            penguinBody.quaternion.mult(tilt, penguinBody.quaternion);
            
            penguinBody.velocity.y = isSprinting ? 35 : 18; // Higher jumps
            canJump = false;
        }
    }
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    keys[key] = false;

    if (['w', 'a', 's', 'd'].includes(key)) {
        lastKeyUpTime[key] = Date.now();
        if (!keys['w'] && !keys['a'] && !keys['s'] && !keys['d']) {
            isSprinting = false;
        }
    }

    if (key === 'shift') {
        isSliding = false;
    }
});

// -- Touch Controls (Tap to Move) --
let moveTarget: THREE.Vector3 | null = null;
let touchSlideId = -1;

document.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        
        // Right side: Actions
        if (t.clientX > window.innerWidth / 2) {
             if (touchSlideId === -1) {
                 touchSlideId = t.identifier;
                 // Jump on touch start
                if ((canJump && penguinBody.velocity.y < 5) || playerIsInWater) {
                    const tilt = new CANNON.Quaternion();
                    tilt.setFromEuler(-0.5, 0, 0); 
                    penguinBody.quaternion.mult(tilt, penguinBody.quaternion);
                    penguinBody.velocity.y = 12;
                    canJump = false;
                }
                isSliding = true; // Hold to slide
             }
        } else {
            // Left side: Tap to move
            // Raycast to find target
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            mouse.x = (t.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            
            const intersects = raycaster.intersectObject(terrainMesh);
            if (intersects.length > 0) {
                moveTarget = intersects[0].point;
                isSprinting = true; // Always sprint on touch? Or just walk. Let's sprint.
            }
        }
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchSlideId) {
            touchSlideId = -1;
            isSliding = false;
        }
    }
});

const moveVelocity = 5;
const sprintMoveVelocity = 22;
let isSliding = false;
let isSprinting = false;
let canJump = false;
let playerIsInWater = false;

function checkGround() {
    // Direct height check is reliable for procedural terrain
    // Note: Mesh is rotated -90 on X, so world Z corresponds to -local Y (which was passed to getHeight)
    const terrainHeight = getHeight(penguinBody.position.x, -penguinBody.position.z);
    const distanceToGround = penguinBody.position.y - terrainHeight;
    
    // Bottom of penguin is at y - penguinRadius
    // Allow jump if within 0.8 units of ground (very permissive)
    if (distanceToGround < penguinRadius + 0.8) {
        canJump = true;
    } else {
        canJump = false;
    }
}

function updatePenguinMovement() {
    if (isDead) return;

    // Respawn if fell off
    if (penguinBody.position.y < -30) {
        penguinBody.position.set(-25, 20, 0); // Spawn on land
        penguinBody.velocity.set(0, 0, 0);
    }

    checkGround();

    // Water splash check
    const wasInWater = playerIsInWater;
    playerIsInWater = penguinBody.position.y < waterLevel + penguinRadius;
    if (playerIsInWater && !wasInWater) {
        createSplash(penguinBody.position);
    }
    
    // Eating Squids/Fish
    for (let i = squids.length - 1; i >= 0; i--) {
        const squid = squids[i];
        if (penguinBody.position.distanceTo(squid.position) < 1.5) {
            scene.remove(squid.visuals);
            squids.splice(i, 1);
            hunger = Math.min(100, hunger + 20);
        }
    }

    const input = { f: keys['w'], b: keys['s'], l: keys['a'], r: keys['d'] };

    if (playerIsInWater) {
        penguinBody.material = penguinMaterial;
        penguinBody.linearDamping = 0.8;
        
        // Diving Logic
        if (isSliding) {
             // Dive down
             penguinBody.force.y -= 50; 
        } else {
            // Buoyancy (only when not diving)
            const depth = waterLevel - penguinBody.position.y;
            if (depth > 0) {
                 // Spring-like buoyancy (Reduced)
                 penguinBody.force.y += 140 * depth - penguinBody.velocity.y * 10;
            }
        }
    } else if (isSliding) {
        penguinBody.material = penguinSlidingMaterial;
        penguinBody.linearDamping = 0.01; // Ultra low damping for ice slide
        
        // Apply downhill force
        const start = penguinBody.position;
        const end = new CANNON.Vec3(start.x, start.y - (penguinRadius + 1.0), start.z);
        const result = new CANNON.RaycastResult();
        result.reset();
        world.raycastClosest(start, end, {}, result);

        if (result.hasHit) {
            const groundNormal = result.hitNormalWorld;
            
            const gravity = new CANNON.Vec3(0, -25, 0);
            const normal = groundNormal;
            const dot = gravity.dot(normal);
            const perp = normal.scale(dot);
            const parallel = gravity.vsub(perp);
            
            penguinBody.force.x += parallel.x * 5; // Stronger gravity effect on slopes
            penguinBody.force.z += parallel.z * 5;
        }

        // Lock tumbling while sliding
        penguinBody.angularVelocity.set(0, 0, 0);
        
        // Steering Forces while sliding
        const rightDir = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const camDir = new THREE.Vector3().crossVectors(rightDir, new THREE.Vector3(0,1,0));
        
        const steerForce = 10;
        if (input.l) {
            penguinBody.force.x -= rightDir.x * steerForce;
            penguinBody.force.z -= rightDir.z * steerForce;
        }
        if (input.r) {
            penguinBody.force.x += rightDir.x * steerForce;
            penguinBody.force.z += rightDir.z * steerForce;
        }
        // Boost/Brake
        if (input.f) {
            penguinBody.force.x -= camDir.x * steerForce;
            penguinBody.force.z -= camDir.z * steerForce;
        }
        // Don't return, let velocity update happen but maybe override it?
        // Actually, if we don't return, the WASD logic below will OVERWRITE velocity.x/z based on speed.
        // We want SLIDING physics (force based) not WALKING physics (velocity based).
        return; 
    } else {
        penguinBody.material = penguinMaterial;
        penguinBody.linearDamping = 0.9; // High damping for walking
        // Lock tumbling while walking to stay upright
        penguinBody.angularVelocity.set(0, 0, 0);
    }

    // Standard WASD movement
    const currentMoveVelocity = isSprinting ? sprintMoveVelocity : moveVelocity;
    const rightDir = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    rightDir.y = 0;
    const camDir = new THREE.Vector3().crossVectors(rightDir, new THREE.Vector3(0,1,0));
    const vel = new CANNON.Vec3(0, 0, 0);

    if (input.f) { vel.x -= camDir.x; vel.z -= camDir.z; }
    if (input.b) { vel.x += camDir.x; vel.z += camDir.z; }
    if (input.l) { vel.x -= rightDir.x; vel.z -= rightDir.z; }
    if (input.r) { vel.x += rightDir.x; vel.z += rightDir.z; }

    const currentYVelocity = penguinBody.velocity.y;
    if (vel.length() > 0) {
        vel.normalize();
        penguinBody.velocity.x = vel.x * currentMoveVelocity;
        penguinBody.velocity.z = vel.z * currentMoveVelocity;
        const angle = Math.atan2(penguinBody.velocity.x, penguinBody.velocity.z);
        
        const targetRot = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
        
        if (playerIsInWater) {
             // Steep forward lean for swimming/diving
             const lean = new CANNON.Quaternion();
             const leanAngle = isSliding ? Math.PI / 1.8 : Math.PI / 2.5;
             lean.setFromEuler(leanAngle, 0, 0); 
             targetRot.mult(lean, targetRot);
        }
        
        penguinBody.quaternion.slerp(targetRot, 0.4, penguinBody.quaternion);
    } else {
        penguinBody.velocity.x *= 0.8;
        penguinBody.velocity.z *= 0.8;
    }
    penguinBody.velocity.y = currentYVelocity;

    // --- BOUNDARY CHECK ---
    const halfSize = terrainSize / 2 - 1.0; // Buffer
    if (Math.abs(penguinBody.position.x) > halfSize) {
        penguinBody.position.x = Math.sign(penguinBody.position.x) * halfSize;
        penguinBody.velocity.x = 0;
    }
    if (Math.abs(penguinBody.position.z) > halfSize) {
        penguinBody.position.z = Math.sign(penguinBody.position.z) * halfSize;
        penguinBody.velocity.z = 0;
    }
    
    // Weaker tumble damping while walking/running
    penguinBody.angularVelocity.x *= 0.5;
    penguinBody.angularVelocity.z *= 0.5;
}

function updateParticles() {
    const positions = snowParticles.geometry.attributes.position.array as Float32Array;

    // Update all living particles
    for (let i = 0; i < particleCount; i++) {
        if (particleLifespans[i] > 0) {
            particleLifespans[i]--;
            positions[i * 3] += particleVelocities[i].x;
            positions[i * 3 + 1] += particleVelocities[i].y;
            positions[i * 3 + 2] += particleVelocities[i].z;
        } else {
            positions[i * 3 + 1] = -100; // Hide dead particles
        }
    }

    if (isSliding && !playerIsInWater) {
        // Find ground normal for particle direction
        const start = penguinBody.position;
        const end = new CANNON.Vec3(start.x, start.y - (penguinRadius + 1.0), start.z);
        const result = new CANNON.RaycastResult();
        result.reset();
        world.raycastClosest(start, end, {}, result);
        
        let tangent = new CANNON.Vec3(0, 0, 1);
        if (result.hasHit) {
             const normal = result.hitNormalWorld;
             // Approximate a backward tangent
             const back = new CANNON.Vec3();
             penguinBody.quaternion.vmult(new CANNON.Vec3(0,0,1), back); // Forward
             back.scale(-1, back); // Backward
             
             // Project backward vector onto the plane defined by the normal
             // v_proj = v - (v dot n) * n
             const dot = back.dot(normal);
             const perp = normal.scale(dot);
             tangent = back.vsub(perp);
             tangent.normalize();
        }

        const speed = penguinBody.velocity.length();
        const particlesToSpawn = Math.floor(speed / 8); // Significantly fewer particles

        // Spawn new particles in a ring buffer
        for (let i = 0; i < particlesToSpawn; i++) { 
            const particleIndex = nextParticle;
            const penguinGroundY = penguinBody.position.y - penguinRadius;
            positions[particleIndex * 3] = penguinBody.position.x + (Math.random() - 0.5) * penguinRadius;
            positions[particleIndex * 3 + 1] = penguinGroundY;
            positions[particleIndex * 3 + 2] = penguinBody.position.z + (Math.random() - 0.5) * penguinRadius;

            // Use calculated tangent for velocity
            particleVelocities[particleIndex].set(
                tangent.x * (0.1 + Math.random() * 0.1) + (Math.random() - 0.5) * 0.05, 
                tangent.y * (0.1 + Math.random() * 0.1) + Math.random() * 0.1,
                tangent.z * (0.1 + Math.random() * 0.1) + (Math.random() - 0.5) * 0.05
            );
            particleLifespans[particleIndex] = Math.random() * 30 + 30; // Longer lifespan
            nextParticle = (nextParticle + 1) % particleCount;
        }
    }
    snowParticles.geometry.attributes.position.needsUpdate = true;
}

// ======== BLOOD PARTICLES ========
const bloodParticleCount = 50;
const bloodParticleGeometry = new THREE.BufferGeometry();
const bloodParticlePositions = new Float32Array(bloodParticleCount * 3);
const bloodParticleVelocities = Array.from({ length: bloodParticleCount }, () => new THREE.Vector3());
const bloodParticleLifespans = new Float32Array(bloodParticleCount);
let nextBloodParticle = 0;

for (let i = 0; i < bloodParticleCount; i++) {
    bloodParticlePositions[i * 3] = 0;
    bloodParticlePositions[i * 3 + 1] = -100;
    bloodParticlePositions[i * 3 + 2] = 0;
    bloodParticleLifespans[i] = 0;
}

bloodParticleGeometry.setAttribute('position', new THREE.BufferAttribute(bloodParticlePositions, 3));

const bloodParticleMaterial = new THREE.PointsMaterial({
    map: createCircleTexture(),
    color: 0xff0000, // Red
    size: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8
});

const bloodParticles = new THREE.Points(bloodParticleGeometry, bloodParticleMaterial);
bloodParticles.frustumCulled = false;
scene.add(bloodParticles);

function createSplash(position: CANNON.Vec3, impactVelocity: number = 5, isBlood: boolean = false) {
    const scale = Math.min(3, impactVelocity / 8); 
    const particleCount = Math.max(5, Math.floor(20 * scale));
    
    // Select system
    let positions, velocities, lifespans, nextIdx, maxCount, geo;
    if (isBlood) {
        positions = bloodParticlePositions;
        velocities = bloodParticleVelocities;
        lifespans = bloodParticleLifespans;
        nextIdx = nextBloodParticle;
        maxCount = bloodParticleCount;
        geo = bloodParticleGeometry;
    } else {
        positions = splashParticlePositions;
        velocities = splashParticleVelocities;
        lifespans = splashParticleLifespans;
        nextIdx = nextSplashParticle;
        maxCount = splashParticleCount;
        geo = splashParticleGeometry;
    }

    for (let i = 0; i < particleCount; i++) { 
        const particleIndex = nextIdx;
        const spread = 0.5 * scale;
        
        positions[particleIndex * 3] = position.x + (Math.random() - 0.5) * spread;
        positions[particleIndex * 3 + 1] = waterLevel; // Or hit position?
        positions[particleIndex * 3 + 2] = position.z + (Math.random() - 0.5) * spread;

        velocities[particleIndex].set(
            (Math.random() - 0.5) * 0.2 * scale,
            (Math.random()) * 0.2 * scale + 0.1,
            (Math.random() - 0.5) * 0.2 * scale
        );
        lifespans[particleIndex] = (Math.random() * 30 + 30) * scale;
        nextIdx = (nextIdx + 1) % maxCount;
    }
    
    if (isBlood) nextBloodParticle = nextIdx;
    else nextSplashParticle = nextIdx;
    
    geo.attributes.position.needsUpdate = true;
}

function updateSplashParticles() {
    // Water
    let positions = splashParticles.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < splashParticleCount; i++) {
        if (splashParticleLifespans[i] > 0) {
            splashParticleLifespans[i]--;
            positions[i * 3] += splashParticleVelocities[i].x;
            positions[i * 3 + 1] += splashParticleVelocities[i].y;
            positions[i * 3 + 2] += splashParticleVelocities[i].z;
            splashParticleVelocities[i].y -= 0.01; 
        } else {
            positions[i * 3 + 1] = -100;
        }
    }
    splashParticles.geometry.attributes.position.needsUpdate = true;

    // Blood
    positions = bloodParticles.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < bloodParticleCount; i++) {
        if (bloodParticleLifespans[i] > 0) {
            bloodParticleLifespans[i]--;
            positions[i * 3] += bloodParticleVelocities[i].x;
            positions[i * 3 + 1] += bloodParticleVelocities[i].y;
            positions[i * 3 + 2] += bloodParticleVelocities[i].z;
            bloodParticleVelocities[i].y -= 0.01; 
        } else {
            positions[i * 3 + 1] = -100;
        }
    }
    bloodParticles.geometry.attributes.position.needsUpdate = true;
}

function updateNpcs() {
    const followDistance = 8; 
    const followSpeed = 4.5;
    const separationDist = 1.5;

    npcPenguins.forEach((npc, index) => {
        // Water splash check
        const wasInWater = npc.isInWater;
        npc.isInWater = npc.body.position.y < waterLevel + penguinRadius;
        if (npc.isInWater && !wasInWater) {
            createSplash(npc.body.position);
        }
        
        // Buoyancy
        if (npc.isInWater) {
             const depth = waterLevel - npc.body.position.y;
             if (depth > 0) {
                 npc.body.force.y += 200 * depth - npc.body.velocity.y * 10;
             }
             npc.body.linearDamping = 0.8;
        } else if (npc.isSliding) {
             npc.body.linearDamping = 0.01;
        } else {
             npc.body.linearDamping = 0.9;
        }

        // Synchronized Sliding
        if (isSliding && !npc.isInWater) {
            if (npc.slideTimer < npc.slideDelay) {
                npc.slideTimer += 1/60; 
            } else {
                npc.isSliding = true;
            }
        } else {
            npc.isSliding = false;
            npc.slideTimer = 0;
        }
        
        // Eating Squids
        for (let i = squids.length - 1; i >= 0; i--) {
            const squid = squids[i];
            if (npc.body.position.distanceTo(squid.position) < 1.5) {
                scene.remove(squid.visuals);
                squids.splice(i, 1);
            }
        }

        // Separation (avoid bunching)
        for (let j = 0; j < npcPenguins.length; j++) {
            if (index === j) continue;
            const other = npcPenguins[j];
            const dist = npc.body.position.distanceTo(other.body.position);
            if (dist < separationDist) {
                const push = npc.body.position.vsub(other.body.position);
                push.normalize();
                push.scale(10, push); 
                npc.body.force.vadd(push, npc.body.force);
            }
        }

        // Target Selection (Baby follows Adult, Adult follows Player)
        let targetPos = penguinBody.position;
        if (npc.isBaby) {
             let minD = 1000;
             let nearestAdult = null;
             for (const other of npcPenguins) {
                 if (!other.isBaby) {
                     const d = npc.body.position.distanceTo(other.body.position);
                     if (d < minD) {
                         minD = d;
                         nearestAdult = other;
                     }
                 }
             }
             if (nearestAdult && minD < 30) {
                 targetPos = nearestAdult.body.position;
             }
        }

        const distanceToTarget = npc.body.position.distanceTo(targetPos);

        if (distanceToTarget < followDistance) {
            npc.isFollowing = true;
        }

        if (npc.isFollowing) {
            const direction = targetPos.vsub(npc.body.position);
            direction.normalize();
            
            // Movement Logic
            if (distanceToTarget > 3.0) { // Stop if too close (Don't crowd)
                if (npc.isSliding) {
                     // Sliding physics (Downhill + Follow momentum)
                     const start = npc.body.position;
                     const end = new CANNON.Vec3(start.x, start.y - (penguinRadius + 1.0), start.z);
                     const result = new CANNON.RaycastResult();
                     result.reset();
                     world.raycastClosest(start, end, {}, result);

                     if (result.hasHit) {
                        const groundNormal = result.hitNormalWorld;
                        const gravity = new CANNON.Vec3(0, -25, 0);
                        const normal = groundNormal;
                        const dot = gravity.dot(normal);
                        const perp = normal.scale(dot);
                        const parallel = gravity.vsub(perp);
                        
                        npc.body.force.x += parallel.x * 5; 
                        npc.body.force.z += parallel.z * 5;
                     }
                     
                     // Steering while sliding (weak)
                     npc.body.force.x += direction.x * 5;
                     npc.body.force.z += direction.z * 5;

                } else {
                     // Walking
                     npc.body.velocity.x = direction.x * followSpeed;
                     npc.body.velocity.z = direction.z * followSpeed;
                }
            } else {
                // Stop moving if close, but dampen slide
                if (!npc.isSliding) {
                    npc.body.velocity.x *= 0.8;
                    npc.body.velocity.z *= 0.8;
                }
            }
            
            // Visual Rotation
            const angle = Math.atan2(npc.body.velocity.x, npc.body.velocity.z);
            const targetRot = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
            
            if (npc.isInWater) {
                 const lean = new CANNON.Quaternion();
                 lean.setFromEuler(Math.PI / 2.5, 0, 0); 
                 targetRot.mult(lean, targetRot);
            }
            
            npc.body.quaternion.slerp(targetRot, 0.15, npc.body.quaternion);
        } else {
            // Natural Wander
            // 2% chance to change wander state
            if (Math.random() > 0.98) {
                // Pick a random direction
                const angle = Math.random() * Math.PI * 2;
                const targetRot = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
                npc.body.quaternion.slerp(targetRot, 0.5, npc.body.quaternion);
                
                // Move forward
                const forward = new CANNON.Vec3(0, 0, 1);
                npc.body.quaternion.vmult(forward, forward);
                npc.body.velocity.x = forward.x * 2.0; // Slow walk
                npc.body.velocity.z = forward.z * 2.0;
            } else {
                // Keep moving a bit (damped)
                npc.body.velocity.x *= 0.95;
                npc.body.velocity.z *= 0.95;
            }
            
            // Visual Rotation for Wander
            if (npc.body.velocity.length() > 0.1) {
                 const angle = Math.atan2(npc.body.velocity.x, npc.body.velocity.z);
                 const targetRot = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
                 
                 if (npc.isInWater) {
                     const lean = new CANNON.Quaternion();
                     lean.setFromEuler(Math.PI / 2.5, 0, 0); 
                     targetRot.mult(lean, targetRot);
                 }
                 npc.body.quaternion.slerp(targetRot, 0.1, npc.body.quaternion);
            }
        }
        
        npc.update();
    });
}

function updateSquids() {
    squids.forEach(squid => squid.update(squids));
}

// ======== ANIMATION LOOP ========
const clock = new THREE.Clock();
const uprightQuaternion = new THREE.Quaternion();
const slidingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-80 * Math.PI / 180, 0, 0));

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    world.step(1 / 60, deltaTime, 3);
    
    // Water Waves (Box Geometry - Fixed)
    const positions = waterMesh.geometry.attributes.position.array as Float32Array;
    const topY = waterDepth / 2; // 10
    
    for (let i = 0; i < positions.length; i += 3) {
        // Only animate vertices near the top
        // Use a threshold because previous frames might have moved them slightly down
        if (positions[i + 1] > topY - 2.0) { 
            const x = positions[i];
            const z = positions[i + 2];
            
            let waveHeight = 0;
            // Wave 1 (Swell)
            waveHeight += Math.sin(x * 0.1 + elapsedTime * 0.5) * 0.5;
            // Wave 2 (Cross)
            waveHeight += Math.cos(z * 0.15 + elapsedTime * 0.4) * 0.4;
            // Wave 3 (Chop)
            waveHeight += Math.sin((x + z) * 0.3 + elapsedTime * 1.5) * 0.2;
            
            // Set absolute position (Fixes accumulation bug)
            positions[i + 1] = topY + waveHeight;
        }
    }
    waterMesh.geometry.attributes.position.needsUpdate = true;
    waterMesh.geometry.computeVertexNormals();
    
    // Marine Snow Pulse
    (marineSnowSystem.material as THREE.PointsMaterial).opacity = 0.4 + Math.sin(elapsedTime * 2) * 0.2;
    
    updatePenguinMovement();
    updateParticles();
    updateSplashParticles();
    updateMarineSnow();
    updateNpcs();
    updateSquids();
    
    // Update animated objects (door)
    penguinGroup.position.x = penguinBody.position.x;
    penguinGroup.position.y = penguinBody.position.y - penguinRadius + (penguinHeight / 2); // Offset for single sphere
    penguinGroup.position.z = penguinBody.position.z;
    penguinGroup.quaternion.copy(penguinBody.quaternion as any);

    // Apply visual-only sliding animation
    if (isSliding) {
        visualsGroup.quaternion.slerp(slidingQuaternion, 0.2);
    } else {
        visualsGroup.quaternion.slerp(uprightQuaternion, 0.2);
    }

    if (isDead) {
        statsDiv.innerHTML = "YOU DIED";
    } else {
        hunger -= 0.01; // Decay
        if (hunger <= 0) isDead = true;
        statsDiv.innerHTML = `Energy: ${Math.floor(hunger)}%`;
    }

    controls.target.copy(penguinGroup.position);
    controls.update();
    renderer.render(scene, camera);
}

// ======== RESIZE HANDLER ========
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();