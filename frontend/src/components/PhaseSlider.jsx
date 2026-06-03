import { useEffect, useState } from "react";

export default function PhaseSlider() {

  const phases = [

    {
      phase:"01",
      title:"Lexical Analysis",
      subtitle:"Converts source code into tokens",
      color:"#4488ff",

      input:`int x = 10;`,

      output:`[INT] [ID] [ASSIGN] [NUM]`,
    },

    {
      phase:"02",
      title:"Syntax Parsing",
      subtitle:"Builds Abstract Syntax Tree",
      color:"#aa44ff",

      input:`x = a + b * c`,

      output:
`Assign
 ├─ x
 └─ BinOp(+)
    ├─ a
    └─ BinOp(*)`,
    },

    {
      phase:"03",
      title:"Semantic Analysis",
      subtitle:"Validates types and scope",
      color:"#44ffaa",

      input:`int x = "hello"`,

      output:
`ERROR:
Type mismatch`,
    },

    {
      phase:"04",
      title:"IR Generation",
      subtitle:"Creates intermediate code",
      color:"#ffaa44",

      input:`x = a + b * c`,

      output:
`t1 = b * c
t2 = a + t1
x = t2`,
    },

    {
      phase:"05",
      title:"Optimization",
      subtitle:"Improves execution efficiency",
      color:"#ff8844",

      input:
`t1 = 3 + 4
x = t1`,

      output:`x = 7`,
    },

    {
      phase:"06",
      title:"Code Generation",
      subtitle:"Produces machine instructions",
      color:"#ff4488",

      input:`x = 7`,

      output:
`MOV R1,#7
RET`,
    },
  ];

  const [active,setActive] = useState(0);

  useEffect(()=>{

    const t = setInterval(()=>{
      setActive(prev => (prev + 1) % phases.length);
    },4000);

    return ()=>clearInterval(t);

  },[]);

  const p = phases[active];

  return (

    <div style={{
      width:"100%",
      maxWidth:"1850px",
      margin:"150px auto 100px",
      padding:"0 28px",
      position:"relative",
      zIndex:2,
    }}>

      <div style={{
        position:"relative",
        overflow:"hidden",
        borderRadius:"34px",
        border:"1px solid rgba(255,255,255,0.08)",
        background:"rgba(8,10,24,0.78)",
        backdropFilter:"blur(24px)",
        WebkitBackdropFilter:"blur(24px)",
        boxShadow:"0 40px 120px rgba(0,0,0,0.55)",
        minHeight:"320px",
      }}>

        {/* Glow */}
        <div style={{
          position:"absolute",
          width:"520px",
          height:"520px",
          borderRadius:"50%",
          background:`radial-gradient(circle, ${p.color}22, transparent 70%)`,
          right:"-8%",
          top:"-10%",
          filter:"blur(60px)",
          pointerEvents:"none",
        }}/>

        <div style={{
          display:"grid",
          gridTemplateColumns:"0.95fr 1.05fr",
          minHeight:"560px",
        }}>

          {/* LEFT */}
          <div style={{
            padding:"70px",
            display:"flex",
            flexDirection:"column",
            justifyContent:"center",
          }}>

            <div style={{
              fontFamily:"'JetBrains Mono', monospace",
              fontSize:"12px",
              letterSpacing:"4px",
              color:p.color,
              marginBottom:"20px",
            }}>
              PHASE {p.phase}
            </div>

            <h2 style={{
              fontSize:"clamp(42px,5vw,72px)",
              fontWeight:800,
              lineHeight:1,
              wordBreak:"break-word",
              letterSpacing:"-4px",
              color:"#ffffff",
              margin:"0 0 22px 0",
              maxWidth:"600px",
            }}>
              {p.title}
            </h2>

            <p style={{
              fontSize:"18px",
              lineHeight:1.8,
              color:"rgba(255,255,255,0.58)",
              maxWidth:"460px",
              margin:0,
            }}>
              {p.subtitle}
            </p>

            {/* Indicators */}
            <div style={{
              display:"flex",
              gap:"10px",
              marginTop:"42px",
            }}>

              {phases.map((_,i)=>(

                <div
                  key={i}
                  style={{
                    width: active===i ? "48px" : "12px",
                    height:"12px",
                    borderRadius:"999px",
                    background:
                      active===i
                        ? p.color
                        : "rgba(255,255,255,0.12)",
                    transition:"all .35s ease",
                  }}
                />

              ))}

            </div>

          </div>

          {/* RIGHT */}
          <div style={{
            padding:"48px",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
          }}>

            <div style={{
              width:"100%",
              maxWidth:"900px",
              background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:"28px",
              overflow:"hidden",
              boxShadow:"0 20px 60px rgba(0,0,0,0.45)",
            }}>

              {/* Top Bar */}
              <div style={{
                padding:"18px 24px",
                borderBottom:"1px solid rgba(255,255,255,0.06)",
                fontFamily:"'JetBrains Mono', monospace",
                fontSize:"11px",
                letterSpacing:"1px",
                color:"rgba(255,255,255,0.35)",
              }}>
                compiler transformation
              </div>

              {/* Main Content */}
              <div style={{
                padding:"42px",
                display:"flex",
                flexDirection:"column",
                gap:"28px",
              }}>

                {/* INPUT */}
                <div>

                  <div style={{
                    fontSize:"11px",
                    letterSpacing:"2px",
                    marginBottom:"12px",
                    color:"rgba(255,255,255,0.35)",
                    fontFamily:"'JetBrains Mono', monospace",
                  }}>
                    INPUT
                  </div>

                  <pre style={{
                    margin:0,
                    fontFamily:"'JetBrains Mono', monospace",
                    fontSize:"20px",
                    lineHeight:1.8,
                    color:"#dbe7ff",
                    whiteSpace:"pre-wrap",
                    wordBreak:"break-word",
                  }}>
                    {p.input}
                  </pre>

                </div>

                {/* Arrow */}
                <div style={{
                  display:"flex",
                  justifyContent:"center",
                  alignItems:"center",
                  fontSize:"32px",
                  color:p.color,
                }}>
                  ↓
                </div>

                {/* OUTPUT */}
                <div>

                  <div style={{
                    fontSize:"11px",
                    letterSpacing:"2px",
                    marginBottom:"12px",
                    color:"rgba(255,255,255,0.35)",
                    fontFamily:"'JetBrains Mono', monospace",
                  }}>
                    OUTPUT
                  </div>

                  <pre style={{
                    margin:0,
                    fontFamily:"'JetBrains Mono', monospace",
                    fontSize:"16px",
                    lineHeight:1.9,
                    color:p.color,
                    whiteSpace:"pre-wrap",
                    wordBreak:"break-word",
                  }}>
                    {p.output}
                  </pre>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}