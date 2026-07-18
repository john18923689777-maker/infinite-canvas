// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

describe("image settings", () => {
    it("hides transparent background for gpt-image-2 only", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        const { modelOptionName } = await import("@/stores/use-config-store");
        expect(modelOptionName("channel::gpt-image-2")).toBe("gpt-image-2");
        const { imageFilesStorageName } = await import("@/services/image-storage");
        expect(imageFilesStorageName()).toBe("image_files");
    });
});
