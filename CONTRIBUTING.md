# 開発ガイド

## 開発環境

Node.js 24 LTS と npm を基準にします。Orca ではこのリポジトリのルートを開いてください。IDE のチャットではなく、Issue・PR・この文書を作業の記録にします。

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
```

## ブランチ

- `main`: リリースの基準。デフォルトブランチを維持します。
- `develop`: 開発の統合先。通常は直接コミットしません。
- `feat/12-short-description`、`fix/12-short-description`、`docs/12-short-description`、`chore/12-short-description`: Issue ごとの短命な作業ブランチ。

```sh
git switch develop
git pull --ff-only
git switch -c feat/12-lesson-form
```

並行作業では別ブランチ・別 worktree を使い、同じ作業ディレクトリを複数エージェントで同時編集しないでください。Orca 固有の自動化機能は必須ではありません。

## Issue と PR

1. Issue に課題、利用者、受け入れ条件、対象外、扱うデータ、検証方法を書く。
2. 作業ブランチから `develop` 向け draft PR を早めに作り、`Refs #12` で参照する。
3. 一つの PR は一つの目的に絞る。差分、テスト、データ境界、依存関係を確認する。
4. CI 成功後、レビュー可能になったら ready にする。人が差分と結果を確認してから squash merge する。
5. `develop` 統合後は Issue に「統合済み・未リリース」と記録する。リリース後に閉じる。

GitHub の終了キーワードによる自動クローズはデフォルトブランチへのマージが基準です。`develop` への PR で `Closes #12` が即時クローズすると想定しないでください。

一人開発では自分の PR に別人承認を必須化して運用を停止させないようにします。ただし AI の出力もレビューを省略しません。自動マージ・自動デプロイは導入しません。

## 検証

```sh
npm run check
npm run build
npm audit --audit-level=high
```

CI は整形、lint、型検査、基本テスト、build、依存関係監査を実行します。画面変更では実画面も確認し、確認していない事項を PR に記載します。CI 成功は安全性・法令適合の保証ではありません。

## リリース

[リリース手順](docs/releasing.md) に従います。機能 PR は squash merge、`develop` → `main` のリリース PR は共通祖先を保つ merge commit を使用します。全ブランチへの linear history 強制は行いません。

## GitHub の保護設定

`main` と `develop` の両方に、次の保護設定を適用しています。

- PR 経由の統合と GitHub Actions の `check` 成功を必須にする。
- force-push とブランチ削除を禁止し、管理者にも適用する。
- 追加の承認者数は 0 人。PR の bypass 対象は設定しない。

会話の解決、最新ベースへの追従、linear history、CODEOWNERS 承認は必須設定にしていません。レビューでの確認は引き続き行います。GitHub の管理権限を持つ人は保護設定自体を変更できるため、変更時は別途承認を得て設定と文書をそろえます。

`main` から `develop` に変更を戻す場合も、直接 push ではなく PR と CI を通します。履歴同期には merge commit を使用し、保護を一時解除して回避しません。

## 公開情報

[安全設計](docs/safety.md) と [公開・情報管理](docs/publication.md) を守ってください。実際の児童生徒情報・学校の内部資料・秘密鍵を Issue、PR、スクリーンショット、ログに含めないでください。
