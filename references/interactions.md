# Interaction requirements and manifest mapping

Translate the user's natural language into declarative rules. Do not require the user to write JSON; the skill writes it.

## Supported triggers

| User wording | Manifest `when` |
|---|---|
| 鼠标在小人左边 / 向左转头 | `look-left` |
| 鼠标在右边 / 向右转头 | `look-right` |
| 鼠标在上方 / 抬头 | `look-up` |
| 鼠标在下方 / 低头 | `look-down` |
| 鼠标离开 | `look-away` |
| 点击或抓住眼镜 | `glasses-lift` |
| 松开眼镜 | `glasses-release` |
| 外部触发问号 | `wonder` |
| 首次进入 | `intro-start` |
| 绘制完成 | `intro-complete` |

Direction triggers use viewport pointer position relative to the avatar's configured face anchor and cone.

## Supported actions

| Requirement | Manifest action |
|---|---|
| 切换姿态 | `pose:<name>` |
| 恢复默认 | `pose:rest` |
| 弹出问号 | `question-marks` |
| 眼镜弹起 | `glasses:lift` |
| 眼镜回弹 | `glasses:return` |
| 播放首次绘制 | `intro:play` |
| 加速完成绘制 | `intro:finish-fast` |

## Examples

“鼠标在左边时向左转头并弹出问号”：

```json
{
  "when": "look-left",
  "do": ["pose:left", "question-marks"],
  "onceUntilLeave": true
}
```

“低头但不要问号，进入下面那段文字才出问号”：

```json
[
  { "when": "look-down", "do": ["pose:down"] },
  { "when": "wonder", "do": ["pose:wonder", "question-marks"] }
]
```

“点击眼镜弹起，拖动，松手回去” uses the built-in pointer capture and normally needs no custom rule:

```json
[
  { "when": "glasses-lift", "do": ["glasses:lift"] },
  { "when": "glasses-release", "do": ["glasses:return"] }
]
```

## Behavioral parameters

- `look.faceAnchor`: normalized `[x,y]`, default `[0.48,0.37]`.
- `look.deadRadius`: normalized no-reaction radius, default `0.25`.
- `look.coneDegrees`: direction sector, default `75`.
- `wonder.durationMs`: default `1400`.
- `wonder.staggerMs`: default `110`.
- `glasses.lift`: normalized target, default `[0.38,-0.22]`.
- `glasses.spring`: default stiffness `0.1`, damping `0.45`.
- `pose.spring`: default stiffness `0.08`, damping `0.6`.

Use `onceUntilLeave: true` for question marks attached to a directional look; otherwise pointer jitter can retrigger the sequence continuously.
