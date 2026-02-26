<template>
    <div ref="thumbRef" class="block-thumbnail" :class="{ active: isSelected }" @click="$emit('select', blockDef.id)">
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { BlockDefinition } from '../game/blocks';

const props = defineProps<{
    blockDef: BlockDefinition;
    isSelected: boolean;
}>();

defineEmits<{
    (e: 'select', id: number): void;
}>();

const thumbRef = ref<HTMLElement>();
let renderer: THREE.WebGLRenderer | null = null;
let animId = 0;

onMounted(() => {
    if (!thumbRef.value) return;

    const width = thumbRef.value.clientWidth;
    const height = thumbRef.value.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    thumbRef.value.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    // Build block
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.9));

    // Calculate center offset
    const center = new THREE.Vector3();
    for (const cell of props.blockDef.cells) {
        center.add(new THREE.Vector3(cell[0], cell[1], cell[2]));
    }
    center.divideScalar(props.blockDef.cells.length);

    for (const cell of props.blockDef.cells) {
        const mat = new THREE.MeshStandardMaterial({
            color: props.blockDef.color,
            roughness: 0.5,
            metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cell[0] - center.x, cell[1] - center.y, cell[2] - center.z);
        group.add(mesh);

        const edge = new THREE.LineSegments(
            edgeGeo,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        edge.position.copy(mesh.position);
        group.add(edge);
    }
    scene.add(group);

    // Slow rotation
    const animate = () => {
        animId = requestAnimationFrame(animate);
        group.rotation.y += 0.01;
        renderer!.render(scene, camera);
    };
    animate();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(animId);
    renderer?.dispose();
});
</script>

<style scoped>
.block-thumbnail {
    width: 80px;
    height: 80px;
    border: 2px solid #333;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.2s;
}

.block-thumbnail:hover {
    border-color: #666;
}

.block-thumbnail.active {
    border-color: #4fc3f7;
    box-shadow: 0 0 8px rgba(79, 195, 247, 0.5);
}
</style>
