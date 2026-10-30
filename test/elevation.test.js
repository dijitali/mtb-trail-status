import { describe, it, expect, vi } from "vitest";
import { fetchElevations, fillGaps } from "../src/lib/elevation.js";

describe("fillGaps", () => {
  it("interpolates interior gaps and extends the ends", () => {
    expect(fillGaps([null, 10, null, 20, null])).toEqual([10, 10, 15, 20, 20]);
  });
  it("fails when there is no data at all", () => {
    expect(() => fillGaps([null, null])).toThrow(/coverage/);
  });
});

describe("fetchElevations", () => {
  it("batches requests, sends lat,lon order and preserves point order", async () => {
    const fetch = vi.fn(async (url) => {
      const locations = new URL(url).searchParams.get("locations").split("|");
      return {
        ok: true,
        json: async () => ({
          status: "OK",
          results: locations.map((loc) => ({ elevation: Number(loc.split(",")[0]) * -1 })),
        }),
      };
    });
    const points = [1, 2, 3, 4, 5].map((i) => [175, -36 - i]);
    const result = await fetchElevations(points, { api: "https://topo.test/v1/", dataset: "nzdem8m", fetch, batchSize: 2, delayMs: 0 });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toBe("https://topo.test/v1/nzdem8m?locations=-37.000000,175.000000|-38.000000,175.000000");
    expect(result).toEqual([37, 38, 39, 40, 41]);
  });

  it("reports API errors", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ status: "INVALID_REQUEST", error: "Too many locations" }) }));
    await expect(fetchElevations([[175, -36]], { api: "https://t", dataset: "d", fetch, delayMs: 0 })).rejects.toThrow(/Too many/);
  });
});
