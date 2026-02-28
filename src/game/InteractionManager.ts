import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { BlockObject } from './BlockObject';
import { RotationGizmo } from './RotationGizmo';
import { DragPlaneHelper } from './DragPlaneHelper';

export class InteractionManager {
    private sceneMgr: SceneManager;
    private blocks: BlockObject[] = [];

    // Selection state: group + center
    private selectedGroup: BlockObject[] = [];
    private centerBlock: BlockObject | null = null;

    // Raycasting
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    // Pointer state
    private mouseDownPos = new THREE.Vector2();
    private pendingBlock: BlockObject | null = null;
    private hasMovedPastThreshold = false;
    private readonly mouseMoveThreshold = 3;

    // Drag state
    private isDragging = false;
    private dragTarget: BlockObject | null = null;
    private dragPlane: THREE.Plane | null = null;
    private dragOffset = new THREE.Vector3();
    private dragTargetStartPos = new THREE.Vector3();
    private groupDragStartPositions = new Map<BlockObject, THREE.Vector3>();
    private isGroupDrag = false;

    // Rotation gizmo
    private gizmo: RotationGizmo;
    private isGizmoDragging = false;
    private gizmoDragAxis: THREE.Vector3 | null = null;
    private gizmoDragPlane: THREE.Plane | null = null;
    private gizmoDragStartAngle = 0;
    private gizmoAccumulatedAngle = 0;

    // Drag plane helper
    private dragPlaneHelper: DragPlaneHelper;

    // Callbacks
    private onSelectChange: ((selectedIds: number[], centerId: number | null) => void) | null = null;
    private onCollisionChange: ((collidingIds: number[]) => void) | null = null;
    private lastCollidingIdsStr = '';

    constructor(sceneMgr: SceneManager) {
        this.sceneMgr = sceneMgr;
        const canvas = sceneMgr.renderer.domElement;

        // Create gizmo
        this.gizmo = new RotationGizmo();
        sceneMgr.scene.add(this.gizmo);

        // Create drag plane helper
        this.dragPlaneHelper = new DragPlaneHelper();
        sceneMgr.scene.add(this.dragPlaneHelper);

        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('dblclick', this.onDblClick);
        window.addEventListener('keydown', this.onKeyDown);

        // Register animation update
        sceneMgr.onRender(() => this.update());
    }

    private update() {
        // Update block animations
        for (const block of this.blocks) {
            block.updateAnimation();
        }
        // Update gizmo position if center block exists
        if (this.centerBlock && this.gizmo.visible && !this.isDragging && !this.isGizmoDragging) {
            this.gizmo.position.copy(this.centerBlock.getCenterCellWorldPos());
        }
        // Check collisions
        this.checkCollisions();
    }

    addBlock(block: BlockObject) {
        this.blocks.push(block);
        this.sceneMgr.scene.add(block);
    }

    setSelectCallback(cb: (selectedIds: number[], centerId: number | null) => void) {
        this.onSelectChange = cb;
    }

    setCollisionCallback(cb: (collidingIds: number[]) => void) {
        this.onCollisionChange = cb;
    }

    // --- Selection ---

    private selectGroupWithCenter(blocks: BlockObject[], center: BlockObject) {
        // Deselect previous
        for (const b of this.selectedGroup) {
            b.setSelected(false);
        }
        this.selectedGroup = blocks;
        this.centerBlock = center;

        for (const b of blocks) {
            b.setSelected(true);
        }
        this.gizmo.show(center.getCenterCellWorldPos());
        this.notifySelectChange();
    }

    private deselectAll() {
        for (const b of this.selectedGroup) {
            b.setSelected(false);
        }
        this.selectedGroup = [];
        this.centerBlock = null;
        this.gizmo.hide();
        this.notifySelectChange();
    }

    private notifySelectChange() {
        const ids = this.selectedGroup.map(b => b.blockId);
        const centerId = this.centerBlock?.blockId ?? null;
        this.onSelectChange?.(ids, centerId);
    }

    selectBlockById(id: number) {
        const block = this.blocks.find(b => b.blockId === id);
        if (block) {
            const connected = this.findConnectedBlocks(block);
            this.selectGroupWithCenter(connected, block);
        }
    }

    // --- Adjacency & Connectivity ---

    private areAdjacent(a: BlockObject, b: BlockObject): boolean {
        const cellsA = a.getWorldCellPositions();
        const cellsB = b.getWorldCellPositions();
        for (const ca of cellsA) {
            for (const cb of cellsB) {
                const dx = Math.abs(ca.x - cb.x);
                const dy = Math.abs(ca.y - cb.y);
                const dz = Math.abs(ca.z - cb.z);
                if (dx + dy + dz === 1) return true;
            }
        }
        return false;
    }

    private findConnectedBlocks(block: BlockObject): BlockObject[] {
        const visited = new Set<BlockObject>();
        const queue: BlockObject[] = [block];
        visited.add(block);

        while (queue.length > 0) {
            const current = queue.shift()!;
            for (const other of this.blocks) {
                if (visited.has(other)) continue;
                if (this.areAdjacent(current, other)) {
                    visited.add(other);
                    queue.push(other);
                }
            }
        }

        return Array.from(visited);
    }

    // --- Collision Detection ---

    private detectCollisions(): Set<number> {
        const cellMap = new Map<string, number[]>();
        for (const block of this.blocks) {
            const cells = block.getWorldCellPositions();
            for (const cell of cells) {
                const key = `${cell.x},${cell.y},${cell.z}`;
                if (!cellMap.has(key)) cellMap.set(key, []);
                cellMap.get(key)!.push(block.blockId);
            }
        }

        const colliding = new Set<number>();
        for (const ids of cellMap.values()) {
            if (ids.length > 1) {
                for (const id of ids) colliding.add(id);
            }
        }
        return colliding;
    }

    private checkCollisions() {
        // Don't check during animations to avoid flicker
        for (const block of this.blocks) {
            if (block.animating) return;
        }

        const colliding = this.detectCollisions();
        const str = Array.from(colliding).sort().join(',');
        if (str !== this.lastCollidingIdsStr) {
            this.lastCollidingIdsStr = str;
            this.onCollisionChange?.(Array.from(colliding));
        }
    }

    // --- Helpers ---

    private updateMouse(e: { clientX: number; clientY: number }) {
        const rect = this.sceneMgr.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private getAllCellMeshes(): THREE.Mesh[] {
        const meshes: THREE.Mesh[] = [];
        for (const block of this.blocks) {
            meshes.push(...block.getCellMeshes());
        }
        return meshes;
    }

    private findBlockByMesh(mesh: THREE.Object3D): BlockObject | null {
        let obj: THREE.Object3D | null = mesh;
        while (obj) {
            if (obj instanceof BlockObject) return obj;
            obj = obj.parent;
        }
        return null;
    }

    private chooseDragPlane(block: BlockObject): THREE.Plane {
        const camDir = new THREE.Vector3();
        this.sceneMgr.camera.getWorldDirection(camDir);

        const center = block.getWorldCenter();
        const planes = [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -center.x), // x = x0
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y), // y = y0
            new THREE.Plane(new THREE.Vector3(0, 0, 1), -center.z), // z = z0
        ];

        // Find the plane whose normal has the smallest angle with camera direction
        let bestPlane = planes[0];
        let bestDot = -Infinity;
        for (const plane of planes) {
            const dot = Math.abs(plane.normal.dot(camDir));
            if (dot > bestDot) {
                bestDot = dot;
                bestPlane = plane;
            }
        }
        return bestPlane;
    }

    private getAngleOnPlane(point: THREE.Vector3, center: THREE.Vector3, axis: THREE.Vector3): number {
        const dir = point.clone().sub(center);
        dir.sub(axis.clone().multiplyScalar(dir.dot(axis)));
        dir.normalize();

        const ref = new THREE.Vector3();
        if (Math.abs(axis.x) < 0.9) {
            ref.set(1, 0, 0);
        } else {
            ref.set(0, 1, 0);
        }
        const u = ref.clone().sub(axis.clone().multiplyScalar(ref.dot(axis))).normalize();
        const v = new THREE.Vector3().crossVectors(axis, u).normalize();

        return Math.atan2(dir.dot(v), dir.dot(u));
    }

    // --- Drag ---

    private startDrag(block: BlockObject) {
        this.isDragging = true;
        this.dragTarget = block;
        this.gizmo.hide();

        // Determine if group drag (block is in the current selection group)
        this.isGroupDrag = this.selectedGroup.includes(block);

        // Drag plane
        this.dragPlane = this.chooseDragPlane(block);
        this.dragTargetStartPos.copy(block.position);

        // Store group start positions for group drag
        this.groupDragStartPositions.clear();
        if (this.isGroupDrag) {
            for (const b of this.selectedGroup) {
                this.groupDragStartPositions.set(b, b.position.clone());
            }
        }

        // Show drag plane helper
        const center = block.getWorldCenter();
        this.dragPlaneHelper.show(center, this.dragPlane.normal.clone());

        // Calculate offset
        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);
        const planeIntersect = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);
        this.dragOffset.copy(block.position).sub(planeIntersect);
    }

    // --- Group Rotation ---

    private rotateGroup(axis: THREE.Vector3) {
        if (!this.centerBlock) return;
        // Don't rotate if any block is animating
        for (const block of this.selectedGroup) {
            if (block.animating) return;
        }

        const center = this.centerBlock;
        const pivot = center.position.clone();
        const normalizedAxis = axis.clone().normalize();
        const quat = new THREE.Quaternion().setFromAxisAngle(normalizedAxis, Math.PI / 2);

        // Compute target positions and check floor constraint
        const targetPositions = new Map<BlockObject, THREE.Vector3>();
        let minWorldY = Infinity;

        for (const block of this.selectedGroup) {
            let newPos: THREE.Vector3;
            if (block === center) {
                newPos = block.position.clone();
            } else {
                const relPos = block.position.clone().sub(pivot);
                relPos.applyQuaternion(quat);
                newPos = pivot.clone().add(new THREE.Vector3(
                    Math.round(relPos.x),
                    Math.round(relPos.y),
                    Math.round(relPos.z)
                ));
            }
            targetPositions.set(block, newPos);

            // Check rotated cells for floor
            for (const cell of block.cells) {
                const v = new THREE.Vector3(cell[0], cell[1], cell[2]).applyQuaternion(quat);
                const worldY = newPos.y + Math.round(v.y);
                if (worldY < minWorldY) minWorldY = worldY;
            }
        }

        // Floor adjustment
        const yOffset = minWorldY < 0 ? -minWorldY : 0;

        // Apply rotation and position animations
        for (const block of this.selectedGroup) {
            block.rotateBlock(axis);
            const pos = targetPositions.get(block)!;
            pos.y += yOffset;
            if (!pos.equals(block.position)) {
                block.animatePositionTo(pos, pivot, normalizedAxis);
            }
        }
    }

    // --- Pointer Events ---

    private onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        this.updateMouse(e);
        this.mouseDownPos.set(e.clientX, e.clientY);

        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

        // Check gizmo rings first
        if (this.gizmo.visible && this.centerBlock) {
            const gizmoIntersects = this.raycaster.intersectObjects(this.gizmo.getRingMeshes(), false);
            if (gizmoIntersects.length > 0) {
                const ringMesh = gizmoIntersects[0].object as THREE.Mesh;
                const axis = this.gizmo.getAxisForRing(ringMesh);
                if (axis) {
                    this.isGizmoDragging = true;
                    this.gizmoDragAxis = axis.clone();
                    this.sceneMgr.controls.enabled = false;

                    const center = this.gizmo.position.clone();
                    this.gizmoDragPlane = new THREE.Plane(axis, -axis.dot(center));

                    const intersectPoint = new THREE.Vector3();
                    this.raycaster.ray.intersectPlane(this.gizmoDragPlane, intersectPoint);
                    this.gizmoDragStartAngle = this.getAngleOnPlane(intersectPoint, center, axis);
                    this.gizmoAccumulatedAngle = 0;
                    return;
                }
            }
        }

        // Check block intersection — DON'T select yet, just record pending
        const intersects = this.raycaster.intersectObjects(this.getAllCellMeshes(), false);
        if (intersects.length > 0) {
            const block = this.findBlockByMesh(intersects[0].object);
            if (block) {
                this.pendingBlock = block;
                this.hasMovedPastThreshold = false;
                this.sceneMgr.controls.enabled = false;
            }
        }
    };

    private onPointerMove = (e: PointerEvent) => {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

        // Gizmo dragging
        if (this.isGizmoDragging && this.gizmoDragAxis && this.gizmoDragPlane && this.centerBlock) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.gizmoDragPlane, intersectPoint)) {
                const currentAngle = this.getAngleOnPlane(intersectPoint, this.gizmo.position, this.gizmoDragAxis);
                let delta = currentAngle - this.gizmoDragStartAngle;
                while (delta > Math.PI) delta -= Math.PI * 2;
                while (delta < -Math.PI) delta += Math.PI * 2;

                this.gizmoAccumulatedAngle += delta;
                this.gizmoDragStartAngle = currentAngle;

                if (Math.abs(this.gizmoAccumulatedAngle) >= Math.PI / 4) {
                    const sign = this.gizmoAccumulatedAngle > 0 ? 1 : -1;
                    const rotAxis = this.gizmoDragAxis.clone().multiplyScalar(sign);
                    this.rotateGroup(rotAxis);
                    this.gizmoAccumulatedAngle = 0;
                }
            }
            return;
        }

        // Check if we need to start drag (threshold exceeded)
        if (this.pendingBlock && !this.hasMovedPastThreshold && !this.isDragging) {
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= this.mouseMoveThreshold) {
                this.hasMovedPastThreshold = true;
                this.startDrag(this.pendingBlock);
            }
        }

        // Block dragging
        if (this.isDragging && this.dragTarget && this.dragPlane) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
                const newPos = intersectPoint.add(this.dragOffset);
                const snapped = new THREE.Vector3(
                    Math.round(newPos.x),
                    Math.max(0, Math.round(newPos.y)),
                    Math.round(newPos.z)
                );

                if (this.isGroupDrag) {
                    // Move whole group by integer delta
                    const delta = snapped.clone().sub(this.dragTargetStartPos);
                    for (const b of this.selectedGroup) {
                        const startPos = this.groupDragStartPositions.get(b)!;
                        b.position.set(
                            startPos.x + delta.x,
                            Math.max(0, startPos.y + delta.y),
                            startPos.z + delta.z
                        );
                    }
                } else {
                    // Move only the drag target
                    this.dragTarget.position.copy(snapped);
                }

                // Update drag plane helper position
                this.dragPlaneHelper.position.copy(this.dragTarget.getWorldCenter());
            }
            return;
        }

        // Hover effect on gizmo rings
        if (this.gizmo.visible) {
            const gizmoIntersects = this.raycaster.intersectObjects(this.gizmo.getRingMeshes(), false);
            if (gizmoIntersects.length > 0) {
                this.gizmo.highlightRing(gizmoIntersects[0].object as THREE.Mesh);
                this.sceneMgr.renderer.domElement.style.cursor = 'grab';
            } else {
                this.gizmo.highlightRing(null);
                this.sceneMgr.renderer.domElement.style.cursor = '';
            }
        }
    };

    private onPointerUp = (e: PointerEvent) => {
        if (e.button !== 0) return;

        // Gizmo drag end
        if (this.isGizmoDragging) {
            this.isGizmoDragging = false;
            this.gizmoDragAxis = null;
            this.gizmoDragPlane = null;
            this.sceneMgr.controls.enabled = true;
            return;
        }

        // Block drag end
        if (this.isDragging) {
            this.isDragging = false;
            this.dragPlaneHelper.hide();

            if (this.isGroupDrag) {
                for (const b of this.selectedGroup) {
                    b.snapToGrid();
                }
            } else if (this.dragTarget) {
                this.dragTarget.snapToGrid();
            }

            // Show gizmo at center block
            if (this.centerBlock) {
                this.gizmo.show(this.centerBlock.getCenterCellWorldPos());
            }

            this.sceneMgr.controls.enabled = true;
            this.resetPointerState();
            return;
        }

        // Click on block (no drag)
        if (this.pendingBlock && !this.hasMovedPastThreshold) {
            const block = this.pendingBlock;
            const isCenter = block === this.centerBlock;

            if (!isCenter) {
                // Select block + all connected blocks, make it center
                const connected = this.findConnectedBlocks(block);
                this.selectGroupWithCenter(connected, block);
            }
            // If already center, do nothing
        } else if (!this.pendingBlock) {
            // Check for click on empty space
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.mouseMoveThreshold) {
                this.updateMouse(e);
                this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

                // Don't deselect if clicking gizmo
                if (this.gizmo.visible) {
                    const gi = this.raycaster.intersectObjects(this.gizmo.getRingMeshes(), false);
                    if (gi.length > 0) {
                        this.sceneMgr.controls.enabled = true;
                        this.resetPointerState();
                        return;
                    }
                }

                const intersects = this.raycaster.intersectObjects(this.getAllCellMeshes(), false);
                if (intersects.length === 0) {
                    this.deselectAll();
                }
            }
        }

        this.sceneMgr.controls.enabled = true;
        this.resetPointerState();
    };

    private onDblClick = (e: MouseEvent) => {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

        const intersects = this.raycaster.intersectObjects(this.getAllCellMeshes(), false);
        if (intersects.length > 0) {
            const block = this.findBlockByMesh(intersects[0].object);
            if (block) {
                // Double-click: select ONLY this block (not connected ones)
                for (const b of this.selectedGroup) {
                    b.setSelected(false);
                }
                this.selectedGroup = [block];
                this.centerBlock = block;
                block.setSelected(true);
                this.gizmo.show(block.getCenterCellWorldPos());
                this.notifySelectChange();
            }
        }
    };

    private resetPointerState() {
        this.pendingBlock = null;
        this.hasMovedPastThreshold = false;
        this.isDragging = false;
        this.isGroupDrag = false;
        this.dragTarget = null;
        this.dragPlane = null;
        this.groupDragStartPositions.clear();
    }

    // --- Keyboard ---

    private onKeyDown = (e: KeyboardEvent) => {
        switch (e.key.toLowerCase()) {
            case 'a':
                this.sceneMgr.rotateCameraAroundY(90);
                break;
            case 'd':
                this.sceneMgr.rotateCameraAroundY(-90);
                break;
            case 'arrowup':
                e.preventDefault();
                this.flipBlock('up');
                break;
            case 'arrowdown':
                e.preventDefault();
                this.flipBlock('down');
                break;
            case 'arrowleft':
                e.preventDefault();
                this.flipBlock('left');
                break;
            case 'arrowright':
                e.preventDefault();
                this.flipBlock('right');
                break;
        }
    };

    flipBlock(direction: 'up' | 'down' | 'left' | 'right') {
        if (this.selectedGroup.length === 0 || !this.centerBlock) return;
        // Don't stack animations
        for (const block of this.selectedGroup) {
            if (block.animating) return;
        }

        const camDir = new THREE.Vector3();
        this.sceneMgr.camera.getWorldDirection(camDir);

        // Project camera forward onto XZ plane to get "forward" direction
        const forward = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();

        let axis: THREE.Vector3;
        switch (direction) {
            case 'up':
                axis = right.negate(); // flip up: top tilts away
                break;
            case 'down':
                axis = right.clone(); // flip down: top tilts toward
                break;
            case 'left':
                axis = up.negate(); // Rotate around -up for left
                break;
            case 'right':
                axis = up; // Rotate around up for right
                break;
        }

        // Snap axis to nearest cardinal direction
        const cardinals = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1),
        ];
        let bestAxis = cardinals[0];
        let bestDot = -Infinity;
        for (const c of cardinals) {
            const dot = axis.dot(c);
            if (dot > bestDot) {
                bestDot = dot;
                bestAxis = c;
            }
        }

        this.rotateGroup(bestAxis);
    }

    dispose() {
        const canvas = this.sceneMgr.renderer.domElement;
        canvas.removeEventListener('pointerdown', this.onPointerDown);
        canvas.removeEventListener('pointermove', this.onPointerMove);
        canvas.removeEventListener('pointerup', this.onPointerUp);
        canvas.removeEventListener('dblclick', this.onDblClick);
        window.removeEventListener('keydown', this.onKeyDown);
        this.gizmo.dispose();
        this.dragPlaneHelper.dispose();
    }
}
