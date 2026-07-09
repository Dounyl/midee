## Why

当前 `play-along` 体验混合了两种不同意图：一方面它会用可听见的伴奏示范曲子，另一方面它又要求用户跟着滚动谱逐步按键。这让有针对性的左右手练习变得不够直接，因为用户无法在同一个模式里自然切换到“静音练习”或“只听另一只手”的练习方式。

## What Changes

- 将当前 `play-along` 体验拆分为同一学习流内可切换的两种 guided mode：示范模式与练习模式。
- 将当前会发声的模式在 UI 中正式命名为 `示范模式`，明确表达它会继续播放示范声音。
- 新增 `练习模式`，支持静音引导练习与基于左右手的发声规则：
  - 练左手时，右手发声，左手静音
  - 练右手时，左手发声，右手静音
  - 练双手时，双手都不发声
- 调整 roll-score 反馈，让更大、更明显的火花效果只在练习模式下用户正确按键后触发，而不是作为通用播放反馈出现。
- 调整学习模式控件与持久化偏好，使用户可以在两种 guided mode 之间切换而不丢失当前 session 的其他设置。
- 将新增的 switch 按钮放在进度条右侧，同时让进度条适度变窄，为模式切换控件留出空间。

## Capabilities

### New Capabilities
- `learn-guided-modes`: 为 learn play-along 增加可切换的引导模式，包括模式切换、示范模式命名，以及练习模式下基于左右手的发声行为。
- `learn-practice-hit-feedback`: 为练习模式增加正确按键驱动的 roll 反馈规则，并强化其在当前 learn UI 中的可见性。

### Modified Capabilities

None.

## Impact

- 受影响代码将包括 learn play-along runtime、engine state/preferences、learn HUD controls，以及 guided mode switcher 的 i18n 文案。
- 音频行为需要在现有 synth/track filtering 之上叠加一个基于手部的 playback policy，以保证只有非练习手保持可听见。
- Roll renderer 与粒子反馈逻辑需要增加练习模式专用的 gating 与更强的视觉调优。
- 现有 play-along 测试需要覆盖模式切换、静音练习规则、进度条右侧 switch 布局，以及仅正确按键触发反馈的行为。
