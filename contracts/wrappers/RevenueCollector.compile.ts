import type { CompilerConfig } from '@ton/blueprint';
export const compile: CompilerConfig = {
  lang: 'tact',
  target: 'contracts/RevenueCollector.tact',
  options: { debug: false, external: false, ipfsAbiGetter: true, interfacesGetter: true },
};
