import Link from "next/link";

const cards = [
  {
    href: "/",
    title: "题目检索与管理页",
    description: "后续将在这里实现分页列表、文本查询、图片查询、答案查看、修改和删除入口。"
  },
  {
    href: "/questions/new",
    title: "新增题目页",
    description: "预留 OCR 识别、查重、科目识别与新增表单流程。"
  },
  {
    href: "/questions/1/edit",
    title: "修改题目页",
    description: "预留题目编辑、答案维护与重复校验提示流程。"
  },
  {
    href: "/llm-configs",
    title: "LLM 管理页",
    description: "预留 OpenAI 配置管理、启用切换与测试连接能力。"
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <h1>做题记录系统</h1>
        <p>
          当前仓库已完成前后端初始化骨架、数据库容器方案、Alembic 迁移基线以及页面路由位预留。
          接下来可以在这些稳定边界上继续实现题目管理、OCR 和 LLM 配置等业务功能。
        </p>

        <div className="nav-grid">
          {cards.map((card) => (
            <Link className="card" href={card.href} key={card.href}>
              <strong>{card.title}</strong>
              <span>{card.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

