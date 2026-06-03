import { useState } from "react";

export default function PanelWindow({
  title,
  children,
  height="auto",
}) {

  const [fullscreen,setFullscreen]=useState(false);

function openInNewWindow(){

  window.dispatchEvent(

    new CustomEvent("open-live-panel",{

      detail:{title}

    })

  );
}

  return (

    <div
      style={{
        position:fullscreen?"fixed":"relative",
        inset:fullscreen?0:"auto",
        zIndex:fullscreen?10000:"auto",
        background:fullscreen?"#050812":"transparent",
        padding:fullscreen?"20px":"0",
        overflow:fullscreen?"auto":"visible",
        display:"flex",
        flexDirection:"column",
        height:"100%",
      }}
    >

      <div
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          padding:"8px 14px",
          background:"var(--bg3, #080d1e)",
          borderBottom:"1px solid var(--border, rgba(255,255,255,0.1))",
          fontFamily:"var(--font-mono, 'JetBrains Mono',monospace)",
          fontSize:"9px",
          fontWeight:700,
          letterSpacing:"1.5px",
          color:"var(--text3, #a0aec0)",
          textTransform:"uppercase",
          flexShrink:0,
        }}
      >

        <span>{title}</span>

        <div style={{display:"flex",gap:"6px"}}>

        <button
            onClick={()=>setFullscreen(v=>!v)}
            style={{
            background:"rgba(255,255,255,0.05)",
            border:"1px solid var(--border2, rgba(255,255,255,0.1))",
            color:"var(--text2, rgba(255,255,255,0.6))",
            borderRadius:"4px",
            padding:"2px 8px",
            cursor:"pointer",
            fontSize:"10px",
            }}
        >
            {fullscreen?"🗗":"🗖"}
        </button>

        <button
            onClick={openInNewWindow}
            style={{
            background:"rgba(255,255,255,0.05)",
            border:"1px solid var(--border2, rgba(255,255,255,0.1))",
            color:"var(--text2, rgba(255,255,255,0.6))",
            borderRadius:"4px",
            padding:"2px 8px",
            cursor:"pointer",
            fontSize:"10px",
            }}
        >
            ↗
        </button>

        </div>

      </div>

      <div
        id={title}
        style={{
          flex:1,
          minHeight:0,
          overflowY:"auto",
          overflowX:"hidden",
          scrollbarWidth:"thin",
          scrollbarColor:"rgba(255,255,255,0.1) transparent",
        }}
      >
        {children}
      </div>

    </div>
  );
}