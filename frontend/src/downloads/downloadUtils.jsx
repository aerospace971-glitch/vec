const MIME_TYPES = {
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  asm: "text/plain;charset=utf-8",
  log: "text/plain;charset=utf-8",
  png: "image/png",
};

export function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function makeFilename(prefix, extension, date = new Date()) {
  const cleanPrefix = String(prefix || "download")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "download";
  const cleanExt = String(extension || "txt").replace(/^\./, "");
  return `${cleanPrefix}-${timestampForFilename(date)}.${cleanExt}`;
}

export function createBlob(content, type = "txt") {
  const mime = MIME_TYPES[type] || MIME_TYPES.txt;
  return content instanceof Blob ? content : new Blob([content ?? ""], { type: mime });
}

export function triggerDownload(blobOrContent, filename, type = "txt") {
  const blob = blobOrContent instanceof Blob ? blobOrContent : createBlob(blobOrContent, type);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || makeFilename("download", type);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadContent(content, filename, type = "txt") {
  triggerDownload(createBlob(content, type), filename, type);
}
