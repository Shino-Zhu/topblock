import * as THREE from 'three';

const RING_SEGMENTS = 64;
const RING_TUBE = 0.04;
const GIZMO_COLORS = {
    x: 0xff4444,
    y: 0x44ff44,
    z: 0x4444ff,
    hover: 0xffff00,
};

export class RotationGizmo extends THREE.Group {
    private rings: { axis: 'x' | 'y' | 'z'; mesh: THREE.Mesh }[] = [];
    private hoveredRing: THREE.Mesh | null = null;
    private isDragging = false;
    private dragAxis: THREE.Vector3 | null = null;
    private dragStartAngle = 0;
    private dragBlock: THREE.Object3D | null = null;
    private onRotate: ((axis: THREE.Vector3) => void) | null = null;

    constructor() {
        super();
        this.visible = false;
        this.createRings();
    }

    private createRings() {
        const axes: { axis: 'x' | 'y' | 'z'; color: number; rotation: THREE.Euler }[] = [
            { axis: 'x', color: GIZMO_COLORS.x, rotation: new THREE.Euler(0, Math.PI / 2, 0) },
            { axis: 'y', color: GIZMO_COLORS.y, rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
            { axis: 'z', color: GIZMO_COLORS.z, rotation: new THREE.Euler(0, 0, 0) },
        ];

        for (const { axis, color, rotation } of axes) {
            const geo = new THREE.TorusGeometry(1.2, RING_TUBE, 12, RING_SEGMENTS);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.7,
                depthTest: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.copy(rotation);
            mesh.userData.gizmoAxis = axis;
            mesh.renderOrder = 999;
            this.add(mesh);
            this.rings.push({ axis, mesh });
        }
    }

    show(worldCenter: THREE.Vector3) {
        this.position.copy(worldCenter);
        this.visible = true;
    }

    hide() {
        this.visible = false;
        this.resetHover();
    }

    getRingMeshes(): THREE.Mesh[] {
        return this.rings.map(r => r.mesh);
    }

    highlightRing(mesh: THREE.Mesh | null) {
        if (this.hoveredRing === mesh) return;
        this.resetHover();
        if (mesh) {
            (mesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
            (mesh.material as THREE.MeshBasicMaterial).color.setHex(GIZMO_COLORS.hover);
            this.hoveredRing = mesh;
        }
    }

    private resetHover() {
        if (this.hoveredRing) {
            const ring = this.rings.find(r => r.mesh === this.hoveredRing);
            if (ring) {
                (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
                (ring.mesh.material as THREE.MeshBasicMaterial).color.setHex(
                    GIZMO_COLORS[ring.axis]
                );
            }
            this.hoveredRing = null;
        }
    }

    getAxisForRing(mesh: THREE.Mesh): THREE.Vector3 | null {
        const axisName = mesh.userData.gizmoAxis;
        switch (axisName) {
            case 'x': return new THREE.Vector3(1, 0, 0);
            case 'y': return new THREE.Vector3(0, 1, 0);
            case 'z': return new THREE.Vector3(0, 0, 1);
            default: return null;
        }
    }

    setOnRotate(cb: (axis: THREE.Vector3) => void) {
        this.onRotate = cb;
    }

    dispose() {
        for (const { mesh } of this.rings) {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        }
    }
}
