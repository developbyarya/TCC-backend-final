#!/usr/bin/env node

const { randomUUID } = require("crypto");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DRY_RUN = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

const COLLECTOR_COUNT = Number(process.env.COLLECTOR_COUNT || 5);
const ARTWORK_COUNT = Number(process.env.ARTWORK_COUNT || 5);

const SENIMAN_USER = {
  username: process.env.SENIMAN_USERNAME || "artsist-tampan-nan-baik-hati",
  email: process.env.SENIMAN_EMAIL || "grdv@example.com",
  password: process.env.SENIMAN_PASSWORD || "secret123",
};

const log = {
  info: (msg) => console.log(`\n[stress] ${msg}`),
  step: (msg) => console.log(`[stress] • ${msg}`),
  warn: (msg) => console.warn(`[stress][warn] ${msg}`),
};

const mockId = () => `dry-${randomUUID()}`;

const mockResponse = (path) => {
  if (path.includes("/karya-seni/create")) {
    return { id: mockId() };
  }
  if (path.includes("/user/register")) {
    return { id: mockId() };
  }
  return { id: mockId() };
};

const api = async (path, { method = "GET", token, body, headers } = {}) => {
  if (DRY_RUN) {
    log.step(`DRY RUN ${method} ${path}`);
    return { status: 200, data: mockResponse(path) };
  }

  const url = `${BASE_URL}${path}`;
  const requestHeaders = new Headers(headers || {});
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const init = { method, headers: requestHeaders };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body) {
    requestHeaders.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!res.ok) {
    const message = data?.message || data || res.statusText;
    throw new Error(`${method} ${path} failed (${res.status}): ${message}`);
  }

  return { status: res.status, data };
};

const loginSeniman = async () => {
  const { data } = await api("/user/login", {
    method: "POST",
    body: {
      username: SENIMAN_USER.username,
      email: SENIMAN_USER.email,
      password: SENIMAN_USER.password,
    },
  });
  return data.token;
};

const createCollectorPayload = (index) => {
  const uuid = randomUUID().slice(0, 8);
  return {
    username: `collector-${index + 1}-${uuid}`,
    full_name: `Stress Collector ${index + 1}`,
    email: `collector-${uuid}@example.com`,
    phone_number: `08${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: `stress-${uuid}`,
    role: "KOLEKTOR",
  };
};

const createArtworkPayload = (index) => {
  const now = new Date();
  const open = new Date(now.getTime() + index * 60 * 1000);
  const close = new Date(now.getTime() + (index + 60) * 60 * 1000);

  return {
    nama_karya: "STRESS TEST",
    deskripsi: `Stress test artwork ${index + 1}`,
    katalog: index % 2 === 0 ? "Modern" : "Classic",
    tags: "stress,test",
    min_bid_ammount: 1000 + index * 100,
    open_bid_time: open.toISOString(),
    close_bid_time: close.toISOString(),
  };
};

const main = async () => {
  log.info(`Starting stress seed flow (base: ${BASE_URL})`);

  if (!DRY_RUN) {
    await api("/health");
    log.step("Health check passed");
  } else {
    log.step("DRY RUN health check skipped");
  }

  const newUsers = [];
  for (let i = 0; i < COLLECTOR_COUNT; i += 1) {
    const payload = createCollectorPayload(i);
    await api("/user/register", { method: "POST", body: payload });
    newUsers.push({ username: payload.username, password: payload.password });
    log.step(`Created collector ${payload.username}`);
  }

  const senimanToken = await loginSeniman();
  log.step("Logged in seniman user");

  const artworkIds = [];
  for (let i = 0; i < ARTWORK_COUNT; i += 1) {
    const { data } = await api("/karya-seni/create", {
      method: "POST",
      token: senimanToken,
      body: createArtworkPayload(i),
    });
    artworkIds.push(data.id);
    log.step(`Created artwork ${data.id}`);
  }

  console.log("\n[stress] New collectors:", newUsers);
  console.log("[stress] New artwork IDs:", artworkIds);

  log.info("Stress seed flow completed successfully.");
  if (DRY_RUN) {
    log.warn("DRY RUN mode: no HTTP requests were sent.");
  }
};

main().catch((error) => {
  console.error("\n[stress][error]", error.message);
  process.exit(1);
});
