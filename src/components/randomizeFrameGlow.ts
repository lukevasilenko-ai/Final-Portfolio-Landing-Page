const randomBetween = (minimum: number, maximum: number) => (
  minimum + Math.random() * (maximum - minimum)
);

export function randomizeFrameGlow(element: HTMLElement) {
  const primaryX = randomBetween(10, 90);
  const primaryY = randomBetween(4, 72);
  const secondaryX = Math.min(94, Math.max(6, 100 - primaryX + randomBetween(-12, 12)));
  const secondaryY = randomBetween(30, 96);

  element.style.setProperty('--frame-glow-x', `${primaryX.toFixed(1)}%`);
  element.style.setProperty('--frame-glow-y', `${primaryY.toFixed(1)}%`);
  element.style.setProperty('--frame-glow-x-secondary', `${secondaryX.toFixed(1)}%`);
  element.style.setProperty('--frame-glow-y-secondary', `${secondaryY.toFixed(1)}%`);
  element.style.setProperty('--frame-glow-width', `${randomBetween(52, 80).toFixed(1)}%`);
  element.style.setProperty('--frame-glow-height', `${randomBetween(42, 70).toFixed(1)}%`);
  element.style.setProperty('--frame-glow-secondary-width', `${randomBetween(38, 64).toFixed(1)}%`);
  element.style.setProperty('--frame-glow-secondary-height', `${randomBetween(50, 78).toFixed(1)}%`);
  element.style.setProperty('--frame-glow-angle', `${Math.round(randomBetween(110, 250))}deg`);
}
