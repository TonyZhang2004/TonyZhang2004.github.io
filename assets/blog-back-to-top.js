const button = document.querySelector('.blog-back-to-top');
const title = document.querySelector('main article h1');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
title.tabIndex = -1;

function updateBackToTop() {
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  button.hidden = maxScroll <= 0 || scrollY < Math.min(240, maxScroll / 2);
}

button.addEventListener('click', () => {
  title.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
});

window.addEventListener('scroll', updateBackToTop, { passive: true });
window.addEventListener('resize', updateBackToTop);
window.addEventListener('pageshow', updateBackToTop);
new ResizeObserver(updateBackToTop).observe(document.body);
updateBackToTop();
