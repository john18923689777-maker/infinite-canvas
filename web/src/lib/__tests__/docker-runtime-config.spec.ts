import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const entrypointPath = resolve(process.cwd(), "docker-entrypoint.sh");
const temporaryDirectories: string[] = [];

function generateRuntimeConfig(customerMode?: string) {
    const directory = mkdtempSync(join(tmpdir(), "canvas-runtime-config-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "config.js");
    const scriptPath = join(directory, "docker-entrypoint.sh");
    const script = readFileSync(entrypointPath, "utf8").replace("/usr/share/nginx/html/config.js", outputPath);
    writeFileSync(scriptPath, script);
    const env = { ...process.env };
    if (customerMode === undefined) delete env.CUSTOMER_MODE;
    else env.CUSTOMER_MODE = customerMode;
    const result = spawnSync("sh", [scriptPath], { env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return readFileSync(outputPath, "utf8");
}

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("Docker runtime customer mode", () => {
    it("emits exact true as a JavaScript boolean", () => {
        expect(generateRuntimeConfig("true")).toContain("CUSTOMER_MODE: true");
    });

    it.each([undefined, "", "false", "TRUE", "yes", "1"])("emits false for %p", (value) => {
        expect(generateRuntimeConfig(value)).toContain("CUSTOMER_MODE: false");
    });

    it("does not interpolate malformed input into JavaScript", () => {
        const payload = 'true }; globalThis.injected = "yes"; //';
        const config = generateRuntimeConfig(payload);
        expect(config).toContain("CUSTOMER_MODE: false");
        expect(config).not.toContain(payload);
        expect(config).not.toContain("globalThis.injected");
    });
});
