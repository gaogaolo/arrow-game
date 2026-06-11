# Skill: 调整地图填充覆盖率

## 用途
当地图生成后空格过多（覆盖率低）或填充太慢时，调整相关参数来提升覆盖率和生成效率。

## 关键参数位置（test.js）

### 1. 填充阶段失败阈值
```js
// fillFullMap() 中

// Phase 1 主填充：当前值 30，值越大越努力填充
while (failCount < 30) { ... }

// Phase 2 碎片修复：当前值 15
while (phase2FailCount < 15) { ... }
```

### 2. 候选起点数量
```js
// performSingleAdd() 中，当前值 30
// 值越大，每次尝试的起点越多，成功率越高但速度稍慢
const candidates = emptyCells.slice(0, 30);
```

### 3. 每个起点生成的路径上限
```js
// getPathsWithBend() 调用处，当前值 120
let paths = getPathsWithBend(start.r, start.c, len, bendCount, 120);
```

### 4. 长度权重配置（UI 输入框）
```
input-length-weights 默认值：1:8,2:20,3:30,4:24,5:12,6:6
```
- 不配置长度1时：Phase 2 也无法填单格空洞 → 可能剩余少量单格空格（正常）
- 配置了长度1但权重很低（如 1:2）：Phase 2 会少量生成1格箭头填补空洞

## 覆盖率低的诊断思路

| 现象 | 可能原因 | 解决方案 |
|------|---------|---------|
| 地图中部有大片空白 | 边缘优先策略没填到中心 | 增大候选起点数量（30→50） |
| 边角有孤立空格 | Phase 2 阈值不够 | 增大 phase2FailCount 上限（15→25） |
| 整体覆盖率 <80% | 权重配置中最大长度太小 | 增加长度5、6的权重，或增加长度权重最大值 |
| 生成很慢 | 路径上限太高、候选起点太多 | 减小 maxPaths（120→60），减小 candidates.slice 上限 |

## 推荐参数组合

**高覆盖率（≥95%）**
```
Phase 1 failCount: 50
Phase 2 failCount: 25
candidates: 50
长度权重: 2:15,3:30,4:25,5:20,6:10
```

**速度优先（快速生成，覆盖率约85%）**
```
Phase 1 failCount: 20
Phase 2 failCount: 10
candidates: 20
maxPaths: 60
```
