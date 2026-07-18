// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

function persistedState(config: Record<string, unknown>) {
    return JSON.stringify({ state: { config } });
}

describe("customer-mode config normalization", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
        localStorage.clear();
        delete window.__RUNTIME_CONFIG__;
    });

    it("canonicalizes real Zustand updates to the exact browser origin", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        const { useConfigStore } = await import("@/stores/use-config-store");
        const models = [{ name: "private-image", capability: "image" as const }];

        useConfigStore.getState().updateConfig("baseUrl", `${window.location.origin}/v1`);
        useConfigStore.getState().updateConfig("channels", [
            {
                id: "private",
                name: "Private",
                baseUrl: `${window.location.origin}?apiKey=secret`,
                apiKey: "kept-key",
                apiFormat: "openai",
                models,
            },
        ]);

        const config = useConfigStore.getState().config;
        expect(config.baseUrl).toBe(window.location.origin);
        expect(config.channels[0]).toMatchObject({ baseUrl: window.location.origin, apiKey: "kept-key", models });
    });

    it("removes disabled capabilities and scripts from live customer updates", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        const { useConfigStore } = await import("@/stores/use-config-store");

        useConfigStore.getState().updateConfig("channels", [
            {
                id: "customer",
                name: "Customer",
                baseUrl: "https://external.example",
                apiKey: "key",
                apiFormat: "openai",
                models: [
                    { name: "gpt-image-2", capability: "image", script: "return 1" },
                    { name: "veo-3", capability: "video", script: "return 2" },
                    { name: "tts-1", capability: "audio" },
                ],
            },
        ]);

        const channel = useConfigStore.getState().config.channels[0];
        expect(channel.baseUrl).toBe(window.location.origin);
        expect(channel.models).toEqual([{ name: "gpt-image-2", capability: "image" }]);
    });

    it("normalizes persisted external and decorated same-origin URLs during rehydration", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        const { CONFIG_STORE_KEY, useConfigStore } = await import("@/stores/use-config-store");
        const openAiModels = [{ name: "private-image", capability: "image" }];
        const geminiModels = [{ name: "private-text", capability: "text" }];
        localStorage.setItem(
            CONFIG_STORE_KEY,
            persistedState({
                baseUrl: "https://external.example/v1",
                apiKey: "top-level-key",
                channels: [
                    { id: "openai", name: "OpenAI", baseUrl: `${window.location.origin}/v1`, apiKey: "openai-key", apiFormat: "openai", models: openAiModels },
                    { id: "gemini", name: "Gemini", baseUrl: `${window.location.origin}?token=secret`, apiKey: "gemini-key", apiFormat: "gemini", models: geminiModels },
                ],
            }),
        );

        await useConfigStore.persist.rehydrate();

        const config = useConfigStore.getState().config;
        expect(config.baseUrl).toBe(window.location.origin);
        expect(config.apiKey).toBe("top-level-key");
        expect(config.channels).toEqual([
            expect.objectContaining({ id: "openai", baseUrl: window.location.origin, apiKey: "openai-key", models: openAiModels }),
            expect.objectContaining({ id: "gemini", baseUrl: window.location.origin, apiKey: "gemini-key", models: geminiModels }),
        ]);
    });

    it("retains external Base URLs outside customer mode", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        const { useConfigStore } = await import("@/stores/use-config-store");
        const external = "https://external.example/custom/v1?tenant=one";

        useConfigStore.getState().updateConfig("baseUrl", external);
        useConfigStore.getState().updateConfig("channels", [
            { id: "external", name: "External", baseUrl: external, apiKey: "kept-key", apiFormat: "openai", models: [{ name: "model", capability: "text" }] },
        ]);

        expect(useConfigStore.getState().config.baseUrl).toBe(external);
        expect(useConfigStore.getState().config.channels[0].baseUrl).toBe(external);
    });
});
