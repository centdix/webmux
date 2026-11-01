import { describe, expect, test } from "bun:test";
import { selectInstancePort } from "./instance-port";
import type { InstanceEntry } from "../../backend/src/adapters/instance-registry";

function entry(port: number): InstanceEntry {
  return { port, pid: 1000 + port };
}

describe("selectInstancePort", () => {
  test("uses the live server's port", () => {
    expect(selectInstancePort(5111, [entry(5112)])).toEqual({ port: 5112, source: "live" });
  });

  test("prefers a live server on the default port", () => {
    expect(selectInstancePort(5111, [entry(5110), entry(5111)])).toEqual({ port: 5111, source: "live" });
  });

  test("picks the lowest live port when none is on the default port", () => {
    expect(selectInstancePort(5111, [entry(5114), entry(5112)])).toEqual({ port: 5112, source: "live" });
  });

  test("falls back to the default port when no server is live", () => {
    expect(selectInstancePort(5111, [])).toEqual({ port: 5111, source: "default" });
  });
});
