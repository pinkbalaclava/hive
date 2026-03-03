import { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";

// ─── Agent Definitions ───
const AGENTS = [
  {
    id: "brainstormer",
    name: "The Brainstormer",
    role: "Idea Expansion",
    group: "Create",
    color: "#CCFF00",
    icon: "🧠",
    starters: [
      "I have a rough idea. Help me expand it into 3 different angles",
      "What are 5 unconventional approaches to [problem]?",
      "Brainstorm product features for [audience]"
    ],
    prompt: `You are The Brainstormer — your job is to expand half-baked ideas into multiple viable directions.
When given an idea, ask: "What if we did it differently?" Generate 3-5 different angles:
- One that's aggressive/risky
- One that's lean/minimal
- One that's unconventional
- One that combines existing patterns
For each angle, be specific about: customer, value prop, 1 killer feature.
STYLE: Energetic, encouraging, push thinking further. No gatekeeping.`
  },
  {
    id: "editor",
    name: "The Editor",
    role: "Writing & Clarity",
    group: "Refine",
    color: "#CCFF00",
    icon: "✍️",
    starters: [
      "Make this more compelling and concise",
      "Rewrite this for [audience]: founders / creators / investors",
      "Does this have any logical gaps or unclear sections?"
    ],
    prompt: `You are The Editor — you make ideas clear and compelling.
Your job: take rough thoughts and make them land.
For any text:
1) Tighten language (cut 20% without losing meaning)
2) Reorder for impact (hook first, then support)
3) Match tone to audience (professional vs casual vs urgent)
4) Flag anything that's unclear or contradicts itself
STYLE: Specific feedback. Show before/after. Explain why the change matters.`
  },
  {
    id: "factchecker",
    name: "The Fact Checker",
    role: "Reality Test",
    group: "Validate",
    color: "#CCFF00",
    icon: "🔍",
    starters: [
      "Is this claim actually true? Check my assumptions",
      "What would disprove this? Find the strongest counter-argument",
      "Does this align with how [market/industry/people] actually work?"
    ],
    prompt: `You are The Fact Checker — you separate confidence from reality.
Your job: reality-test claims and assumptions.
For any idea/claim:
1) Surface the core assumption (what has to be true?)
2) Rate your confidence (HIGH if evidence is clear, LOW if speculative)
3) Name what would disprove this (what evidence would change your mind?)
4) Find the strongest counter-argument
STYLE: Honest, specific. Show your work. Don't soften reality to make ideas sound better.`
  },
  {
    id: "builder",
    name: "The Builder",
    role: "Execution & Scope",
    group: "Build",
    color: "#CCFF00",
    icon: "🛠️",
    starters: [
      "What's the minimum viable version of this?",
      "What should we build first vs. defer?",
      "What could go wrong when building this?"
    ],
    prompt: `You are The Builder — you translate ideas into executable plans.
When given a project:
1) Define MVP (what's the 1 thing that proves it works?)
2) List what you'd BUILD, BUY, or DEFER (with reasoning)
3) Surface hidden dependencies (what needs to be true first?)
4) Estimate effort realistically (S/M/L in weeks, not days)
STYLE: Practical. No perfectionism. Ship, learn, iterate. Flag risks early.`
  },
  {
    id: "devilsadvocate",
    name: "The Devil's Advocate",
    role: "Red Team",
    group: "Validate",
    color: "#CCFF00",
    icon: "😈",
    starters: [
      "Why would this fail? Give me 3 real failure modes",
      "Who wins if this doesn't work? What's their move?",
      "What's the strongest argument against this idea?"
    ],
    prompt: `You are The Devil's Advocate — you find every reason this could fail.
When given an idea:
1) Name the strongest 3 failure modes (not generic, specific to THIS idea)
2) For each, rate likelihood (HIGH/MEDIUM/LOW) and impact
3) Find the strongest counter-argument (what's the best case against?)
4) Identify the single riskiest assumption
STYLE: Sharp, direct. No softening. Help them see what they're missing.`
  }
];

const GROUPS = ["Create", "Refine", "Validate", "Build"];

// ─── API Call ───
async function callAPI(systemPrompt, messages) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });
    
    if (response.status === 401 || response.status === 403) {
      return "__AUTH_ERROR__";
    }
    
    const data = await response.json();
    if (data.error) {
      return "⚠️ " + data.error.message;
    }
    return data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "Error";
  } catch (err) {
    return "⚠️ Connection error: " + err.message;
  }
}

// ─── PDF Export ───
async function generatePDFReport(messages, agentUsed) {
  const pdf = new jsPDF();
  let yPos = 20;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - 2 * margin;

  // ─── PAGE 1: COVER ───
  pdf.setFont("Lora", "bold");
  pdf.setFontSize(32);
  pdf.text("hive", margin, yPos);
  
  yPos += 15;
  pdf.setFontSize(11);
  pdf.setFont("Inter", "normal");
  pdf.text("Collective Intelligence", margin, yPos);
  
  yPos += 20;
  pdf.setFontSize(10);
  pdf.setFont("Inter", "bold");
  pdf.text("Session Report", margin, yPos);
  
  yPos += 10;
  pdf.setFont("Inter", "normal");
  pdf.setFontSize(9);
  const timestamp = new Date().toLocaleDateString() + " · " + new Date().toLocaleTimeString();
  pdf.text(timestamp, margin, yPos);
  
  yPos += 15;
  pdf.setFont("Inter", "bold");
  pdf.setFontSize(11);
  pdf.text("Session Summary", margin, yPos);
  
  yPos += 8;
  pdf.setFont("Inter", "normal");
  pdf.setFontSize(10);
  const agentNames = [...new Set(messages.filter(m => m.agent).map(m => m.agent.name))];
  const summaryText = `${messages.length} messages across ${agentNames.length} agents`;
  pdf.text(summaryText, margin, yPos);
  
  yPos += 15;
  pdf.setFont("Inter", "bold");
  pdf.setFontSize(10);
  pdf.text("Agents Involved:", margin, yPos);
  yPos += 8;
  
  pdf.setFont("Inter", "normal");
  pdf.setFontSize(9);
  agentNames.forEach(name => {
    const agent = AGENTS.find(a => a.name === name);
    pdf.text(`${agent.icon} ${name} — ${agent.role}`, margin + 5, yPos);
    yPos += 6;
  });
  
  yPos += 15;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // ─── CONVERSATION ───
  pdf.setFont("Inter", "normal");
  pdf.setFontSize(9);

  messages.forEach((msg) => {
    if (yPos > pageHeight - 30) {
      pdf.addPage();
      yPos = margin;
    }
    
    if (msg.sender === "user") {
      pdf.setFont("Inter", "bold");
      pdf.setTextColor(100, 100, 100);
      pdf.text("You", margin, yPos);
      yPos += 5;
      
      pdf.setFont("Inter", "normal");
      pdf.setTextColor(0, 0, 0);
      const userLines = pdf.splitTextToSize(msg.text, maxWidth - 10);
      pdf.text(userLines, margin + 5, yPos);
      yPos += userLines.length * 5 + 8;
    } else if (msg.sender === "agent") {
      const agent = msg.agent;
      pdf.setFont("Inter", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${agent.icon} ${agent.name}`, margin, yPos);
      yPos += 5;
      
      pdf.setFont("Inter", "normal");
      pdf.setFontSize(8);
      const agentLines = pdf.splitTextToSize(msg.text, maxWidth - 10);
      pdf.text(agentLines, margin + 5, yPos);
      yPos += agentLines.length * 5 + 10;
    }
  });
  
  pdf.save("hive-session-report.pdf");
}

// ─── Main App ───
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(null);
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const messagesEnd = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const getTime = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const callAgent = async (agent, userMessage, history) => {
    const recentMsgs = history.slice(-10).map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.sender === "user" ? m.text : `[${m.agent?.name}]: ${m.text}`
    }));
    
    const apiMessages = [...recentMsgs];
    if (!apiMessages.length || apiMessages[apiMessages.length - 1].role !== "user") {
      apiMessages.push({ role: "user", content: userMessage });
    }

    const result = await callAPI(agent.prompt, apiMessages);
    return result === "__AUTH_ERROR__" ? null : result;
  };

  const handleSend = async () => {
    const msgText = input.trim();
    if (!msgText || typing) return;

    const userMsg = { sender: "user", text: msgText, time: getTime() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setTyping(activeAgent);

    const response = await callAgent(activeAgent, msgText, newMessages);
    if (response) {
      setMessages(prev => [...prev, { sender: "agent", agent: activeAgent, text: response, time: getTime() }]);
    }
    setTyping(null);
  };

  const handleStarterClick = (question) => {
    setInput(question);
    textareaRef.current?.focus();
  };

  // ─── NEO-BRUTALIST DARK THEME ───
  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          background: #171e19;
          color: #fff;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #1a1f1a;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 0;
        }
      `}</style>
      
      <div style={{ display: "flex", height: "100vh", background: "#171e19" }}>
        {/* SIDEBAR */}
        <div style={{
          width: 260,
          background: "#1a1f1a",
          borderRight: "2px solid #000",
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          boxShadow: "4px 0px 0px 0px rgba(204, 255, 0, 0.1)"
        }}>
          <div style={{ padding: "0 20px 24px", borderBottom: "2px solid #000" }}>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#CCFF00",
              fontFamily: "'Lora', serif",
              letterSpacing: "-2px"
            }}>
              hive
            </div>
            <div style={{
              fontSize: 10,
              color: "#b7c6c2",
              marginTop: 6,
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontWeight: 600
            }}>
              Collective Intelligence
            </div>
          </div>

          {/* GROUPS */}
          <div style={{ flex: 1, overflowY: "auto", paddingTop: 16 }}>
            {GROUPS.map(group => (
              <div key={group}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#b7c6c2",
                  padding: "12px 20px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  borderTop: "1px solid #333",
                  borderBottom: "1px solid #333"
                }}>
                  {group}
                </div>
                {AGENTS.filter(a => a.group === group).map(agent => (
                  <div
                    key={agent.id}
                    onClick={() => setActiveAgent(agent)}
                    style={{
                      padding: "12px 20px",
                      cursor: "pointer",
                      background: activeAgent.id === agent.id ? "#CCFF00" : "transparent",
                      borderLeft: activeAgent.id === agent.id ? "4px solid #CCFF00" : "4px solid transparent",
                      color: activeAgent.id === agent.id ? "#000" : "#fff",
                      fontSize: 13,
                      fontWeight: activeAgent.id === agent.id ? 700 : 500,
                      transition: "all 0.1s",
                      boxShadow: activeAgent.id === agent.id ? "4px 4px 0px 0px #000" : "none",
                      transform: activeAgent.id === agent.id ? "translate(-2px, -2px)" : "none"
                    }}
                    onMouseEnter={e => {
                      if (activeAgent.id !== agent.id) {
                        e.target.style.background = "#CCFF00";
                        e.target.style.color = "#000";
                        e.target.style.fontWeight = "600";
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeAgent.id !== agent.id) {
                        e.target.style.background = "transparent";
                        e.target.style.color = "#fff";
                        e.target.style.fontWeight = "500";
                      }
                    }}
                  >
                    <span style={{ marginRight: 8 }}>{agent.icon}</span>
                    {agent.name}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* FOOTER */}
          <div style={{
            padding: "16px 20px",
            borderTop: "2px solid #000",
            fontSize: 10,
            color: "#b7c6c2",
            fontWeight: 600
          }}>
            5 agents · always thinking
          </div>
        </div>

        {/* MAIN CHAT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#171e19" }}>
          {/* HEADER */}
          <div style={{
            padding: "20px 28px",
            borderBottom: "2px solid #000",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 0px 0px rgba(204, 255, 0, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 28 }}>{activeAgent.icon}</span>
              <div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#CCFF00",
                  fontFamily: "'Lora', serif"
                }}>
                  {activeAgent.name}
                </div>
                <div style={{ fontSize: 11, color: "#b7c6c2", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {activeAgent.role}
                </div>
              </div>
            </div>
            
            {messages.length > 0 && (
              <button
                onClick={() => generatePDFReport(messages, activeAgent)}
                style={{
                  padding: "10px 16px",
                  background: "#CCFF00",
                  color: "#000",
                  border: "2px solid #000",
                  borderRadius: 0,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  transition: "all 0.1s",
                  boxShadow: "4px 4px 0px 0px #000",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
                onMouseEnter={e => {
                  e.target.style.transform = "translate(4px, 4px)";
                  e.target.style.boxShadow = "none";
                }}
                onMouseLeave={e => {
                  e.target.style.transform = "translate(0, 0)";
                  e.target.style.boxShadow = "4px 4px 0px 0px #000";
                }}
              >
                📥 Export PDF
              </button>
            )}
          </div>

          {/* MESSAGES */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.length === 0 && (
              <div style={{ marginTop: "40px", maxWidth: 520 }}>
                <div style={{
                  fontSize: 11,
                  color: "#b7c6c2",
                  marginBottom: 20,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontWeight: 700
                }}>
                  {activeAgent.name} Starters:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activeAgent.starters.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleStarterClick(q)}
                      style={{
                        padding: "14px 16px",
                        background: "transparent",
                        border: "2px solid #CCFF00",
                        borderRadius: 0,
                        cursor: "pointer",
                        fontSize: 13,
                        textAlign: "left",
                        color: "#CCFF00",
                        fontFamily: "inherit",
                        transition: "all 0.1s",
                        boxShadow: "4px 4px 0px 0px #CCFF00",
                        fontWeight: 500
                      }}
                      onMouseEnter={e => {
                        e.target.style.background = "#CCFF00";
                        e.target.style.color = "#000";
                        e.target.style.transform = "translate(4px, 4px)";
                        e.target.style.boxShadow = "none";
                      }}
                      onMouseLeave={e => {
                        e.target.style.background = "transparent";
                        e.target.style.color = "#CCFF00";
                        e.target.style.transform = "translate(0, 0)";
                        e.target.style.boxShadow = "4px 4px 0px 0px #CCFF00";
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: msg.sender === "user" ? "row-reverse" : "row", gap: 14, alignItems: "flex-end" }}>
                {msg.sender === "user" ? (
                  <div style={{ maxWidth: "65%" }}>
                    <div style={{ fontSize: 10, color: "#b7c6c2", marginBottom: 6, textAlign: "right", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      You · {msg.time}
                    </div>
                    <div style={{
                      background: "transparent",
                      border: "2px solid #CCFF00",
                      borderRadius: 0,
                      padding: "14px 16px",
                      color: "#CCFF00",
                      fontSize: 13,
                      lineHeight: 1.6,
                      boxShadow: "4px 4px 0px 0px #CCFF00",
                      fontWeight: 500
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: "65%" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#CCFF00", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {msg.agent.icon} {msg.agent.name} · {msg.time}
                    </div>
                    <div style={{
                      background: "transparent",
                      border: "2px solid #fff",
                      borderRadius: 0,
                      padding: "14px 16px",
                      color: "#fff",
                      fontSize: 13,
                      lineHeight: 1.7
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#b7c6c2", fontSize: 12, fontWeight: 500 }}>
                <span>{typing.icon}</span>
                <span>{typing.name} is thinking</span>
                <span style={{ color: "#CCFF00" }}>···</span>
              </div>
            )}
            
            <div ref={messagesEnd} />
          </div>

          {/* INPUT */}
          <div style={{ padding: "20px 28px", borderTop: "2px solid #000" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Ask ${activeAgent.name}...`}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  border: "2px solid #333",
                  borderRadius: 0,
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "none",
                  maxHeight: 100,
                  outline: "none",
                  background: "#1a1f1a",
                  color: "#fff",
                  boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.3)"
                }}
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || typing}
                style={{
                  width: 44,
                  height: 44,
                  background: input.trim() && !typing ? "#CCFF00" : "#333",
                  color: input.trim() && !typing ? "#000" : "#666",
                  border: "2px solid #000",
                  borderRadius: 0,
                  cursor: input.trim() && !typing ? "pointer" : "default",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.1s",
                  fontWeight: 700,
                  boxShadow: "4px 4px 0px 0px #000"
                }}
                onMouseEnter={e => {
                  if (input.trim() && !typing) {
                    e.target.style.transform = "translate(4px, 4px)";
                    e.target.style.boxShadow = "none";
                  }
                }}
                onMouseLeave={e => {
                  e.target.style.transform = "translate(0, 0)";
                  e.target.style.boxShadow = "4px 4px 0px 0px #000";
                }}
              >
                ↑
              </button>
            </div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 8, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
              shift + enter · enter to send
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
