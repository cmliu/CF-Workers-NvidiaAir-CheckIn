# 🚀 NVIDIA_Air 自动续期脚本 CF-Workers-NvidiaAir-CheckIn

![TG](/demo.png)

☁️ Cloudflare Workers 版本的 NVIDIA Air 自动续期脚本。

## 🛠️ 使用

1. 在 Cloudflare Workers 新建 Worker，把 `worker.js` 的内容粘贴进去。
2. 在 Worker 的 `变量和机密` -> `+ 添加` 里添加变量。只有 `NVIDIA_AIR_API_KEY` 和 `SIMULATION_ID` ：

### 🔑 获取 `NVIDIA_AIR_API_KEY`

1. 打开 [NGC API Keys 页面](https://org.ngc.nvidia.com/account/api-keys)，登录你的 NVIDIA / NGC 账号。
2. 创建新的 API Key，填写 Key 名称，例如 `cf-workers-air-renew`，并设置`12 months`过期时间。
3. 在 `Key Permissions` 的 `Services Included` 里选择以下权限：
   - `NVIDIA Air Image Claimer Access`
   - `NVIDIA Air`
4. 生成后的 Key 只会显示一次，复制后填到 Cloudflare Worker 变量 `NVIDIA_AIR_API_KEY`。

| 变量名 | 是否必填 | 说明 |
| --- | --- | --- |
| `NVIDIA_AIR_API_KEY` | ✅ 必填 | 🔑 NVIDIA NGC / Air API Key |
| `SIMULATION_ID` | ✅ 必填 | 🧪 需要续期的 NVIDIA Air Simulation ID |
| `TOKEN` | ⚙️ 可选 | 🖱️ 手动触发续期的访问令牌，默认值是 `run` |
| `TG_BOT_TOKEN` | ⚙️ 可选 | 🤖 Telegram Bot Token |
| `TG_CHAT_ID` | ⚙️ 可选 | 📩 接收 Telegram 通知的账户数字 ID |

3. 在 **触发事件** 里添加 `Cron 触发器` ，例如：

```text
0 */12 * * *
```

⏰ Worker 每次执行会把 `sleep_at` 续到当前 UTC 时间之后 71 小时，并校验 NVIDIA Air API 返回的 `sleep_at` 是否一致。

🔎 访问 Worker 根路径 `/` 只会检查变量是否已经准备就绪，不会执行续期。

🖱️ 手动触发续期需要访问 `/{TOKEN}`。如果没有配置 `TOKEN`，默认访问 `/run` 即可触发一次续期。

📩 如果同时配置了 `TG_BOT_TOKEN` 和 `TG_CHAT_ID`，每次续期成功或失败后都会发送 Telegram 通知。
