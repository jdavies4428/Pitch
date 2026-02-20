import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ROOM_TTL = 60 * 60 * 4; // 4 hours

export async function getRoom(code) {
  return await redis.get(`pitch:${code}`);
}

export async function setRoom(code, room) {
  await redis.set(`pitch:${code}`, room, { ex: ROOM_TTL });
}

export async function deleteRoom(code) {
  await redis.del(`pitch:${code}`);
}
