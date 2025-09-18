const THEME_KEY = 'theme'; // 'light' | 'dark' | null

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
  updateActiveThemeButton(theme);
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

function updateActiveThemeButton(theme) {
  const btnLight = document.getElementById('btnThemeLight');
  const btnDark = document.getElementById('btnThemeDark');
  const btnSystem = document.getElementById('btnThemeSystem');
  
  // Remove active class from all buttons
  [btnLight, btnDark, btnSystem].forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      btn.removeAttribute('data-selected');
    }
  });
  
  // Add active class to the selected button
  if (theme === 'light' && btnLight) {
    btnLight.classList.add('active');
    btnLight.setAttribute('data-selected', 'true');
  } else if (theme === 'dark' && btnDark) {
    btnDark.classList.add('active');
    btnDark.setAttribute('data-selected', 'true');
  } else if (btnSystem) {
    btnSystem.classList.add('active');
    btnSystem.setAttribute('data-selected', 'true');
  }
}

function initThemeToggle() {
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

  // Set initial active state
  const currentTheme = getStoredTheme() || 'system';
  updateActiveThemeButton(currentTheme === 'system' ? null : currentTheme);

  // Add event listeners
  btnLight?.addEventListener('click', () => { 
    setStoredTheme('light'); 
    applyTheme('light'); 
  });
  
  btnDark?.addEventListener('click', () => { 
    setStoredTheme('dark'); 
    applyTheme('dark'); 
  });
  
  btnSystem?.addEventListener('click', () => { 
    setStoredTheme(null); 
    applyTheme(null); 
  });
}

export { initThemeToggle, syncTheme };