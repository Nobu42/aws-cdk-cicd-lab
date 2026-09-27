# AWS CDK / IaC 学習・実践記録

書籍4冊を順番に実践し、最後に既存のWeb基盤設計を基に自作システムを構築する。
各書籍の実装、確認結果、現在のAWS環境に合わせた変更理由を分けて記録する。

## 1. 学習する場所を選ぶ

| 順番 | 資料・作業場所 | 内容 | 進捗 |
| --- | --- | --- | --- |
| 1 | [実践 AWS CDK（2020年）](./01-practical-cdk-2020/README.md) | TypeScript、Step Functions、感情分析、テスト、CI/CD | 第2章のデプロイ・送受信・差分確認・CLIでの削除成功まで確認済み |
| 2 | [マスタリングAWS CDK](./02-mastering-aws-cdk/README.md) | 書籍に沿ったCDKの実践 | 未着手 |
| 3 | [［詳解］AWS Infrastructure as Code](./03-terraform-and-cdk/README.md) | 書籍に沿ったTerraformとAWS CDKの実践 | 未着手 |
| 4 | [AWS CDK実践ガイド](./04-cdk-practical-guide/README.md) | 書籍に沿ったCDKの実践 | 未着手 |
| 5 | [自作システム](./05-original-system/README.md) | 既存Web基盤の設計をCDKで実装し、CI/CDを追加 | 雛形・初回build / synth・設計案まで。構築は書籍終了後 |

現在は1冊目から進める。自作システムの既存雛形を1冊目の完成コードとして扱わない。

- [第2章の実践記録：コマンドの意味・理由・実行結果](./01-practical-cdk-2020/docs/02_cdk_basics.md)

## 2. ディレクトリ構成を確認する

```text
aws-cdk-cicd-lab/
├── README.md
├── .gitignore
├── docs/
│   └── setup/
│       └── 01_cdk_setup.md
├── 01-practical-cdk-2020/
│   ├── README.md
│   ├── docs/
│   │   └── 02_cdk_basics.md
│   └── sample/
├── 02-mastering-aws-cdk/
│   └── README.md
├── 03-terraform-and-cdk/
│   └── README.md
├── 04-cdk-practical-guide/
│   └── README.md
└── 05-original-system/
    ├── README.md
    ├── bin/
    ├── lib/
    ├── test/
    ├── package.json
    ├── package-lock.json
    ├── cdk.json
    └── docs/
        └── Design_Specification.md
```

理由: 書籍ごとのコード・依存関係と、自作システムのコードを混在させないためである。Gitは直下の1リポジトリで管理する。
各書籍内のプロジェクト名や階層は本文に従って決める。READMEがある書籍ディレクトリを直接`cdk init`するのではなく、書籍で指定された空のプロジェクトディレクトリを用意する。

公式参照: [cdk init（空のディレクトリで初期化）](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/ref-cli-cmd-init.html)

## 3. 作業環境を準備する

これまでの導入・エラー対処は[初回導入記録](./docs/setup/01_cdk_setup.md)を参照する。
新しいBashターミナルでは次を実行し、導入済みのNode.js 24系を選択する。

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
hash -r
node --version
```

確認: `v24.`で始まること。
理由: 初回のCDK v2検証で使用した実行環境を選ぶためである。2020年の書籍に登場する依存関係がこの環境でそのまま動くことは未確認であり、本文と照合して対応を決める。

公式参照: [AWS CDKのNode.jsサポート](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/node-versions.html)

## 4. 1冊目の学習を再開する

```bash
cd /Users/nobu/aws-cdk-cicd-lab/01-practical-cdk-2020/sample
```

第2章はデプロイ、送受信、差分確認、CLIでの削除成功まで確認済みである。コンソールでの削除後確認結果は未共有である。次は第3章「TypeScript入門」へ進む。sampleは記録として保持し、初期化は再実行しない。ESLint・Prettierの導入は保留中である。
理由: 生成済みのCDK v2プロジェクトを使い、2020年の書籍との差分を確認しながら進めるためである。AWSへの操作では`--profile learning`で対象を明示する。

書籍の順番を優先し、動作のために変更する場合は「書籍の記述・変更後・理由・結果」を各書籍の手順書へ記録する。

## 5. Gitに記録する

```bash
cd /Users/nobu/aws-cdk-cicd-lab &&
git status --short
```

記録対象はソース、設定例、依存関係のロックファイル、手順、確認結果である。
`node_modules`、`cdk.out`、Terraform state、ローカル認証情報等は対象外とする。JavaScriptソースは一律除外せず、今後生成先が増えた場合はその出力先を個別に除外する。
各書籍内に別のGitリポジトリを作らない。初期化ツールを使う場合も、ネストした`.git`が作成されていないか確認する。

## 6. 自作システムを再開する場所

書籍4冊の実践後に、[CDK用設計書](./05-original-system/docs/Design_Specification.md)と[構築手順](./05-original-system/README.md)を使用する。
既存プロジェクトのnpm / CDKコマンドは次のディレクトリで実行する。

```bash
cd /Users/nobu/aws-cdk-cicd-lab/05-original-system
```

リポジトリ直下には`package.json`や`cdk.json`を置かないため、直下から`npm run build`や`npx cdk synth`は実行しない。

## 関連ポートフォリオ

- [AWS CLI・Ansible・Terraformによる既存ラボ](https://github.com/Nobu42/terraform-iac-lab)

更新日: 2026-09-27。第2章のSampleStackはデプロイ・動作確認後にCLIで削除済み。CDKToolkitは残している。
