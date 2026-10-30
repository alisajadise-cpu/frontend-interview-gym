import { describe, expect, it, vi } from "vitest";
import { mapLimit } from "./index";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function controlledMapper() {
  const pending: ReturnType<typeof deferred<string>>[] = [];
  const mapper = vi.fn((item: string, index: number) => {
    const d = deferred<string>();
    pending[index] = d;
    return d.promise;
  });
  return { mapper, pending };
}

describe("mapLimit", () => {
  it("starts `limit` mappers synchronously and passes (item, index)", () => {
    const { mapper } = controlledMapper();
    mapLimit(["a", "b", "c", "d"], 2, mapper);
    expect(mapper).toHaveBeenCalledTimes(2);
    expect(mapper.mock.calls).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });

  it("refills a slot as soon as any mapper finishes (no batching)", async () => {
    const { mapper, pending } = controlledMapper();
    mapLimit(["a", "b", "c", "d"], 2, mapper);
    pending[1].resolve("B"); // item 0 is still running
    await flush();
    expect(mapper).toHaveBeenCalledTimes(3);
    expect(mapper.mock.calls[2]).toEqual(["c", 2]);
  });

  it("never runs more than `limit` at once", async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapLimit([5, 1, 4, 2, 3, 1, 2], 3, async (ms) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, ms));
      active--;
      return ms * 2;
    });
    expect(maxActive).toBe(3);
    expect(result).toEqual([10, 2, 8, 4, 6, 2, 4]);
  });

  it("keeps input order even when items finish in reverse", async () => {
    const { mapper, pending } = controlledMapper();
    const p = mapLimit(["a", "b", "c"], 3, mapper);
    pending[2].resolve("C");
    pending[1].resolve("B");
    pending[0].resolve("A");
    await expect(p).resolves.toEqual(["A", "B", "C"]);
  });

  it("accepts sync return values and limit larger than the input", async () => {
    await expect(mapLimit([1, 2, 3], 10, (x) => x * 2)).resolves.toEqual([2, 4, 6]);
  });

  it("resolves [] for empty input without calling mapper", async () => {
    const mapper = vi.fn();
    await expect(mapLimit([], 2, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it("throws RangeError synchronously for an invalid limit", () => {
    const mapper = vi.fn();
    expect(() => mapLimit([1], 0, mapper)).toThrow(RangeError);
    expect(() => mapLimit([1], -1, mapper)).toThrow(RangeError);
    expect(() => mapLimit([1], 1.5, mapper)).toThrow(RangeError);
    expect(() => mapLimit([1], Number.NaN, mapper)).toThrow(RangeError);
  });

  it("fails fast: rejects with the first error and starts nothing new", async () => {
    const { mapper, pending } = controlledMapper();
    const p = mapLimit(["a", "b", "c", "d", "e"], 2, mapper);
    const boom = new Error("boom");
    pending[1].reject(boom);
    await expect(p).rejects.toBe(boom);
    pending[0].resolve("A"); // a late success must not start item 2
    pending[0].reject(new Error("second error is ignored"));
    await flush();
    expect(mapper).toHaveBeenCalledTimes(2);
  });

  it("treats a synchronous throw in mapper as a rejection", async () => {
    const err = new Error("sync");
    await expect(
      mapLimit([1, 2], 1, () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });

  it("aborts: rejects with signal.reason and stops scheduling", async () => {
    const { mapper } = controlledMapper();
    const controller = new AbortController();
    const p = mapLimit(["a", "b", "c", "d"], 2, mapper, { signal: controller.signal });
    const reason = new Error("user cancelled");
    controller.abort(reason);
    await expect(p).rejects.toBe(reason);
    expect(mapper).toHaveBeenCalledTimes(2);
  });

  it("aborts with an AbortError when no reason is given", async () => {
    const { mapper } = controlledMapper();
    const controller = new AbortController();
    const p = mapLimit(["a"], 1, mapper, { signal: controller.signal });
    controller.abort();
    const error = await p.catch((e: unknown) => e);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("rejects without calling mapper when the signal is already aborted", async () => {
    const mapper = vi.fn();
    const controller = new AbortController();
    controller.abort();
    await expect(mapLimit([1, 2], 1, mapper, { signal: controller.signal })).rejects.toBeDefined();
    expect(mapper).not.toHaveBeenCalled();
  });

  it("removes its abort listener when done", async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await mapLimit([1, 2, 3], 2, async (x) => x, { signal: controller.signal });
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0][1]).toBe(add.mock.calls[0][1]);
  });
  it("resolves only after ALL items finish, even when the last item finishes first", async () => {
    const { mapper, pending } = controlledMapper();
    let settled = false;
    const p = mapLimit(["a", "b"], 2, mapper).then((r) => {
      settled = true;
      return r;
    });
    pending[1].resolve("B"); // the LAST item finishes first
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false); // 'a' is still running
    pending[0].resolve("A");
    await expect(p).resolves.toEqual(["A", "B"]);
  });
});
