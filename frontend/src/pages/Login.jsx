import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, Lock, Loader2, ArrowRight, Shield, Zap, BarChart3, Brain, CheckCircle2, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function NexaLogo({ size = 40, showText = true }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="24,2 43,13 43,35 24,46 5,35 5,13" fill="url(#hg)" stroke="url(#sg)" strokeWidth="1.5"/>
        <polyline points="14,34 14,14 30,34 30,14" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="34" cy="14" r="3" fill="#22D3EE"/>
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#4F46E5"/></linearGradient>
          <linearGradient id="sg" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stopColor="#818CF8"/><stop offset="100%" stopColor="#6366F1"/></linearGradient>
        </defs>
      </svg>
      {showText && (
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"white", letterSpacing:"-0.5px", lineHeight:1 }}>NexaOps</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", letterSpacing:"0.08em", marginTop:2, textTransform:"uppercase" }}>Intelligence Platform</div>
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: Brain,     label:"AI-Powered SQL Assistant",  desc:"Natural language → SQL in seconds" },
  { icon: BarChart3, label:"Real-time Analytics",       desc:"Live KPIs & interactive dashboards" },
  { icon: Shield,    label:"Enterprise Security",       desc:"Role-based access & full audit trail" },
  { icon: Zap,       label:"Automated SQL Workflows",   desc:"Schedule, monitor & alert on queries" },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
.lr { display:flex; min-height:100vh; font-family:'Inter',system-ui,sans-serif; background:#060918; }
.ll { flex:1.1; display:flex; flex-direction:column; justify-content:space-between; padding:48px; position:relative; overflow:hidden;
  background:linear-gradient(135deg,#0c0f2e 0%,#0d1b4b 40%,#0a1628 100%); }
.ll::before { content:''; position:absolute; inset:0; pointer-events:none;
  background: radial-gradient(ellipse 60% 50% at 20% 30%,rgba(99,102,241,.18) 0%,transparent 70%),
              radial-gradient(ellipse 40% 40% at 80% 70%,rgba(34,211,238,.1) 0%,transparent 60%); }
.gg { position:absolute; inset:0; pointer-events:none;
  background-image:linear-gradient(rgba(99,102,241,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.06) 1px,transparent 1px);
  background-size:48px 48px; }
.lc { position:relative; z-index:1; }
.tg { margin-top:56px; }
.tg h2 { font-size:40px; font-weight:800; line-height:1.15; letter-spacing:-1px; margin:0 0 16px;
  background:linear-gradient(135deg,#fff 30%,#818CF8 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.tg p { font-size:15px; color:rgba(255,255,255,.5); line-height:1.6; max-width:380px; margin:0; }
.fl { margin-top:48px; display:flex; flex-direction:column; gap:10px; }
.fi { display:flex; align-items:center; gap:14px; padding:13px 16px; border-radius:14px; border:1px solid transparent; transition:all .5s; }
.fi.act { background:rgba(99,102,241,.12); border-color:rgba(99,102,241,.35); }
.fiw { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:rgba(99,102,241,.2); transition:background .4s; }
.fi.act .fiw { background:rgba(99,102,241,.35); }
.ft h4 { font-size:13px; font-weight:600; color:white; margin:0 0 2px; }
.ft p { font-size:12px; color:rgba(255,255,255,.4); margin:0; }
.lf { position:relative; z-index:1; display:flex; align-items:center; gap:24px; }
.sp { display:flex; flex-direction:column; }
.sp .n { font-size:22px; font-weight:800; color:white; line-height:1; }
.sp .l { font-size:11px; color:rgba(255,255,255,.4); margin-top:2px; }
.sd { width:1px; height:32px; background:rgba(255,255,255,.12); }
.rp { flex:.9; display:flex; align-items:center; justify-content:center; padding:48px 40px; background:#080c1e; }
.rc { width:100%; max-width:420px; }
.ch { margin-bottom:36px; }
.ch h1 { font-size:28px; font-weight:800; color:white; margin:0 0 8px; letter-spacing:-.5px; }
.ch p { font-size:14px; color:rgba(255,255,255,.45); margin:0; }
.ch p span { color:#818CF8; font-weight:500; }
.dc { background:rgba(99,102,241,.08); border:1px solid rgba(99,102,241,.25); border-radius:12px; padding:14px 16px; margin-bottom:22px; }
.dct { font-size:11px; font-weight:600; color:rgba(130,140,248,.9); text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
.dcr { display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,.5); margin-bottom:3px; }
.dcv { color:rgba(255,255,255,.8); font-family:monospace; }
.fg { margin-bottom:18px; }
.lb { display:block; font-size:13px; font-weight:500; color:rgba(255,255,255,.65); margin-bottom:7px; }
.iw { position:relative; }
.ic { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,.3); pointer-events:none; }
.fi2 { width:100%; padding:12px 14px 12px 42px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:12px; color:white; font-size:14px; font-family:'Inter',sans-serif; outline:none; transition:all .2s; box-sizing:border-box; }
.fi2::placeholder { color:rgba(255,255,255,.2); }
.fi2:focus { border-color:rgba(99,102,241,.6); background:rgba(99,102,241,.08); box-shadow:0 0 0 3px rgba(99,102,241,.15); }
.fi2.err { border-color:rgba(239,68,68,.6); background:rgba(239,68,68,.05); }
.et { font-size:11.5px; color:#F87171; margin-top:5px; }
.pt { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; color:rgba(255,255,255,.3); cursor:pointer; font-size:12px; font-family:'Inter',sans-serif; }
.pt:hover { color:rgba(255,255,255,.6); }
.bl { width:100%; padding:13px; background:linear-gradient(135deg,#6366F1 0%,#4F46E5 100%); color:white; border:none; border-radius:12px; font-size:15px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all .2s; box-shadow:0 4px 24px rgba(99,102,241,.35); }
.bl:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 32px rgba(99,102,241,.5); }
.bl:disabled { opacity:.6; cursor:not-allowed; }
.sr { text-align:center; margin-top:22px; font-size:13px; color:rgba(255,255,255,.35); }
.sl { color:#818CF8; font-weight:600; text-decoration:none; margin-left:4px; }
.sl:hover { color:#A5B4FC; }
.sn { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:18px; font-size:11px; color:rgba(255,255,255,.2); }
@keyframes spin2 { to { transform:rotate(360deg); } }
@media(max-width:900px) { .ll { display:none; } .rp { flex:1; background:#060918; } }
`;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [activeF, setActiveF] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveF(p => (p + 1) % FEATURES.length), 3000);
    return () => clearInterval(t);
  }, []);

  const validate = () => {
    const e = {};
    if (!email) e.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email.";
    if (!password) e.password = "Password is required.";
    else if (password.length < 6) e.password = "Min 6 characters.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back! 🚀");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="lr">
        {/* LEFT */}
        <div className="ll">
          <div className="gg" />
          <div className="lc">
            <NexaLogo size={44} />
            <div className="tg">
              <h2>Your Operations,<br />Supercharged by AI.</h2>
              <p>Query your entire data warehouse in plain English. Automate workflows. Get real-time alerts. All in one platform.</p>
            </div>
            <div className="fl">
              {FEATURES.map((f, i) => (
                <div key={i} className={`fi ${i === activeF ? "act" : ""}`}>
                  <div className="fiw"><f.icon size={17} color={i === activeF ? "#818CF8" : "rgba(255,255,255,0.4)"} /></div>
                  <div className="ft"><h4>{f.label}</h4><p>{f.desc}</p></div>
                  {i === activeF && <ChevronRight size={13} color="#6366F1" style={{ marginLeft:"auto" }} />}
                </div>
              ))}
            </div>
          </div>
          <div className="lf">
            <div className="sp"><span className="n">10K+</span><span className="l">Queries Automated</span></div>
            <div className="sd" />
            <div className="sp"><span className="n">99.9%</span><span className="l">Uptime SLA</span></div>
            <div className="sd" />
            <div className="sp"><span className="n">3x</span><span className="l">Faster Insights</span></div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="rp">
          <div className="rc">
            <div className="ch">
              <div style={{ marginBottom:28 }}><NexaLogo size={36} /></div>
              <h1>Welcome back</h1>
              <p>Sign in to your workspace. <span>New here?</span></p>
            </div>

            <div className="dc">
              <div className="dct"><CheckCircle2 size={12} /> Demo Credentials</div>
              <div className="dcr"><span>Email</span><span className="dcv">arjungaur2727@gmail.com</span></div>
              <div className="dcr"><span>Password</span><span className="dcv">admin123</span></div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="fg">
                <label className="lb" htmlFor="login-email">Email address</label>
                <div className="iw">
                  <Mail size={15} className="ic" />
                  <input id="login-email" type="email" autoComplete="email" value={email}
                    onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                    className={`fi2 ${errors.email ? "err" : ""}`} />
                </div>
                {errors.email && <p className="et">{errors.email}</p>}
              </div>

              <div className="fg">
                <label className="lb" htmlFor="login-password">Password</label>
                <div className="iw">
                  <Lock size={15} className="ic" />
                  <input id="login-password" type={showPwd ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                    className={`fi2 ${errors.password ? "err" : ""}`} />
                  <button type="button" className="pt" onClick={() => setShowPwd(p => !p)} tabIndex={-1}>
                    {showPwd ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && <p className="et">{errors.password}</p>}
              </div>

              <button id="login-submit-btn" type="submit" disabled={loading} className="bl">
                {loading
                  ? <><Loader2 size={16} style={{ animation:"spin2 1s linear infinite" }} /> Signing in…</>
                  : <>Sign in <ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="sr">Don't have an account?<Link to="/register" className="sl">Create one →</Link></p>
            <div className="sn"><Shield size={11} /> Access restricted to authorised personnel only.</div>
          </div>
        </div>
      </div>
    </>
  );
}
