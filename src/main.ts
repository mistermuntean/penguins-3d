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

const buildNumDiv = document.createElement('div');
buildNumDiv.id = 'build-num';
buildNumDiv.style.position = 'absolute';
buildNumDiv.style.top = '50px';
buildNumDiv.style.right = '10px';
buildNumDiv.style.color = 'white';
buildNumDiv.style.fontFamily = 'monospace';
buildNumDiv.style.fontSize = '14px';
buildNumDiv.innerHTML = 'Build: 36';
document.body.appendChild(buildNumDiv);

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

const cameraDebugDiv = document.createElement('div');
cameraDebugDiv.id = 'camera-debug';
cameraDebugDiv.style.position = 'absolute';
cameraDebugDiv.style.top = '80px';
cameraDebugDiv.style.left = '10px';
cameraDebugDiv.style.color = 'white';
cameraDebugDiv.style.fontFamily = 'monospace';
cameraDebugDiv.style.fontSize = '14px';
document.body.appendChild(cameraDebugDiv);

let cameraYOffset = 0;


// ======== CONTROLS ========
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.enableRotate = true; // Ensure rotate is enabled (for 2-finger touch)


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
const iceMaterial = new CANNON.Material('ice');

const groundPenguinContact = new CANNON.ContactMaterial(groundMaterial, penguinMaterial, { friction: 0.9, restitution: 0.1 });
const groundPenguinSlidingContact = new CANNON.ContactMaterial(groundMaterial, penguinSlidingMaterial, { friction: 0.01, restitution: 0.1 });
const icePenguinContact = new CANNON.ContactMaterial(iceMaterial, penguinMaterial, { friction: 0.9, restitution: 0.1 });

world.addContactMaterial(groundPenguinContact);
world.addContactMaterial(groundPenguinSlidingContact);
world.addContactMaterial(icePenguinContact);

// ======== SOUNDS ========
class SoundManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private isInitialized = false;
    private globalVolume = 0.7; // Set a default volume

    constructor() {
        this.load('gulp', 'https://actions.google.com/sounds/v1/human_actions/gulp.ogg');
        this.load('splash', 'https://actions.google.com/sounds/v1/water/splash.ogg');
        this.load('shuffle', 'https://actions.google.com/sounds/v1/impacts/footsteps_snow.ogg');
        this.load('debug', 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'); // Loud debug sound
    }

    private load(name: string, src: string) {
        this.sounds[name] = new Audio(src);
        this.sounds[name].volume = this.globalVolume;
        this.sounds[name].addEventListener('error', (e) => {
            console.error(`Error loading sound '${name}' from src '${src}':`, e);
        });
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log("SoundManager Initialized.");
    }

    play(name: string) {
        if (!this.isInitialized) {
            console.log(`SoundManager not initialized. Cannot play '${name}'.`);
            return;
        }
        if (this.sounds[name]) {
            console.log(`Playing sound: ${name} at volume ${this.sounds[name].volume}`);
            this.sounds[name].currentTime = 0;
            this.sounds[name].play().catch(error => console.error(`Error playing sound ${name}:`, error));
        } else {
            console.warn(`Sound not found: ${name}`);
        }
    }
}
const soundManager = new SoundManager();

// ======== START OVERLAY ========
const startOverlay = document.createElement('div');
startOverlay.id = 'start-overlay';
startOverlay.style.position = 'absolute';
startOverlay.style.top = '0';
startOverlay.style.left = '0';
startOverlay.style.width = '100%';
startOverlay.style.height = '100%';
startOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
startOverlay.style.color = 'white';
startOverlay.style.display = 'flex';
startOverlay.style.justifyContent = 'center';
startOverlay.style.alignItems = 'center';
startOverlay.style.fontSize = '32px';
startOverlay.style.fontFamily = 'Arial, sans-serif';
startOverlay.style.cursor = 'pointer';
startOverlay.innerHTML = '<div>Click to Start</div>';
document.body.appendChild(startOverlay);

startOverlay.addEventListener('click', () => {
    soundManager.init();
    startOverlay.style.display = 'none';
    animate(); // Start the animation loop only after user interaction
}, { once: true });

// ======== PROCEDURAL TERRAIN ========
const noise2D = createNoise2D();
const terrainSize = 64; 
const visResolution = 64; 
const waterLevel = 0;
const waterDepth = 20;

function getHeight(x: number, z: number): number {
    // Scaled for smaller world (divisors halved)
    const baseNoise = noise2D(x / 40, z / 40) * 12; 
    
    // Transition
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

// ======== GERSTNER WAVES ========
const waveCount = 10;
const shoreDir = new THREE.Vector2(1, 0).normalize(); // Toward +X
const spread = (35 * Math.PI) / 180;
const waveK = [0.55, 0.78, 1.05, 1.32, 1.62, 1.95, 2.30, 2.75, 3.15, 3.70];
const waveAmp = [0.22, 0.15, 0.11, 0.085, 0.065, 0.050, 0.038, 0.030, 0.024, 0.020];
const waveSpeed = [1.05, 1.18, 1.30, 1.42, 1.55, 1.70, 1.86, 2.02, 2.18, 2.35];
const waveDirs: THREE.Vector2[] = [];

for (let i = 0; i < waveCount; i++) {
    const angle = (Math.random() - 0.5) * spread * 2; // Full spread
    const dir = shoreDir.clone().rotateAround(new THREE.Vector2(0, 0), angle);
    waveDirs.push(dir);
}

function getWaveHeight(x: number, z: number, time: number): number {
    let height = 0;
    for (let i = 0; i < waveCount; i++) {
        const phase = (x * waveDirs[i].x + z * waveDirs[i].y) * waveK[i] + time * waveSpeed[i];
        height += waveAmp[i] * Math.sin(phase);
    }
    return waterLevel + height;
}

function getGerstnerPosition(x: number, z: number, time: number): THREE.Vector3 {
    const pos = new THREE.Vector3(x, waterLevel, z);
    const chop = 1.2;
    for (let i = 0; i < waveCount; i++) {
        const phase = (x * waveDirs[i].x + z * waveDirs[i].y) * waveK[i] + time * waveSpeed[i];
        pos.y += waveAmp[i] * Math.sin(phase);
        pos.x += waveAmp[i] * Math.cos(phase) * waveDirs[i].x * chop;
        pos.z += waveAmp[i] * Math.cos(phase) * waveDirs[i].y * chop;
    }
    return pos;
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

const terrainUniforms = {
    uTime: { value: 0 },
    uWaterLevel: { value: waterLevel }
};

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

const skirtMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
        uTopColor: { value: new THREE.Color(0xbac8de) }, // Lighter blue-grey
        uBottomColor: { value: new THREE.Color(0x5a6a7f) }, // Lighter dark blue-grey
        uMinY: { value: -50.0 }, // Corresponds to skirtDepth
        uMaxY: { value: 15.0 } // Approx max terrain height
    },
    vertexShader: `
        varying float vWorldY;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldY = worldPosition.y;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform float uMinY;
        uniform float uMaxY;
        varying float vWorldY;
        void main() {
            float h = smoothstep(uMinY, uMaxY, vWorldY);
            gl_FragColor = vec4(mix(uBottomColor, uTopColor, h), 1.0);
        }
    `
});
const skirtMesh = new THREE.Mesh(skirtGeometry, skirtMaterial);
topMesh.add(skirtMesh); 

// 3. Bottom Cap
const bottomGeom = new THREE.PlaneGeometry(terrainSize, terrainSize);
const bottomMesh = new THREE.Mesh(bottomGeom, skirtMaterial);
bottomMesh.position.z = skirtDepth; 
topMesh.add(bottomMesh); 


const trimeshShape = new CANNON.Trimesh(Array.from(vertices), Array.from(terrainGeometry.index!.array));
const terrainBody = new CANNON.Body({ mass: 0, material: groundMaterial, shape: trimeshShape });
// Add a thick base box to prevent tunneling through the mesh (Floor)
// Terrain is rotated -90 X. Local Z is World Y. Local Y is World -Z.
// We want a floor at World Y = -20.
const baseShape = new CANNON.Box(new CANNON.Vec3(terrainSize/2, terrainSize/2, 2)); 
terrainBody.addShape(baseShape, new CANNON.Vec3(0, 0, -20)); 
terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(terrainBody);

// ======== CATCH PLANE ========

// ======== WATER ========
const waterGeometry = new THREE.BoxGeometry(terrainSize - 2, 40, terrainSize - 2, 64, 1, 64);

const sideMat = new THREE.MeshStandardMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.3,
    metalness: 0.1,
    roughness: 0.1,
    side: THREE.FrontSide,
    depthWrite: false
});

const topMat = new THREE.MeshStandardMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.6,
    metalness: 0.1,
    roughness: 0.0, // Shiny top
    side: THREE.DoubleSide,
    depthWrite: false, // Fix particle visibility
    depthTest: true,
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
waterMesh.userData.basePositions = (waterMesh.geometry.attributes.position.array as Float32Array).slice();
scene.add(waterMesh);

// ======== ICEBERGS ========
const icebergs: { body: CANNON.Body, mesh: THREE.Group }[] = [];

function createIcebergs() {
    const iceMat = new THREE.ShaderMaterial({
        lights: true,
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.lights,
            {
                uBaseColor: { value: new THREE.Color(0.9, 0.95, 1.0) },
                uSubtleColor: { value: new THREE.Color(0.7, 0.8, 1.0) }
            }
        ]),
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            #include <common>
            #include <lights_pars_begin>
            varying vec3 vNormal;
            varying vec3 vWorldPosition;
            uniform vec3 uBaseColor;
            uniform vec3 uSubtleColor;

            void main() {
                vec3 N = normalize(vNormal);
                float light = dot(N, directionalLights[0].direction);
                light = floor(light * 5.0) / 5.0; 
                vec3 color = mix(uSubtleColor, uBaseColor, smoothstep(0.0, 0.8, light));
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    const createdPositions: CANNON.Vec3[] = [];

    // Generate 8 distinct icebergs
    for (let i = 0; i < 8; i++) {
        const isBigOne = i < 2; // Two big ones
        const baseRadius = isBigOne ? 6 + Math.random() * 4 : 2 + Math.random() * 3;
        const height = isBigOne ? 2.5 : 1.5;
        const coneHeight = isBigOne ? 5 : 3;
        
        let position: CANNON.Vec3;
        let tooClose: boolean;
        do {
            tooClose = false;
            const x = 10 + Math.random() * 40; 
            const z = (Math.random() - 0.5) * 60;
            // Spawn partially submerged for stability
            position = new CANNON.Vec3(x, waterLevel - 0.5, z); 
            for (const p of createdPositions) {
                if (p.distanceTo(position) < baseRadius + 6) { 
                    tooClose = true;
                    break;
                }
            }
        } while (tooClose);
        createdPositions.push(position);

        // Generate Irregular Polygon
        const numPoints = 12 + Math.floor(Math.random() * 6);
        const vertices: number[] = [];
        const indices: number[] = [];
        const topPoints: THREE.Vector3[] = [];
        
        for (let j = 0; j < numPoints; j++) {
            const angle = (j / numPoints) * Math.PI * 2;
            // Vary radius with noise-like randomness
            const radius = baseRadius * (0.6 + Math.random() * 0.6); 
            const px = Math.cos(angle) * radius;
            const pz = Math.sin(angle) * radius;
            topPoints.push(new THREE.Vector3(px, height / 2, pz));
        }

        // Build Geometry (Top Surface, Bottom Surface, Tip)
        for (const p of topPoints) vertices.push(p.x, p.y, p.z);
        for (const p of topPoints) vertices.push(p.x, -p.y, p.z);
        const coneTipIndex = vertices.length / 3;
        vertices.push(0, -height / 2 - coneHeight, 0);

        // Indices
        for (let j = 1; j < numPoints - 1; j++) indices.push(0, j + 1, j); // Top Cap
        for (let j = 0; j < numPoints; j++) { // Sides
            const next = (j + 1) % numPoints;
            indices.push(j, j + numPoints, next);
            indices.push(j + numPoints, next + numPoints, next);
        }
        for (let j = 0; j < numPoints; j++) { // Bottom Cone
            const next = (j + 1) % numPoints;
            indices.push(j + numPoints, coneTipIndex, next + numPoints);
        }
        
        const finalGeom = new THREE.BufferGeometry();
        finalGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        finalGeom.setIndex(indices);
        finalGeom.computeVertexNormals();
        
        // Visual Mesh
        const mesh = new THREE.Mesh(finalGeom, iceMat);
        const group = new THREE.Group();
        group.add(mesh);
        group.position.copy(position as any);
        group.castShadow = true;
        group.receiveShadow = true;
        scene.add(group);
        
        // Physics Body (Trimesh)
        const shapePhys = threeMeshToCannonTrimesh(mesh);
        const body = new CANNON.Body({ 
            mass: isBigOne ? 5000 : 1500, 
            material: iceMaterial,
            linearDamping: 0.95, // High damping for stability
            angularDamping: 0.95
        });
        body.addShape(shapePhys);
        body.position.copy(position);
        
        // Keel is implicit in the shape (cone bottom), but we add mass below
        // Center of mass is 0,0,0 (top surface center approx).
        // The heavy cone tip is geometry only.
        // We can offset the shape UP so COM is lower?
        // Actually, Trimesh physics respects the geometry.
        // If we want it bottom heavy, we can add a heavy sphere at the tip.
        const keel = new CANNON.Sphere(1.0);
        body.addShape(keel, new CANNON.Vec3(0, -coneHeight, 0));

        world.addBody(body);
        icebergs.push({ body, mesh: group });
    }
}
createIcebergs();

// ======== REAL-TIME CAUSTICS (Projected) ========
// Inject into Terrain Material
topMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uRipple1 = { value: new THREE.Vector3(0, 0, -100) }; 
    shader.uniforms.uRipple2 = { value: new THREE.Vector3(0, 0, -100) };
    topMaterial.userData.shader = shader;

    shader.vertexShader = `
        varying vec3 vWorldPosition;
        ${shader.vertexShader}
    `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
    );

    shader.fragmentShader = `
        uniform float uTime;
        uniform vec3 uRipple1;
        uniform vec3 uRipple2;
        varying vec3 vWorldPosition;
        
        // Match Water Waves
        float getCaustic(vec2 p, float t) {
            float v = 0.0;
            // Higher frequency, lower contrast
            v += sin(p.x * 0.3 + t * 0.8);
            v += cos(p.y * 0.35 + t * 0.6); 
            v += sin((p.x + p.y) * 0.8 + t * 1.5);
            return v;
        }
        
        float getRipple(vec2 p, float t, vec3 ripple) {
            float d = distance(p, ripple.xy);
            float rt = t - ripple.z; 
            if (rt > 0.0 && rt < 5.0) {
                 float wave = sin(d * 2.0 - rt * 5.0);
                 float mask = smoothstep(5.0, 0.0, d - rt * 2.0); 
                 float timeFade = 1.0 - smoothstep(3.0, 5.0, rt); 
                 float decay = exp(-rt * 0.5) * timeFade;
                 return wave * mask * decay * 0.5;
            }
            return 0.0;
        }

        // Helper Noise for Glitter/Cracks
        float snowRand(vec2 co){
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        ${shader.fragmentShader}
    `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        
        if (vWorldPosition.y < 0.0) {
            // ... (Underwater Logic remains, but updated below) ...
            vec2 uv = vWorldPosition.xz;
            float depth = -vWorldPosition.y;
            
            // 1. Caustics
            float c = getCaustic(uv, uTime);
            
            // Variable sharpness: Blurry (low exp) near surface, Sharp (high exp) deep
            float blurFactor = smoothstep(0.0, 8.0, depth);
            float sharpness = mix(1.0, 15.0, blurFactor);
            
            c = pow(0.5 + 0.5 * sin(c * 5.0), sharpness);
            
            float deepFade = smoothstep(15.0, 5.0, depth);
            // Softer fade near surface
            float beachFade = smoothstep(0.5, 6.0, depth);
            
            float causticIntensity = c * 0.2 * deepFade * beachFade;
            
            // 2. Irregular Shoreline Ripples
            float shoreNoise = sin(uv.x * 0.5) + cos(uv.y * 0.5); 
            float shoreWave = sin(depth * 10.0 - uTime * 3.0 + shoreNoise * 2.0);
            float shoreMask = smoothstep(5.0, 0.0, depth);
            float shoreRipple = pow(0.5 + 0.5 * shoreWave, 4.0) * shoreMask * 0.3;
            
            // 3. Interactive Ripples (Dual)
            float interact = getRipple(vWorldPosition.xz, uTime, uRipple1) + getRipple(vWorldPosition.xz, uTime, uRipple2);

            float totalLight = causticIntensity + shoreRipple + interact;
            vec3 deepBlue = vec3(0.0, 0.05, 0.2);
            float fogFactor = smoothstep(0.0, 25.0, depth); 
            
            vec3 finalColor = mix(gl_FragColor.rgb, deepBlue, fogFactor * 0.95);
            finalColor += vec3(0.7, 0.9, 1.0) * totalLight;
            gl_FragColor.rgb = finalColor;
            
        } else {
            // --- SNOW TERRAIN (Above Water) ---
            vec2 uv = vWorldPosition.xz;
            vec3 worldNormal = normalize(vNormal);

            // Blend based on steepness
            float slope = 1.0 - worldNormal.y;
            
            // 1. Soft Snow for flat areas
            float crackNoise = sin(uv.x * 0.05) * cos(uv.y * 0.05) * sin((uv.x+uv.y)*0.02); 
            float crack = 1.0 - smoothstep(0.0, 1.0, abs(crackNoise) + 0.1);
            vec3 snowColor = vec3(1.0, 1.0, 1.0); // Pure white
            vec3 iceColor = vec3(0.8, 0.9, 1.0); // Icy blue for contrast
            vec3 softSnow = mix(snowColor, iceColor, crack * 0.2);

            // 2. Hard, Icy look for steep areas
            float light = dot(worldNormal, directionalLights[0].direction);
            light = floor(light * 4.0) / 4.0;
            vec3 hardIce = mix(vec3(0.7, 0.8, 1.0), vec3(0.9, 0.95, 1.0), smoothstep(0.0, 0.8, light));

            // Blend original shadow/lighting with our materials
            vec3 finalMaterial = mix(softSnow, hardIce, smoothstep(0.2, 0.6, slope));
            gl_FragColor.rgb = gl_FragColor.rgb * finalMaterial; 
        }
        `
    );
};

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


// ======== TERRAIN SNOW (GPU INTERACTION) ========
function createSquareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}

const sparkleGeo = topMesh.geometry;
const sparklePosAttr = sparkleGeo.attributes.position;
const sparkleIndex = sparkleGeo.index!;

const fPos: number[] = [];
const fColor: number[] = [];

const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const faceNormal = new THREE.Vector3();

// Iterate Triangles (World Space Barycentric)
for (let i = 0; i < sparkleIndex.count; i += 3) {
    const a = sparkleIndex.getX(i);
    const b = sparkleIndex.getX(i+1);
    const c = sparkleIndex.getX(i+2);

    vA.fromBufferAttribute(sparklePosAttr, a);
    vB.fromBufferAttribute(sparklePosAttr, b);
    vC.fromBufferAttribute(sparklePosAttr, c);

    const wA = new THREE.Vector3(vA.x, vA.z, -vA.y);
    const wB = new THREE.Vector3(vB.x, vB.z, -vB.y);
    const wC = new THREE.Vector3(vC.x, vC.z, -vC.y);

    const edge1 = new THREE.Vector3().subVectors(wB, wA);
    const edge2 = new THREE.Vector3().subVectors(wC, wA);
    faceNormal.crossVectors(edge1, edge2).normalize();

    // Relaxed slope filtering: Snow sticks to almost everything (78 degrees)
    const slopeFactor = Math.abs(faceNormal.y); 
    if (slopeFactor < 0.2) continue;

    if (wA.y < waterLevel + 0.1) continue;

    const area = 0.5 * edge1.length() * edge2.length() * Math.sin(edge1.angleTo(edge2));
    const count = Math.max(1, Math.floor(area * 16.0 * slopeFactor));

    for (let j = 0; j < count; j++) {
        const r1 = Math.sqrt(Math.random());
        const r2 = Math.random();
        const u = 1 - r1;
        const v = r1 * (1 - r2);
        const w = r1 * r2;

        const p = new THREE.Vector3().addScaledVector(wA, u).addScaledVector(wB, v).addScaledVector(wC, w);
        p.y += 0.05; 
        fPos.push(p.x, p.y, p.z);
        
        const baseColor = new THREE.Color(0.85, 0.9, 0.95);
        if (Math.random() < 0.05) {
            fColor.push(3.0, 3.0, 3.0);
        } else {
            const brightness = 0.9 + Math.random() * 0.2;
            fColor.push(baseColor.r * brightness, baseColor.g * brightness, baseColor.b * brightness);
        }
    }
}

const sparkleGeometry = new THREE.BufferGeometry();
sparkleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
sparkleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(fColor, 3));

const sparkleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        pointTexture: { value: createSquareTexture() },
        uPenguinPositions: { value: [] },
        uPenguinCount: { value: 0 }
    },
    vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform vec3 uPenguinPositions[31];
        uniform int uPenguinCount;
        
        void main() {
            vColor = color;
            vec3 pos = position;
            
            float radius = 0.6; // Matches penguin radius
            // NOTE: Interaction logic removed for "simple spray" request, 
            // but we keep the structure if we want to add "displacement" back.
            // User asked: "change interaction so it doesn't move the snow on the ground."
            // "instead, add a small snowy particle 'spray' around the penguins"
            // So I will DISABLE displacement here.
            
            vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            
            gl_PointSize = 0.3 * ( 300.0 / -mvPosition.z ); 
        }
    `,
    fragmentShader: `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D( pointTexture, gl_PointCoord );
            if (tex.a < 0.1) discard;
            gl_FragColor = vec4(vColor, tex.a);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
});

const sparkleSystem = new THREE.Points(sparkleGeometry, sparkleMaterial);
sparkleSystem.frustumCulled = false;
scene.add(sparkleSystem);




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

// ======== MARINE SNOW ========
const splashParticleCount = 100;
const splashParticleGeometry = new THREE.BufferGeometry();
const splashParticlePositions = new Float32Array(splashParticleCount * 3);
const splashParticleVelocities = Array.from({ length: splashParticleCount }, () => new THREE.Vector3());
const splashParticleLifespans = new Float32Array(splashParticleCount);
const splashParticleOpacities = new Float32Array(splashParticleCount); // NEW
let nextSplashParticle = 0;

for (let i = 0; i < splashParticleCount; i++) {
    splashParticlePositions[i * 3] = 0;
    splashParticlePositions[i * 3 + 1] = -100; // Start off-screen
    splashParticlePositions[i * 3 + 2] = 0;
    splashParticleLifespans[i] = 0;
    splashParticleOpacities[i] = 0;
}

splashParticleGeometry.setAttribute('position', new THREE.BufferAttribute(splashParticlePositions, 3));
splashParticleGeometry.setAttribute('opacity', new THREE.BufferAttribute(splashParticleOpacities, 1)); // NEW

const splashParticleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        pointTexture: { value: createCircleTexture() },
        color: { value: new THREE.Color(0xaaccff) } // Brighter, whiter blue
    },
    vertexShader: `
        attribute float opacity;
        varying float vOpacity;
        void main() {
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = 8.0 * ( 30.0 / -mvPosition.z ); 
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D pointTexture;
        uniform vec3 color;
        varying float vOpacity;
        void main() {
            vec4 tex = texture2D( pointTexture, gl_PointCoord );
            if (tex.a < 0.1) discard;
            gl_FragColor = vec4( color, vOpacity * tex.a * 0.8 );
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
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
    const col = marineSnowSystem.geometry.attributes.color.array as Float32Array;
    const time = clock.getElapsedTime(); 
    
    const pPos = penguinBody.position;

    for(let i=0; i<marineSnowCount; i++) {
        const x = pos[i*3];
        const z = pos[i*3+2];

        // Aggressive Culling: If the terrain here is above water, hide the particle and skip.
        const terrainY = getHeight(x, -z);
        if (terrainY > waterLevel) {
            pos[i*3+1] = -1000; // Effectively hides the particle far below the scene
            continue;
        }
        
        const y = pos[i*3+1];
        const depth = marineSnowDepths[i];
        
        // Wave bobbing
        let surfaceY = waterLevel;
        surfaceY += Math.sin(x * 0.05 + time * 0.5) * 0.8;
        surfaceY += Math.cos(z * 0.07 + time * 0.4) * 0.6;
        
        // Final check to ensure particles stay below the waves
        pos[i*3+1] = Math.min(surfaceY - depth, waterLevel - 0.5);
        
        // Bioluminescence
        const dx = x - pPos.x;
        const dy = y - pPos.y;
        const dz = z - pPos.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < 25) { // Radius 5
             // Glow bright cyan/white
             col[i*3] = 0.8;
             col[i*3+1] = 1.0;
             col[i*3+2] = 1.0;
        } else {
             // Dim back to blue-ish randomly
             // Just set to a base cool color to be safe/simple
             col[i*3] = 0.0;
             col[i*3+1] = 0.2;
             col[i*3+2] = 0.4;
        }
    }
    marineSnowSystem.geometry.attributes.position.needsUpdate = true;
    marineSnowSystem.geometry.attributes.color.needsUpdate = true; // Added this line
} 

function updateIcebergs() {
    const time = clock.getElapsedTime();
    const halfSize = terrainSize / 2 - 4; // Boundary buffer

    icebergs.forEach(ice => {
        // Sync visuals
        ice.mesh.position.copy(ice.body.position as any);
        ice.mesh.quaternion.copy(ice.body.quaternion as any);
        
        // Buoyancy
        const waveY = getWaveHeight(ice.body.position.x, ice.body.position.z, time);
        const depth = waveY - ice.body.position.y;
        
        if (depth > -1.0) { // Start applying force even if slightly above water
            ice.body.force.y += 180000 * (depth + 0.5) - ice.body.velocity.y * 500;
        }

        // Heavily damp angular velocity on X and Z axes to prevent flipping
        ice.body.angularVelocity.x *= 0.1;
        ice.body.angularVelocity.z *= 0.1;
        
        // Containment
        if (Math.abs(ice.body.position.x) > halfSize) {
            ice.body.position.x = Math.sign(ice.body.position.x) * halfSize;
            ice.body.velocity.x *= -0.5;
        }
        if (Math.abs(ice.body.position.z) > halfSize) {
            ice.body.position.z = Math.sign(ice.body.position.z) * halfSize;
            ice.body.velocity.z *= -0.5;
        }
    });
}

function updateShoreSplashes() {
    const time = clock.getElapsedTime();
    // Random check along shore
    if (Math.random() > 0.9) {
        const z = (Math.random() - 0.5) * terrainSize;
        const x = (Math.random() * 10) - 5; // -5 to 5 (Transition zone)
        const waveY = getWaveHeight(x, z, time);
        const terrainY = getHeight(x, -z);
        
        // If wave hits terrain (approx)
        if (Math.abs(waveY - terrainY) < 1.0 && waveY > waterLevel + 0.5) {
             createSplash(new CANNON.Vec3(x, waveY, z), 5);
        }
    }
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
    state: 'IDLE' | 'WANDERING' = 'IDLE';
    stateTimer = Math.random() * 5;
    wanderTarget: CANNON.Vec3 | null = null;

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
            const npc = new NpcPenguin(new THREE.Vector3(x, y + 5, z), scale); // SPAWN HIGH
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
    const spawnX = -25;
    const spawnZ = 0;
    const spawnY = getHeight(spawnX, -spawnZ) + 5; // Spawn 5 units above terrain
    penguinBody.position.set(spawnX, spawnY, spawnZ);
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
    if (e.key === '9') soundManager.play('debug'); // Audio Debug
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
        if (canJump || playerIsInWater) {
            // Water jump needs to be very powerful to escape drag and reach icebergs
            const jumpForce = playerIsInWater ? 45 : (isSprinting ? 35 : 28);
            penguinBody.velocity.y = jumpForce;
            canJump = false;
            jumpTimer = 0.2; // Prevent immediate re-grounding
        }
    }

    if (key === '(') cameraYOffset -= 1.0;
    if (key === ')') cameraYOffset += 1.0;
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

// -- Touch Controls (New)

// -- Touch Controls (New) --

// -- Touch Controls --
let touchTarget: THREE.Vector3 | null = null;
let lastTouchTime = 0;

document.addEventListener('touchstart', (e) => {
    // 1 Finger: Move
    if (e.touches.length === 1) {
        // Double tap sprint
        const now = Date.now();
        if (now - lastTouchTime < 300) {
            isSprinting = true;
        }
        lastTouchTime = now;
        
        if (canJump || playerIsInWater) {
            const tilt = new CANNON.Quaternion();
            tilt.setFromEuler(-0.8, 0, 0); 
            penguinBody.quaternion.mult(tilt, penguinBody.quaternion);
            
            const jumpForce = playerIsInWater ? 45 : (isSprinting ? 35 : 28);
            penguinBody.velocity.y = jumpForce;
            
            canJump = false;
            jumpTimer = 0.2;
        }

        updateTouchTarget(e.touches[0]);
    } else if (e.touches.length === 2) {
        // 2 Fingers: Camera (OrbitControls handles this natively usually)
        // Stop moving
        touchTarget = null;
        isSprinting = false;
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        e.preventDefault(); // Stop scroll
        updateTouchTarget(e.touches[0]);
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        touchTarget = null;
        isSprinting = false;
    }
});

function updateTouchTarget(touch: Touch) {
    const mouse = new THREE.Vector2();
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // Raycast against infinite plane at penguin height? Or terrain?
    // Terrain is better.
    const intersects = raycaster.intersectObject(topMesh);
    if (intersects.length > 0) {
        touchTarget = intersects[0].point;
    } else {
        // Fallback: Plane at height 0
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -waterLevel);
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        if (target) touchTarget = target;
    }
}

const moveVelocity = 5;
const sprintMoveVelocity = 22;
let isSliding = false;
let isSprinting = false;
let canJump = false;
let playerIsInWater = false;
let jumpTimer = 0; // Cooldown for ground check after jumping

function checkGround() {
    if (jumpTimer > 0) {
        canJump = false;
        return;
    }
    const start = penguinBody.position;
    // Cast down very slightly more than radius for strict ground detection
    const end = new CANNON.Vec3(start.x, start.y - (penguinRadius + 0.1), start.z);
    
    const result = new CANNON.RaycastResult();
    world.raycastClosest(start, end, {}, result);
    
    if (result.hasHit) {
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

    // 1. Update State first
    const wasInWater = playerIsInWater;
    playerIsInWater = penguinBody.position.y < waterLevel + penguinRadius;
    checkGround();

    // Water splash check
    if (playerIsInWater && !wasInWater) {
        const impact = Math.abs(penguinBody.velocity.y);
        createSplash(penguinBody.position, impact);
        soundManager.play('splash');
    }
    
    // Eating Squids/Fish
    for (let i = squids.length - 1; i >= 0; i--) {
        const squid = squids[i];
        if (penguinBody.position.distanceTo(squid.position as any) < 1.5) {
            scene.remove(squid.visuals);
            squids.splice(i, 1);
            hunger = Math.min(100, hunger + 20);
            soundManager.play('gulp');
        }
    }

    const input = { f: keys['w'], b: keys['s'], l: keys['a'], r: keys['d'] };

    if (playerIsInWater) {
        penguinBody.material = penguinMaterial;
        penguinBody.linearDamping = 0.8;
        
        // Diving Logic
        if (isSliding) {
             penguinBody.force.y -= 50; 
        } else {
            // Buoyancy
            const depth = waterLevel - penguinBody.position.y;
            if (depth > 0) {
                 penguinBody.force.y += 140 * depth - penguinBody.velocity.y * 10;
            }
        }
    } else if (isSliding) {
        penguinBody.material = penguinSlidingMaterial;
        penguinBody.linearDamping = 0.01;
        
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
            penguinBody.force.x += parallel.x * 5; 
            penguinBody.force.z += parallel.z * 5;
        }
        
        // Steering Forces (Only if grounded)
        if (canJump) {
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
            if (input.f) {
                penguinBody.force.x -= camDir.x * steerForce;
                penguinBody.force.z -= camDir.z * steerForce;
            }
        }
        penguinBody.angularVelocity.set(0, 0, 0);
        return; 
    } else {
        penguinBody.material = penguinMaterial;
        // Low damping when in air, high damping when walking
        penguinBody.linearDamping = canJump ? 0.9 : 0.05; 
        penguinBody.angularVelocity.set(0, 0, 0);
    }

    // Standard WASD / Touch movement (Only when grounded or in water)
    if (canJump || playerIsInWater) {
        const currentMoveVelocity = isSprinting ? sprintMoveVelocity : moveVelocity;
        const rightDir = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        rightDir.y = 0;
        const camDir = new THREE.Vector3().crossVectors(rightDir, new THREE.Vector3(0,1,0));
        const vel = new CANNON.Vec3(0, 0, 0);
    
        if (touchTarget) {
            const dir = new THREE.Vector3().subVectors(touchTarget, penguinBody.position);
            dir.y = 0;
            if (dir.length() > 0.5) { 
                dir.normalize();
                vel.x = dir.x;
                vel.z = dir.z;
            }
        } else {
            if (input.f) { vel.x -= camDir.x; vel.z -= camDir.z; }
            if (input.b) { vel.x += camDir.x; vel.z += camDir.z; }
            if (input.l) { vel.x -= rightDir.x; vel.z -= rightDir.z; }
            if (input.r) { vel.x += rightDir.x; vel.z += rightDir.z; }
        }
    
        const currentYVelocity = penguinBody.velocity.y;
        if (vel.length() > 0) {
            vel.normalize();
            penguinBody.velocity.x = vel.x * currentMoveVelocity;
            penguinBody.velocity.z = vel.z * currentMoveVelocity;
            const angle = Math.atan2(penguinBody.velocity.x, penguinBody.velocity.z);
            
            if (!playerIsInWater) {
                soundManager.play('shuffle');
            }
    
            const targetRot = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
            if (playerIsInWater) {
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
    }
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

let activeRipple = 0;

function createSplash(position: CANNON.Vec3, impactVelocity: number = 5, isBlood: boolean = false) {
    const time = clock.getElapsedTime();
    
    // Update Shader Ripple (Toggle between 1 and 2)
    if (topMaterial.userData.shader) {
        if (activeRipple === 0) {
            topMaterial.userData.shader.uniforms.uRipple1.value.set(position.x, position.z, time);
            activeRipple = 1;
        } else {
            topMaterial.userData.shader.uniforms.uRipple2.value.set(position.x, position.z, time);
            activeRipple = 0;
        }
    }

    const scale = Math.min(3, impactVelocity / 8); 
    const particleCount = Math.max(5, Math.floor(20 * scale));
    
    // Select system
    let positions, velocities, lifespans, nextIdx, maxCount, geo;
    let opacities: Float32Array | null = null;

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
        opacities = splashParticleOpacities;
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
            (Math.random()) * 0.05 * scale + 0.05, // Reduced vertical velocity (4x less)
            (Math.random() - 0.5) * 0.2 * scale
        );
        lifespans[particleIndex] = (Math.random() * 30 + 30) * scale;
        if (opacities) opacities[particleIndex] = 1.0;

        nextIdx = (nextIdx + 1) % maxCount;
    }
    
    if (isBlood) nextBloodParticle = nextIdx;
    else nextSplashParticle = nextIdx;
    
    geo.attributes.position.needsUpdate = true;
    if (!isBlood) geo.attributes.opacity.needsUpdate = true;
}

function updateSplashParticles() {
    // Water
    let positions = splashParticles.geometry.attributes.position.array as Float32Array;
    let opacities = splashParticles.geometry.attributes.opacity.array as Float32Array;

    for (let i = 0; i < splashParticleCount; i++) {
        if (splashParticleLifespans[i] > 0) {
            splashParticleLifespans[i]--;
            positions[i * 3] += splashParticleVelocities[i].x;
            positions[i * 3 + 1] += splashParticleVelocities[i].y;
            positions[i * 3 + 2] += splashParticleVelocities[i].z;
            splashParticleVelocities[i].y -= 0.01; 
            opacities[i] = 1.0; // Keep full opacity
        } else {
            positions[i * 3 + 1] = -100;
            opacities[i] = 0;
        }
    }
    splashParticles.geometry.attributes.position.needsUpdate = true;
    splashParticles.geometry.attributes.opacity.needsUpdate = true;

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
    const followSpeed = 4.5;
    const separationDist = 1.5;

    npcPenguins.forEach((npc, index) => {
        // --- BOUNDARY CHECK ---
        const halfSize = terrainSize / 2 - 1.0; 
        if (Math.abs(npc.body.position.x) > halfSize) {
            npc.body.position.x = Math.sign(npc.body.position.x) * halfSize;
            npc.body.velocity.x *= -0.5; // Bounce back
        }
        if (Math.abs(npc.body.position.z) > halfSize) {
            npc.body.position.z = Math.sign(npc.body.position.z) * halfSize;
            npc.body.velocity.z *= -0.5;
        }

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
            if (npc.body.position.distanceTo(squid.position as any) < 1.5) {
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
                        const isFollowing = distanceToTarget < 5.0; // Follow if player is within this radius        
                if (isFollowing) {
                    const direction = targetPos.vsub(npc.body.position);
                    
                    // Movement Logic
                    if (distanceToTarget > 2.0) { // Stop if too close to avoid crowding
                        direction.normalize();
                        npc.body.velocity.x = direction.x * followSpeed;
                        npc.body.velocity.z = direction.z * followSpeed;
                    } else {
                        npc.body.velocity.x *= 0.9;
                        npc.body.velocity.z *= 0.9;
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
                    // If not following, just slow down
                    npc.body.velocity.x *= 0.9;
                    npc.body.velocity.z *= 0.9;
                }
                
                npc.update();    });
}

function updateSquids() {
    squids.forEach(squid => squid.update(squids));
}

// ======== DOLPHIN ========
class Dolphin {
    body: CANNON.Body;
    visuals: THREE.Group;
    jumpCooldown = 0;

    constructor(position: THREE.Vector3) {
        const shape = new CANNON.Box(new CANNON.Vec3(1.5, 0.4, 0.5));
        this.body = new CANNON.Body({
            mass: 150,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.8,
            angularDamping: 0.95 // Add angular damping to reduce spinning
        });
        this.body.addShape(shape);
        world.addBody(this.body);

        // Visuals
        this.visuals = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x88aaff, roughness: 0.1, metalness: 0.2 });
        
        // Main Body
        const bodyGeom = new THREE.CapsuleGeometry(0.5, 2.5, 8, 16);
        bodyGeom.rotateZ(Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        this.visuals.add(bodyMesh);

        // Dorsal Fin (3D)
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.quadraticCurveTo(0.5, 0.5, 1, 0);
        const finGeom = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false });
        const finMesh = new THREE.Mesh(finGeom, bodyMat);
        finMesh.position.set(0.5, 0.4, -0.05); // Centered on back
        finMesh.rotation.x = Math.PI/2;
        this.visuals.add(finMesh);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeom = new THREE.SphereGeometry(0.08);
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-1.4, 0.2, 0.3);
        this.visuals.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(-1.4, 0.2, -0.3);
        this.visuals.add(rightEye);
        
        scene.add(this.visuals);
    }

    update(target: CANNON.Vec3) {
        // Buoyancy
        const time = clock.getElapsedTime();
        const waveY = getWaveHeight(this.body.position.x, this.body.position.z, time);
        const depth = waveY - this.body.position.y;
        if (depth > -1.0) {
            this.body.force.y += 3000 * (depth + 0.5) - this.body.velocity.y * 100;
        }

        // Follow Logic (gentler)
        if (target.y < waterLevel + 2.0) {
            const dir = target.vsub(this.body.position);
            dir.normalize();
            // Apply a much smaller force, and only if not moving too fast already
            if (this.body.velocity.length() < 5) {
                this.body.velocity.x += dir.x * 0.1;
                this.body.velocity.z += dir.z * 0.1;
            }
        }
        
        // Iceberg avoidance
        for (const iceberg of icebergs) {
            const dist = this.body.position.distanceTo(iceberg.body.position);
            if (dist < 10) { // Detection radius
                const pushDir = this.body.position.vsub(iceberg.body.position);
                pushDir.y = 0; // Push horizontally
                pushDir.normalize();
                this.body.velocity.vadd(pushDir.scale(0.5), this.body.velocity);
            }
        }

        // Jumping
        if (this.jumpCooldown <= 0 && Math.random() < 0.01 && this.body.position.y > waterLevel -1) {
            this.body.velocity.y = 30;
            this.jumpCooldown = 5; // 5 seconds cooldown
        }
        this.jumpCooldown -= 1/60;

        // Visuals
        this.visuals.position.copy(this.body.position as any);
        if (this.body.velocity.length() > 0.1) {
            const angle = Math.atan2(-this.body.velocity.z, this.body.velocity.x);
            this.visuals.rotation.y = angle;
        }
    }
}

const dolphins: Dolphin[] = [];
dolphins.push(new Dolphin(new THREE.Vector3(20, 0, 0)));
dolphins.push(new Dolphin(new THREE.Vector3(25, 0, 10)));

// ======== PHYSICS UTILS ========
function threeMeshToCannonTrimesh(mesh: THREE.Mesh): CANNON.Trimesh {
    const geometry = mesh.geometry;
    const vertices = (geometry.attributes.position.array as Float32Array);
    const indices = (geometry.index!.array as Uint16Array | Uint32Array);
    return new CANNON.Trimesh(Array.from(vertices), Array.from(indices));
}

// ======== LOG CABIN ========
const cabinGroup = new THREE.Group();
const cabinX = -20;
const cabinZ = 10;
// Note: getHeight parameters depend on terrain generation logic.
// Based on terrain loop: vertices[j+2] = getHeight(worldX, -worldZ) where worldZ comes from -PlaneY.
// It seems getHeight expects (x, z). Let's try direct coordinates.
const cabinY = getHeight(cabinX, -cabinZ); 

// Base
const cabinBase = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }) // SaddleBrown
);
cabinBase.position.y = 1.5;
cabinBase.castShadow = true;
cabinBase.receiveShadow = true;
cabinGroup.add(cabinBase);

// Roof
const cabinRoof = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 2, 4),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }) // Darker Brown
);
cabinRoof.position.y = 3 + 1; 
cabinRoof.rotation.y = Math.PI / 4; // Align with box
cabinRoof.castShadow = true;
cabinRoof.receiveShadow = true;
cabinGroup.add(cabinRoof);

// Chimney
const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 2, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }) // Stone Grey
);
chimney.position.set(1.2, 3.5, 1.2);
chimney.castShadow = true;
cabinGroup.add(chimney);

// Door
const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: 0x221100, side: THREE.DoubleSide })
);
door.position.set(0, 1, 2.01);
cabinGroup.add(door);

cabinGroup.position.set(cabinX, cabinY, cabinZ);
scene.add(cabinGroup);

// Smoke System
const smokeCount = 50;
const smokeGeo = new THREE.BufferGeometry();
const smokePos = new Float32Array(smokeCount * 3);
const smokeLife = new Float32Array(smokeCount);
const smokeVel: THREE.Vector3[] = [];

for(let i=0; i<smokeCount; i++) {
    smokePos[i*3] = 0; smokePos[i*3+1] = -100; smokePos[i*3+2] = 0;
    smokeLife[i] = 0;
    smokeVel.push(new THREE.Vector3());
}
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));

const smokeMat = new THREE.PointsMaterial({
    color: 0xcccccc,
    size: 2.0,
    transparent: true,
    opacity: 0.4,
    map: createCircleTexture(),
    depthWrite: false,
    blending: THREE.NormalBlending
});
const smokeSystem = new THREE.Points(smokeGeo, smokeMat);
scene.add(smokeSystem);

function updateSmoke() {
    const chimneyWorldPos = new THREE.Vector3();
    chimney.getWorldPosition(chimneyWorldPos);
    chimneyWorldPos.y += 1.0; // Top of chimney

    const positions = smokeSystem.geometry.attributes.position.array as Float32Array;

    for(let i=0; i<smokeCount; i++) {
        if (smokeLife[i] <= 0) {
            // Respawn
            smokeLife[i] = 60 + Math.random() * 60;
            positions[i*3] = chimneyWorldPos.x + (Math.random()-0.5)*0.2;
            positions[i*3+1] = chimneyWorldPos.y;
            positions[i*3+2] = chimneyWorldPos.z + (Math.random()-0.5)*0.2;
            
            smokeVel[i].set(
                (Math.random()-0.5)*0.03 + 0.04, // Wind to +X
                0.04 + Math.random()*0.02,       // Up
                (Math.random()-0.5)*0.03
            );
        } else {
            smokeLife[i]--;
            positions[i*3] += smokeVel[i].x;
            positions[i*3+1] += smokeVel[i].y;
            positions[i*3+2] += smokeVel[i].z;
            
            // Wind acceleration
            smokeVel[i].x += 0.0005; 
        }
        
        if (smokeLife[i] <= 0) positions[i*3+1] = -100;
    }
    smokeSystem.geometry.attributes.position.needsUpdate = true;
}

// ======== ANIMATION LOOP ========
const clock = new THREE.Clock();
const uprightQuaternion = new THREE.Quaternion();
const slidingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-80 * Math.PI / 180, 0, 0));

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    if (jumpTimer > 0) jumpTimer -= deltaTime;
    
    // Update Caustics (Projected)
    if (topMaterial.userData.shader) {
        topMaterial.userData.shader.uniforms.uTime.value = elapsedTime;
    }
    
    world.step(1 / 60, deltaTime, 3);
    
    // Update Shader Time
    terrainUniforms.uTime.value = elapsedTime;
    
    // Water Waves (Gerstner Field)
    const positions = waterMesh.geometry.attributes.position.array as Float32Array;
    const basePositions = waterMesh.userData.basePositions as Float32Array;
    const topY = waterDepth / 2;
    
    for (let i = 0; i < positions.length; i += 3) {
        if (basePositions[i + 1] > topY - 0.1) {
            const bx = basePositions[i];
            const bz = basePositions[i + 2];
            
            const terrainH = getHeight(bx, -bz);
            let gPos = getGerstnerPosition(bx, bz, elapsedTime);
            
            // If terrain is above water, suppress horizontal displacement
            if (terrainH > waterLevel) {
                const suppression = Math.max(0.0, 1.0 - (terrainH - waterLevel) / 2.0); // Fade out chop over 2 units of height
                gPos.x = bx + (gPos.x - bx) * suppression;
                gPos.z = bz + (gPos.z - bz) * suppression;
            }
            
            positions[i] = gPos.x;
            positions[i + 1] = topY + (gPos.y - waterLevel);
            positions[i + 2] = gPos.z;
        }
    }
    waterMesh.geometry.attributes.position.needsUpdate = true;
    waterMesh.geometry.computeVertexNormals();
    
    // Marine Snow Pulse
    (marineSnowSystem.material as THREE.PointsMaterial).opacity = 0.4 + Math.sin(elapsedTime * 2) * 0.2;
    
    updatePenguinMovement();
    updateSplashParticles();
    updateSmoke(); // Add smoke update
    updateMarineSnow();
    

    updateIcebergs();
    updateShoreSplashes();
    updateNpcs();
    updateSquids();
    dolphins.forEach(d => d.update(penguinBody.position));
    
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
    
    // Apply camera offset for debugging
    camera.position.y += cameraYOffset;
    cameraDebugDiv.innerHTML = `Camera Y: ${camera.position.y.toFixed(2)} (Offset: ${cameraYOffset.toFixed(2)})`;
    
    renderer.render(scene, camera);
    
    // Reset camera position after rendering to not interfere with controls
    camera.position.y -= cameraYOffset;
}

// ======== RESIZE HANDLER ========
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
