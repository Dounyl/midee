## ADDED Requirements

### Requirement: 五线谱练习模式必须使用独立的 learn 路由与独立页面运行时
系统 SHALL 为五线谱练习模式提供独立于现有瀑布谱练习的 learn 路由、页面宿主与 page runtime，使其在进入、退出、订阅与清理阶段都不依赖现有 play-along 页面实现。

#### Scenario: 进入五线谱练习模式
- **WHEN** 用户从 learn hub、recent MIDI、sample 或当前 learn handoff 进入 staff practice
- **THEN** 系统导航到独立的 staff practice 路由，并创建对应的页面 runtime，而不是复用现有 play-along 页面入口

#### Scenario: 退出五线谱练习模式
- **WHEN** 用户离开 staff practice 页面或返回 learn hub
- **THEN** 系统释放该页面 runtime 的订阅、宿主与谱面视图状态，而不影响现有瀑布谱练习页的生命周期

### Requirement: 五线谱练习模式必须以传统双谱表展示已加载 MIDI
系统 SHALL 在 staff practice 中以传统钢琴双谱表展示当前已加载的 MIDI，以上谱表表示右手、下谱表表示左手，并使用现有左右手拆分与和弦 grouping 结果作为首期谱面桥接基础。

#### Scenario: 已加载 MIDI 后展示双谱表
- **WHEN** staff practice runtime 成功接收并加载一个 learn MIDI 会话
- **THEN** 页面显示可阅读的双谱表视图，上方为右手谱表，下方为左手谱表

#### Scenario: 练习手变化时同步谱面可见内容
- **WHEN** 用户在 staff practice 中切换 hand 为 left、right 或 both
- **THEN** 系统在不重建整条 learn 会话入口的前提下，按当前练习手更新谱面中的练习焦点与伴奏语义

### Requirement: 五线谱练习模式必须标记当前位置并自动滚动到当前播放区域
系统 SHALL 根据当前 learn transport 时间在 staff practice 谱面中标记当前播放位置，并在当前位置接近可视区域边界时自动滚动谱面，以保持练习上下文连续。

#### Scenario: 播放中高亮当前位置
- **WHEN** transport 在 staff practice 中推进
- **THEN** 系统在谱面中高亮当前音符、小节或等价当前位置标记，使用户可以识别当前演奏进度

#### Scenario: 接近可视边界时自动滚动
- **WHEN** 当前播放位置即将离开 staff practice 谱面的当前可视区域
- **THEN** 系统自动滚动谱面，使当前位置重新落入清晰可读的可视范围内

### Requirement: 五线谱练习模式必须复用现有 learn MIDI handoff 与 transport 控制
系统 SHALL 允许 staff practice 直接消费现有 learn handoff 的 prepared MIDI，并复用现有 play、pause、seek、loop 与 replay 语义，而不要求用户重复导入同一份 MIDI。

#### Scenario: 从 learn handoff 接收 prepared MIDI
- **WHEN** 用户通过上传、本地库、sample 或当前 learn MIDI 进入 staff practice
- **THEN** staff practice runtime 直接消费 prepared MIDI，并展示对应谱面，而不是要求用户再次选择文件

#### Scenario: staff practice 中使用现有 transport 语义
- **WHEN** 用户在 staff practice 中执行播放、暂停、seek 或 loop 相关操作
- **THEN** 系统沿用现有 learn transport 语义与时间源，并使谱面高亮与滚动结果和该时间状态保持一致
