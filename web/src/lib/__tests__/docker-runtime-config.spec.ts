import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const entrypointPath = resolve(process.cwd(), "docker-entrypoint.sh");
const temporaryDirectories: string[] = [];

function generateRuntimeConfig(customerMode?: string, sourceUrl?: string) {
    const directory = mkdtempSync(join(tmpdir(), "canvas-runtime-config-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "config.js");
    const scriptPath = join(directory, "docker-entrypoint.sh");
    const buildInfoPath = join(directory, "build-info.json");
    const script = readFileSync(entrypointPath, "utf8")
        .replaceAll("/usr/share/nginx/html/config.js", outputPath)
        .replaceAll("/usr/share/nginx/html/build-info.json", buildInfoPath);
    writeFileSync(scriptPath, script);
    const env = { ...process.env };
    if (customerMode === undefined) delete env.CUSTOMER_MODE;
    else env.CUSTOMER_MODE = customerMode;
    if (sourceUrl === undefined) delete env.SOURCE_URL;
    else env.SOURCE_URL = sourceUrl;
    const result = spawnSync("sh", [scriptPath], { env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return { config: readFileSync(outputPath, "utf8"), buildInfo: readFileSync(join(directory, "build-info.json"), "utf8") };
}

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("Docker runtime customer mode", () => {
    it("emits exact true as a JavaScript boolean", () => {
        expect(generateRuntimeConfig("true").config).toContain("CUSTOMER_MODE: true");
    });

    it.each([undefined, "", "false", "TRUE", "yes", "1"])("emits false for %p", (value) => {
        expect(generateRuntimeConfig(value).config).toContain("CUSTOMER_MODE: false");
    });

    it("does not interpolate malformed input into JavaScript", () => {
        const payload = 'true }; globalThis.injected = "yes"; //';
        const config = generateRuntimeConfig(payload).config;
        expect(config).toContain("CUSTOMER_MODE: false");
        expect(config).not.toContain(payload);
        expect(config).not.toContain("globalThis.injected");
    });

    it("emits sanitized build provenance without secrets", () => {
        const sourceUrl = "https://github.com/customer/infinite-canvas/commit/abc1234";
        const result = generateRuntimeConfig("true", sourceUrl);
        const info = JSON.parse(result.buildInfo) as Record<string, string>;
        expect(info.source_commit).toBe("unknown");
        expect(info.source_url).toBe(sourceUrl);
        expect(result.config).toContain(`SOURCE_URL: "${sourceUrl}"`);
        expect(result.config).not.toContain("Authorization");
        expect(result.config).not.toContain("apiKey");
    });
});
