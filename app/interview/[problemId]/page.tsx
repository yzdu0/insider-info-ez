import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getProblem, problems } from "@/lib/problems";
import InterviewWorkspace from "@/app/interview-workspace";

export function generateStaticParams() {
  return problems.map((problem) => ({ problemId: problem.id }));
}

type InterviewPageProps = { params: Promise<{ problemId: string }> };

export default function InterviewPage({ params }: InterviewPageProps) {
  // URL parameters may suspend during partial prefetching. Keep their access
  // below a boundary so navigation can immediately show a usable fallback.
  return (
    <Suspense fallback={<main><Link className="secondary-button" href="/">← Problems</Link><p role="status">Loading interview…</p></main>}>
      <SelectedInterview params={params} />
    </Suspense>
  );
}

async function SelectedInterview({ params }: InterviewPageProps) {
  const { problemId } = await params;
  if (!getProblem(problemId)) notFound();
  return <InterviewWorkspace key={problemId} initialProblemId={problemId} />;
}
