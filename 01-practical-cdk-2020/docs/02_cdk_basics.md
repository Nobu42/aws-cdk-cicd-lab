# 第2章 CDKの作成・デプロイ・削除

[書籍README](../README.md) / [全体README](../../README.md)

実施日: 2026-09-27。実行結果は本人が共有したログと受信メッセージに基づく。アカウントIDや署名は記載しない。

## 1. 今回やったこと

```text
sample-app作成 → 型チェック → テンプレート生成
→ AWSへのデプロイ準備 → SNS・SQS作成 → メッセージ送受信
→ 設定値を変更して差分確認 → AWSリソース削除
```

作成した構成は「SNSトピック → SQSキュー」。SNSから発行したメッセージをSQSで受信した。
最後にSampleStackを削除した。CDKToolkitとローカルのコードは残した。

## 2. 作業環境と接続先

| 項目 | 今回の環境 |
| --- | --- |
| 作業端末 | Mac、VSCodeのBashターミナル |
| Node.js | v24.21.0 |
| AWS CLI | 2.36.20 |
| CDK CLI | 2.1143.0 |
| AWSプロファイル | learning |
| リージョン | ap-northeast-1（東京） |
| 作業場所 | `01-practical-cdk-2020/sample` |

導入の経緯は[初回導入記録](../../docs/setup/01_cdk_setup.md)を参照する。

### Node.jsを選択する

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
hash -r
node --version
aws --version
```

意味: `export PATH`でNode.js 24を優先し、`hash -r`でBashが記憶したコマンドの場所をクリアする。`--version`はバージョン確認。
理由: インストール済みのNode.js 26ではなく、今回使用する24を選択するため。PATHの変更はそのターミナル内で有効。
結果: Node.js 24.21.0とAWS CLI 2.36.20を確認した。

### AWSの接続先を確認する

```bash
aws sts get-caller-identity --profile learning --no-cli-pager
aws configure get region --profile learning
```

意味: 1行目は接続先のアカウント・IAMユーザー等を表示する。2行目はプロファイルに設定されたリージョンを表示する。`--no-cli-pager`はページ表示を使わず結果を出す指定。
理由: 別アカウント・別リージョンへの誤操作を防ぐため。環境変数やコードで接続先を上書きした場合は、CDKが表示する対象環境も確認する。
結果: 学習用IAMユーザーでの接続と東京リージョンを確認した。

`learning`は端末側の接続設定名であり、IAMユーザー名ではない。Webコンソールに同名のprofileが存在するわけではない。
設定は主に`~/.aws/config`と`~/.aws/credentials`で管理する。認証情報はGitへ登録しない。

## 3. サンプルを作成する

以下は初回に実行したコマンド。現在のsampleは作成済みのため、再実行しない。

```bash
cd /Users/nobu/aws-cdk-cicd-lab/01-practical-cdk-2020 &&
mkdir sample &&
cd sample &&
npx --package=aws-cdk@2.1143.0 cdk init sample-app --language typescript
```

意味: 空のsampleディレクトリを作り、CDK CLIのバージョンを指定してTypeScriptのサンプルを生成する。`&&`は直前のコマンドが成功した場合だけ次を実行する指定。
理由: 書籍のコードを他のプロジェクトと分離し、SNSとSQSを含む雛形から学ぶため。
結果: `All done!`が表示され、依存パッケージもインストールされた。

以後のコマンドはsample内で実行する。

```bash
cd /Users/nobu/aws-cdk-cicd-lab/01-practical-cdk-2020/sample
npx cdk --help
```

`npx cdk`はプロジェクト内にインストールしたCDKを呼び出す。今回はグローバルインストールしていないため、`cdk --help`だけでは`command not found`となった。

## 4. ファイルの役割を確認する

| ファイル | 役割 |
| --- | --- |
| `bin/sample.ts` | AppとSampleStackを作る入口 |
| `lib/sample-stack.ts` | SNS、SQS、両者の接続を定義 |
| `cdk.json` | CDKアプリの起動方法などを指定 |
| `package.json` | 使用ライブラリとnpmコマンドを管理 |
| `package-lock.json` | インストールした依存関係のバージョンを記録 |
| `tsconfig.json` | TypeScriptのチェック・出力方法を指定 |
| `.gitignore` | Gitへ登録しないファイルを指定 |

`SampleStack`は初期化時に生成された名前。`bin/sample.ts`の`new SampleStack(app, 'SampleStack')`では、最初のSampleStackがクラス名、文字列がスタックの識別名となる。

## 5. 型チェックする

```bash
npm run build
```

意味: package.jsonのbuildに登録された`tsc`を実行する。
理由: TypeScriptの型や記述のエラーをAWSへの操作前に確認するため。
結果: エラーなく終了した。

```bash
npm run watch
```

意味: ファイル変更のたびに型チェックする。終了は`Ctrl + C`。
結果: `Found 0 errors. Watching for file changes.`を確認した。

今回のtsconfig.jsonは`noEmit: true`のため、buildしても`.js`や`.d.ts`を出力しない。CDK起動時はcdk.jsonの設定により、型チェック後に`tsx`でTypeScriptを実行する。

## 6. スタックとテンプレートを確認する

```bash
npx cdk list --profile learning
npx cdk synth --profile learning
```

意味: listはスタック一覧の表示。synth（シンス）はCloudFormationテンプレートの生成。
理由: AWS上に作るものをデプロイ前に確認するため。
結果: SampleStackが表示され、次の定義を確認した。初回実行ではprofile指定を省略したが、以後は明示する。

| 定義 | 内容 |
| --- | --- |
| SQS Queue | メッセージを受け取るキュー。初期値はVisibilityTimeout 300秒 |
| SNS Topic | メッセージの配信元 |
| SNS Subscription | トピックとキューを接続する購読設定 |
| SQS QueuePolicy | 今回のトピックからキューへの送信を許可 |

`topic.addSubscription(new subs.SqsSubscription(queue))`によって、購読設定と必要なキューポリシーが生成された。synthだけではSNS・SQSは作成されない。

## 7. デプロイの準備をする

```bash
npx cdk bootstrap --profile learning
```

意味: AWSアカウントとリージョンの組み合わせに対し、CDK用の準備リソースを用意する。
理由: テンプレートやアセットの保存先と、デプロイ用の権限を用意するため。
結果: `CDKToolkit`が作成され、`bootstrapped`を確認した。

CDK v2ではS3バケットに加え、ECRリポジトリ、IAMロール、SSMパラメータ等が用意される。SNS・SQS本体はまだ作成しない。
今回のログには実行ポリシー`AdministratorAccess`が表示された。CloudFormationの実行ロールに広い権限を与える設定であり、業務環境でそのまま採用するものではない。

同じアカウント・リージョンでは別のCDKプロジェクトでも共用する。再実行時には必要に応じて更新される。
参考: [AWS公式・ブートストラップ](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/bootstrapping-env.html)

## 8. SNS・SQSをデプロイする

```bash
npx cdk deploy SampleStack --profile learning
```

意味: SampleStackのテンプレートをCloudFormation経由でAWSへ反映する。
理由: コードで定義したSNS・SQSを実際に動作させるため。

確認画面では、SNSからSQSへの`sqs:SendMessage`許可と、送信元が今回のトピックに限定されていることを確認した。想定した変更だけであれば`y`を入力する。
結果: `SampleStack`の成功表示とStack ARNを確認した。

入力した`y`の前に空白が入り、最初は`Invalid choice`となった。空白なしの`y`を再入力して続行した。

## 9. メッセージを送受信する

理由: デプロイ成功だけでなく、SNSからSQSへの接続・権限が実際に機能することを確認するため。

1. 東京リージョンのSNSコンソールで、今回作成した`SampleStack-SampleTopic...`を開く。
2. 「メッセージの発行」を選ぶ。
3. 「すべての配信プロトコルに同一のペイロード」を選ぶ。
4. 件名に`Test AWS CDK !!`、本文に`Hello from CDK sample`を入力する。他のオプションは今回は不要。
5. 「メッセージの発行」を選び、成功表示とMessage IDを確認する。
6. SQSコンソールで`SampleStack-SampleQueue...`を開く。
7. 「メッセージを送受信」から「メッセージをポーリング」を選ぶ。
8. 受信メッセージを開き、Subject、Message、MessageIdを確認する。

結果: 件名と本文が一致し、MessageIdもSNS発行時と一致した。SNSからSQSへの受信まで確認済み。

## 10. 差分を確認する

### 変更前

```bash
npx cdk diff SampleStack --profile learning
```

意味: ローカルで生成するテンプレートとデプロイ済みスタックを比較する。
理由: 変更前の状態では差分がないことを確認するため。
結果: `There were no differences`、差分のあるスタック数は0。

### 変更後

`lib/sample-stack.ts`の300秒を100秒に変更して保存した。

```typescript
visibilityTimeout: Duration.seconds(100)
```

可視性タイムアウトは、受信したメッセージを他の受信処理から一時的に見えなくする時間。メッセージの保存期間ではない。

```bash
npm run build && npx cdk diff SampleStack --profile learning
```

理由: コードの型チェック後、意図した値だけが変わることを確認するため。
結果: VisibilityTimeoutの300秒から100秒への変更を検出した。

```text
[~] VisibilityTimeout
├─ [-] 300
└─ [+] 100
```

`[~]`は変更、`[-]`は変更前、`[+]`は変更後を示す。
今回のdiffではテンプレートのアップロードと差分確認用の変更セット作成も行われたが、変更セットは実行していない。AWS上のSQS設定は300秒のままである。
参考: [AWS公式・cdk diff](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-diff.html)

## 11. サンプルを削除する

```bash
npx cdk destroy SampleStack --profile learning
```

意味: SampleStackが管理するAWSリソースを削除する。
理由: 動作確認を終えた学習用リソースを残さないため。キュー内のテストメッセージも削除対象となる。
削除対象がSampleStackであることを確認して`y`を入力した。
結果: `SampleStack: destroyed`を確認した。100秒への再デプロイは行わずに削除した。

コンソールでの最終確認項目は、今回のSNSトピックとSQSキューがなくなったこと。この確認結果は、記録作成時点では未共有である。

## 12. 終了時の状態と書籍との差分

| 項目 | 状態・理由 |
| --- | --- |
| SampleStack | CLIで削除成功。SNS・SQSの送受信確認も実施済み |
| CDKToolkit | 削除していない。以後のCDK実践で共用する準備環境 |
| ローカルのsample | 書籍では削除するが、今回は学習記録として保持 |
| ローカルのVisibilityTimeout | 100秒。再デプロイすればこの値になる |
| CDKのバージョン | 書籍のv1ではなくv2を使用。古いimportやpackage.jsonを上書きしない |
| build | 今回は型チェックのみ。JavaScriptファイルは生成しない |
| ESLint・Prettier | 未導入。古い設定形式と現在の依存関係の互換性を考慮して保留 |
| npmの警告 | 初期化時に依存パッケージの非推奨・install-scripts関連の警告あり。一括承認は行っていない |
| Git除外 | node_modules、cdk.outを除外。未作成のESLint・Prettier設定用の例外追加は不要 |

SampleStackの削除は、アカウント内の全リソースの削除や費用ゼロを意味しない。CDKToolkitと保存されたアセット等は残る。

次は第3章「TypeScript入門」へ進む。
