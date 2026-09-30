import React, { JSX } from "react";
import { IPageWrapperProps, PageWrapper } from "./pageWrapper";
import { Tailwind_markPageContext, TAILWIND_PAGE_MARKER_CLASS } from "../utils/tailwindConfig";
import { PAGE_THEME_STORAGE_KEY, PageTheme_backgroundColor } from "../utils/pageTheme";

Tailwind_markPageContext();

export interface IJsonLdArticle {
  type: "Article";
  headline: string;
  description?: string;
  author?: string;
  image?: string;
  mainEntityOfPage?: string;
  datePublished?: string;
  dateModified?: string;
}

export interface IJsonLdBreadcrumbItem {
  name: string;
  url?: string;
}

export interface IJsonLdBreadcrumbs {
  type: "BreadcrumbList";
  items: IJsonLdBreadcrumbItem[];
}

export interface IJsonLdSoftwareApp {
  type: "SoftwareApplication";
  name: string;
  applicationCategory?: string;
  operatingSystem?: string;
  url?: string;
  price?: string;
  priceCurrency?: string;
  featureList?: string;
}

export interface IJsonLdItemListEntry {
  name: string;
  url: string;
}

export interface IJsonLdItemList {
  type: "ItemList";
  name: string;
  items: IJsonLdItemListEntry[];
}

export interface IJsonLdFAQEntry {
  question: string;
  answer: string;
}

export interface IJsonLdFAQ {
  type: "FAQPage";
  questions: IJsonLdFAQEntry[];
}

export interface IJsonLdHowToStep {
  name: string;
  text: string;
}

export interface IJsonLdHowTo {
  type: "HowTo";
  name: string;
  step: IJsonLdHowToStep[];
}

export interface IJsonLdVideoObject {
  type: "VideoObject";
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate?: string;
  contentUrl?: string;
  embedUrl: string;
}

export type IJsonLd =
  | IJsonLdArticle
  | IJsonLdBreadcrumbs
  | IJsonLdSoftwareApp
  | IJsonLdItemList
  | IJsonLdFAQ
  | IJsonLdHowTo
  | IJsonLdVideoObject;

function jsonLdToSchema(ld: IJsonLd): object {
  const base = { "@context": "https://schema.org" as const };
  switch (ld.type) {
    case "Article":
      return {
        ...base,
        "@type": "Article",
        headline: ld.headline,
        ...(ld.description ? { description: ld.description } : {}),
        ...(ld.author ? { author: { "@type": "Person", name: ld.author } } : {}),
        publisher: { "@type": "Organization", name: "Liftosaur", url: "https://www.liftosaur.com" },
        ...(ld.image ? { image: ld.image } : {}),
        ...(ld.mainEntityOfPage ? { mainEntityOfPage: ld.mainEntityOfPage } : {}),
        ...(ld.datePublished ? { datePublished: ld.datePublished } : {}),
        ...(ld.dateModified ? { dateModified: ld.dateModified } : {}),
      };
    case "BreadcrumbList":
      return {
        ...base,
        "@type": "BreadcrumbList",
        itemListElement: ld.items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          ...(item.url ? { item: item.url } : {}),
        })),
      };
    case "SoftwareApplication":
      return {
        ...base,
        "@type": "SoftwareApplication",
        name: ld.name,
        ...(ld.applicationCategory ? { applicationCategory: ld.applicationCategory } : {}),
        ...(ld.operatingSystem ? { operatingSystem: ld.operatingSystem } : {}),
        ...(ld.url ? { url: ld.url } : {}),
        ...(ld.featureList ? { featureList: ld.featureList } : {}),
        ...(ld.price != null
          ? { offers: { "@type": "Offer", price: ld.price, priceCurrency: ld.priceCurrency || "USD" } }
          : {}),
      };
    case "ItemList":
      return {
        ...base,
        "@type": "ItemList",
        name: ld.name,
        numberOfItems: ld.items.length,
        itemListElement: ld.items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          url: item.url,
        })),
      };
    case "FAQPage":
      return {
        ...base,
        "@type": "FAQPage",
        mainEntity: ld.questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: { "@type": "Answer", text: q.answer },
        })),
      };
    case "HowTo":
      return {
        ...base,
        "@type": "HowTo",
        name: ld.name,
        step: ld.step.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      };
    case "VideoObject":
      return {
        ...base,
        "@type": "VideoObject",
        name: ld.name,
        description: ld.description,
        thumbnailUrl: ld.thumbnailUrl,
        ...(ld.uploadDate ? { uploadDate: ld.uploadDate } : {}),
        ...(ld.contentUrl ? { contentUrl: ld.contentUrl } : {}),
        embedUrl: ld.embedUrl,
      };
  }
}

interface IProps<T> extends IPageWrapperProps {
  title: string;
  canonical: string;
  css: string[];
  js: string[];
  ogTitle?: string;
  description?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  jsonLd?: IJsonLd[];
  data: T;
  postHead?: JSX.Element;
  isLoggedIn?: boolean;
  nowrapper?: boolean;
  redditPixel?: boolean;
  preloadMono?: boolean;
}

declare let __COMMIT_HASH__: string;
declare let __FULL_COMMIT_HASH__: string;

export function Page<T>(props: IProps<T>): JSX.Element {
  const commitHash = process.env.COMMIT_HASH || __COMMIT_HASH__;
  const pageWrapperProps: IPageWrapperProps = {
    skipTopNavMenu: props.skipTopNavMenu,
    maxWidth: props.maxWidth,
    maxBodyWidth: props.maxBodyWidth,
    url: props.url,
    skipFooter: props.skipFooter,
    isLoggedIn: props.isLoggedIn,
    client: props.client,
  };
  return (
    <html lang="en" className={TAILWIND_PAGE_MARKER_CLASS}>
      <head>
        <title>{props.title}</title>
        {props.css.map((c) => (
          <link key={c} rel="stylesheet" type="text/css" href={`/${c}.css?version=${commitHash}`} />
        ))}
        <meta charSet="UTF-8" />
        <link rel="preconnect" href="https://api3.liftosaur.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="shortcut icon" type="image/x-icon" href="/icons/favicon.ico" />
        <link rel="canonical" href={props.canonical} />
        <link rel="apple-touch-icon" href="/icons/icon512.png" />
        <meta name="theme-color" content={PageTheme_backgroundColor("light")} />
        <meta name="description" content={props.description} />
        <script
          async
          type="text/javascript"
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
        ></script>
        <meta property="og:title" content={props.ogTitle || props.title} />
        <meta property="og:description" content={props.ogDescription || props.description} />
        <meta property="fb:app_id" content="3448767138535273" />
        {props.ogUrl && <meta property="og:url" content={props.ogUrl} />}
        <meta property="og:type" content={props.ogType || "website"} />
        {props.ogImage && <meta property="og:image" content={props.ogImage} />}
        <meta property="twitter:card" content="summary_large_image" />
        <script dangerouslySetInnerHTML={{ __html: applyThemeBeforePaint() }} />
        <script dangerouslySetInnerHTML={{ __html: rollbarStub() }} />
        <script defer src={`/consent.js?version=${commitHash}`}></script>
        {props.jsonLd?.map((ld, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdToSchema(ld)) }}
          />
        ))}
        <link
          rel="preload"
          href="/fonts/Poppins-Regular.latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Poppins-SemiBold.latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Poppins-Bold.latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {props.preloadMono && (
          <link rel="preload" href="/fonts/iosevka-regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        )}
        {props.postHead}
      </head>
      <body>
        <div className="content" id="app">
          {props.nowrapper ? (
            typeof props.children === "function" ? (
              (props.children as (ctx: Record<string, unknown>) => React.ReactNode)({})
            ) : (
              props.children
            )
          ) : (
            <PageWrapper {...pageWrapperProps}>{props.children}</PageWrapper>
          )}
        </div>
        <div id="pagewrapper" style={{ display: "none" }}>
          {JSON.stringify(pageWrapperProps)}
        </div>
        <div id="data" style={{ display: "none" }}>
          {JSON.stringify(props.data)}
        </div>
        {props.js.map((js) => (
          <script key={js} src={`/${js}.js?version=${commitHash}`}></script>
        ))}
        <div id="modal"></div>
        <div id="bottomsheet"></div>
        <div id="keyboard"></div>
      </body>
    </html>
  );
}

// Upstream's Rollbar telemetry is removed so no data leaves for their project, but app code still calls the global.
function rollbarStub(): string {
  return `window.Rollbar = window.Rollbar || { configure: function () {}, error: function () {} };`;
}

function applyThemeBeforePaint(): string {
  return `
    (function() {
      try {
        var stored = null;
        try {
          stored = window.localStorage.getItem("${PAGE_THEME_STORAGE_KEY}");
        } catch (e) {}
        var theme;
        if (stored === "dark" || stored === "light") {
          theme = stored;
        } else if (typeof window.lftSystemDarkMode === "boolean") {
          theme = window.lftSystemDarkMode ? "dark" : "light";
        } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
          theme = "dark";
        } else {
          theme = "light";
        }
        var root = document.documentElement;
        root.classList.add(theme);
        root.classList.remove(theme === "dark" ? "light" : "dark");
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
          meta.setAttribute("content", theme === "dark" ? "${PageTheme_backgroundColor("dark")}" : "${PageTheme_backgroundColor("light")}");
        }
      } catch (e) {}
    })();
  `;
}
