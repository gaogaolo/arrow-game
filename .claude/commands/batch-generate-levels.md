# Skill: 批量生成关卡（Node.js 脚本）

## 用途
在不打开浏览器的情况下，通过 Node.js 脚本批量生成多个关卡并输出为 JSON 文件。

## 核心思路

将 test.js 中的纯逻辑函数（不依赖 DOM）提取到 Node.js 环境中复用：
- `getPathsWithBend` — 路径生成
- `getRegionSize` — BFS 区域感知
- `buildWeightedOrder` / `parseWeightedText` — 权重随机
- `hasCycle` / `quickSolveCheck` — 死锁检测
- `validateAndStore` / `performSingleAdd` — 核心放置逻辑

## 批量生成脚本模板

```js
// generate_levels.js
// 使用方式：node generate_levels.js

// ========== 配置 ==========
const TOTAL_LEVELS = 100;       // 生成关卡总数
const MAP_ROWS = 10;
const MAP_COLS = 10;
const LENGTH_WEIGHTS = { 2: 20, 3: 30, 4: 24, 5: 12, 6: 6 };
const BEND_WEIGHTS = { 0: 40, 1: 35, 2: 20, 3: 5 };
const NEON_COLORS = ['#ff0055','#00e5ff','#a600ff','#ffaa00','#00ff66','#ff5500','#f0f'];

// ========== 全局状态（每关重置）==========
let rows, cols, gridMap, currentArrows, blockedCells;

function isBlocked(r, c) { return blockedCells.has(`${r},${c}`); }

function resetState(r, c) {
    rows = r; cols = c;
    gridMap = Array.from({length: r}, () => Array(c).fill(null));
    currentArrows = [];
    blockedCells = new Set();
}

// ========== 复制 test.js 中的纯逻辑函数 ==========
// 将以下函数从 test.js 复制到此处（无需修改）：
// - getRegionSize(r, c)
// - getRay(r, c, dir)
// - getDirectionFromPath(path)
// - getPathsWithBend(r, c, len, targetBends, maxPaths)
// - buildWeightedOrder(items, weightMap)
// - hasCycle(adj, n)
// - quickSolveCheck(arrows, grid)
// - validateAndStore(path, dir)
// - performSingleAdd(shouldRender, suppressLength1)

// ========== 单关卡生成 ==========
async function generateOneLevel(levelId) {
    resetState(MAP_ROWS, MAP_COLS);

    // Phase 1：主填充（禁止长度1）
    let fail1 = 0;
    while (fail1 < 30) {
        const ok = await performSingleAdd(false, true);
        if (ok) fail1 = 0; else fail1++;
    }
    // Phase 2：碎片修复
    let fail2 = 0;
    while (fail2 < 15) {
        const ok = await performSingleAdd(false, false);
        if (ok) fail2 = 0; else fail2++;
    }

    return {
        Level: levelId,
        MapSize: [rows, cols],
        Arrows: currentArrows.map(a => ({
            Id: a.id,
            Dir: a.dir,
            Path: a.path.map(p => `${p.r}_${p.c}`),
            Color: a.color
        }))
    };
}

// ========== 主入口 ==========
(async () => {
    const levels = [];
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
        process.stdout.write(`\r生成关卡 ${i}/${TOTAL_LEVELS}...`);
        const level = await generateOneLevel(i);
        levels.push(level);
    }
    console.log(`\n✅ 生成完成，共 ${levels.length} 个关卡`);

    const fs = require('fs');
    fs.writeFileSync('levels_output.json', JSON.stringify(levels, null, 2));
    console.log('已保存到 levels_output.json');
})();
```

## 使用步骤

1. 新建文件 `generate_levels.js`（在项目目录下）
2. 从 `test.js` 中复制上述标注的纯逻辑函数（约 200 行）
3. 修改顶部配置（关卡数、地图尺寸、权重等）
4. 运行：`node generate_levels.js`
5. 输出文件：`levels_output.json`

## 需要 Mock 的 DOM 调用

`test.js` 中的以下调用需要在 Node 环境中 Mock：
```js
// performSingleAdd 中读取权重配置，Node 环境改为直接使用变量：
// 原：const lengthWeights = readWeightedConfig('input-length-weights', ...);
// 改：const lengthWeights = LENGTH_WEIGHTS;
// 原：const bendWeights = readWeightedConfig('input-bend-weights', ...);
// 改：const bendWeights = BEND_WEIGHTS;
```

## 注意事项
- `performSingleAdd` 中的 `await new Promise(r => setTimeout(r, 0))` 在 Node 环境中保留，用于让事件循环喘气
- 生成速度约 1-3秒/关（10×10地图），100关约2-5分钟
- 如需加速，可将 Phase1 failCount 降至 20，Phase2 降至 10
