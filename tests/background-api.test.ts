import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createBackgroundApi as styler,
  type JobStore,
} from "../vendor/styler/server/background-jobs";
import { createBackgroundApi as border } from "../vendor/border/server/background-jobs";
import { initial } from "../vendor/border/shared/border";
import { requestStyle } from "../vendor/styler/src/generation/requestStyle";

const origin = "https://frontender.example";
const post = (path: string, body: unknown, headers = {}) =>
  new Request(origin + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...headers },
    body: JSON.stringify(body),
  });
function memory(): JobStore {
  const data = new Map<string, unknown>();
  return {
    read: async <T>(key: string) => (data.get(key) ?? null) as T | null,
    write: async (key, value) => {
      data.set(key, value);
    },
    claim: async (key) => {
      if (data.has(key)) return false;
      data.set(key, true);
      return true;
    },
    async *keys() {
      yield* data.keys();
    },
    delete: async (key) => {
      data.delete(key);
    },
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe.each([
  {
    name: "styler",
    factory: styler,
    header: "x-styler-signature",
    input: { id: "G900001", snapshot: [], expression: "Professional" },
  },
  {
    name: "border",
    factory: border,
    header: "x-borderlab-signature",
    input: {
      action: "chat",
      image: "data:image/png;base64,AAAA",
      question: "Explain slices",
      settings: initial,
      history: [],
      view: {
        shape: "wide",
        background: "paper",
        label: "Sample",
        sourceWidth: 10,
        sourceHeight: 10,
      },
    },
  },
])("$name background API", ({ name, factory, header, input }) => {
  it("queues once, authenticates workers, suppresses duplicate delivery, and expires jobs", async () => {
    let now = 1_800_000_000_000;
    const dispatch = vi.fn(async () => {});
    const run = vi.fn(async () => ({ advice: "done" }));
    const api = factory({
      store: memory(),
      key: () => "server-secret",
      dispatch,
      run: run as never,
      now: () => now,
    });
    expect(
      (
        await api.start(
          post(`/api/${name}/generate`, input, {
            Origin: "https://other.example",
          }),
        )
      ).status,
    ).toBe(403);
    expect((await api.start(post(`/api/${name}/generate`, {}))).status).toBe(
      400,
    );
    expect(dispatch).not.toHaveBeenCalled();
    const response = await api.start(post(`/api/${name}/generate`, input));
    expect(response.status).toBe(202);
    const { jobId } = await response.json();
    const status = () =>
      api.status(
        new Request(`${origin}/api/${name}/generation-status?job=${jobId}`),
      );
    expect((await status()).status).toBe(202);
    expect(run).not.toHaveBeenCalled();
    expect((await api.work(post("/worker", { jobId }))).status).toBe(403);
    const signature = (dispatch.mock.calls[0] as unknown as string[])[1];
    await api.work(post("/worker", { jobId }, { [header]: signature }));
    await api.work(post("/worker", { jobId }, { [header]: signature }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(await (await status()).json()).toEqual({ advice: "done" });
    now += 25 * 60 * 60_000;
    expect((await status()).status).toBe(410);
    await api.cleanup();
    expect((await status()).status).toBe(404);
  });
});
it("Styler polls its own route without resubmitting generation", async () => {
  vi.useFakeTimers();
  const jobId = `1800000000000-${"a".repeat(64)}`;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ jobId }, { status: 202 }))
    .mockResolvedValueOnce(
      Response.json({ status: "pending" }, { status: 202 }),
    )
    .mockResolvedValueOnce(Response.json({ style: { id: "G1" } }));
  vi.stubGlobal("fetch", fetcher);
  const result = requestStyle({});
  await vi.advanceTimersByTimeAsync(4000);
  expect(await result).toEqual({ id: "G1" });
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/styler/generate",
    `/api/styler/generation-status?job=${jobId}`,
    `/api/styler/generation-status?job=${jobId}`,
  ]);
});
