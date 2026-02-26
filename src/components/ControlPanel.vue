<template>
    <div class="control-panel">
        <!-- Camera Controls -->
        <div class="control-group">
            <div class="control-label">摄像机</div>
            <div class="control-row">
                <button class="ctrl-btn" @click="$emit('camera-left')" title="旋转摄像机左 (A)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" fill="none"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <button class="ctrl-btn" @click="$emit('camera-reset')" title="重置摄像机">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" fill="none" />
                        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" />
                    </svg>
                </button>
                <button class="ctrl-btn" @click="$emit('camera-right')" title="旋转摄像机右 (D)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Block Rotation Controls -->
        <div class="control-group">
            <div class="control-label">翻转积木</div>
            <div class="dpad">
                <button class="ctrl-btn dpad-up" @click="$emit('flip', 'up')" title="上翻转 (↑)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M12 5l-7 7h14z" fill="currentColor" />
                    </svg>
                </button>
                <button class="ctrl-btn dpad-left" @click="$emit('flip', 'left')" title="左翻转 (←)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M5 12l7-7v14z" fill="currentColor" />
                    </svg>
                </button>
                <div class="dpad-center"></div>
                <button class="ctrl-btn dpad-right" @click="$emit('flip', 'right')" title="右翻转 (→)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M19 12l-7-7v14z" fill="currentColor" />
                    </svg>
                </button>
                <button class="ctrl-btn dpad-down" @click="$emit('flip', 'down')" title="下翻转 (↓)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M12 19l7-7H5z" fill="currentColor" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
defineEmits<{
    (e: 'camera-left'): void;
    (e: 'camera-right'): void;
    (e: 'camera-reset'): void;
    (e: 'flip', direction: 'up' | 'down' | 'left' | 'right'): void;
}>();
</script>

<style scoped>
.control-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 12px;
}

.control-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.control-label {
    color: #aaa;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.control-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.ctrl-btn {
    width: 44px;
    height: 44px;
    border: 1px solid #444;
    border-radius: 8px;
    background: #2a2a3e;
    color: #ccc;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
}

.ctrl-btn:hover {
    background: #3a3a5e;
    border-color: #666;
    color: #fff;
}

.ctrl-btn:active {
    background: #4a4a6e;
    transform: scale(0.95);
}

.dpad {
    display: grid;
    grid-template-columns: 44px 44px 44px;
    grid-template-rows: 44px 44px 44px;
    gap: 4px;
}

.dpad-up {
    grid-column: 2;
    grid-row: 1;
}

.dpad-left {
    grid-column: 1;
    grid-row: 2;
}

.dpad-center {
    grid-column: 2;
    grid-row: 2;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #1a1a2e;
}

.dpad-right {
    grid-column: 3;
    grid-row: 2;
}

.dpad-down {
    grid-column: 2;
    grid-row: 3;
}
</style>
