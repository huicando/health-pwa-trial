---
type: PRD
title: 健康 PWA 试水版 PRD
source: personal-data-workbench 一期健康 PRD / 一期壳层 PRD 收敛版
created_at: 2026-07-16
status: draft
phase: trial
---

# 健康 PWA 试水版 PRD

## 1. 项目目标

先做一个只包含健康模块的轻量试水版，用来验证用户是否真的会长期记录饮食、体重、睡眠、运动和身体状态。

本项目不买服务器，不做 Java 后端，不接投资模块。前端部署到 GitHub Pages，数据通过 Supabase API 持久化，同时在本地缓存，保证手机上打开就能用。

核心闭环：

```text
手机快速记录健康数据
  -> 本地缓存，联网后同步 Supabase
  -> 首页和趋势页展示今日与最近 7/30 天状态
  -> 一键复制健康上下文给 AI
  -> AI 可按 API 约定帮助查询、总结或写入记录
```

一期试水只追求：

- 能记录
- 能查看
- 能手机使用
- 能同步
- 能导出备份
- 能让 AI 快速上手

## 2. 技术范围

推荐技术：

- 前端：Vite + React + TypeScript，或纯 HTML/CSS/JS 也可以，但必须结构清晰。
- 部署：GitHub Pages。
- 数据库/API：Supabase。
- 本地缓存：IndexedDB 优先，localStorage 可作为简单实现。
- 图表：Chart.js、ECharts 或轻量图表库均可。
- PWA：必须包含 `manifest.webmanifest` 和 service worker。

不得实现：

- Java Spring Boot 后端
- 投资模块
- 多用户登录注册系统
- 复杂 OAuth
- 医疗诊断
- 站内 AI 自动估算热量
- 图片识别
- 周报/月报
- 复杂后台管理页面

## 3. 用户体验原则

这是手机优先的小应用，不是后台管理系统。

设计要求：

- 底部 Tab 导航。
- 单手可操作。
- 首页直接显示今日状态，不做营销页。
- 快速记录入口必须明显。
- 表单字段按常用程度折叠，默认只露出最常用字段。
- 所有按钮适合手机点击。
- 离线时也允许先记录。
- 同步失败不能丢数据。
- 页面视觉要轻、干净、像日常工具。

底部 Tab：

```text
今日 / 记录 / 趋势 / AI / 设置
```

## 4. 页面范围

### 4.1 今日页

打开应用后默认进入今日页。

必须展示：

- 今日日期
- 最新体重
- 今日热量累计
- 今日蛋白质累计
- 今日睡眠/恢复状态
- 今日运动状态
- 今日身体状态
- 今日记录完成度
- 下一餐建议，可为空
- 同步状态

快捷操作：

- 记一餐
- 记体重
- 记睡眠
- 记运动
- 记身体状态
- 复制今日上下文给 AI

### 4.2 记录页

记录页用于新增和查看记录。

支持记录类型：

- 餐次记录
- 体重记录
- 睡眠记录
- 运动记录
- 身体状态记录

餐次字段：

- date，日期，必填
- mealType，餐次，必填：breakfast/lunch/dinner/snack/drink/other
- rawText，原始描述，推荐必填
- foodItems，食物内容
- portionText，份量描述
- caloriesKcal，估算热量
- proteinG，蛋白质
- carbsG，碳水
- fatG，脂肪
- sodiumMg，钠
- score，评分 0-10
- scoreReason，评分理由
- riskTags，风险标签
- positiveTags，正向标签
- note，备注
- source，来源：manual/ai_confirmed/import
- isConfirmed，是否确认

健康日志字段：

- date，日期，必填
- weightKg，体重，内部统一 kg
- sleepTotalMinutes，总睡眠分钟
- sleepDeepMinutes，深睡分钟
- sleepRemMinutes，REM 分钟
- sleepCoreMinutes，核心睡眠分钟
- sleepAwakeMinutes，清醒分钟
- recoveryRating，恢复状态
- exercise，运动内容
- exerciseMinutes，运动时长
- avgHeartRate，平均心率
- activeCaloriesKcal，动态消耗
- symptoms，症状
- mood，情绪
- note，备注
- source，来源：manual/ai_confirmed/import

体重输入要求：

- 页面可允许输入斤或 kg。
- 数据库存储统一使用 kg。
- 如果用户输入斤，保存前除以 2。

### 4.3 趋势页

趋势页展示最近 7/14/30 天数据。

必须实现：

- 体重趋势图
- 7 日均重
- 热量趋势
- 蛋白质趋势
- 睡眠趋势
- 运动时长趋势
- 餐次记录完成热力图或简易日历

可以用简单卡片和折线/柱状图，不要求复杂分析。

### 4.4 AI 页

AI 页是本项目重点，目标是让其他 AI 快速上手。

必须提供复制按钮：

- 复制健康上下文，不含 Key
- 复制健康上下文，含 Key
- 复制 API 使用说明，不含 Key
- 复制 API 使用说明，含 Key
- 复制最近 7 天摘要
- 复制今日记录

默认复制内容不得包含真实 Key。

含 Key 版本要求：

- 必须二次确认。
- Key 只能从浏览器本地配置读取。
- 不得从 Supabase 读取 Key。
- 不得把 Key 写入数据库。
- 不得在页面源码中硬编码 Key。
- 复制文本中必须提醒 AI 不要在回复里复述 Key。

AI 上下文必须包含：

- 用户目标和原则
- 健康安全边界
- 今日摘要
- 最近 7 天摘要
- 可用 API/数据表说明
- 写入前确认规则
- 单位规则
- 不做医疗诊断的边界

推荐复制文本结构：

```text
你是我的健康记录助手。请基于以下上下文帮助我记录、复盘饮食、体重、睡眠、运动和身体状态。

【目标】
温和、长期可持续减脂；允许偏离，拒绝连续偏离；不因单日体重波动惩罚性运动。

【安全边界】
头晕、心慌、胸闷、明显疲劳、睡眠严重不足时，优先休息补水，降低运动强度，必要时就医评估。不要提供医疗诊断。

【今日摘要】
日期：YYYY-MM-DD
最新体重：xx kg
今日热量：xx kcal
今日蛋白质：xx g
睡眠/恢复：xx
运动：xx
身体状态：xx

【如何查询】
先读取今日摘要和最近 7 天摘要。不要默认索取完整历史。

【如何写入】
写入前先复述准备保存的日期、类型、内容和关键数值，取得用户明确确认后再写入。

【单位】
界面可显示斤，API 和数据库统一使用 kg。

【边界】
不要诊断疾病，不要回显 API Key。
```

含 Key 版本在末尾追加：

```text
【本次授权】
本次对话已授权你调用我的健康记录 API。
SUPABASE_URL=<本地保存的 url>
SUPABASE_ANON_KEY=<本地保存的 anon key>
HEALTH_ACCESS_CODE=<本地保存的 access code 或用户私钥>

调用时不要在回答中复述、展示或保存这些 Key。
```

### 4.5 设置页

必须提供：

- Supabase URL 输入
- Supabase anon key 输入
- Health access code 输入
- 保存到本地
- 清除本地 Key
- 导出 JSON
- 导入 JSON
- 清空本地缓存
- 同步状态检测
- PWA 安装提示

Key 保存规则：

- 仅保存在浏览器本地。
- 不上传到 Supabase 表。
- 不出现在导出 JSON 中，除非用户明确选择“导出配置”，默认不得导出。

## 5. 数据模型

Supabase 表建议使用以下结构。实现者可以微调字段，但不得删除核心能力。

### 5.1 `meal_logs`

餐次记录表。

字段：

- id uuid primary key
- date date not null
- meal_type text not null
- raw_text text
- food_items text
- portion_text text
- calories_kcal numeric
- protein_g numeric
- carbs_g numeric
- fat_g numeric
- sodium_mg numeric
- score numeric
- score_reason text
- estimate_basis text
- risk_tags text[]
- positive_tags text[]
- ai_advice text
- uncertain_info text
- note text
- source text default 'manual'
- is_confirmed boolean default true
- access_code text not null
- created_at timestamptz default now()
- updated_at timestamptz default now()
- sync_status text

### 5.2 `health_logs`

体重、睡眠、运动、身体状态等非餐次记录表。

字段：

- id uuid primary key
- date date not null
- raw_text text
- weight_kg numeric
- sleep_total_minutes integer
- sleep_awake_minutes integer
- sleep_rem_minutes integer
- sleep_core_minutes integer
- sleep_deep_minutes integer
- recovery_rating text
- exercise text
- exercise_minutes integer
- avg_heart_rate integer
- active_calories_kcal numeric
- symptoms text
- mood text
- ai_advice text
- uncertain_info text
- note text
- source text default 'manual'
- access_code text not null
- created_at timestamptz default now()
- updated_at timestamptz default now()
- sync_status text

### 5.3 `profile_settings`

单用户目标配置。

字段：

- id uuid primary key
- access_code text not null
- target_weight_kg numeric
- long_term_target_weight_kg numeric
- calorie_target_min numeric
- calorie_target_max numeric
- protein_target_min numeric
- protein_target_max numeric
- preference_brief text
- safety_brief text
- updated_at timestamptz default now()

### 5.4 权限策略

Supabase 前端会暴露 anon key，这是正常设计，但必须开启 RLS。

最低要求：

- 所有表开启 Row Level Security。
- 所有查询和写入必须带 `access_code`。
- 前端只读取 `access_code` 等于本地配置的记录。
- 不要把 `access_code` 展示在页面上。

如果实现者熟悉 Supabase Auth，可以用匿名登录或邮箱登录替代 `access_code`，但试水版优先简单。

## 6. 本地缓存与同步

必须支持离线记录。

同步规则：

- 新记录先写本地缓存。
- 如果 Supabase 配置完整且联网，则自动上传。
- 上传成功后标记为 synced。
- 上传失败保留在 pending 队列。
- 设置页提供“手动同步”按钮。
- 冲突时以 `updated_at` 较新的记录为准。

导入/导出：

- 导出 JSON 必须包含 meal_logs、health_logs、profile_settings。
- 默认导出不包含 Supabase URL、anon key、access_code。
- 导入前必须提示会合并数据。
- 导入同 id 数据时按 updated_at 判断。

## 7. API/数据访问约定

因为 GitHub Pages 无法运行后端 API，本试水版直接通过 Supabase JS SDK 或 Supabase REST API 访问数据。

实现者必须在 AI 页写清楚：

- 这是 Supabase 直连版本。
- 没有 Java 后端。
- 写入 `meal_logs` 和 `health_logs` 等同于新增健康记录。
- 查询时默认只读今日和最近 7 天，不默认全量读取。

AI 写入规则：

```text
1. AI 先根据用户自然语言整理候选记录。
2. AI 必须复述日期、记录类型、关键字段。
3. 用户确认后才写入。
4. 写入成功后只回报保存结果，不复述 Key。
```

示例：新增餐次

```json
{
  "date": "YYYY-MM-DD",
  "meal_type": "lunch",
  "raw_text": "一份鸡腿饭，加青菜",
  "food_items": "鸡腿饭，青菜",
  "portion_text": "1份",
  "calories_kcal": 650,
  "protein_g": 35,
  "source": "ai_confirmed",
  "is_confirmed": true,
  "access_code": "由本地配置提供"
}
```

示例：新增体重

```json
{
  "date": "YYYY-MM-DD",
  "weight_kg": 78.3,
  "source": "ai_confirmed",
  "access_code": "由本地配置提供"
}
```

示例：新增睡眠

```json
{
  "date": "YYYY-MM-DD",
  "sleep_total_minutes": 410,
  "sleep_deep_minutes": 55,
  "sleep_rem_minutes": 90,
  "recovery_rating": "一般",
  "source": "ai_confirmed",
  "access_code": "由本地配置提供"
}
```

## 8. 验收标准

### 8.1 功能验收

- 手机浏览器打开首页可正常使用。
- 可以添加到主屏幕。
- 离线状态可以新增记录。
- 恢复网络后可以同步到 Supabase。
- 今日页能正确汇总当天热量、蛋白质、体重、睡眠、运动和身体状态。
- 记录页能新增、编辑、删除记录。
- 趋势页能展示最近 7/14/30 天趋势。
- AI 页能复制健康上下文。
- 含 Key 复制必须二次确认。
- 设置页能保存 Supabase 配置。
- 导入/导出 JSON 可用。

### 8.2 安全验收

- 默认复制给 AI 的文本不包含 Key。
- Key 不写入 Supabase。
- Key 不写入导出 JSON。
- 页面源码不硬编码真实 Key。
- AI prompt 明确要求不复述 Key。
- RLS 已开启。
- 查询只返回当前 access_code 对应数据。

### 8.3 体验验收

- 375px 宽度手机屏幕不横向滚动。
- 底部 Tab 可单手点击。
- 快速记录不超过 3 步。
- 表单必填项少，补充字段可折叠。
- 同步状态明确。
- 空数据状态友好。
- 图表在手机上不挤压文字。

## 9. 给实现 AI 的执行建议

请按以下顺序实现：

1. 搭建 Vite/React 或纯前端项目。
2. 建立移动优先布局和底部 Tab。
3. 实现本地数据模型和 IndexedDB/localStorage。
4. 实现今日页和记录页。
5. 接入 Supabase 配置和同步。
6. 实现趋势页。
7. 实现 AI 页复制 prompt。
8. 实现导入/导出。
9. 加 PWA manifest 和 service worker。
10. 做手机视口验收。

不要先做复杂图表、动画、登录、图片识别或投资模块。

