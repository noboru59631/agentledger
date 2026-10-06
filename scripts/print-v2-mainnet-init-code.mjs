import { readFile } from 'node:fs/promises';
import { arcMainnet } from './arc-mainnet-config.mjs';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';

const artifact = JSON.parse(await readFile('out/MandateGraphV2.sol/MandateGraphV2.json', 'utf8'));
const constructorArgs = `0x${encodeAddress(arcMainnet.usdcAddress)}${encodeAddress(arcMainnet.identityRegistry)}`;
process.stdout.write(buildDeploymentInitCode(artifact.bytecode.object, constructorArgs));

function encodeAddress(address) {
  return address.slice(2).toLowerCase().padStart(64, '0');
}
