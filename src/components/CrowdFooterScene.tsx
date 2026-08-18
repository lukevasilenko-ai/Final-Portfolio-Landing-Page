/**
 * Animated crowd adapted from Skiper UI's Canvas Crowd component.
 * Character illustrations: Open Peeps.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { AnimatePresence, motion } from 'motion/react';

interface HighlightHoverState {
  active: boolean;
  x: number;
  y: number;
}

interface CrowdCanvasProps {
  src: string;
  rows?: number;
  cols?: number;
  onHighlightHoverChange?: (state: HighlightHoverState) => void;
}

type WalkTimeline = ReturnType<typeof gsap.timeline>;
type SpriteRect = [number, number, number, number];

interface Peep {
  image: HTMLImageElement;
  colorizedImage: HTMLCanvasElement | null;
  spriteIndex: number;
  rect: SpriteRect;
  width: number;
  height: number;
  x: number;
  y: number;
  anchorY: number;
  scaleX: number;
  visualScale: number;
  highlighted: boolean;
  walk: WalkTimeline | null;
  render: (context: CanvasRenderingContext2D) => void;
}

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

const thoughtMessages = [
  'ლუკას მომსახურებით ძალიან კმაყოფილი ვარ.',
  'ლუკამ ზუსტად ის დიზაინი შექმნა, რაც მინდოდა.',
  'შედეგმა ჩემს მოლოდინს ნამდვილად გადააჭარბა.',
  'ლუკასთან მუშაობა მარტივი და სასიამოვნო იყო.',
  'პროფესიონალური დიზაინი და შესანიშნავი შედეგი.'
];

export function CrowdCanvas({
  src,
  rows = 15,
  cols = 7,
  onHighlightHoverChange
}: CrowdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) return;

    const image = new Image();
    const stage = { width: 0, height: 0 };
    const allPeeps: Peep[] = [];
    const availablePeeps: Peep[] = [];
    const crowd: Peep[] = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isVisible = true;
    let isReady = false;
    let pixelRatio = 1;
    let highlightedPeep: Peep | null = null;
    let isHighlightHovered = false;
    const crowdTopPadding = 48;
    const spotlightCandidateIndices = [61, 63, 65, 67, 69, 73];

    const removeRandomPeep = () => {
      const index = Math.floor(randomRange(0, availablePeeps.length));
      return availablePeeps.splice(index, 1)[0];
    };

    const updatePausedState = () => {
      const shouldPause = reducedMotion.matches || !isVisible;
      crowd.forEach((peep) => {
        peep.walk?.paused(shouldPause || (peep.highlighted && isHighlightHovered));
      });
    };

    const resetPeep = (peep: Peep) => {
      const direction = Math.random() > 0.5 ? 1 : -1;
      const offsetY = 100 - 250 * gsap.parseEase('power2.in')(Math.random());
      peep.visualScale = 1;
      const displayWidth = peep.width * peep.visualScale;
      const displayHeight = peep.height * peep.visualScale;
      const highlightedMaxY = Math.max(
        crowdTopPadding,
        stage.height - displayHeight + 70
      );
      const startY = peep.highlighted
        ? highlightedMaxY
        : Math.max(crowdTopPadding, stage.height - displayHeight + offsetY);
      const startX = peep.highlighted
        ? direction === 1 ? -displayWidth - 2 : stage.width + 2
        : direction === 1 ? -displayWidth : stage.width;
      const endX = peep.highlighted
        ? direction === 1 ? stage.width + 2 : -displayWidth - 2
        : direction === 1 ? stage.width : -displayWidth;

      peep.x = startX;
      peep.y = startY;
      peep.anchorY = startY + displayHeight;
      peep.scaleX = direction;

      return { startY, endX };
    };

    const addPeepToCrowd = () => {
      const peep = removeRandomPeep();
      const { startY, endX } = resetPeep(peep);
      const xDuration = 10;
      const yDuration = 0.25;
      const walk = gsap.timeline();

      walk.timeScale(randomRange(0.55, 1.35) * 0.7);
      walk.to(peep, { duration: xDuration, x: endX, ease: 'none' }, 0);
      walk.to(
        peep,
        {
          duration: yDuration,
          repeat: xDuration / yDuration,
          yoyo: true,
          y: Math.max(crowdTopPadding, startY - 10)
        },
        0
      );
      walk.eventCallback('onComplete', () => {
        if (peep.highlighted) {
          setHighlightHover(false);
          assignRandomSpotlightSprite(peep);
        }
        const crowdIndex = crowd.indexOf(peep);
        if (crowdIndex >= 0) crowd.splice(crowdIndex, 1);
        availablePeeps.push(peep);
        addPeepToCrowd();
      });

      peep.walk = walk;
      crowd.push(peep);
      crowd.sort((first, second) => first.anchorY - second.anchorY);
      walk.paused(reducedMotion.matches || !isVisible);

      return peep;
    };

    const initCrowd = () => {
      while (availablePeeps.length) {
        addPeepToCrowd().walk?.progress(Math.random());
      }
    };

    const render = () => {
      if (!isVisible) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      crowd.forEach((peep) => {
        if (!peep.highlighted) peep.render(context);
      });
      crowd.find((peep) => peep.highlighted)?.render(context);
    };

    const resize = () => {
      if (!isReady) return;

      if (isHighlightHovered) {
        isHighlightHovered = false;
        onHighlightHoverChange?.({ active: false, x: 0, y: 0 });
      }

      const bounds = canvas.getBoundingClientRect();
      stage.width = bounds.width;
      stage.height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(stage.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(stage.height * pixelRatio));

      crowd.forEach((peep) => peep.walk?.kill());
      crowd.length = 0;
      availablePeeps.length = 0;
      availablePeeps.push(...allPeeps);
      initCrowd();
      render();
    };

    const createColorizedImage = (rect: SpriteRect, color: string) => {
      const width = Math.round(rect[2]);
      const height = Math.round(rect[3]);
      const sourceCanvas = document.createElement('canvas');
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      const colorizedCanvas = document.createElement('canvas');
      const colorizedContext = colorizedCanvas.getContext('2d');
      const colorCanvas = document.createElement('canvas');
      const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });

      sourceCanvas.width = width;
      sourceCanvas.height = height;
      colorizedCanvas.width = width;
      colorizedCanvas.height = height;
      colorCanvas.width = 1;
      colorCanvas.height = 1;

      if (!sourceContext || !colorizedContext || !colorContext) return null;

      sourceContext.drawImage(
        image,
        rect[0],
        rect[1],
        rect[2],
        rect[3],
        0,
        0,
        width,
        height
      );
      colorContext.fillStyle = color;
      colorContext.fillRect(0, 0, 1, 1);

      const sourceData = sourceContext.getImageData(0, 0, width, height);
      const [red, green, blue] = colorContext.getImageData(0, 0, 1, 1).data;

      for (let pixelIndex = 0; pixelIndex < sourceData.data.length; pixelIndex += 4) {
        const alpha = sourceData.data[pixelIndex + 3];
        if (alpha < 20) continue;

        const originalRed = sourceData.data[pixelIndex];
        const originalGreen = sourceData.data[pixelIndex + 1];
        const originalBlue = sourceData.data[pixelIndex + 2];
        const luminance = (0.2126 * originalRed + 0.7152 * originalGreen + 0.0722 * originalBlue) / 255;
        const inkStrength = Math.min(1, Math.max(0, (1 - luminance) * 1.25));

        if (inkStrength < 0.08) continue;

        sourceData.data[pixelIndex] = Math.round(originalRed * (1 - inkStrength) + red * inkStrength);
        sourceData.data[pixelIndex + 1] = Math.round(originalGreen * (1 - inkStrength) + green * inkStrength);
        sourceData.data[pixelIndex + 2] = Math.round(originalBlue * (1 - inkStrength) + blue * inkStrength);
      }

      colorizedContext.putImageData(sourceData, 0, 0);
      return colorizedCanvas;
    };

    const assignRandomSpotlightSprite = (peep: Peep) => {
      const total = rows * cols;
      const candidates = spotlightCandidateIndices.filter((index) => index < total);
      const alternatives = candidates.filter((index) => index !== peep.spriteIndex);
      const pool = alternatives.length ? alternatives : candidates.length ? candidates : [0];
      const nextIndex = pool[Math.floor(Math.random() * pool.length)];
      const rectWidth = image.naturalWidth / rows;
      const rectHeight = image.naturalHeight / cols;
      const rect: SpriteRect = [
        (nextIndex % rows) * rectWidth,
        Math.floor(nextIndex / rows) * rectHeight,
        rectWidth,
        rectHeight
      ];
      const brandColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-accent')
        .trim() || '#24483d';

      peep.spriteIndex = nextIndex;
      peep.rect = rect;
      peep.colorizedImage = createColorizedImage(rect, brandColor);
    };

    const createPeeps = () => {
      const total = rows * cols;
      const rectWidth = image.naturalWidth / rows;
      const rectHeight = image.naturalHeight / cols;
      const brandColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-accent')
        .trim() || '#24483d';
      const spotlightCandidates = spotlightCandidateIndices.filter((index) => index < total);
      const highlightedIndex = spotlightCandidates.length
        ? spotlightCandidates[Math.floor(Math.random() * spotlightCandidates.length)]
        : 0;

      for (let index = 0; index < total; index += 1) {
        const rect: SpriteRect = [
          (index % rows) * rectWidth,
          Math.floor(index / rows) * rectHeight,
          rectWidth,
          rectHeight
        ];
        const highlighted = index === highlightedIndex;
        const peep: Peep = {
          image,
          colorizedImage: highlighted ? createColorizedImage(rect, brandColor) : null,
          spriteIndex: index,
          rect,
          width: rectWidth,
          height: rectHeight,
          x: 0,
          y: 0,
          anchorY: 0,
          scaleX: 1,
          visualScale: 1,
          highlighted,
          walk: null,
          render: (drawContext) => {
            const displayWidth = peep.width * peep.visualScale;
            const displayHeight = peep.height * peep.visualScale;
            drawContext.save();
            drawContext.translate(
              peep.scaleX === -1 ? peep.x + displayWidth : peep.x,
              peep.y
            );
            drawContext.scale(peep.scaleX, 1);
            if (peep.highlighted && peep.colorizedImage) {
              drawContext.drawImage(peep.colorizedImage, 0, 0, displayWidth, displayHeight);
            } else {
              drawContext.drawImage(
                peep.image,
                peep.rect[0],
                peep.rect[1],
                peep.rect[2],
                peep.rect[3],
                0,
                0,
                displayWidth,
                displayHeight
              );
            }
            drawContext.restore();
          }
        };

        allPeeps.push(peep);
        if (highlighted) highlightedPeep = peep;
      }
    };

    const setHighlightHover = (active: boolean) => {
      if (isHighlightHovered === active || !highlightedPeep) return;

      isHighlightHovered = active;
      highlightedPeep.walk?.paused(active || reducedMotion.matches || !isVisible);

      if (active) {
        const displayWidth = highlightedPeep.width * highlightedPeep.visualScale;
        onHighlightHoverChange?.({
          active: true,
          x: highlightedPeep.x + displayWidth / 2,
          y: Math.max(96, highlightedPeep.y + 8)
        });
      } else {
        onHighlightHoverChange?.({ active: false, x: 0, y: 0 });
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!highlightedPeep) return;

      const bounds = canvas.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      const displayWidth = highlightedPeep.width * highlightedPeep.visualScale;
      const displayHeight = highlightedPeep.height * highlightedPeep.visualScale;
      const isInside = pointerX >= highlightedPeep.x
        && pointerX <= highlightedPeep.x + displayWidth
        && pointerY >= highlightedPeep.y
        && pointerY <= highlightedPeep.y + displayHeight;

      setHighlightHover(isInside);
    };

    const handlePointerLeave = () => setHighlightHover(false);

    const updateHighlightedColor = () => {
      if (!highlightedPeep) return;

      const brandColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-accent')
        .trim() || '#24483d';
      highlightedPeep.colorizedImage = createColorizedImage(highlightedPeep.rect, brandColor);
    };

    const resizeObserver = new ResizeObserver(resize);
    const themeObserver = new MutationObserver(updateHighlightedColor);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      updatePausedState();
      if (isVisible) render();
    });

    image.onload = () => {
      createPeeps();
      isReady = true;
      resize();
      gsap.ticker.add(render);
    };
    image.src = src;

    resizeObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    visibilityObserver.observe(canvas);
    reducedMotion.addEventListener('change', updatePausedState);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      image.onload = null;
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      reducedMotion.removeEventListener('change', updatePausedState);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      gsap.ticker.remove(render);
      crowd.forEach((peep) => peep.walk?.kill());
    };
  }, [cols, onHighlightHoverChange, rows, src]);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}

export default function CrowdFooterScene() {
  const [thoughtBubble, setThoughtBubble] = useState({
    active: false,
    x: 0,
    y: 0,
    message: thoughtMessages[0]
  });

  const handleHighlightHoverChange = useCallback((state: HighlightHoverState) => {
    setThoughtBubble((current) => {
      if (!state.active) return { ...current, active: false };

      const alternatives = thoughtMessages.filter((message) => message !== current.message);
      const message = alternatives[Math.floor(Math.random() * alternatives.length)];
      return { ...state, message };
    });
  }, []);

  return (
    <section
      aria-label="მოძრავი ილუსტრაციების სცენა"
      className="content-layer section-rule relative isolate h-[560px] overflow-hidden bg-[var(--brand-accent-faint)] sm:h-[620px] lg:h-[650px]"
    >
      <div className="container-xl relative z-10 flex justify-center px-5 pt-16 text-center sm:px-8">
        <h2 className="text-[48px] font-extrabold leading-[1.08] text-[var(--brand-ink)] sm:text-[56px]">
          <span>იყავი </span>
          <span className="font-elene-akhvlediani inline-block text-[var(--brand-accent)]">გამორჩეული</span>
        </h2>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-48 overflow-hidden sm:top-36">
        <CrowdCanvas
          src="/images/peeps/all-peeps.png"
          onHighlightHoverChange={handleHighlightHoverChange}
        />
        <AnimatePresence>
          {thoughtBubble.active && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
              style={{ left: thoughtBubble.x, top: thoughtBubble.y }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                transition={{ type: 'spring', stiffness: 340, damping: 25 }}
                className="relative w-[260px] max-w-[calc(100vw-32px)] rounded-lg border border-[var(--brand-line-strong)] bg-[var(--brand-canvas-94)] px-5 py-4 text-center shadow-[var(--brand-shadow-soft)] backdrop-blur-md"
              >
                <p className="text-sm font-medium leading-6 text-[var(--brand-ink)]">
                  {thoughtBubble.message}
                </p>
                <span className="absolute -bottom-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-[var(--brand-line-strong)] bg-[var(--brand-canvas-96)]" />
                <span className="absolute -bottom-6 left-[54%] h-2 w-2 rounded-full border border-[var(--brand-line-strong)] bg-[var(--brand-canvas-96)]" />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
