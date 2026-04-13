import { useState, useMemo, useEffect } from "react";









const FLOORS = ["2nd","3rd","4th","5th","6th","7th","8th","9th","10th","Data Center","Rashid Tower","Training Institute","CTG-Zonal","Other"];
const USB_OPTS = ["Yes","No",""];
const INTERNET_OPTS = ["Yes","No",""];

export default function App() {
  const [user, setUser] = useState(() => {

    try { const s = localStorage.getItem("inv_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterFloor, setFilterFloor] = useState("");
  const [filterUSB, setFilterUSB] = useState("");
  const [filterInternet, setFilterInternet] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [notification, setNotification] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [historyData, setHistoryData] = useState({ rows: [], total: 0, page: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState({ ip: "", action: "" });


  const emptyForm = { name: "", hostname: "", ip: "", subnet: "255.255.255.0", gateway: "", mac: "", usb: "", floor: "", ext: "", internet: "", faceplate: "", portNumber: "", switch: "", department: "" };
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem("inv_token");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) { setUser(null); localStorage.removeItem("inv_token"); localStorage.removeItem("inv_user"); return; }
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setItems(data.map(r => ({ ...r, id: String(r.id) })));
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) fetchItems(); }, [user]);

  const fetchHistory = async (ip, action, page) => {
    ip = ip || ""; action = action || ""; page = page || 1;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (ip) params.append("ip", ip);
      if (action) params.append("action", action);
      const res = await fetch("/api/history?" + params, { headers: { Authorization: "Bearer " + getToken() } });
      if (!res.ok) throw new Error("Failed");
      setHistoryData(await res.json());
    } catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const exportHistory = (ip, action) => {
    ip = ip || ""; action = action || "";
    const params = new URLSearchParams();
    if (ip) params.append("ip", ip);
    if (action) params.append("action", action);
    fetch("/api/history/export?" + params, { headers: { Authorization: "Bearer " + getToken() } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = ip ? "ip_history_" + ip.replace(/\./g,"_") + ".csv" : "ip_history_all.csv";
        a.click();
        notify("History report downloaded!");
      });
  };


  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) { setLoginError("Please enter both username and password."); return; }
    setLoginLoading(true); setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Invalid domain credentials. Please try again."); return; }
      localStorage.setItem("inv_token", data.token);
      localStorage.setItem("inv_user", JSON.stringify(data.user));
      setUser(data.user);
      notify("Welcome, " + data.user.name + "!");
    } catch {
      setLoginError("Network error. Could not connect to server.");
    } finally {
      setLoginLoading(false);
    }
  };










  const uniqueDepts = useMemo(() => [...new Set(items.map(i => i.department).filter(Boolean))].sort(), [items]);
  const [filterDuplicates, setFilterDuplicates] = useState(false);

  const duplicateIPs = useMemo(() => {
    const ipCount = {};
    items.forEach(i => { if(i.ip) ipCount[i.ip] = (ipCount[i.ip]||0)+1; });
    return new Set(Object.keys(ipCount).filter(ip => ipCount[ip] > 1));
  }, [items]);


  const filtered = useMemo(() => {
    return items.filter(i => {
      const s = search.toLowerCase();
      if (s && !((i.name||"").toLowerCase().includes(s) || (i.hostname||"").toLowerCase().includes(s) || (i.ip||"").includes(s) || (i.mac||"").toLowerCase().includes(s) || (i.id||"").includes(s) || (i.department||"").toLowerCase().includes(s))) return false;
      if (filterDept && i.department !== filterDept) return false;
      if (filterFloor && i.floor !== filterFloor) return false;
      if (filterUSB === "Yes" && i.usb !== "Yes") return false;
      if (filterUSB === "No" && i.usb === "Yes") return false;
      if (filterInternet === "Yes" && i.internet !== "Yes") return false;
      if (filterInternet === "No" && i.internet === "Yes") return false;
      if (filterDuplicates && !duplicateIPs.has(i.ip)) return false;
      return true;
    }).sort((a, b) => {
      const av = a[sortField] || "", bv = b[sortField] || "";
      return sortDir === "asc" ? String(av).localeCompare(String(bv), undefined, {numeric:true}) : String(bv).localeCompare(String(av), undefined, {numeric:true});
    });
  }, [items, search, filterDept, filterFloor, filterUSB, filterInternet, sortField, sortDir, filterDuplicates, duplicateIPs]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ ...item }); setShowModal(true); setDetailItem(null); };

  const saveItem = async () => {
    if (!form.hostname && !form.ip && !form.name) { notify("At least Hostname, IP, or Name is required.", "error"); return; }
    try {
      if (editItem) {
        const res = await fetch(`/api/inventory/${editItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Update failed");
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === String(updated.id) ? { ...updated, id: String(updated.id) } : i));
        notify("Record updated successfully!");
      } else {
        const res = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Create failed");
        const created = await res.json();
        setItems(prev => [...prev, { ...created, id: String(created.id) }]);
        notify("New asset added to inventory!");
      }
    } catch {
      notify("Failed to save record.", "error");
    }
    setShowModal(false);
  };












  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setItems(prev => prev.filter(i => i.id !== id));
      setDeleteConfirm(null); setDetailItem(null);
      notify("Record deleted.");
    } catch {
      notify("Failed to delete record.", "error");
    }
  };





  const exportCSV = () => {
    const headers = ["ID","Name","HostName","IP","SubNetMask","Gateway","MACAddress","USB","Floor","Ext","Internet","Faceplate","PortNumber","Switch","Department","UpdatedAt","CreatedAt"];
    const rows = filtered.map(i => [i.id,i.name,i.hostname,i.ip,i.subnet,i.gateway,i.mac,i.usb,i.floor,i.ext,i.internet,i.faceplate,i.portNumber,i.switch,i.department,i.updatedAt,i.createdAt]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c||""}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download = "network_inventory.csv"; a.click();
    notify("Exported " + filtered.length + " records to CSV!");
  };

  const sortToggle = (f) => { if (sortField === f) setSortDir(d => d==="asc"?"desc":"asc"); else { setSortField(f); setSortDir("asc"); } setPage(1); };
  const SortIcon = ({f}) => sortField === f ? (sortDir === "asc" ? " ▲" : " ▼") : <span style={{color:"#cbd5e1"}}> ⇅</span>;

  const stats = useMemo(() => ({
    total: items.length,
    withUSB: items.filter(i => i.usb === "Yes").length,
    withInternet: items.filter(i => i.internet === "Yes").length,
    departments: new Set(items.map(i => i.department).filter(Boolean)).size,
    withIP: items.filter(i => i.ip).length,
  }), [items]);

  const deptStats = useMemo(() => {
    const map = {};
    items.forEach(i => { if (i.department) map[i.department] = (map[i.department]||0)+1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,15);
  }, [items]);

  const floorStats = useMemo(() => {
    const map = {};
    items.forEach(i => { if (i.floor) map[i.floor] = (map[i.floor]||0)+1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,12);
  }, [items]);

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (!user) return (
    <div style={{minHeight:"100vh", background:"linear-gradient(135deg,#04080f 0%,#0b1832 50%,#071428 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif", overflow:"hidden", position:"relative"}}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-15px) rotate(3deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .li:hover{background:rgba(255,255,255,0.08)!important;}
        .lbtn{transition:all 0.25s!important;}
        .lbtn:hover{background:linear-gradient(135deg,#d4a93a,#f5c842)!important;transform:translateY(-2px)!important;box-shadow:0 12px 32px rgba(212,169,58,0.45)!important;}
        .linput:focus{border-color:#c8a84b!important;box-shadow:0 0 0 3px rgba(200,168,75,0.18)!important;outline:none!important;}
      `}</style>
      {/* Background orbs */}
      {[[400,400,"rgba(30,64,175,0.12)","-80px","-80px","0s"],[250,250,"rgba(200,168,75,0.08)","auto","-30px","3s",{bottom:"-30px",left:"auto",right:"-30px"}],[180,180,"rgba(16,185,129,0.06)","35%","8%","1.5s"]].map(([w,h,bg,t,l,d,extra],i) => (
        <div key={i} style={{position:"absolute",width:w,height:h,borderRadius:"50%",background:bg,filter:"blur(60px)",top:t,left:l,animation:`float 8s ease-in-out infinite`,animationDelay:d,...(extra||{})}} />
      ))}

      <div style={{animation:"slideUp 0.7s ease-out",zIndex:10,width:"100%",maxWidth:440,margin:"0 20px"}}>
        {/* Card */}
        <div style={{background:"rgba(255,255,255,0.035)",backdropFilter:"blur(24px)",border:"1px solid rgba(200,168,75,0.25)",borderRadius:24,overflow:"hidden",boxShadow:"0 50px 100px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.08)"}}>
          {/* Header banner */}
          <div style={{background:"linear-gradient(135deg,#c8a84b 0%,#e8c84a 50%,#c8a84b 100%)",padding:"28px 36px 24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0,rgba(255,255,255,0.03) 1px,transparent 0,transparent 50%)",backgroundSize:"8px 8px"}} />
            <div style={{position:"relative"}}>
              <div style={{fontSize:40,marginBottom:8}}>🏦</div>
              <div style={{color:"#0a1628",fontSize:20,fontWeight:800,letterSpacing:1}}>NETWORK IPMS</div>
              <div style={{color:"rgba(10,22,40,0.65)",fontSize:12,letterSpacing:3,textTransform:"uppercase",marginTop:4}}>Information Technology Division</div>
            </div>
          </div>

          <div style={{padding:"32px 36px"}}>

            <div style={{marginBottom:18}}>
              <label style={{display:"block",color:"rgba(255,255,255,0.5)",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,fontWeight:600}}>Username</label>
              <input className="linput" value={loginForm.username} onChange={e=>setLoginForm(p=>({...p,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="Enter your username" style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:11,padding:"12px 14px",color:"#fff",fontSize:14,boxSizing:"border-box",transition:"all 0.3s"}} />
            </div>

            <div style={{marginBottom:24}}>
              <label style={{display:"block",color:"rgba(255,255,255,0.5)",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,fontWeight:600}}>Password</label>
              <input className="linput" type="password" value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="••••••••••" style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:11,padding:"12px 14px",color:"#fff",fontSize:14,boxSizing:"border-box",transition:"all 0.3s"}} />
            </div>

            {loginError && <div style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"11px 14px",marginBottom:20,color:"#fca5a5",fontSize:13}}>⚠ {loginError}</div>}

            <button className="lbtn" onClick={handleLogin} disabled={loginLoading}
              style={{width:"100%",background:"linear-gradient(135deg,#b8943c,#d4af50)",border:"none",borderRadius:12,padding:"14px",color:"#0a1628",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:0.5,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loginLoading ? <><span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>⟳</span> Authenticating...</> : "🔐 Sign In Securely"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── MAIN APP ────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#eef2f7",fontFamily:"'Segoe UI',sans-serif",display:"flex"}}>
      <style>{`
@keyframes slideIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes notifIn{0%{transform:translateX(110%)}10%,88%{transform:translateX(0)}100%{transform:translateX(120%)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .nv:hover{background:rgba(255,255,255,0.12)!important;}
        .nva{background:rgba(255,255,255,0.18)!important;border-left:3px solid #c8a84b!important;}
        .abtn:hover{transform:translateY(-1px);filter:brightness(1.08);}
        .tr:hover{background:#f0f5ff!important;}
        .ic:hover{background:rgba(0,0,0,0.07)!important;}
        .sc:hover{transform:translateY(-3px);box-shadow:0 14px 36px rgba(0,0,0,0.14)!important;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#c4cdd6;border-radius:3px}
        input,select,textarea{font-family:inherit!important}
        .sidebar{width:252px;background:linear-gradient(180deg,#0a1628 0%,#0d2044 60%,#0a1a38 100%);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;flex-shrink:0;transition:transform 0.3s ease;z-index:200;}
        .main-content{flex:1;min-width:0;margin-left:0;}
        .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:199;}
        .hamburger{display:none;background:none;border:none;cursor:pointer;padding:8px;color:#0f172a;font-size:22px;}
        .topbar-title{font-size:19px;}
        .topbar-actions{display:flex;gap:8px;align-items:center;}
        .dash-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px;}
        .filter-bar{display:flex;flex-wrap:wrap;gap:10px;padding:16px 20px;border-bottom:1px solid #f1f5f9;}
        @media(max-width:900px){
          .dash-grid{grid-template-columns:repeat(3,1fr)!important;}
        }
        @media(max-width:768px){
          .sidebar{position:fixed;top:0;left:0;height:100vh;transform:translateX(-100%);z-index:200;}
          .sidebar.open{transform:translateX(0);}
          .sidebar-overlay.open{display:block;}
          .main-content{margin-left:0!important;}
          .hamburger{display:flex!important;align-items:center;justify-content:center;}
          .dash-grid{grid-template-columns:repeat(2,1fr)!important;}
          .topbar-title{font-size:15px!important;}
          .topbar-actions .abtn span{display:none;}
          .filter-bar{padding:12px!important;}
          .filter-bar input,.filter-bar select{width:100%!important;box-sizing:border-box;}
          .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
          .resp-modal{margin:0!important;border-radius:16px 16px 0 0!important;position:fixed!important;bottom:0!important;left:0!important;right:0!important;max-width:100%!important;max-height:90vh!important;}
          .resp-modal-wrap{align-items:flex-end!important;}
        }
        @media(max-width:480px){
          .dash-grid{grid-template-columns:1fr 1fr!important;}
        }
      `}</style>

      {/* Notification */}
      {notification && (
        <div style={{position:"fixed",top:20,right:20,zIndex:9999,animation:"notifIn 3.5s ease forwards",background:notification.type==="error"?"#ef4444":notification.type==="info"?"#3b82f6":"#059669",color:"#fff",borderRadius:12,padding:"13px 20px",boxShadow:"0 10px 28px rgba(0,0,0,0.25)",fontSize:14,maxWidth:340,display:"flex",alignItems:"center",gap:8}}>
          {notification.type==="error"?"✕":"✓"} {notification.msg}
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={()=>setSidebarOpen(false)} />
        <div style={{padding:"24px 20px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:44,height:44,borderRadius:13,background:"linear-gradient(135deg,#c8a84b,#f0d060)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,boxShadow:"0 4px 14px rgba(200,168,75,0.4)"}}>🏦</div>
            <div>
              <div style={{color:"#fff",fontWeight:800,fontSize:14,letterSpacing:0.3}}>Network IPMS</div>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:11,marginTop:1}}>IP Management Portal</div>
            </div>
          </div>
          <div style={{marginTop:14,background:"rgba(200,168,75,0.1)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"7px 12px",display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#10b981",flexShrink:0}} />
            <span style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontFamily:"monospace",fontWeight:700}}>{user.username || user.name}</span>
          </div>
        </div>

        <div style={{padding:"4px 12px",flex:1,overflowY:"auto"}}>
          {[{id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"inventory",icon:"🖥",label:"IP Inventory"},{id:"network",icon:"🌐",label:"Network View"},{id:"reports",icon:"📊",label:"Reports"}].map(item => (
            <div key={item.id} className={`nv ${view===item.id?"nva":""}`} onClick={()=>{setView(item.id);setPage(1);if(window.innerWidth<768)setSidebarOpen(false);if(item.id==="history")fetchHistory("","",1);}}
              style={{display:"flex",alignItems:"center",gap:11,padding:"12px 14px",borderRadius:9,cursor:"pointer",marginBottom:3,color:view===item.id?"#fff":"rgba(255,255,255,0.45)",fontSize:14,transition:"all 0.2s",borderLeft:"3px solid transparent"}}>
              <span style={{fontSize:17}}>{item.icon}</span> {item.label}
              {item.id==="inventory" && <span style={{marginLeft:"auto",background:"rgba(200,168,75,0.25)",color:"#c8a84b",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 6px"}}>{items.length}</span>}
            </div>
          ))}
        </div>

        <div style={{padding:"16px 16px 24px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#3b82f6,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14,flexShrink:0}}>{user.name.charAt(0)}</div>
            <div style={{overflow:"hidden"}}>
              <div style={{color:"#fff",fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:11}}>{user.role}</div>
            </div>
          </div>
          <button onClick={()=>{ setUser(null); localStorage.removeItem("inv_token"); localStorage.removeItem("inv_user"); }} style={{width:"100%",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"9px",color:"#fca5a5",fontSize:12,cursor:"pointer",transition:"all 0.2s"}}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content">
        {/* Top bar */}
        <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px clamp(12px,3vw,28px)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div>
          <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)} style={{marginRight:8}}>☰</button>
            <h2 style={{margin:0,fontSize:19,fontWeight:800,color:"#0f172a"}}>{view==="dashboard"?"Dashboard":view==="inventory"?"IP Inventory":view==="network"?"Network View":"Reports & Analytics"}</h2>
            <div style={{color:"#94a3b8",fontSize:12,marginTop:1}}>{new Date().toLocaleDateString("en-BD",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
          </div>
          {view==="inventory"&&(
            <div style={{display:"flex",gap:8}}>
              <button className="abtn" onClick={exportCSV} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:9,padding:"8px 14px",fontSize:13,cursor:"pointer",color:"#475569",transition:"all 0.2s",display:"flex",alignItems:"center",gap:5}}>📥 Export CSV</button>
              <button className="abtn" onClick={openAdd} style={{background:"linear-gradient(135deg,#1e40af,#3b82f6)",border:"none",borderRadius:9,padding:"8px 18px",fontSize:13,cursor:"pointer",color:"#fff",fontWeight:700,transition:"all 0.2s",display:"flex",alignItems:"center",gap:5}}>+ Add Asset</button>
            </div>
          )}
        </div>

        <div style={{padding:"clamp(12px,3vw,28px) clamp(12px,3vw,28px)"}}>

          {/* ── DASHBOARD ── */}
          {view==="dashboard"&&(
            <div style={{animation:"slideIn 0.4s ease"}}>
              <div className="dash-grid">
                {[
                  {label:"Total Assets",value:stats.total,icon:"🖥️",color:"#3b82f6",bg:"#eff6ff"},
                  {label:"IPs Assigned",value:stats.withIP,icon:"🌐",color:"#8b5cf6",bg:"#faf5ff"},
                  {label:"USB Enabled",value:stats.withUSB,icon:"🔌",color:"#f59e0b",bg:"#fffbeb"},
                  {label:"Internet Access",value:stats.withInternet,icon:"📡",color:"#10b981",bg:"#f0fdf4"},
                  {label:"Departments",value:stats.departments,icon:"🏢",color:"#ef4444",bg:"#fef2f2"},
                ].map((s,i)=>(
                  <div key={i} className="sc" style={{background:"#fff",borderRadius:14,padding:"20px 18px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",transition:"all 0.3s"}}>
                    <div style={{background:s.bg,borderRadius:11,padding:"9px 11px",fontSize:22,width:"fit-content",marginBottom:14}}>{s.icon}</div>
                    <div style={{fontSize:28,fontWeight:900,color:s.color}}>{s.value}</div>
                    <div style={{fontSize:13,color:"#64748b",fontWeight:600,marginTop:2}}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
                  <h3 style={{margin:"0 0 18px",fontSize:15,fontWeight:800,color:"#0f172a"}}>Top Departments by Assets</h3>
                  {deptStats.slice(0,10).map(([dept,count],i)=>(
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,color:"#475569",fontWeight:500,maxWidth:"75%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dept}</span>
                        <span style={{fontSize:12,fontWeight:800,color:"#0f172a"}}>{count}</span>
                      </div>
                      <div style={{background:"#f1f5f9",borderRadius:999,height:6}}>
                        <div style={{width:`${(count/deptStats[0][1])*100}%`,height:"100%",background:`hsl(${i*24+210},65%,52%)`,borderRadius:999}} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
                  <h3 style={{margin:"0 0 18px",fontSize:15,fontWeight:800,color:"#0f172a"}}>Assets by Floor</h3>
                  {floorStats.map(([floor,count],i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<floorStats.length-1?"1px solid #f8fafc":"none"}}>
                      <span style={{fontSize:13,color:"#475569"}}>📍 {floor}</span>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:70,background:"#f1f5f9",borderRadius:999,height:5}}>
                          <div style={{width:`${(count/floorStats[0][1])*100}%`,height:"100%",background:"#3b82f6",borderRadius:999}} />
                        </div>
                        <span style={{fontSize:13,fontWeight:800,color:"#0f172a",width:28,textAlign:"right"}}>{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── INVENTORY ── */}
          {view==="inventory"&&(
            <div style={{animation:"slideIn 0.4s ease"}}>
              {/* Filter bar */}
              <div style={{background:"#fff",borderRadius:13,padding:"14px 18px",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{position:"relative",flex:"1 1 220px"}}>
                  <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:15}}>🔍</span>
                  <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search name, hostname, IP, MAC, department..."
                    style={{width:"100%",padding:"9px 12px 9px 34px",border:"1px solid #e2e8f0",borderRadius:9,fontSize:13,boxSizing:"border-box",outline:"none",color:"#0f172a"}} />
                </div>
                <select value={filterDept} onChange={e=>{setFilterDept(e.target.value);setPage(1);}} style={{padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:9,fontSize:13,color:"#475569",outline:"none",cursor:"pointer",maxWidth:200}}>
                  <option value="">All Departments</option>
                  {uniqueDepts.map(d=><option key={d}>{d}</option>)}
                </select>
                <select value={filterFloor} onChange={e=>{setFilterFloor(e.target.value);setPage(1);}} style={{padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:9,fontSize:13,color:"#475569",outline:"none",cursor:"pointer"}}>
                  <option value="">All Floors</option>
                  {[...new Set(items.map(i=>i.floor).filter(Boolean))].sort().map(f=><option key={f}>{f}</option>)}
                </select>
                <select value={filterUSB} onChange={e=>{setFilterUSB(e.target.value);setPage(1);}} style={{padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:9,fontSize:13,color:"#475569",outline:"none",cursor:"pointer"}}>
                  <option value="">USB: All</option>
                  <option value="Yes">USB: Enabled</option>
                  <option value="No">USB: Disabled</option>
                </select>
                <select value={filterInternet} onChange={e=>{setFilterInternet(e.target.value);setPage(1);}} style={{padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:9,fontSize:13,color:"#475569",outline:"none",cursor:"pointer"}}>
                  <option value="">Internet: All</option>
                  <option value="Yes">Internet: Yes</option>
                  <option value="No">Internet: No</option>
                </select>
                <div style={{color:"#64748b",fontSize:12,whiteSpace:"nowrap",fontWeight:600}}>{filtered.length} record{filtered.length!==1?"s":""}</div>
                {duplicateIPs.size>0&&(
                  <button onClick={()=>{setFilterDuplicates(f=>!f);setPage(1);}} style={{padding:"9px 14px",borderRadius:9,border:filterDuplicates?"none":"1.5px solid #ef4444",background:filterDuplicates?"#ef4444":"#fff",color:filterDuplicates?"#fff":"#ef4444",fontSize:12,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:5,transition:"all 0.2s"}}>
                    🔴 Duplicate IPs ({duplicateIPs.size})
                  </button>
                )}
                {(search||filterDept||filterFloor||filterUSB||filterInternet)&&(
                  <button onClick={()=>{setSearch("");setFilterDept("");setFilterFloor("");setFilterUSB("");setFilterInternet("");setPage(1);}} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer",color:"#ef4444",fontWeight:600}}>✕ Clear</button>
                )}
              </div>

              {/* Table */}
              <div className="table-wrap" style={{background:"#fff",borderRadius:14,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",overflow:"hidden",marginBottom:16}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                    <thead>
                      <tr style={{background:"linear-gradient(135deg,#0a1628,#0d2044)",color:"#fff"}}>
                        {[["id","Asset ID"],["name","User / Name"],["hostname","Hostname"],["ip","IP Address"],["mac","MAC Address"],["floor","Floor"],["department","Department"]].map(([f,l])=>(
                          <th key={f} onClick={()=>sortToggle(f)} style={{padding:"13px 14px",textAlign:"left",fontSize:11,fontWeight:700,letterSpacing:0.8,cursor:"pointer",whiteSpace:"nowrap",userSelect:"none",opacity:.9}}>
                            {l}<SortIcon f={f}/>
                          </th>
                        ))}
                        <th style={{padding:"13px 14px",textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:0.8,whiteSpace:"nowrap",opacity:.9}}>USB/Net</th>
                        <th style={{padding:"13px 14px",textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:0.8,opacity:.9}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.length===0?(
                        <tr><td colSpan={9} style={{textAlign:"center",padding:"48px 24px",color:"#94a3b8",fontSize:15}}>No records match your filter criteria.</td></tr>
                      ):paged.map((item,i)=>(
                        <tr key={item.id} className="tr" style={{borderBottom:"1px solid #f1f5f9",transition:"background 0.12s",background:duplicateIPs.has(item.ip)?"#fff5f5":""}}>
                          <td style={{padding:"11px 14px",fontSize:12,fontWeight:700,color:"#6366f1",fontFamily:"monospace",whiteSpace:"nowrap"}}>{item.id}</td>
                          <td style={{padding:"11px 14px",fontSize:13,color:"#0f172a",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name||<span style={{color:"#cbd5e1",fontStyle:"italic"}}>—</span>}</td>
                          <td style={{padding:"11px 14px",fontSize:12,fontFamily:"monospace",color:"#1e40af",whiteSpace:"nowrap"}}>{item.hostname||"—"}</td>
                          <td style={{padding:"11px 14px",fontSize:12,fontFamily:"monospace",color:duplicateIPs.has(item.ip)?"#dc2626":"#059669",fontWeight:duplicateIPs.has(item.ip)?800:400,whiteSpace:"nowrap"}}>{item.ip||"—"}{duplicateIPs.has(item.ip)&&<span style={{marginLeft:5,background:"#fee2e2",color:"#dc2626",fontSize:10,fontWeight:700,borderRadius:5,padding:"1px 5px"}}>DUP</span>}</td>
                          <td style={{padding:"11px 14px",fontSize:11,fontFamily:"monospace",color:"#64748b",whiteSpace:"nowrap"}}>{item.mac||"—"}</td>
                          <td style={{padding:"11px 14px",fontSize:12,color:"#475569",whiteSpace:"nowrap"}}>{item.floor||"—"}</td>
                          <td style={{padding:"11px 14px",fontSize:12,color:"#475569",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.department||<span style={{color:"#e2e8f0"}}>—</span>}</td>
                          <td style={{padding:"11px 14px",textAlign:"center"}}>
                            <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                              {item.usb==="Yes"&&<span style={{background:"#fef3c7",color:"#d97706",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 6px"}}>USB</span>}
                              {item.internet==="Yes"&&<span style={{background:"#dcfce7",color:"#16a34a",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 6px"}}>NET</span>}
                            </div>
                          </td>
                          <td style={{padding:"11px 14px",textAlign:"center"}}>
                            <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                              <button className="ic" onClick={()=>setDetailItem(item)} title="View Details" style={{background:"none",border:"none",borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:14,transition:"background 0.12s"}}>👁</button>
                              <button className="ic" onClick={()=>openEdit(item)} title="Edit" style={{background:"none",border:"none",borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:14,transition:"background 0.12s"}}>✏️</button>
                              <button className="ic" onClick={()=>setDeleteConfirm(item)} title="Delete" style={{background:"none",border:"none",borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:14,transition:"background 0.12s"}}>🗑️</button>
                              <button className="ic" onClick={()=>{ setHistoryModal({ip:item.ip,hostname:item.hostname}); fetchHistory(item.ip); }} title="IP History" style={{background:"none",border:"none",borderRadius:7,width:30,height:30,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",color:"#7c3aed",transition:"all 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="#ede9fe"} onMouseLeave={e=>e.currentTarget.style.background="none"}>🕐</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages>1&&(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0"}}>
                  <div style={{color:"#64748b",fontSize:13}}>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of <b>{filtered.length}</b></div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setPage(1)} disabled={page===1} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:page===1?"not-allowed":"pointer",color:page===1?"#cbd5e1":"#475569",fontSize:13}}>«</button>
                    <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"7px 12px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:page===1?"not-allowed":"pointer",color:page===1?"#cbd5e1":"#475569",fontSize:13}}>‹ Prev</button>
                    {[...Array(Math.min(5,totalPages))].map((_,i)=>{
                      const p=Math.max(1,Math.min(totalPages-4,page-2))+i;
                      return <button key={p} onClick={()=>setPage(p)} style={{padding:"7px 12px",border:`1px solid ${p===page?"#3b82f6":"#e2e8f0"}`,borderRadius:8,background:p===page?"#3b82f6":"#fff",color:p===page?"#fff":"#475569",cursor:"pointer",fontWeight:p===page?700:400,fontSize:13}}>{p}</button>;
                    })}
                    <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"7px 12px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?"#cbd5e1":"#475569",fontSize:13}}>Next ›</button>
                    <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?"#cbd5e1":"#475569",fontSize:13}}>»</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NETWORK VIEW ── */}
          {view==="network"&&(
            <div style={{animation:"slideIn 0.4s ease"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
                {[
                  {label:"Unique IP Ranges",value:[...new Set(items.map(i=>i.ip?.split(".").slice(0,3).join(".")).filter(Boolean))].length,icon:"🌐",color:"#3b82f6"},
                  {label:"Unique Gateways",value:[...new Set(items.map(i=>i.gateway).filter(Boolean))].length,icon:"🔀",color:"#8b5cf6"},
                  {label:"Unique Switches",value:[...new Set(items.map(i=>i.switch).filter(Boolean))].length,icon:"🔌",color:"#f59e0b"},
                ].map((s,i)=>(
                  <div key={i} style={{background:"#fff",borderRadius:14,padding:"20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:16}}>
                    <div style={{fontSize:32}}>{s.icon}</div>
                    <div><div style={{fontSize:26,fontWeight:900,color:s.color}}>{s.value}</div><div style={{fontSize:13,color:"#64748b",fontWeight:600}}>{s.label}</div></div>
                  </div>
                ))}
              </div>
              <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
                <h3 style={{margin:"0 0 18px",fontSize:15,fontWeight:800,color:"#0f172a"}}>IP Subnet Breakdown</h3>
                {(() => {
                  const map = {};
                  items.forEach(i => { if(i.ip) { const sub=i.ip.split(".").slice(0,3).join("."); map[sub]=(map[sub]||0)+1; } });
                  return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([sub,count],i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f8fafc"}}>
                      <code style={{fontSize:13,color:"#1e40af",width:140,flexShrink:0}}>{sub}.0/24</code>
                      <div style={{flex:1,background:"#f1f5f9",borderRadius:999,height:8}}>
                        <div style={{width:`${(count/Object.values(map).reduce((a,b)=>Math.max(a,b),1))*100}%`,height:"100%",background:"linear-gradient(90deg,#3b82f6,#6366f1)",borderRadius:999}} />
                      </div>
                      <span style={{fontSize:13,fontWeight:800,color:"#0f172a",width:30,textAlign:"right"}}>{count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {view==="reports"&&(
            <div style={{animation:"slideIn 0.4s ease",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",gridColumn:"1/-1"}}>
                <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:800}}>All Departments Summary</h3>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"#f8fafc"}}>
                        {["#","Department","Assets","USB Enabled","Internet","Floors"].map(h=>(
                          <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:0.5}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deptStats.map(([dept,count],i)=>{
                        const dItems=items.filter(x=>x.department===dept);
                        const usb=dItems.filter(x=>x.usb==="Yes").length;
                        const net=dItems.filter(x=>x.internet==="Yes").length;
                        const floors=[...new Set(dItems.map(x=>x.floor).filter(Boolean))].join(", ");
                        return (
                          <tr key={i} style={{borderBottom:"1px solid #f1f5f9"}}>
                            <td style={{padding:"10px 14px",fontSize:12,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                            <td style={{padding:"10px 14px",fontSize:13,fontWeight:600,color:"#0f172a"}}>{dept}</td>
                            <td style={{padding:"10px 14px",fontSize:13,fontWeight:800,color:"#3b82f6"}}>{count}</td>
                            <td style={{padding:"10px 14px",fontSize:12,color:usb>0?"#d97706":"#cbd5e1"}}>{usb>0?`✓ ${usb}`:"—"}</td>
                            <td style={{padding:"10px 14px",fontSize:12,color:net>0?"#16a34a":"#cbd5e1"}}>{net>0?`✓ ${net}`:"—"}</td>
                            <td style={{padding:"10px 14px",fontSize:11,color:"#64748b",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{floors||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY VIEW */}
          {view==="history"&&(
            <div style={{animation:"slideIn 0.4s ease"}}>
              <div style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:18}}>
                  <h3 style={{margin:0,fontSize:16,fontWeight:800,color:"#0f172a"}}>🕐 IP Usage History</h3>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <input value={historyFilter.ip} onChange={e=>setHistoryFilter(p=>({...p,ip:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&fetchHistory(historyFilter.ip,historyFilter.action,1)}
                      placeholder="Filter by IP..." style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,width:170,outline:"none"}} />
                    <select value={historyFilter.action} onChange={e=>setHistoryFilter(p=>({...p,action:e.target.value}))}
                      style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,background:"#fff",outline:"none"}}>
                      <option value="">All Actions</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="UPDATED">UPDATED</option>
                      <option value="RELEASED">RELEASED</option>
                      <option value="IP_CHANGED">IP CHANGED</option>
                    </select>
                    <button onClick={()=>fetchHistory(historyFilter.ip,historyFilter.action,1)} style={{padding:"8px 14px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:600}}>🔍 Search</button>
                    <button onClick={()=>exportHistory(historyFilter.ip,historyFilter.action)} style={{padding:"8px 14px",background:"#059669",color:"#fff",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:600}}>📥 Export CSV</button>
                    <button onClick={()=>{ setHistoryFilter({ip:"",action:""}); fetchHistory("","",1); }} style={{padding:"8px 12px",background:"#f8fafc",color:"#475569",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:13,cursor:"pointer"}}>✕ Clear</button>
                  </div>
                </div>
                {historyLoading?(<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Loading history...</div>):historyData.rows.length===0?(
                  <div style={{textAlign:"center",padding:"40px",color:"#94a3b8",fontSize:14}}>No history records found. Records appear here when IPs are assigned, updated or released.</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <div style={{marginBottom:10,fontSize:12,color:"#64748b"}}>Showing {historyData.rows.length} of {historyData.total} records</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead><tr style={{background:"#f8fafc"}}>
                        {["#","IP Address","Action","Hostname","User/Device","Department","Floor","MAC","Changed By","Date & Time"].map(h=>(
                          <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:0.5,whiteSpace:"nowrap"}}>{h}</th>
                        ))}</tr></thead>
                      <tbody>
                        {historyData.rows.map((h,i)=>(
                          <tr key={h.id} style={{borderBottom:"1px solid #f1f5f9"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                            <td style={{padding:"10px 12px",color:"#94a3b8",fontSize:11}}>{i+1}</td>
                            <td style={{padding:"10px 12px"}}><span style={{fontFamily:"monospace",fontWeight:700,color:"#1e40af",background:"#eff6ff",padding:"2px 8px",borderRadius:5,cursor:"pointer"}} onClick={()=>{ setHistoryModal({ip:h.ip,hostname:h.hostname}); setHistoryData({rows:[],total:0,page:1}); fetchHistory(h.ip); }}>{h.ip||"—"}</span></td>
                            <td style={{padding:"10px 12px"}}><span style={{padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:h.action==="ASSIGNED"?"#dcfce7":h.action==="RELEASED"?"#fee2e2":h.action==="IP_CHANGED"?"#fef3c7":"#eff6ff",color:h.action==="ASSIGNED"?"#15803d":h.action==="RELEASED"?"#dc2626":h.action==="IP_CHANGED"?"#d97706":"#1d4ed8"}}>{h.action}</span></td>
                            <td style={{padding:"10px 12px",fontFamily:"monospace",fontSize:12,color:"#334155"}}>{h.hostname||"—"}</td>
                            <td style={{padding:"10px 12px",fontSize:12,color:"#334155"}}>{h.name||"—"}</td>
                            <td style={{padding:"10px 12px",fontSize:12,color:"#64748b"}}>{h.department||"—"}</td>
                            <td style={{padding:"10px 12px",fontSize:12,color:"#64748b"}}>{h.floor||"—"}</td>
                            <td style={{padding:"10px 12px",fontFamily:"monospace",fontSize:11,color:"#64748b"}}>{h.mac||"—"}</td>
                            <td style={{padding:"10px 12px",fontSize:12}}><span style={{fontWeight:600,color:"#7c3aed"}}>{h.changedByName||h.changedBy||"—"}</span><div style={{fontSize:10,color:"#94a3b8"}}>{h.changedBy}</div></td>
                            <td style={{padding:"10px 12px",fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{h.changedAt||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {historyData.total>50&&(
                      <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:16}}>
                        {historyData.page>1&&<button onClick={()=>fetchHistory(historyFilter.ip,historyFilter.action,historyData.page-1)} style={{padding:"6px 14px",border:"1.5px solid #e2e8f0",borderRadius:7,cursor:"pointer",fontSize:13,background:"#fff"}}>← Prev</button>}
                        <span style={{padding:"6px 14px",fontSize:13,color:"#64748b"}}>Page {historyData.page}</span>
                        {historyData.rows.length===50&&<button onClick={()=>fetchHistory(historyFilter.ip,historyFilter.action,historyData.page+1)} style={{padding:"6px 14px",border:"1.5px solid #e2e8f0",borderRadius:7,cursor:"pointer",fontSize:13,background:"#fff"}}>Next →</button>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {/* IP HISTORY MODAL */}
      {historyModal&&(
        <div onClick={()=>setHistoryModal(null)} className="resp-modal-wrap" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease"}}>
          <div onClick={e=>e.stopPropagation()} className="resp-modal" style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:720,maxHeight:"85vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.25)"}}>
            <div style={{background:"linear-gradient(135deg,#4c1d95,#7c3aed)",padding:"20px 24px",borderRadius:"20px 20px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:1}}>
              <div>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>IP Usage History</div>
                <div style={{color:"#fff",fontSize:18,fontWeight:800,marginTop:4,fontFamily:"monospace"}}>{historyModal.ip}</div>
                {historyModal.hostname&&<div style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:2}}>{historyModal.hostname}</div>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>exportHistory(historyModal.ip)} style={{padding:"7px 14px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:600}}>📥 Export CSV</button>
                <button onClick={()=>setHistoryModal(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:18,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>
            </div>
            <div style={{padding:"20px 24px"}}>
              {historyLoading?(<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Loading...</div>
              ):historyData.rows.length===0?(
                <div style={{textAlign:"center",padding:"40px",color:"#94a3b8",fontSize:14}}>No history found for this IP address.</div>
              ):(
                <div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{historyData.total} event(s) for <b style={{color:"#1e40af"}}>{historyModal.ip}</b></div>
                  {historyData.rows.map((h,i)=>(
                    <div key={h.id} style={{display:"flex",gap:14,marginBottom:16}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <div style={{width:38,height:38,borderRadius:"50%",background:h.action==="ASSIGNED"?"#dcfce7":h.action==="RELEASED"?"#fee2e2":h.action==="IP_CHANGED"?"#fef3c7":"#eff6ff",border:"2px solid "+(h.action==="ASSIGNED"?"#16a34a":h.action==="RELEASED"?"#dc2626":h.action==="IP_CHANGED"?"#d97706":"#3b82f6"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                          {h.action==="ASSIGNED"?"✅":h.action==="RELEASED"?"🔴":h.action==="IP_CHANGED"?"🔄":"✏️"}
                        </div>
                        {i<historyData.rows.length-1&&<div style={{width:2,flex:1,background:"#e2e8f0",minHeight:12,margin:"3px 0"}}/>}
                      </div>
                      <div style={{flex:1,background:"#f8fafc",borderRadius:10,padding:"12px 16px",border:"1px solid #f1f5f9"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:h.action==="ASSIGNED"?"#dcfce7":h.action==="RELEASED"?"#fee2e2":h.action==="IP_CHANGED"?"#fef3c7":"#eff6ff",color:h.action==="ASSIGNED"?"#15803d":h.action==="RELEASED"?"#dc2626":h.action==="IP_CHANGED"?"#d97706":"#1d4ed8"}}>{h.action}</span>
                            {h.hostname&&<span style={{fontFamily:"monospace",fontSize:12,color:"#334155",fontWeight:600}}>{h.hostname}</span>}
                          </div>
                          <span style={{fontSize:11,color:"#94a3b8",whiteSpace:"nowrap"}}>{h.changedAt}</span>
                        </div>
                        <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
                          {[
                            ["👤 User/Device", (h.newData||h.oldData)?.name],
                            ["🖥 Hostname",    (h.newData||h.oldData)?.hostname],
                            ["🌐 IP Address",  (h.newData||h.oldData)?.ip],
                            ["🔀 Subnet",      (h.newData||h.oldData)?.subnet],
                            ["🚪 Gateway",     (h.newData||h.oldData)?.gateway],
                            ["📡 MAC Address", (h.newData||h.oldData)?.mac],
                            ["🏢 Department",  (h.newData||h.oldData)?.department],
                            ["📍 Floor",       (h.newData||h.oldData)?.floor],
                            ["🔌 USB",         (h.newData||h.oldData)?.usb],
                            ["🌍 Internet",    (h.newData||h.oldData)?.internet],
                            ["🔧 Faceplate",   (h.newData||h.oldData)?.faceplate],
                            ["🔢 Port No.",    (h.newData||h.oldData)?.port_number],
                            ["⚡ Switch",      (h.newData||h.oldData)?.switch_name],
                            ["📞 Extension",   (h.newData||h.oldData)?.ext],
                          ].filter(([,v])=>v).map(([label,val])=>(
                            <div key={label} style={{display:"flex",gap:4,alignItems:"flex-start"}}>
                              <span style={{fontSize:11,color:"#94a3b8",minWidth:90,flexShrink:0}}>{label}</span>
                              <span style={{fontSize:11,fontWeight:600,color:"#334155",fontFamily:label.includes("IP")||label.includes("MAC")||label.includes("Subnet")||label.includes("Gateway")?"monospace":"inherit",wordBreak:"break-all"}}>{val}</span>
                            </div>
                          ))}
                        </div>
                        {(h.action==="UPDATED"||h.action==="IP_CHANGED")&&h.oldData&&h.newData&&(()=>{
                          const fields={name:"User/Device",hostname:"Hostname",ip:"IP Address",mac:"MAC",department:"Department",floor:"Floor",subnet:"Subnet",gateway:"Gateway",usb:"USB",internet:"Internet"};
                          const changed=Object.keys(fields).filter(k=>(h.oldData[k]||"")!==(h.newData[k]||""));
                          if(!changed.length) return null;
                          return(
                            <div style={{marginTop:10,background:"#fffbeb",borderRadius:8,padding:"8px 12px",border:"1px solid #fde68a"}}>
                              <div style={{fontSize:10,fontWeight:700,color:"#92400e",letterSpacing:1,marginBottom:6}}>CHANGED FIELDS</div>
                              {changed.map(k=>(
                                <div key={k} style={{display:"flex",gap:8,fontSize:11,marginBottom:4,alignItems:"flex-start"}}>
                                  <span style={{color:"#92400e",minWidth:80,fontWeight:600}}>{fields[k]}</span>
                                  <span style={{color:"#dc2626",textDecoration:"line-through",fontFamily:"monospace"}}>{h.oldData[k]||"—"}</span>
                                  <span style={{color:"#64748b"}}>→</span>
                                  <span style={{color:"#16a34a",fontFamily:"monospace",fontWeight:600}}>{h.newData[k]||"—"}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:11,color:"#7c3aed"}}>Changed by: <b>{h.changedByName||h.changedBy}</b></span>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{h.changedBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detailItem&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease",padding:20}} onClick={()=>setDetailItem(null)}>
          <div onClick={e=>e.stopPropagation()} className="resp-modal" style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto",boxShadow:"0 40px 80px rgba(0,0,0,0.35)",animation:"slideIn 0.3s ease"}}>
            <div style={{background:"linear-gradient(135deg,#0a1628,#1e3a6e)",padding:"22px 24px",borderRadius:"20px 20px 0 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{color:"rgba(200,168,75,0.9)",fontSize:11,letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>Asset #{detailItem.id}</div>
                <h3 style={{margin:"6px 0 0",color:"#fff",fontSize:17,fontWeight:800}}>{detailItem.hostname||detailItem.name||"Unknown Asset"}</h3>
                {detailItem.name&&detailItem.hostname&&<div style={{color:"rgba(255,255,255,0.5)",fontSize:13,marginTop:2}}>{detailItem.name}</div>}
              </div>
              <button onClick={()=>setDetailItem(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18,flexShrink:0}}>✕</button>
            </div>
            <div style={{padding:24,display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
              {[["Hostname",detailItem.hostname],["IP Address",detailItem.ip],["MAC Address",detailItem.mac],["Subnet Mask",detailItem.subnet],["Gateway",detailItem.gateway],["Floor",detailItem.floor],["Department",detailItem.department],["Extension",detailItem.ext],["USB",detailItem.usb||"No"],["Internet",detailItem.internet||"No"],["Faceplate",detailItem.faceplate],["Port Number",detailItem.portNumber],["Switch",detailItem.switch],["Last Updated",detailItem.updatedAt],["Created At",detailItem.createdAt],["Assigned To",detailItem.name]].map(([k,v],i)=>(
                <div key={i} style={{padding:"11px 0",borderBottom:"1px solid #f1f5f9",gridColumn:k==="Assigned To"?"1/-1":"auto"}}>
                  <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>{k}</div>
                  <div style={{fontSize:13,color:v?"#0f172a":"#e2e8f0",fontFamily:["IP Address","MAC Address","Subnet Mask","Gateway","Hostname","Port Number"].includes(k)?"monospace":"inherit",fontWeight:v?500:400}}>{v||"—"}</div>
                </div>
              ))}
            </div>
            <div style={{padding:"0 24px 24px",display:"flex",gap:10}}>
              <button onClick={()=>{openEdit(detailItem);}} style={{flex:1,padding:12,background:"linear-gradient(135deg,#1e40af,#3b82f6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>✏️ Edit Asset</button>
              <button onClick={()=>setDetailItem(null)} style={{flex:1,padding:12,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,color:"#475569",fontSize:14,cursor:"pointer"}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD/EDIT MODAL ── */}
      {showModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease",padding:20}}>
          <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:680,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 40px 80px rgba(0,0,0,0.35)",animation:"slideIn 0.3s ease"}}>
            <div style={{background:"linear-gradient(135deg,#0a1628,#1e3a6e)",padding:"22px 28px",borderRadius:"20px 20px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
              <div>
                <h3 style={{margin:0,color:"#fff",fontSize:17,fontWeight:800}}>{editItem?"Edit Asset":"Add New Asset"}</h3>
                <div style={{color:"rgba(255,255,255,0.45)",fontSize:12,marginTop:2}}>{editItem?`Updating ${editItem.id}`:"Fill in the asset details"}</div>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",color:"#fff",fontSize:18}}>✕</button>
            </div>
            <div style={{padding:28}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {[
                  ["name","User / Asset Name","text","1/-1"],
                  ["hostname","Hostname","text",null],
                  ["ip","IP Address","text",null],
                  ["subnet","Subnet Mask","text",null],
                  ["gateway","Gateway","text",null],
                  ["mac","MAC Address","text","1/-1"],
                  ["floor","Floor","text",null],
                  ["department","Department","text",null],
                  ["ext","Extension","text",null],
                  ["faceplate","Faceplate","text",null],
                  ["portNumber","Port Number","text",null],
                  ["switch","Switch","text",null],
                ].map(([key,label,type,col])=>(
                  <div key={key} style={col?{gridColumn:col}:{}}>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8}}>{label}</label>
                    <input type={type} value={form[key]||""} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{width:"100%",padding:"10px 13px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:14,color:"#0f172a",outline:"none",boxSizing:"border-box",fontFamily:["IP Address","MAC Address","Hostname","Port Number","Faceplate","Switch"].includes(label)?"monospace":"inherit"}} />
                  </div>
                ))}
                {[["usb","USB Enabled",USB_OPTS],["internet","Internet Access",INTERNET_OPTS]].map(([key,label,opts])=>(
                  <div key={key}>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:0.8}}>{label}</label>
                    <select value={form[key]||""} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{width:"100%",padding:"10px 13px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:14,color:"#0f172a",outline:"none",boxSizing:"border-box"}}>
                      <option value="">—</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:12,marginTop:24}}>
                <button onClick={()=>setShowModal(false)} style={{flex:1,padding:13,border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:14,cursor:"pointer",color:"#475569",background:"#fff"}}>Cancel</button>
                <button onClick={saveItem} style={{flex:2,padding:13,border:"none",borderRadius:12,fontSize:14,cursor:"pointer",color:"#fff",background:"linear-gradient(135deg,#1e40af,#3b82f6)",fontWeight:800}}>
                  {editItem?"💾 Update Asset":"➕ Add to Inventory"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.2s ease",padding:20}}>
          <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:400,width:"100%",boxShadow:"0 40px 80px rgba(0,0,0,0.35)",animation:"slideIn 0.3s ease",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:16}}>⚠️</div>
            <h3 style={{margin:"0 0 8px",color:"#0f172a",fontSize:17,fontWeight:800}}>Delete Asset?</h3>
            <p style={{color:"#64748b",fontSize:14,margin:"0 0 8px"}}><b>{deleteConfirm.hostname||deleteConfirm.name||"This asset"}</b></p>
            <p style={{color:"#94a3b8",fontSize:13,margin:"0 0 24px"}}>IP: {deleteConfirm.ip||"—"} · Dept: {deleteConfirm.department||"—"}</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:12,border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:14,cursor:"pointer",color:"#475569",background:"#fff"}}>Cancel</button>
              <button onClick={()=>handleDelete(deleteConfirm.id)} style={{flex:1,padding:12,border:"none",borderRadius:12,fontSize:14,cursor:"pointer",color:"#fff",background:"#ef4444",fontWeight:800}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
