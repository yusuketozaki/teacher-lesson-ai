import { LessonWorkflow } from "@/components/lesson/LessonWorkflow";
import { SafetyNotices } from "@/components/lesson/SafetyNotices";

export default function Home() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">試作（mock）</p>
        <h1>授業案たたき台づくり</h1>
        <p>
          小学5年・算数の単元と授業条件から、本時の目標と授業案のたたき台を表示する試作です。内容は固定テンプレートによる例です。教科書や学習指導要領との整合、算数としての正確さは確認していません。必ず教員が確認・修正してください。
        </p>
      </header>
      <SafetyNotices />
      <LessonWorkflow />
    </main>
  );
}
