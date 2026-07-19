// @vitest-environment jsdom

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/constant/runtime-config", () => ({ SOURCE_URL: "https://github.com/customer/infinite-canvas/commit/abc1234" }));
vi.mock("@/lib/customer-mode", () => ({ isCustomerMode: () => true }));

describe("customer GitHub source link", () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it("links to the exact running source commit", async () => {
        const container = document.createElement("div");
        document.body.append(container);
        const root = createRoot(container);
        const { GitHubLink } = await import("@/components/layout/github-link");
        await act(async () => root.render(createElement(GitHubLink)));
        expect(container.querySelector("a")?.href).toBe("https://github.com/customer/infinite-canvas/commit/abc1234");
        await act(async () => root.unmount());
    });
});
