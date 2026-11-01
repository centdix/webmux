import { createInstanceRegistry, type InstanceEntry } from "../../backend/src/adapters/instance-registry";

export type PortSource = "live" | "default";

export interface ResolvedPort {
  port: number;
  source: PortSource;
}

/**
 * Pick the port of the live webmux server. Server-backed CLI commands
 * (`oneshot`, `linear`, `send`) talk to a running `webmux serve`, whose port is
 * whatever it bound at startup — not necessarily the 5111 default (e.g. a
 * service installed with `--port`). Reading the registry lets those commands
 * find the server instead of blindly hitting 5111.
 *
 * Prefers a live server on `defaultPort`, then the lowest live port, then
 * `defaultPort` when nothing is live.
 */
export function selectInstancePort(defaultPort: number, instances: InstanceEntry[]): ResolvedPort {
  if (instances.some((entry) => entry.port === defaultPort)) return { port: defaultPort, source: "live" };
  const ports = instances.map((entry) => entry.port).sort((a, b) => a - b);
  if (ports.length > 0) return { port: ports[0]!, source: "live" };
  return { port: defaultPort, source: "default" };
}

/** I/O wrapper: read the live registry, then delegate to the pure `selectInstancePort`. */
export function resolveLiveServerPort(opts: {
  defaultPort: number;
  registryDir?: string;
}): ResolvedPort {
  const instances = createInstanceRegistry(opts.registryDir, {
    checkPids: Bun.env.WEBMUX_SKIP_INSTANCE_PID_CHECK !== "1",
  }).listLive();
  return selectInstancePort(opts.defaultPort, instances);
}
