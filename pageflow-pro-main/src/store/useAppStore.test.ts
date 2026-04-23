import { afterEach, describe, expect, it } from "vitest";

import { useAppStore } from "./useAppStore";


const resetStore = () => {
  useAppStore.setState({
    user: null,
    isAuthenticated: false,
    refreshToken: null,
  });
  localStorage.clear();
};


afterEach(() => {
  resetStore();
});


describe("useAppStore", () => {
  it("persists tokens and auth state on login", () => {
    useAppStore.getState().login({
      access: "access-token",
      refresh: "refresh-token",
      user: {
        id: "1",
        name: "Rahim Ahmed",
        email: "rahim@example.com",
        avatar: "RA",
      },
    });

    expect(localStorage.getItem("pageflow_token")).toBe("access-token");
    expect(localStorage.getItem("pageflow_refresh")).toBe("refresh-token");
    expect(useAppStore.getState().isAuthenticated).toBe(true);
    expect(useAppStore.getState().user?.email).toBe("rahim@example.com");
  });

  it("clears tokens and auth state on logout", () => {
    useAppStore.getState().login({
      access: "access-token",
      refresh: "refresh-token",
      user: {
        id: "1",
        name: "Rahim Ahmed",
        email: "rahim@example.com",
      },
    });

    useAppStore.getState().logout();

    expect(localStorage.getItem("pageflow_token")).toBeNull();
    expect(localStorage.getItem("pageflow_refresh")).toBeNull();
    expect(useAppStore.getState().isAuthenticated).toBe(false);
    expect(useAppStore.getState().user).toBeNull();
  });
});
