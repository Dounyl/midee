## MODIFIED Requirements

### Requirement: play-along 内的引导模式必须可切换
系统 SHALL 在现有 play-along 学习流内提供至少两种引导模式：示范模式与练习模式，并 SHALL 在新增的 staff practice 学习流内提供等价的示范模式与练习模式。这些模式之间的切换 MUST 在不离开当前练习路由、也不重新加载当前 MIDI session 的前提下完成。

#### Scenario: 已加载会话内切换 play-along 引导模式
- **WHEN** 用户在一个已经加载完成的 play-along session 中切换 guided mode
- **THEN** 系统保持当前 route、已加载 MIDI 和 transport 上下文不变，只应用新模式对应的行为

#### Scenario: 已加载会话内切换 staff practice 引导模式
- **WHEN** 用户在一个已经加载完成的 staff practice session 中切换 guided mode
- **THEN** 系统保持当前 route、已加载 MIDI、谱面宿主和 transport 上下文不变，只应用新模式对应的行为

#### Scenario: 旧会话默认保持当前可发声行为
- **WHEN** 已存储的对应练习模式偏好中不存在 guided mode 值
- **THEN** 系统默认落到示范模式，以保证现有用户维持当前可发声体验

### Requirement: 引导模式偏好必须本地持久化
系统 SHALL 将用户选择的 guided mode 与对应练习模式的其余本地偏好一起持久化，使用户下次进入同类练习模式时可以回到相同模式，并 SHALL 保持现有 play-along 偏好的兼容读取。

#### Scenario: 从本地偏好恢复 play-along 引导模式
- **WHEN** 用户之前在 play-along 中选择过 guided mode，并在之后重新进入 play-along
- **THEN** 系统从本地存储偏好中恢复该 guided mode

#### Scenario: 从本地偏好恢复 staff practice 引导模式
- **WHEN** 用户之前在 staff practice 中选择过 guided mode，并在之后重新进入 staff practice
- **THEN** 系统从本地存储偏好中恢复该 guided mode

#### Scenario: 现有 play-along 偏好继续可读
- **WHEN** 已存在旧版 play-along guided mode 偏好数据
- **THEN** 系统继续正确读取该偏好，而不是因 staff practice 的引入导致旧偏好失效
