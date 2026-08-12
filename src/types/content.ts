export interface QuestionShape {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TestQuestionView {
  id: string;
  question: string;
  options: string[];
}

export function toQuestionView(q: QuestionShape): TestQuestionView {
  return { id: q.id, question: q.question, options: q.options };
}
