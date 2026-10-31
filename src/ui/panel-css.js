export const PANEL_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Inter","Roobert",-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap { display: flex; flex-direction: column; gap: 10px; }
  .wrap.open-up { flex-direction: column; }
  .wrap.open-down { flex-direction: column-reverse; }
  .wrap.align-right { align-items: flex-end; }
  .wrap.align-left { align-items: flex-start; }
  .wrap.open-up .panel { transform-origin: bottom right; }
  .wrap.open-up.align-left .panel { transform-origin: bottom left; }
  .wrap.open-down .panel { transform-origin: top right; }
  .wrap.open-down.align-left .panel { transform-origin: top left; }
  .toasts {
    position: absolute; right: 0; bottom: 50px;
    display: flex; flex-direction: column; gap: 6px;
    pointer-events: none; z-index: 10; align-items: flex-end;
  }
  .wrap.open-down .toasts { bottom: auto; top: 50px; }
  .toast {
    background: #9147ff; color: #fff; padding: 8px 12px; border-radius: 6px;
    font-size: 12.5px; font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,.5);
    opacity: 0; transform: translateY(6px);
    transition: opacity .2s ease, transform .2s ease;
  }
  .toast.in { opacity: 1; transform: translateY(0); }
  .fab {
    width: 40px; height: 40px; border: none; border-radius: 50%;
    background: #9147ff; color: #fff; font-size: 15px; font-weight: 800;
    letter-spacing: -1px; cursor: pointer; padding: 0;
    box-shadow: 0 3px 12px rgba(0,0,0,.45);
    opacity: .6; pointer-events: auto;
    transform: scale(1);
    transition: opacity .22s ease, transform .22s ease, background .18s ease;
  }
  .fab.awake, .fab.reveal { opacity: .8; transform: scale(1.02); }
  .fab.flash { opacity: .9; transform: scale(1.06); }
  .fab.near { opacity: 1; transform: scale(1.08); background: #a970ff; }
  .fab:hover { opacity: 1; transform: scale(1.08); background: #a970ff; }
  .fab.active { background: #ff5c5c; opacity: .95; }
  .fab.dragging { cursor: grabbing !important; opacity: .85; transform: scale(1.05); }
  .fab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .panel {
    --bg: #0e0e10; --panel: #18181b; --surface: #111114; --border: #2a2a2d;
    --text: #efeff1; --muted: #a2a2ad;
    --input: #0e0e10; --input-border: #3a3a3d; --switch-off: #3a3a3d;
    --accent: #9147ff; --accent-hover: #a970ff; --accent-text: #bf94ff;
    --danger: #ff5c5c; --danger-text: #ff9a9a;
    --danger-border: rgba(255,92,92,.45); --danger-soft: rgba(255,92,92,.12);
    --remote: #00d4aa;
    width: 340px; max-height: 80vh; display: flex; flex-direction: column;
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
    box-shadow: 0 12px 34px rgba(0,0,0,.65); overflow: hidden;
    color: var(--text); font-size: 13.5px; user-select: none;
  }
  .panel[data-theme="light"] {
    --bg: #ffffff; --panel: #f7f7f8; --surface: #fafafa; --border: #d8d8de;
    --text: #0e0e10; --muted: #53535f;
    --input: #ffffff; --input-border: #c8c8d0; --switch-off: #c8c8d0;
    --accent: #9147ff; --accent-hover: #772ce8; --accent-text: #5c16c5;
    --danger: #c81e1e; --danger-text: #a31212;
    --danger-border: rgba(200,30,30,.35); --danger-soft: rgba(200,30,30,.08);
    --remote: #007a63;
    box-shadow: 0 12px 34px rgba(0,0,0,.18);
  }
  .panel[hidden] { display: none; }
  .head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px; background: var(--panel); border-bottom: 1px solid var(--border);
    font-weight: 700; font-size: 13.5px;
  }
  .head .plus { color: var(--accent-text); }
  .head-right { display: flex; align-items: center; gap: 8px; }
  .ver { font-size: 10.5px; font-weight: 400; color: var(--muted); user-select: text; }
  .close {
    width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px;
    background: transparent; color: var(--muted); font-size: 18px; line-height: 1;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .close:hover { background: var(--surface); color: var(--text); }
  .close:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .toolbar { display: flex; gap: 8px; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border); }
  .search, .preset {
    background: var(--input); color: var(--text); border: 1px solid var(--input-border);
    border-radius: 6px; padding: 6px 8px; font-size: 12.5px; outline: none;
  }
  .search { flex: 1; min-width: 0; }
  .preset { max-width: 130px; }
  .search:focus, .preset:focus { border-color: var(--accent); }
  .search:focus-visible, .preset:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .body { flex: 1; overflow-y: auto; padding: 2px 14px 10px; }
  .body::-webkit-scrollbar { width: 8px; }
  .body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .section { margin-top: 2px; }
  .section-title {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 8px 0 4px; margin: 0; border: 0; background: none;
    color: var(--accent-text); font: inherit; font-size: 10.5px; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase; text-align: left; cursor: pointer;
  }
  .section-title:hover { color: var(--accent-hover); }
  .section-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .section-title::after { content: "▾"; font-size: 10px; opacity: .7; transition: transform .18s ease; }
  .section.collapsed .section-title::after { transform: rotate(-90deg); }
  .section.collapsed .section-body { display: none; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 0; color: var(--text); }
  .row.label { cursor: pointer; }
  .row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .row-title { font-size: 13px; line-height: 1.35; }
  .row-note { font-size: 11px; line-height: 1.35; color: var(--muted); user-select: text; }
  .row-note[hidden] { display: none; }
  .row input[type="checkbox"] {
    appearance: none; width: 34px; height: 18px; border-radius: 999px;
    background: var(--switch-off); position: relative; cursor: pointer; flex: 0 0 auto; margin: 0;
    transition: background .18s ease;
  }
  .row input[type="checkbox"]::after {
    content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
    border-radius: 50%; background: #fff; transition: transform .18s ease;
  }
  .row input[type="checkbox"]:checked { background: var(--accent); }
  .row input[type="checkbox"]:checked::after { transform: translateX(16px); }
  .row input[type="checkbox"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .settings {
    padding: 0 0 8px 10px; margin-left: 2px; border-left: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 5px;
  }
  .settings[hidden] { display: none; }
  .setting { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .setting > span { color: var(--muted); font-size: 11.5px; line-height: 1.35; }
  .setting input[type="text"], .setting input[type="number"], .setting select {
    flex: 1; min-width: 0; max-width: 170px; padding: 5px 6px;
    background: var(--input); color: var(--text); border: 1px solid var(--input-border);
    border-radius: 5px; font-size: 12px; outline: none;
  }
  .setting input:focus, .setting select:focus { border-color: var(--accent); }
  .setting input:focus-visible, .setting select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .setting .check { margin: 0; }
  .kb-input {
    width: 96px; padding: 4px 6px; background: var(--input); color: var(--text);
    border: 1px solid var(--input-border); border-radius: 4px; font-size: 11px;
    font-family: ui-monospace, Menlo, monospace; outline: none; text-align: center;
  }
  .kb-input:focus { border-color: var(--accent); }
  .kb-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .badge-remote {
    font-size: 9px; color: var(--remote); border: 1px solid var(--remote);
    border-radius: 3px; padding: 0 3px; margin-left: 4px;
  }
  .advanced-actions {
    display: flex; flex-direction: column; gap: 6px;
    margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);
  }
  .advanced-title {
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 2px;
  }
  .actions { padding: 8px 12px; background: var(--surface); border-top: 1px solid var(--border); }
  .action-btn {
    width: 100%; padding: 9px 10px; border: 1px solid var(--input-border); border-radius: 6px;
    background: var(--panel); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
  }
  .action-btn:hover { background: var(--surface); border-color: var(--accent); }
  .action-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .action-btn:disabled { opacity: .5; cursor: default; }
  .action-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .action-btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  .action-btn.primary.on { background: var(--danger); border-color: var(--danger); color: #fff; }
  .action-btn.danger { color: var(--danger-text); border-color: var(--danger-border); }
  .action-btn.danger:hover { background: var(--danger-soft); border-color: var(--danger); }
  .foot {
    padding: 7px 12px; background: var(--panel); border-top: 1px solid var(--border);
    font-size: 11px; line-height: 1.45; color: var(--muted); text-align: center; user-select: text;
  }
  .foot #active { color: var(--text); font-weight: 600; }
  .note {
    padding: 0 12px 8px; font-size: 11.5px; line-height: 1.45;
    color: var(--muted); background: var(--surface); user-select: text;
  }
  .note[hidden] { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .fab, .toast, .section-title::after { transition: none; }
  }
`;
