## Purpose

定义 learn 练习模式中成功命中的反馈触发条件与视觉强化要求。

## Requirements

### Requirement: 练习成功反馈必须由正确输入触发
在练习模式中，系统 SHALL 基于用户对目标音符或目标和弦的正确输入来触发 roll-score 成功反馈，而不是基于被动 transport 播放或通用 note rendering 触发。

#### Scenario: 正确练习输入触发成功反馈
- **WHEN** 用户在练习模式中按下正确的目标音或目标和弦
- **THEN** 系统为该次被接受的输入发出 roll-score 成功反馈

#### Scenario: 被动播放不触发练习成功反馈
- **WHEN** transport 在练习模式中推进，但没有对应的用户正确输入被接受
- **THEN** 系统不发出练习成功反馈

#### Scenario: 错误输入不触发练习成功反馈
- **WHEN** 练习模式正在等待另一个目标音或目标和弦，而用户按下了错误音
- **THEN** 系统不发出练习成功反馈

### Requirement: 练习成功反馈必须具备更强视觉强调
系统 SHALL 以比当前通用 spark 反馈更大、更明显的视觉形式渲染练习成功反馈，使其在当前 learn UI 中更容易被看到，并更具奖励感。

#### Scenario: 练习成功反馈强于当前通用火花
- **WHEN** 系统发出练习成功反馈
- **THEN** 最终 roll-score 视觉效果相较当前基线 spark 效果更大且更显眼

### Requirement: 练习成功反馈必须遵守和弦完成语义
系统 SHALL 在决定是否为和弦发出强化反馈时，始终遵循 guided-practice 的正确性边界。

#### Scenario: 完成目标和弦时发出奖励反馈
- **WHEN** 当前 guided practice step 期望多个音，且用户完成了要求的整个和弦
- **THEN** 系统在和弦完成时发出强化版练习成功反馈
