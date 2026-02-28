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
    private cameraAnimMode: 'rotate' | 'reset' = 'rotate';
    // For angle-based rotation
    private camAnimStartAngle = 0;
    private camAnimDeltaAngle = 0;
    private camAnimRadius = 0;
    private camAnimHeight = 0;
    // For reset (position lerp)
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
        // Floor plane: -5.5 ~ 5.5
        const floorGeo = new THREE.PlaneGeometry(11, 11);
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

        // Grid: 11x11 with 11 divisions → lines at half-integer positions (-5.5, -4.5, ..., 4.5, 5.5)
        const gridHelper = new THREE.GridHelper(11, 11, GRID_COLOR, GRID_COLOR);
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

            if (this.cameraAnimMode === 'rotate') {
                // Angle-based interpolation to keep constant distance
                const angle = this.camAnimStartAngle + this.camAnimDeltaAngle * ease;
                this.camera.position.set(
                    this.controls.target.x + this.camAnimRadius * Math.cos(angle),
                    this.controls.target.y + this.camAnimHeight,
                    this.controls.target.z + this.camAnimRadius * Math.sin(angle)
                );
            } else {
                this.camera.position.lerpVectors(this.cameraStartPos, this.cameraTargetPos, ease);
            }

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
        this.cameraAnimMode = 'reset';
        this.cameraAnimStart = performance.now();
        this.cameraAnimating = true;
        this.controls.target.copy(LOOK_AT);
    }

    rotateCameraAroundY(angleDeg: number) {
        if (this.cameraAnimating) return; // don't stack animations
        const offset = this.camera.position.clone().sub(this.controls.target);
        this.camAnimRadius = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
        this.camAnimHeight = offset.y;
        this.camAnimStartAngle = Math.atan2(offset.z, offset.x);
        this.camAnimDeltaAngle = THREE.MathUtils.degToRad(angleDeg);
        this.cameraAnimMode = 'rotate';
        this.cameraAnimStart = performance.now();
        this.cameraAnimating = true;
    }

    dispose() {
        cancelAnimationFrame(this.animationId);
        this.renderer.dispose();
        this.controls.dispose();
    }
}
