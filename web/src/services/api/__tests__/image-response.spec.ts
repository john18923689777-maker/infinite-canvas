// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("axios", () => ({
    default: {
        post,
        isCancel: () => false,
        isAxiosError: () => false,
    },
}));

function config(apiFormat: "openai" | "gemini", model: string) {
    return {
        channelMode: "local" as const,
        baseUrl: window.location.origin,
        apiKey: "test-key",
        apiFormat,
        channels: [{ id: apiFormat, name: apiFormat, baseUrl: window.location.origin, apiKey: "test-key", apiFormat, models: [{ name: model, capability: "image" as const }] }],
        model: `${apiFormat}::${model}`,
        imageModel: `${apiFormat}::${model}`,
        videoModel: "",
        textModel: "",
        audioModel: "",
        audioVoice: "alloy",
        audioFormat: "mp3",
        audioSpeed: "1",
        audioInstructions: "",
        videoSeconds: "6",
        vquality: "720",
        videoGenerateAudio: "true",
        videoWatermark: "false",
        systemPrompt: "",
        models: [`${apiFormat}::${model}`],
        quality: "auto",
        size: "1:1",
        background: "",
        count: "1",
        canvasImageCount: "1",
    };
}

describe("image API response contracts", () => {
    beforeEach(() => {
        post.mockReset();
    });

    it("uses same-origin OpenAI generation and converts b64_json to an image data URL", async () => {
        post.mockResolvedValue({ data: { data: [{ b64_json: "aW1hZ2U=" }] } });
        const { requestGeneration } = await import("@/services/api/image");
        const images = await requestGeneration(config("openai", "gpt-image-2"), "a test image");

        expect(post).toHaveBeenCalledWith(
            `${window.location.origin}/v1/images/generations`,
            expect.objectContaining({ model: "gpt-image-2", response_format: "b64_json" }),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-key" }) }),
        );
        expect(images[0].dataUrl).toBe("data:image/png;base64,aW1hZ2U=");
    });

    it("uses same-origin Gemini generateContent and converts inlineData to an image data URL", async () => {
        post.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: "aW1hZ2U=" } }] } }] } });
        const { requestGeneration } = await import("@/services/api/image");
        const images = await requestGeneration(config("gemini", "gemini-2.5-flash-image"), "a test image");

        expect(post).toHaveBeenCalledWith(
            `${window.location.origin}/v1beta/models/gemini-2.5-flash-image:generateContent`,
            expect.objectContaining({ contents: expect.any(Array) }),
            expect.objectContaining({ headers: expect.objectContaining({ "x-goog-api-key": "test-key" }) }),
        );
        expect(images[0].dataUrl).toBe("data:image/jpeg;base64,aW1hZ2U=");
    });

    it("does not forward transparent background for gpt-image-2", async () => {
        post.mockResolvedValue({ data: { data: [{ b64_json: "aW1hZ2U=" }] } });
        const { requestGeneration } = await import("@/services/api/image");
        await requestGeneration({ ...config("openai", "gpt-image-2"), background: "transparent" }, "a test image");
        expect(post.mock.calls[0][1]).not.toHaveProperty("background");
    });
});
