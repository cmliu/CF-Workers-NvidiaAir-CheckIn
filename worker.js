const NVIDIA_AIR_API_BASE = "https://api.air-ngc.nvidia.com/api/v3";
const 续期小时数 = 71;

const Air请求头 = {
	Accept: "application/json",
	"Content-Type": "application/json",
	"User-Agent": "air-sdk/2.21.0",
	"X-Air-Sdk-Version": "2.21.0",
};

export default {
	async fetch(请求, 环境) {
		if (!["GET", "POST"].includes(请求.method)) {
			return 返回Json({ ok: false, error: "Method not allowed" }, 405);
		}

		const 网址 = new URL(请求.url);
		if (网址.pathname === "/") {
			return 返回Json(获取准备状态(环境));
		}

		const 路径令牌 = 读取路径令牌(网址.pathname);
		const 触发令牌 = 读取触发令牌(环境);
		if (路径令牌 !== 触发令牌) {
			return 返回Json({ ok: false, error: "Not found" }, 404);
		}

		try {
			const 执行结果 = await 执行续期并通知(环境, "手动触发");
			return 返回Json({ ok: true, ...执行结果.续期结果, notification: 执行结果.通知结果 });
		} catch (错误) {
			return 返回Json({ ok: false, error: 错误.message, notification: 错误.notification }, 500);
		}
	},

	async scheduled(_事件, 环境, 上下文) {
		上下文.waitUntil(
			执行续期并通知(环境, "定时任务")
				.then((执行结果) => console.log("NVIDIA Air renewed", 执行结果))
				.catch((错误) => console.error("NVIDIA Air renew failed", 错误)),
		);
	},
};

function 获取准备状态(环境) {
	const 变量状态 = {
		NVIDIA_AIR_API_KEY: 变量是否存在(环境, "NVIDIA_AIR_API_KEY"),
		SIMULATION_ID: 变量是否存在(环境, "SIMULATION_ID"),
		TOKEN: 变量是否存在(环境, "TOKEN"),
		TG_BOT_TOKEN: 变量是否存在(环境, "TG_BOT_TOKEN"),
		TG_CHAT_ID: 变量是否存在(环境, "TG_CHAT_ID"),
	};
	const 已准备就绪 = 变量状态.NVIDIA_AIR_API_KEY && 变量状态.SIMULATION_ID;
	const 通知已启用 = 变量状态.TG_BOT_TOKEN && 变量状态.TG_CHAT_ID;

	return {
		ok: 已准备就绪,
		ready: 已准备就绪,
		message: 已准备就绪 ? "准备就绪" : "缺少必要变量",
		variables: 变量状态,
		token_default_used: !变量状态.TOKEN,
		manual_trigger_path: 变量状态.TOKEN ? "/<TOKEN>" : "/run",
		telegram_notification: 通知已启用 ? "enabled" : "disabled",
	};
}

async function 执行续期并通知(环境, 触发方式) {
	try {
		const 续期结果 = await 续期仿真(环境);
		const 通知结果 = await 发送签到通知(环境, { 成功: true, 触发方式, 续期结果 });
		return { 续期结果, 通知结果 };
	} catch (错误) {
		错误.notification = await 发送签到通知(环境, { 成功: false, 触发方式, 错误 });
		throw 错误;
	}
}

async function 续期仿真(环境) {
	const NVIDIA_AIR_API_KEY = 读取必填变量(环境, "NVIDIA_AIR_API_KEY");
	const SIMULATION_ID = 读取必填变量(环境, "SIMULATION_ID");

	const 目标休眠时间 = 转成Utc秒字符串(Date.now() + 续期小时数 * 60 * 60 * 1000);
	const 仿真地址 = `${NVIDIA_AIR_API_BASE}/simulations/${encodeURIComponent(SIMULATION_ID)}/`;
	const 请求头 = {
		...Air请求头,
		Authorization: `Bearer ${NVIDIA_AIR_API_KEY}`,
	};

	const 续期前 = await 请求Air接口(仿真地址, { method: "GET", headers: 请求头 }, "get simulation");

	const 续期后 = await 请求Air接口(
		仿真地址,
		{
			method: "PATCH",
			headers: 请求头,
			body: JSON.stringify({ sleep_at: 目标休眠时间 }),
		},
		"renew simulation",
	);

	if (续期后.sleep_at !== 目标休眠时间) {
		throw new Error(`verify failed: expected=${目标休眠时间} actual=${续期后.sleep_at ?? "null"}`);
	}

	return {
		simulation_id: SIMULATION_ID,
		before_sleep_at: 续期前.sleep_at ?? null,
		after_sleep_at: 续期后.sleep_at,
		target_sleep_at: 目标休眠时间,
	};
}

async function 请求Air接口(地址, 请求配置, 操作名称) {
	const 响应 = await fetch(地址, 请求配置);
	const 响应文本 = await 响应.text();
	const 响应数据 = 解析Json(响应文本);

	if (!响应.ok) {
		const 错误信息 = 响应数据?.detail || 响应数据?.message || 响应数据?.error || 响应文本 || 响应.statusText;
		throw new Error(`${操作名称} failed: HTTP ${响应.status} ${错误信息}`);
	}

	if (!响应数据 || typeof 响应数据 !== "object") {
		throw new Error(`${操作名称} failed: invalid JSON response`);
	}

	return 响应数据;
}

async function 发送签到通知(环境, 通知内容) {
	if (!变量是否存在(环境, "TG_BOT_TOKEN") || !变量是否存在(环境, "TG_CHAT_ID")) {
		return { enabled: false };
	}

	const 机器人Token = 环境.TG_BOT_TOKEN.trim();
	const 接收者ID = 环境.TG_CHAT_ID.trim();
	const 通知文本 = 生成通知文本({
		...通知内容,
		仿真编号: 环境?.SIMULATION_ID?.trim() || "未知",
	});

	try {
		const 响应 = await fetch(`https://api.telegram.org/bot${机器人Token}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: 接收者ID,
				text: 通知文本,
				parse_mode: "Markdown",
				disable_web_page_preview: true,
			}),
		});
		const 响应文本 = await 响应.text();
		const 响应数据 = 解析Json(响应文本);

		if (!响应.ok || 响应数据?.ok === false) {
			return {
				enabled: true,
				ok: false,
				error: 响应数据?.description || 响应文本 || 响应.statusText,
			};
		}

		return { enabled: true, ok: true };
	} catch (错误) {
		return { enabled: true, ok: false, error: 错误.message };
	}
}

function 生成通知文本(通知内容) {
	if (通知内容.成功) {
		const 结果 = 通知内容.续期结果;
		return [
			"*✅ #NVIDIA_Air #自动续期成功*",
			`*续期方式*: ${通知内容.触发方式}`,
			`*续期时间*: ${续期小时数} 小时`,
			`*SimulationID*: \`${转义Markdown代码(结果.simulation_id)}\``,
			`*续期前*: ${格式化东八区时间(结果.before_sleep_at)}`,
			`*续期后*: ${格式化东八区时间(结果.after_sleep_at)}`,
			`*目标时间*: ${格式化东八区时间(结果.target_sleep_at)}`,
		].join("\n");
	}

	return [
		"*❌ #NVIDIA_Air #自动续期失败*",
		`*续期方式*: ${通知内容.触发方式}`,
		`*续期时间*: ${续期小时数} 小时`,
		`*SimulationID*: \`${转义Markdown代码(通知内容.仿真编号)}\``,
		`*错误信息*: ${限制文本长度(转义Markdown文本(通知内容.错误.message || String(通知内容.错误)), 1200)}`,
	].join("\n");
}

function 格式化东八区时间(值) {
	if (!值) {
		return "未知";
	}

	const 时间戳 = Date.parse(值);
	if (Number.isNaN(时间戳)) {
		return 转义Markdown文本(String(值));
	}

	const 东八区时间 = new Date(时间戳 + 8 * 60 * 60 * 1000);
	const 年 = 东八区时间.getUTCFullYear();
	const 月 = 补零(东八区时间.getUTCMonth() + 1);
	const 日 = 补零(东八区时间.getUTCDate());
	const 时 = 补零(东八区时间.getUTCHours());
	const 分 = 补零(东八区时间.getUTCMinutes());
	const 秒 = 补零(东八区时间.getUTCSeconds());
	return `${年}-${月}-${日} ${时}:${分}:${秒} UTC+8`;
}

function 补零(数字) {
	return String(数字).padStart(2, "0");
}

function 转义Markdown代码(文本) {
	return String(文本).replace(/[`\\]/g, "\\$&");
}

function 转义Markdown文本(文本) {
	return String(文本).replace(/([_*`[])/g, "\\$1");
}

function 限制文本长度(文本, 最大长度) {
	if (文本.length <= 最大长度) {
		return 文本;
	}
	return `${文本.slice(0, 最大长度)}...`;
}

function 读取必填变量(环境, 变量名) {
	const 变量值 = 环境?.[变量名];
	if (typeof 变量值 !== "string" || 变量值.trim() === "") {
		throw new Error(`Missing required environment variable: ${变量名}`);
	}
	return 变量值.trim();
}

function 读取触发令牌(环境) {
	const 变量值 = 环境?.TOKEN;
	if (typeof 变量值 !== "string" || 变量值.trim() === "") {
		return "run";
	}
	return 变量值.trim();
}

function 读取路径令牌(路径) {
	if (!路径 || 路径 === "/") {
		return "";
	}
	const 去掉首尾斜杠 = 路径.replace(/^\/+|\/+$/g, "");
	if (去掉首尾斜杠.includes("/")) {
		return "";
	}
	return decodeURIComponent(去掉首尾斜杠);
}

function 变量是否存在(环境, 变量名) {
	const 变量值 = 环境?.[变量名];
	return typeof 变量值 === "string" && 变量值.trim() !== "";
}

function 转成Utc秒字符串(时间戳) {
	return new Date(时间戳).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function 解析Json(文本) {
	try {
		return 文本 ? JSON.parse(文本) : null;
	} catch {
		return null;
	}
}

function 返回Json(响应体, 状态码 = 200) {
	return new Response(JSON.stringify(响应体, null, 2), {
		status: 状态码,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}
