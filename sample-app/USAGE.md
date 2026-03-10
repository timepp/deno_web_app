# 如何使用实时命令输出功能

## 快速开始

### 1. 运行应用

```bash
cd sample-app
deno run --allow-all app.ts
```

### 2. 访问演示页面

打开浏览器访问：`http://localhost:4010/stream-demo.html`

（注意：端口号可能不同，查看终端输出的实际端口）

### 3. 测试命令

在演示页面输入命令测试：

**Windows:**
- 命令：`ping`
- 参数：`127.0.0.1,-n,10`

**Linux/Mac:**
- 命令：`ping`
- 参数：`-c,10,127.0.0.1`

**其他示例：**
- 命令：`dir` (Windows) 或 `ls` (Linux/Mac)
- 命令：`echo`
- 参数：`Hello World`

## 在你的应用中使用

### 前端使用示例

```typescript
import { api } from '../api.ts'
import { subscribeToStream } from './websocket-client.ts'

const outputElement = document.getElementById('output')

// 1. 调用 API 启动命令
const sessionId = await api.runCommandAndCaptureOutput('ping', ['127.0.0.1', '-n', '5'])

// 2. 订阅输出流
subscribeToStream(
    sessionId,
    // 接收数据的回调
    (data) => {
        outputElement.textContent += data
        outputElement.scrollTop = outputElement.scrollHeight
    },
    // 命令完成的回调
    () => {
        console.log('Command completed!')
    }
)
```

### 添加新的流式 API

如果你想添加其他需要流式输出的 API：

1. 在 [api.ts](api.ts) 中定义接口
2. 在 [api-impl.ts](api-impl.ts) 中实现，模式与 `runCommandAndCaptureOutput` 相同：
   - 生成 session ID
   - 启动异步任务
   - 使用 `broadcastStream` 推送数据
   - 返回 session ID

```typescript
newStreamAPI: async function() {
    const sessionId = globalThis.crypto.randomUUID()
    
    // 异步执行任务
    (async () => {
        // 推送数据
        broadcastStream(sessionId, 'Some data\n', false)
        
        // 完成时
        broadcastStream(sessionId, '', true)
    })()
    
    return sessionId
}
```

## 架构说明

详细的架构设计请查看 [STREAMING-DESIGN.md](STREAMING-DESIGN.md)

## 注意事项

1. **安全性**：当前实现允许执行任意命令，生产环境需要添加命令白名单验证
2. **资源管理**：长时间运行的命令会占用系统资源，考虑添加超时机制
3. **并发限制**：考虑限制同时执行的命令数量
4. **错误处理**：命令失败时会在输出流中显示错误信息
