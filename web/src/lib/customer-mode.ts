type CustomerModeInputs = {
    build: unknown;
    runtime?: unknown;
};

const CUSTOMER_QUERY_KEYS = ["baseUrl", "baseurl", "apiKey", "apikey", "agentUrl", "agentToken"] as const;

function isExactTrue(value: unknown) {
    return value === true || value === "true";
}

export function resolveCustomerMode({ build, runtime }: CustomerModeInputs): boolean {
    return isExactTrue(build) || isExactTrue(runtime);
}

export function isCustomerMode(): boolean {
    const runtime = typeof window !== "undefined" ? window.__RUNTIME_CONFIG__?.CUSTOMER_MODE : undefined;
    return resolveCustomerMode({ build: import.meta.env.VITE_CUSTOMER_MODE, runtime });
}

function currentOrigin() {
    return typeof window !== "undefined" ? window.location.origin : "";
}

export function customerOpenAIBaseUrl() {
    return currentOrigin();
}

export function customerGeminiBaseUrl() {
    return currentOrigin();
}

/** Customer mode permits only the current scheme/host/port at the root path; callers canonicalize it to window.location.origin. */
export function canUseExternalBaseUrl(baseUrl: string) {
    if (!isCustomerMode()) return true;
    const origin = currentOrigin();
    if (!origin) return false;
    try {
        const parsed = new URL(baseUrl || origin, origin);
        return parsed.origin === origin && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && (parsed.pathname === "" || parsed.pathname === "/");
    } catch {
        return false;
    }
}

export function canImportApiConfig() {
    return !isCustomerMode();
}

export function canImportAgentConfig() {
    return !isCustomerMode();
}

export function stripCustomerModeQueryParams(value: string) {
    if (!isCustomerMode()) return value;
    const hashIndex = value.indexOf("#");
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
    const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const queryIndex = beforeHash.indexOf("?");
    if (queryIndex < 0) return value;
    const prefix = beforeHash.slice(0, queryIndex);
    const rawQuery = beforeHash.slice(queryIndex + 1);
    const query = rawQuery
        .split("&")
        .filter((part) => {
            const rawKey = part.slice(0, part.indexOf("=") < 0 ? part.length : part.indexOf("="));
            let key = rawKey;
            try {
                key = decodeURIComponent(rawKey.replace(/\+/g, " "));
            } catch {
                // Keep malformed unrelated query keys visible.
            }
            return !(CUSTOMER_QUERY_KEYS as readonly string[]).includes(key);
        })
        .join("&");
    return query === rawQuery ? value : `${prefix}${query ? `?${query}` : ""}${hash}`;
}
