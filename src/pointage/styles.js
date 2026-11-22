export const styles = `
:root { --bg:#1c1917; --panel:#262220; --raised:#2f2a27; --fire:#e8452c; --gold:#e8a230; --sea:#3d8a9c; --ok:#3f9d5a; --text:#f5f0e8; --muted:#b8aca0; --border:#3a342f; }
* { box-sizing: border-box; }
html, body { margin:0; background: var(--bg); }
.pt-root { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
.pt-screen { max-width: 680px; margin: 0 auto; padding: calc(16px + env(safe-area-inset-top)) 16px 60px; }
.muted { color: var(--muted); } .small { font-size: 13px; } .gold { color: var(--gold); } .center-txt { text-align:center; margin-top:80px; }
.eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 11px; color: var(--gold); font-weight: 700; margin: 0 0 2px; }
.pt-title { font-size: 30px; margin: 0; font-weight: 800; letter-spacing: .01em; }
.pt-h2 { font-size: 22px; margin: 6px 0 2px; } .pt-h3 { margin: 0 0 12px; font-size: 18px; }
.pt-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 16px; }
.ghost-btn { background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 9px 14px; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; }
.ghost-btn:disabled { opacity:.4; }
.primary-btn { background: var(--fire); color:#fff; border:none; padding: 15px 18px; border-radius: 12px; font-weight: 700; font-size: 16px; cursor:pointer; }
.primary-btn.alt { background: var(--sea); }
.primary-btn:disabled { opacity: .35; }
.primary-btn.full { width: 100%; } .mt { margin-top: 10px; }
.danger-btn { background: transparent; border: 1px solid var(--fire); color: var(--fire); padding: 9px 12px; border-radius: 10px; font-weight: 600; margin-top: 8px; }
.link-btn { background:none; border:none; color: var(--gold); font-size: 13px; padding: 6px 8px; cursor:pointer; text-decoration: underline; }
.link-btn.red { color: var(--fire); }
.back-btn { background:none; border:none; color: var(--muted); font-size: 15px; padding: 0; margin-bottom: 6px; cursor:pointer; }
.week-nav { display:flex; align-items:center; gap: 8px; background: var(--panel); border:1px solid var(--border); border-radius: 14px; padding: 8px; margin-bottom: 12px; }
.nav-btn { background: var(--raised); border:none; color: var(--text); font-size: 26px; width: 44px; height: 44px; border-radius: 10px; cursor:pointer; flex-shrink:0; }
.week-label { flex:1; text-align:center; font-weight: 700; font-size: 15px; display:flex; flex-direction:column; align-items:center; }
.emp-list { display:flex; flex-direction:column; gap: 10px; margin-top: 10px; }
.emp-card { display:flex; justify-content:space-between; align-items:center; background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px 16px; color: var(--text); text-align:left; cursor:pointer; }
.emp-card.emp-ok { border-color: rgba(63,157,90,.6); }
.emp-name { font-size: 19px; font-weight: 700; margin-bottom: 3px; }
.badge { font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 999px; white-space: nowrap; }
.badge-ok { background: var(--ok); color:#fff; } .badge-todo { background: rgba(232,162,48,.18); color: var(--gold); }
.hours { background: var(--panel); border:1px solid var(--border); border-radius: 14px; overflow:hidden; margin: 12px 0; }
.hours-head, .hours-row { display:grid; grid-template-columns: 70px 1fr 1fr 62px; gap: 6px; align-items:center; padding: 8px 10px; }
.hours-head { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold); font-weight: 700; border-bottom:1px solid var(--border); }
.hours-row { border-bottom: 1px solid var(--border); }
.hours-row:last-child { border-bottom: none; }
.hours-row.off { opacity: .55; }
.h-day { font-weight: 700; display:flex; flex-direction:column; font-size: 14px; } .h-day small { color: var(--muted); font-weight: 400; font-size: 11px; }
.abs-sel { margin-top: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font-size: 11px; padding: 3px 2px; width: 100%; color-scheme: dark; }
.h-abs { grid-column: span 2; color: #fff; font-weight: 700; font-size: 14px; border-radius: 8px; padding: 10px; text-align: center; }
.h-abs small { font-weight: 400; opacity: .9; }
.abs-pill { color:#fff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; margin-left: 6px; }
.cost-grid { display:grid; grid-template-columns: 1.1fr 1fr 1fr 1fr; gap: 6px; padding: 7px 2px; border-bottom: 1px solid var(--border); font-size: 13.5px; align-items: center; }
.cost-grid > :not(:first-child) { text-align: right; }
.cost-grid.off { opacity: .5; }
.cost-head { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold); font-weight: 700; margin-top: 8px; }
.cost-tot { border-bottom: none; font-weight: 700; }
.h-slot { display:flex; flex-direction:column; gap: 4px; }
.h-tot { text-align:right; font-weight: 700; font-size: 13px; display:flex; flex-direction:column; }
.h-tot small { font-size: 11px; } .plus { color: #6fd08a; } .minus { color: #ff8a73; }
.t-in { width: 100%; min-width: 0; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 6px 4px; font-size: 14px; color-scheme: dark; }
.t-ro { font-size: 14px; font-variant-numeric: tabular-nums; }
.totals { display:grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 14px; }
.totals > div { background: var(--panel); border:1px solid var(--border); border-radius: 12px; padding: 10px; display:flex; flex-direction:column; align-items:center; }
.totals b { font-size: 20px; }
.lbl { display:block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold); font-weight: 700; margin: 14px 0 6px; }
.input { width:100%; background: var(--bg); border:1px solid var(--border); color: var(--text); padding: 11px 12px; border-radius: 10px; font-size: 15px; font-family: inherit; color-scheme: dark; }
.sig-wrap { position: relative; }
.sig-canvas { width: 100%; height: 170px; background: #fff; border-radius: 12px; touch-action: none; display:block; }
.sig-hint { position:absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #aaa; pointer-events:none; font-size: 15px; }
.sig-wrap .link-btn { position:absolute; right: 4px; bottom: 4px; color: #777; }
.sig-img { width: 100%; max-width: 360px; background:#fff; border-radius: 10px; display:block; margin: 8px 0; }
.check { display:flex; gap: 10px; align-items:flex-start; font-size: 14px; margin: 14px 0; line-height: 1.4; }
.check input { width: 22px; height: 22px; flex-shrink:0; }
.alert { background: rgba(232,162,48,.12); border:1px solid rgba(232,162,48,.4); color: var(--text); border-radius: 12px; padding: 10px 12px; font-size: 13.5px; margin: 10px 0; }
.alert.ok { background: rgba(63,157,90,.15); border-color: rgba(63,157,90,.5); }
.alert ul { margin: 6px 0 0; padding-left: 18px; }
.center-box { display:flex; flex-direction:column; align-items:center; text-align:center; padding-top: 60px; gap: 6px; }
.big-check { width: 72px; height: 72px; border-radius: 50%; background: var(--ok); display:flex; align-items:center; justify-content:center; font-size: 38px; font-weight: 800; }
.backdrop { position:fixed; inset:0; background: rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; z-index: 50; padding: 16px; }
.modal { background: var(--raised); border-radius: 18px; padding: 20px; width: 100%; max-width: 380px; max-height: 90vh; overflow-y:auto; text-align:center; }
.modal .lbl, .modal .input { text-align: left; }
.pin-dots { font-size: 26px; letter-spacing: .3em; margin-bottom: 14px; min-height: 34px; }
.pin-dots.err { color: var(--fire); animation: shake .3s; }
@keyframes shake { 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
.pin-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
.pin-key { background: var(--panel); border:1px solid var(--border); color: var(--text); font-size: 24px; padding: 14px 0; border-radius: 12px; cursor:pointer; }
.tabs { display:flex; gap: 6px; overflow-x:auto; margin-bottom: 14px; }
.tab { background: transparent; border:1px solid var(--border); color: var(--muted); padding: 8px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; white-space: nowrap; cursor:pointer; }
.tab-on { background: var(--fire); border-color: var(--fire); color: #fff; }
.card { background: var(--panel); border:1px solid var(--border); border-radius: 14px; padding: 14px; margin: 12px 0; }
.row-between { display:flex; justify-content:space-between; align-items:center; gap: 10px; padding: 4px 0; }
.chips { display:flex; flex-wrap:wrap; gap: 8px; }
.chip { background: var(--panel); border:1px solid var(--border); color: var(--text); padding: 9px 14px; border-radius: 999px; font-size: 14px; cursor:pointer; }
.chip-on { background: var(--sea); border-color: var(--sea); font-weight: 700; }
.file-btn { display:inline-block; margin-top: 4px; }
.toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); background: var(--sea); color:#fff; padding: 12px 16px; border-radius: 12px; font-size: 14px; max-width: calc(100% - 32px); z-index: 60; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
`;
