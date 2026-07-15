## Purpose

定义 learn play-along 中引导模式的行为、命名、持久化与界面布局要求。

## Requirements

### Requirement: play-along 内的引导模式必须可切换
系统 SHALL 在现有 play-along 学习流内提供至少两种引导模式：示范模式与练习模式。这两种模式之间的切换 MUST 在不离开当前 play-along 路由、也不重新加载当前 MIDI session 的前提下完成。

#### Scenario: 已加载会话内切换引导模式
- **WHEN** 用户在一个已经加载完成的 play-along session 中切换 guided mode
- **THEN** 系统保持当前 route、已加载 MIDI 和 transport 上下文不变，只应用新模式对应的行为

#### Scenario: 旧会话默认保持当前可发声行为
- **WHEN** 已存储的 play-along 偏好中不存在 guided mode 值
- **THEN** 系统默认落到示范模式，以保证现有用户维持当前可发声体验

### Requirement: 当前会发声的跟随模式必须标记为示范模式
系统 SHALL 为当前会发声的 guided mode 提供一个明确标签，用来表达“由系统进行示范”的行为语义，并且该标签 MUST 在 learn UI 中与练习模式清楚区分。

#### Scenario: 引导模式标签显示在学习控件中
- **WHEN** 用户打开 play-along 学习控件
- **THEN** UI 显示示范模式与练习模式两个独立标签

### Requirement: 练习模式必须应用基于左右手的伴奏发声规则
系统 SHALL 在练习模式中根据当前选中的练习手推导伴奏发声规则，使非练习手可以发声，而练习手保持静音。

#### Scenario: 练左手时只发右手
- **WHEN** guided mode 为练习模式且所选 hand 为 left
- **THEN** 系统抑制左手引导伴奏发声，并保留右手引导伴奏发声

#### Scenario: 练右手时只发左手
- **WHEN** guided mode 为练习模式且所选 hand 为 right
- **THEN** 系统抑制右手引导伴奏发声，并保留左手引导伴奏发声

#### Scenario: 练双手时保持全静音
- **WHEN** guided mode 为练习模式且所选 hand 为 both
- **THEN** 系统对双手都不发出引导伴奏音

#### Scenario: 示范模式保留完整可发声伴奏
- **WHEN** guided mode 为示范模式
- **THEN** 系统保留当前可发声的 follow-along 播放行为，而不是应用练习模式的静音规则

### Requirement: 引导模式偏好必须本地持久化
系统 SHALL 将用户选择的 guided mode 与现有 play-along 偏好一起本地持久化，使用户下次进入 play-along 时可以回到相同模式。

#### Scenario: 从本地偏好恢复引导模式
- **WHEN** 用户之前选择过 guided mode，并在之后重新进入 play-along
- **THEN** 系统从本地存储偏好中恢复该 guided mode

### Requirement: 模式切换按钮必须位于进度条右侧
系统 SHALL 将新增的 guided mode switch 按钮放置在进度条右侧，并通过收窄进度条宽度为该控件预留空间。

#### Scenario: 进度条右侧显示模式切换按钮
- **WHEN** 用户查看 play-along 顶部或主控制区中的进度条区域
- **THEN** 模式切换按钮显示在进度条右侧，且不会覆盖或挤掉进度条本身

#### Scenario: 为切换按钮收窄进度条
- **WHEN** 模式切换按钮出现在进度条右侧
- **THEN** 进度条相较现状缩窄，以保持整体布局清晰、可点击且可读
