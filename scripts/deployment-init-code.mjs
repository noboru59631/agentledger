export function buildDeploymentInitCode(bytecode, encodedConstructorArgs = '0x') {
  if (typeof bytecode !== 'string' || typeof encodedConstructorArgs !== 'string') {
    throw new TypeError('Bytecode and encoded constructor arguments must be hex strings.');
  }

  const normalizedBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  const normalizedArgs = encodedConstructorArgs.startsWith('0x')
    ? encodedConstructorArgs.slice(2)
    : encodedConstructorArgs;
  if (!/^(?:[\da-fA-F]{2})+$/.test(normalizedBytecode) || !/^(?:[\da-fA-F]{2})*$/.test(normalizedArgs)) {
    throw new Error('Bytecode and constructor arguments must contain complete hex bytes.');
  }

  return `0x${normalizedBytecode}${normalizedArgs}`;
}
