import * as THREE from 'three';
import { BlockDefinition } from './blocks';

const EDGE_COLOR = 0x000000;
const ROTATION_DURATION = 200; // ms

export class BlockObject extends THREE.Group {
    blockId: number;
    cells: number[][];
    baseColor: THREE.Color;
    private cellMeshes: THREE.Mesh[] = [];
    private edgeMeshes: THREE.LineSegments[] = [];
    selected: boolean = false;

    // Rotation animation state
    private isAnimating = false;
    private animStartTime = 0;
    private animStartQuat = new THREE.Quaternion();
    private animTargetQuat = new THREE.Quaternion();
    private animPivotGroup: THREE.Group | null = null; // visual wrapper during animation
    private pendingCells: number[][] | null = null; // cells after rotation completes

    // Position animation state (arc interpolation around pivot)
    private posAnimating = false;
    private posAnimStartPos: THREE.Vector3 | null = null;
    private posAnimTargetPos: THREE.Vector3 | null = null;
    private posAnimPivot: THREE.Vector3 | null = null;
    private posAnimAxis: THREE.Vector3 | null = null;
    private posAnimStartTime = 0;

    constructor(def: BlockDefinition) {
        super();
        this.blockId = def.id;
        this.cells = def.cells.map(c => [...c]);
        this.baseColor = def.color.clone();
        this.buildMeshes();
    }

    private buildMeshes() {
        // Clear old
        this.cellMeshes.forEach(m => {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });
        this.edgeMeshes.forEach(m => {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });
        this.cellMeshes = [];
        this.edgeMeshes = [];
        this.clear();

        const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.95, 0.95, 0.95));

        for (const cell of this.cells) {
            const mat = new THREE.MeshStandardMaterial({
                color: this.baseColor,
                roughness: 0.5,
                metalness: 0.1,
            });
            const mesh = new THREE.Mesh(geo.clone(), mat);
            mesh.position.set(cell[0], cell[1] + 0.5, cell[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.blockId = this.blockId;
            this.add(mesh);
            this.cellMeshes.push(mesh);

            const edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR, linewidth: 1 });
            const edge = new THREE.LineSegments(edgeGeo.clone(), edgeMat);
            edge.position.copy(mesh.position);
            this.add(edge);
            this.edgeMeshes.push(edge);
        }
    }

    setSelected(selected: boolean) {
        this.selected = selected;
        const emissive = selected ? 0x333333 : 0x000000;
        for (const mesh of this.cellMeshes) {
            (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(emissive);
        }
    }

    /**
     * Get all cell meshes for raycasting
     */
    getCellMeshes(): THREE.Mesh[] {
        return this.cellMeshes;
    }

    /**
     * Snap position to integer grid
     */
    snapToGrid() {
        this.position.x = Math.round(this.position.x);
        this.position.y = Math.max(0, Math.round(this.position.y));
        this.position.z = Math.round(this.position.z);
    }

    /**
     * Whether block is currently animating
     */
    get animating() {
        return this.isAnimating || this.posAnimating;
    }

    /**
     * Get world cell positions (integer grid)
     */
    getWorldCellPositions(): { x: number; y: number; z: number }[] {
        return this.cells.map(cell => ({
            x: Math.round(this.position.x + cell[0]),
            y: Math.round(this.position.y + cell[1]),
            z: Math.round(this.position.z + cell[2]),
        }));
    }

    /**
     * Animate position to target over ROTATION_DURATION ms.
     * If pivot and axis are given, interpolate along an arc (constant radius).
     * Otherwise, fall back to linear interpolation.
     */
    animatePositionTo(target: THREE.Vector3, pivot?: THREE.Vector3, axis?: THREE.Vector3) {
        this.posAnimStartPos = this.position.clone();
        this.posAnimTargetPos = target.clone();
        this.posAnimPivot = pivot ? pivot.clone() : null;
        this.posAnimAxis = axis ? axis.clone().normalize() : null;
        this.posAnimStartTime = performance.now();
        this.posAnimating = true;
    }

    /**
     * Rotate block 90 degrees around a given world axis — with animation
     */
    rotateBlock(axis: THREE.Vector3) {
        if (this.isAnimating) return; // don't stack rotations

        // Compute target cells after rotation
        const quat = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), Math.PI / 2);
        this.pendingCells = this.cells.map(cell => {
            const v = new THREE.Vector3(cell[0], cell[1], cell[2]);
            v.applyQuaternion(quat);
            return [Math.round(v.x), Math.round(v.y), Math.round(v.z)];
        });

        // Wrap all children in a pivot group for visual rotation
        // Pivot at (0, 0.5, 0) so visual rotation axis matches cell-space origin
        const pivot = new THREE.Vector3(0, 0.5, 0);
        this.animPivotGroup = new THREE.Group();
        this.animPivotGroup.position.copy(pivot);
        const childrenCopy = [...this.children];
        for (const child of childrenCopy) {
            child.position.sub(pivot);
            this.animPivotGroup.add(child);
        }
        this.add(this.animPivotGroup);

        // Set up animation
        this.animStartQuat.identity();
        this.animTargetQuat.copy(quat);
        this.animStartTime = performance.now();
        this.isAnimating = true;
    }

    /**
     * Called each frame to update animation
     */
    updateAnimation() {
        // Position animation
        if (this.posAnimating && this.posAnimStartPos && this.posAnimTargetPos) {
            const elapsed = performance.now() - this.posAnimStartTime;
            const t = Math.min(elapsed / ROTATION_DURATION, 1);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            if (this.posAnimPivot && this.posAnimAxis) {
                // Arc interpolation: rotate start relative position around axis by ease * PI/2
                const relStart = this.posAnimStartPos.clone().sub(this.posAnimPivot);
                const angle = ease * (Math.PI / 2);
                const q = new THREE.Quaternion().setFromAxisAngle(this.posAnimAxis, angle);
                const relCurrent = relStart.clone().applyQuaternion(q);
                this.position.copy(this.posAnimPivot).add(relCurrent);
            } else {
                // Linear fallback
                this.position.lerpVectors(this.posAnimStartPos, this.posAnimTargetPos, ease);
            }

            if (t >= 1) {
                this.position.copy(this.posAnimTargetPos);
                this.posAnimating = false;
                this.posAnimStartPos = null;
                this.posAnimTargetPos = null;
                this.posAnimPivot = null;
                this.posAnimAxis = null;
            }
        }

        if (!this.isAnimating || !this.animPivotGroup) return;

        const elapsed = performance.now() - this.animStartTime;
        const t = Math.min(elapsed / ROTATION_DURATION, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        const currentQuat = new THREE.Quaternion().slerpQuaternions(
            this.animStartQuat, this.animTargetQuat, ease
        );
        this.animPivotGroup.quaternion.copy(currentQuat);

        if (t >= 1) {
            // Animation complete — apply the real rotation to cells
            this.isAnimating = false;

            // Remove pivot group, reparent children
            const children = [...this.animPivotGroup.children];
            for (const child of children) {
                this.add(child);
            }
            this.remove(this.animPivotGroup);
            this.animPivotGroup = null;

            // Now apply the actual cell data
            if (this.pendingCells) {
                this.cells = this.pendingCells;
                this.pendingCells = null;
            }
            // Rebuild with correct positions
            this.buildMeshes();
            if (this.selected) {
                this.setSelected(true);
            }
        }
    }

    /**
     * Ensure all cells are above the floor (y >= 0)
     */
    adjustToFloor() {
        let minY = Infinity;
        for (const cell of this.cells) {
            const worldY = this.position.y + cell[1];
            if (worldY < minY) minY = worldY;
        }
        if (minY < 0) {
            this.position.y -= minY;
        }
        this.snapToGrid();
    }

    /**
     * Get the geometric center of the block in world coordinates
     */
    getWorldCenter(): THREE.Vector3 {
        const center = new THREE.Vector3();
        for (const cell of this.cells) {
            center.add(new THREE.Vector3(cell[0], cell[1] + 0.5, cell[2]));
        }
        center.divideScalar(this.cells.length);
        center.add(this.position);
        return center;
    }

    /**
     * Get the world position of the center cell (cells[0], always [0,0,0] initially).
     * This is used for gizmo positioning — it stays stable after rotation
     * since the rotation pivot is at this cell.
     */
    getCenterCellWorldPos(): THREE.Vector3 {
        const cell = this.cells[0];
        return new THREE.Vector3(cell[0], cell[1] + 0.5, cell[2]).add(this.position);
    }
}
