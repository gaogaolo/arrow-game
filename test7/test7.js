const NEON_COLORS = ['#ff0055', '#00e5ff', '#a600ff', '#ffaa00', '#00ff66', '#ff5500', '#f0f'];
const CELL_SIZE = 40;
const DEFAULT_LENGTH_WEIGHT_TEXT = '1:8,2:20,3:30,4:24,5:12,6:6';
const DEFAULT_BEND_WEIGHT_TEXT = '0:40,1:35,2:20,3:5';
const EXIT_STEP_MS = 100;
let currentArrows = [];
let gridMap = [];
let rows, cols;
let isPlaying = true;
let blockedCells = new Set(); // 存储被禁用的格子，格式为 "r,c"
let blockMode = false; // 是否处于选择禁区模式
let drawMode = false; // 是否处于手动绘制模式
let isMouseDown = false; // 鼠标是否按下
let currentDrawingPath = []; // 当前正在绘制的路径
let drawingOverlay = null; // 绘制时的临时覆盖层

// 切换禁区选择模式
function toggleBlockMode() {
    blockMode = !blockMode;
    const btn = document.getElementById('btn-block-mode');
    if (blockMode) {
        btn.classList.add('active');
        updateLog("🚫 禁区选择模式：点击或拖动选择禁区格子", "#9933ff");
        createCellOverlays();
    } else {
        btn.classList.remove('active');
        updateLog("已退出禁区选择模式", "#ffcc00");
        removeCellOverlays();
    }
}

// 清除所有禁区
function clearBlockedCells() {
    blockedCells.clear();
    renderBlockedCells();
    updateLog("已清除所有禁区", "#ff4444");
}

// 创建可点击的格子覆盖层
function createCellOverlays() {
    const board = document.getElementById('game-board');
    // 先移除旧的覆盖层
    removeCellOverlays();
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const overlay = document.createElement('div');
            overlay.className = 'cell-overlay';
            overlay.style.left = `${c * CELL_SIZE + 1}px`;
            overlay.style.top = `${r * CELL_SIZE + 1}px`;
            overlay.dataset.r = r;
            overlay.dataset.c = c;
            
            // 检查是否已经是禁区
            if (blockedCells.has(`${r},${c}`)) {
                overlay.classList.add('blocked');
            }
            
            // 鼠标事件
            overlay.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isMouseDown = true;
                toggleCellBlock(r, c, overlay);
            });
            overlay.addEventListener('mouseenter', () => {
                if (isMouseDown && blockMode) {
                    toggleCellBlock(r, c, overlay);
                }
            });
            
            board.appendChild(overlay);
        }
    }
    
    // 全局鼠标释放事件
    document.addEventListener('mouseup', () => { isMouseDown = false; });
}

// 移除格子覆盖层
function removeCellOverlays() {
    const overlays = document.querySelectorAll('.cell-overlay');
    overlays.forEach(o => o.remove());
}

// 切换格子的禁区状态
function toggleCellBlock(r, c, overlay) {
    const key = `${r},${c}`;
    if (blockedCells.has(key)) {
        blockedCells.delete(key);
        overlay.classList.remove('blocked');
    } else {
        blockedCells.add(key);
        overlay.classList.add('blocked');
    }
    updateLog(`禁区格子数: ${blockedCells.size}`, "#9933ff");
}

// 渲染禁区显示（在生成地图后显示）
function renderBlockedCells() {
    // 移除旧的禁区显示
    const oldBlocked = document.querySelectorAll('.blocked-cell');
    oldBlocked.forEach(b => b.remove());
    
    const board = document.getElementById('game-board');
    blockedCells.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        const cell = document.createElement('div');
        cell.className = 'blocked-cell';
        cell.style.left = `${c * CELL_SIZE + 1}px`;
        cell.style.top = `${r * CELL_SIZE + 1}px`;
        cell.style.width = '38px';
        cell.style.height = '38px';
        board.appendChild(cell);
    });
}

// 检查格子是否被禁用
function isBlocked(r, c) {
    return blockedCells.has(`${r},${c}`);
}

// 1. 初始化地图
function resetBoard() {
    rows = parseInt(document.getElementById('input-rows').value);
    cols = parseInt(document.getElementById('input-cols').value);
    const board = document.getElementById('game-board');
    board.style.width = `${cols * CELL_SIZE}px`;
    board.style.height = `${rows * CELL_SIZE}px`;
    board.innerHTML = '';
    gridMap = Array.from({length: rows}, () => Array(cols).fill(null));
    currentArrows = [];
    isPlaying = true;
    
    // 如果在禁区模式，重新创建覆盖层
    if (blockMode) {
        createCellOverlays();
    }
    
    updateLog("地图已清空");
}

// 2. 🚀 核心功能：全自动铺满
async function fillFullMap() {
    resetBoard();
    updateLog("正在生成关卡...");
    
    // 先生成所有箭头数据（不渲染）
    let failCount = 0;
    while (failCount < 20) {
        let success = await performSingleAdd(false);
        if (success) {
            failCount = 0;
        } else {
            failCount++;
        }
        if (currentArrows.length % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    // 渲染禁区
    renderBlockedCells();
    
    // 按箭头距离边缘的距离分组（从外到内）
    const arrowLayers = groupArrowsByLayer(currentArrows);
    const totalLayers = arrowLayers.length;
    const totalTimeMs = 1000;
    const layerAnimTime = Math.max(60, totalTimeMs / totalLayers);
    
    updateLog(`正在播放生成动画...`);
    
    // 按层级同时生成动画（从外向内蔓延）
    for (let layer = 0; layer < totalLayers; layer++) {
        const arrowsInLayer = arrowLayers[layer];
        // 同一层的箭头同时播放入场动画
        await Promise.all(arrowsInLayer.map(a => renderArrowWithAnimation(a, layerAnimTime)));
    }
    
    updateLog(`✅ 填充完毕，共 ${currentArrows.length} 根箭头`, "#00ff66");
}

// 3. ➕ 单次添加逻辑
async function addSingleArrow() {
    if (!gridMap.length) resetBoard();
    let success = await performSingleAdd(true);
    if (success) {
        updateLog(`✅ 已添加第 ${currentArrows.length} 根`, "#00ff66");
    } else {
        updateLog("⚠️ 找不到合法位置（可能已满或会产生死锁）", "#ff8800");
    }
}

// 执行添加的核心算法
async function performSingleAdd(shouldRender = true) {
    const lengthWeights = readWeightedConfig('input-length-weights', DEFAULT_LENGTH_WEIGHT_TEXT);
    const bendWeights = readWeightedConfig('input-bend-weights', DEFAULT_BEND_WEIGHT_TEXT);

    let emptyCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // 跳过禁区和已有箭头的格子
            if (gridMap[r][c] === null && !isBlocked(r, c)) {
                let dist = Math.min(r, rows - 1 - r, c, cols - 1 - c);
                emptyCells.push({r, c, dist});
            }
        }
    }
    if (emptyCells.length === 0) return false;

    // 优先从边缘开始尝试，增加填充密度
    emptyCells.sort((a, b) => a.dist - b.dist + (Math.random() * 0.5));
    const maxLenAllowed = Math.min(rows * cols, 20);
    const candidateLens = Object.keys(lengthWeights)
        .map(Number)
        .filter(len => Number.isInteger(len) && len >= 1 && len <= maxLenAllowed);
    const fallbackLens = [4, 3, 2, 1].filter(len => len <= maxLenAllowed);
    const lensToUse = candidateLens.length ? candidateLens : fallbackLens;
    
    for (let start of emptyCells.slice(0, 10)) { // 每次从最边缘的一批格子里选
        const lenOrder = buildWeightedOrder(lensToUse, lengthWeights);
        for (let len of lenOrder) {
            const maxBendForLen = Math.max(0, len - 2);
            const candidateBends = Object.keys(bendWeights)
                .map(Number)
                .filter(b => Number.isInteger(b) && b >= 0 && b <= maxBendForLen);
            const fallbackBends = Array.from({length: maxBendForLen + 1}, (_, i) => i);
            const bendsToUse = candidateBends.length ? candidateBends : fallbackBends;
            const bendOrder = buildWeightedOrder(bendsToUse, bendWeights);

            for (let bendCount of bendOrder) {
                let paths = getPathsWithBend(start.r, start.c, len, bendCount, 120);
                if (!paths.length) continue;
                paths.sort(() => Math.random() - 0.5);

                for (let path of paths) {
                    // 根據頭部和第二節身體的延伸方向決定箭頭方向
                    let dirs = getDirectionFromPath(path);
                    for (let dir of dirs) {
                        if (validateAndStore(path, dir)) {
                            if (shouldRender) renderArrow(currentArrows[currentArrows.length-1]);
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

// 验证死锁并存入数据（支持覆蓋舊箭頭）
function validateAndStore(path, dir) {
    let ray = getRay(path[0].r, path[0].c, dir);
    if (ray.some(r => path.some(p => p.r === r.r && p.c === r.c))) return false;

    // 找出路徑上需要移除的舊箭頭
    const arrowsToRemove = new Set();
    path.forEach(p => {
        const existingId = gridMap[p.r][p.c];
        if (existingId !== null) {
            arrowsToRemove.add(existingId);
        }
    });

    // 臨時移除被覆蓋的箭頭進行驗證
    const tempRemovedArrows = [];
    const tempGridMap = gridMap.map(row => [...row]);
    
    arrowsToRemove.forEach(id => {
        const arrow = currentArrows.find(a => a.id === id);
        if (arrow) {
            tempRemovedArrows.push(arrow);
            arrow.path.forEach(p => tempGridMap[p.r][p.c] = null);
        }
    });

    // 計算新ID（基於當前箭頭數量）
    let newId = currentArrows.length;
    
    // 構建依賴圖（使用臨時gridMap）
    let adj = {};
    currentArrows.forEach(a => {
        if (arrowsToRemove.has(a.id)) return; // 跳過將被移除的箭頭
        adj[a.id] = [];
        a.ray.forEach(rc => {
            let oid = tempGridMap[rc.r][rc.c];
            if (oid !== null && oid !== a.id) {
                adj[oid] = adj[oid] || [];
                if (!adj[oid].includes(a.id)) adj[oid].push(a.id);
            }
        });
    });
    adj[newId] = [];

    // 射線被誰擋？
    for (let rCell of ray) {
        let oid = tempGridMap[rCell.r][rCell.c];
        if (oid !== null) { 
            if (!adj[oid]) adj[oid]=[]; 
            if (!adj[oid].includes(newId)) adj[oid].push(newId); 
        }
    }
    
    // 身體擋了誰？（這個邏輯在約束1已經處理過，這裡保留用於依賴圖構建）
    currentArrows.forEach(old => {
        if (arrowsToRemove.has(old.id)) return; // 跳過將被移除的箭頭
        if (old.ray.some(rc => path.some(pc => pc.r === rc.r && pc.c === rc.c))) {
            if (!adj[newId].includes(old.id)) adj[newId].push(old.id);
        }
    });

    if (hasCycle(adj, newId + 1)) return false;

    // === 新增約束3：模擬求解驗證 ===
    // 確保添加新箭頭後，關卡仍然可解
    const simArrows = currentArrows
        .filter(a => !arrowsToRemove.has(a.id))
        .map(a => ({
            id: a.id,
            dir: a.dir,
            path: [...a.path],
            ray: [...a.ray],
            color: a.color
        }));
    
    // 添加新箭頭到模擬列表
    simArrows.push({
        id: newId,
        dir: dir,
        path: [...path],
        ray: [...ray],
        color: NEON_COLORS[0]
    });
    
    // 創建模擬網格
    const simGrid = Array.from({length: rows}, (_, r) => 
        Array.from({length: cols}, (_, c) => tempGridMap[r][c])
    );
    path.forEach(p => simGrid[p.r][p.c] = newId);
    
    // 快速模擬求解
    const simResult = quickSolveCheck(simArrows, simGrid);
    if (!simResult.solved) {
        return false;
    }

    // 驗證通過，正式移除被覆蓋的箭頭
    arrowsToRemove.forEach(id => {
        const arrow = currentArrows.find(a => a.id === id);
        if (arrow) {
            arrow.path.forEach(p => gridMap[p.r][p.c] = null);
            const el = document.getElementById(`a-${id}`);
            if (el) el.remove();
        }
        currentArrows = currentArrows.filter(a => a.id !== id);
    });

    // 記錄新箭頭數據
    let arrow = { id: newId, dir, path, ray, color: NEON_COLORS[newId % NEON_COLORS.length] };
    currentArrows.push(arrow);
    path.forEach(p => gridMap[p.r][p.c] = newId);
    return true;
}

// 快速求解檢查（用於驗證關卡可解性）
function quickSolveCheck(arrows, grid) {
    let remaining = [...arrows];
    let maxIterations = arrows.length * 2;
    let iterations = 0;
    
    while (remaining.length > 0 && iterations < maxIterations) {
        iterations++;
        let foundRemovable = false;
        
        for (let i = remaining.length - 1; i >= 0; i--) {
            const a = remaining[i];
            const blocked = a.ray.some(rc => grid[rc.r][rc.c] !== null && grid[rc.r][rc.c] !== a.id);
            
            if (!blocked) {
                a.path.forEach(p => grid[p.r][p.c] = null);
                remaining.splice(i, 1);
                foundRemovable = true;
                break;
            }
        }
        
        if (!foundRemovable) break;
    }
    
    return { solved: remaining.length === 0 };
}

// --- 基础工具函数 ---

function buildAdjTable(arrows, grid) {
    let adj = {};
    arrows.forEach(a => {
        adj[a.id] = adj[a.id] || [];
        a.ray.forEach(rc => {
            let oid = grid[rc.r][rc.c];
            if (oid !== null && oid !== a.id) {
                adj[oid] = adj[oid] || [];
                if (!adj[oid].includes(a.id)) adj[oid].push(a.id);
            }
        });
    });
    return adj;
}

function hasCycle(adj, n) {
    let visited = new Array(n + 1).fill(0);
    function dfs(u) {
        visited[u] = 1;
        for (let v of (adj[u] || [])) {
            if (visited[v] === 1) return true;
            if (visited[v] === 0 && dfs(v)) return true;
        }
        visited[u] = 2; return false;
    }
    for (let key in adj) {
        let i = parseInt(key);
        if (visited[i] === 0 && dfs(i)) return true;
    }
    return false;
}

function getPathsWithBend(r, c, len, targetBends, maxPaths = 120) {
    let res = [];
    function walk(cr, cc, p, prevDir, bends) {
        if (res.length >= maxPaths) return;
        if (p.length === len) {
            if (bends === targetBends) res.push([...p]);
            return;
        }
        let nexts = [
            {r:cr-1, c:cc, dir:'U'},
            {r:cr+1, c:cc, dir:'D'},
            {r:cr, c:cc-1, dir:'L'},
            {r:cr, c:cc+1, dir:'R'}
        ];
        nexts.sort(() => Math.random() - 0.5);
        for (let n of nexts) {
            const nextBends = prevDir && prevDir !== n.dir ? bends + 1 : bends;
            if (nextBends > targetBends) continue;
            // 跳过禁区格子
            if (n.r>=0 && n.r<rows && n.c>=0 && n.c<cols && gridMap[n.r][n.c]===null && !isBlocked(n.r, n.c)) {
                if (!p.some(i => i.r===n.r && i.c===n.c)) {
                    p.push({r:n.r, c:n.c});
                    walk(n.r, n.c, p, n.dir, nextBends);
                    p.pop();
                }
            }
        }
    }
    walk(r, c, [{r, c}], null, 0);
    return res;
}

function readWeightedConfig(inputId, defaultText) {
    const el = document.getElementById(inputId);
    if (!el) return parseWeightedText(defaultText);
    const text = (el.value || '').trim();
    const parsed = parseWeightedText(text);
    if (Object.keys(parsed).length === 0) {
        el.value = defaultText;
        return parseWeightedText(defaultText);
    }
    return parsed;
}

function parseWeightedText(text) {
    const out = {};
    if (!text) return out;
    const pairs = text.split(',');
    for (let raw of pairs) {
        const part = raw.trim();
        if (!part) continue;
        const [kText, wText] = part.split(':').map(s => (s || '').trim());
        const key = Number(kText);
        const weight = Number(wText);
        if (!Number.isFinite(key) || !Number.isFinite(weight) || weight <= 0) continue;
        out[Math.floor(key)] = weight;
    }
    return out;
}

function buildWeightedOrder(items, weightMap) {
    const pool = [...items];
    const order = [];
    while (pool.length) {
        let total = 0;
        for (let item of pool) total += (weightMap[item] || 0);
        if (total <= 0) {
            pool.sort(() => Math.random() - 0.5);
            order.push(...pool);
            break;
        }
        let pick = Math.random() * total;
        let chosenIdx = 0;
        for (let i = 0; i < pool.length; i++) {
            pick -= (weightMap[pool[i]] || 0);
            if (pick <= 0) { chosenIdx = i; break; }
        }
        order.push(pool[chosenIdx]);
        pool.splice(chosenIdx, 1);
    }
    return order;
}

function getRay(r, c, dir) {
    let ry = [], cr = r, cc = c;
    while (true) {
        if (dir === 'U') cr--; else if (dir === 'D') cr++; else if (dir === 'L') cc--; else if (dir === 'R') cc++;
        if (cr<0 || cr>=rows || cc<0 || cc>=cols) break;
        ry.push({r: cr, c: cc});
    }
    return ry;
}

// 根據頭部和第二節身體的延伸方向計算箭頭方向
// path[0] 是頭部位置，path[1] 是第二節身體位置
// 箭頭方向 = 身體延伸方向（即從 path[1] 指向 path[0] 的方向）
function getDirectionFromPath(path) {
    if (path.length < 2) {
        // 如果只有一節身體，允許所有方向
        return ['U', 'D', 'L', 'R'];
    }
    
    const head = path[0];      // 頭部位置
    const second = path[1];    // 第二節身體位置
    
    // 計算從第二節到頭部的方向（即身體延伸方向）
    const dr = head.r - second.r;  // 行差
    const dc = head.c - second.c;  // 列差
    
    // 根據延伸方向確定箭頭方向
    if (dr < 0) {
        // 頭部在第二節上方，身體往上延伸，箭頭朝上
        return ['U'];
    } else if (dr > 0) {
        // 頭部在第二節下方，身體往下延伸，箭頭朝下
        return ['D'];
    } else if (dc < 0) {
        // 頭部在第二節左方，身體往左延伸，箭頭朝左
        return ['L'];
    } else if (dc > 0) {
        // 頭部在第二節右方，身體往右延伸，箭頭朝右
        return ['R'];
    }
    
    // 理論上不會到達這裡（頭部和第二節不應該在同一位置）
    return ['U', 'D', 'L', 'R'];
}

function renderAll() {
    document.getElementById('game-board').innerHTML = '';
    // 先渲染禁区显示
    renderBlockedCells();
    // 再渲染箭头
    currentArrows.forEach(renderArrow);
}

function renderArrow(a) {
    let g = document.createElement('div');
    g.className = 'arrow-group'; g.id = `a-${a.id}`;
    a.path.forEach((p, i) => {
        let b = document.createElement('div');
        b.className = 'part'; b.style.left = `${p.c*CELL_SIZE}px`; b.style.top = `${p.r*CELL_SIZE}px`;
        b.style.backgroundColor = a.color; b.style.boxShadow = `0 0 10px ${a.color}88`;
        if (i === 0) {
            let h = document.createElement('div'); h.className = 'head-icon';
            let deg = {U:0, D:180, L:-90, R:90}[a.dir];
            h.style.transform = `rotate(${deg}deg)`;
            b.appendChild(h);
        }
        g.appendChild(b);
    });
    g.onclick = () => tryRemove(a);
    document.getElementById('game-board').appendChild(g);
}

// 貪吃蛇式入場動畫：箭頭從頭部開始逐格滾入
async function renderArrowWithAnimation(a, totalDurationMs) {
    const board = document.getElementById('game-board');
    const path = a.path;
    const pathLen = path.length;
    
    // 計算每個格子的動畫時間
    const cellAnimMs = Math.max(30, totalDurationMs / pathLen);
    
    // 創建箭頭容器
    let g = document.createElement('div');
    g.className = 'arrow-group'; g.id = `a-${a.id}`;
    g.onclick = () => tryRemove(a);
    
    // 預先創建所有part，但初始位置在頭部格子外側（根據方向）
    const dirDelta = { U: {r: -1, c: 0}, D: {r: 1, c: 0}, L: {r: 0, c: -1}, R: {r: 0, c: 1} }[a.dir];
    const headPos = path[0];
    const startPos = { r: headPos.r + dirDelta.r, c: headPos.c + dirDelta.c };
    
    const parts = [];
    path.forEach((p, i) => {
        let b = document.createElement('div');
        b.className = 'part';
        // 初始位置都在起始位置
        b.style.left = `${startPos.c * CELL_SIZE}px`;
        b.style.top = `${startPos.r * CELL_SIZE}px`;
        b.style.backgroundColor = a.color;
        b.style.boxShadow = `0 0 10px ${a.color}88`;
        b.style.opacity = '0';
        b.style.transition = `left ${cellAnimMs}ms cubic-bezier(0.22, 0.61, 0.36, 1), top ${cellAnimMs}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${cellAnimMs}ms ease`;
        b.style.willChange = 'left, top, opacity';
        
        if (i === 0) {
            let h = document.createElement('div'); h.className = 'head-icon';
            let deg = {U:0, D:180, L:-90, R:90}[a.dir];
            h.style.transform = `rotate(${deg}deg)`;
            b.appendChild(h);
        }
        g.appendChild(b);
        parts.push(b);
    });
    
    board.appendChild(g);
    
    // 等待一幀確保DOM更新
    await nextFrame();
    
    // 逐個格子滾入動畫
    // 模擬貪吃蛇：頭部先移動到目標位置，然後每個身體格子依次跟隨
    const bodyPositions = path.map(p => ({r: p.r, c: p.c}));
    
    for (let step = 0; step < pathLen; step++) {
        // 當前步驟：第step個格子移動到目標位置
        // 同時更新所有已顯示格子的位置（跟隨效果）
        
        for (let i = 0; i <= step; i++) {
            const targetIdx = step - i; // 頭部最先到達path[0]，後面的依次跟隨
            if (targetIdx >= 0 && targetIdx < pathLen) {
                const target = path[targetIdx];
                parts[i].style.left = `${target.c * CELL_SIZE}px`;
                parts[i].style.top = `${target.r * CELL_SIZE}px`;
                parts[i].style.opacity = '1';
            }
        }
        
        // 等待動畫完成
        await sleep(cellAnimMs);
    }
    
    // 確保所有格子都在正確位置
    path.forEach((p, i) => {
        parts[i].style.left = `${p.c * CELL_SIZE}px`;
        parts[i].style.top = `${p.r * CELL_SIZE}px`;
        parts[i].style.opacity = '1';
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 按箭頭距離邊緣的距離分組（從外到內）
function groupArrowsByLayer(arrows) {
    // 計算每根箭頭的最小邊緣距離（取箭頭所有格子的最小距離）
    const arrowDistances = arrows.map(a => {
        const minDist = Math.min(...a.path.map(p => 
            Math.min(p.r, rows - 1 - p.r, p.c, cols - 1 - p.c)
        ));
        return { arrow: a, dist: minDist };
    });
    
    // 按距離排序
    arrowDistances.sort((a, b) => a.dist - b.dist);
    
    // 分組：相同距離的箭頭在同一層
    const layers = [];
    let currentLayer = [];
    let currentDist = -1;
    
    for (const item of arrowDistances) {
        if (item.dist !== currentDist) {
            if (currentLayer.length > 0) {
                layers.push(currentLayer);
            }
            currentLayer = [item.arrow];
            currentDist = item.dist;
        } else {
            currentLayer.push(item.arrow);
        }
    }
    
    if (currentLayer.length > 0) {
        layers.push(currentLayer);
    }
    
    return layers;
}

async function tryRemove(a) {
    if (!isPlaying) return;
    let blocked = a.ray.some(rc => gridMap[rc.r][rc.c] !== null && gridMap[rc.r][rc.c] !== a.id);
    let el = document.getElementById(`a-${a.id}`);
    if (blocked) {
        el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    } else {
        a.path.forEach(p => gridMap[p.r][p.c] = null);
        currentArrows = currentArrows.filter(i => i.id !== a.id);
        await animateSnakeExit(a, el);
        if (currentArrows.length === 0) updateLog("🎉 通关！", "#00ffcc");
    }
}

async function animateSnakeExit(a, el) {
    if (!el) return;
    const parts = Array.from(el.querySelectorAll('.part'));
    if (!parts.length) {
        el.remove();
        return;
    }

    const delta = { U: {r: -1, c: 0}, D: {r: 1, c: 0}, L: {r: 0, c: -1}, R: {r: 0, c: 1} }[a.dir];
    let body = a.path.map(p => ({r: p.r, c: p.c}));
    const totalSteps = Math.max(rows, cols) + body.length + 2;

    parts.forEach(part => {
        part.style.transition = `left ${EXIT_STEP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), top ${EXIT_STEP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${EXIT_STEP_MS}ms ease`;
        part.style.willChange = 'left, top, opacity';
        part.style.backfaceVisibility = 'hidden';
        part.style.transform = 'translateZ(0)';
    });

    for (let step = 0; step < totalSteps; step++) {
        const prev = body.map(p => ({r: p.r, c: p.c}));
        body[0] = { r: prev[0].r + delta.r, c: prev[0].c + delta.c };
        for (let i = 1; i < body.length; i++) body[i] = prev[i - 1];

        await nextFrame();
        for (let i = 0; i < parts.length; i++) {
            const cell = body[i];
            parts[i].style.left = `${cell.c * CELL_SIZE}px`;
            parts[i].style.top = `${cell.r * CELL_SIZE}px`;
            parts[i].style.opacity = isOutside(cell) ? '0' : '1';
        }
        await waitForPartTransition(parts[0], EXIT_STEP_MS + 30);
    }
    el.remove();
}

function isOutside(cell) {
    return cell.r < 0 || cell.r >= rows || cell.c < 0 || cell.c >= cols;
}

function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function waitForPartTransition(part, fallbackMs) {
    return new Promise(resolve => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            part.removeEventListener('transitionend', onEnd);
            resolve();
        };
        const onEnd = (e) => {
            if (e.propertyName === 'left' || e.propertyName === 'top') finish();
        };
        part.addEventListener('transitionend', onEnd);
        setTimeout(finish, fallbackMs);
    });
}

function autoSolve() {
    isPlaying = false;
    let running = false;
    let timer = setInterval(async () => {
        if (running) return;
        let target = currentArrows.find(a => !a.ray.some(rc => gridMap[rc.r][rc.c] !== null && gridMap[rc.r][rc.c] !== a.id));
        if (target) {
            running = true;
            isPlaying = true;
            await tryRemove(target);
            isPlaying = false;
            running = false;
        }
        else { clearInterval(timer); isPlaying = true; updateLog("演示结束"); }
    }, EXIT_STEP_MS + 40);
}

function updateLog(msg, color="#ffcc00") {
    const log = document.getElementById('log');
    log.innerText = msg; log.style.color = color;
}

// 導出關卡JSON（彈出可複製文本框）
function exportLevel() {
    if (currentArrows.length === 0) {
        updateLog("⚠️ 沒有可導出的關卡數據", "#ff8800");
        return;
    }
    
    const levelId = parseInt(document.getElementById('input-level-id').value) || 1;
    
    const levelData = {
        Level: levelId,
        MapSize: [rows, cols],
        Arrows: currentArrows.map(a => ({
            Id: a.id,
            Dir: a.dir,
            Path: a.path,
            Color: a.color
        }))
    };
    
    const jsonStr = JSON.stringify(levelData, null, 2);
    showExportModal(jsonStr, levelId);
}

// 顯示導出彈窗
function showExportModal(jsonStr, levelId) {
    // 創建彈窗遮罩
    const overlay = document.createElement('div');
    overlay.id = 'export-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 1000;
        display: flex; justify-content: center; align-items: center;
    `;
    
    // 創建彈窗內容
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1a1a2e; border-radius: 12px; padding: 20px;
        max-width: 600px; width: 90%; max-height: 80vh;
        border: 1px solid #333; box-shadow: 0 0 30px rgba(0,200,100,0.3);
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #00ff66;">📤 关卡 ${levelId} JSON数据</h3>
            <button onclick="closeExportModal()" style="background: #555; color: #fff; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 16px;">✕</button>
        </div>
        <textarea id="export-textarea" readonly style="
            width: 100%; height: 300px; background: #0d0e15; color: #e0e0e0;
            border: 1px solid #333; border-radius: 6px; padding: 10px;
            font-family: monospace; font-size: 12px; resize: vertical;
        ">${jsonStr}</textarea>
        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="copyExportJson()" style="background: #00cc66; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-weight: bold;">📋 复制JSON</button>
            <button onclick="closeExportModal()" style="background: #555; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer;">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 點擊遮罩關閉
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeExportModal();
    });
    
    updateLog(`✅ 已生成關卡 ${levelId} JSON (${currentArrows.length}根箭頭)`, "#00ff66");
}

// 複製JSON到剪貼板
function copyExportJson() {
    const textarea = document.getElementById('export-textarea');
    textarea.select();
    document.execCommand('copy');
    updateLog("✅ JSON已複製到剪貼板", "#00ff66");
    
    // 顯示複製成功提示
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "✅ 已复制!";
    btn.style.background = "#00ff80";
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = "#00cc66";
    }, 1500);
}

// 關閉導出彈窗
function closeExportModal() {
    const overlay = document.getElementById('export-overlay');
    if (overlay) overlay.remove();
}

// 🔍 關卡可解性校驗
function verifyLevel() {
    if (currentArrows.length === 0) {
        updateLog("⚠️ 沒有可校驗的關卡數據", "#ff8800");
        return;
    }
    
    updateLog("🔍 正在校驗關卡可解性...", "#ff6600");
    
    // 清除之前的高亮
    clearDeadlockHighlight();
    
    // 深拷貝當前狀態進行模擬求解
    const simArrows = currentArrows.map(a => ({
        id: a.id,
        dir: a.dir,
        path: [...a.path],
        ray: [...a.ray],
        color: a.color
    }));
    
    const simGrid = Array.from({length: rows}, (_, r) => 
        Array.from({length: cols}, (_, c) => gridMap[r][c])
    );
    
    // 嘗試求解
    const result = solvePuzzle(simArrows, simGrid);
    
    if (result.solved) {
        updateLog(`✅ 關卡可解！共 ${currentArrows.length} 根箭頭，可完全消除`, "#00ff66");
    } else {
        updateLog(`❌ 發現死局！${result.deadlockArrows.length} 根箭頭無法消除`, "#ff0000");
        // 高亮死局箭頭
        highlightDeadlockArrows(result.deadlockArrows);
    }
}

// 求解算法：模擬消除過程
function solvePuzzle(arrows, grid) {
    let remaining = [...arrows];
    let removed = [];
    let maxIterations = arrows.length * arrows.length + 10;
    let iterations = 0;
    
    while (remaining.length > 0 && iterations < maxIterations) {
        iterations++;
        let foundRemovable = false;
        
        // 找出當前可以消除的箭頭
        for (let i = remaining.length - 1; i >= 0; i--) {
            const a = remaining[i];
            // 檢查射線是否被阻擋
            const blocked = a.ray.some(rc => grid[rc.r][rc.c] !== null && grid[rc.r][rc.c] !== a.id);
            
            if (!blocked) {
                // 可以消除
                a.path.forEach(p => grid[p.r][p.c] = null);
                removed.push(a.id);
                remaining.splice(i, 1);
                foundRemovable = true;
                break; // 每次只消除一個，重新開始檢查
            }
        }
        
        if (!foundRemovable) {
            // 沒有可消除的箭頭，進入死局
            break;
        }
    }
    
    if (remaining.length === 0) {
        return { solved: true, deadlockArrows: [] };
    } else {
        // 返回死局箭頭ID列表
        return { 
            solved: false, 
            deadlockArrows: remaining.map(a => a.id)
        };
    }
}

// 高亮死局箭頭
function highlightDeadlockArrows(deadlockIds) {
    deadlockIds.forEach(id => {
        const el = document.getElementById(`a-${id}`);
        if (el) {
            el.classList.add('deadlock-highlight');
        }
    });
}

// 清除死局高亮
function clearDeadlockHighlight() {
    document.querySelectorAll('.deadlock-highlight').forEach(el => {
        el.classList.remove('deadlock-highlight');
    });
}

// ✏️ 手動繪製模式
function toggleDrawMode() {
    drawMode = !drawMode;
    const btn = document.getElementById('btn-draw-mode');
    if (drawMode) {
        // 如果禁區模式開啟，先關閉
        if (blockMode) toggleBlockMode();
        btn.classList.add('active');
        updateLog("✏️ 繪製模式：點擊或拖動繪製箭頭身體", "#3399ff");
        createDrawOverlays();
    } else {
        btn.classList.remove('active');
        updateLog("已退出繪製模式", "#ffcc00");
        removeDrawOverlays();
        clearDrawingPath();
    }
}

// 創建繪製覆蓋層
function createDrawOverlays() {
    const board = document.getElementById('game-board');
    removeDrawOverlays();
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const overlay = document.createElement('div');
            overlay.className = 'draw-overlay';
            overlay.style.cssText = `
                position: absolute; width: 38px; height: 38px;
                left: ${c * CELL_SIZE + 1}px; top: ${r * CELL_SIZE + 1}px;
                z-index: 10; cursor: crosshair; box-sizing: border-box;
            `;
            overlay.dataset.r = r;
            overlay.dataset.c = c;
            
            // 只檢查是否為禁區，允許覆蓋已有箭頭
            const isBlockedCell = isBlocked(r, c);
            const hasArrow = gridMap[r][c] !== null;
            
            if (isBlockedCell) {
                overlay.style.background = 'rgba(255,0,0,0.2)';
                overlay.style.pointerEvents = 'none';
            } else if (hasArrow) {
                // 有箭頭的格子顯示黃色提示，表示可以覆蓋
                overlay.style.background = 'rgba(255,200,0,0.3)';
                overlay.style.border = '1px dashed #ffaa00';
            }
            
            // 鼠標事件
            overlay.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (isBlockedCell) return;
                isMouseDown = true;
                addToDrawPath(r, c, overlay);
            });
            overlay.addEventListener('mouseenter', () => {
                if (isMouseDown && drawMode && !isBlockedCell) {
                    addToDrawPath(r, c, overlay);
                }
            });
            
            board.appendChild(overlay);
        }
    }
    
    document.addEventListener('mouseup', finishDrawing);
}

// 移除繪製覆蓋層
function removeDrawOverlays() {
    document.querySelectorAll('.draw-overlay').forEach(o => o.remove());
    document.removeEventListener('mouseup', finishDrawing);
}

// 添加格子到繪製路徑
function addToDrawPath(r, c, overlay) {
    // 檢查是否已在路徑中
    if (currentDrawingPath.some(p => p.r === r && p.c === c)) return;
    
    // 檢查是否與現有路徑相鄰（第一個格子除外）
    if (currentDrawingPath.length > 0) {
        const last = currentDrawingPath[currentDrawingPath.length - 1];
        const isAdjacent = Math.abs(last.r - r) + Math.abs(last.c - c) === 1;
        if (!isAdjacent) return;
    }
    
    // 檢查格子是否已有箭頭（不允許覆蓋）
    if (gridMap[r][c] !== null) {
        updateLog(`⚠️ 此格子已有箭頭，請選擇空白格子`, "#ff8800");
        return;
    }
    
    currentDrawingPath.push({r, c});
    overlay.style.background = 'rgba(51, 153, 255, 0.5)';
    overlay.style.border = '2px solid #3399ff';
    
    updateLog(`✏️ 繪製中：${currentDrawingPath.length} 格`, "#3399ff");
}

// 完成繪製
function finishDrawing() {
    if (!drawMode || currentDrawingPath.length === 0) return;
    
    isMouseDown = false;
    
    // 獲取選擇的方向
    const dir = document.getElementById('draw-direction').value;
    
    // 驗證並存儲箭頭
    if (currentDrawingPath.length >= 1) {
        const path = currentDrawingPath;
        const success = validateAndStore(path, dir);
        
        if (success) {
            renderArrow(currentArrows[currentArrows.length - 1]);
            updateLog(`✅ 已添加第 ${currentArrows.length} 根箭頭`, "#00ff66");
        } else {
            updateLog("⚠️ 無效的箭頭（會產生死鎖或方向衝突）", "#ff8800");
        }
    }
    
    clearDrawingPath();
}

// 清除繪製路徑
function clearDrawingPath() {
    currentDrawingPath = [];
    // 重置所有繪製覆蓋層樣式
    document.querySelectorAll('.draw-overlay').forEach(o => {
        const r = parseInt(o.dataset.r);
        const c = parseInt(o.dataset.c);
        const isOccupied = gridMap[r][c] !== null || isBlocked(r, c);
        if (!isOccupied) {
            o.style.background = '';
            o.style.border = '';
        }
    });
}

// 初始化运行一次（只初始化地图，不自动填充，让用户可以先选择禁区）
resetBoard();
updateLog("请选择禁区或直接生成地图", "#ffcc00");

// ============================================
// 🎨 形狀生成功能
// ============================================

let shapeMode = false;
let currentShapeMask = null; // 存儲當前形狀掩碼 (二維數組，true表示可用格子)
let shapeModeOn = false; // 是否啟用形狀模式生成

// 切換形狀生成模式
function toggleShapeMode() {
    shapeMode = !shapeMode;
    const panel = document.getElementById('shape-panel');
    const btn = document.getElementById('btn-shape-mode');
    
    if (shapeMode) {
        panel.style.display = 'flex';
        btn.classList.add('active');
        // 清空預覽
        clearShapePreview();
    } else {
        panel.style.display = 'none';
        btn.classList.remove('active');
        currentShapeMask = null;
    }
}

// 清空形狀預覽
function clearShapePreview() {
    const canvas = document.getElementById('shape-preview-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentShapeMask = null;
}

// 從粘貼的SVG代碼生成形狀
function generateFromSvgCode() {
    const svgCode = document.getElementById('svg-code-input').value.trim();
    if (!svgCode) {
        updateLog("⚠️ 請粘貼SVG代碼", "#ff8800");
        return;
    }
    
    // 檢查是否包含SVG標籤
    if (!svgCode.includes('<svg') && !svgCode.includes('<?xml')) {
        updateLog("⚠️ 無效的SVG代碼，請確保包含<svg>標籤", "#ff8800");
        return;
    }
    
    updateLog("🎨 正在處理SVG代碼...", "#e91e63");
    renderSvgToCanvas(svgCode);
}

// 從文字/Emoji生成形狀
function generateFromText() {
    const text = document.getElementById('shape-text').value.trim();
    if (!text) {
        updateLog("⚠️ 請輸入文字或Emoji", "#ff8800");
        return;
    }
    
    updateLog("🎨 正在生成形狀...", "#e91e63");
    
    // 創建臨時canvas來渲染文字
    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // 清空畫布
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    
    // 繪製文字
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 根據文字長度調整字體大小
    let fontSize = text.length === 1 ? 150 : (text.length <= 3 ? 80 : 50);
    ctx.font = `bold ${fontSize}px Arial, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.fillText(text, size / 2, size / 2);
    
    // 生成形狀掩碼
    generateShapeMaskFromCanvas(canvas);
}

// 處理SVG上傳
function handleSvgUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    updateLog("🎨 正在處理SVG...", "#e91e63");
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const svgContent = e.target.result;
        renderSvgToCanvas(svgContent);
    };
    reader.readAsText(file);
    
    // 清空input以便重新選擇同一文件
    event.target.value = '';
}

// 將SVG渲染到Canvas
function renderSvgToCanvas(svgContent) {
    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // 使用白色背景（這樣可以檢測深色形狀）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    // 創建Image對象
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = function() {
        // 處理SVG沒有明確寬高的情況
        let imgWidth = img.width || 128;
        let imgHeight = img.height || 128;
        
        // 如果寬高為0或異常，使用默認值
        if (imgWidth <= 0 || imgHeight <= 0) {
            imgWidth = 128;
            imgHeight = 128;
        }
        
        // 計算縮放比例，保持寬高比，留出邊距
        const padding = 10;
        const availableSize = size - padding * 2;
        const scale = Math.min(availableSize / imgWidth, availableSize / imgHeight);
        const x = (size - imgWidth * scale) / 2;
        const y = (size - imgHeight * scale) / 2;
        
        ctx.drawImage(img, x, y, imgWidth * scale, imgHeight * scale);
        URL.revokeObjectURL(url);
        
        // 生成形狀掩碼（使用深色檢測模式）
        generateShapeMaskFromCanvas(canvas, true);
    };
    
    img.onerror = function() {
        updateLog("⚠️ SVG加載失敗，請檢查代碼格式", "#ff8800");
        URL.revokeObjectURL(url);
    };
    
    img.src = url;
}

// 從Canvas生成形狀掩碼
// detectDarkMode: true 表示檢測深色形狀（白背景），false 表示檢測淺色形狀（黑背景）
function generateShapeMaskFromCanvas(sourceCanvas, detectDarkMode = false) {
    const targetRows = parseInt(document.getElementById('input-rows').value) || 10;
    const targetCols = parseInt(document.getElementById('input-cols').value) || 10;
    
    // 獲取像素數據
    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const pixels = imageData.data;
    
    // 計算每個格子對應的像素區域
    const cellWidth = sourceCanvas.width / targetCols;
    const cellHeight = sourceCanvas.height / targetRows;
    
    // 先統計整體亮度分布，自動判斷最佳閾值
    let allBrightness = [];
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        if (a > 128) { // 只考慮不透明的像素
            allBrightness.push((r + g + b) / 3);
        }
    }
    
    // 計算平均亮度作為參考
    let avgBrightness = allBrightness.length > 0 
        ? allBrightness.reduce((a, b) => a + b, 0) / allBrightness.length 
        : 128;
    
    // 創建形狀掩碼
    const mask = [];
    for (let r = 0; r < targetRows; r++) {
        const row = [];
        for (let c = 0; c < targetCols; c++) {
            // 計算該格子對應的像素區域
            const startX = Math.floor(c * cellWidth);
            const startY = Math.floor(r * cellHeight);
            const endX = Math.floor((c + 1) * cellWidth);
            const endY = Math.floor((r + 1) * cellHeight);
            
            // 統計該區域的亮度和透明度
            let totalBrightness = 0;
            let opaquePixels = 0;
            let transparentPixels = 0;
            
            for (let py = startY; py < endY; py++) {
                for (let px = startX; px < endX; px++) {
                    const idx = (py * sourceCanvas.width + px) * 4;
                    const r = pixels[idx];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];
                    const a = pixels[idx + 3];
                    
                    if (a > 128) {
                        // 不透明像素
                        const brightness = (r + g + b) / 3;
                        totalBrightness += brightness;
                        opaquePixels++;
                    } else {
                        transparentPixels++;
                    }
                }
            }
            
            const totalPixels = opaquePixels + transparentPixels;
            
            // 判斷該格子是否屬於形狀
            let isShape = false;
            
            if (detectDarkMode) {
                // 深色檢測模式：白色背景上檢測深色形狀
                // 如果有大量不透明像素且平均亮度較低，則為形狀
                if (opaquePixels > totalPixels * 0.3) {
                    const avgCellBrightness = totalBrightness / opaquePixels;
                    // 使用整體平均亮度的中間值作為閾值
                    const threshold = Math.min(200, avgBrightness + 30);
                    isShape = avgCellBrightness < threshold;
                }
            } else {
                // 淺色檢測模式：黑色背景上檢測淺色形狀
                if (opaquePixels > totalPixels * 0.3) {
                    const avgCellBrightness = totalBrightness / opaquePixels;
                    isShape = avgCellBrightness > 50;
                }
            }
            
            row.push(isShape);
        }
        mask.push(row);
    }
    
    currentShapeMask = mask;
    
    // 顯示預覽
    renderShapePreview(mask, targetRows, targetCols);
    
    // 統計形狀格子數
    let shapeCells = 0;
    for (let r = 0; r < targetRows; r++) {
        for (let c = 0; c < targetCols; c++) {
            if (mask[r][c]) shapeCells++;
        }
    }
    
    if (shapeCells === 0) {
        updateLog(`⚠️ 未能識別形狀，請嘗試其他SVG或調整地圖尺寸`, "#ff8800");
    } else {
        updateLog(`✅ 形狀已生成 (${targetRows}x${targetCols})，共 ${shapeCells} 格`, "#00ff66");
    }
}

// 渲染形狀預覽
function renderShapePreview(mask, targetRows, targetCols) {
    const previewCanvas = document.getElementById('shape-preview-canvas');
    const ctx = previewCanvas.getContext('2d');
    const cellSize = Math.min(200 / Math.max(targetRows, targetCols), 20);
    
    // 調整canvas大小
    previewCanvas.width = targetCols * cellSize;
    previewCanvas.height = targetRows * cellSize;
    
    // 清空畫布
    ctx.fillStyle = '#0d0e15';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // 繪製形狀
    for (let r = 0; r < targetRows; r++) {
        for (let c = 0; c < targetCols; c++) {
            if (mask[r][c]) {
                ctx.fillStyle = '#e91e63';
                ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
            }
        }
    }
}

// 應用形狀掩碼生成關卡
async function applyShapeMask() {
    if (!currentShapeMask) {
        updateLog("⚠️ 請先生成形狀", "#ff8800");
        return;
    }
    
    // 保存形狀掩碼副本（因為關閉面板時會清空）
    const savedMask = currentShapeMask.map(row => [...row]);
    
    // 獲取目標尺寸
    const targetRows = savedMask.length;
    const targetCols = savedMask[0].length;
    
    // 更新輸入框
    document.getElementById('input-rows').value = targetRows;
    document.getElementById('input-cols').value = targetCols;
    
    // 重置地圖
    rows = targetRows;
    cols = targetCols;
    const board = document.getElementById('game-board');
    board.style.width = `${cols * CELL_SIZE}px`;
    board.style.height = `${rows * CELL_SIZE}px`;
    board.innerHTML = '';
    gridMap = Array.from({length: rows}, () => Array(cols).fill(null));
    currentArrows = [];
    isPlaying = true;
    
    // 將形狀外的格子設為禁區
    blockedCells.clear();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!savedMask[r][c]) {
                blockedCells.add(`${r},${c}`);
            }
        }
    }
    
    // 計算形狀內可用格子數（使用保存的副本）
    let availableCells = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (savedMask[r][c]) {
                availableCells++;
            }
        }
    }
    
    // 關閉形狀面板
    toggleShapeMode();
    
    updateLog(`🎨 正在生成形狀關卡... (${availableCells} 個可用格子)`, "#e91e63");
    
    // 先渲染禁區背景
    renderBlockedCells();
    
    // 等待一幀
    await new Promise(r => setTimeout(r, 10));
    
    // 生成箭頭
    let failCount = 0;
    let totalAttempts = 0;
    const maxAttempts = availableCells * 3; // 最大嘗試次數
    
    while (failCount < 30 && totalAttempts < maxAttempts) {
        totalAttempts++;
        let success = await performSingleAdd(false);
        if (success) {
            failCount = 0;
        } else {
            failCount++;
        }
        if (currentArrows.length % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    // 檢查是否生成了箭頭
    if (currentArrows.length === 0) {
        updateLog("⚠️ 未能生成箭頭，請嘗試更大的地圖尺寸或更簡單的形狀", "#ff8800");
        return;
    }
    
    updateLog(`🎨 已生成 ${currentArrows.length} 根箭頭，正在播放入場動畫...`, "#e91e63");
    
    // 按層級播放入場動畫
    const arrowLayers = groupArrowsByLayer(currentArrows);
    const totalLayers = arrowLayers.length;
    const totalTimeMs = 1500;
    const layerAnimTime = Math.max(60, totalTimeMs / totalLayers);
    
    for (let layer = 0; layer < totalLayers; layer++) {
        const arrowsInLayer = arrowLayers[layer];
        await Promise.all(arrowsInLayer.map(a => renderArrowWithAnimation(a, layerAnimTime)));
    }
    
    const shapeName = document.getElementById('shape-name').value || '形狀';
    updateLog(`✅ ${shapeName}關卡生成完畢，共 ${currentArrows.length} 根箭頭`, "#00ff66");
}

// ============================================
// 📥 導入關卡JSON功能
// ============================================

// 顯示導入彈窗
function showImportModal() {
    // 創建彈窗遮罩
    const overlay = document.createElement('div');
    overlay.id = 'import-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 1000;
        display: flex; justify-content: center; align-items: center;
    `;
    
    // 創建彈窗內容
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1a1a2e; border-radius: 12px; padding: 20px;
        max-width: 600px; width: 90%; max-height: 80vh;
        border: 1px solid #333; box-shadow: 0 0 30px rgba(33, 150, 243, 0.3);
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2196f3;">📥 导入关卡JSON</h3>
            <button onclick="closeImportModal()" style="background: #555; color: #fff; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 16px;">✕</button>
        </div>
        <div style="margin-bottom: 15px;">
            <button onclick="document.getElementById('json-upload').click()" style="background: #2196f3; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-weight: bold;">📁 选择JSON文件</button>
            <span style="margin-left: 10px; color: #888; font-size: 12px;">或直接粘贴JSON到下方</span>
        </div>
        <textarea id="import-textarea" placeholder="在此粘贴JSON数据..." style="
            width: 100%; height: 250px; background: #0d0e15; color: #e0e0e0;
            border: 1px solid #333; border-radius: 6px; padding: 10px;
            font-family: monospace; font-size: 12px; resize: vertical;
        "></textarea>
        <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="importFromText()" style="background: #4caf50; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-weight: bold;">✅ 导入JSON</button>
            <button onclick="closeImportModal()" style="background: #555; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer;">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 點擊遮罩關閉
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeImportModal();
    });
}

// 關閉導入彈窗
function closeImportModal() {
    const overlay = document.getElementById('import-overlay');
    if (overlay) overlay.remove();
}

// 處理JSON文件上傳
function handleJsonUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const jsonText = e.target.result;
        document.getElementById('import-textarea').value = jsonText;
        // 自動嘗試導入
        importFromText();
    };
    reader.onerror = function() {
        updateLog("⚠️ 文件讀取失敗", "#ff8800");
    };
    reader.readAsText(file);
    
    // 清空input以便重新選擇同一文件
    event.target.value = '';
}

// 從文本框導入JSON
function importFromText() {
    const jsonText = document.getElementById('import-textarea').value.trim();
    if (!jsonText) {
        updateLog("⚠️ 請輸入JSON數據", "#ff8800");
        return;
    }
    
    // 嘗試解析JSON
    let levelData;
    try {
        levelData = JSON.parse(jsonText);
    } catch (e) {
        updateLog("⚠️ JSON格式錯誤，請檢查格式", "#ff8800");
        return;
    }
    
    // 驗證JSON結構
    const validation = validateLevelJson(levelData);
    if (!validation.valid) {
        updateLog(`⚠️ ${validation.message}`, "#ff8800");
        return;
    }
    
    // 關閉彈窗
    closeImportModal();
    
    // 導入關卡
    importLevel(levelData);
}

// 驗證關卡JSON格式
function validateLevelJson(data) {
    // 檢查必需字段
    if (typeof data !== 'object' || data === null) {
        return { valid: false, message: "JSON必須是對象類型" };
    }
    
    // 檢查MapSize
    if (!data.MapSize) {
        return { valid: false, message: "缺少MapSize字段" };
    }
    if (!Array.isArray(data.MapSize) || data.MapSize.length !== 2) {
        return { valid: false, message: "MapSize必須是包含2個數字的數組 [rows, cols]" };
    }
    if (typeof data.MapSize[0] !== 'number' || typeof data.MapSize[1] !== 'number') {
        return { valid: false, message: "MapSize的元素必須是數字" };
    }
    if (data.MapSize[0] < 1 || data.MapSize[1] < 1) {
        return { valid: false, message: "MapSize的值必須大於0" };
    }
    
    // 檢查Arrows
    if (!data.Arrows) {
        return { valid: false, message: "缺少Arrows字段" };
    }
    if (!Array.isArray(data.Arrows)) {
        return { valid: false, message: "Arrows必須是數組" };
    }
    
    // 檢查每個箭頭的結構
    for (let i = 0; i < data.Arrows.length; i++) {
        const arrow = data.Arrows[i];
        if (typeof arrow !== 'object' || arrow === null) {
            return { valid: false, message: `Arrows[${i}]必須是對象` };
        }
        
        // Id字段（可選，但如果存在必須是數字）
        if (arrow.Id !== undefined && typeof arrow.Id !== 'number') {
            return { valid: false, message: `Arrows[${i}].Id必須是數字` };
        }
        
        // Dir字段
        if (!arrow.Dir) {
            return { valid: false, message: `Arrows[${i}]缺少Dir字段` };
        }
        if (!['U', 'D', 'L', 'R'].includes(arrow.Dir)) {
            return { valid: false, message: `Arrows[${i}].Dir必須是U、D、L或R` };
        }
        
        // Path字段
        if (!arrow.Path) {
            return { valid: false, message: `Arrows[${i}]缺少Path字段` };
        }
        if (!Array.isArray(arrow.Path)) {
            return { valid: false, message: `Arrows[${i}].Path必須是數組` };
        }
        if (arrow.Path.length < 1) {
            return { valid: false, message: `Arrows[${i}].Path不能為空` };
        }
        
        // 檢查Path中的每個座標
        for (let j = 0; j < arrow.Path.length; j++) {
            const pos = arrow.Path[j];
            if (typeof pos !== 'object' || pos === null) {
                return { valid: false, message: `Arrows[${i}].Path[${j}]必須是對象` };
            }
            if (typeof pos.r !== 'number' || typeof pos.c !== 'number') {
                return { valid: false, message: `Arrows[${i}].Path[${j}]必須包含數字類型的r和c屬性` };
            }
        }
        
        // Color字段（可選）
        if (arrow.Color !== undefined && typeof arrow.Color !== 'string') {
            return { valid: false, message: `Arrows[${i}].Color必須是字符串` };
        }
    }
    
    return { valid: true };
}

// 導入關卡數據
async function importLevel(data) {
    updateLog("📥 正在導入關卡...", "#2196f3");
    
    const newRows = data.MapSize[0];
    const newCols = data.MapSize[1];
    
    // 更新輸入框
    document.getElementById('input-rows').value = newRows;
    document.getElementById('input-cols').value = newCols;
    
    // 重置地圖
    rows = newRows;
    cols = newCols;
    const board = document.getElementById('game-board');
    board.style.width = `${cols * CELL_SIZE}px`;
    board.style.height = `${rows * CELL_SIZE}px`;
    board.innerHTML = '';
    gridMap = Array.from({length: rows}, () => Array(cols).fill(null));
    currentArrows = [];
    blockedCells.clear();
    isPlaying = true;
    
    // 處理箭頭數據
    for (let i = 0; i < data.Arrows.length; i++) {
        const arrowData = data.Arrows[i];
        
        // 生成新ID
        const newId = currentArrows.length;
        
        // 計算射線
        const ray = getRay(arrowData.Path[0].r, arrowData.Path[0].c, arrowData.Dir);
        
        // 創建箭頭對象
        const arrow = {
            id: newId,
            dir: arrowData.Dir,
            path: arrowData.Path.map(p => ({r: p.r, c: p.c})),
            ray: ray,
            color: arrowData.Color || NEON_COLORS[newId % NEON_COLORS.length]
        };
        
        currentArrows.push(arrow);
        
        // 更新gridMap
        arrow.path.forEach(p => {
            gridMap[p.r][p.c] = newId;
        });
    }
    
    updateLog(`📥 已導入 ${currentArrows.length} 根箭頭，正在播放入場動畫...`, "#2196f3");
    
    // 播放入場動畫
    const arrowLayers = groupArrowsByLayer(currentArrows);
    const totalLayers = arrowLayers.length;
    const totalTimeMs = 1500;
    const layerAnimTime = Math.max(60, totalTimeMs / totalLayers);
    
    for (let layer = 0; layer < totalLayers; layer++) {
        const arrowsInLayer = arrowLayers[layer];
        await Promise.all(arrowsInLayer.map(a => renderArrowWithAnimation(a, layerAnimTime)));
    }
    
    updateLog(`✅ 關卡導入完畢，共 ${currentArrows.length} 根箭頭`, "#00ff66");
}
