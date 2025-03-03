# OHIP GraphQL Subscription Test Server

このプロジェクトは、OHIP GraphiQL Tool用のテスト環境として使用できるGraphQLサブスクリプションサーバーを提供します。ローカル開発環境でOHIPのGraphQLインターフェイスをシミュレートし、WebSocketベースのサブスクリプション機能をテストできます。

## 特徴

- GraphQL APIエンドポイント
- WebSocketを使用したサブスクリプション機能
- 認証機能（APIキー、Bearerトークン、ソケットキー）
- SHA-256ハッシュによるセキュリティ検証
- 模擬イベントデータの生成

## 前提条件

- Node.js 16.x以上
- npm 7.x以上

## インストール方法

```bash
# プロジェクトディレクトリを作成し、ファイルを配置
mkdir ohip-graphql-server
cd ohip-graphql-server

# 必要なディレクトリ構造を作成
mkdir public

# ファイルを作成
# server.js、package.json、public/index.htmlの内容を貼り付け

# 依存関係をインストール
npm install

# サーバーを起動
npm start
```

サーバーが起動すると、以下のURLでアクセスできます：
- GraphiQL UI: http://localhost:4000/
- GraphQL エンドポイント: http://localhost:4000/graphql
- サブスクリプションエンドポイント: ws://localhost:4000/subscriptions

## 使用方法

1. ブラウザで `http://localhost:4000/` にアクセスします
2. デフォルトの接続情報が自動入力されています：
   - URL: `ws://localhost:4000`
   - Auth Token: `test-auth-token`
   - API Key: `test-api-key`
3. 「Start」ボタンをクリックすると、APIキーからハッシュが生成され、SocketKeyが自動的に設定されます
4. 接続が成功すると、GraphiQLインターフェースが表示されます
5. サンプルのサブスクリプションクエリを実行すると、5秒ごとに新しいイベントが生成されます

## サンプルクエリ

### イベントサブスクリプション
```graphql
subscription {
  newEvent(input: { chainCode: "OHIPCN" }) {
    metadata {
      offset
      uniqueEventId
    }
    moduleName
    eventName
    detail {
      elementName
      newValue
      oldValue
    }
  }
}
```

### ヘルプ情報の取得
```graphql
query {
  getHelp {
    overview
    configuration
    connection {
      help
      errors
    }
    events {
      payload
      replaying
    }
    slack
    email
  }
}
```

## 認証の仕組み

このサーバーでは、以下の認証メカニズムが実装されています：

1. **APIキー認証**: リクエストヘッダーの `x-app-key` に有効なAPIキーを含める必要があります
2. **Bearerトークン認証**: リクエストヘッダーの `Authorization` に `Bearer <token>` 形式のトークンを含める必要があります
3. **ソケットキー検証**: WebSocket接続のURLパラメータ `key` には、APIキーのSHA-256ハッシュが必要です

テスト環境では、以下のデフォルト値が使用できます：
- API Key: `test-api-key`
- Auth Token: `test-auth-token`
- Socket Key: APIキーのSHA-256ハッシュ (自動生成されます)

## プロジェクト構造

```
ohip-graphql-server/
├── package.json         # プロジェクト依存関係とスクリプト
├── server.js            # メインサーバーコード
└── public/              # 静的ファイル
    └── index.html       # GraphiQLインターフェース
```

## カスタマイズ方法

### イベント生成ロジックのカスタマイズ

`server.js` の `generateMockEvent` 関数を編集することで、生成されるイベントデータをカスタマイズできます。

```javascript
// Mock data for demonstration purposes
const generateMockEvent = (chainCode) => {
  // ここでモックイベントの内容をカスタマイズ
  // ...
};
```

### スキーマの拡張

`server.js` の `typeDefs` と `resolvers` を拡張することで、新しいクエリやサブスクリプションを追加できます。

## トラブルシューティング

### 接続エラー

- **400 - Incorrect key or URL**: ソケットキーがAPIキーのSHA-256ハッシュと一致しているか確認してください
- **4401 - Unauthorized**: 認証情報（APIキー、認証トークン）が正しいか確認してください
- **サーバーに接続できない**: サーバーが起動しているか確認し、URLが正しいか確認してください

### サーバー起動の問題

- **ポートが既に使用されている**: `PORT=5000 npm start` のように環境変数でポートを変更してください
- **依存関係のエラー**: `npm install` を再実行して、依存関係が正しくインストールされているか確認してください

## 補足説明

このサーバーは開発およびテスト目的のみで使用し、本番環境での使用は避けてください。実際のOHIPサブスクリプションAPIとの互換性を完全に保証するものではありません。