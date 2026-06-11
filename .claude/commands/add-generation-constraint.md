# Skill: 新增箭头生成约束

## 用途
在现有的三条放置规则之上，为箭头生成增加新的约束条件（如：限制箭头朝向、限制连续同向箭头数量、限制特定区域的箭头密度等）。

## 操作位置
`test.js` → `validateAndStore(path, dir)` 函数

## 约束插入点
在以下注释之前添加新约束（三条规则都通过后才到这里）：

```js
// 驗證通過，正式移除被覆蓋的箭頭
arrowsToRemove.forEach(id => {
```

## 约束模板

```js
// === 新增约束 N：[约束描述] ===
// [在此处添加逻辑，返回 false 表示拒绝该放置方案]
if (/* 不满足约束的条件 */) {
    return false;
}
```

## 示例：限制连续相邻箭头方向相同的数量

```js
// === 新增约束：相邻箭头中相同方向不超过3个 ===
const neighborDirs = path.flatMap(p => {
    const neighbors = [
        {r: p.r-1, c: p.c}, {r: p.r+1, c: p.c},
        {r: p.r, c: p.c-1}, {r: p.r, c: p.c+1}
    ];
    return neighbors
        .filter(n => n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols)
        .map(n => gridMap[n.r][n.c])
        .filter(id => id !== null)
        .map(id => currentArrows.find(a => a.id === id)?.dir)
        .filter(Boolean);
});
const sameDir = neighborDirs.filter(d => d === dir).length;
if (sameDir >= 3) return false;
```

## 注意事项
- 新约束不能违反 Rule 1-3（不能跳过 hasCycle 和 quickSolveCheck 检测）
- 约束越严格，填充率越低，需要适当调整 failCount 上限
- 调试时可以先只在 `addSingleArrow` 路径中生效，确认无误再用于 `fillFullMap`
