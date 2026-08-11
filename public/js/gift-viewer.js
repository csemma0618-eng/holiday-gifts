// ============================================================
// Gift Viewer — Read-only canvas with festive animations
// ============================================================

function initGiftViewer(canvasJson, containerId, canvasId) {
  const container = document.getElementById(containerId);
  const canvasEl = document.getElementById(canvasId);
  if (!container || !canvasEl) return;

  const containerWidth = container.clientWidth;
  const scale = Math.min(1, containerWidth / 800);

  const canvas = new fabric.Canvas(canvasId, {
    width: 800,
    height: 500,
    selection: false,
    renderOnAddRemove: false,
  });

  canvas.setZoom(scale);

  if (canvasJson && canvasJson.objects && canvasJson.objects.length > 0) {
    canvas.loadFromJSON(canvasJson, () => {
      // Make all objects non-interactive
      canvas.getObjects().forEach(obj => {
        obj.selectable = false;
        obj.evented = false;
        obj.hasControls = false;
        obj.hasBorders = false;
        obj.lockMovementX = true;
        obj.lockMovementY = true;
      });
      canvas.renderAll();
    });
  } else {
    // Fallback
    const text = new fabric.Text('🎁 Happy Holidays! 🎄', {
      left: 200, top: 200,
      fontSize: 40,
      fontFamily: 'Georgia, serif',
      fill: '#c41e3a',
    });
    canvas.add(text);
    canvas.renderAll();
  }

  // Responsive resize
  window.addEventListener('resize', () => {
    const newScale = Math.min(1, container.clientWidth / 800);
    canvas.setZoom(newScale);
  });
}

// Confetti animation
function launchConfetti(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const colors = [
    '#c41e3a', '#2e7d32', '#ffd700', '#ff6b6b', '#4ecdc4', '#ff9f43',
    '#a29bfe', '#fd79a8', '#00cec9', '#fab1a0', '#e17055', '#6c5ce7',
    '#ffffff', '#ffeaa7', '#55efc4', '#74b9ff'
  ];
  const shapes = ['●', '■', '▲', '★', '♦', '❤', '🎉', '✨', '🎊', '⭐', '🎀', '💫'];

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 120; i++) {
    const particle = document.createElement('span');
    particle.className = 'confetti-particle';
    particle.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    particle.style.cssText = `
      left: ${Math.random() * 100}%;
      color: ${colors[Math.floor(Math.random() * colors.length)]};
      font-size: ${Math.random() * 20 + 10}px;
      animation-delay: ${Math.random() * 2.5}s;
      animation-duration: ${Math.random() * 2.5 + 2}s;
    `;
    fragment.appendChild(particle);
  }

  container.appendChild(fragment);

  // Clean up after animation completes
  setTimeout(() => {
    container.innerHTML = '';
  }, 5500);
}
