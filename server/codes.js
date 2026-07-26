const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

function generateCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function generateUniqueCode(exists, length = 6, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode(length);
    if (!exists(code)) return code;
  }
  return generateCode(length + 1);
}

module.exports = { generateCode, generateUniqueCode };
