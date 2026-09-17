# みせ勤のログイン調査と stagegate の月次アーカイブ（2026-09-10）

「みせ勤にアクセスできない」から始まり、会計アプリ（stagegate-accounting）のAPIキー入力を
不要にし、計算結果をDBに保存して2回目から読み込めるようにするところまで。

対象リポジトリ:

- みせ勤 … `/home/takan/projects/misekin`（本番 https://dataraw.jp/dev/misekin）— 今回はコード変更なし
- 会計アプリ … `/home/takan/projects/stagegate-accounting`（本番 https://dataraw.jp/dev/stagegate_accounting/）
  commit `08b17f1`（APIキー）→ `eff617f`（月次アーカイブ）

---

## 1. 「みせ勤にアクセスできない」の切り分け

結論: **サイトは落ちていない。パスワード違いのログイン失敗が500になり、無言でフォームに戻されていた。**

| 確認 | 結果 |
|---|---|
| `/dev/misekin/login` | 200、HTML/JS/CSSも配信 |
| コンテナ app / db / solver | 稼働中、DB healthy |
| 打刻（/clock） | 当日10:01まで正常に記録 |
| ユーザー7名 | 全員メール確認済み・パスワードあり |
| nginx アクセスログ 11:47 | `POST /login` が2回とも **500** |
| app ログ | 同時刻に `CredentialsSignin`（認証NG）をそのまま throw |

### 500になる理由（**2026-09-17 に修正・本番反映済み** `5f87c17`）

`src/actions/auth.ts:263`

```ts
if (error.message?.includes("CredentialsSignin")) redirect("/login?error=credentials");
throw error;
```

本番では Auth.js のエラー message が `Read more at https://errors.authjs.dev#credentialssignin`
（**小文字**）で、クラス名も minify で `t` になるため判定が false → 再throw → 500。
**`error.type === "CredentialsSignin"` で判定すべき。**

直せば3行だが、`misekin` の作業ツリーに schema.prisma / migrations.sql 等の未コミット変更が
混ざっていて、`deploy.sh` は rsync で丸ごと送る作り。**今デプロイすると未完成のDB変更まで乗る**ので、
その作業が片付いてから一緒に出す。

### 切り分けで使った手順（次回用）

```bash
# 外形
curl -s -o /dev/null -w "%{http_code}\n" https://dataraw.jp/dev/misekin/login
# コンテナとログ
ssh prod-server-deploy "cd /opt/apps/misekin && docker compose ps && docker compose logs -t --since 24h app | grep -a 'auth..error'"
# 誰が何を叩いて何が返ったか（nginx は ops ユーザーで読める）
ssh prod-server "tail -n 200000 /var/log/nginx/access.log" | grep -a misekin | grep -a "10/Sep/2026:11:"
# DBのユーザー状態（テーブル名は @@map の "users"。"User" ではない）
docker compose exec -T db psql -U misekin -d misekin -c 'select email, "emailVerified" is not null, "passwordHash" is not null from users;'
```

---

## 2. 会計アプリのAPIキーをサーバー側に置いた — commit `08b17f1`

毎回サイドバーにみせ勤のAPIキーを貼っていた。`app.py` は既に `MISEKIN_API_KEY` を初期値にする
作りだったので、**本番コンテナに環境変数を渡していなかっただけ**。

- `/opt/apps/stagegate-accounting/.env`（手動管理・600・gitignore）に `MISEKIN_API_KEY=` を置き、
  `docker run --env-file` で渡す。**`docker restart` では反映されない**（rm → run）
- `app.py` は環境変数があれば入力欄を空にし、**キーの値をブラウザに送らない**。入力欄は上書き用に残す
- 手順は stagegate の README「みせ勤 API キー」に記載

### ハマった点

- **みせ勤側はキーを sha256 で保存していて、平文は取り出せない。** 既存キー `stagegate-accounting`
  （`mk_live_CSs4Esep…`）の平文が手元に無く、`stagegate-accounting2`（`mk_live_qs4yVqfj…`、
  storeScope=stage gate のみ）を再発行した
- 1回目は貼り付け例の `XXXXXXXX` がそのまま保存されて401。キーは `mk_live_` + nanoid の **29文字**。
  照合は `.env` の値の sha256 と `api_keys.keyHash` の突き合わせが確実
- **旧キー `stagegate-accounting` はどこからも使われなくなったが、失効は未済**（高野判断）

---

## 3. 月次アーカイブ — 発行時に「入力＋結果」を保存し、2回目からはDBから再生 — commit `eff617f`

### 要件レビューで決めたこと

依頼は「計算した結果をDBに保存して、2回目からはDBから読み込めるように」。
お支払い明細（時給・交通費・バック）は**人に払った金額なのに保存されておらず**、みせ勤側で
修正申請が承認されると翌月には数字が変わる状態だった。一方で「結果だけ」保存すると
どのCSV・どの勤怠から出た数字かが追えず、「入力だけ」保存すると率やコードを直したとき過去月が動く。

→ **入力と結果を1セットで保存し、読み込みは入力を再生、結果は突き合わせに使う**（推奨案）。
保存の契機は「発行（確定）」と同時（高野決定）。自動上書きはしない。

### 保存するもの（`month_archives` / `month_archive_pay_lines`）

| データ | 用途 |
|---|---|
| 元CSVの中身（BLOB） | CSVを上げ直さず全タブを再生 |
| みせ勤の勤怠（JSON）・取得期間 | **2回目以降はみせ勤を叩かない**。「みせ勤から再取得」で明示的にライブを見る |
| サイドバーの設定・率 | 読み込むと当時の値に戻る |
| 時給の手修正 `{スタッフ名: 時給}` | みせ勤の値と違う分だけ持つ（全員分を持つと、後でみせ勤側を直しても上書きし続ける） |
| キャスト別支払い明細（1人1行）・集計サマリー | 「払った金額の記録」。再生した計算と突き合わせ、**1円でもズレたら画面上部に警告** |

- 同じ月を発行し直すと **version が増える**（過去版は消さない）。請求書 `owner_invoices` は従来どおり上書き
- 発行前の状態（CSVを読んだだけ・率を変えただけ）は保存しない

### 実装の要点

- 支払い明細の計算を `src/pay.py` に切り出し、画面・保存・比較で同じ関数を使う
  （`build_wage_input` / `build_pay_table` / `pay_lines_from_table` / `diff_pay_lines` / `diff_summary`）
- 支払い表は**タブより前で計算**する。発行ボタン（請求書タブ）が支払い明細（別タブ）の値を必要とするため
- サイドバーを全部 key 付きにした（`SIDEBAR_DEFAULTS`）。`value=` を渡さず `session_state` の既定値で描くと、
  読み込み時に値を差し替えても警告が出ない
- **読み込みボタンは `on_click` コールバック。** ウィジェットは一度描くと同じ実行内で `session_state` を
  書き換えられないが、コールバックはスクリプト再実行の前に走る。当初は「pending に積んで `st.rerun()`」で
  書いたが、AppTest では rerun 前に描いた要素がツリーに残って落ちる（本物のブラウザでは起きない）。
  コールバック方式なら rerun 自体が不要
- `file_uploader` の読み取りは `uploaded.getvalue()` に変更。別のCSVが来たらアーカイブ状態
  （勤怠・時給の手修正）を捨てる（sha256 で判定）

### テスト（`tests/test_archive.py` / `tests/test_restore.py`、AppTest）

みせ勤は擬似データに差し替え、DBは一時ディレクトリ。通した流れ:

サンプルCSV → 発行で v1（支払い明細の金額まで照合）→ 別セッションで読込（**みせ勤の呼び出し0回**）
→ 一致表示 → 率を変えるとズレ検知 → 再取得で勤怠が変わってもズレ検知（`ゆん: 総実働時間 9.00h → 11.00h`）
→ 再発行で v2 追加・v1 残存 → サイドバー設定と時給手修正の復元。

`data_editor` の編集は AppTest で再現できないので、手修正は `session_state['wage_overrides']` を直接置いて検証した。

### デプロイ

本番DBを `data/backup/stagegate_20260910_211251.db` に退避 → pull → build → コンテナ作り直し（`--env-file` 付き）。
`init_db()` をコンテナ内で流してテーブル2つの作成を確認。**本番には発行済みの月がまだ0件**なので、
アーカイブは次に発行した月から貯まる。

---

## 残タスク

| 期日 | やること | 担当 |
|---|---|---|
| ~~みせ勤の作業ツリーが片付いたら~~ | ~~`src/actions/auth.ts:263` の判定を `error.type === "CredentialsSignin"` に直してデプロイ~~ **2026-09-17 完了。本番でパスワード違いを送り 303 → `/login?error=credentials` を確認** | Claude |
| 任意 | みせ勤の管理画面で旧APIキー `stagegate-accounting`（`mk_live_CSs4Esep…`）を失効 | 高野 |
| 8月分を発行するとき | 実データで「発行 → v1 保存 → 読み込み → 一致」が動くか一度見る | 高野 |
