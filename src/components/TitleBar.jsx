import { useEffect, useState } from "react";

export default function TitleBar() {
  const [appName, setAppName] = useState(null);

  useEffect(() => {
    window.launcher.settings.getConfig().then((c) => setAppName(c.appName));
  }, []);

  return (
    <div className="h-8 flex items-center justify-between bg-base-975 shrink-0 [-webkit-app-region:drag]">
      <div className="pl-3.5 flex items-center gap-2">
        <div className="w-3.5 h-3.5 rounded-[5px] bg-gradient-to-br from-accent-400 to-flux-500" />
        <span className="text-[11px] font-medium text-slate-500 tracking-wide">
          {appName}
        </span>
      </div>
      <div className="flex [-webkit-app-region:no-drag]">
        <button
          onClick={() => window.launcher.window.minimize()}
          className="w-10 h-8 grid place-items-center hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="material-symbols-rounded !text-[15px]">remove</span>
        </button>
        <button
          onClick={() => window.launcher.window.maximize()}
          className="w-10 h-8 grid place-items-center hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="material-symbols-rounded !text-[13px]">crop_square</span>
        </button>
        <button
          onClick={() => window.launcher.window.close()}
          className="w-10 h-8 grid place-items-center hover:bg-red-500/90 text-slate-500 hover:text-white transition-colors"
        >
          <span className="material-symbols-rounded !text-[15px]">close</span>
        </button>
      </div>
    </div>
  );
}
