# CDK / TypeScript 導入・初回テンプレート生成記録

作成日: 2026-09-26

本書は移動前の初回作業時の記録である。下記のパスとコマンドは当時の状態を残している。
2026-09-27にCDKプロジェクトを`04-original-system`へ移動した。現在の作業場所と各操作の理由は[自作システムの構築手順](../../04-original-system/README.md)、学習順序は[全体README](../../README.md)を参照する。

## 目的と到達点

AWS CDK、TypeScript、AWS CodeシリーズによるCI/CDの検証用環境を準備する。
既存のTerraformリポジトリとは別のディレクトリで管理する。

今回確認した範囲は、ローカルのプロジェクト初期化、TypeScriptビルド、CloudFormationテンプレート生成までである。bootstrapとdeployはまだ実施していない。

## 使用環境

| 項目 | 今回の値 |
| --- | --- |
| OS / シェル | macOS / Bash |
| 作業ディレクトリ | `/Users/nobu/aws-cdk-cicd-lab` |
| AWSプロファイル | `learning` |
| プロファイルのリージョン | `ap-northeast-1` |
| Node.js | 26.7.0から24.21.0へ切り替え |
| npm | 11.19.0 |
| Git | 2.55.0 |
| CDK CLI | 2.1143.0 |
| Gitブランチ | `main` |

バージョンは今回の記録値であり、将来のインストール結果を固定する指定ではない。アカウントID、認証情報は記載しない。

## 1. 既存ツールを確認

```bash
node --version
npm --version
git --version
command -v node
command -v nvm
command -v fnm
command -v volta
brew list --versions node node@24
```

Node.jsはHomebrewで導入された26.7.0であり、実行パスは`/opt/homebrew/bin/node`だった。バージョン管理ツールの確認コマンドには出力がなかった。
確認時のAWS CDK公式サポート一覧にはNode.js 24、22、20系が記載されていたため、この検証では24系を使用することとした。

## 2. Node.js 24を追加・切り替え

```bash
brew install node@24
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
hash -r
node --version
npm --version
```

確認結果:

```text
v24.21.0
11.19.0
```

`node@24`はkeg-onlyとして追加された。PATHの先頭に24系の実行ファイルの場所を指定し、Bashのコマンドキャッシュをクリアした。
このPATH設定は現在のシェルとその子プロセスに適用される。`.bash_profile`への追記は今回実施していない。新しいターミナルで作業を再開する場合は、同じexportとhashコマンドを実行してバージョンを確認する。

HomebrewからOpenSSLの将来の更新方針に関する案内も出たが、今回のNode.jsインストール失敗ではない。

## 3. 作業ディレクトリ作成・初期化

最初はディレクトリが存在せず、`cd`が失敗した。その後の初期化コマンドがホームディレクトリで実行され、次のエラーで停止した。

```text
cdk init cannot be run in a non-empty directory!
```

ディレクトリを作成し、前の処理が成功した場合のみ次へ進むように再実行した。

```bash
mkdir -p /Users/nobu/aws-cdk-cicd-lab &&
cd /Users/nobu/aws-cdk-cicd-lab &&
npx --package=aws-cdk cdk init app --language typescript
```

パッケージのインストール確認には`y`を入力した。TypeScript用の雛形、Gitリポジトリ、npm依存パッケージが準備され、`All done!`と表示された。
このコマンドは空のディレクトリで初回に実行する。初期化済みの場所では繰り返さない。

### 表示された警告

- Gitの初期ブランチ名が`master`であるという案内: 次の手順で`main`へ変更した。
- `glob@10.5.0`の非推奨警告: 依存関係に関する警告。今回、依存パッケージの強制更新は行っていない。
- `@swc/core`、`@parcel/watcher`、`unrs-resolver`、`esbuild`のインストールスクリプト承認案内: 一括承認は行っていない。後続処理で必要になった場合は対象とスクリプトを確認する。
- npmの新バージョン通知: 今回は更新していない。

後述のbuildとsynthは成功したが、これによりすべての依存関係の安全性やテスト実行を検証したことにはならない。

## 4. ブランチ名変更・ビルド

```bash
git branch -m main
npm run build
```

出力:

```text
> aws-cdk-cicd-lab@0.1.0 build
> tsc
```

エラーなく終了した。同じ操作を2回実行したが、どちらもビルドエラーはなかった。
`npm run build`は、このプロジェクトのTypeScriptコンパイラーを実行する。AWSへのデプロイ操作ではない。

## 5. CloudFormationテンプレート生成

```bash
npx cdk synth --profile learning
```

ユーザーが実行し、テンプレートが出力された。ローカルにも`cdk.out`ディレクトリの存在を確認した。

| 出力項目 | 読み方 |
| --- | --- |
| `Resources / CDKMetadata` | CDKのメタデータ用定義。アプリケーション用のEC2やVPCはまだ定義されていない |
| `Conditions / CDKMetadataAvailable` | メタデータ定義を適用するリージョンの条件。列挙された全リージョンへデプロイする指定ではない |
| `Parameters / BootstrapVersion` | `/cdk-bootstrap/hnb659fds/version`というSSMパラメーターへの参照。bootstrap済みであることを証明する出力ではない |

`synth`はCDKコードからCloudFormationテンプレート等を生成する操作である。今回の操作でAWSスタックをデプロイしたわけではない。
また、この結果だけでは学習用アカウントIDや、今後のデプロイに必要な権限が確認済みとは言えない。`get-caller-identity`の実行結果は本記録では未確認である。

## 初回作業時の主要ファイル（移動前）

```text
aws-cdk-cicd-lab/
├── bin/                 # CDKアプリの起動処理
├── lib/                 # スタック定義
├── test/                # テスト用コード
├── docs/                # 作業記録
├── cdk.json             # CDKアプリの実行設定
├── package.json         # npmスクリプトと依存関係
├── package-lock.json    # npm依存関係の解決結果
├── tsconfig.json        # TypeScriptの設定
└── cdk.out/             # synthの生成物
```

## 未実施の作業

- CDKコードへのアプリケーション用リソース追加
- `cdk bootstrap`と`cdk deploy`
- Jestによるテスト実行
- CodePipeline / CodeBuild / CodeDeployの構築

## 記録作成後の更新

GitHubリモート登録と初回pushは完了した。`main`は`origin/main`を追跡している。
コード、導入記録、CDK用設計書を公開し、既存TerraformリポジトリのREADMEからリンクした。

## 参照

- [AWS CDKでサポートされるNode.jsバージョン](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/node-versions.html)
- [Homebrew node@24](https://formulae.brew.sh/formula/node@24)

実行結果は会話で共有された出力を基に記録した。記録作成時にbuild、synth、AWS操作の再実行は行っていない。
