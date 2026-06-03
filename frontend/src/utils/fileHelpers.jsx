export function downloadFile(name, content) {
  const blob = new Blob([content || ""], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function getAllChildIds(folders, parentId) {
  const children = folders.filter(f => f.parentId === parentId).map(f => f.id);
  return children.flatMap(id => [id, ...getAllChildIds(folders, id)]);
}

export function getBreadcrumb(folders, folderId) {
  if (!folderId) return [];
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return [];
  return [...getBreadcrumb(folders, folder.parentId), folder];
}
