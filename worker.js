const NVIDIA_AIR_API_BASE = "https://api.air-ngc.nvidia.com/api/v3";
const 续期小时数 = 71;

const Air请求头 = {
	Accept: "application/json",
	"Content-Type": "application/json",
	"User-Agent": "air-sdk/1.3.1",
	"X-Air-Sdk-Version": "1.3.1",
};

export default {
	async fetch(请求, 环境) {
		if (!["GET", "POST"].includes(请求.method)) {
			return 返回Json({ ok: false, error: "Method not allowed" }, 405);
		}

		try {
			const 续期结果 = await 续期仿真(环境);
			return 返回Json({ ok: true, ...续期结果 });
		} catch (错误) {
			return 返回Json({ ok: false, error: 错误.message }, 500);
		}
	},

	async scheduled(_事件, 环境, 上下文) {
		上下文.waitUntil(
			续期仿真(环境)
				.then((续期结果) => console.log("NVIDIA Air renewed", 续期结果))
				.catch((错误) => console.error("NVIDIA Air renew failed", 错误)),
		);
	},
};

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

function 读取必填变量(环境, 变量名) {
	const 变量值 = 环境?.[变量名];
	if (typeof 变量值 !== "string" || 变量值.trim() === "") {
		throw new Error(`Missing required environment variable: ${变量名}`);
	}
	return 变量值.trim();
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
