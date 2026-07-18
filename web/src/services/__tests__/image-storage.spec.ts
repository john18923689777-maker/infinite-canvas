import { describe, expect, it } from "vitest";

describe("image storage", () => {
    it("uses browser-local image_files storage", async () => {
        const { imageFilesStorageName } = await import("@/services/image-storage");
        expect(imageFilesStorageName()).toBe("image_files");
    });
});
