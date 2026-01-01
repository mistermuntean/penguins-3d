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
world.solver.iterations = 10;

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
    const xVal = x / terrainSize * 5;
    const zVal = z / terrainSize * 5;
    let noise = noise2D(xVal, zVal) * 0.7 + noise2D(xVal * 2, zVal * 2) * 0.3;
    return (noise * 0.5 + 0.5) * terrainMaxHeight;
}

const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, visResolution - 1, visResolution - 1);
const vertices = terrainGeometry.attributes.position.array as number[];
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

function generatePenguinTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#eeeeee';
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = '#333333';
    context.beginPath();
    context.arc(32, 32, 32, Math.PI * 0.55, Math.PI * 1.45);
    context.fill();
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


// ======== CONTROLS & MOVEMENT ========
const keys: { [key: string]: boolean } = {};
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'control') {
        event.preventDefault();
    }
    keys[event.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (event) => keys[event.key.toLowerCase()] = false);
const moveVelocity = 5;
const jumpVelocity = 8;
let isSliding = false;
let canJump = false;

function checkGround() {
    const start = penguinBody.position;
    const end = new CANNON.Vec3(start.x, start.y - (penguinRadius + 0.1), start.z);
    const result = new CANNON.RaycastResult();
    result.reset();
    world.raycastClosest(start, end, {}, result);
    canJump = result.hasHit;
}

function updatePenguinMovement() {
    checkGround();
    const input = { f: keys['w'], b: keys['s'], l: keys['a'], r: keys['d'], j: keys[' '], slide: keys['control'] };
    isSliding = input.slide;

    penguinBody.material = isSliding ? penguinSlidingMaterial : penguinMaterial;
    
    if (isSliding) {
        // Allow minor steering torque while sliding
        const angVel = penguinBody.angularVelocity;
        if (input.l) { penguinBody.torque.y = 2; } 
        else if (input.r) { penguinBody.torque.y = -2; }
        else { penguinBody.angularVelocity.y *= 0.9; } // Dampen rotation
        return;
    }

    // Standard WASD movement
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
        penguinBody.velocity.x = vel.x * moveVelocity;
        penguinBody.velocity.z = vel.z * moveVelocity;
        const angle = Math.atan2(penguinBody.velocity.x, penguinBody.velocity.z);
        penguinBody.quaternion.slerp(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle), 0.15, penguinBody.quaternion);
    } else {
        penguinBody.velocity.x *= 0.8;
        penguinBody.velocity.z *= 0.8;
    }
    penguinBody.velocity.y = currentYVelocity;
    
    if (input.j && canJump) {
        penguinBody.velocity.y = jumpVelocity;
    }
}

// ======== ANIMATION LOOP ========
const clock = new THREE.Clock();
const uprightQuaternion = new THREE.Quaternion();
const slidingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    world.step(1 / 60, deltaTime, 3);
    
    updatePenguinMovement();
    
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