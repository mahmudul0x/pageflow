import { beforeEach, describe, expect, it, vi } from "vitest";

const { patchMock } = vi.hoisted(() => ({
  patchMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    patch: patchMock,
  },
}));

import { pageService } from "./pageService";


describe("pageService.toggle", () => {
  beforeEach(() => {
    patchMock.mockReset();
  });

  it("calls the toggle endpoint and normalizes the response", async () => {
    patchMock.mockResolvedValue({ data: { is_active: false } });

    const result = await pageService.toggle("42");

    expect(patchMock).toHaveBeenCalledWith("/pages/42/toggle/");
    expect(result).toEqual({ is_active: false });
  });
});
