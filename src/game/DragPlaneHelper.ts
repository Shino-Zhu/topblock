import * as THREE from 'three';

const PLANE_SIZE = 10;
const GRID_DIVISIONS = 10;
const PLANE_COLOR = 0x4fc3f7;
const GRID_LINE_COLOR = 0x4fc3f7;

export class DragPlaneHelper extends THREE.Group {
    private planeMesh: THREE.Mesh;
    private gridHelper: THREE.LineSegments;

    constructor() {
        super();
        this.visible = false;

        // Semi-transparent emissive plane
        const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
        const planeMat = new THREE.MeshBasicMaterial({
            color: PLANE_COLOR,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.planeMesh = new THREE.Mesh(planeGeo, planeMat);
        this.add(this.planeMesh);

        // Grid lines on the plane
        this.gridHelper = this.createGridLines();
        this.add(this.gridHelper);
    }

    private createGridLines(): THREE.LineSegments {
        const halfSize = PLANE_SIZE / 2;
        const step = PLANE_SIZE / GRID_DIVISIONS;
        const points: THREE.Vector3[] = [];

        for (let i = 0; i <= GRID_DIVISIONS; i++) {
            const pos = -halfSize + i * step;
            // Horizontal lines
            points.push(new THREE.Vector3(-halfSize, pos, 0));
            points.push(new THREE.Vector3(halfSize, pos, 0));
            // Vertical lines
            points.push(new THREE.Vector3(pos, -halfSize, 0));
            points.push(new THREE.Vector3(pos, halfSize, 0));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: GRID_LINE_COLOR,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        return new THREE.LineSegments(geo, mat);
    }

    /**
     * Show the drag plane at given center with given normal direction
     */
    show(center: THREE.Vector3, normal: THREE.Vector3) {
        this.position.copy(center);

        // Orient the plane so its Z axis aligns with the plane normal
        const lookTarget = center.clone().add(normal);
        this.lookAt(lookTarget);

        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    dispose() {
        this.planeMesh.geometry.dispose();
        (this.planeMesh.material as THREE.Material).dispose();
        this.gridHelper.geometry.dispose();
        (this.gridHelper.material as THREE.Material).dispose();
    }
}
