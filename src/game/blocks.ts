import * as THREE from 'three';

export interface BlockDefinition {
    id: number;
    cells: number[][];
    color: THREE.Color;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
    { id: 0, cells: [[0, 0, 0], [-1, 0, 0], [0, 0, 1]], color: new THREE.Color(0xe74c3c) },
    { id: 1, cells: [[0, 0, 0], [-1, 0, 0], [0, 0, 1], [1, 0, 1]], color: new THREE.Color(0x3498db) },
    { id: 2, cells: [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [1, 0, 1]], color: new THREE.Color(0x2ecc71) },
    { id: 3, cells: [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1]], color: new THREE.Color(0xf39c12) },
    { id: 4, cells: [[0, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]], color: new THREE.Color(0x9b59b6) },
    { id: 5, cells: [[0, 0, 0], [-1, 0, 0], [0, 0, 1], [-1, 1, 0]], color: new THREE.Color(0x1abc9c) },
    { id: 6, cells: [[0, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 1]], color: new THREE.Color(0xe67e22) },
];
