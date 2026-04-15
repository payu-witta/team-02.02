import { CreateInMemoryEventRepository } from "../../src/events/InMemoryEventRepository";

describe("Feature 6 — category and timeframe filters (repository)", () => {
  test("category filter narrows results", async () => {
    const repo = CreateInMemoryEventRepository();
    const res = await repo.findAll({ category: "educational" });
    expect(res.ok).toBe(true);
    expect(res.value.every((e) => e.category === "educational")).toBe(true);
  });

  test("timeframe=upcoming returns only events with startDatetime >= now", async () => {
    const repo = CreateInMemoryEventRepository();
    const res = await repo.findAll({ timeframe: "upcoming" });
    expect(res.ok).toBe(true);
    const now = new Date();
    expect(res.value.every((e) => e.startDatetime >= now)).toBe(true);
  });
});
