import { canBind } from "../../backend/src/adapters/port-probe";

export interface DevPortPair {
  backendPort: number;
  frontendPort: number;
}

export type PortAvailabilityProbe = (port: number) => boolean;

export function selectDevPortPair(
  startPort: number,
  isAvailable: PortAvailabilityProbe,
  maxAttempts = 200,
): DevPortPair {
  for (let backendPort = startPort; backendPort < startPort + maxAttempts; backendPort++) {
    const frontendPort = backendPort + 1;
    if (isAvailable(backendPort) && isAvailable(frontendPort)) {
      return { backendPort, frontendPort };
    }
  }
  throw new Error(`Could not find two adjacent free ports starting at ${startPort}`);
}

if (import.meta.main) {
  const startPort = parseInt(Bun.argv[2] ?? "5111", 10);
  if (Number.isNaN(startPort)) {
    console.error("Start port must be numeric");
    process.exit(1);
  }
  const pair = selectDevPortPair(startPort, canBind);
  console.log(`${pair.backendPort} ${pair.frontendPort}`);
}
