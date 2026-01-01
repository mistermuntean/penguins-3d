import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createNoise2D } from 'simplex-noise';

// Final Polished Prototype

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
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -25, 0) });
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
const terrainSize = 128;
const terrainMaxHeight = 12;
const visResolution = 128; 

function getHeight(x: number, z: number): number {
    const xVal = x / terrainSize * 2.5;
    const zVal = z / terrainSize * 2.5;
    let noise = noise2D(xVal, zVal) * 0.7 + noise2D(xVal * 2, zVal * 2) * 0.3;
    return (noise * 0.5 + 0.5) * terrainMaxHeight;
}

const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, visResolution - 1, visResolution - 1);
const vertices = terrainGeometry.attributes.position.array as unknown as number[];
for (let i = 0, j = 0; i < vertices.length / 3; i++, j += 3) {
    vertices[j + 2] = getHeight(vertices[j], vertices[j + 1]);
}
terrainGeometry.computeVertexNormals();
const terrainMesh = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide }));
terrainMesh.rotation.x = -Math.PI / 2;
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

const trimeshShape = new CANNON.Trimesh(Array.from(vertices), Array.from(terrainGeometry.index!.array));
const terrainBody = new CANNON.Body({ mass: 0, material: groundMaterial, shape: trimeshShape });
terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(terrainBody);

// ======== CATCH PLANE ========
const catchPlaneGeometry = new THREE.PlaneGeometry(terrainSize * 2, terrainSize * 2);
const catchPlaneMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
const catchPlaneMesh = new THREE.Mesh(catchPlaneGeometry, catchPlaneMaterial);
catchPlaneMesh.rotation.x = -Math.PI / 2;
catchPlaneMesh.position.y = -20; // Well below everything
catchPlaneMesh.receiveShadow = true;
scene.add(catchPlaneMesh);

const catchPlaneShape = new CANNON.Plane();
const catchPlaneBody = new CANNON.Body({ mass: 0, material: groundMaterial });
catchPlaneBody.addShape(catchPlaneShape);
catchPlaneBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
catchPlaneBody.position.set(0, -20, 0);
world.addBody(catchPlaneBody);

// ======== WATER ========
const waterLevel = 4;
const waterGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize);
const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x006994,
    transparent: true,
    opacity: 0.7,
    metalness: 0.2,
    roughness: 0.3
});
const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.y = waterLevel;
scene.add(waterMesh);

// ======== PENGUIN ========
const penguinRadius = 0.5;
const penguinHeight = 1.0;

// Using a single Sphere for the smoothest possible movement
const penguinBody = new CANNON.Body({
    mass: 6,
    position: new CANNON.Vec3(0, terrainMaxHeight + 5, 0),
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


// ======== SQUID ========
// ======== SQUID ========
class Squid {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    visuals: THREE.Group;

    constructor(spawnPos: THREE.Vector3) {
        this.position = spawnPos.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);

        this.visuals = new THREE.Group();
        
        // Body: Flattened ovoid
        const bodyGeom = new THREE.SphereGeometry(0.2, 16, 16);
        bodyGeom.scale(1, 0.6, 0.4); // Flatten
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffa500, roughness: 0.2, metalness: 0.5 });
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        this.visuals.add(bodyMesh);

        // Eyes: Black spheres (Scaled down and positioned closer)
        const eyeGeom = new THREE.SphereGeometry(0.02, 8, 8); // Smaller
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(0.15, 0.05, 0.08); // Touching head
        this.visuals.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.15, 0.05, -0.08); // Touching head
        this.visuals.add(rightEye);

        // Tail: Half moon / Banana shape (Larger and better positioned)
        const tailGeom = new THREE.ConeGeometry(0.15, 0.4, 8); // Larger
        tailGeom.rotateZ(Math.PI / 2);
        const tailMesh = new THREE.Mesh(tailGeom, bodyMat);
        tailMesh.position.set(-0.3, 0, 0); // Further back
        this.visuals.add(tailMesh);

        this.visuals.frustumCulled = false; // Ensure visibility
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
const maxSquids = 30;
let attempts = 0;

// Spawn in lakes (low points)
while (squids.length < maxSquids && attempts < 2000) { 
    attempts++;
    const x = (Math.random() - 0.5) * terrainSize * 0.9;
    const z = (Math.random() - 0.5) * terrainSize * 0.9;
    const terrainY = getHeight(x, -z); // Fix Z coordinate
    
    // Only spawn if there is enough water depth
    // Must be at least 1.5 units deep to be worth it
    if (waterLevel > terrainY + 1.5) {
        // Spawn randomly within the volume
        const minY = terrainY + 0.8;
        const maxY = waterLevel - 0.5;
        const y = minY + Math.random() * (maxY - minY);
        squids.push(new Squid(new THREE.Vector3(x, y, z)));
    }
}


// ======== NPC PENGUINS ========
class NpcPenguin {
    body: CANNON.Body;
    visuals: THREE.Group;
    isFollowing = false;
    isInWater = false;
    chasingSquid: Squid | null = null;

    constructor(position: THREE.Vector3) {
        this.body = new CANNON.Body({
            mass: 6,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.9,
            material: penguinMaterial,
            shape: new CANNON.Sphere(penguinRadius)
        });
        world.addBody(this.body);

        this.visuals = new THREE.Group();
        const randomHue = Math.random() * 360;
        const backColor = `hsl(${randomHue}, 30%, 15%)`;
        const npcTexture = generatePenguinTexture(backColor);
        const bodyMesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(penguinRadius, penguinHeight, 8, 16),
            new THREE.MeshStandardMaterial({ map: npcTexture })
        );
        bodyMesh.castShadow = true;
        this.visuals.add(bodyMesh);

        const noseMesh = new THREE.Mesh(
            new THREE.ConeGeometry(0.2, 0.4, 8),
            new THREE.MeshStandardMaterial({ color: 0xffa500 })
        );
        noseMesh.position.set(0, 0.2, penguinRadius + 0.1);
        noseMesh.rotation.x = Math.PI / 2;
        this.visuals.add(noseMesh);
        
        const npcLeftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        npcLeftEye.position.set(0.2, 0.5, penguinRadius);
        this.visuals.add(npcLeftEye);

        const npcRightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        npcRightEye.position.set(-0.2, 0.5, penguinRadius);
        this.visuals.add(npcRightEye);
        
        scene.add(this.visuals);
    }

    update() {
        this.visuals.position.copy(this.body.position as any);
        this.visuals.quaternion.copy(this.body.quaternion as any);
    }
}

const npcPenguins: NpcPenguin[] = [];
const npcPositions = [
    new THREE.Vector3(10, terrainMaxHeight + 5, 10),
    new THREE.Vector3(12, terrainMaxHeight + 5, 10),
    new THREE.Vector3(10, terrainMaxHeight + 5, 12),
    new THREE.Vector3(-15, terrainMaxHeight + 5, -15),
    new THREE.Vector3(-17, terrainMaxHeight + 5, -15),
];

npcPositions.forEach(pos => {
    npcPenguins.push(new NpcPenguin(pos));
});


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
    
    if (key === ' ') {
        if ((canJump && penguinBody.velocity.y < 1) || playerIsInWater) {
            // Anticipatory tilt
            const tilt = new CANNON.Quaternion();
            tilt.setFromEuler(-0.5, 0, 0); // Tilt back
            penguinBody.quaternion.mult(tilt, penguinBody.quaternion);
            
            penguinBody.velocity.y = 12; // Slightly higher jump
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

const moveVelocity = 5;
const sprintMoveVelocity = 12;
let isSliding = false;
let isSprinting = false;
let canJump = false;
let playerIsInWater = false;

function checkGround() {
    // Direct height check is more robust for procedural terrain
    // Note: Mesh is rotated -90 on X, so world Z corresponds to -local Y (which was passed to getHeight)
    const terrainHeight = getHeight(penguinBody.position.x, -penguinBody.position.z);
    const distanceToGround = penguinBody.position.y - terrainHeight;
    
    // Bottom of penguin is at y - penguinRadius
    if (distanceToGround < penguinRadius + 0.3) {
        canJump = true;
    } else {
        canJump = false;
    }
}

function updatePenguinMovement() {
    checkGround();

    // Water splash check
    const wasInWater = playerIsInWater;
    playerIsInWater = penguinBody.position.y < waterLevel + penguinRadius;
    if (playerIsInWater && !wasInWater) {
        createSplash(penguinBody.position);
    }
    
    const input = { f: keys['w'], b: keys['s'], l: keys['a'], r: keys['d'] };

    if (playerIsInWater) {
        penguinBody.material = penguinMaterial;
        penguinBody.linearDamping = 0.8;
        
        // Buoyancy
        const depth = waterLevel - penguinBody.position.y;
        if (depth > 0) {
             // Spring-like buoyancy
             penguinBody.force.y += 200 * depth - penguinBody.velocity.y * 10;
        }
    } else if (isSliding) {
        penguinBody.material = penguinSlidingMaterial;
        penguinBody.linearDamping = 0.05; // Low damping for sliding
        
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
            
            penguinBody.force.x += parallel.x * 2; // Boost gravity effect
            penguinBody.force.z += parallel.z * 2;
        }

        // Lock tumbling while sliding, and remove steering
        penguinBody.angularVelocity.set(0, 0, 0);
        return;
    } else {
        penguinBody.material = penguinMaterial;
        penguinBody.linearDamping = 0.9; // High damping for walking
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
             // Steep forward lean for swimming
             const lean = new CANNON.Quaternion();
             lean.setFromEuler(Math.PI / 2.5, 0, 0); // ~70 degrees forward
             targetRot.mult(lean, targetRot);
        }
        
        penguinBody.quaternion.slerp(targetRot, 0.4, penguinBody.quaternion);
    } else {
        penguinBody.velocity.x *= 0.8;
        penguinBody.velocity.z *= 0.8;
    }
    penguinBody.velocity.y = currentYVelocity;
    
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

function createSplash(position: CANNON.Vec3) {
    for (let i = 0; i < 20; i++) { // 20 particles per splash
        const particleIndex = nextSplashParticle;
        splashParticlePositions[particleIndex * 3] = position.x + (Math.random() - 0.5) * 0.5;
        splashParticlePositions[particleIndex * 3 + 1] = waterLevel;
        splashParticlePositions[particleIndex * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;

        splashParticleVelocities[particleIndex].set(
            (Math.random() - 0.5) * 0.2,
            (Math.random()) * 0.2 + 0.1,
            (Math.random() - 0.5) * 0.2
        );
        splashParticleLifespans[particleIndex] = Math.random() * 30 + 30;
        nextSplashParticle = (nextSplashParticle + 1) % splashParticleCount;
    }
}

function updateSplashParticles() {
    const positions = splashParticles.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < splashParticleCount; i++) {
        if (splashParticleLifespans[i] > 0) {
            splashParticleLifespans[i]--;
            positions[i * 3] += splashParticleVelocities[i].x;
            positions[i * 3 + 1] += splashParticleVelocities[i].y;
            positions[i * 3 + 2] += splashParticleVelocities[i].z;
            splashParticleVelocities[i].y -= 0.01; // Gravity
        } else {
            positions[i * 3 + 1] = -100;
        }
    }
    splashParticles.geometry.attributes.position.needsUpdate = true;
}

function updateNpcs() {
    const followDistance = 8; // Increased range
    const followSpeed = 4.5; // 90% of player speed

    npcPenguins.forEach(npc => {
        // Water splash check
        const wasInWater = npc.isInWater;
        npc.isInWater = npc.body.position.y < waterLevel + penguinRadius;
        if (npc.isInWater && !wasInWater) {
            createSplash(npc.body.position);
        }
        
        // Buoyancy for NPCs
        if (npc.isInWater) {
             const depth = waterLevel - npc.body.position.y;
             if (depth > 0) {
                 npc.body.force.y += 200 * depth - npc.body.velocity.y * 10;
             }
             npc.body.linearDamping = 0.8;
        } else {
             npc.body.linearDamping = 0.9;
        }

        const distanceToPlayer = npc.body.position.distanceTo(penguinBody.position);

        if (distanceToPlayer < followDistance) {
            npc.isFollowing = true;
        }

        if (npc.isFollowing) {
            const direction = penguinBody.position.vsub(npc.body.position);
            direction.normalize();
            npc.body.velocity.x = direction.x * followSpeed;
            npc.body.velocity.z = direction.z * followSpeed;
            
            const angle = Math.atan2(npc.body.velocity.x, npc.body.velocity.z);
            const targetRot = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
            
            if (npc.isInWater) {
                 const lean = new CANNON.Quaternion();
                 lean.setFromEuler(Math.PI / 2.5, 0, 0); 
                 targetRot.mult(lean, targetRot);
            }
            
            npc.body.quaternion.slerp(targetRot, 0.15, npc.body.quaternion);
        } else {
            // Idle wander
            if (Math.random() > 0.98) {
                npc.body.angularVelocity.y = (Math.random() - 0.5) * 5;
            }
            // Small forward hop occasionally
            if (Math.random() > 0.99) {
                 const forward = new CANNON.Vec3(0, 0, 1);
                 npc.body.quaternion.vmult(forward, forward);
                 npc.body.velocity.x += forward.x * 2;
                 npc.body.velocity.z += forward.z * 2;
                 npc.body.velocity.y += 2; // mini hop
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
    world.step(1 / 60, deltaTime, 3);
    
    updatePenguinMovement();
    updateParticles();
    updateSplashParticles();
    updateNpcs();
    updateSquids();
    
    // Sync physics with main group
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