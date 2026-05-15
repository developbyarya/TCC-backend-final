const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined,
});

redis.on("error", (err) => {
  console.error("Redis error", err);
});

const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
};

module.exports = { redis, connectRedis };
