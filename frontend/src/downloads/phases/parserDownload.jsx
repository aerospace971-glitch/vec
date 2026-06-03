import { select } from "d3";
import { buildJSON } from "../formats/json";
import { makeFilename, triggerDownload, downloadContent } from "../downloadUtils";

export function shapeAST(ast) {
  return ast ?? null;
}

export function downloadAST_JSON(ast, filename = makeFilename("parser-ast", "json")) {
  downloadContent(buildJSON(shapeAST(ast)), filename, "json");
}

export async function downloadAST_PNG(svgElementOrSelector, filename = makeFilename("parser-ast", "png")) {
  const svgNode = typeof svgElementOrSelector === "string"
    ? document.querySelector(svgElementOrSelector)
    : svgElementOrSelector;

  if (!svgNode) {
    throw new Error("AST SVG element not found for PNG download.");
  }

  const clone = svgNode.cloneNode(true);
  const bbox = svgNode.getBBox?.();
  const width = Math.ceil(
    Number(svgNode.getAttribute("width")) ||
    svgNode.clientWidth ||
    bbox?.width ||
    1200
  );
  const height = Math.ceil(
    Number(svgNode.getAttribute("height")) ||
    svgNode.clientHeight ||
    bbox?.height ||
    800
  );

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const styleText = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  if (styleText) {
    select(clone).insert("style", ":first-child").text(styleText);
  }

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#04030f";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("Could not render AST PNG.");
    triggerDownload(pngBlob, filename, "png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
