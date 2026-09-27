# Vim設定

[全体README](../../README.md) / [第3章の記録](../../01-practical-cdk-2020/docs/03_typescript_basics.md)

## 保管ファイル

[.vimrc](./.vimrc)は2026-09-27時点の`~/.vimrc`のコピー。元ファイルは変更していない。
リポジトリのコピーとホームディレクトリの設定は自動同期されない。

## TypeScript補完

vim-plug、coc.nvim、Node.js、およびcoc-tsserver拡張が必要。プラグインや拡張の実体はこの保管ファイルには含まれない。
Vim内で必要に応じて以下を実行する。

```vim
:PlugInstall
:CocInstall coc-tsserver
```

| 挿入モードでの操作 | 動作 |
| --- | --- |
| Ctrl+j | 補完候補を表示 |
| Ctrl+n / Ctrl+p | 候補表示中に次・前の候補へ移動 |
| Ctrl+y | 候補表示中に確定 |

参考: [coc-tsserver公式](https://github.com/neoclide/coc-tsserver)

## 使用時の注意

- 別の端末で使用する場合、既存のvimrcをバックアップし、差分を確認してから適用する。
- Terraformは保存時にfmtを実行し、全ファイルで保存時の行末空白削除を行う設定を含む。
- YAMLのLeader+rはAnsible Playbook実行、ShellのLeader+rはスクリプト実行に割り当てられている。単なるチェックではない。
- Ansibleの相対パスや外部コマンドは元の環境向けであり、別の場所では見直す。
- Kはman検索。TypeScriptのホバー説明用ではない。
- 今回は設定の保管のみ。補完の動作確認や他OSでの検証は行っていない。
