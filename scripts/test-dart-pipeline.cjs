const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const { deflateRawSync } = require("node:zlib");
function load(file, mocks = {}) {
  const f = path.resolve(__dirname, "..", file),
    m = new Module(f, module);
  m.filename = f;
  m.paths = Module._nodeModulePaths(path.dirname(f));
  const req = m.require.bind(m);
  m.require = (id) =>
    Object.hasOwn(mocks, id)
      ? mocks[id]
      : id === "./dart-corp-codes"
        ? { verifiedCorpCodes: {} }
        : id === "./stocks"
          ? load("lib/stocks.ts")
          : req(id);
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    f,
  );
  return m.exports;
}
const errors = load("lib/dart-errors.ts");
const timing = load("lib/request-timeout.ts");
function zip(xml) {
  const name = Buffer.from("CORPCODE.xml"),
    plain = Buffer.from(xml),
    body = deflateRawSync(plain),
    local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(plain.length, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(plain.length, 24);
  central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, end]);
}
function corpXml(spaces = false) {
  return (
    "<result>" +
    Array.from(
      { length: 101 },
      (_, i) =>
        `<list><corp_code>${spaces ? " " : ""}${String(10000000 + i)}${spaces ? " " : ""}</corp_code><stock_code>${spaces ? " " : ""}${i === 0 ? "024110" : String(100000 + i)}${spaces ? " " : ""}</stock_code></list>`,
    ).join("") +
    "</result>"
  );
}
function fakeDb(cached = null) {
  const writes = [];
  return {
    writes,
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: cached, error: null }),
        }),
      }),
      upsert: async (value) => {
        writes.push({ table, value });
        return { error: null };
      },
    }),
  };
}
function financial(db, dart) {
  return load("lib/financial-score.ts", {
    "./db": { db: () => db },
    "./dart": dart,
    "./request-timeout": timing,
    "./dart-errors": errors,
  });
}
function profitRows(name = "영업이익", id = "dart_OperatingIncomeLoss") {
  return [
    { sj_div: "IS", account_id: id, account_nm: name, thstrm_amount: "100" },
  ];
}

test("invalid corp archive must not poison future lookups", async () => {
  const before = global.fetch,
    key = process.env.DART_API_KEY;
  process.env.DART_API_KEY = "test-key";
  let calls = 0;
  global.fetch = async () =>
    new Response(zip(calls++ === 0 ? "<result/>" : corpXml()));
  try {
    const d = load("lib/dart.ts", {
      "./db": { db: () => null },
      "./request-timeout": timing,
      "./dart-errors": errors,
    });
    await assert.rejects(d.findCorp("024110"));
    assert.equal(await d.findCorp("024110"), "10000000");
    assert.equal(calls, 2);
  } finally {
    global.fetch = before;
    if (key === undefined) delete process.env.DART_API_KEY;
    else process.env.DART_API_KEY = key;
  }
});
test("corp mapping accepts surrounding XML whitespace", async () => {
  const before = global.fetch,
    key = process.env.DART_API_KEY;
  process.env.DART_API_KEY = "test-key";
  global.fetch = async () => new Response(zip(corpXml(true)));
  try {
    const d = load("lib/dart.ts", {
      "./db": { db: () => null },
      "./request-timeout": timing,
      "./dart-errors": errors,
    });
    assert.equal(await d.findCorp("024110"), "10000000");
  } finally {
    global.fetch = before;
    if (key === undefined) delete process.env.DART_API_KEY;
    else process.env.DART_API_KEY = key;
  }
});
test("all-null cached result must be fetched again", async () => {
  const db = fakeDb({
    checked_at: new Date().toISOString(),
    profit_score: null,
    balance_score: null,
    growth_score: null,
    note: "계정과목 누락",
  });
  let calls = 0;
  const f = financial(db, {
    findCorp: async () => "10000000",
    dartFinancials: async () => {
      calls++;
      return profitRows();
    },
  });
  assert.equal((await f.financialScores("024110")).profit_score, 10);
  assert.equal(calls, 3);
});
test("OFS-only company is assessed with one consistent basis for all three years", async () => {
  const calls = [];
  const f = financial(fakeDb(), {
    findCorp: async () => "10000000",
    dartFinancials: async (_corp, year, _report, division = "CFS") => {
      calls.push([year, division]);
      if (division === "CFS") throw new errors.DartApiError("DART", "013");
      return profitRows();
    },
  });
  const result = await f.financialScores("024110");
  assert.equal(result.profit_score, 10);
  assert.match(result.note, /별도/);
  assert.equal(calls.filter((x) => x[1] === "OFS").length, 3);
});
test("nonstandard operating-profit names with spaces are recognized", async () => {
  const f = financial(fakeDb(), {
    findCorp: async () => "10000000",
    dartFinancials: async () =>
      profitRows("영업 이익 (손실)", "-표준계정코드 미사용-"),
  });
  assert.equal((await f.financialScores("024110")).profit_score, 10);
});

test("bulk corp cache includes registered tickers and preferred shares", async () => {
  const before = global.fetch,
    key = process.env.DART_API_KEY;
  process.env.DART_API_KEY = "test-key";
  const db = fakeDb();
  global.fetch = async () =>
    new Response(
      zip(
        corpXml().replace(
          "<stock_code>100001</stock_code>",
          "<stock_code>005930</stock_code>",
        ),
      ),
    );
  try {
    const d = load("lib/dart.ts", {
      "./db": { db: () => db },
      "./request-timeout": timing,
      "./dart-errors": errors,
    });
    await d.findCorp("024110");
    const batch = db.writes.find((x) => Array.isArray(x.value)).value;
    assert.equal(
      batch.find((x) => x.stock_code === "024110").corp_code,
      "10000000",
    );
    assert.equal(
      batch.find((x) => x.stock_code === "005935").corp_code,
      batch.find((x) => x.stock_code === "005930").corp_code,
    );
  } finally {
    global.fetch = before;
    if (key === undefined) delete process.env.DART_API_KEY;
    else process.env.DART_API_KEY = key;
  }
});
test("missing DART key is an actionable configuration error", async () => {
  const key = process.env.DART_API_KEY;
  delete process.env.DART_API_KEY;
  try {
    const d = load("lib/dart.ts", {
      "./db": { db: () => null },
      "./request-timeout": timing,
      "./dart-errors": errors,
    });
    await assert.rejects(
      d.findCorp("024110"),
      (e) =>
        e.status === "CONFIG" &&
        e.stopBatch &&
        e.message.includes("DART_API_KEY"),
    );
  } finally {
    if (key !== undefined) process.env.DART_API_KEY = key;
  }
});
test("DART rejects malformed success payload and respects the requested basis", async () => {
  const before = global.fetch,
    key = process.env.DART_API_KEY;
  process.env.DART_API_KEY = "test-key";
  const divisions = [];
  let valid = false;
  global.fetch = async (url) => {
    divisions.push(new URL(url).searchParams.get("fs_div"));
    return Response.json(
      valid ? { status: "000", list: profitRows() } : { status: "000" },
    );
  };
  try {
    const d = load("lib/dart.ts", {
      "./db": { db: () => null },
      "./request-timeout": timing,
      "./dart-errors": errors,
    });
    await assert.rejects(
      d.dartFinancials("10000000", 2025, "11011", "OFS"),
      (e) => e.status === "INVALID_RESPONSE",
    );
    valid = true;
    assert.equal(
      (await d.dartFinancials("10000000", 2025, "11011", "OFS")).length,
      1,
    );
    assert.deepEqual(divisions, ["OFS", "OFS"]);
  } finally {
    global.fetch = before;
    if (key === undefined) delete process.env.DART_API_KEY;
    else process.env.DART_API_KEY = key;
  }
});
test("key errors do not trigger OFS fallback or cache a failed result", async () => {
  const db = fakeDb(),
    calls = [];
  const f = financial(db, {
    findCorp: async () => "10000000",
    dartFinancials: async (_c, _y, _r, division) => {
      calls.push(division);
      throw new errors.DartApiError("DART", "010");
    },
  });
  await assert.rejects(
    f.financialScores("024110"),
    (e) => e.status === "010" && e.stopBatch,
  );
  assert.deepEqual(calls, ["CFS", "CFS", "CFS"]);
  assert.equal(db.writes.length, 0);
});
test("zero-valued scores in a current valid cache are reused", async () => {
  const y = new Date().getUTCFullYear() - 1;
  const db = fakeDb({
    checked_at: new Date().toISOString(),
    profit_score: 0,
    growth_score: 0,
    balance_score: null,
    note: `[dart-score-v2:${y}] 연결 사업보고서`,
  });
  const f = financial(db, {
    findCorp: async () => {
      throw Error("unexpected fetch");
    },
  });
  const result = await f.financialScores("024110");
  assert.equal(result.profit_score, 0);
  assert.match(result.note, /캐시 재사용/);
  assert.ok(!result.note.includes("[dart-score"));
});
test("blank amounts are missing data, never zero scores or a seven-day negative cache", async () => {
  const db = fakeDb();
  const f = financial(db, {
    findCorp: async () => "10000000",
    dartFinancials: async () => [{ ...profitRows()[0], thstrm_amount: "  " }],
  });
  const result = await f.financialScores("024110");
  assert.equal(result.profit_score, undefined);
  assert.equal(result.growth_score, undefined);
  assert.equal(db.writes.length, 0);
});
test("parenthesized loss is negative, not a missing or positive amount", async () => {
  const y = new Date().getUTCFullYear() - 1;
  const f = financial(fakeDb(), {
    findCorp: async () => "10000000",
    dartFinancials: async (_c, year) => [
      { ...profitRows()[0], thstrm_amount: year === y ? "(50)" : "100" },
    ],
  });
  const result = await f.financialScores("024110");
  assert.equal(result.profit_score, 6);
  assert.equal(result.growth_score, 0);
});
async function withRoute(scores, task) {
  const key = process.env.CRON_SECRET,
    log = console.error;
  process.env.CRON_SECRET = "test-secret";
  console.error = () => {};
  const writes = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { code: "024110" }, error: null }),
        }),
      }),
      update: (value) => ({
        eq: async () => {
          writes.push(value);
          return { error: null };
        },
      }),
    }),
  };
  const route = load("app/api/refresh/route.ts", {
    "@/lib/stocks": { stocks: [["기업은행", "024110"]] },
    "@/lib/db": { db: () => client },
    "@/lib/kis": {
      quote: async () => {
        throw Error("KIS must not be called");
      },
    },
    "@/lib/financial-score": { financialScores: scores },
    "@/lib/request-timeout": timing,
    "@/lib/dart-errors": errors,
  });
  try {
    const response = await route.POST(
      new Request("http://localhost/api/refresh", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "024110", mode: "financial" }),
      }),
    );
    await task(response, writes);
  } finally {
    console.error = log;
    if (key === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = key;
  }
}
test("permanent DART errors retain provider status and stop the batch", async () =>
  withRoute(
    async () => {
      throw new errors.DartApiError("DART 기업목록 조회", "012");
    },
    async (response) => {
      assert.equal(response.status, 502);
      const body = await response.json();
      assert.equal(body.dartStatus, "012");
      assert.equal(body.stopBatch, true);
      assert.equal(body.retryable, false);
      assert.match(body.error, /IP/);
    },
  ));
test("successful recalculation clears previously stored scores that are now unassessable", async () =>
  withRoute(
    async () => ({ profit_score: 10, note: "DART 연결 3개년 기준" }),
    async (response, writes) => {
      assert.equal(response.status, 200);
      assert.deepEqual(writes, [
        { profit_score: 10, balance_score: null, growth_score: null },
      ]);
      const body = await response.json();
      assert.deepEqual(body.updatedFields, ["profit_score"]);
      assert.deepEqual(body.clearedFields, ["balance_score", "growth_score"]);
    },
  ));

test("a timeout mixed with a missing CFS year stays retryable without mixing reporting bases", async () => {
  const y = new Date().getUTCFullYear() - 1,
    calls = [];
  const f = financial(fakeDb(), {
    findCorp: async () => "10000000",
    dartFinancials: async (_c, year, _r, basis) => {
      calls.push(basis);
      if (year === y - 2) throw new errors.DartApiError("DART", "013");
      if (year === y - 1) throw new timing.UpstreamTimeoutError("DART", 12000);
      return profitRows();
    },
  });
  await assert.rejects(
    f.financialScores("024110"),
    timing.UpstreamTimeoutError,
  );
  assert.deepEqual(calls, ["CFS", "CFS", "CFS"]);
});

test("every registered stock bypasses full-directory downloads and database lookup", async () => {
  const before = global.fetch;
  global.fetch = async () => {
    throw Error("Full directory must not be requested");
  };
  try {
    const codes = load("lib/dart-corp-codes.ts");
    const d = load("lib/dart.ts", {
      "./db": {
        db: () => {
          throw Error("Bundled issuer IDs must not require database lookup");
        },
      },
      "./request-timeout": timing,
      "./dart-errors": errors,
      "./dart-corp-codes": codes,
    });
    for (const [, ticker] of load("lib/stocks.ts").stocks) {
      const id = await d.findCorp(ticker);
      assert.match(id, /^\d{8}$/);
      assert.equal(id, codes.verifiedCorpCodes[ticker]);
    }
    assert.equal(await d.findCorp("000270"), "00106641");
    assert.equal(await d.findCorp("024110"), "00149646");
    assert.equal(await d.findCorp("005935"), await d.findCorp("005930"));
  } finally {
    global.fetch = before;
  }
});
test("bundled issuer IDs match the saved FSS exact-ticker verification snapshot", () => {
  const snapshot = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../docs/data/dart-corp-codes.json"),
      "utf8",
    ),
  );
  const codes = load("lib/dart-corp-codes.ts").verifiedCorpCodes;
  assert.equal(snapshot.entries.length, load("lib/stocks.ts").stocks.length);
  for (const item of snapshot.entries) {
    assert.equal(codes[item.stockCode], item.corpCode);
    assert.equal(new URL(item.source).hostname, "dart.fss.or.kr");
    assert.equal(
      new URL(item.source).searchParams.get("textCrpNm"),
      item.issuerStockCode || item.stockCode,
    );
  }
});
