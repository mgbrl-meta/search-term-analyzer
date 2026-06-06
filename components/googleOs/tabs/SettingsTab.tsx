"use client";

import { DEFAULT_GOOGLE_OS_SETTINGS } from "../../../lib/googleOs/settings";

export function SettingsTab() {
  return (
    <section className="gos-page">
      <div className="gos-panel">
        <div className="gos-panel-head">
          <div>
            <span>Settings</span>
            <h2>Google OS rules</h2>
            <p>These are the default operator rules. We will make this editable in the next phase.</p>
          </div>
        </div>

        <div className="gos-settings-grid">
          {Object.entries(DEFAULT_GOOGLE_OS_SETTINGS).map(([key, value]) => (
            <div key={key} className="gos-setting-card">
              <span>{key}</span>
              <strong>{String(value)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
