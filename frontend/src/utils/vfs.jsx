const API = "";

export function vfsKey(userId) { return `metamic_vfs_${userId}`; }

export function loadVFS(userId) {
  try { return JSON.parse(localStorage.getItem(vfsKey(userId))) || { folders: [], files: [] }; }
  catch { return { folders: [], files: [] }; }
}

export function saveVFS(userId, vfs) {
  localStorage.setItem(vfsKey(userId), JSON.stringify(vfs));
}

export function pushVFS(token, vfs, kind) {
  if (!token) return;
  fetch(`${API}/vfs/sync`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, folders: vfs.folders || [], files: vfs.files || [] }),
  }).catch(() => {});
}

export async function fetchVFS(token, kind) {
  try {
    const r = await fetch(`${API}/vfs?kind=${kind}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadBuildVFS(userId) {
  try { return JSON.parse(localStorage.getItem(`metamic_build_vfs_${userId}`)) || { folders: [], files: [] }; }
  catch { return { folders: [], files: [] }; }
}
