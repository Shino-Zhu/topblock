<template>
    <div class="app-container">
        <!-- Left Sidebar: Block Thumbnails -->
        <div class="sidebar left-sidebar">
            <div class="sidebar-title">积木</div>
            <BlockThumbnail v-for="def in BLOCK_DEFINITIONS" :key="def.id" :blockDef="def"
                :isSelected="selectedBlockId === def.id" @select="onThumbnailSelect" />
        </div>

        <!-- Main Scene -->
        <div class="main-scene">
            <GameScene ref="gameSceneRef" @select="onBlockSelect" @ready="onSceneReady" />
        </div>

        <!-- Right Sidebar: Controls -->
        <div class="sidebar right-sidebar">
            <ControlPanel @camera-left="onCameraLeft" @camera-right="onCameraRight" @camera-reset="onCameraReset"
                @flip="onFlip" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GameScene from './components/GameScene.vue';
import BlockThumbnail from './components/BlockThumbnail.vue';
import ControlPanel from './components/ControlPanel.vue';
import { BLOCK_DEFINITIONS } from './game/blocks';
import type { SceneManager } from './game/SceneManager';
import type { InteractionManager } from './game/InteractionManager';

const gameSceneRef = ref<InstanceType<typeof GameScene>>();
const selectedBlockId = ref<number | null>(null);

let sceneMgr: SceneManager | null = null;
let interactionMgr: InteractionManager | null = null;

function onSceneReady(mgr: { scene: SceneManager; interaction: InteractionManager }) {
    sceneMgr = mgr.scene;
    interactionMgr = mgr.interaction;
}

function onBlockSelect(blockId: number | null) {
    selectedBlockId.value = blockId;
}

function onThumbnailSelect(id: number) {
    selectedBlockId.value = id;
    interactionMgr?.selectBlockById(id);
}

function onCameraLeft() {
    sceneMgr?.rotateCameraAroundY(90);
}

function onCameraRight() {
    sceneMgr?.rotateCameraAroundY(-90);
}

function onCameraReset() {
    sceneMgr?.resetCamera();
}

function onFlip(direction: 'up' | 'down' | 'left' | 'right') {
    interactionMgr?.flipBlock(direction);
}
</script>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html,
body,
#app {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #0a0a1a;
    color: #eee;
}
</style>

<style scoped>
.app-container {
    display: flex;
    width: 100%;
    height: 100%;
}

.sidebar {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #12122a;
    border-right: 1px solid #333;
    padding: 12px 8px;
    gap: 8px;
    overflow-y: auto;
}

.left-sidebar {
    width: 100px;
    border-right: 1px solid #333;
}

.right-sidebar {
    width: 170px;
    border-left: 1px solid #333;
    border-right: none;
}

.sidebar-title {
    color: #aaa;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
}

.main-scene {
    flex: 1;
    position: relative;
    overflow: hidden;
}
</style>