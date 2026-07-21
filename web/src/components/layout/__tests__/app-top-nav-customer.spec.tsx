// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppTopNav } from "@/components/layout/app-top-nav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("antd", () => ({
    Button: ({ children, icon, onClick, "aria-label": ariaLabel }: { children?: ReactNode; icon?: ReactNode; onClick?: () => void; "aria-label"?: string }) =>
        createElement("button", { type: "button", onClick, "aria-label": ariaLabel }, icon, children),
    Tooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/layout/app-config-modal", () => ({ AppConfigModal: () => createElement("div", { "data-testid": "app-config-modal" }) }));
vi.mock("@/components/layout/mobile-nav-drawer", () => ({ MobileNavDrawer: () => null }));
vi.mock("@/components/ui/animated-theme-toggler", () => ({ AnimatedThemeToggler: () => null }));
vi.mock("@/components/layout/github-link", () => ({ GitHubLink: () => null }));
vi.mock("@/components/layout/version-release-modal", () => ({ VersionReleaseModal: () => null }));

describe("AppTopNav customer configuration", () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        vi.unstubAllEnvs();
        delete window.__RUNTIME_CONFIG__;
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    it("shows the config action and mounts its dialog in customer mode", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        await act(async () =>
            root.render(
                <MemoryRouter initialEntries={["/image"]}>
                    <AppTopNav />
                </MemoryRouter>,
            ),
        );

        expect(container.querySelector('[aria-label="配置"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="app-config-modal"]')).not.toBeNull();
        expect(container.querySelector('[aria-label="打开 Agent"]')).toBeNull();
    });
});
