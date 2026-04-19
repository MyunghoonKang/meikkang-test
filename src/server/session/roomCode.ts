import { randomInt } from 'node:crypto';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O, 0, 1, I 제외

export function isRoomCode(value: string): boolean {
  return /^[A-Z0-9]{4}$/.test(value);
}

export function generateRoomCode(excluded?: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += ALPHA[randomInt(ALPHA.length)];
    if (!excluded?.has(code)) return code;
  }
  throw new Error('roomCode: exhausted attempts');
}
