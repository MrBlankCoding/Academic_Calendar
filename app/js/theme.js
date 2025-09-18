const THEME_KEY = 'theme'; // 'light' | 'dark' | null

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); }
  catch { return null; }
}

function setStoredTheme(themeOrNull) {
  try {
    if (themeOrNull) localStorage.setItem(THEME_KEY, themeOrNull);
    else localStorage.removeItem(THEME_KEY);
  } catch {}
}

function getSystemPreference() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncTheme() {
  const stored = getStoredTheme();
  applyTheme(stored);
}

function initThemeToggle(opts = {}) {
  syncTheme();

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (!getStoredTheme()) {
      applyTheme(null);
    }
  };
  mq.addEventListener?.('change', onSystemChange);

  const btnLight = document.getElementById('btnThemeLight');
  const btnDark = document.getElementById('btnThemeDark');
  const btnSystem = document.getElementById('btnThemeSystem');

  btnLight?.addEventListener('click', () => { setStoredTheme('light'); applyTheme('light'); });
  btnDark?.addEventListener('click', () => { setStoredTheme('dark'); applyTheme('dark'); });
  btnSystem?.addEventListener('click', () => { setStoredTheme(null); applyTheme(null); });

  function reflect() {
    const stored = getStoredTheme();
    const active = stored ?? `system(${getSystemPreference()})`;
    [btnLight, btnDark, btnSystem].forEach(b => b?.classList.remove('primary'));
    if (stored === 'light') btnLight?.classList.add('primary');
    else if (stored === 'dark') btnDark?.classList.add('primary');
    else btnSystem?.classList.add('primary');
  }
  reflect();
  [btnLight, btnDark, btnSystem].forEach(b => b?.addEventListener('click', reflect));
}


export { initThemeToggle, syncTheme };