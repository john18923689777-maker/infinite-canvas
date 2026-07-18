// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNavigationTools } from "@/constant/navigation-tools";
import { CUSTOMER_DEFAULT_PATH, customerRouteRedirect, isCustomerRouteAllowed, type AppRouteId } from "@/lib/customer-mode";

describe("customer navigation policy", () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        delete window.__RUNTIME_CONFIG__;
    });

    it("allows only the image, asset, and canvas workflows in customer mode", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");

        const allowed: AppRouteId[] = ["image", "assets", "canvas", "canvas-project"];
        const disabled: AppRouteId[] = ["home", "video", "prompts", "config"];

        expect(allowed.every((routeId) => isCustomerRouteAllowed(routeId))).toBe(true);
        expect(disabled.every((routeId) => !isCustomerRouteAllowed(routeId))).toBe(true);
        expect(getNavigationTools().map((tool) => tool.slug)).toEqual(["canvas", "image", "assets"]);
    });

    it("redirects filtered direct links before their page can render", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "true");

        expect(customerRouteRedirect("/video")).toBe(CUSTOMER_DEFAULT_PATH);
        expect(customerRouteRedirect("/prompts")).toBe(CUSTOMER_DEFAULT_PATH);
        expect(customerRouteRedirect("/config")).toBe(CUSTOMER_DEFAULT_PATH);
        expect(customerRouteRedirect("/agent/threads/1")).toBe(CUSTOMER_DEFAULT_PATH);
        expect(customerRouteRedirect("/")).toBe(CUSTOMER_DEFAULT_PATH);
        expect(customerRouteRedirect("/canvas")).toBeNull();
        expect(customerRouteRedirect("/canvas/project-1")).toBeNull();
        expect(customerRouteRedirect("/image")).toBeNull();
        expect(customerRouteRedirect("/assets")).toBeNull();
    });

    it("retains every upstream tool and route outside customer mode", () => {
        vi.stubEnv("VITE_CUSTOMER_MODE", "false");

        expect(getNavigationTools().map((tool) => tool.slug)).toEqual(["canvas", "image", "video", "prompts", "assets", "config"]);
        expect(customerRouteRedirect("/video")).toBeNull();
        expect(customerRouteRedirect("/prompts")).toBeNull();
        expect(customerRouteRedirect("/config")).toBeNull();
        expect(customerRouteRedirect("/")).toBeNull();
    });
});
