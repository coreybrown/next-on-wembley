import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, renderHook, waitFor } from "@testing-library/react";

const mockRegenerate = vi.fn();
vi.mock("@/app/actions/recommendations", () => ({
  regenerateAllLists: mockRegenerate,
}));

const { RefreshProvider, useRefresh, isRefreshActive } = await import(
  "@/components/refresh-context"
);

beforeEach(() => {
  mockRegenerate.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RefreshProvider>{children}</RefreshProvider>
);

describe("refresh-context state machine", () => {
  it("isRefreshActive marks pending and long_running as active", () => {
    expect(isRefreshActive("idle")).toBe(false);
    expect(isRefreshActive("pending")).toBe(true);
    expect(isRefreshActive("long_running")).toBe(true);
    expect(isRefreshActive("timed_out")).toBe(false);
    expect(isRefreshActive("error")).toBe(false);
    expect(isRefreshActive("success")).toBe(false);
  });

  it("transitions idle → pending → success on a clean refresh", async () => {
    mockRegenerate.mockResolvedValueOnce([{ ok: true }, { ok: true }, { ok: true }]);
    const { result } = renderHook(() => useRefresh(), { wrapper });
    expect(result.current.state).toBe("idle");
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.state).toBe("success");
    expect(result.current.errorMessage).toBeNull();
  });

  it("transitions to long_running after 30s without a result", async () => {
    vi.useFakeTimers();
    let resolveAction!: (v: unknown) => void;
    mockRegenerate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const { result } = renderHook(() => useRefresh(), { wrapper });
    act(() => {
      void result.current.refresh();
    });
    expect(result.current.state).toBe("pending");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.state).toBe("long_running");
    // Clean up — resolve so React can flush effects.
    await act(async () => {
      resolveAction([{ ok: true }, { ok: true }, { ok: true }]);
      await Promise.resolve();
    });
  });

  it("times out at 60s and stale results no longer transition state", async () => {
    vi.useFakeTimers();
    let resolveAction!: (v: unknown) => void;
    mockRegenerate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const { result } = renderHook(() => useRefresh(), { wrapper });
    act(() => {
      void result.current.refresh();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.state).toBe("timed_out");
    expect(result.current.errorMessage).toMatch(/took longer than 60/i);

    // The server action eventually resolves — must NOT overwrite timed_out.
    await act(async () => {
      resolveAction([{ ok: true }, { ok: true }, { ok: true }]);
      await Promise.resolve();
    });
    expect(result.current.state).toBe("timed_out");
  });

  it("surfaces a folded error message when all lists fail with same code", async () => {
    mockRegenerate.mockResolvedValueOnce([
      { ok: false, error: "anthropic_failed", errorMessage: "API key bad" },
      { ok: false, error: "anthropic_failed", errorMessage: "API key bad" },
      { ok: false, error: "anthropic_failed", errorMessage: "API key bad" },
    ]);
    const { result } = renderHook(() => useRefresh(), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.errorMessage).toMatch(/API key bad/);
  });

  it("clearError returns to idle", async () => {
    mockRegenerate.mockResolvedValueOnce([
      { ok: false, error: "anthropic_failed" },
      { ok: false, error: "anthropic_failed" },
      { ok: false, error: "anthropic_failed" },
    ]);
    const { result } = renderHook(() => useRefresh(), { wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.state).toBe("error");
    act(() => {
      result.current.clearError();
    });
    expect(result.current.state).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
  });

  it("throws when useRefresh is called outside a provider", () => {
    // Suppress React's expected error log
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useRefresh());
    }).toThrow(/RefreshProvider/);
    spy.mockRestore();
  });
});

describe("RefreshIndicator", () => {
  it("renders nothing in idle state", async () => {
    const { RefreshIndicator } = await import(
      "@/components/refresh-indicator"
    );
    const { container } = render(
      <RefreshProvider>
        <RefreshIndicator />
      </RefreshProvider>,
    );
    expect(container.textContent).toBe("");
  });

  it("shows the failure pill on error state", async () => {
    mockRegenerate.mockResolvedValueOnce([
      { ok: false, error: "anthropic_failed" },
      { ok: false, error: "anthropic_failed" },
      { ok: false, error: "anthropic_failed" },
    ]);
    const { RefreshIndicator } = await import(
      "@/components/refresh-indicator"
    );
    const Trigger = () => {
      const { refresh } = useRefresh();
      return <button onClick={() => void refresh()}>go</button>;
    };
    const view = render(
      <RefreshProvider>
        <Trigger />
        <RefreshIndicator />
      </RefreshProvider>,
    );
    await act(async () => {
      view.getByText("go").click();
    });
    await waitFor(() =>
      expect(view.getByText(/refresh failed/i)).toBeInTheDocument(),
    );
  });
});
