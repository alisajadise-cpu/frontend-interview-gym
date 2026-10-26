import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

type Props = {
  source: string;
  /** Repo path of the file being shown, e.g. "js/README.md". Relative links resolve against it. */
  path: string;
  /** Maps a repo path ("react/01-autocomplete/README.md") to an in-app hash link, or null. */
  linkFor: (repoPath: string) => string | null;
};

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function resolve(href: string, from: string) {
  const url = new URL(href, `https://repo.local/${from}`);
  return decodeURIComponent(url.pathname.slice(1));
}

export default function Markdown({ source, path, linkFor }: Props) {
  const heading =
    (Tag: 'h1' | 'h2' | 'h3' | 'h4') =>
    ({ children }: { children?: ReactNode }) => (
      <Tag id={slugify(textOf(Children.toArray(children)))}>{children}</Tag>
    );

  const components: Components = {
    h1: heading('h1'),
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    a: ({ href = '', children }) => {
      // In-page anchors: scroll instead of changing the hash route.
      if (href.startsWith('#')) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {children}
          </a>
        );
      }
      if (/^[a-z]+:/i.test(href)) {
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      }
      const target = resolve(href.split('#')[0], path);
      const link = linkFor(target);
      if (link) return <a href={link}>{children}</a>;
      // A source file or folder with no page in the app: show its path instead of a broken link.
      return (
        <span className="file-ref" title={`Open ${target} in your editor`}>
          {children}
        </span>
      );
    },
    table: ({ children }) => (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    ),
  };

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
