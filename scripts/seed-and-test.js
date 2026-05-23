#!/usr/bin/env node

const { randomUUID } = require("crypto");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DRY_RUN = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

const getArgValue = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  if (!arg) return undefined;
  return arg.slice(prefix.length);
};

const ARTWORK_COUNT = Number(process.env.ARTWORK_COUNT || getArgValue("artwork-count") || 5);
const CLOSE_BID_MONTHS = Number(process.env.CLOSE_BID_MONTHS || getArgValue("close-bid-months") || 0);
const CLOSE_BID_DAYS = Number(process.env.CLOSE_BID_DAYS || getArgValue("close-bid-days") || 0);
const WALLET_TOPUP = Number(process.env.WALLET_TOPUP || getArgValue("wallet-topup") || 1000000);

const USERS = [
  {
    key: "artist",
    username: "artsist-tampan-nan-baik-hati",
    full_name: "Gradiva",
    email: "grdv@example.com",
    phone_number: "0811111111",
    password: "secret123",
    role: "SENIMAN",
    alt_name: "Artist tampan",
  },
  {
    key: "curator",
    username: "david",
    full_name: "M David",
    email: "david@example.com",
    phone_number: "0822222222",
    password: "secret123",
    role: "KURATOR",
    alt_name: "Anon Curator",
  },
  {
    key: "collector",
    username: "Reza",
    full_name: "Reza Demo",
    email: "reza@example.com",
    phone_number: "0833333333",
    password: "secret123",
    role: "KOLEKTOR",
    alt_name: "Anon Collector",
  },
];

const log = {
  info: (msg) => console.log(`\n[seed] ${msg}`),
  step: (msg) => console.log(`[seed] • ${msg}`),
  warn: (msg) => console.warn(`[seed][warn] ${msg}`),
};

const mockId = () => `dry-${randomUUID()}`;

const mockResponse = (path) => {
  if (path.includes("/karya-seni/create")) {
    return { id: mockId() };
  }
  if (path.includes("/bid/new")) {
    return { id: mockId() };
  }
  if (path.includes("/notification")) {
    return [
      {
        id: mockId(),
        message: "Mock notification: your bid was outbid.",
      },
    ];
  }
  if (path.includes("/payments")) {
    return { id: mockId() };
  }
  if (path.includes("/karya-seni/") && path.endsWith("/image")) {
    return {
      artwork: { id: mockId() },
      image_url: "https://picsum.photos/seed/dryrun/600/400",
      gs_uri: "gs://dryrun",
    };
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

const registerOrLogin = async (user) => {
  log.step(`Logging in ${user.role} (${user.username})`);
  try {
    const { data } = await api("/user/login", {
      method: "POST",
      body: {
        username: user.username,
        email: user.email,
        password: user.password,
      },
    });
    return data.token;
  } catch (error) {
    log.warn(`Login failed, attempting register: ${error.message}`);
  }

  await api("/user/register", { method: "POST", body: user });

  const { data } = await api("/user/login", {
    method: "POST",
    body: {
      username: user.username,
      email: user.email,
      password: user.password,
    },
  });

  return data.token;
};

const topupWallet = async (token, amount) => {
  if (!Number.isFinite(amount) || amount <= 0) return;

  await api("/wallet/topup", {
    method: "PUT",
    token,
    body: { amount },
  });
  log.step(`Topped up wallet by ${amount}`);
};

const fetchRandomImage = async (seed) => {
  if (DRY_RUN) {
    return { buffer: Buffer.from("dry"), contentType: "image/jpeg" };
  }

  const imageUrl = `https://picsum.photos/seed/${seed}/600/400`;
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch random image (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer, contentType };
};

const createArtworkPayload = (index) => {
  const now = new Date();
  const open = new Date(now.getTime() + index * 60 * 1000);
  const close = new Date(now.getTime() + (index + 60) * 60 * 1000);

  if (CLOSE_BID_MONTHS || CLOSE_BID_DAYS) {
    const customClose = new Date(now.getTime() + index * 60 * 1000);
    if (CLOSE_BID_MONTHS) {
      customClose.setMonth(customClose.getMonth() + CLOSE_BID_MONTHS);
    }
    if (CLOSE_BID_DAYS) {
      customClose.setDate(customClose.getDate() + CLOSE_BID_DAYS);
    }
    close.setTime(customClose.getTime());
  }

  return {
    nama_karya: `Artwork ${index + 1}`,
    deskripsi: `Seeded artwork ${index + 1}`,
    katalog: index % 2 === 0 ? "Modern" : "Classic",
    tags: "seed,art,testing",
    min_bid_ammount: 1000 + index * 100,
    open_bid_time: open.toISOString(),
    close_bid_time: close.toISOString(),
  };
};

const main = async () => {
  log.info(`Starting seed/test flow (base: ${BASE_URL})`);

  if (!DRY_RUN) {
    await api("/health");
    log.step("Health check passed");
  } else {
    log.step("DRY RUN health check skipped");
  }

  const tokens = {};
  for (const user of USERS) {
    tokens[user.key] = await registerOrLogin(user);
  }

  await topupWallet(tokens.collector, WALLET_TOPUP);
  await topupWallet(tokens.curator, WALLET_TOPUP);

  const artworks = [];
  for (let i = 0; i < ARTWORK_COUNT; i += 1) {
    const { data } = await api("/karya-seni/create", {
      method: "POST",
      token: tokens.artist,
      body: createArtworkPayload(i),
    });
    artworks.push(data);
    log.step(`Created artwork ${data.id}`);
  }

  for (let i = 0; i < artworks.length; i += 1) {
    const artwork = artworks[i];
    const seed = `${artwork.id}-${i}`;
    const { buffer, contentType } = await fetchRandomImage(seed);
    const form = new FormData();
    form.append("image", new Blob([buffer], { type: contentType }), `artwork-${i}.jpg`);

    await api(`/karya-seni/${artwork.id}/image`, {
      method: "POST",
      token: tokens.artist,
      body: form,
    });
    log.step(`Uploaded image for ${artwork.id}`);
  }

  for (let i = 0; i < Math.min(3, artworks.length); i += 1) {
    await api(`/karya-seni/${artworks[i].id}/verify`, {
      method: "PUT",
      token: tokens.curator,
    });
    log.step(`Verified ${artworks[i].id}`);
  }

  if (artworks[3]) {
    await api(`/karya-seni/${artworks[3].id}/unverify`, {
      method: "PUT",
      token: tokens.curator,
    });
    log.step(`Unverified ${artworks[3].id}`);
  }

  await api("/karya-seni/all");
  log.step("Fetched artwork list");

  const bids = [];
  for (let i = 0; i < Math.min(2, artworks.length); i += 1) {
    const { data } = await api("/bid/new", {
      method: "POST",
      token: tokens.collector,
      body: {
        artworks_id: artworks[i].id,
        ammount: artworks[i].min_bid_ammount + 200 + i * 100,
      },
    });
    bids.push(data);
    log.step(`Created bid ${data.id}`);
  }

  if (artworks[0]) {
    const outbidArtwork = artworks[0];
    await api("/bid/new", {
      method: "POST",
      token: tokens.curator,
      body: {
        artworks_id: outbidArtwork.id,
        ammount: outbidArtwork.min_bid_ammount + 500,
      },
    });
    log.step(`Outbid highest bid for ${outbidArtwork.id}`);
  }

  const notificationResponse = await api("/notification", {
    token: tokens.collector,
  });
  log.step("Fetched notifications for collector");
  console.log("\n[seed] Notifications:", notificationResponse.data);

  await api(`/bid/${bids[0].id}/detail`, { token: tokens.collector });
  await api("/bid/low-high", { token: tokens.collector });
  await api("/bid", { token: tokens.collector });
  log.step("Fetched bid stats");

  if (bids[1]) {
    await api(`/bid/${bids[1].id}/cancle`, {
      method: "PUT",
      token: tokens.collector,
    });
    log.step(`Cancelled bid ${bids[1].id}`);
  }

  if (artworks[0]) {
    await api(`/karya-seni/${artworks[0].id}/owns`, {
      method: "PUT",
      token: tokens.collector,
    });
    log.step(`Assigned ownership for ${artworks[0].id}`);
  }

  if (artworks[0] && bids[0]) {
    const payment = await api("/payments", {
      method: "POST",
      token: tokens.collector,
      body: {
        ammounts: artworks[0].min_bid_ammount + 200,
        fee: 0.035,
        for_bid: bids[0].id,
      },
    });
    log.step(`Created payment ${payment.data.id}`);
  }

  await api("/payments", { token: tokens.collector });
  log.step("Fetched payment list");

  log.info("Seed/test flow completed successfully.");
  if (DRY_RUN) {
    log.warn("DRY RUN mode: no HTTP requests were sent.");
  }
};

main().catch((error) => {
  console.error("\n[seed][error]", error.message);
  process.exit(1);
});
