// Original, matching line icons. Labels remain visible; these drawings are decorative.
const drawings={
 'timer-left':'<path d="M13 3h6m-3 0v4M8 9 6 7"/><circle cx="16" cy="18" r="10"/><path d="M16 12v6h-5"/>',
 'timer-right':'<path d="M13 3h6m-3 0v4m8 2 2-2"/><circle cx="16" cy="18" r="10"/><path d="M16 12v6h5"/>',
 breast:'<path d="M10 4c0 4-3 7-5 11-2 5 0 10 5 10 4 0 6-3 6-7 0 4 2 7 6 7 5 0 7-5 5-10-2-4-5-7-5-11"/><circle cx="10" cy="19" r="1"/><circle cx="22" cy="19" r="1"/>',
 bottle:'<path d="M13 7V5a3 3 0 0 1 6 0v2M10 7h12v5H10zM11 12v14a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V12M11 18h4m-4 5h4"/>',
 pump:'<path d="M3 5v12l8-4V9zM11 10h6v7M13 17h8v4h-8zM14 21v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-6M17 11h5a5 5 0 0 1 5 5v8M24 24h6v5h-6z"/>',
 nappy:'<path d="M4 8h24l-3 13c-1 5-5 7-9 7s-8-2-9-7zM5 12h6v5H6m21-5h-6v5h5M8 23c1-4 4-6 8-6s7 2 8 6"/>',
 weight:'<circle cx="16" cy="7" r="4"/><path d="M8 12h16l4 15H4z"/><text x="16" y="23" text-anchor="middle" fill="currentColor" stroke="none" font-size="8" font-family="Arial,sans-serif">kg</text>',
 note:'<path d="M19 5H7a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V15M12 19l1-5L24 3l5 5-11 11zM21 6l5 5M10 24h11"/>',
 vomit:'<path d="M19 20a10 10 0 1 1 5-9M10 6c1 2 3 2 4 0M10 13h1m7 0h1M15 19h5M21 17c3 1 5 3 6 5M21 21l3 3"/><path d="M28 25c-1 1-2 2-2 3a2 2 0 0 0 4 0c0-1-1-2-2-3z"/>'
};
export function icon(type){return `<svg class="data-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawings[type]||drawings.note}</svg>`;}
