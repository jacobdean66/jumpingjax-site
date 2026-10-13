export function ServiceQuestions({
  title,
  questions,
}: {
  title: string;
  questions: readonly { question: string; answer: string }[];
}) {
  return (
    <section className="mx-auto mt-10 max-w-5xl rounded-3xl border-2 border-slate-200 bg-white p-5 text-slate-950 sm:p-8">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-5 grid gap-6">
        {questions.map((item) => (
          <div key={item.question}>
            <h3 className="text-lg font-bold">{item.question}</h3>
            <p className="mt-2 leading-7 text-slate-700">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
