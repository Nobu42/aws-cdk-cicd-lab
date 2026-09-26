# AWS CDK / CI/CD Lab 構築手順

[全体の学習順序へ戻る](../README.md)

書籍3冊の実践後に再開する自作システムの手順である。2026-09-27に既存のCDK雛形をこのディレクトリへ移動した。

AWS上のWeb基盤をTypeScriptで定義し、CDKで構築するための学習用リポジトリ。
後続でCodePipeline、CodeBuild、CodeDeployを追加し、アプリケーションの自動配布を検証する。

## 現在の進捗と読む順番

2026-09-26時点で、Node.js導入、CDK初期化、build、初回synth、GitHub公開まで完了している。AWS上へのデプロイとCI/CD構築は未実施である。

- 初めて準備する場合: 手順1から進める。
- この環境で作業を再開する場合: 「作業再開時の手順」から進める。初期化は繰り返さない。
- 自作システムの中断位置: 手順7のコード確認。手順8の環境指定は未適用であり、書籍の実践後に再開する。

| 資料 | 用途 |
| --- | --- |
| [CDK / CI/CD用設計書](./docs/Design_Specification.md) | 構築する構成、段階別の対象範囲、未確定事項を確認する |
| [初回導入の実行記録](../docs/setup/01_cdk_setup.md) | 実際の出力、発生したエラー、対処を振り返る |

## 前提

| 項目 | 値 |
| --- | --- |
| 作業端末 | Apple Silicon Mac / Bash / Homebrew |
| 作業場所 | `/Users/nobu/aws-cdk-cicd-lab/04-original-system` |
| AWSプロファイル | `learning` |
| 使用リージョン | `ap-northeast-1` |
| Node.js | 24系 |
| 初期化時のCDK CLI | 2.1143.0 |

本手順は既存のAWS CLI設定と認証情報を利用する。秘密鍵やアクセスキーをREADMEへ転記しない。

## 作業再開時の手順

Node.jsの切り替えはターミナルごとの設定としている。新しいターミナルでは、最初に次を実行する。

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
hash -r
cd /Users/nobu/aws-cdk-cicd-lab/04-original-system &&
node --version &&
git status --short --branch
```

確認: Node.jsが`v24.`で始まり、作業場所と変更状態が想定どおりであること。
理由: 別バージョンのNode.jsや別ディレクトリで作業することを防ぐためである。

## 1. インストール済みツールを確認する

```bash
node --version
npm --version
git --version
command -v node
brew list --versions node node@24
```

確認: コマンドが存在することと、Node.jsのバージョン・実行場所を確認する。
初回の環境ではNode.js 26.7.0が`/opt/homebrew/bin/node`から実行されていた。

理由: CDKとTypeScript関連ツールを動かす実行環境がNode.jsであり、先に対応バージョンをそろえる必要がある。
このラボでは、確認時点でCDKの公式サポート対象に掲載されていた24系を選択した。

公式参照: [AWS CDKでサポートされるNode.js](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/node-versions.html)

## 2. Node.js 24を導入・選択する（初回）

24系が未導入の場合のみ、次を実行する。

```bash
brew install node@24
```

正常終了後、使用するバージョンを選択する。

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
hash -r
node --version
npm --version
```

確認: `node --version`が`v24.`で始まること。初回確認値は`v24.21.0`だった。

理由: Homebrewの`node@24`は別バージョンとして追加されるため、インストールだけでは既存の`node`より優先されない。PATHの先頭に24系の場所を追加し、`hash -r`でBashが覚えているコマンドの場所をクリアする。
`.bash_profile`への永続設定は本手順では行わない。

公式参照: [Homebrew node@24](https://formulae.brew.sh/formula/node@24)

## 3. AWSの接続先を確認する

```bash
aws sts get-caller-identity --profile learning --no-cli-pager
aws configure get region --profile learning
```

確認: `Account`と`Arn`が学習用の接続先であり、プロファイルのリージョンが`ap-northeast-1`であること。
理由: 同じ端末に複数の認証設定があっても、使用する接続先を明示するためである。認証成功だけで、今後必要な全サービスの操作権限があるとは判断しない。

この確認結果は初回の会話では未共有のため、確認済みとして扱っていない。

公式参照: [STS get-caller-identity](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html)、[CDKの環境指定](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/environments.html)

## 4. CDKプロジェクトを作成する（初回のみ）

このプロジェクトは初期化済みである。以下は移動前にリポジトリ直下で行った初回操作の記録であり、再実行しない。現在の実行場所は`04-original-system`である。GitHubからcloneした場合も`cdk init`は不要である。

```bash
mkdir -p /Users/nobu/aws-cdk-cicd-lab &&
cd /Users/nobu/aws-cdk-cicd-lab &&
npx --package=aws-cdk cdk init app --language typescript
```

操作: npmパッケージの導入確認が表示された場合は、対象が`aws-cdk`であることを確認して`y`を入力する。
確認: `All done!`と表示され、`bin`、`lib`、`package.json`等が作成されること。

| 指定 | 意味・理由 |
| --- | --- |
| `mkdir -p` | 作業ディレクトリを用意する |
| `&&` | 前の処理が成功した場合だけ次へ進み、cd失敗後にホームで初期化することを防ぐ |
| `npx --package=aws-cdk` | CDK CLIを実行するためのnpmパッケージを指定する |
| `init app` | CDKアプリの雛形を作成する |
| `--language typescript` | TypeScript用の雛形を選択する |

初回に生成されたCLIバージョンは2.1143.0である。上記の初期化コマンドはバージョン未固定のため、将来実行した場合の雛形は変わり得る。
移動後はプロジェクト内のCDKを使うため、コマンドを`04-original-system`から実行する。

公式参照: [cdk init](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-init.html)、[TypeScriptとローカルツールの利用](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/work-with-cdk-typescript.html)

## 5. Gitのブランチ名をmainにする（初回のみ）

```bash
git branch --show-current
```

`master`の場合は次を実行する。すでに`main`なら変更不要である。

```bash
git branch -m main
```

確認: `git branch --show-current`が`main`を返すこと。
理由: このリポジトリの基準ブランチ名を`main`にそろえるためである。Git全体の設定は変更しない。

公式参照: [Git branch（-mによる名前変更）](https://git-scm.com/docs/git-branch)

## 6. TypeScriptコードをビルドする

```bash
npm run build
```

確認: 次のように`tsc`が実行され、エラーなくプロンプトへ戻ること。

```text
> aws-cdk-cicd-lab@0.1.0 build
> tsc
```

理由: `package.json`に登録されたTypeScriptコンパイラーを使い、型や構文上の問題を確認するためである。AWSリソースの作成や動作テストではない。

公式参照: [TypeScriptでAWS CDKを使用する](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/work-with-cdk-typescript.html)

## 7. 起動ファイルとスタックを確認する

```bash
cat bin/aws-cdk-cicd-lab.ts
cat lib/aws-cdk-cicd-lab-stack.ts
```

理由: CDKが自動生成したコードのうち、アプリを起動する場所と、AWSリソースを記述する場所を区別するためである。

| ファイル・用語 | 役割 |
| --- | --- |
| `.ts` | TypeScriptファイルの拡張子 |
| `bin/aws-cdk-cicd-lab.ts` | Appを作成し、スタックを呼び出す |
| `lib/aws-cdk-cicd-lab-stack.ts` | VPCやEC2等の構成を書き込むスタックの定義 |
| スタック | CloudFormationでまとめて作成・更新・削除する単位 |
| `cdk.json` | CDKがアプリを起動するコマンド等の設定 |

### Appを作成する行

```typescript
const app = new cdk.App();
```

`new cdk.App()`でCDKアプリのオブジェクトを作り、`app`という変数で参照する。`const`は変数への再代入を禁止する宣言であり、オブジェクトの内容すべてを変更不可にする意味ではない。

### スタックを作成する行

```typescript
new AwsCdkCicdLabStack(app, 'AwsCdkCicdLabStack', {
  // この位置にスタックの設定を記述する
});
```

第1引数は所属するApp、第2引数はCDK内での識別子、第3引数は設定を渡すオブジェクトである。`{}`は設定が空の状態を表す。
このコードを実行してオブジェクトを作るだけで、AWS上にVPC等が作成されるわけではない。

確認: `lib`の`The code that defines your stack goes here`は「ここにスタックを定義するコードを記述する」という意味である。サンプルのSQSコードはコメントであり、現在の構築対象ではない。

公式参照: [AWS CDKのTypeScriptコード](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/work-with-cdk-typescript.html)

## 8. デプロイ先の環境指定を追加する（次回・未実施）

この手順はREADMEに記載した次の作業であり、現時点ではソースへ反映していない。

操作: `bin/aws-cdk-cicd-lab.ts`内の次の行を探す。

```typescript
// env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
```

行頭の`//`を外し、読みやすく整形する。

```typescript
env: {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
},
```

理由: CLIが解決したアカウントとリージョンをスタックへ渡すためである。`--profile learning`を使い、アカウントIDをコードに固定しない。既存のリージョン環境変数等による上書きがある場合は、その設定も確認する。
例示されている`123456789012`と`us-east-1`の行は有効にしない。

元コメントの意味:

- `env`なし: 特定のアカウント・リージョンに依存しないテンプレートとなり、環境依存の情報取得には制限がある。
- `CDK_DEFAULT_ACCOUNT / REGION`の行: CLIが解決した環境を使う場合に有効化する。
- 数値とリージョンを直書きした行: 明示的に固定したい場合の別案である。

編集後は手順6のbuildと手順9のsynthを再実行し、`git diff -- bin/aws-cdk-cicd-lab.ts`で意図した変更だけか確認する。

公式参照: [AWS CDKの環境](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/environments.html)、[CLIの認証・リージョン設定](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/cli.html)

## 9. CloudFormationテンプレートを生成する

```bash
npx cdk synth --profile learning
```

理由: TypeScriptで書いた構成が、AWSへ渡すCloudFormationテンプレートとして生成できることを確認するためである。`synth`は生成、`deploy`はAWSへの反映であり、別の操作である。
初回synthは手順8の環境指定を追加する前に成功している。

確認: YAML形式のテンプレートが表示され、`cdk.out`に生成物が作成されること。現状の雛形では、VPCやEC2の定義は含まれない。

| 初回出力 | 意味 |
| --- | --- |
| `CDKMetadata` | CDKのメタデータ用定義 |
| `CDKMetadataAvailable` | メタデータを適用するリージョンの条件。全リージョンへの構築指定ではない |
| `BootstrapVersion` | CDKの事前準備用SSMパラメーターへの参照。bootstrap実施済みの証明ではない |

AWS情報の参照が必要なコードではsynth中に読み取りAPIを利用する場合があるが、本手順でスタックのデプロイは行わない。

公式参照: [cdk synthesize](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-synth.html)

## 10. 初回準備の完了確認

- Node.js 24系を使用している。
- `npm run build`が成功する。
- `npx cdk synth --profile learning`でテンプレートが生成される。
- `bin`と`lib`の役割を説明できる。
- AWSへのデプロイはまだ行っていないと区別できる。

書籍3冊の実践後、[設計書](./docs/Design_Specification.md)に沿ってdev用のVPC等を定義する。bootstrapやdeployは、接続先・定義内容・費用・削除方法を確認する段階で扱う。

## トラブル時の確認

| 表示・事象 | 対応と理由 |
| --- | --- |
| `cd: No such file or directory` | 初回ならディレクトリを作成する。移動に失敗したまま次のコマンドを実行しない |
| `cdk init cannot be run in a non-empty directory` | `pwd`と`ls -a`で場所と内容を確認する。初期化済みならinitを省略する |
| Node.jsが26系に戻った | 「作業再開時の手順」でPATHを設定する。24系を使う指定がそのターミナルに未反映の可能性がある |
| npmのインストールスクリプト承認案内 | 対象パッケージとスクリプトを確認する。今回のbuildとsynthは一括承認せず成功した |
| `nothing to commit, working tree clean` | 保存すべき差分がない状態である。`git status`と履歴を確認する |

発生済みエラーと実行結果の詳細は[初回導入の実行記録](../docs/setup/01_cdk_setup.md)を参照する。
