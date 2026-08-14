import crypto from 'node:crypto';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

export function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function roomCode(length = 6) {
  let value = '';
  for (let i = 0; i < length; i++) {
    value += ROOM_ALPHABET[crypto.randomInt(0, ROOM_ALPHABET.length)];
  }
  return value;
}
