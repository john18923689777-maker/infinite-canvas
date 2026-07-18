// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CanvasProjectPage from "@/pages/canvas/project";
import { useAgentStore } from "@/stores/use-agent-store";
import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hookMocks = vi.hoisted(() => ({ applyAgentOps: vi.fn() }));

vi.mock("@/components/canvas/canvas-top-bar", () => ({ CanvasTopBar: () => null }));
vi.mock("@/components/canvas/canvas-side-panel", () => ({ CanvasSidePanel: () => null }));
vi.mock("@/components/canvas/canvas-toolbar", () => ({ CanvasToolbar: () => null }));
vi.mock("@/components/canvas/canvas-zoom-controls", () => ({ CanvasZoomControls: () => null }));
vi.mock("@/components/canvas/canvas-refresh-shell", () => ({ CanvasRefreshShell: () => null }));
vi.mock("@/components/canvas/infinite-canvas", () => ({ InfiniteCanvas: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/pages/canvas/hooks/use-agent-bridge", () => ({ useAgentBridge: () => ({ applyAgentOps: hookMocks.applyAgentOps }) }));
vi.mock("@/pages/canvas/hooks/use-plugin-host", () => ({
    usePluginHost: () => ({ pluginHost: {}, renderPluginPanel: () => null, buildNodeToolbarItems: () => [] }),
}));
vi.mock("@/lib/canvas/canvas-generation-helpers", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/canvas/canvas-generation-helpers")>();
    return { ...original, hydrateCanvasImages: async <T,>(items: T) => items, hydrateAssistantImages: async <T,>(items: T) => items };
});

const project: CanvasProject = {
    id: "project-1",
    title: "测试画布",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    nodes: [],
    connections: [],
    chatSessions: [],
    activeChatId: null,
    backgroundMode: "lines",
    showImageInfo: false,
    viewport: { x: 0, y: 0, k: 1 },
};

describe("customer canvas Agent auto-open", () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;
    let openPanel = vi.fn<() => void>();

    beforeEach(() => {
        vi.unstubAllEnvs();
        delete window.__RUNTIME_CONFIG__;
        openPanel = vi.fn<() => void>();
        useAgentStore.setState({ panelOpen: false, openPanel });
        useCanvasStore.setState({ hydrated: true, projects: [project] });
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    async function mountProject() {
        await act(async () => {
            root.render(
                <App>
                    <MemoryRouter initialEntries={["/canvas/project-1?mode=new"]}>
                        <Routes>
                            <Route path="/canvas/:id" element={<CanvasProjectPage />} />
                        </Routes>
                    </MemoryRouter>
                </App>,
            );
        });
    }

    it("does not open Agent state for customer project query modes", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");
        await mountProject();
        expect(openPanel).not.toHaveBeenCalled();
    });

    it("retains Agent auto-open for upstream project query modes", async () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");
        await mountProject();
        expect(openPanel).toHaveBeenCalledTimes(1);
    });
});
