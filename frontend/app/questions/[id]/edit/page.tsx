type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditQuestionPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main>
      <section className="page-block">
        <h1>修改题目页</h1>
        <p>当前为初始化占位页面，后续将根据题目 ID 加载详情并实现编辑保存。</p>
        <p>
          当前题目 ID：<code className="inline">{id}</code>
        </p>
        <p>
          后端目标接口：<code className="inline">GET /api/v1/questions/{id}</code>、
          <code className="inline">PUT /api/v1/questions/{id}</code>
        </p>
      </section>
    </main>
  );
}

