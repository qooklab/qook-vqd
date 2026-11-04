const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (id) =>
    Object.hasOwn(mocks, id)
      ? mocks[id]
      : ["./dart-errors", "@/lib/dart-errors"].includes(id)
        ? dartErrors
        : id === "./stocks"
          ? load("lib/stocks.ts")
          : original(id);
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const dartErrors = load("lib/dart-errors.ts");
const timing = load("lib/request-timeout.ts");
const policy = load("lib/refresh-policy.ts");
async function deadlineTest(task) {
  const keepAlive = setTimeout(() => {}, 200);
  try {
    return await task();
  } finally {
    clearTimeout(keepAlive);
  }
}
function stall(signal) {
  return new Promise((_, reject) =>
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    }),
  );
}

test("deadline includes response-body consumption and identifies the upstream stage", async () =>
  deadlineTest(async () => {
    await assert.rejects(
      timing.withUpstreamTimeout("DART 기업목록 조회", 10, async (signal) => {
        await Promise.resolve();
        return stall(signal);
      }),
      (e) =>
        e instanceof timing.UpstreamTimeoutError &&
        e.stage === "DART 기업목록 조회" &&
        !e.message.includes("http"),
    );
  }));
test("successful request and permanent errors are preserved", async () => {
  assert.equal(
    await timing.withUpstreamTimeout("DART", 100, async () => 42),
    42,
  );
  const error = new Error("DART 020: quota");
  await assert.rejects(
    timing.withUpstreamTimeout("DART", 100, async () => {
      throw error;
    }),
    (e) => e === error,
  );
});
test("timeouts are retryable, including old 502 responses and gateway HTML fallbacks", () => {
  for (const [status, message, code] of [
    [502, "The operation was aborted due to timeout"],
    [504, "gateway"],
    [524, "gateway"],
    [504, "DART timeout", "UPSTREAM_TIMEOUT"],
  ])
    assert.equal(policy.shouldRetryRefresh(status, message, code), true);
});
test("auth, validation and unavailable config are not retried", () => {
  for (const status of [400, 401, 403, 422])
    assert.equal(
      policy.shouldRetryRefresh(
        status,
        "timeout 時間 초과",
        "UPSTREAM_TIMEOUT",
        true,
      ),
      false,
    );
  assert.equal(policy.shouldRetryRefresh(503, "Supabase 환경변수 누락"), false);
  assert.equal(policy.shouldRetryRefresh(502, "DART 020: quota"), false);
  assert.equal(policy.shouldRetryRefresh(429, "limit"), true);
});
test("DART lookup and annual statements use labelled deadlines, never expose API keys", async () =>
  deadlineTest(async () => {
    const fetchBefore = global.fetch,
      keyBefore = process.env.DART_API_KEY;
    process.env.DART_API_KEY = "unit-test-key";
    const stages = [];
    global.fetch = async (_url, { signal }) => ({
      ok: true,
      arrayBuffer: () => stall(signal),
      json: () => stall(signal),
    });
    try {
      const dart = load("lib/dart.ts", {
        "./db": { db: () => null },
        "./request-timeout": {
          withUpstreamTimeout: (stage, ms, op) => {
            stages.push([stage, ms]);
            return timing.withUpstreamTimeout(stage, 10, op);
          },
        },
      });
      await assert.rejects(
        dart.findCorp("024110"),
        (e) =>
          e.stage === "DART 기업목록 조회" &&
          !e.message.includes("unit-test-key"),
      );
      await assert.rejects(dart.dartFinancials("00149646", 2025), (e) =>
        e.stage.includes("2025"),
      );
      assert.deepEqual(
        stages.map((x) => x[1]),
        [20000, 12000],
      );
    } finally {
      global.fetch = fetchBefore;
      if (keyBefore === undefined) delete process.env.DART_API_KEY;
      else process.env.DART_API_KEY = keyBefore;
    }
  }));
function cacheDb() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  };
}
test("financial statement timeout remains retryable instead of becoming permanent 422/no-score", async () => {
  const financial = load("lib/financial-score.ts", {
    "./db": { db: cacheDb },
    "./request-timeout": timing,
    "./dart": {
      findCorp: async () => "00149646",
      dartFinancials: async () => {
        throw new timing.UpstreamTimeoutError("DART 재무제표", 12000);
      },
    },
  });
  await assert.rejects(
    financial.financialScores("024110"),
    timing.UpstreamTimeoutError,
  );
});
test("permanent financial errors retain the no-score result", async () => {
  const financial = load("lib/financial-score.ts", {
    "./db": { db: cacheDb },
    "./request-timeout": timing,
    "./dart": {
      findCorp: async () => "00149646",
      dartFinancials: async () => {
        throw new Error("DART 013: no data");
      },
    },
  });
  const result = await financial.financialScores("024110");
  assert.match(result.note, /DART 013/);
  assert.equal(result.profit_score, undefined);
});
test("refresh route returns structured 504 and preserves authentication", async () => {
  const before = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";
  const route = load("app/api/refresh/route.ts", {
    "@/lib/stocks": {
      stocks: [
        ["기업은행", "024110"],
        ["기아", "000270"],
      ],
    },
    "@/lib/db": {
      db: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { code: "024110" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    },
    "@/lib/kis": {
      quote: async () => {
        throw new Error("must not request KIS in financial mode");
      },
    },
    "@/lib/financial-score": {
      financialScores: async () => {
        throw new timing.UpstreamTimeoutError("DART 기업목록 조회", 20000);
      },
    },
    "@/lib/request-timeout": timing,
  });
  const logBefore = console.error;
  console.error = () => {};
  try {
    let response = await route.POST(
      new Request("http://localhost/api/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "024110", mode: "financial" }),
      }),
    );
    assert.equal(response.status, 401);
    response = await route.POST(
      new Request("http://localhost/api/refresh", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "024110", mode: "financial" }),
      }),
    );
    assert.equal(response.status, 504);
    const body = await response.json();
    assert.equal(body.code, "UPSTREAM_TIMEOUT");
    assert.equal(body.retryable, true);
    assert.match(body.error, /DART 기업목록/);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    console.error = logBefore;
    if (before === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = before;
  }
});

test("bank scoring remains unchanged when statements arrive successfully", async () => {
  let saved;
  const y = new Date().getUTCFullYear() - 1;
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: async (value) => {
        saved = value;
        return { error: null };
      },
    }),
  };
  const financial = load("lib/financial-score.ts", {
    "./db": { db: () => db },
    "./request-timeout": timing,
    "./dart": {
      findCorp: async () => "00149646",
      dartFinancials: async (_corp, year) => [
        {
          sj_div: "IS",
          account_id: "dart_OperatingIncomeLoss",
          account_nm: "영업이익",
          thstrm_amount: String([100, 150, 200][year - (y - 2)]),
        },
      ],
    },
  });
  const result = await financial.financialScores("024110");
  assert.equal(result.profit_score, 10);
  assert.equal(result.growth_score, 10);
  assert.equal(result.balance_score, undefined);
  assert.equal(saved.balance_score, null);
});

function manualHarness(responses, selected = ["024110"]) {
  let index = 0,
    calls = 0,
    refreshes = 0;
  const state = [selected, "test-secret", false, "", 0, [], ""];
  const mocks = {
    react: {
      useState: (initial) => {
        const i = index++;
        if (i >= state.length) state[i] = initial;
        return [
          state[i],
          (value) => {
            state[i] = typeof value === "function" ? value(state[i]) : value;
          },
        ];
      },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => refreshes++ }) },
    "@/lib/stocks": { stocks: [["기업은행", "024110"]] },
    "@/lib/refresh-policy": policy,
  };
  const filename = path.resolve(__dirname, "../app/manual-refresh.tsx");
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = (id) => (Object.hasOwn(mocks, id) ? mocks[id] : original(id));
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  m._compile(
    "const setTimeout=callback=>{callback();};\n" + compiled,
    filename,
  );
  const tree = m.exports.default();
  function find(node) {
    if (!node || typeof node !== "object") return null;
    if (
      node.type === "button" &&
      node.props.children === "DART 재무정보 가져오기"
    )
      return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  }
  const button = find(tree);
  assert.ok(button);
  return {
    state,
    run: button.props.onClick,
    fetch: async () => {
      const response = responses[Math.min(calls++, responses.length - 1)];
      return new Response(JSON.stringify(response.body), {
        status: response.status,
      });
    },
    get calls() {
      return calls;
    },
    get refreshes() {
      return refreshes;
    },
  };
}
test("manual refresh retries timeout twice, then succeeds and updates progress", async () => {
  const before = global.fetch;
  const h = manualHarness([
    {
      status: 504,
      body: {
        error: "DART 기업목록 응답 시간 초과",
        code: "UPSTREAM_TIMEOUT",
        retryable: true,
      },
    },
    {
      status: 504,
      body: {
        error: "DART 기업목록 응답 시간 초과",
        code: "UPSTREAM_TIMEOUT",
        retryable: true,
      },
    },
    { status: 200, body: { ok: true } },
  ]);
  global.fetch = h.fetch;
  try {
    await h.run();
    assert.equal(h.calls, 3);
    assert.equal(h.state[5][0].ok, true);
    assert.equal(h.state[4], 1);
    assert.equal(h.state[2], false);
    assert.equal(h.refreshes, 1);
  } finally {
    global.fetch = before;
  }
});
test("persistent timeout is bounded to three attempts and reports failure", async () => {
  const before = global.fetch;
  const h = manualHarness([
    {
      status: 504,
      body: {
        error: "DART 응답 시간 초과",
        code: "UPSTREAM_TIMEOUT",
        retryable: true,
      },
    },
  ]);
  global.fetch = h.fetch;
  try {
    await h.run();
    assert.equal(h.calls, 3);
    assert.equal(h.state[5][0].ok, false);
    assert.match(h.state[5][0].error, /자동 재시도 후 실패/);
    assert.equal(h.state[2], false);
  } finally {
    global.fetch = before;
  }
});
test("manual authentication failure is not retried", async () => {
  const before = global.fetch;
  const h = manualHarness([{ status: 401, body: { error: "인증 실패" } }]);
  global.fetch = h.fetch;
  try {
    await h.run();
    assert.equal(h.calls, 1);
    assert.equal(h.state[5][0].ok, false);
  } finally {
    global.fetch = before;
  }
});

test("DART key or quota failure stops remaining selected stocks immediately", async () => {
  const before = global.fetch;
  const h = manualHarness(
    [
      {
        status: 502,
        body: {
          error: "DART [020]: 요청 한도 초과",
          retryable: false,
          stopBatch: true,
        },
      },
    ],
    ["024110", "000270"],
  );
  global.fetch = h.fetch;
  try {
    await h.run();
    assert.equal(h.calls, 1);
    assert.equal(h.state[5].length, 1);
    assert.equal(h.state[4], 1);
  } finally {
    global.fetch = before;
  }
});
