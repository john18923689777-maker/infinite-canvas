import { GithubOutlined } from "@ant-design/icons";

import { cn } from "@/lib/utils";
import { SOURCE_URL } from "@/constant/runtime-config";
import { isCustomerMode } from "@/lib/customer-mode";

type GitHubLinkProps = {
    className?: string;
    style?: React.CSSProperties;
};

export function GitHubLink({ className, style }: GitHubLinkProps) {
    const sourceUrl = isCustomerMode() && isExactGitHubCommitUrl(SOURCE_URL) ? SOURCE_URL : "https://github.com/basketikun/infinite-canvas";
    return (
        <a
            className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white", className)}
            style={style}
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
        >
            <GithubOutlined className="text-base" />
        </a>
    );
}

function isExactGitHubCommitUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password && !url.search && !url.hash && /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}$/i.test(url.pathname);
    } catch {
        return false;
    }
}
