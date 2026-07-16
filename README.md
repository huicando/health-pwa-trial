# Health PWA Trial

这是一个用于给其他 AI 实现的试水项目说明目录。

目标不是复刻完整 `personal-data-workbench`，而是先做一个只包含健康模块的移动优先 PWA：

- GitHub Pages 静态部署
- Supabase 作为免费后端
- 手机浏览器可用，可添加到主屏幕
- 支持饮食、体重、睡眠、运动、身体状态记录
- 支持复制健康上下文给 AI
- 支持含 API Key 的授权版复制

请先阅读：

- [健康 PWA 试水版 PRD](docs/prd/health-pwa-trial-prd.md)

## 已实现

- 今日、记录、趋势、AI、设置五个移动端页面
- 饮食、体重、睡眠、运动、身体状态的新增、编辑和删除
- IndexedDB 离线缓存、Supabase 双向同步与失败重试
- 7/14/30 天趋势、7 日均重和餐次记录日历
- 默认无 Key 的 AI 上下文复制，以及二次确认的含 Key 版本
- 不含本地密钥的 JSON 导入/导出
- PWA manifest、service worker 和主屏幕图标
- GitHub Pages 自动部署工作流
- Supabase 表结构与 RLS 策略

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## Supabase 初始化

1. 新建一个免费 Supabase 项目。
2. 在 SQL Editor 中执行 [`supabase/schema.sql`](supabase/schema.sql)。
3. 在应用“设置”页填入 Supabase URL、anon key 和自定义 Health access code。
4. 保存后执行“检测连接”与“手动同步”。

这些连接信息只保存在当前浏览器，不会出现在默认导出文件中。

## GitHub Pages

将项目推送到 GitHub 的 `main` 分支，并在仓库 Settings → Pages 中选择 GitHub Actions。工作流会构建并发布 `dist`，无需购买服务器。
