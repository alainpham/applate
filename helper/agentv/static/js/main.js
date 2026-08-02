document.addEventListener('DOMContentLoaded', async () => {
  const navbar = document.getElementById('navbar');
  try {
    const response = await fetch('/partials/navbar.html');
    if (response.ok) navbar.innerHTML = await response.text();
  } catch (error) {
    console.error('Could not load navigation', error);
  }

  try {
    const response = await fetch('/uiconfig');
    const config = await response.json();
    if (config.theme) {
      const theme = document.createElement('link');
      theme.rel = 'stylesheet';
      theme.href = `css/${config.theme}.css`;
      document.head.appendChild(theme);
    }
  } catch (error) {
    console.error('Could not load UI configuration', error);
  }
});
