import { initClient, type AppRouter, type InitClientArgs } from "@ts-rest/core";
import { hubContract, projectApiBasePath, projectContract } from "./contract";

export interface ApiClientOptions extends Omit<InitClientArgs, "baseUrl"> {
  /** Server origin (e.g. `http://localhost:5111`). Empty → same-origin relative URLs. */
  origin?: string;
}

function createClient<TContract extends AppRouter>(contract: TContract, baseUrl: string, options: Omit<InitClientArgs, "baseUrl">) {
  return initClient(contract, {
    baseUrl,
    throwOnUnknownStatus: true,
    baseHeaders: {},
    ...options,
  });
}

type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226;

type SuccessBody<TResponse> = Extract<TResponse, { status: SuccessStatus }> extends { body: infer TBody }
  ? TBody
  : never;

type UnwrappedClient<TClient> = {
  [K in keyof TClient]: TClient[K] extends (...args: infer TArgs) => Promise<infer TResponse>
    ? (...args: TArgs) => Promise<SuccessBody<TResponse>>
    : TClient[K];
};

type RouteCall = (...args: unknown[]) => Promise<unknown>;
type RouteResponse = { status: number; body: unknown; headers?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRouteResponse(value: unknown): value is RouteResponse {
  return isRecord(value)
    && "status" in value
    && typeof value.status === "number"
    && "body" in value;
}

function unwrapResponse(response: unknown): unknown {
  if (!isRouteResponse(response)) {
    throw new Error("Malformed API client response");
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorMessageFromResponse(response.body, response.status));
  }
  // No route returns HTML: a 2xx `text/html` is a server without this route
  // serving its SPA fallback (CLI/server version skew), not a success.
  if (response.headers instanceof Headers && response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`HTTP ${response.status}: expected JSON, got HTML (is the webmux server up to date?)`);
  }
  return response.body;
}

function errorMessageFromResponse(body: unknown, status: number): string {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      return errorMessageFromResponse(parsed, status);
    } catch {
      return body.trim() || `HTTP ${status}`;
    }
  }
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return `HTTP ${status}`;
}

// ts-rest interpolates path params verbatim, so names like `feature/foo`
// must be encoded before they are inserted into `/api/.../:name/...`.
function withEncodedPathParams(args: unknown[]): unknown[] {
  const [first, ...rest] = args;
  if (!first || typeof first !== "object" || !("params" in first) || !first.params || typeof first.params !== "object") {
    return args;
  }

  const encodedParams = Object.fromEntries(
    Object.entries(first.params).map(([key, value]) => [key, encodeURIComponent(String(value))]),
  );

  return [
    {
      ...first,
      params: encodedParams,
    },
    ...rest,
  ];
}

function wrapRouteCall(routeCall: RouteCall): RouteCall {
  return async (...args: unknown[]) => unwrapResponse(await routeCall(...withEncodedPathParams(args)));
}

function wrapClient<TClient extends Record<string, unknown>>(client: TClient): UnwrappedClient<TClient> {
  return Object.fromEntries(
    Object.entries(client).map(([key, value]) => {
      if (typeof value === "function") {
        return [key, wrapRouteCall((...args) => Promise.resolve(Reflect.apply(value, undefined, args)))];
      }
      if (isRecord(value)) {
        return [key, wrapClient(value)];
      }
      return [key, value];
    }),
  ) as UnwrappedClient<TClient>;
}

export type HubApi = UnwrappedClient<ReturnType<typeof createClient<typeof hubContract>>>;
export type ProjectApi = UnwrappedClient<ReturnType<typeof createClient<typeof projectContract>>>;

/** Client for the global hub routes (project registry). */
export function createHubApi({ origin = "", ...options }: ApiClientOptions = {}): HubApi {
  return wrapClient(createClient(hubContract, origin, options));
}

/** Client for one project's routes, mounted under `projectApiBasePath(project)`. */
export function createProjectApi(project: string, { origin = "", ...options }: ApiClientOptions = {}): ProjectApi {
  return wrapClient(createClient(projectContract, `${origin}${projectApiBasePath(project)}`, options));
}
