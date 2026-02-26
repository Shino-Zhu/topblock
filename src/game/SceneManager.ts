import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const INITIAL_CAMERA_POS = new THREE.Vector3(6, 10, 8);
const LOOK_AT = new THREE.Vector3(0, 0, 0);
const BG_COLOR = 0x1a1a2e;
const FLOOR_COLOR = 0x16213e;
const GRID_COLOR = 0x0f3460;

export class SceneManager {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    private animationId: number = 0;
    private renderCallbacks: Array<() => void> = [];

    // Camera rotation animation
    private cameraAnimating = false;
    private cameraAnimStart = 0;
    private cameraAnimDuration = 500; // ms
    private cameraStartPos = new THREE.Vector3();
    private cameraTargetPos = new THREE.Vector3();

    constructor(container: HTMLElement) {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(BG_COLOR);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            container.clientWidth / container.clientHeight,
            0.1,
            100
        );
        this.camera.position.copy(INITIAL_CAMERA_POS);
        this.camera.lookAt(LOOK_AT);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.copy(LOOK_AT);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.update();

        // Lights
        this.setupLights();

        // Floor & Grid
        this.setupFloor();

        // Resize
        const onResize = () => {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', onResize);

        // Render loop
        this.animate();
    }

    private setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambient);

        const dir = new THREE.DirectionalLight(0xffffff, 1.6);
        dir.position.set(5, 10, 7);
        dir.castShadow = true;
        this.scene.add(dir);

        const dir2 = new THREE.DirectionalLight(0xffffff, 0.8);
        dir2.position.set(-5, 8, -5);
        this.scene.add(dir2);
    }

    private setupFloor() {
        // Floor plane
        const floorGeo = new THREE.PlaneGeometry(10, 10);
        const floorMat = new THREE.MeshStandardMaterial({
            color: FLOOR_COLOR,
            roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        floor.name = 'floor';
        this.scene.add(floor);

        // Grid
        const gridHelper = new THREE.GridHelper(10, 10, GRID_COLOR, GRID_COLOR);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);

        // Camera rotation animation
        if (this.cameraAnimating) {
            const now = performance.now();
            const elapsed = now - this.cameraAnimStart;
            const t = Math.min(elapsed / this.cameraAnimDuration, 1);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
            this.camera.position.lerpVectors(this.cameraStartPos, this.cameraTargetPos, ease);
            if (t >= 1) {
                this.cameraAnimating = false;
            }
        }

        this.controls.update();
        for (const cb of this.renderCallbacks) {
            cb();
        }
        this.renderer.render(this.scene, this.camera);
    };

    onRender(cb: () => void) {
        this.renderCallbacks.push(cb);
    }

    resetCamera() {
        this.cameraStartPos.copy(this.camera.position);
        this.cameraTargetPos.copy(INITIAL_CAMERA_POS);
        this.cameraAnimStart = performance.now();
        this.cameraAnimating = true;
        this.controls.target.copy(LOOK_AT);
    }

    rotateCameraAroundY(angleDeg: number) {
        if (this.cameraAnimating) return; // don't stack animations
        const angle = THREE.MathUtils.degToRad(angleDeg);
        // Use current camera position (possibly mid-animation target)
        const currentPos = this.cameraAnimating ? this.cameraTargetPos.clone() : this.camera.position.clone();
        const offset = currentPos.sub(this.controls.target);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const newX = offset.x * cosA + offset.z * sinA;
        const newZ = -offset.x * sinA + offset.z * cosA;
        offset.x = newX;
        offset.z = newZ;

        this.cameraStartPos.copy(this.camera.position);
        this.cameraTargetPos.copy(this.controls.target).add(offset);
        this.cameraAnimStart = performance.now();
        this.cameraAnimating = true;
    }

    dispose() {
        cancelAnimationFrame(this.animationId);
        this.renderer.dispose();
        this.controls.dispose();
    }
}
