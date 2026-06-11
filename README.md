# Crowd Runner (Roblox)

Web版 [crowd-runner](https://crowd-runner.pages.dev/) のRoblox移植。
roblox-ts（TypeScript→Luau）+ Rojo で開発する。

## 必要なもの（初回のみ）

1. [Roblox Studio](https://create.roblox.com/) をインストールしてログイン
2. Rojo の Studio プラグイン（`rojo plugin install` 済み。Studio起動時に PLUGINS タブに Rojo が出る）

## 開発ワークフロー

ターミナル2枚 + Studio を並走させる:

```bash
# ターミナル A: TypeScript を Luau に常時コンパイル
pnpm watch

# ターミナル B: Studio と同期するサーバー
rojo serve
```

1. `rojo build -o crowd-runner.rbxlx` でプレースファイルを生成し、Studioで開く
2. Studio の PLUGINS タブ → Rojo → Connect
3. 以降 `src/` の TypeScript を保存すると Studio に自動反映

## ディレクトリ構造

| パス | 実行場所 |
|---|---|
| `src/server/` | サーバー（ServerScriptService） |
| `src/client/` | 各プレイヤーの端末（StarterPlayerScripts） |
| `src/shared/` | 両方から参照可能（ReplicatedStorage） |

人数計算・コース生成などチート対策が必要なロジックはサーバー側に置く。
