export default function NewQuestionPage() {
  return (
    <main>
      <section className="page-block">
        <h1>新增题目页</h1>
        <p>该页面已完成路由位预留，后续将接入图片上传、OCR、查重和题目表单。</p>
        <p>
          后端目标接口：<code className="inline">POST /api/v1/questions</code>、
          <code className="inline">POST /api/v1/questions/deduplicate</code>
        </p>
      </section>
    </main>
  );
}

