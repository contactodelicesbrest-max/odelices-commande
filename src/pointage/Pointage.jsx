import { useEffect, useMemo, useState } from "react";
import { listen, read, write, patch, del, seedIfEmpty } from "./db.js";
import {
  JOURS, JOURS_COURTS, MOIS, iso, parseIso, addDays, mondayOf, weekLabel, fmtDate,
  normWeek, emptyWeek, dayMinutes, dayMinutesRaw, weekMinutes, fmtH, mondaysOfMonth, ABSENCES,
  ymOf, parseYm, monthLabel, addMonths, defaultSignMonth, inMonth, mergeWeek,
} from "./time.js";
import { buildMonth, exportExcel, exportPdf, parsePlanningFile, buildWeekRecap, weekRecapText, weekRecapPdfBlob, weekRecapName, saveFile } from "./exports.js";
import { Capacitor } from "@capacitor/core";
import SignaturePad from "./SignaturePad.jsx";
import { analyseSemaine, cfgOf, coutFactor, smicNet, euro, tauxNetOf, contratOf, TRANCHE_LABELS, DEFAULT_CFG } from "./paie.js";
import { autoBackup, downloadBackup, restoreBackup, getStatus, isNative, FOLDER } from "./backup.js";
import { styles } from "./styles.js";

const nomComplet = (e) => `${e.prenom || ""} ${(e.nom || "").toUpperCase()}`.trim();
const slug = (s) => String(s).trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, "_");

// =====================================================================
export default function Pointage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [week, setWeek] = useState(iso(mondayOf(new Date())));
  const [employes, setEmployes] = useState({});
  const [config, setConfig] = useState({ pinGerant: "1234" });
  const [planning, setPlanning] = useState({});
  const [pointages, setPointages] = useState({});
  const [screen, setScreen] = useState({ name: "home" });
  const [ym, setYm] = useState(defaultSignMonth());
  const monthData = useMonthData(ym);
  const [pinAsk, setPinAsk] = useState(null); // { expected, title, onOk }

  useEffect(() => {
    seedIfEmpty()
      .then(() => autoBackup())
      .catch((e) => setError("Connexion à la base impossible : " + e.message))
      .finally(() => setReady(true));
    const u1 = listen("employes", (v) => setEmployes(v || {}));
    const u2 = listen("config", (v) => v && setConfig(v));
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    const u1 = listen(`planning/${week}`, (v) => setPlanning(v || {}));
    const u2 = listen(`pointages/${week}`, (v) => setPointages(v || {}));
    return () => { u1(); u2(); };
  }, [week]);

  const sorted = useMemo(
    () => Object.entries(employes).sort((a, b) => nomComplet(a[1]).localeCompare(nomComplet(b[1]))),
    [employes]
  );

  const askPin = (expected, title, onOk) => {
    if (!expected) return onOk();
    setPinAsk({ expected: String(expected), title, onOk });
  };

  if (!ready) return <Shell><p className="muted center-txt">Chargement…</p></Shell>;

  return (
    <Shell>
      {error && <div className="alert">{error}</div>}

      {screen.name === "home" && (
        <Home
          ym={ym} setYm={setYm} employes={sorted} monthData={monthData}
          onPick={(id) => askPin(employes[id]?.pin, `Code de ${nomComplet(employes[id])}`, () => setScreen({ name: "sign", id }))}
          onGerant={() => askPin(config.pinGerant || "1234", "Code gérant", () => setScreen({ name: "gerant" }))}
        />
      )}

      {screen.name === "sign" && employes[screen.id] && (
        <SignScreen
          key={ym + screen.id}
          ym={ym} id={screen.id} employe={employes[screen.id]} monthData={monthData}
          onBack={() => setScreen({ name: "home" })}
        />
      )}

      {screen.name === "gerant" && (
        <Gerant
          week={week} setWeek={setWeek} employes={employes} sorted={sorted}
          planning={planning} pointages={pointages} config={config}
          ym={ym} setYm={setYm} monthData={monthData}
          onBack={() => setScreen({ name: "home" })}
        />
      )}

      {pinAsk && (
        <PinModal
          title={pinAsk.title}
          onCancel={() => setPinAsk(null)}
          onSubmit={(v) => {
            if (v === pinAsk.expected) { const ok = pinAsk.onOk; setPinAsk(null); ok(); return true; }
            return false;
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="pt-root">
      <style>{styles}</style>
      <div className="pt-screen">{children}</div>
    </div>
  );
}

/** Écoute en direct le planning, les heures saisies et les signatures de toutes les semaines d'un mois. */
function useMonthData(ym) {
  const [data, setData] = useState({ ym, mondays: [], planning: {}, pointages: {}, signatures: {}, loaded: false });
  useEffect(() => {
    const { year, month } = parseYm(ym);
    const mondays = mondaysOfMonth(year, month);
    const acc = { ym, year, month, mondays, planning: {}, pointages: {}, signatures: {} };
    let count = 0;
    const total = mondays.length * 2 + 1;
    const push = () => setData({ ...acc, planning: { ...acc.planning }, pointages: { ...acc.pointages }, loaded: count >= total });
    const seen = new Set();
    const mark = (k) => { if (!seen.has(k)) { seen.add(k); count++; } };
    const unsubs = [];
    mondays.forEach((w) => {
      unsubs.push(listen(`planning/${w}`, (v) => { acc.planning[w] = v || {}; mark("p" + w); push(); }));
      unsubs.push(listen(`pointages/${w}`, (v) => { acc.pointages[w] = v || {}; mark("t" + w); push(); }));
    });
    unsubs.push(listen(`signatures/${ym}`, (v) => { acc.signatures = v || {}; mark("s"); push(); }));
    return () => unsubs.forEach((u) => u());
  }, [ym]);
  return data;
}

/** Semaines du mois pour un salarié (jours réels = saisis, sinon planning). */
function monthWeeks(monthData, id) {
  return monthData.mondays.map((mon) => {
    const planned = normWeek(monthData.planning[mon]?.[id]?.days);
    return { mon, planned, days: mergeWeek(planned, monthData.pointages[mon]?.[id]?.days) };
  });
}

function monthTotal(weeks, month, key = "days") {
  return weeks.reduce((t, w) => t + w[key].reduce((s, d, i) => s + (inMonth(w.mon, i, month) ? dayMinutes(d) : 0), 0), 0);
}

function MonthNav({ ym, setYm }) {
  const current = defaultSignMonth();
  return (
    <div className="week-nav">
      <button className="nav-btn" onClick={() => setYm(addMonths(ym, -1))}>‹</button>
      <div className="week-label">
        {monthLabel(ym)}
        {ym !== current && <button className="link-btn" onClick={() => setYm(current)}>revenir au mois à signer</button>}
      </div>
      <button className="nav-btn" onClick={() => setYm(addMonths(ym, 1))}>›</button>
    </div>
  );
}

// =====================================================================
function WeekNav({ week, setWeek }) {
  const m = parseIso(week);
  const current = iso(mondayOf(new Date()));
  return (
    <div className="week-nav">
      <button className="nav-btn" onClick={() => setWeek(iso(addDays(m, -7)))}>‹</button>
      <div className="week-label">
        {weekLabel(week)}
        {week !== current && (
          <button className="link-btn" onClick={() => setWeek(current)}>revenir à cette semaine</button>
        )}
      </div>
      <button className="nav-btn" onClick={() => setWeek(iso(addDays(m, 7)))}>›</button>
    </div>
  );
}

function Home({ ym, setYm, employes, monthData, onPick, onGerant }) {
  return (
    <>
      <header className="pt-header">
        <div>
          <p className="eyebrow">O'Délices · Brest</p>
          <h1 className="pt-title">Pointage</h1>
        </div>
        <button className="ghost-btn" onClick={onGerant}>⚙ Gérant</button>
      </header>

      <MonthNav ym={ym} setYm={setYm} />

      <p className="muted small">Touchez votre nom pour vérifier vos heures du mois et signer.</p>

      <div className="emp-list">
        {employes.length === 0 && <p className="muted">Aucun salarié. Ajoutez-les dans l'espace gérant.</p>}
        {employes.map(([id, e]) => {
          const sg = monthData.signatures[id];
          const prevu = monthTotal(monthWeeks(monthData, id), monthData.month ?? 0, "planned");
          const signe = !!sg?.signature;
          return (
            <button key={id} className={`emp-card ${signe ? "emp-ok" : ""}`} onClick={() => onPick(id)}>
              <div>
                <div className="emp-name">{nomComplet(e)}</div>
                <div className="muted small">
                  {signe ? `Signé · ${fmtH(sg.minutes || 0)}` : `Prévu : ${fmtH(prevu)}`}
                </div>
              </div>
              <span className={`badge ${signe ? "badge-ok" : "badge-todo"}`}>{signe ? "✓ Signé" : "À signer"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// =====================================================================
function HoursEditor({ week, days, onChange, readOnly, compare, onlyMonth }) {
  const m = parseIso(week);
  const copy = () => days.map((d) => ({ m: { ...d.m }, s: { ...d.s }, abs: d.abs || "" }));
  const set = (i, slot, key, val) => {
    const next = copy();
    next[i][slot][key] = val;
    onChange(next);
  };
  const setAbs = (i, val) => {
    const next = copy();
    next[i].abs = val;
    onChange(next);
  };
  const T = (i, slot, k) =>
    readOnly ? (
      <span className="t-ro">{days[i][slot][k] || "—"}</span>
    ) : (
      <input type="time" className="t-in" value={days[i][slot][k]} onChange={(e) => set(i, slot, k, e.target.value)} />
    );

  return (
    <div className="hours">
      <div className="hours-head">
        <span>Jour</span><span>Midi</span><span>Soir</span><span>Total</span>
      </div>
      {days.map((d, i) => {
        if (onlyMonth !== undefined && !inMonth(week, i, onlyMonth)) return null;
        const min = dayMinutes(d);
        const diff = compare ? min - dayMinutes(compare[i]) : 0;
        return (
          <div key={i} className={`hours-row ${min || d.abs ? "" : "off"}`}>
            <span className="h-day">
              {JOURS_COURTS[i]}<small>{fmtDate(addDays(m, i))}</small>
              {!readOnly && (
                <select className="abs-sel" value={d.abs} onChange={(e) => setAbs(i, e.target.value)}>
                  <option value="">Travail</option>
                  {Object.entries(ABSENCES).map(([k, a]) => <option key={k} value={k}>{a.court}</option>)}
                </select>
              )}
            </span>
            {d.abs ? (
              <span className="h-abs" style={{ background: ABSENCES[d.abs]?.color }}>
                {ABSENCES[d.abs]?.label || d.abs}
                {dayMinutesRaw(d) > 0 && <small> · {fmtH(dayMinutesRaw(d))} non travaillées</small>}
              </span>
            ) : (
              <>
                <span className="h-slot">{T(i, "m", "d")}{T(i, "m", "f")}</span>
                <span className="h-slot">{T(i, "s", "d")}{T(i, "s", "f")}</span>
              </>
            )}
            <span className="h-tot">
              {min ? fmtH(min) : d.abs ? ABSENCES[d.abs]?.court : "repos"}
              {compare && diff !== 0 && <small className={diff > 0 ? "plus" : "minus"}>{diff > 0 ? "+" : ""}{fmtH(diff)}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SignScreen({ ym, id, employe, monthData, onBack }) {
  const { month } = parseYm(ym);
  const sg = monthData.signatures[id];
  const signed = !!sg?.signature;
  const [weeks, setWeeks] = useState(() => monthWeeks(monthData, id));
  const [comment, setComment] = useState(sg?.commentaire || "");
  const [sig, setSig] = useState(null);
  const [certif, setCertif] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const total = monthTotal(weeks, month);
  const totalPrevu = monthTotal(weeks, month, "planned");
  const setDays = (mon, days) => setWeeks((ws) => ws.map((w) => (w.mon === mon ? { ...w, days } : w)));

  const submit = async () => {
    setSaving(true);
    try {
      // Heures jour par jour (seulement les jours du mois signé)
      const upd = {};
      weeks.forEach((w) => w.days.forEach((d, i) => {
        if (inMonth(w.mon, i, month)) upd[`${w.mon}/${id}/days/${i}`] = { ...d, ok: 1 };
      }));
      await patch("pointages", upd);
      await write(`signatures/${ym}/${id}`, {
        minutes: total, commentaire: comment.trim(), signature: sig, signeLe: new Date().toISOString(),
      });
      setDone(true);
      autoBackup({ force: true });
    } catch (e) {
      alert("Erreur d'enregistrement : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="center-box">
        <div className="big-check">✓</div>
        <h2 className="pt-h2">Merci {employe.prenom} !</h2>
        <p className="muted">Ton mois de {monthLabel(ym)} est signé : {fmtH(total)}.</p>
        <button className="primary-btn" onClick={onBack}>Terminer</button>
      </div>
    );
  }

  return (
    <>
      <button className="back-btn" onClick={onBack}>‹ Retour</button>
      <h2 className="pt-h2">{nomComplet(employe)}</h2>
      <p className="muted small">Heures de {monthLabel(ym)}</p>

      {signed ? (
        <div className="alert ok">Mois signé le {new Date(sg.signeLe).toLocaleString("fr-FR")}. Pour corriger, demandez au gérant de le déverrouiller.</div>
      ) : (
        <p className="small">Vérifie tes horaires du mois. S'ils ne correspondent pas à ce que tu as fait (heures en plus, absence, congé…), corrige-les avant de signer.</p>
      )}

      {weeks.map((w) => (
        <div key={w.mon}>
          <p className="week-title">{weekLabel(w.mon)}</p>
          <HoursEditor week={w.mon} days={w.days} onChange={(d) => setDays(w.mon, d)} readOnly={signed} compare={w.planned} onlyMonth={month} />
          <p className="week-sub">Total de la semaine : <b>{fmtH(weekMinutes(w.days))}</b>{weekMinutes(w.days) !== weekMinutes(w.planned) && <span className="muted"> (prévu {fmtH(weekMinutes(w.planned))})</span>}</p>
        </div>
      ))}

      <div className="totals">
        <div><span className="muted small">Prévu</span><b>{fmtH(totalPrevu)}</b></div>
        <div><span className="muted small">Réalisé</span><b className="gold">{fmtH(total)}</b></div>
        <div><span className="muted small">Écart</span><b>{total - totalPrevu > 0 ? "+" : ""}{fmtH(total - totalPrevu)}</b></div>
      </div>

      {signed ? (
        <>
          {sg.commentaire && <p className="small">Commentaire : {sg.commentaire}</p>}
          <img src={sg.signature} alt="signature" className="sig-img" />
        </>
      ) : (
        <>
          <label className="lbl">Commentaire (facultatif)</label>
          <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex : resté 30 min de plus le vendredi 13" />

          <label className="lbl">Signature</label>
          <SignaturePad onChange={setSig} />

          <label className="check">
            <input type="checkbox" checked={certif} onChange={(e) => setCertif(e.target.checked)} />
            Je certifie que ces heures ({fmtH(total)}) correspondent au travail effectué en {monthLabel(ym).toLowerCase()}.
          </label>

          <button className="primary-btn full" disabled={!sig || !certif || saving} onClick={submit}>
            {saving ? "Enregistrement…" : `Signer mon mois de ${MOIS[month].toLowerCase()}`}
          </button>
        </>
      )}
    </>
  );
}

// =====================================================================
function PinModal({ title, onSubmit, onCancel }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const press = (k) => {
    setErr(false);
    if (k === "⌫") return setV((s) => s.slice(0, -1));
    const next = (v + k).slice(0, 6);
    setV(next);
    if (next.length >= 4 && onSubmit(next) === true) return;
    if (next.length >= 6) { setErr(true); setV(""); }
  };
  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="pt-h3">{title}</h3>
        <div className={`pin-dots ${err ? "err" : ""}`}>{v.replace(/./g, "●") || "····"}</div>
        <div className="pin-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
            k ? <button key={i} className="pin-key" onClick={() => press(k)}>{k}</button> : <span key={i} />
          )}
        </div>
        <button className="link-btn" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

// =====================================================================
function Gerant(props) {
  const [tab, setTab] = useState("suivi");
  const tabs = [["suivi", "Suivi"], ["recap", "Récap semaine"], ["planning", "Planning"], ["couts", "Coûts"], ["export", "Export compta"], ["salaries", "Salariés"], ["sauvegarde", "Sauvegarde"]];
  return (
    <>
      <header className="pt-header">
        <div>
          <p className="eyebrow">Espace gérant</p>
          <h1 className="pt-title">Gestion</h1>
        </div>
        <button className="ghost-btn" onClick={props.onBack}>Quitter</button>
      </header>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "tab-on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab !== "recap" && finDeSemaine() && (
        <button className="banner" onClick={() => { props.setWeek(semaineARecap()); setTab("recap"); }}>
          📋 Le récap de la semaine est prêt — voir / envoyer
        </button>
      )}
      {tab === "suivi" && <Suivi {...props} />}
      {tab === "recap" && <RecapTab {...props} />}
      {tab === "planning" && <PlanningTab {...props} />}
      {tab === "couts" && <CoutsTab {...props} />}
      {tab === "export" && <ExportTab {...props} />}
      {tab === "salaries" && <Salaries {...props} />}
      {tab === "sauvegarde" && <SauvegardeTab />}
    </>
  );
}

function Suivi({ ym, setYm, sorted, monthData }) {
  const [open, setOpen] = useState(null);
  const { month } = parseYm(ym);
  const unlock = async (id) => {
    if (!confirm(`Déverrouiller ${monthLabel(ym)} ? La signature sera supprimée et le salarié devra signer à nouveau (ses heures saisies sont gardées).`)) return;
    await del(`signatures/${ym}/${id}`);
  };
  return (
    <>
      <MonthNav ym={ym} setYm={setYm} />
      {sorted.map(([id, e]) => {
        const sg = monthData.signatures[id];
        const weeks = monthWeeks(monthData, id);
        const total = monthTotal(weeks, month);
        return (
          <div key={id} className="card">
            <div className="row-between" onClick={() => setOpen(open === id ? null : id)}>
              <b>{nomComplet(e)}</b>
              <span className={`badge ${sg?.signature ? "badge-ok" : "badge-todo"}`}>
                {sg?.signature ? `✓ ${fmtH(sg.minutes)}` : `Non signé · ${fmtH(total)}`}
              </span>
            </div>
            {open === id && (
              <>
                {weeks.map((w) => (
                  <div key={w.mon}>
                    <p className="week-title">{weekLabel(w.mon)}</p>
                    <HoursEditor week={w.mon} days={w.days} readOnly compare={w.planned} onlyMonth={month} onChange={() => {}} />
                  </div>
                ))}
                {sg?.commentaire && <p className="small">Commentaire : {sg.commentaire}</p>}
                {sg?.signature && (
                  <>
                    <img src={sg.signature} alt="signature" className="sig-img" />
                    <p className="muted small">Signé le {new Date(sg.signeLe).toLocaleString("fr-FR")}</p>
                    <button className="danger-btn" onClick={() => unlock(id)}>Déverrouiller (faire re-signer)</button>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function PlanningTab({ week, setWeek, employes, sorted, planning }) {
  const [sel, setSel] = useState(sorted[0]?.[0] || "");
  const [msg, setMsg] = useState("");
  const days = normWeek(planning[sel]?.days);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 4000); };

  const saveDays = (d) => write(`planning/${week}/${sel}`, { days: d });

  const copyToWeeks = async (targets, label) => {
    const src = await read(`planning/${week}`);
    if (!src) return flash("Cette semaine n'a pas de planning à copier.");
    const existing = (await Promise.all(targets.map((t) => read(`planning/${t}`)))).some(Boolean);
    if (existing && !confirm(`Des horaires existent déjà pour ${label}. Les remplacer ?`)) return;
    const upd = {};
    targets.forEach((t) => (upd[t] = src));
    await patch("planning", upd);
    flash(`Horaires copiés sur ${label} (${targets.length} semaine${targets.length > 1 ? "s" : ""}).`);
  };

  const m = parseIso(week);
  const nextMonthDate = new Date(m.getFullYear(), m.getMonth() + 1, 1);
  const nextMonthWeeks = mondaysOfMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth()).filter((w) => w > week);
  const nextMonthName = `${MOIS[nextMonthDate.getMonth()]} ${nextMonthDate.getFullYear()}`;

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const weeks = await parsePlanningFile(file);
      const mons = Object.keys(weeks).sort();
      if (!mons.length) return flash("Aucune semaine trouvée dans ce fichier.");
      const emps = { ...employes };
      const upd = {};
      mons.forEach((mon) => {
        upd[mon] = {};
        weeks[mon].forEach(({ nom, prenom, days }) => {
          let id = Object.keys(emps).find(
            (k) => slug(emps[k].nom) === slug(nom) && slug(emps[k].prenom) === slug(prenom)
          );
          if (!id) {
            id = slug(`${nom}_${prenom}`);
            emps[id] = { nom: nom.toUpperCase(), prenom, pin: "", contrat: "" };
          }
          upd[mon][id] = { days };
        });
      });
      await write("employes", emps);
      await patch("planning", upd);
      flash(`Planning importé : ${mons.length} semaine(s), du ${fmtDate(parseIso(mons[0]))} au ${fmtDate(addDays(parseIso(mons[mons.length - 1]), 6))}.`);
    } catch (e) {
      flash("Import impossible : " + e.message);
    }
  };

  return (
    <>
      <WeekNav week={week} setWeek={setWeek} />

      <div className="chips">
        {sorted.map(([id, e]) => (
          <button key={id} className={`chip ${sel === id ? "chip-on" : ""}`} onClick={() => setSel(id)}>{nomComplet(e)}</button>
        ))}
      </div>

      {sel && (
        <>
          <HoursEditor week={week} days={days} onChange={saveDays} />
          <p className="small">Total prévu : <b className="gold">{fmtH(weekMinutes(days))}</b> · les modifications sont enregistrées automatiquement.</p>
          <button className="link-btn" onClick={() => confirm("Vider le planning de ce salarié pour cette semaine ?") && saveDays(emptyWeek())}>Vider la semaine</button>
        </>
      )}

      <div className="card">
        <b>Recopier les horaires</b>
        <p className="muted small">Copie le planning de cette semaine (tous les salariés).</p>
        <button className="primary-btn full" onClick={() => copyToWeeks([iso(addDays(m, 7))], "la semaine suivante")}>
          → Semaine suivante
        </button>
        <button className="primary-btn full mt" onClick={() => copyToWeeks(nextMonthWeeks, nextMonthName)}>
          → Tout le mois de {nextMonthName} (mêmes horaires)
        </button>
      </div>

      <div className="card">
        <b>Importer un planning Excel</b>
        <p className="muted small">Même modèle que « Planning nouveau model » : un onglet par semaine (année en A1, n° de semaine en B2).</p>
        <label className="ghost-btn file-btn">
          Choisir le fichier .xlsx
          <input type="file" accept=".xlsx,.xls" onChange={onImport} hidden />
        </label>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </>
  );
}

function ExportTab({ employes, week, config }) {
  const m = parseIso(week);
  const [ym, setYm] = useState(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [year, month] = ym.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v));

  useEffect(() => {
    let alive = true;
    setData(null);
    (async () => {
      const mondays = mondaysOfMonth(year, month);
      const planning = {};
      const pointages = {};
      await Promise.all(mondays.map(async (w) => {
        planning[w] = await read(`planning/${w}`);
        pointages[w] = await read(`pointages/${w}`);
      }));
      const signatures = await read(`signatures/${ym}`);
      if (alive) setData(buildMonth({ year, month, employes, planning, pointages, signatures, config }));
    })();
    return () => { alive = false; };
  }, [ym, employes, config]);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(data, { year, month }); } catch (e) { alert("Export impossible : " + e.message); }
    setBusy(false);
  };

  const missing = data ? data.recap.filter((r) => !r.signe) : [];

  return (
    <>
      <label className="lbl">Mois à exporter</label>
      <input type="month" className="input" value={ym} onChange={(e) => setYm(e.target.value)} />

      {!data && <p className="muted">Calcul…</p>}
      {data && (
        <>
          <div className="card">
            {data.recap.map((r) => (
              <div key={r.id} className="row-between">
                <span>{nomComplet(r.employe)}</span>
                <span>
                  <b className="gold">{fmtH(r.totalMois)}</b>
                  {Object.entries(ABSENCES).filter(([k]) => r.absJours[k]).map(([k, a]) => (
                    <small key={k} className="abs-pill" style={{ background: a.color }}>{r.absJours[k]} j {a.court}</small>
                  ))}
                  <br />
                  <small className="muted">
                    Coût {euro(r.paie.cout)}
                    {Object.entries(TRANCHE_LABELS).filter(([k]) => r.paie.parts[k]).map(([k, l]) => ` · ${l.replace("H. ", "")} : ${fmtH(r.paie.parts[k])}`).join("")}
                    {` · ${r.paie.repas} repas`}
                  </small>
                </span>
              </div>
            ))}
            {data.recap.some((r) => r.paie.alertes.length) && (
              <div className="alert">
                <b>⚠ Points à vérifier (droit du travail)</b>
                <ul>{data.recap.flatMap((r) => r.paie.alertes.map((a, i) => <li key={r.id + i}>{nomComplet(r.employe)} — {a}</li>))}</ul>
              </div>
            )}
            <p className="muted small">Heures comptées jour par jour sur {MOIS[month].toLowerCase()} uniquement (les semaines à cheval sont coupées).</p>
          </div>

          {missing.length > 0 && (
            <div className="alert">
              Mois non signé par : {missing.map((r) => nomComplet(r.employe)).join(", ")}.
              Leurs heures saisies (ou à défaut le planning) seront utilisées, marquées « NON SIGNÉ ».
            </div>
          )}

          <button className="primary-btn full" disabled={busy} onClick={() => run(exportExcel)}>📊 Export Excel pour le comptable</button>
          <button className="primary-btn full mt alt" disabled={busy} onClick={() => run(exportPdf)}>📄 Feuilles d'heures signées (PDF)</button>
          <p className="muted small">Sur le téléphone, le menu de partage s'ouvre : choisissez Gmail, WhatsApp ou Drive pour l'envoyer au comptable.</p>
        </>
      )}
    </>
  );
}

function Salaries({ employes, sorted, config }) {
  const [edit, setEdit] = useState(null); // {id?, nom, prenom, pin, contrat}
  const [pinG, setPinG] = useState(config.pinGerant || "1234");

  const save = async () => {
    const { id, ...e } = edit;
    if (!e.nom.trim()) return alert("Le nom est obligatoire.");
    if (e.pin && !/^\d{4,6}$/.test(e.pin)) return alert("Le code doit faire 4 à 6 chiffres.");
    const key = id || slug(`${e.nom}_${e.prenom}`) + (employes[slug(`${e.nom}_${e.prenom}`)] ? "_" + Date.now() : "");
    await write(`employes/${key}`, { nom: e.nom.trim().toUpperCase(), prenom: e.prenom.trim(), pin: e.pin || "", contrat: e.contrat || "", tauxNet: e.tauxNet || "", horsPaie: !!e.horsPaie });
    setEdit(null);
  };
  const remove = async (id) => {
    if (!confirm(`Supprimer ${nomComplet(employes[id])} ? (ses pointages passés restent dans la base)`)) return;
    await del(`employes/${id}`);
  };

  return (
    <>
      {sorted.map(([id, e]) => (
        <div key={id} className="card row-between">
          <div>
            <b>{nomComplet(e)}</b>
            <div className="muted small">{e.pin ? "Code perso ✓" : "Sans code"}{e.contrat ? ` · contrat ${e.contrat} h/sem` : " · contrat 35 h (défaut)"}{e.tauxNet ? ` · ${e.tauxNet} €/h net` : ""}{e.horsPaie ? " · hors paie" : ""}</div>
          </div>
          <div>
            <button className="link-btn" onClick={() => setEdit({ id, ...e, pin: e.pin || "", contrat: e.contrat || "", tauxNet: e.tauxNet || "", horsPaie: !!e.horsPaie })}>Modifier</button>
            <button className="link-btn red" onClick={() => remove(id)}>Suppr.</button>
          </div>
        </div>
      ))}
      <button className="primary-btn full" onClick={() => setEdit({ nom: "", prenom: "", pin: "", contrat: "", tauxNet: "", horsPaie: false })}>+ Ajouter un salarié</button>

      <div className="card">
        <b>Code gérant</b>
        <p className="muted small">Protège l'espace gérant (par défaut 1234).</p>
        <div className="row-between">
          <input className="input" inputMode="numeric" maxLength={6} value={pinG} onChange={(e) => setPinG(e.target.value.replace(/\D/g, ""))} />
          <button className="ghost-btn" disabled={pinG.length < 4} onClick={() => patch("config", { pinGerant: pinG }).then(() => alert("Code gérant modifié."))}>Enregistrer</button>
        </div>
      </div>

      {edit && (
        <div className="backdrop" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="pt-h3">{edit.id ? "Modifier" : "Nouveau salarié"}</h3>
            <label className="lbl">Nom</label>
            <input className="input" value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} />
            <label className="lbl">Prénom</label>
            <input className="input" value={edit.prenom} onChange={(e) => setEdit({ ...edit, prenom: e.target.value })} />
            <label className="lbl">Code personnel (4 à 6 chiffres, facultatif)</label>
            <input className="input" inputMode="numeric" maxLength={6} value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, "") })} />
            <label className="lbl">Heures contrat / semaine (facultatif)</label>
            <input className="input" inputMode="decimal" value={edit.contrat} onChange={(e) => setEdit({ ...edit, contrat: e.target.value.replace(",", ".") })} />
            <label className="lbl">Taux horaire net (€)</label>
            <input className="input" inputMode="decimal" placeholder="défaut des paramètres" value={edit.tauxNet} onChange={(e) => setEdit({ ...edit, tauxNet: e.target.value.replace(",", ".") })} />
            <label className="check">
              <input type="checkbox" checked={!!edit.horsPaie} onChange={(e) => setEdit({ ...edit, horsPaie: e.target.checked })} />
              Hors paie (gérant / associé non salarié) : signe ses heures mais n'apparaît pas dans l'export compta ni les coûts.
            </label>
            <button className="primary-btn full" onClick={save}>Enregistrer</button>
            <button className="link-btn" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </div>
      )}
    </>
  );
}

function SauvegardeTab() {
  const [st, setSt] = useState(getStatus());
  const [busy, setBusy] = useState(false);
  const native = isNative();

  const now = async () => {
    setBusy(true);
    setSt(await autoBackup({ force: true }));
    setBusy(false);
  };
  const onRestore = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!confirm("Restaurer cette sauvegarde ? Tout le contenu actuel (salariés, plannings, signatures) sera remplacé.")) return;
    try {
      const date = await restoreBackup(file);
      alert(`Sauvegarde du ${new Date(date).toLocaleString("fr-FR")} restaurée.`);
    } catch (e) {
      alert("Restauration impossible : " + e.message);
    }
  };

  return (
    <>
      <div className="card">
        <b>Sauvegarde automatique sur le téléphone</b>
        {native ? (
          <>
            <p className="muted small">
              À chaque ouverture de l'appli (au plus toutes les 3 h) et après chaque signature, une copie complète
              (salariés, plannings, heures, signatures) et l'Excel du mois sont enregistrés dans la mémoire du téléphone :
              <br /><b>Documents / {FOLDER}</b> (appli « Fichiers »). Les 60 derniers jours sont gardés.
            </p>
            {st ? (
              <div className={`alert ${st.ok ? "ok" : ""}`}>
                {st.ok
                  ? `Dernière sauvegarde : ${new Date(st.date).toLocaleString("fr-FR")}`
                  : `Échec de la dernière sauvegarde (${new Date(st.date).toLocaleString("fr-FR")}) : ${st.error}`}
              </div>
            ) : (
              <p className="small">Pas encore de sauvegarde.</p>
            )}
            <button className="primary-btn full" disabled={busy} onClick={now}>{busy ? "Sauvegarde…" : "Sauvegarder maintenant"}</button>
          </>
        ) : (
          <p className="muted small">La sauvegarde automatique fonctionne dans l'appli installée (APK). Ici, dans le navigateur, utilisez le bouton ci-dessous.</p>
        )}
      </div>

      <div className="card">
        <b>Copie manuelle</b>
        <p className="muted small">Télécharger / envoyer un fichier de sauvegarde complet (à garder sur Drive, par mail…).</p>
        <button className="ghost-btn" onClick={() => downloadBackup().catch((e) => alert(e.message))}>Exporter une sauvegarde</button>
      </div>

      <div className="card">
        <b>Restaurer</b>
        <p className="muted small">En cas de problème (téléphone perdu, données effacées) : choisir un fichier « sauvegarde-….json ».</p>
        <label className="ghost-btn file-btn">
          Choisir une sauvegarde
          <input type="file" accept=".json,application/json" onChange={onRestore} hidden />
        </label>
      </div>
    </>
  );
}

// =====================================================================
function CoutsTab({ week, setWeek, sorted, planning, pointages, config }) {
  const cfg = cfgOf(config);
  const [form, setForm] = useState(cfg);
  const [open, setOpen] = useState(false);
  const m = parseIso(week);
  const liste = sorted.filter(([, e]) => !e.horsPaie);

  const saveCfg = async () => {
    const clean = {};
    Object.keys(DEFAULT_CFG).forEach((k) => (clean[k] = Number(String(form[k]).replace(",", ".")) || DEFAULT_CFG[k]));
    await patch("config", { paie: clean });
    setOpen(false);
  };

  let totalSemaine = 0;

  return (
    <>
      <WeekNav week={week} setWeek={setWeek} />
      <p className="muted small">
        Coût employeur estimé = heures × taux net × majorations, puis net → brut (÷ {(1 - cfg.tauxSal / 100).toFixed(2)}) → coût (× {(1 + cfg.tauxPat / 100).toFixed(2)}).
        1 € net ≈ <b>{coutFactor(cfg).toFixed(2)} €</b> de coût. SMIC net estimé : {smicNet(cfg)} €/h.
      </p>

      {liste.map(([id, e]) => {
        const pt = pointages[id];
        const days = mergeWeek(planning[id]?.days, pt?.days);
        const an = analyseSemaine(days, e, cfg);
        totalSemaine += an.tot.cout;
        const hs = Object.entries(TRANCHE_LABELS).filter(([k]) => an.tot.parts[k]);
        return (
          <div key={id} className="card">
            <div className="row-between">
              <b>{nomComplet(e)}</b>
              <span className="muted small">{an.taux} €/h net · contrat {an.contrat} h · {pt?.days ? "heures saisies" : "planning"}</span>
            </div>
            <div className="cost-grid cost-head"><span>Jour</span><span>Heures</span><span>Net</span><span>Coût</span></div>
            {an.jours.map((j, i) => (
              <div key={i} className={`cost-grid ${j.min || j.payeNonTravaille ? "" : "off"}`}>
                <span>{JOURS_COURTS[i]} {fmtDate(addDays(m, i))}</span>
                <span>
                  {days[i].abs ? ABSENCES[days[i].abs]?.court : j.min ? fmtH(j.min) : "repos"}
                  {Object.keys(j.parts).some((k) => k !== "normal") && <small className="plus"> dont HS</small>}
                </span>
                <span>{j.net ? euro(j.net) : "—"}</span>
                <b>{j.cout ? euro(j.cout) : "—"}</b>
              </div>
            ))}
            <div className="cost-grid cost-tot">
              <span>Semaine</span><span>{fmtH(an.tot.min)}</span><span>{euro(an.tot.net)}</span><b className="gold">{euro(an.tot.cout)}</b>
            </div>
            {hs.length > 0 && <p className="small">{hs.map(([k, l]) => `${l} : ${fmtH(an.tot.parts[k])}`).join(" · ")}</p>}
            <p className="muted small">
              Coût moyen par jour travaillé : <b>{euro(an.tot.cout / Math.max(1, an.jours.filter((j) => j.min).length))}</b>
              {" "}· par heure : <b>{euro(an.tot.min ? an.tot.cout / (an.tot.min / 60) : 0)}</b> · {an.tot.repas} repas
            </p>
            {an.alertes.length > 0 && (
              <div className="alert"><ul>{an.alertes.map((a, i) => <li key={i}>⚠ {a}</li>)}</ul></div>
            )}
          </div>
        );
      })}

      <div className="card row-between">
        <b>Total masse salariale de la semaine</b>
        <b className="gold">{euro(totalSemaine)}</b>
      </div>

      <div className="card">
        <div className="row-between">
          <b>Paramètres de calcul</b>
          <button className="link-btn" onClick={() => { setForm(cfg); setOpen(!open); }}>{open ? "Fermer" : "Modifier"}</button>
        </div>
        {open ? (
          <>
            {[
              ["tauxNetDefaut", "Taux horaire net par défaut (€)"],
              ["tauxSal", "Charges salariales (%) — env. 22 % pour un non-cadre"],
              ["tauxPat", "Charges patronales après réduction générale (%) — demander au comptable"],
              ["valeurRepas", "Valeur d'un repas, avantage en nature HCR (€)"],
              ["smicBrut", "SMIC horaire brut (€)"],
              ["reposMin", "Repos minimum par semaine, en jours (HCR : 2 — ½ journée = 0,5)"],
            ].map(([k, l]) => (
              <div key={k}>
                <label className="lbl">{l}</label>
                <input className="input" inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <button className="primary-btn full mt" onClick={saveCfg}>Enregistrer</button>
          </>
        ) : (
          <p className="muted small">
            Taux net défaut {cfg.tauxNetDefaut} € · charges salariales {cfg.tauxSal} % · patronales {cfg.tauxPat} % · repas {cfg.valeurRepas} € · SMIC brut {cfg.smicBrut} € · repos mini {String(cfg.reposMin).replace(".", ",")} j.
            Le taux net de chaque salarié se règle dans l'onglet Salariés.
          </p>
        )}
      </div>
    </>
  );
}

// =====================================================================
// Récap de fin de semaine : samedi, dimanche et lundi, la semaine qui se termine / vient de se terminer.
const finDeSemaine = (d = new Date()) => [6, 0, 1].includes(d.getDay());
const semaineARecap = (d = new Date()) => iso(d.getDay() === 1 ? addDays(mondayOf(d), -7) : mondayOf(d));

async function partagerTexte(text) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import("@capacitor/share");
    return Share.share({ text, dialogTitle: "Envoyer le récap" });
  }
  if (navigator.share) return navigator.share({ text });
  await navigator.clipboard.writeText(text);
  alert("Récap copié : collez-le dans WhatsApp, un SMS ou un mail.");
}

function RecapTab({ week, setWeek, employes, planning, pointages, config }) {
  const r = buildWeekRecap({ mon: week, employes, planning, pointages, config });
  const run = (fn) => fn().catch((e) => e?.name !== "AbortError" && alert("Impossible : " + (e?.message || e)));
  return (
    <>
      <WeekNav week={week} setWeek={setWeek} />
      {r.lignes.map((l) => (
        <div key={l.id} className="card">
          <div className="row-between">
            <b>{nomComplet(l.employe)}</b>
            <b className="gold">{fmtH(l.an.tot.min)}</b>
          </div>
          <div className="recap-days">
            {l.days.map((d, i) => (
              <div key={i} className={`recap-day ${dayMinutes(d) || d.abs ? "" : "off"}`}>
                <small>{JOURS_COURTS[i]}</small>
                {d.abs ? <span className="abs-pill" style={{ background: ABSENCES[d.abs]?.color, margin: 0 }}>{ABSENCES[d.abs]?.court}</span>
                  : <b>{dayMinutes(d) ? fmtH(dayMinutes(d)) : "—"}</b>}
              </div>
            ))}
          </div>
          <p className="small muted">
            Prévu {fmtH(l.prevu)}
            {l.an.tot.min !== l.prevu && <> · écart <b className={l.an.tot.min > l.prevu ? "plus" : "minus"}>{l.an.tot.min > l.prevu ? "+" : ""}{fmtH(l.an.tot.min - l.prevu)}</b></>}
            {l.hs > 0 && <> · dont <b>{fmtH(l.hs)}</b> d'heures sup</>}
            {" "}· coût <b>{euro(l.an.tot.cout)}</b>
            {!l.saisi && " · (planning, pas encore corrigé par le salarié)"}
          </p>
          {l.an.alertes.length > 0 && <div className="alert"><ul>{l.an.alertes.map((a, i) => <li key={i}>⚠ {a}</li>)}</ul></div>}
        </div>
      ))}
      <div className="card row-between">
        <b>Total de la semaine</b>
        <span><b className="gold">{fmtH(r.total.min)}</b> · <b>{euro(r.total.cout)}</b></span>
      </div>
      <button className="primary-btn full" onClick={() => run(() => partagerTexte(weekRecapText(r)))}>💬 Envoyer le récap (WhatsApp, SMS…)</button>
      <button className="primary-btn full mt alt" onClick={() => run(() => saveFile(weekRecapPdfBlob(r), weekRecapName(week)))}>📄 Récap en PDF</button>
      <p className="muted small">Dans l'appli installée, le PDF du récap est aussi enregistré automatiquement chaque fin de semaine dans Documents / {FOLDER} / Recaps.</p>
    </>
  );
}
