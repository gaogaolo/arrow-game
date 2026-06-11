# 箭头游戏关卡生成器 — AI 协作规范

## 项目概述

这是一个 HTML/CSS/JavaScript 单页应用，用于生成和编辑"挪箭头"益智游戏的关卡数据。
核心功能是在 `rows × cols` 的网格上，自动生成若干箭头线条，保证关卡**有唯一可解顺序**（无死锁）。

- 入口文件：`test.html`（引用 `test.css` 和 `test.js`）
- 所有逻辑均在 `test.js` 中，无框架依赖
- 仓库：https://github.com/gaogaolo/arrow-game.git

---

## 核心数据结构

```js
// 格子索引：gridMap[r][c] = arrowId | null
let gridMap = [];           // rows × cols 二维数组

// 箭头对象
{
  id: Number,               // 唯一ID（= currentArrows.length 时插入）
  dir: 'U'|'D'|'L'|'R',   // 箭头朝向（射出方向）
  path: [{r, c}, ...],      // 身体格子列表，path[0] 是头部
  ray: [{r, c}, ...],       // 从头部向 dir 方向射出到边界的所有格子
  color: '#rrggbb'          // 霓虹颜色
}

// 禁区：blockedCells = Set<"r,c">
// 禁区格子不可放置箭头，相当于障碍物
```

---

## 箭头生成核心规则（Rules）

### Rule 1 — 射线不能穿过自身身体
```
ray 中不能包含 path 中的任何格子
→ 否则该箭头永远无法被移除（自我阻塞）
```

### Rule 2 — 无循环依赖（DAG 校验）
```
依赖关系定义：
  - 箭头 A 的射线被箭头 B 的身体阻挡 → B 必须先于 A 移除 → adj[A] 包含 B
  - 构建有向图后，用 DFS 检测是否存在环
  - 有环 = 死锁，拒绝放置
```
实现：`hasCycle(adj, n)` — DFS 三色标记法

### Rule 3 — 模拟求解验证（可解性）
```
每次放置新箭头前，在临时副本上模拟"贪心求解"：
  - 反复寻找射线未被阻挡的箭头，依次移除
  - 直到全部移除（成功）或无法继续（失败）
  - 失败则拒绝该放置方案
```
实现：`quickSolveCheck(arrows, grid)`

### Rule 4 — 箭头方向由身体走向决定
```
dir 由 path[0]（头部）和 path[1]（第二节）的位置关系决定：
  head 在 second 上方 → dir = 'U'
  head 在 second 下方 → dir = 'D'
  head 在 second 左方 → dir = 'L'
  head 在 second 右方 → dir = 'R'
单节箭头（len=1）：允许4个方向，全部尝试
```
实现：`getDirectionFromPath(path)`

---

## 填充算法（Generation Algorithm）

### 两阶段填充（fillFullMap）

**Phase 1 — 主填充**
- `suppressLength1 = true`：禁止生成长度为1的箭头
- 连续失败30次后结束本阶段
- 目标：用长度 ≥ 2 的箭头铺满大部分地图

**Phase 2 — 碎片修复**
- `suppressLength1 = false`：允许长度1（若用户配置了）
- 连续失败15次后结束
- 目标：填充 Phase 1 遗留的碎片小口袋

### 单次放置核心流程（performSingleAdd）

```
1. 收集所有空格，按"距边缘距离"升序排列（优先从边缘开始）
   + 加入少量随机扰动（±0.2）避免重复
2. 取前30个格子作为候选起点
3. 对每个候选起点：
   a. BFS 计算其连通空格区域大小 regionSize（getRegionSize）
   b. 过滤候选长度：只保留 len ≤ regionSize 的长度（避免无效尝试）
   c. 按权重随机排列长度顺序（buildWeightedOrder）
   d. 对每个长度，按权重排列弯折数顺序
   e. 用 DFS 回溯生成路径（getPathsWithBend，最多120条）
   f. 随机打乱路径列表
   g. 对每条路径调用 validateAndStore 验证并存储
   h. 成功立即返回 true
4. 所有候选都失败则返回 false
```

### BFS 区域感知（getRegionSize）
```
关键优化：计算起点所在的连通空格区域大小
作用：若某区域只有3格连通，则无需尝试长度4、5、6的路径
  → 大幅减少无效尝试，使填充更彻底
```

### 路径生成（getPathsWithBend）
```
DFS 回溯生成指定长度、指定弯折数的所有路径
- 每步随机打乱4个方向顺序（增加多样性）
- 弯折数：路径中方向改变的次数
- 最多生成 maxPaths=120 条路径后截断
```

### 权重配置格式
```
长度权重（input-length-weights）：默认 "1:8,2:20,3:30,4:24,5:12,6:6"
弯折权重（input-bend-weights）：默认 "0:40,1:35,2:20,3:5"
格式：值:权重,值:权重,...（权重越大概率越高）
解析：buildWeightedOrder 基于轮盘赌算法按权重随机排序
```

---

## 关卡可解性校验

`verifyLevel()` / `solvePuzzle(arrows, grid)`：
- 反复寻找"射线未被任何箭头阻挡"的箭头并移除
- 直到全部移除（✅ 可解）或陷入僵局（❌ 死局，高亮死局箭头）

---

## 数据导出格式（JSON）

```json
{
  "Level": 1,
  "MapSize": [10, 10],
  "Arrows": [
    {
      "Id": 0,
      "Dir": "U",
      "Path": ["3_2", "3_3", "3_4"],
      "Color": "#ff0055"
    }
  ]
}
```
Path 格式：`"行_列"`（从0开始）

---

## 常见修改场景

| 需求 | 修改位置 |
|------|---------|
| 调整默认长度/弯折权重 | `DEFAULT_LENGTH_WEIGHT_TEXT` / `DEFAULT_BEND_WEIGHT_TEXT` |
| 调整填充阈值（失败次数） | `fillFullMap` 中的 failCount 上限（30/15） |
| 调整候选起点数量 | `performSingleAdd` 中的 `.slice(0, 30)` |
| 增加/修改颜色 | `NEON_COLORS` 数组 |
| 修改格子大小 | `CELL_SIZE`（同时需更新 CSS） |
| 添加新的生成约束 | 在 `validateAndStore` 中增加判断 |

---

## 注意事项

1. **不要破坏三条放置规则**（Rule 1-3），否则会产生无法通关的死局
2. `currentArrows` 数组中的 ID 不连续是正常的（删除后不重排）
3. `gridMap[r][c]` 存的是 arrowId（数字），null 表示空格
4. `suppressLength1=true` 只影响 Phase 1，不影响 Phase 2 和单次添加
5. 形状关卡（applyShapeMask）会将形状外的格子设为禁区，走同样的两阶段流程
