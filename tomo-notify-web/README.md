# とも通知（ブラウザ版）

「ともちゃんねる」の新着動画を、ブラウザで確認できるシンプルなWebアプリです。
アプリストア登録・Apple Developer登録・EASビルドは不要です。

## できること

- ホーム：最新動画のサムネイル・タイトル・公開日時・「見る」ボタン
- 履歴：最新5件の一覧
- 設定：通知ON/OFF・自動更新ON/OFF
- タブを開いている間は約10分ごとに自動で新着チェック

## できないこと（ブラウザ版の制約）

- **アプリを閉じている間の自動プッシュ通知はできません。** 開いた時に最新状態を確認する使い方になります。
- 「通知」設定をONにすると、タブを開いている間に新着を見つけた時だけブラウザ通知を出します（対応ブラウザのみ）。

## ローカルで試す

```bash
cd tomo-notify-web
npm install
npm run dev
```

表示されたURL（例: http://localhost:5173）をブラウザで開いてください。

## GitHub Pagesで公開する

このプロジェクトは `okame-diarynew` リポジトリのサブフォルダとして管理されており、
リポジトリ直下のアプリと合わせて `.github/workflows/deploy.yml` から自動デプロイされます。
`vite.config.js` の `base` はサブパス公開用に `/okame-diarynew/tomo-notify-web/` に設定済みです。

main / claude/** ブランチへのpushをトリガーに、GitHub Actionsが

1. リポジトリ直下のアプリをビルド（`dist/`）
2. `tomo-notify-web` をビルド（`tomo-notify-web/dist/`）
3. 2を `dist/tomo-notify-web/` にマージ
4. まとめて GitHub Pages にデプロイ

を行います。手動でデプロイ操作をする必要はありません。

公開後のURLは `https://chunchuntamako.github.io/okame-diarynew/tomo-notify-web/` になります。

## スマホのホーム画面に追加する

1. 公開されたURLをiPhoneのSafari（Androidの場合はChrome）で開く
2. 共有メニュー →「ホーム画面に追加」
3. ホーム画面のアイコンから、アプリのように起動できます

## 設定の変更

`src/config.js` にチャンネルIDやテーマカラーなどをまとめています。将来の変更もここが起点です。

## RSS取得の仕組みについて（注意点）

YouTubeのRSSフィードはブラウザから直接取得するとCORS制限でブロックされるため、無料の公開プロキシ（allorigins.win → 失敗時はcorsproxy.io）経由で取得しています。これらは無料の第三者サービスのため、まれにメンテナンスなどで一時的に使えなくなることがあります。その場合はホーム画面に「動画の取得に失敗しました」と表示され、「今すぐ更新する」で再試行できます。

より安定させたい場合は、将来的に自前の小さなプロキシ（Cloudflare Workersなど無料枠で可能）に切り替えることもできます。
