# 路线图

## ⚡ 当前重点

- 🔄 **更多 RAG 管道** — 扩展检索架构和后端
-  **数据库稳定性与可视化** — 稳定性改进和可视化洞察
- 🔄 **Bug 修复** — 处理已报告的问题和边缘情况

## 📬 社区需求清单

来自社区的功能请求：

- 👥 **多用户协作学习** — 实时共享学习会话
- 🎓 **通用引导学习** — 更广泛的自适应学习路径
- 📝 **自动笔记生成** — AI 驱动的摘要和笔记创建

---

<div class="community-wrapper">

<div class="community-header">
  <h2>🤝 共创未来！</h2>
  <p>NovusOrbit 由社区构建，为社区服务。</p>
</div>

<div class="community-grid">

<div class="community-card">
  <div class="card-icon">💡</div>
  <div class="card-title">想法</div>
  <div class="card-desc">分享反馈，提出功能建议</div>
  <div class="card-links">
    <div class="link-row">
      <a href="https://discord.gg/zpP9cssj" class="discord">Discord</a>
      <a href="https://github.com/HKUDS/NovusOrbit/issues/78" class="wechat">微信群</a>
    </div>
    <div class="link-row">
      <a href="https://github.com/HKUDS/NovusOrbit/discussions" class="github">GitHub Discussions</a>
    </div>
  </div>
</div>

<div class="community-card">
  <div class="card-icon">🔧</div>
  <div class="card-title">代码</div>
  <div class="card-desc">欢迎向 <code>dev</code> 分支提交 PR</div>
  <div class="card-links">
    <a href="https://github.com/HKUDS/NovusOrbit/blob/main/CONTRIBUTING.md" class="github">贡献指南 →</a>
  </div>
</div>

</div>

</div>

<style>
.community-wrapper {
  margin-top: 24px;
  padding: 40px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
}

.community-header {
  text-align: center;
  margin-bottom: 32px;
}

.community-header h2 {
  margin: 0 0 8px;
  font-size: 1.6rem;
  border: none;
}

.community-header p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 1rem;
}

.community-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 600px;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .community-grid {
    grid-template-columns: 1fr;
  }
}

.community-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.25s ease;
}

.community-card:hover {
  border-color: rgba(102, 126, 234, 0.4);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.08);
  transform: translateY(-2px);
}

.card-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.card-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--vp-c-text-1);
}

.card-desc {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin-bottom: 16px;
}

.card-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.link-row {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.card-links a {
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 6px;
  transition: all 0.2s;
}

/* Discord - 蓝紫色 */
.card-links a.discord {
  color: #5865F2;
  background: rgba(88, 101, 242, 0.1);
}
.card-links a.discord:hover {
  background: rgba(88, 101, 242, 0.2);
}

/* WeChat - 绿色 */
.card-links a.wechat {
  color: #07C160;
  background: rgba(7, 193, 96, 0.1);
}
.card-links a.wechat:hover {
  background: rgba(7, 193, 96, 0.2);
}

/* GitHub - 深灰紫 */
.card-links a.github {
  color: #6e5494;
  background: rgba(110, 84, 148, 0.1);
}
.card-links a.github:hover {
  background: rgba(110, 84, 148, 0.2);
}
</style>
