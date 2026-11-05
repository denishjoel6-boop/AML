import React, { useState, useEffect, useCallback } from "react"
import { get, post } from "../api/client.js"
import RiskBadge from "../components/RiskBadge.jsx"
import LoadingState from "../components/LoadingState.jsx"

const INDIAN_CITIES = ["Mumbai","Delhi","Bengaluru","Chennai","Hyderabad","Kolkata","Pune","Ahmedabad","Jaipur","Surat"]

function scoreColor(s) {
  if (s < 30) return "var(--risk-low)"
  if (s < 60) return "var(--risk-medium)"
  if (s < 85) return "#FB923C"
  return "var(--risk-high)"
}

function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, score || 0))
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:10, background:"var(--bg-light)", borderRadius:6, overflow:"hidden" }}>
        <div style={{ width:pct+"%", height:"100%", background:scoreColor(score), borderRadius:6, transition:"width 0.6s ease" }} />
      </div>
      <span style={{ fontSize:14, fontWeight:800, color:scoreColor(score), minWidth:38 }}>{(score||0).toFixed(1)}</span>
    </div>
  )
}

function ScoreCard({ title, score, action, reasons, note, highlight }) {
  return (
    <div className="ripple-score-card" style={{ border: highlight ? "2px solid "+scoreColor(score) : "1px solid var(--border)", position:"relative" }}>
      {highlight && <div className="ripple-hypothetical-badge">HYPOTHETICAL</div>}
      <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>{title}</div>
      {score != null ? (
        <>
          <ScoreBar score={score} />
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:12, color:"var(--text-muted)" }}>Action:</span>
            {action && <RiskBadge action={action} />}
          </div>
          {reasons && reasons.length > 0 && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Signals</div>
              {reasons.map((r,i) => <div key={i} className="reason-item"><span className="reason-bullet">&#8250;</span><span>{r}</span></div>)}
            </div>
          )}
          {note && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:8, fontStyle:"italic" }}>{note}</div>}
        </>
      ) : (
        <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:8 }}>No prior scored transactions for this sender in the live feed.</div>
      )}
    </div>
  )
}

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null
  const abs = Math.abs(delta).toFixed(1)
  if (Math.abs(delta) < 0.05) return React.createElement("span", { className:"ripple-delta ripple-delta-neutral" }, "~ No change")
  if (delta > 0) return React.createElement("span", { className:"ripple-delta ripple-delta-up" }, "+"+abs+" Risk increased")
  return React.createElement("span", { className:"ripple-delta ripple-delta-down" }, "-"+abs+" Risk decreased")
}

function FeatureRow({ label, value, changed }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 6px", borderBottom:"1px solid var(--border)", background: changed ? "rgba(251,191,36,0.1)" : "transparent", borderRadius: changed ? 4 : 0 }}>
      <span style={{ fontSize:12, color:"var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color: changed ? "#B45309" : "var(--text-heading)" }}>
        {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(2)) : String(value)}
        {changed && <span style={{ fontSize:10, marginLeft:6, color:"#B45309" }}>FLAG</span>}
      </span>
    </div>
  )
}

const FEATURE_LABELS = {
  amount_vs_sender_avg:"Amount vs Sender Avg",
  new_device:"New Device (0/1)",
  new_payee:"New Payee (0/1)",
  city_change:"City Change (0/1)",
  count_10m:"Tx Count (10 min)",
  count_1h:"Tx Count (1 hour)",
}

export default function RippleEffect() {
  const [accounts, setAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState(null)
  const [senderId, setSenderId] = useState("")
  const [receiverId, setReceiverId] = useState("")
  const [amount, setAmount] = useState("")
  const [city, setCity] = useState("")
  const [deviceId, setDeviceId] = useState("")
  const [timestamp, setTimestamp] = useState("")
  const [formError, setFormError] = useState(null)
  const [result, setResult] = useState(null)
  const [simulating, setSimulating] = useState(false)
  const [simError, setSimError] = useState(null)

  useEffect(() => {
    get("/accounts/sample", { limit: 80 })
      .then(data => { setAccounts(data.accounts || []); setAccountsLoading(false) })
      .catch(err => { setAccountsError(err.message); setAccountsLoading(false) })
  }, [])

  const selSender = accounts.find(a => a.account_id === senderId)
  const selReceiver = accounts.find(a => a.account_id === receiverId)

  const validate = useCallback(() => {
    if (!senderId) return "Please select a sender account."
    if (!receiverId) return "Please select a receiver account."
    if (senderId === receiverId) return "Sender and receiver must be different."
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) return "Please enter a positive amount."
    return null
  }, [senderId, receiverId, amount])

  const handleSimulate = useCallback(async () => {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError(null); setSimError(null); setResult(null); setSimulating(true)
    try {
      const res = await post("/simulate", { sender_id:senderId, receiver_id:receiverId, amount:parseFloat(amount), city:city||"", device_id:deviceId||"", timestamp:timestamp||"" })
      setResult(res)
    } catch(err) { setSimError(err.message) }
    finally { setSimulating(false) }
  }, [senderId, receiverId, amount, city, deviceId, timestamp, validate])

  const handleReset = useCallback(() => {
    setResult(null); setSimError(null); setFormError(null)
    setSenderId(""); setReceiverId(""); setAmount(""); setCity(""); setDeviceId(""); setTimestamp("")
  }, [])

  const delta = result && result.baseline?.score != null ? result.risk_score - result.baseline.score : null
  const featKeys = ["amount_vs_sender_avg","new_device","new_payee","city_change","count_10m","count_1h"]
  const isFlagged = k => { const f = result?.historical_features; if(!f) return false; return (k==="new_device"&&f[k]===1)||(k==="new_payee"&&f[k]===1)||(k==="city_change"&&f[k]===1)||(k==="count_10m"&&f[k]>=3)||(k==="count_1h"&&f[k]>=8)||(k==="amount_vs_sender_avg"&&f[k]>3) }

  const explanations = []
  if (result) {
    const s = result.risk_score
    if (s>=85) explanations.push("Score "+s.toFixed(1)+": BLOCK. Engine would auto-escalate to a compliance case.")
    else if (s>=60) explanations.push("Score "+s.toFixed(1)+": HOLD. An analyst must review before settlement.")
    else if (s>=30) explanations.push("Score "+s.toFixed(1)+": OTP. Step-up verification required from the sender.")
    else explanations.push("Score "+s.toFixed(1)+": ALLOW. Risk within acceptable bounds — payment proceeds.")
    const sg = result.sender_graph_signals||{}; const rg = result.receiver_graph_signals||{}
    if(sg.in_cycle) explanations.push("Sender is part of a circular transfer pattern detected by the graph engine.")
    if(rg.in_cycle) explanations.push("Receiver is part of a circular transfer pattern.")
    if(rg.fan_in_flag) explanations.push("Receiver receives funds from many senders — potential mule indicator.")
    if(sg.shared_device_flag||rg.shared_device_flag) explanations.push("Shared device signal active — device used by multiple accounts.")
    const f = result.historical_features||{}
    if(f.new_device) explanations.push("Sender has not used this device before.")
    if(f.new_payee) explanations.push("First-ever transfer to this receiver from this sender.")
    if(f.city_change) explanations.push("Transaction city differs from sender usual location.")
    if(f.amount_vs_sender_avg>3) explanations.push("Amount is "+f.amount_vs_sender_avg.toFixed(1)+"x the sender historical average — anomalous.")
    if(f.count_10m>=3) explanations.push("High velocity: 3+ transactions in the last 10 minutes.")
    if(f.count_1h>=8) explanations.push("High velocity: 8+ transactions in the last hour.")
    if(explanations.length===1) explanations.push("No additional graph or behavioural anomalies detected for this simulation.")
  }

  return (
    <div className="ripple-page">
      <div className="section-header" style={{ marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,var(--primary),#7C3AED)", color:"#fff", flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4"/><path d="M17.7 6.3a8 8 0 0 1 0 11.4"/><path d="M3.5 3.5a14 14 0 0 0 0 17"/><path d="M20.5 3.5a14 14 0 0 1 0 17"/></svg>
            </span>
            RippleEffect &#8212; Fraud Scenario Simulator
          </h2>
          <p style={{ fontSize:13, color:"var(--text-muted)", marginTop:4 }}>Simulate a hypothetical transaction through the real risk engine without creating any real transaction.</p>
        </div>
      </div>

      {accountsLoading ? <LoadingState message="Loading account data..." /> :
        accountsError ? <div className="error-box">Failed to load accounts: {accountsError}</div> : (
        <div className="ripple-layout">
          <div className="ripple-left">
            <div className="card" style={{ marginBottom:16 }}>
              <div className="ripple-step-head"><span className="ripple-step-num">1</span>Select Accounts</div>
              <label className="ripple-label"><span>Sender Account</span>
                <select value={senderId} onChange={e=>{setSenderId(e.target.value);setResult(null)}} style={{width:"100%"}}>
                  <option value="">-- Select sender --</option>
                  {accounts.map(a=><option key={a.account_id} value={a.account_id}>{a.account_id}{a.graph_risk>0.3?" &#9888; High risk":""}{a.in_cycle?" &#8635; Cycle":""}</option>)}
                </select>
                {selSender&&<div className="ripple-account-info"><span>Graph risk: <b style={{color:scoreColor(selSender.graph_risk*100)}}>{(selSender.graph_risk*100).toFixed(1)}</b></span>{selSender.in_cycle&&<span className="signal-chip active" style={{fontSize:10}}>Cycle</span>}{selSender.fan_in_flag&&<span className="signal-chip active" style={{fontSize:10}}>Fan-in</span>}{selSender.shared_device_flag&&<span className="signal-chip active" style={{fontSize:10}}>Shared device</span>}</div>}
              </label>
              <label className="ripple-label" style={{marginTop:12}}><span>Receiver Account</span>
                <select value={receiverId} onChange={e=>{setReceiverId(e.target.value);setResult(null)}} style={{width:"100%"}}>
                  <option value="">-- Select receiver --</option>
                  {accounts.filter(a=>a.account_id!==senderId).map(a=><option key={a.account_id} value={a.account_id}>{a.account_id}{a.graph_risk>0.3?" &#9888; High risk":""}{a.in_cycle?" &#8635; Cycle":""}</option>)}
                </select>
                {selReceiver&&<div className="ripple-account-info"><span>Graph risk: <b style={{color:scoreColor(selReceiver.graph_risk*100)}}>{(selReceiver.graph_risk*100).toFixed(1)}</b></span>{selReceiver.in_cycle&&<span className="signal-chip active" style={{fontSize:10}}>Cycle</span>}{selReceiver.fan_in_flag&&<span className="signal-chip active" style={{fontSize:10}}>Fan-in</span>}{selReceiver.shared_device_flag&&<span className="signal-chip active" style={{fontSize:10}}>Shared device</span>}</div>}
              </label>
            </div>
            <div className="card" style={{marginBottom:16}}>
              <div className="ripple-step-head"><span className="ripple-step-num">2</span>Transaction Details</div>
              <label className="ripple-label"><span>Amount (Rs) *</span><input type="number" min="1" step="any" placeholder="e.g. 50000" value={amount} onChange={e=>{setAmount(e.target.value);setResult(null)}} style={{width:"100%"}} /></label>
              <label className="ripple-label" style={{marginTop:10}}><span>City (optional)</span><select value={city} onChange={e=>{setCity(e.target.value);setResult(null)}} style={{width:"100%"}}><option value="">-- Use sender usual city --</option>{INDIAN_CITIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
              <label className="ripple-label" style={{marginTop:10}}><span>Device ID (optional)</span><input type="text" placeholder="DEV_SHARED_00 triggers shared-device flag" value={deviceId} onChange={e=>{setDeviceId(e.target.value);setResult(null)}} style={{width:"100%"}} /></label>
              <label className="ripple-label" style={{marginTop:10}}><span>Timestamp (optional - blank = now)</span><input type="datetime-local" value={timestamp} onChange={e=>{setTimestamp(e.target.value);setResult(null)}} style={{width:"100%"}} /></label>
            </div>
            {formError&&<div className="error-box" style={{marginBottom:12}}>{formError}</div>}
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-primary" onClick={handleSimulate} disabled={simulating} style={{flex:1}}>
                {simulating?(<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>Scoring...</>):(<>&#9654; Simulate Transaction</>)}
              </button>
              {result&&<button className="btn btn-ghost" onClick={handleReset}>Reset</button>}
            </div>
            {!result&&!simulating&&(
              <div style={{marginTop:14,padding:"12px 14px",background:"var(--bg-glass)",borderRadius:10,border:"1px solid var(--border)",fontSize:12,color:"var(--text-muted)",lineHeight:1.7}}>
                <b style={{color:"var(--text-heading)"}}>How it works</b><br/>
                Passes your hypothetical transaction through the real engine:<br/>
                LightGBM ML (50%) | Graph risk (30%) | 6 rules (20%)<br/><br/>
                No real transaction is created. No case is opened.
              </div>
            )}
          </div>

          <div className="ripple-right">
            {simError&&<div className="error-box" style={{marginBottom:16}}>Simulation failed: {simError}</div>}
            {simulating&&<LoadingState message="Scoring hypothetical transaction..." />}
            {!simulating&&!result&&!simError&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",color:"var(--text-muted)",textAlign:"center",gap:14}}>
                <div style={{width:60,height:60,borderRadius:"50%",background:"var(--bg-glass)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4"/><path d="M17.7 6.3a8 8 0 0 1 0 11.4"/><path d="M3.5 3.5a14 14 0 0 0 0 17"/><path d="M20.5 3.5a14 14 0 0 1 0 17"/></svg>
                </div>
                <div><div style={{fontWeight:700,color:"var(--text-heading)",fontSize:15,marginBottom:5}}>Ready to Simulate</div><div style={{fontSize:13}}>Select accounts, enter an amount, and click Simulate Transaction.</div></div>
              </div>
            )}
            {!simulating&&result&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div className="card" style={{background:"linear-gradient(135deg,var(--bg-glass),#EEF6FF)",padding:"14px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                    <div><div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>Risk Score Change</div><DeltaBadge delta={delta}/>{delta===null&&<span className="ripple-delta ripple-delta-neutral">First simulation for this sender</span>}</div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--text-muted)"}}>{result.sender_id} to {result.receiver_id}</div><div style={{fontSize:13,fontWeight:700,color:"var(--text-heading)"}}>Rs{parseFloat(amount).toLocaleString()}{result.city?" - "+result.city:""}</div></div>
                  </div>
                </div>
                <div className="ripple-comparison">
                  <ScoreCard title="Before (Baseline)" score={result.baseline?.score} action={result.baseline?.action} reasons={result.baseline?.reasons} note={result.baseline?.note} highlight={false}/>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"var(--text-muted)",flexShrink:0}}>&#8594;</div>
                  <ScoreCard title="After (Simulated)" score={result.risk_score} action={result.action} reasons={result.reasons} highlight/>
                </div>
                <div className="card">
                  <div style={{fontSize:13,fontWeight:800,color:"var(--text-heading)",marginBottom:12}}>Signal Breakdown</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
                    {[["ML Model",result.model_risk*100,"50%"],["Graph Risk",result.graph_risk*100,"30%"],["Rules Risk",result.rules_risk*100,"20%"]].map(([label,val,weight])=>(
                      <div key={label} style={{padding:"10px 12px",background:"var(--bg-glass)",borderRadius:8,border:"1px solid var(--border)"}}>
                        <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:700}}>{label}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:6}}>weight {weight}</div>
                        <ScoreBar score={val}/>
                      </div>
                    ))}
                  </div>
                  {result.rules_triggered?.length>0&&(<>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Rules Triggered</div>
                    <div className="signal-row">{["R1","R2","R3","R4","R5","R6"].map(r=><span key={r} className={"signal-chip "+(result.rules_triggered.includes(r)?"active":"inactive")}>{r}</span>)}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:6}}>R1 High amount | R2 vs avg | R3 10-min velocity | R4 1-hr velocity | R5 New device+city | R6 New payee+large</div>
                  </>)}
                </div>
                <div className="card">
                  <div style={{fontSize:13,fontWeight:800,color:"var(--text-heading)",marginBottom:10}}>Computed Feature Vector</div>
                  {featKeys.map(k=><FeatureRow key={k} label={FEATURE_LABELS[k]||k} value={result.historical_features?.[k]??"?"} changed={isFlagged(k)}/>)}
                </div>
                <div className="card">
                  <div style={{fontSize:13,fontWeight:800,color:"var(--text-heading)",marginBottom:10}}>Graph Signals</div>
                  {[["Sender",result.sender_id,result.sender_graph_signals],["Receiver",result.receiver_id,result.receiver_graph_signals]].map(([role,accId,data])=>
                    data&&Object.keys(data).length>0&&(
                      <div key={role} style={{marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",marginBottom:5}}>{role} - {accId}</div>
                        {[["Graph Risk Score",((data.graph_risk||0)*100).toFixed(1)],["In Cycle",data.in_cycle?"YES":"No"],["Fan-in Flag",data.fan_in_flag?"YES":"No"],["Shared Device",data.shared_device_flag?"YES":"No"],["In-degree",data.in_degree??"?"],["Out-degree",data.out_degree??"?"]].map(([k,v])=><FeatureRow key={k} label={k} value={v} changed={v==="YES"}/>)}
                      </div>
                    )
                  )}
                </div>
                <div className="card" style={{background:"#F0F9FF",border:"1px solid #BAE6FD"}}>
                  <div style={{fontSize:13,fontWeight:800,color:"var(--text-heading)",marginBottom:10}}>Engine Explanation</div>
                  {explanations.map((line,i)=><div key={i} className="reason-item" style={{marginBottom:4}}><span className="reason-bullet">&#8250;</span><span>{line}</span></div>)}
                </div>
                <div className="card" style={{borderLeft:"4px solid "+scoreColor(result.risk_score),background:"var(--bg-glass)"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Recommended Action</div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <RiskBadge action={result.action}/>
                    <span style={{fontSize:13,color:"var(--text-body)"}}>
                      {result.action==="ALLOW"&&"Payment proceeds normally. Risk is within acceptable bounds."}
                      {result.action==="OTP"&&"Step-up authentication required. Sender must confirm via OTP."}
                      {result.action==="HOLD"&&"Payment held for manual analyst review before settlement."}
                      {result.action==="BLOCK"&&"Payment blocked. A compliance case would be created for investigation."}
                    </span>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={handleReset} style={{alignSelf:"flex-start"}}>Run Another Simulation</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
