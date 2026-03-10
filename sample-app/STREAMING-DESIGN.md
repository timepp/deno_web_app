# 实时命令输出流设计

## 架构概述

这个方案使用 WebSocket 实现前端实时接收后端命令输出的功能，**只向发起命令的客户端发送输出**。

### 核心设计思路

1. **Session ID 机制**：每个命令执行都有一个唯一的 session ID
2. **双消息类型**：
   - **RPC 请求/响应**：标准的请求-响应模式（如 `getNetworkInfo`）
   - **流式推送**：服务端主动推送命令输出到**特定**客户端
3. **点对点传输**：通过 session registry 记录 session ID 和 WebSocket 的对应关系
4. **订阅模式**：前端订阅特定 session 的输出流

## 消息格式

### RPC 请求/响应
```typescript
// Request
{ id: number, cmd: string, args: any[] }

// Response
{ id: number, result: any }
```

### 流式推送
```typescript
{
  type: 'stream',
  sessionId: string,
  data: string,      // 输出内容
  done: boolean      // 是否完成
}
```

## 文件结构

### 核心文件

#### 1. `session-registry.ts` - 会话注册表（新增）
- 全局的 session ID -> WebSocket 映射
- 避免循环依赖的关键组件
- 提供 `registerSession`、`getClientForSession`、`unregisterSession` 等 API

#### 2. `deno-ui.ts` - WebSocket 处理层（修改）
- 在 API 调用完成后，检查返回值是否为 session ID
- 如果是，自动注册 session 和 socket 的映射关系
- 无需应用层手动管理

#### 3. `api-impl.ts` - API 实现
- `runCommandAndCaptureOutput` 返回 session ID
- 启动异步进程执行命令
- 使用 `sendStreamToClient` 推送输出到**特定客户端**

#### 4. `stream-handler.ts` - 流处理器
- 从 session registry 获取对应的 WebSocket 客户端
- 提供 `sendStreamToClient` 函数推送消息到特定客户端
- 自动清理完成的 session

#### 5. `app.ts` - 应用入口
- 无需特殊初始化，框架自动处理

### 前端部分

#### 1. `websocket-client.ts` - WebSocket 客户端
- 扩展消息处理，支持流式消息
- 新增 `streamSubscribers` Map 管理订阅
- 提供 `subscribeToStream` 和 `unsubscribeFromStream` API

#### 2. `stream-demo.html` - 演示页面
- 展示如何使用流式 API
- 实时显示命令输出
- 自动滚动到最新内容

## 工作流程

### 1. 客户端发起命令

```typescript
// 前端调用 API
const sessionId = await api.runCommandAndCaptureOutput('ping', ['127.0.0.1'])
```

### 2. WebSocket 层自动注册

```typescript
// deno-ui.ts 在处理 WebSocket 消息时
if (isSessionId(result)) {
    registerSession(result, socket)  // 自动注册 session -> socket 映射
}
```

### 3. 后端只向特定客户端推送

```typescript
// api-impl.ts
sendStreamToClient(sessionId, data, false)  // 只发送给发起命令的客户端
```

### 4. 前端接收输出

```typescript
subscribeToStream(sessionId, 
    (data) => console.log(data),
    () => console.log('完成')
)
```

## 使用示例

详见 [USAGE.md](USAGE.md)

## 优势

1. **安全隔离**：每个客户端只接收自己发起的命令输出
2. **Clean 分离**：RPC 和流式推送使用同一个 WebSocket 连接，但逻辑分离
3. **异步非阻塞**：命令立即返回 session ID，不阻塞其他操作
4. **可扩展**：支持多个命令同时执行，互不干扰
5. **实时性**：使用 WebSocket 推送，无需轮询
6. **错误处理**：命令失败时也会通过流推送错误信息
7. **自动管理**：框架自动注册和清理 session，无需手动管理

## 扩展建议

1. **多个订阅者**：当前设计每个 session 只支持一个订阅者，可以改为支持多个
2. **历史输出缓存**：对于晚订阅的客户端，可以缓存历史输出
3. **取消命令**：添加 API 用于取消正在运行的命令
4. **stderr 分离**：当前 stdout 和 stderr 混在一起，可以分别处理
5. **进度条支持**：对于支持进度的命令，可以解析输出并提供进度回调
6. **超时机制**：添加命令执行超时控制
7. **命令白名单**：在生产环境添加安全限制
