// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CUSTOMER_MODE_DISABLED, assertCustomerModeDisabled, isCustomerMode } from "@/lib/customer-mode";

describe("customer capability gates", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        vi.restoreAllMocks();
        delete window.__RUNTIME_CONFIG__;
    });

    it("exposes a stable disabled error", () => {
        expect(() => assertCustomerModeDisabled()).toThrow(CUSTOMER_MODE_DISABLED);
        expect(isCustomerMode()).toBe(true);
    });

    it("fails closed for plugin discovery, install, activation and registry", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const { installPluginFromUrl, ensurePluginsLoaded, activatePlugin } = await import("@/lib/canvas/plugin-loader");
        const { fetchOfficialPlugins } = await import("@/lib/canvas/plugin-registry");
        const { usePluginStore } = await import("@/stores/canvas/use-plugin-store");
        const { runSiteTool } = await import("@/lib/agent/agent-site-tools");
        await expect(installPluginFromUrl("https://plugins.example/p.js")).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        await expect(fetchOfficialPlugins()).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        await expect(ensurePluginsLoaded()).resolves.toBeUndefined();
        expect(() => activatePlugin({ id: "x", nodes: [{ type: "x" }] } as never)).toThrow(CUSTOMER_MODE_DISABLED);
        expect(() => usePluginStore.getState().upsert({ id: "x", name: "x", version: "1", url: "https://x", source: "", enabled: true })).toThrow(CUSTOMER_MODE_DISABLED);
        await expect(runSiteTool("workbench_video_generate", {}, (() => {}) as never)).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fails closed for WebDAV and model/prompt scripts", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const { testWebdavConnection } = await import("@/services/webdav-sync");
        const { syncAppDataToWebdav } = await import("@/services/app-sync");
        const { runModelPlugin } = await import("@/services/api/model-plugin");
        const { runPromptSource } = await import("@/services/api/prompt-source-runtime");
        await expect(testWebdavConnection({ url: "https://dav.example", directory: "", username: "", password: "", lastSyncedAt: "" })).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        const progress = vi.fn();
        await expect(syncAppDataToWebdav({ url: "https://dav.example", directory: "", username: "", password: "", lastSyncedAt: "" }, progress)).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        expect(progress).not.toHaveBeenCalled();
        await expect(runModelPlugin({ capability: "text", script: "return 1", config: { model: "m", baseUrl: "", apiKey: "" } as never })).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        await expect(runPromptSource("return []")).rejects.toThrow(CUSTOMER_MODE_DISABLED);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fails closed for direct Agent state actions", async () => {
        const { useAgentStore } = await import("@/stores/use-agent-store");
        const state = useAgentStore.getState();
        state.connectAgent();
        state.setAgentState({ enabled: true, connected: true, url: "https://agent.example", token: "secret" });
        state.openPanel();
        state.togglePanel();
        state.setCanvasContext({ snapshot: {} as never, applyOps: () => ({} as never), undoOps: () => null, canUndo: false });
        expect(useAgentStore.getState().enabled).toBe(false);
        expect(useAgentStore.getState().connected).toBe(false);
        expect(useAgentStore.getState().panelOpen).toBe(false);
        expect(useAgentStore.getState().url).not.toBe("https://agent.example");
        expect(useAgentStore.getState().token).not.toBe("secret");
        expect(useAgentStore.getState().canvasContext).toBe(null);
        expect(useAgentStore.getState().connectError).toBe(CUSTOMER_MODE_DISABLED);
    });

    it("retains model script execution outside customer mode", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        const { runModelPlugin } = await import("@/services/api/model-plugin");
        await expect(runModelPlugin({ capability: "text", script: "return 7", config: { model: "m", baseUrl: "", apiKey: "" } as never })).resolves.toBe(7);
    });
});
