// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasTopBar } from "@/components/canvas/canvas-top-bar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("antd", () => ({
    Button: ({ children, icon, onClick }: { children?: ReactNode; icon?: ReactNode; onClick?: () => void }) => createElement("button", { type: "button", onClick }, icon, children),
    Dropdown: ({ children }: { children: ReactNode }) => children,
    Modal: ({ children, open }: { children: ReactNode; open?: boolean }) => (open ? children : null),
    Tooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/animated-theme-toggler", () => ({ AnimatedThemeToggler: () => null }));
vi.mock("@/components/layout/github-link", () => ({ GitHubLink: () => null }));
vi.mock("@/components/layout/version-release-modal", () => ({ VersionReleaseModal: () => null }));

const noop = () => {};
const props = {
    title: "测试画布",
    titleDraft: "测试画布",
    isTitleEditing: false,
    onTitleDraftChange: noop,
    onStartTitleEditing: noop,
    onFinishTitleEditing: noop,
    onCancelTitleEditing: noop,
    canUndo: false,
    canRedo: false,
    onHome: noop,
    onProjects: noop,
    onCreateProject: noop,
    onDeleteProject: noop,
    onExportProject: noop,
    onImportImage: noop,
    onOpenPlugins: noop,
    onUndo: noop,
    onRedo: noop,
    agentOpen: false,
    compactAgentStatus: { connected: false, enabled: false, activity: "就绪" },
    onToggleAgent: noop,
};

describe("CanvasTopBar customer controls", () => {
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

    it("hides Codex, Agent, and config controls in customer mode", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        await act(async () => root.render(<CanvasTopBar {...props} />));

        expect(container.textContent).not.toContain("Codex");
        expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Agent")).toBe(false);
        expect(container.querySelector('[aria-label="配置"]')).toBeNull();
    });

    it("retains Codex, Agent, and config controls outside customer mode", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        await act(async () => root.render(<CanvasTopBar {...props} />));

        expect(container.textContent).toContain("Codex 未连接");
        expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Agent")).toBe(true);
        expect(container.querySelector('[aria-label="配置"]')).not.toBeNull();
    });
});
