// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

describe("customer configuration policy", () => {
    it("exposes only supported customer controls", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        const { customerConfigTabKeys, customerConfigChannel } = await import("@/lib/customer-mode");

        expect(customerConfigTabKeys()).toEqual(["channels"]);
        expect(customerConfigChannel({
            id: "x",
            name: "x",
            baseUrl: "https://external.example",
            apiKey: "key",
            apiFormat: "openai",
            models: [{ name: "gpt-image-2", capability: "image", script: "return 1" }],
        })).toMatchObject({ baseUrl: window.location.origin, apiKey: "key", apiFormat: "openai" });
        expect(customerConfigChannel({
            id: "x",
            name: "x",
            baseUrl: "https://external.example",
            apiKey: "key",
            apiFormat: "openai",
            models: [{ name: "gpt-image-2", capability: "image", script: "return 1" }],
        }).models[0]).not.toHaveProperty("script");
        expect(customerConfigChannel({
            id: "x",
            name: "x",
            baseUrl: "https://external.example",
            apiKey: "key",
            apiFormat: "openai",
            models: [{ name: "veo-3", capability: "video" }],
        }).models).toEqual([{ name: "veo-3", capability: "video" }]);
        expect(customerConfigChannel({
            id: "x",
            name: "x",
            baseUrl: "https://external.example",
            apiKey: "key",
            apiFormat: "openai",
            models: [
                { name: "gpt-image-2", capability: "image", script: "return 1" },
                { name: "grok-imagine-video", capability: "video" },
                { name: "gpt-4o-mini-tts", capability: "audio" },
            ],
        }).models).toEqual([
            { name: "gpt-image-2", capability: "image" },
            { name: "grok-imagine-video", capability: "video" },
        ]);
    });

    it("keeps normal configuration policy unchanged outside customer mode", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        const { customerConfigTabKeys, customerConfigChannel } = await import("@/lib/customer-mode");
        expect(customerConfigTabKeys()).toEqual(["channels", "preferences", "prompt-sources", "webdav"]);
        const channel = { id: "x", name: "x", baseUrl: "https://external.example", apiKey: "key", apiFormat: "openai" as const, models: [{ name: "m", capability: "text" as const, script: "return 1" }] };
        expect(customerConfigChannel(channel)).toEqual(channel);
    });
});
