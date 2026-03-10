# 重要修正：点对点流式推送

## 问题

最初的设计使用 `broadcastStream` 将命令输出**广播到所有连接的客户端**。这会导致：
- 客户端 A 发起的命令输出会被客户端 B 看到
- 存在严重的隐私和安全问题
- 多客户端环境下体验混乱

## 解决方案

### 核心改进：Session Registry 模式

创建了一个全局的 session 注册表 ([session-registry.ts](../session-registry.ts))，记录每个 session 对应的 WebSocket 客户端。

```typescript
// session-registry.ts
const sessionToClient = new Map<string, WebSocket>()

export function registerSession(sessionId: string, client: WebSocket)
export function getClientForSession(sessionId: string): WebSocket | undefined
export function unregisterSession(sessionId: string)
export function isSessionId(value: unknown): value is string
```

### 自动注册机制

在 [deno-ui.ts](../deno-ui.ts) 的 WebSocket 消息处理中，自动检测并注册 session：

```typescript
// 执行 API 后
if (isSessionId(result)) {
    registerSession(result, socket)  // 自动注册
}
```

### 点对点发送

在 [stream-handler.ts](stream-handler.ts) 中，只向特定客户端发送：

```typescript
export function sendStreamToClient(sessionId: string, data: string, done: boolean) {
    const client = getClientForSession(sessionId)  // 获取特定客户端
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'stream', sessionId, data, done }))
    }
}
```

## 改进对比

| 方面 | 之前 (Broadcast) | 现在 (Point-to-Point) |
|------|-----------------|---------------------|
| 消息接收者 | 所有连接的客户端 | 只有发起命令的客户端 |
| 安全性 | ❌ 低 | ✅ 高 |
| 隐私性 | ❌ 无隔离 | ✅ 完全隔离 |
| 多客户端支持 | ❌ 会混乱 | ✅ 各自独立 |
| 实现复杂度 | 简单 | 适中 |

## 架构优势

1. **零配置**：应用层无需手动管理 session 注册
2. **解耦合**：通过 session-registry 避免循环依赖
3. **自动清理**：命令完成后自动清理注册表
4. **类型安全**：通过 `isSessionId` 类型守卫识别 session

## 使用示例

应用开发者无需关心这些细节，只需：

```typescript
// 1. 后端：返回 session ID（以 'cmd-' 开头）
const sessionId = `cmd-${Date.now()}-${randomString}`
return sessionId

// 2. 后端：推送到特定客户端
sendStreamToClient(sessionId, data, done)

// 3. 前端：订阅输出
const sessionId = await api.runCommandAndCaptureOutput(...)
subscribeToStream(sessionId, onData, onComplete)
```

框架自动处理所有的 session 管理和路由。

## 文件变更

- ✅ 新增：[session-registry.ts](../session-registry.ts) - 全局注册表
- ✅ 修改：[deno-ui.ts](../deno-ui.ts) - 自动注册 session
- ✅ 修改：[stream-handler.ts](stream-handler.ts) - 点对点发送
- ✅ 修改：[api-impl.ts](api-impl.ts) - 使用 sendStreamToClient
- ✅ 简化：[app.ts](app.ts) - 移除初始化代码

## 感谢

感谢提出这个重要的安全问题！这个修正让架构更加健壮和安全。
