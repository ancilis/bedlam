import { isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";
import { mentionChipInlineStyle, parseMentionChipHref } from "../lib/mention-chips";

interface MarkdownBodyProps {
  children: string;
  className?: string;
  /** Optional resolver for relative image paths (e.g. within export packages) */
  resolveImageSrc?: (src: string) => string | null;
}

let mermaidLoaderPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidLoaderPromise) {
    mermaidLoaderPromise = import("mermaid").then((module) => module.default);
  }
  return mermaidLoaderPromise;
}

function flattenText(value: ReactNode): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenText(item)).join("");
  return "";
}

function extractMermaidSource(children: ReactNode): string | null {
  if (!isValidElement(children)) return null;
  const childProps = children.props as { className?: unknown; children?: ReactNode };
  if (typeof childProps.className !== "string") return null;
  if (!/\blanguage-mermaid\b/i.test(childProps.className)) return null;
  return flattenText(childProps.children).replace(/\n$/, "");
}

function isSafeMarkdownUrl(rawUrl: string, opts?: { allowMentionSchemes?: boolean }): boolean {
  const url = rawUrl.trim();
  if (!url) return true;
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  if (url.startsWith("#")) return true;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (url.startsWith("./") || url.startsWith("../")) return true;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return !url.startsWith("//");
  }

  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol)
      || (opts?.allowMentionSchemes === true && ["agent:", "project:"].includes(parsed.protocol));
  } catch {
    return false;
  }
}

function sanitizeMarkdownUrl(url: string): string {
  return isSafeMarkdownUrl(url, { allowMentionSchemes: true }) ? url : "";
}

function MermaidDiagramBlock({ source, darkMode }: { source: string; darkMode: boolean }) {
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: darkMode ? "dark" : "default",
          fontFamily: "inherit",
          suppressErrorRendering: true,
        });
        const rendered = await mermaid.render(`bedlam-mermaid-${renderId}`, source);
        if (!active) return;
        setSvg(rendered.svg);
      })
      .catch((err) => {
        if (!active) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to render Mermaid diagram.";
        setError(message);
      });

    return () => {
      active = false;
    };
  }, [darkMode, renderId, source]);

  return (
    <div className="bedlam-mermaid">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <>
          <p className={cn("bedlam-mermaid-status", error && "bedlam-mermaid-status-error")}>
            {error ? `Unable to render Mermaid diagram: ${error}` : "Rendering Mermaid diagram..."}
          </p>
          <pre className="bedlam-mermaid-source">
            <code className="language-mermaid">{source}</code>
          </pre>
        </>
      )}
    </div>
  );
}

export function MarkdownBody({ children, className, resolveImageSrc }: MarkdownBodyProps) {
  const { theme } = useTheme();
  const components: Components = {
    pre: ({ node: _node, children: preChildren, ...preProps }) => {
      const mermaidSource = extractMermaidSource(preChildren);
      if (mermaidSource) {
        return <MermaidDiagramBlock source={mermaidSource} darkMode={theme === "dark"} />;
      }
      return <pre {...preProps}>{preChildren}</pre>;
    },
    a: ({ href, children: linkChildren }) => {
      const parsed = href ? parseMentionChipHref(href) : null;
      if (parsed) {
        const targetHref = parsed.kind === "project"
          ? `/projects/${parsed.projectId}`
          : `/agents/${parsed.agentId}`;
        return (
          <a
            href={targetHref}
            className={cn(
              "bedlam-mention-chip",
              `bedlam-mention-chip--${parsed.kind}`,
              parsed.kind === "project" && "bedlam-project-mention-chip",
            )}
            data-mention-kind={parsed.kind}
            style={mentionChipInlineStyle(parsed)}
          >
            {linkChildren}
          </a>
        );
      }
      const isMentionScheme = href ? /^(agent|project):/i.test(href.trim()) : false;
      const safeHref = href && !isMentionScheme && isSafeMarkdownUrl(href) ? href : undefined;
      return (
        <a href={safeHref} rel="noreferrer">
          {linkChildren}
        </a>
      );
    },
  };
  if (resolveImageSrc) {
    components.img = ({ node: _node, src, alt, ...imgProps }) => {
      const resolved = src ? resolveImageSrc(src) : null;
      const safeSrc = resolved ?? src;
      if (!safeSrc || !isSafeMarkdownUrl(safeSrc)) return null;
      return <img {...imgProps} src={safeSrc} alt={alt ?? ""} />;
    };
  } else {
    components.img = ({ node: _node, src, alt, ...imgProps }) => {
      if (!src || !isSafeMarkdownUrl(src)) return null;
      return <img {...imgProps} src={src} alt={alt ?? ""} />;
    };
  }

  return (
    <div
      className={cn(
        "bedlam-markdown prose prose-sm max-w-none break-words overflow-hidden",
        theme === "dark" && "prose-invert",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={components} urlTransform={sanitizeMarkdownUrl}>
        {children}
      </Markdown>
    </div>
  );
}
