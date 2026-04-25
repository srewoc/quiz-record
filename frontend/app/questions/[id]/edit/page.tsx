import { QuestionForm } from "@/components/question-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditQuestionPage({ params }: PageProps) {
  const { id } = await params;

  return <QuestionForm mode="edit" questionId={id} />;
}
