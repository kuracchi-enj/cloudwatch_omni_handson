# CloudWatch Omniログ調査ハンズオンの設計

作成日: 2026-11-01

## 目的と完了条件

Lambdaが出力した架空の注文処理ログをCloudWatch Omniで調査する。CDKコード、サンプルイベント、調査手順、公式資料に基づく調査メモを公開リポジトリへ保存する。この作業ではスタックをデプロイしない。ローカルの型検査・テスト・synth・cdkdのCloud Assembly読込まで検証する。利用者指定のプロファイルでAWS認証とbootstrapの利用可否を確認し、deploy前準備に必要な東京向けbootstrapを行う。未完了の前提条件を報告する。

## 構成の比較と採用案

1. Lambda + CloudWatch Logs、Omniの初期設定はコンソール: 採用。ログ調査に集中でき、Domainの名前・利用者・アカウント単位の連携設定を利用者が確認できる。
2. 上記にX-RayとADOTを追加: トレースの相関まで学べるが、レイヤーとTransaction Searchの設定が増える。初版の対象外。
3. Domain・Space・権限・Dataset連携も自動化: アカウント全体のテレメトリーと利用者管理が対象になり、最小ログ教材の範囲を超える。CloudFormationのSpaceリファレンスの存在と、全初期設定のCDK/cdkd対応は別々に扱う。

## データの流れ

手動Invoke → Lambda → JSON形式のCloudWatch Logs → 同一アカウント・リージョンのOmni Space → Explore／Omni agent。

CDKの管理対象はLambda 1個、ロググループ1個、実行ロールとログ書込ポリシー。API Gateway、Function URL、定期実行、VPC、外部API、AIモデル呼出しは追加しない。LambdaはNode.js 24を使用し、依存パッケージなしで動作する。CDKはTypeScript。既定リージョンは東京（2026-10-19のAWS対応拡大発表に基づく）。

元ロググループは7日保持、ハンズオン削除時に削除する。Omni Datasetに転送済みのレコードの保持は別に扱う。正常・警告・エラーを再現可能な固定シナリオに限定し、イベント本文をそのままログに出さない。エラーシナリオはERRORログを出して例外を送出し、業務上のエラーとLambdaの失敗を確認できる。

## Omniの前提条件

コンソールでAccount domainとSpaceを作り、Dataset連携とアクセス権を確認する。Spaceは同一アカウント・リージョンを対象とする。設定は既存ログにも影響するため、機密情報のない検証アカウントを推奨する。ログだけの初版ではアプリケーションマップやトレース相関の表示を完了条件に含めない。

## 検証と公開

実際のLambda handlerで正常・警告・例外と入力情報の非記録をテストする。CDKの生成テンプレートでログ配送先と権限の範囲、保持期間、公開入口の不在を検証する。cdkdは事前生成したCloud Assemblyをオフラインで読む。デプロイ、Invoke、Omniでの検索成功は未実施として残す。

認証情報、アカウントID、ARN、SSO設定、ドメイン名、実ログ、cdk.out、node_modules、ローカル出力をGitへ入れない。GitHubの読み書きはGitHub MCPを使用する。
