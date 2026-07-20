// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import {
    canImportAgentConfig,
    canImportApiConfig,
    canUseExternalBaseUrl,
    customerGeminiBaseUrl,
    customerGenerationMode,
    customerGenerationModes,
    customerOpenAIBaseUrl,
    isCustomerMode,
    resolveCustomerMode,
    stripCustomerModeQueryParams,
} from "@/lib/customer-mode";

const rootInitMocks = vi.hoisted(() => ({
    messageSuccess: vi.fn(),
    openConfigDialog: vi.fn(),
    updateConfig: vi.fn(),
}));

vi.mock("antd", () => ({ App: { useApp: () => ({ message: { success: rootInitMocks.messageSuccess } }) } }));
vi.mock("@/hooks/use-prompt-source-scheduler", () => ({ usePromptSourceScheduler: vi.fn() }));
vi.mock("@/stores/use-config-store", () => ({
    createModelChannel: vi.fn(),
    useConfigStore: (selector: (state: unknown) => unknown) =>
        selector({
            config: { channels: [] },
            openConfigDialog: rootInitMocks.openConfigDialog,
            updateConfig: rootInitMocks.updateConfig,
        }),
}));

describe("resolveCustomerMode", () => {
    it.each([
        [true, undefined],
        [true, ""],
        [true, "false"],
        [true, "yes"],
        [true, false],
    ])("keeps a customer build enabled when runtime is %p", (build, runtime) => {
        expect(resolveCustomerMode({ build, runtime })).toBe(true);
    });

    it.each([true, "true"])("allows an explicit runtime opt-in for a non-customer build: %p", (runtime) => {
        expect(resolveCustomerMode({ build: false, runtime })).toBe(true);
    });

    it.each([undefined, "", "false", "yes", 1, {}, false])("keeps a non-customer build disabled for runtime %p", (runtime) => {
        expect(resolveCustomerMode({ build: false, runtime })).toBe(false);
    });
});

describe("browser customer-mode policy", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
        localStorage.clear();
        window.history.replaceState(null, "", "/canvas?keep=1#node-7");
        delete window.__RUNTIME_CONFIG__;
    });

    it("reads build and runtime flags with exact true semantics", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        window.__RUNTIME_CONFIG__ = { CUSTOMER_MODE: "false" };
        expect(isCustomerMode()).toBe(true);

        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        window.__RUNTIME_CONFIG__ = { CUSTOMER_MODE: true };
        expect(isCustomerMode()).toBe(true);
    });

    it("locks customer API base URLs to the current origin", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        expect(customerOpenAIBaseUrl()).toBe(window.location.origin);
        expect(customerGeminiBaseUrl()).toBe(window.location.origin);
        expect(canUseExternalBaseUrl(window.location.origin)).toBe(true);
        expect(canUseExternalBaseUrl(`${window.location.origin}/`)).toBe(true);
    });

    it.each([
        ["non-root path", () => `${window.location.origin}/v1`],
        ["query string", () => `${window.location.origin}?apiKey=secret`],
        ["hash", () => `${window.location.origin}#hash`],
        ["credentials", () => window.location.origin.replace("://", "://user:pass@")],
        ["external origin", () => "https://other.example"],
    ])("rejects a customer Base URL with %s", (_case, baseUrl) => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        expect(canUseExternalBaseUrl(baseUrl())).toBe(false);
    });

    it("disables API and Agent imports in customer mode", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        expect(canImportApiConfig()).toBe(false);
        expect(canImportAgentConfig()).toBe(false);
    });

    it("exposes image, text, and video generation modes in customer mode", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        expect(customerGenerationModes()).toEqual(["image", "text", "video"]);
        expect(customerGenerationMode("video")).toBe("video");
        expect(customerGenerationMode("audio")).toBe("image");
    });

    it("keeps only the isolated iframe presentation query allowlist", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        const result = stripCustomerModeQueryParams("/canvas?theme=dark&lang=zh-CN&ui_mode=embedded&baseUrl=https%3A%2F%2Fother.example&apiKey=secret&agentToken=token&keep=a%20b#node-7");
        expect(result).toBe("/canvas?theme=dark&lang=zh-CN&ui_mode=embedded#node-7");
    });

    it("leaves query parameters untouched outside customer mode", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        const url = "/canvas?baseUrl=https%3A%2F%2Fother.example&agentToken=token&keep=1#node-7";
        expect(stripCustomerModeQueryParams(url)).toBe(url);
    });

    it.each([
        ["API", "baseUrl=https%3A%2F%2Fother.example&baseurl=x&apiKey=secret&apikey=y"],
        ["Agent", "agentUrl=https%3A%2F%2Fagent.example&agentToken=token"],
    ])("strips %s query config without mutating stores or Agent persistence", async (_family, sensitiveQuery) => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        localStorage.setItem("canvas-agent-url", "http://existing-agent");
        localStorage.setItem("canvas-agent-token", "existing-token");
        window.history.replaceState(null, "", `/canvas?theme=dark&lang=zh-CN&ui_mode=embedded&${sensitiveQuery}&keep=a%20b#node-7`);
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);
        const { ClientRootInit } = await import("@/components/layout/client-root-init");

        await act(async () => root.render(createElement(ClientRootInit, null, createElement("div"))));

        expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe("/canvas?theme=dark&lang=zh-CN&ui_mode=embedded#node-7");
        expect(rootInitMocks.updateConfig).not.toHaveBeenCalled();
        expect(rootInitMocks.openConfigDialog).not.toHaveBeenCalled();
        expect(rootInitMocks.messageSuccess).not.toHaveBeenCalled();
        expect(localStorage.getItem("canvas-agent-url")).toBe("http://existing-agent");
        expect(localStorage.getItem("canvas-agent-token")).toBe("existing-token");

        await act(async () => root.unmount());
        container.remove();
    });
});
