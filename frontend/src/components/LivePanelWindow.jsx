import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function LivePanelWindow({ title, open, onClose, children }) {
  const [portalContainer, setPortalContainer] = useState(null);
  const windowRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setPortalContainer(null);
      return;
    }

    const w = window.open("", title, "width=1200,height=800");
    if (!w) return;

    windowRef.current = w;

    w.document.body.style.margin = "0";
    w.document.body.style.background = "#050812";
    w.document.body.style.color = "#dbe7ff";
    w.document.body.style.fontFamily = "JetBrains Mono, monospace";
    w.document.body.style.padding = "20px";
    w.document.body.style.minHeight = "100vh";

    // Copy parent stylesheets once
    try {
      Array.from(document.querySelectorAll("style, link[rel='stylesheet']")).forEach((node) => {
        try { w.document.head.appendChild(node.cloneNode(true)); } catch {}
      });
    } catch {}

    const titleEl = w.document.createElement("h2");
    titleEl.innerText = title;
    titleEl.style.margin = "0 0 18px 0";
    titleEl.style.fontFamily = "JetBrains Mono, monospace";
    titleEl.style.color = "#dbe7ff";

    const popupContainer = w.document.createElement("div");
    popupContainer.style.minHeight = "100vh";
    popupContainer.style.background = "#050812";
    popupContainer.style.color = "#dbe7ff";
    popupContainer.style.fontFamily = "JetBrains Mono, monospace";
    popupContainer.style.padding = "8px 16px";

    w.document.body.appendChild(titleEl);
    w.document.body.appendChild(popupContainer);

    // Trigger re-render so createPortal gets the real container
    setPortalContainer(popupContainer);

    const timer = setInterval(() => {
      if (w.closed) {
        clearInterval(timer);
        setPortalContainer(null);
        onClose();
      }
    }, 500);

    return () => {
      clearInterval(timer);
      try { w.close(); } catch {}
      setPortalContainer(null);
    };
  }, [open]);

  if (!open || !portalContainer) return null;
  return createPortal(children, portalContainer);
}
