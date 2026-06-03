import { useState, useEffect } from "react";

const SAMPLES = [
{title:"for loop", code:`#include <iostream>
using namespace std;

int main() {
    // Sum 1 to 100 using for loop
    int sum = 0;
    for (int i = 1; i <= 100; i++) {
        sum += i;
    }
    cout << "Sum = " << sum << endl;
    return 0;
}`},
{title:"recursion", code:`#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int n = 6;
    cout << n << "! = "
         << factorial(n) << endl;
    return 0;
}`},
{title:"class & object", code:`#include <iostream>
using namespace std;

class Rectangle {
private:
    double width, height;
public:
    Rectangle(double w, double h)
        : width(w), height(h) {}

    double area() {
        return width * height;
    }
    double perimeter() {
        return 2 * (width + height);
    }
};

int main() {
    Rectangle r(5.5, 3.2);
    cout << "Area: "
         << r.area() << endl;
    return 0;
}`},
{title:"linked list", code:`#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
    Node(int val) : data(val), next(nullptr) {}
};

class LinkedList {
    Node* head;
public:
    LinkedList() : head(nullptr) {}

    void push(int val) {
        Node* n = new Node(val);
        n->next = head;
        head = n;
    }

    void print() {
        Node* cur = head;
        while (cur) {
            cout << cur->data << " → ";
            cur = cur->next;
        }
        cout << "NULL" << endl;
    }
};`},
{title:"inheritance", code:`#include <iostream>
using namespace std;

class Animal {
public:
    string name;
    Animal(string n) : name(n) {}
    virtual void speak() {
        cout << name << " speaks" << endl;
    }
};

class Dog : public Animal {
public:
    Dog(string n) : Animal(n) {}
    void speak() override {
        cout << name << " says: Woof!" << endl;
    }
};

class Cat : public Animal {
public:
    Cat(string n) : Animal(n) {}
    void speak() override {
        cout << name << " says: Meow!" << endl;
    }
};`},
{title:"bubble sort", code:`#include <iostream>
using namespace std;

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n-1; i++) {
        for (int j = 0; j < n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                // Swap elements
                int temp  = arr[j];
                arr[j]    = arr[j+1];
                arr[j+1]  = temp;
            }
        }
    }
}

int main() {
    int arr[] = {64,34,25,12,22,11,90};
    int n = sizeof(arr)/sizeof(arr[0]);
    bubbleSort(arr, n);
    for (int i = 0; i < n; i++)
        cout << arr[i] << " ";
    return 0;
}`},
];

function highlight(code) {
  const rules = [
    [/\b(int|float|double|char|bool|void|string|auto|const|static|class|struct|public|private|protected|virtual|override|return|if|else|for|while|do|switch|case|break|continue|new|delete|nullptr|true|false|this|using|namespace|include)\b/g,
      '<span style="color:#c792ea;font-weight:600">$1</span>'],
    [/"([^"]*)"/g, '<span style="color:#c3e88d">"$1"</span>'],
    [/\b(\d+\.?\d*)\b/g, '<span style="color:#f78c6c">$1</span>'],
    [/(\/\/[^\n]*)/g, '<span style="color:#4a6080;font-style:italic">$1</span>'],
    [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span style="color:#82aaff">$1</span>'],
    [/\b(cout|cin|endl|std)\b/g, '<span style="color:#89ddff">$1</span>'],
    [/(&lt;&lt;|&gt;&gt;|::|-&gt;)/g, '<span style="color:#89ddff">$1</span>'],
  ];
  let h = code
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  rules.forEach(([re, rep]) => { h = h.replace(re, rep); });
  return h;
}

export default function AutoTyper() {
  const [idx,      setIdx]      = useState(0);
  const [charIdx,  setCharIdx]  = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [displayed,setDisplayed]= useState("");

  const current = SAMPLES[idx];

  useEffect(() => {
    let t;
    if (!deleting && charIdx < current.code.length) {
      t = setTimeout(() => {
        setDisplayed(current.code.slice(0, charIdx + 1));
        setCharIdx(c => c + 1);
      }, charIdx === 0 ? 300 : 18);
    } else if (!deleting && charIdx === current.code.length) {
      t = setTimeout(() => setDeleting(true), 2200);
    } else if (deleting && charIdx > 0) {
      t = setTimeout(() => {
        setDisplayed(current.code.slice(0, charIdx - 1));
        setCharIdx(c => c - 1);
      }, 8);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setIdx(i => (i + 1) % SAMPLES.length);
    }
    return () => clearTimeout(t);
  }, [charIdx, deleting, idx]);

  const lines = displayed.split("\n");

  return (
    <div style={{
      background:   "rgba(10,13,30,0.85)",
      border:       "1px solid rgba(26,86,219,0.25)",
      borderRadius: "14px",
      overflow:     "hidden",
      backdropFilter:"blur(12px)",
      boxShadow:    "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      {/* Window bar */}
      <div style={{
        background:  "rgba(15,18,35,0.9)",
        padding:     "11px 16px",
        display:     "flex",
        alignItems:  "center",
        gap:         "6px",
        borderBottom:"1px solid rgba(26,86,219,0.15)",
      }}>
        {["#ff5f57","#febc2e","#28c840"].map((c,i) => (
          <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:c }}/>
        ))}
        <span style={{
          marginLeft:  "10px",
          fontFamily:  "'JetBrains Mono',monospace",
          fontSize:    "11px",
          color:       "#3a5070",
        }}>
          {current.title}.cpp
        </span>
        <span style={{
          marginLeft:  "auto",
          fontFamily:  "'JetBrains Mono',monospace",
          fontSize:    "9px",
          color:       "#1a56db",
          background:  "rgba(26,86,219,0.12)",
          border:      "1px solid rgba(26,86,219,0.25)",
          borderRadius:"3px",
          padding:     "2px 8px",
          letterSpacing:"0.5px",
        }}>
          Input Source
        </span>
      </div>

      {/* Code */}
      <div style={{ display:"flex", minHeight:"220px" }}>
        {/* Line numbers */}
        <div style={{
          padding:     "14px 0",
          minWidth:    "42px",
          textAlign:   "right",
          background:  "rgba(8,10,22,0.6)",
          borderRight: "1px solid rgba(26,86,219,0.1)",
          userSelect:  "none",
        }}>
          {lines.map((_,i) => (
            <div key={i} style={{
              height:      "21px",
              lineHeight:  "21px",
              fontFamily:  "'JetBrains Mono',monospace",
              fontSize:    "11px",
              color:       "#2a3a5a",
              paddingRight:"10px",
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code content */}
        <div style={{
          padding:    "14px 18px",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize:   "12px",
          lineHeight: "21px",
          color:      "#c9d8f0",
          flex:       1,
          overflowX:  "auto",
          whiteSpace: "pre",
        }}>
          <span dangerouslySetInnerHTML={{ __html: highlight(displayed) }}/>
          <span style={{
            display:       "inline-block",
            width:         "2px",
            height:        "15px",
            background:    "#1a56db",
            verticalAlign: "middle",
            marginLeft:    "1px",
            animation:     "blink 1s step-start infinite",
          }}/>
        </div>
      </div>

      {/* Phase pills */}
      <div style={{
        padding:    "10px 16px",
        borderTop:  "1px solid rgba(26,86,219,0.12)",
        display:    "flex",
        gap:        "5px",
        alignItems: "center",
        flexWrap:   "wrap",
      }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#2a3a5a", marginRight:4, letterSpacing:"1px" }}>
          6 phases
        </span>
        {[
          {l:"Lexer",    c:"#4488ff"},
          {l:"Parser",   c:"#aa44ff"},
          {l:"Semantic", c:"#44aaff"},
          {l:"IR Gen",   c:"#44ffaa"},
          {l:"Optimizer",c:"#ffaa44"},
          {l:"CodeGen",  c:"#ff4488"},
        ].map((p,i) => <PhasePill key={i} label={p.l} color={p.c} index={i}/>)}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

function PhasePill({ label, color, index }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const cycle = 6000, offset = index * 1000;
    const tick = () => { setActive(true); setTimeout(() => setActive(false), 700); };
    const t = setTimeout(() => { tick(); const iv = setInterval(tick, cycle); return () => clearInterval(iv); }, offset);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <span style={{
      fontFamily:   "'JetBrains Mono',monospace",
      fontSize:     "9px", fontWeight: 600,
      padding:      "3px 9px", borderRadius: "20px",
      border:       `1px solid ${active ? color : color+"33"}`,
      background:   active ? color+"20" : "transparent",
      color:        active ? color : color+"66",
      transition:   "all 0.3s ease",
      boxShadow:    active ? `0 0 8px ${color}33` : "none",
    }}>{label}</span>
  );
}