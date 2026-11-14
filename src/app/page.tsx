import { PROJECT_SCOPE } from "@/lib/project-scope";
export default function Home() {
  return (
    <main>
      <p className="eyebrow">DEVELOPMENT SKELETON</p>
      <h1>Teacher Lesson AI</h1>
      <p>教員の授業準備を支援するサービスの開発用の土台です。</p>
      <section>
        <h2>最初の対象</h2>
        <p>{PROJECT_SCOPE.goal}</p>
        <h2>まだ実装していないもの</h2>
        <p>授業案の生成・保存、認証、決済、外部 AI 連携。</p>
        <h2>扱わない情報</h2>
        <p>児童・生徒の氏名、成績、行動記録など、個人を特定できる情報。</p>
      </section>
      <p className="note">
        学校での利用許可や教材の権利確認が済んだ製品ではありません。実際の業務データを入力しないでください。
      </p>
    </main>
  );
}
