<template>
    <div ref="containerRef" class="game-scene"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { SceneManager } from '../game/SceneManager';
import { InteractionManager } from '../game/InteractionManager';
import { BlockObject } from '../game/BlockObject';
import { BLOCK_DEFINITIONS } from '../game/blocks';

const containerRef = ref<HTMLElement>();
let sceneMgr: SceneManager | null = null;
let interactionMgr: InteractionManager | null = null;

const emit = defineEmits<{
    (e: 'select', data: { selectedIds: number[]; centerId: number | null }): void;
    (e: 'collision', collidingIds: number[]): void;
    (e: 'ready', mgr: { scene: SceneManager; interaction: InteractionManager }): void;
}>();

onMounted(() => {
    if (!containerRef.value) return;

    sceneMgr = new SceneManager(containerRef.value);
    interactionMgr = new InteractionManager(sceneMgr);

    // Create blocks and place them in initial positions
    const startPositions = [
        [0, 0, 0],
        [3, 0, 0],
        [-3, 0, 0],
        [0, 0, 3],
        [0, 0, -3],
        [3, 0, 3],
        [-3, 0, -3],
    ];

    BLOCK_DEFINITIONS.forEach((def, i) => {
        const block = new BlockObject(def);
        block.position.set(startPositions[i][0], startPositions[i][1], startPositions[i][2]);
        block.snapToGrid();
        interactionMgr!.addBlock(block);
    });

    interactionMgr.setSelectCallback((selectedIds, centerId) => {
        emit('select', { selectedIds, centerId });
    });

    interactionMgr.setCollisionCallback((collidingIds) => {
        emit('collision', collidingIds);
    });

    emit('ready', { scene: sceneMgr, interaction: interactionMgr });
});

onBeforeUnmount(() => {
    interactionMgr?.dispose();
    sceneMgr?.dispose();
});

defineExpose({
    getSceneManager: () => sceneMgr,
    getInteractionManager: () => interactionMgr,
});
</script>

<style scoped>
.game-scene {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
</style>
