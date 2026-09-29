export const PANEL_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Inter","Roobert",-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
  .toasts {
    position: fixed; right: 14px; bottom: 52px;
    display: flex; flex-direction: column; gap: 6px;
    pointer-events: none; z-index: 10;
  }
  .toast {
    background: #9147ff; color: #fff; padding: 7px 12px; border-radius: 6px;
    font-size: 12px; font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,.5);
    opacity: 0; transform: translateY(6px);
    transition: opacity .2s ease, transform .2s ease;
  }
  .toast.in { opacity: 1; transform: translateY(0); }
  .fab {
    width: 26px; height: 26px; border: none; border-radius: 50%;
    background: #9147ff; color: #fff; font-size: 11px; font-weight: 800;
    letter-spacing: -1px; cursor: pointer; opacity: .18; padding: 0;
    box-shadow: 0 3px 10px rgba(0,0,0,.4);
    transition: opacity .25s ease, transform .18s ease, background .18s ease;
  }
  .fab:hover { opacity: 1; transform: scale(1.15); background: #a970ff; }
  .fab.awake { opacity: .55; }
  .fab.active { background: #ff5c5c; opacity: .9; }
  .panel {
    width: 300px; max-height: 80vh; display: flex; flex-direction: column;
    background: #0e0e10; border: 1px solid #2a2a2d; border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.65); overflow: hidden;
    color: #efeff1; font-size: 12.5px; user-select: none;
  }
  .panel[hidden] { display: none; }
  .head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 12px; background: #18181b; border-bottom: 1px solid #2a2a2d;
    font-weight: 700; font-size: 13px;
  }
  .head .plus { color: #9147ff; }
  .ver { font-size: 10.5px; font-weight: 400; color: #adadb8; }
  .toolbar { display: flex; gap: 6px; padding: 8px 10px; background: #111114; border-bottom: 1px solid #2a2a2d; }
  .search, .preset {
    background: #0e0e10; color: #efeff1; border: 1px solid #3a3a3d;
    border-radius: 6px; padding: 5px 8px; font-size: 11.5px; outline: none;
  }
  .search { flex: 1; }
  .search:focus, .preset:focus { border-color: #9147ff; }
  .body { flex: 1; overflow-y: auto; padding: 4px 12px 10px; }
  .body::-webkit-scrollbar { width: 8px; }
  .body::-webkit-scrollbar-thumb { background: #2a2a2d; border-radius: 4px; }
  .section { margin-top: 4px; }
  .section-title {
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: #9147ff; margin: 8px 0 4px; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
  }
  .section-title::after { content: "▾"; font-size: 10px; opacity: .6; transition: transform .18s ease; }
  .section.collapsed .section-title::after { transform: rotate(-90deg); }
  .section.collapsed .section-body { display: none; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; color: #dedee3; }
  .row.label { cursor: pointer; }
  .row.label:hover { color: #fff; }
  .row input[type="checkbox"] {
    appearance: none; width: 32px; height: 17px; border-radius: 999px;
    background: #3a3a3d; position: relative; cursor: pointer; flex: 0 0 auto; margin: 0;
    transition: background .18s ease;
  }
  .row input[type="checkbox"]::after {
    content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px;
    border-radius: 50%; background: #fff; transition: transform .18s ease;
  }
  .row input[type="checkbox"]:checked { background: #9147ff; }
  .row input[type="checkbox"]:checked::after { transform: translateX(15px); }
  .settings { padding: 0 0 6px 2px; display: flex; flex-direction: column; gap: 4px; }
  .settings[hidden] { display: none; }
  .setting { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .setting > span { color: #adadb8; font-size: 11.5px; }
  .setting input[type="text"], .setting input[type="number"], .setting select {
    flex: 1; min-width: 0; max-width: 170px; padding: 4px 6px;
    background: #0e0e10; color: #efeff1; border: 1px solid #3a3a3d;
    border-radius: 5px; font-size: 11.5px; outline: none;
  }
  .setting input[type="text"]:focus, .setting input[type="number"]:focus, .setting select:focus { border-color: #9147ff; }
  .setting .check { margin: 0; }
  .kb-input {
    width: 88px; padding: 3px 6px; background: #0e0e10; color: #efeff1;
    border: 1px solid #3a3a3d; border-radius: 4px; font-size: 11px;
    font-family: ui-monospace, Menlo, monospace; outline: none; text-align: center;
  }
  .kb-input:focus { border-color: #9147ff; }
  .badge-remote { font-size: 9px; color: #00d4aa; border: 1px solid rgba(0,212,170,.5); border-radius: 3px; padding: 0 3px; margin-left: 4px; }
  .actions { padding: 8px 12px; background: #111114; border-top: 1px solid #2a2a2d; display: flex; flex-direction: column; gap: 6px; }
  .action-btn {
    width: 100%; padding: 7px 10px; border: 1px solid #3a3a3d; border-radius: 6px;
    background: #1f1f23; color: #efeff1; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
  }
  .action-btn:hover { background: #26262b; border-color: #9147ff; }
  .action-btn.on { background: #9147ff; border-color: #9147ff; color: #fff; }
  .action-btn:disabled { opacity: .5; cursor: default; }
  .action-row { display: flex; gap: 6px; }
  .action-row .action-btn { flex: 1; padding: 6px 4px; font-size: 11px; }
  .foot { padding: 6px 12px; background: #18181b; border-top: 1px solid #2a2a2d; font-size: 10px; color: #7d7d88; text-align: center; }
  .note { padding: 0 12px 8px; font-size: 10.5px; color: #7d7d88; background: #111114; }
  .note[hidden] { display: none; }
`;
