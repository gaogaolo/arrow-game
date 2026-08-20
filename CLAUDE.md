# 箭头游戏编辑器记忆

更新时间：2026-07-31

这是当前最新的箭头游戏关卡编辑器记忆文件，供后续继续开发、恢复上下文和分享给其他 AI 使用。

## 项目

- 单页应用：`test.html` + `test.css` + `test.js`
- 无框架，所有逻辑集中在 `test.js`
- 作用：生成、手动绘制、导入、导出、校验、展示箭头关卡
- 仓库：`https://github.com/gaogaolo/arrow-game.git`

## 当前数据模型

```js
let gridMap = [];      // rows x cols，存 arrowId 或 null
let currentArrows = []; // 当前箭头列表
let blockedCells = new Set(); // 禁区，格式 "r,c"

{
  id: Number,
  dir: 'U' | 'D' | 'L' | 'R' | 'UL' | 'UR' | 'DL' | 'DR',
  path: [{ r, c }, ...], // path[0] 是头部
  ray: [{ r, c }, ...],  // 从头部沿 dir 射出的全部格子
  color: '#rrggbb'
}
```

## 方向系统

- 基础四向：`U/D/L/R`
- 斜向四向：`UL/UR/DL/DR`
- 方向表集中在：
  - `CARDINAL_DIRECTIONS`
  - `DIAGONAL_DIRECTIONS`
  - `ALL_DIRECTIONS`
  - `DIRECTION_BY_CODE`

## 目前支持的能力

- 自动铺满生成
- 单次随机加箭头
- 手动绘制
- 禁区选择 / 一键填充禁区
- 关卡导出 / 导入
- 关卡可解性校验
- 形状关卡生成
- 斜向箭头开关
- 黑白连续线条样式开关

## 斜向模式

### 开关

- UI：`input-allow-diagonal`
- 入口逻辑：`isDiagonalEnabled()`
- 控制函数：`toggleDiagonalMode()`、`syncDiagonalControls()`

### 影响范围

斜向开启后，以下地方都允许 `UL/UR/DL/DR`：

- 自动生成
- 路径搜索
- 手动绘制方向选择
- 导入 JSON 校验
- 渲染方向旋转

### 关键约束

斜向段会额外占用“保护格”：

- 对于相邻对角段 `from -> to`
- 保护格为：
  - `{ r: from.r, c: to.c }`
  - `{ r: to.r, c: from.c }`
- 这些格子不能被其他箭头身体或其他斜向保护格占用

相关函数：

- `getDiagonalGuardCells()`
- `getPathDiagonalGuardCells()`
- `buildDiagonalGuardMap()`
- `isCellReservedByDiagonalGuard()`
- `pathHasGeometryConflict()`
- `validateLevelGeometry()`

## 黑白线条样式

### 开关

- UI：`input-line-style`
- 控制函数：`isLineArrowStyleEnabled()`、`toggleArrowStyle()`、`syncArrowStyle()`

### 表现

- board 变成浅色底
- 箭头主体变成黑色连续线条
- connector 变成黑色线段
- 头部三角形改为 `clip-path` 方式，确保方向正确

### 相关常量

- `LINE_PART_SIZE`
- `LINE_HEAD_SIZE`
- `LINE_CONNECTOR_WIDTH`
- `LINE_ARROW_COLOR`

## 生成逻辑

### 自动铺满

`fillFullMap()` 分两阶段：

1. 主填充：禁止长度 1
2. 碎片修复：允许长度 1

### 单次添加

`performSingleAdd()` 的思路：

1. 收集所有空格
2. 排除禁区和斜向保护格
3. 按距离边缘排序，优先从边缘尝试
4. 取前 30 个起点
5. 计算连通区域大小 `getRegionSize()`
6. 按长度权重和弯折权重枚举
7. `getPathsWithBend()` 生成路径
8. `validateAndStore()` 校验并落盘

### 权重配置

- 长度权重：`input-length-weights`
- 弯折权重：`input-bend-weights`
- 默认值：
  - `1:8,2:20,3:30,4:24,5:12,6:6`
  - `0:40,1:35,2:20,3:5`

## 放置规则

`validateAndStore(path, dir)` 会检查：

- `ray` 不能穿过自己的身体
- `pathHasGeometryConflict(path)` 不能失败
- 临时移除被覆盖旧箭头后，依赖图不能成环
- `quickSolveCheck()` 结果必须仍然可解

### 依赖图

- 用身体与射线的阻挡关系构建 DAG
- `hasCycle(adj, n)` 用 DFS 三色标记检测死锁

### 可解性

- `quickSolveCheck(arrows, grid)` 做贪心求解模拟
- `verifyLevel()` / `solvePuzzle()` 用于关卡是否可完全消除

## 渲染逻辑

### 普通渲染

- `renderArrow()`：生成箭头组
- `appendPathConnectors()`：画路径连线
- `head-icon`：按 `getDirectionRotation(dir)` 旋转

### 入场动画

- `renderArrowWithAnimation()` 采用“蛇形滚入”
- 头部先出现，身体逐格跟随

### 出场动画

- `tryRemove()` 检查射线是否被挡
- 若可移除，先清 `gridMap`，再执行 `animateSnakeExit()`
- 该逻辑已经修过“头部停留一段时间才消失”的问题

## 手动绘制

- `toggleDrawMode()` 开关手动绘制
- `createDrawOverlays()` 创建可点格子
- `addToDrawPath()` 要求相邻格：
  - 斜向开启时允许 8 邻接
  - 否则只允许上下左右
- 绘制过程中不允许穿过已有箭头或斜向保护格
- `finishDrawing()` 结束后按 `draw-direction` 生成箭头

## 禁区

- `toggleBlockMode()`：进入禁区选择模式
- `clearBlockedCells()`：清除禁区
- `fillEmptyCellsAsBlocked()`：把当前空格全部设成禁区

## 关卡导入 / 导出

### 导出

格式：

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

### 导入

- `validateLevelJson()` 校验基础结构
- `validateLevelGeometry()` 校验几何重叠和斜向保护格
- `importLevel()` 会：
  - 自动设置地图大小
  - 清空当前箭头和禁区
  - 如果有斜向箭头，自动勾选斜向模式
  - 按层级播放入场动画

### 导入校验重点

- `MapSize` 必须是 `[rows, cols]`
- `Dir` 必须是 `U/D/L/R/UL/UR/DL/DR`
- `Path` 必须是 `"r_c"` 字符串数组
- `Color` 可选
- 导入不会自动判断“是否可解”，只做格式与几何校验
- `AllowDiagonalCornerTouch`（可选布尔值）只用于恢复关卡：开启后仍禁止越界、同箭头重复身体格、不同箭头身体格重叠；斜向保护格不再视为占用的身体格。手动生成、绘制仍使用严格保护格规则。

## 关卡恢复 / APK 映射记忆

这部分是和本编辑器配套的关卡恢复规则，后续从 APK / AAB / 原始资源恢复时要记住：

- 原始 Unity 节点常常是尾到头顺序
- 转成编辑器时要反转成头到尾
- 原始坐标常见是 `x/y`，编辑器里用 `r/c`
  - `r = y`
  - `c = x`
- 线上关卡顺序通常来自 `online_level_order.csv`
- 恢复结果建议按线上顺序命名：
  - `Level_0001_src2.json`
  - `Level_0002_src4.json`
  - ...

### 常见转换版本

- `runtime_expanded_correct_mapping_*`
  - 从 raw level 直接展开成编辑器网格
- `continuous_no_diagonal`
  - 无斜向版本
- `diagonal_compatible_editor_levels_*`
  - 兼容当前编辑器斜向规则的版本
- `diagonal_direct_editor_levels_*`
  - 不做冲突避让的直转版本

### 重要区别

- “兼容版”会尽量避开斜向保护格冲突，保证导入成功
- “直转版”会忠实保留原始路径，不做绕路或降级
- 如果要给当前编辑器导入，优先使用兼容版
- 如果要研究原包原始路径语义，优先使用直转版

### Arrow Snap 上下镜像与原始线段

Arrow Snap（`com.earahgkfhudio.arjgiwsnap`）的 554 关斜向兼容版已确认也需要上下镜像：

- 节点：`r -> rows - 1 - r`，`c` 不变
- 方向：`U <-> D`、`UL <-> DL`、`UR <-> DR`，`L/R` 不变
- 保留原目录，不覆盖；产物放入新的 `raw_segment_verified_flip_y_editor_levels_*` 目录

Arrow Snap 的 raw `nodes` 是原包绘制线段的端点，并不总是相邻格。第 12 关的长斜线也必须按原始端点直连，不能插入中间格、绕路、删除节点或降级为其他路径，否则会改变线上图案并可能造成回折。

已验证的恢复流程：先将 raw 节点从尾到头反转为编辑器头到尾，映射 `r=y,c=x`，做上下镜像并同步方向，再执行节点与线段审计。审计必须检查越界、重复身体节点、跨箭头身体重叠、线段穿过身体节点、线段相交和共线重叠。

仅有 8 根箭头存在可证明的原始首节点顺序错误：前三个节点是同一直线的 `中点、端点、端点` 且每段为单位步时，交换前两个节点；涉及线上第 70、128、165、170、208、336、436、496 关。不得对其他路径做通用排序。

## 维护提醒

如果调整方向系统或几何规则，记得同步更新：

- `test.js`
- `test.html`
- `test.css`
- 导入校验
- 路径生成
- 手动绘制
- 关卡恢复脚本

不要忘记：

- `currentArrows` 删除后 ID 可能不连续
- 黑白样式的箭头头部要继续使用 `clip-path` 三角形
- 退出动画要保证元素最终被移除
- 斜向保护格规则一改，生成、导入、恢复脚本都要一起改

## 产品特例：com.syarblitacl.abgame

Arrow Blitz Tap Clear（包名 `com.syarblitacl.abgame`）的恢复结果有一个已验证的坐标方向差异：

- 恢复出的身体图案结构是对的，但在编辑器里整体上下颠倒
- 正确修复不是“只反转 Dir”，而是坐标上下镜像，并同步上下方向
- 对每个 `Path` 节点 `r_c`：`r -> rows - 1 - r`，`c` 不变
- `Dir` 只交换垂直方向：`U <-> D`、`UL <-> DL`、`UR <-> DR`，`L/R` 保持不变
- 保留 `Level`、`MapSize`、`Id`、`Color`、源关卡 id、文件名和线上顺序

方向映射：

```text
U -> D
D -> U
L -> L
R -> R
UL -> DL
DL -> UL
UR -> DR
DR -> UR
```

已生成的正确修正版目录：

`/Users/xmiles/Documents/像素消除游戏/箭头产品关卡配置_按产品名整理_20260715/01_Arrow_Blitz_Tap_Clear__com.syarblitacl.abgame/flip_y_fixed_editor_levels_20260813`

废弃目录，不要继续使用：

`/Users/xmiles/Documents/像素消除游戏/箭头产品关卡配置_按产品名整理_20260715/01_Arrow_Blitz_Tap_Clear__com.syarblitacl.abgame/dir_reversed_editor_levels_20260813`
