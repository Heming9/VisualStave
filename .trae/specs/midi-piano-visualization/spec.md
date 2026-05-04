# MIDI钢琴实时五线可视化项目 - Product Requirement Document

## Overview
- **Summary**: 一款面向钢琴学习者的实时演奏可视化工具，保留标准五线谱的视觉体系，使用纯物理时间轴展示真实演奏细节，包括节奏偏差、力度变化和和弦整齐度。
- **Purpose**: 解决传统五线谱软件强制量化丢失真实演奏细节，以及钢琴卷帘视觉不熟悉的问题，提供一个兼顾认谱学习和练琴纠错的工具。
- **Target Users**: 钢琴学习者（从入门到进阶）、音乐教师、音乐爱好者

## Goals
- 实时可视化MIDI输入，保留标准五线谱的视觉识谱体系
- 使用纯物理时间轴，100%还原真实演奏细节（节奏偏差、力度变化）
- 实现和弦判定机制，解决人手不同步导致的视觉问题
- 提供直观的练琴纠错功能（和弦整齐度、节奏偏差）

## Non-Goals (Out of Scope)
- 传统制谱功能（添加小节、拍号、音符时值等）
- 音频录制功能
- 云端存储和分享功能
- AI识别BPM或拍号
- 多种乐谱导出格式

## Background & Context
- 传统五线谱是标准化"书写乐谱"，只适配规整、标准的乐理演奏
- 市面上的钢琴卷帘视觉太陌生，标准乐谱软件需要强制量化
- Web MIDI API提供了浏览器访问MIDI设备的能力
- Canvas适合高性能的实时可视化需求

## Functional Requirements
- **FR-1**: 监听和接收MIDI输入（音符on/off、力度）
- **FR-2**: 绘制固定高低音双线五线谱（大谱表）
- **FR-3**: 将MIDI音高转换为五线谱上的Y坐标
- **FR-4**: 将MIDI时间戳转换为横向X坐标，显示音符时长
- **FR-5**: 根据MIDI力度控制音符透明度/颜色深浅
- **FR-6**: 实现和弦判定机制（可配置阈值，默认60ms）
- **FR-7**: 实现画面自动滚动，无限记录演奏
- **FR-8**: 提供可开关的节拍辅助线
- **FR-9**: 显示当前演奏的统计信息（总音符数、和弦数等）

## Non-Functional Requirements
- **NFR-1**: 实时响应延迟 < 50ms
- **NFR-2**: 支持记录至少10分钟的演奏而无明显性能下降
- **NFR-3**: 界面美观、现代，符合音乐学习场景
- **NFR-4**: 适配主流浏览器（Chrome、Firefox、Safari、Edge）

## Constraints
- **Technical**: 纯前端项目，使用React + TypeScript + Vite + Tailwind CSS + Canvas
- **Business**: 无需后端，无数据存储需求
- **Dependencies**: Web MIDI API、React、Tailwind CSS、Zustand

## Assumptions
- 用户使用支持Web MIDI API的浏览器（Chrome、Firefox、Edge）
- 用户有MIDI键盘或钢琴设备可以连接
- 用户具备基本的五线谱知识

## Acceptance Criteria

### AC-1: MIDI输入监听
- **Given**: 用户已连接MIDI设备到电脑
- **When**: 用户打开应用并选择MIDI输入设备
- **Then**: 应用能够实时接收MIDI音符on/off事件和力度数据
- **Verification**: `programmatic`

### AC-2: 五线谱渲染
- **Given**: 应用已启动
- **When**: 用户查看主界面
- **Then**: 显示固定的高低音双线五线谱（大谱表），包含高音谱号和低音谱号
- **Verification**: `human-judgment`

### AC-3: 音符位置映射
- **Given**: 用户按下MIDI琴键
- **When**: 音符被可视化
- **Then**: 音符位置严格对应标准五线谱的线/间位置
- **Verification**: `human-judgment`

### AC-4: 时间轴可视化
- **Given**: 用户演奏音符
- **When**: 音符被记录
- **Then**: 横向坐标对应真实弹奏时间戳，音符宽度对应真实按住时长
- **Verification**: `human-judgment`

### AC-5: 力度可视化
- **Given**: 用户以不同力度演奏
- **When**: 音符被可视化
- **Then**: 力度越重，音符越实越深；力度越轻，音符越透明
- **Verification**: `human-judgment`

### AC-6: 和弦判定
- **Given**: 用户同时按下多个琴键
- **When**: 按下时差 ≤ 阈值（默认60ms）
- **Then**: 所有音符横向X坐标强制对齐，垂直叠放展示为和弦
- **Verification**: `human-judgment`

### AC-7: 琶音展示
- **Given**: 用户依次按下多个琴键
- **When**: 按下时差 > 阈值
- **Then**: 音符正常横向错开，展示为琶音
- **Verification**: `human-judgment`

### AC-8: 自动滚动
- **Given**: 用户持续演奏
- **When**: 时间轴向右延伸
- **Then**: 画面缓慢左滚动，保持当前演奏在可视区域内
- **Verification**: `human-judgment`

### AC-9: 节拍辅助线
- **Given**: 用户打开节拍辅助线开关
- **When**: 查看乐谱
- **Then**: 显示浅色垂直节拍辅助线（仅参考，音符不吸附）
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要录音回放功能？
- [ ] 是否需要保存/加载演奏记录？
- [ ] 是否需要调整BPM的节拍辅助线？
