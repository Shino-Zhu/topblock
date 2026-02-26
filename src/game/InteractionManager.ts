import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { BlockObject } from './BlockObject';
import { RotationGizmo } from './RotationGizmo';
import { DragPlaneHelper } from './DragPlaneHelper';

export class InteractionManager {
    private sceneMgr: SceneManager;
    private blocks: BlockObject[] = [];
    private selectedBlock: BlockObject | null = null;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private isDragging = false;
    private dragPlane: THREE.Plane | null = null;
    private dragOffset = new THREE.Vector3();
    private dragStartPos = new THREE.Vector3();
    private mouseDownPos = new THREE.Vector2();
    private onSelectChange: ((blockId: number | null) => void) | null = null;

    // Rotation gizmo
    private gizmo: RotationGizmo;
    private isGizmoDragging = false;
    private gizmoDragAxis: THREE.Vector3 | null = null;
    private gizmoDragPlane: THREE.Plane | null = null;
    private gizmoDragStartAngle = 0;
    private gizmoAccumulatedAngle = 0;

    // Drag plane helper
    private dragPlaneHelper: DragPlaneHelper;

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
        window.addEventListener('keydown', this.onKeyDown);

        // Register animation update
        sceneMgr.onRender(() => this.update());
    }

    private update() {
        // Update block animations
        for (const block of this.blocks) {
            block.updateAnimation();
        }
        // Update gizmo position if selected block exists
        if (this.selectedBlock && this.gizmo.visible && !this.isDragging && !this.isGizmoDragging) {
            this.gizmo.position.copy(this.selectedBlock.getWorldCenter());
        }
    }

    addBlock(block: BlockObject) {
        this.blocks.push(block);
        this.sceneMgr.scene.add(block);
    }

    setSelectCallback(cb: (blockId: number | null) => void) {
        this.onSelectChange = cb;
    }

    selectBlock(block: BlockObject | null) {
        if (this.selectedBlock) {
            this.selectedBlock.setSelected(false);
        }
        this.selectedBlock = block;
        if (block) {
            block.setSelected(true);
            this.gizmo.show(block.getWorldCenter());
        } else {
            this.gizmo.hide();
        }
        this.onSelectChange?.(block?.blockId ?? null);
    }

    selectBlockById(id: number) {
        const block = this.blocks.find(b => b.blockId === id);
        if (block) {
            this.selectBlock(block);
        }
    }

    private updateMouse(e: PointerEvent) {
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

    private onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        this.updateMouse(e);
        this.mouseDownPos.set(e.clientX, e.clientY);

        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

        // Check gizmo rings first
        if (this.gizmo.visible && this.selectedBlock) {
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

        // Check block intersection
        const intersects = this.raycaster.intersectObjects(this.getAllCellMeshes(), false);

        if (intersects.length > 0) {
            const block = this.findBlockByMesh(intersects[0].object);
            if (block) {
                this.selectBlock(block);
                this.isDragging = true;
                this.sceneMgr.controls.enabled = false;
                this.gizmo.hide(); // hide gizmo during drag

                // Determine drag plane
                this.dragPlane = this.chooseDragPlane(block);
                this.dragStartPos.copy(block.position);

                // Show drag plane helper
                const center = block.getWorldCenter();
                this.dragPlaneHelper.show(center, this.dragPlane.normal.clone());

                // Calculate offset
                const planeIntersect = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, planeIntersect);
                this.dragOffset.copy(block.position).sub(planeIntersect);
            }
        }
    };

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

    private onPointerMove = (e: PointerEvent) => {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

        // Gizmo dragging
        if (this.isGizmoDragging && this.gizmoDragAxis && this.gizmoDragPlane && this.selectedBlock) {
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
                    this.selectedBlock.rotateBlock(rotAxis);
                    this.gizmoAccumulatedAngle = 0;
                }
            }
            return;
        }

        // Block dragging
        if (this.isDragging && this.selectedBlock && this.dragPlane) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
                const newPos = intersectPoint.add(this.dragOffset);
                this.selectedBlock.position.x = Math.round(newPos.x);
                this.selectedBlock.position.y = Math.max(0, Math.round(newPos.y));
                this.selectedBlock.position.z = Math.round(newPos.z);

                // Update drag plane helper position
                this.dragPlaneHelper.position.copy(this.selectedBlock.getWorldCenter());
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

        const dx = e.clientX - this.mouseDownPos.x;
        const dy = e.clientY - this.mouseDownPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.isGizmoDragging) {
            this.isGizmoDragging = false;
            this.gizmoDragAxis = null;
            this.gizmoDragPlane = null;
            this.sceneMgr.controls.enabled = true;
            return;
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.sceneMgr.controls.enabled = true;
            this.dragPlaneHelper.hide();
            if (this.selectedBlock) {
                this.selectedBlock.snapToGrid();
                this.selectedBlock.adjustToFloor();
                this.gizmo.show(this.selectedBlock.getWorldCenter()); // show gizmo after drag
            }
        } else if (dist < 5) {
            // Click on empty space - deselect
            this.updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.sceneMgr.camera);

            // Don't deselect if clicking gizmo
            if (this.gizmo.visible) {
                const gizmoIntersects = this.raycaster.intersectObjects(this.gizmo.getRingMeshes(), false);
                if (gizmoIntersects.length > 0) return;
            }

            const intersects = this.raycaster.intersectObjects(this.getAllCellMeshes(), false);
            if (intersects.length === 0) {
                this.selectBlock(null);
            }
        }

        this.dragPlane = null;
    };

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
        if (!this.selectedBlock) return;
        if (this.selectedBlock.animating) return; // don't stack animations

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

        this.selectedBlock.rotateBlock(bestAxis);
    }

    dispose() {
        const canvas = this.sceneMgr.renderer.domElement;
        canvas.removeEventListener('pointerdown', this.onPointerDown);
        canvas.removeEventListener('pointermove', this.onPointerMove);
        canvas.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('keydown', this.onKeyDown);
        this.gizmo.dispose();
        this.dragPlaneHelper.dispose();
    }
}
