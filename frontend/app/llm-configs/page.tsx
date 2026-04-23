export default function LLMConfigsPage() {
  return (
    <main>
      <section className="page-block">
        <h1>LLM 管理页</h1>
        <p>当前已预留 OpenAI 配置管理页面路由，后续将在此实现配置列表、编辑、启用和测试连接。</p>
        <ul>
          <li>配置字段：配置名称、Base URL、API Key、模型名称、是否启用</li>
          <li>接口前缀：<code className="inline">/api/v1/llm-configs</code></li>
          <li>API Key 在展示时必须保持脱敏</li>
        </ul>
      </section>
    </main>
  );
}

