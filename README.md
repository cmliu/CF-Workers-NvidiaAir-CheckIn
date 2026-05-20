# CF-Workers-NvidiaAir-CheckIn

Cloudflare Workers 版本的 NVIDIA Air 自动续期脚本。

## 使用

1. 在 Cloudflare Workers 新建 Worker，把 `worker.js` 的内容粘贴进去。
2. 在 Worker 的 `Settings` -> `Variables` 里添加变量：

| 变量名 | 说明 |
| --- | --- |
| `NVIDIA_AIR_API_KEY` | NVIDIA NGC / Air API Key |
| `SIMULATION_ID` | 需要续期的 NVIDIA Air Simulation ID |
| `TOKEN` | 手动触发续期的访问令牌，默认值是 `run` |

3. 在 `Triggers` 里添加 Cron Trigger，例如：

```text
0 */12 * * *
```

Worker 每次执行会把 `sleep_at` 续到当前 UTC 时间之后 71 小时，并校验 NVIDIA Air API 返回的 `sleep_at` 是否一致。

访问 Worker 根路径 `/` 只会检查变量是否已经准备就绪，不会执行续期。

手动触发续期需要访问 `/{TOKEN}`。如果没有配置 `TOKEN`，默认访问 `/run` 即可触发一次续期。
