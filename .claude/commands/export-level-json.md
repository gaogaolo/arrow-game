# Skill: 导出/导入关卡 JSON

## 用途
理解关卡数据的 JSON 格式，支持批量导出、程序化生成关卡数据、或从外部数据导入关卡。

## JSON 数据格式

```json
{
  "Level": 1,
  "MapSize": [10, 10],
  "Arrows": [
    {
      "Id": 0,
      "Dir": "U",
      "Path": ["3_2", "4_2", "5_2"],
      "Color": "#ff0055"
    },
    {
      "Id": 1,
      "Dir": "R",
      "Path": ["2_5", "2_6"],
      "Color": "#00e5ff"
    }
  ]
}
```

### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| Level | number | 关卡序号 |
| MapSize | [rows, cols] | 地图尺寸（行数, 列数） |
| Arrows[].Id | number | 箭头唯一 ID |
| Arrows[].Dir | "U"\|"D"\|"L"\|"R" | 箭头射出方向 |
| Arrows[].Path | string[] | 身体格子，格式 "行_列"，Path[0] 是头部 |
| Arrows[].Color | string | 十六进制颜色 |

### Dir 与 Path 的关系
- Dir 表示箭头**头部射出的方向**（移除时箭头往这个方向飞出）
- Path[0] 是头部，Path[1] 是第二节身体
- Path[0] → Path[1] 的反方向 = Dir（身体从尾到头的方向 = 射出方向）

## 程序化生成关卡数据（Node.js 示例）

```js
// 构造一个简单的 3x3 关卡
const level = {
  Level: 999,
  MapSize: [3, 3],
  Arrows: [
    { Id: 0, Dir: "R", Path: ["0_0", "0_1"], Color: "#ff0055" },
    { Id: 1, Dir: "D", Path: ["1_2", "2_2"], Color: "#00e5ff" },
    { Id: 2, Dir: "U", Path: ["2_0"], Color: "#a600ff" }
  ]
};
console.log(JSON.stringify(level, null, 2));
```

## 导入验证规则（validateLevelJson）
导入时会自动校验以下内容：
1. MapSize 必须是包含2个正整数的数组
2. Arrows 必须是数组，每项必须有 Dir 和 Path
3. Dir 只能是 U / D / L / R
4. Path 中每个元素必须是 "数字_数字" 格式
5. Path 不能为空

## 注意
- 导入后不会自动校验关卡可解性，需手动点击「🔍 关卡可解性校验」
- 导入的 Color 若缺失，会自动按 ID % 7 分配霓虹色
- Ray（射线）在导入时会根据 Path[0] 和 Dir 自动重算，无需在 JSON 中提供
