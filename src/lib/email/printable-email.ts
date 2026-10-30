import sanitizeHtml from "sanitize-html";

// Email is untrusted. Preserve the content and invoice table structure while
// removing executable elements, forms, remote assets, links and inline CSS.
export function printableEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["div", "span", "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "ul", "ol", "li", "blockquote", "pre", "code", "img"],
    allowedAttributes: { td: ["colspan", "rowspan"], th: ["colspan", "rowspan"], img: ["src", "alt", "width", "height"] },
    allowedSchemesByTag: { img: ["data"] },
    exclusiveFilter: frame => frame.tag === "img" && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(frame.attribs.src ?? ""),
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "svg", "math"],
  });
}
