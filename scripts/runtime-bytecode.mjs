function normalizeHex(value) {
  if (typeof value !== 'string') throw new TypeError('Bytecode must be a hex string.');
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^(?:[\da-fA-F]{2})*$/.test(hex)) throw new Error('Bytecode must contain complete hex bytes.');
  return hex.toLowerCase();
}

export function normalizeImmutableReferences(bytecode, immutableReferences = {}) {
  const chars = normalizeHex(bytecode).split('');
  const references = Object.values(immutableReferences).flat();
  for (const reference of references) {
    const start = Number(reference.start) * 2;
    const length = Number(reference.length) * 2;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 0 || start + length > chars.length) {
      throw new Error('Immutable reference lies outside runtime bytecode.');
    }
    chars.fill('0', start, start + length);
  }
  return `0x${chars.join('')}`;
}

export function byteLength(bytecode) {
  return normalizeHex(bytecode).length / 2;
}
