# Skill: 新增功能按钮

## 用途
在工具栏中新增一个功能按钮，同时在 test.js 中实现对应的功能函数，并在 test.css 中补充样式。

## 三步骤

### Step 1：在 test.html 中添加按钮

在 `<div class="controls">` 内，找到语义相近的按钮旁边插入：

```html
<button class="btn-[name]" onclick="[functionName]()">🔧 按钮文字</button>
```

常用插入位置参考：
- 生成类操作 → 放在 `🚀 自动铺满全图` 附近
- 编辑/清理类操作 → 放在 `🗑️ 移除1格箭头` / `🔍 关卡可解性校验` 附近
- 模式切换类 → 放在 `✏️ 手动绘制` 附近

### Step 2：在 test.js 中实现功能函数

```js
// 📝 [功能描述]
function [functionName]() {
    // 检查前置条件
    if (!gridMap.length || currentArrows.length === 0) {
        updateLog("⚠️ 请先生成关卡", "#ff8800");
        return;
    }
    
    // 实现功能逻辑
    // ...
    
    // 操作完成提示
    updateLog("✅ [操作完成提示]", "#00ff66");
}
```

推荐插入位置：`removeShortArrows()` 函数的后面（按功能分区放置）

### Step 3：在 test.css 中添加按钮样式

在 `.btn-verify` 样式块附近添加：

```css
.btn-[name] { background: #[颜色]; color: #fff; }
.btn-[name]:hover { background: #[hover颜色]; }
```

## 颜色参考

| 用途 | 推荐背景色 |
|------|-----------|
| 生成/填充 | `#ff007f`（粉红）|
| 警告/删除 | `#cc3300`（深红）|
| 信息/导出 | `#00cc66`（绿）|
| 工具/编辑 | `#3399ff`（蓝）|
| 校验/分析 | `#ff6600`（橙）|
| 形状/特殊 | `#e91e63`（玫红）|

## 注意
- 按钮 class 名用 `btn-` 前缀，kebab-case 命名
- 若功能需要异步操作（动画、延时），函数声明加 `async`，onclick 调用前无需加 `await`（浏览器事件回调自动处理）
- `updateLog(msg, color)` 用于在底部日志区显示状态，color 参数可选（默认黄色）
