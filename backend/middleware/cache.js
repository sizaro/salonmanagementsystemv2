import { redisClient } from "../config/redis.js";

export function cache(keyPrefix, ttl = 60) {
  return async (req, res, next) => {
    const key = `${keyPrefix}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`;

    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      res.sendResponse = res.json;
      res.json = async (body) => {
        await redisClient.setEx(key, ttl, JSON.stringify(body));
        res.sendResponse(body);
      };

      next();
    } catch (err) {
      console.warn("⚠️ Cache skipped:", err.message);
      next();
    }
  };
}
