"use client";

/** Persistent notices shown above the workflow. They cannot be dismissed. */
export function SafetyNotices() {
  return (
    <aside className="notices" aria-label="利用上の注意">
      <p className="mock-banner">
        <span className="badge">MOCK</span>
        出力は固定テンプレートによる mock です。AI
        は使用していません。このアプリのコードは、第三者のサービスや外部 AI
        へ入力内容を送信しません。入力した条件と目標文は、このアプリ自身の mock
        API
        へ送られ、メモリ上で処理されます。このアプリのコードでは保存・ログ出力しません。
      </p>
      <div className="storage-notice">
        <p>
          <strong>アプリ内には保存しません。</strong>
          再読み込み・タブを閉じる・別のページへの移動で、入力・編集した内容は消えます。必要な内容は「授業案をコピー」で持ち出してください。
        </p>
        <p>
          コピーした先での保存・共有は、このアプリの管理外です。ブラウザが離脱前に確認を表示することがありますが、表示されない場合もあります。
        </p>
      </div>
    </aside>
  );
}

/** Guidance shown next to free-text inputs. */
export function PrivacyHint({ id }: { id?: string }) {
  return (
    <p className="privacy-hint" id={id}>
      個人情報・児童の情報・学校内部の資料は入力しないでください。
    </p>
  );
}
