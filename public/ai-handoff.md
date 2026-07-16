# 健康记录 AI 交接入口

健康记录应用：<https://huicando.github.io/health-pwa-trial/>

## 给 AI 的工作规则

这是一个 GitHub Pages 静态前端 + Supabase 私有数据的健康记录应用。GitHub Pages 不保存用户的健康数据；健康数据只保存在用户已配置的 Supabase 项目中。

1. 先让用户打开应用，进入 `AI` 页面。
2. 默认点击“健康上下文”复制无密钥版本，用于理解目标、安全边界和最近记录。
3. 只有用户明确授权写入或查询私有数据时，才点击对应卡片的“含 Key”按钮，将生成的授权上下文提供给 AI。
4. AI 先读取 `profile_settings`、今日和最近 7 天的 `meal_logs`、`health_logs`；不要默认读取完整历史。
5. AI 对自然语言内容整理出候选记录，复述日期、类型、关键数值和不确定项；得到用户确认后再写入。
6. 体重在数据库内使用 `weight_kg`；用户说“斤”时除以 2。
7. 写入后只报告保存结果，不在对话、网页、GitHub 仓库或导出文件中回显 Supabase Key / Health access code。

## 表结构

- `meal_logs`：早餐、午餐、晚餐、加餐、饮品。
- `health_logs`：体重、睡眠、运动、身体状态。
- `profile_settings`：目标、饮食偏好与安全边界。

每个请求都必须使用用户本次明确提供的 Supabase URL、anon key 和 `x-health-access-code`；查询和写入都必须限定同一个 `access_code`。

## 安全边界

用户有血压偏高、曾头晕/心慌等情况。遇到头晕、心慌、胸闷、明显疲劳或严重睡眠不足时，优先建议休息、补水、降低运动强度；不要提供医疗诊断。

## 给用户的最短操作

打开应用 -> `AI` -> 复制“健康上下文”给新 AI；需要让 AI 查询或上传时，再复制同一页的“含 Key”版本并明确授权本次操作。
