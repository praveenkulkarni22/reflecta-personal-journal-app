import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export type LeafType = 'maple' | 'oak' | 'birch';

interface LeafPhysics {
  x: number;
  y: number;
  z: number; // 0 = far background, 1 = close foreground
  size: number;
  
  // Velocities & forces
  vx: number;
  vy: number;
  terminalVelocity: number;
  mass: number;
  airResistance: number;
  
  // 3D Rotations & Tumbling
  roll: number;        // Rotation around X axis (tumbling / foreshortening)
  pitch: number;       // Rotation around Y axis (flipping / twisting)
  yaw: number;         // Rotation around Z axis (spinning on canvas plane)
  rollSpeed: number;
  pitchSpeed: number;
  yawSpeed: number;
  
  // Wind oscillation & flutter
  flutterPhase: number;
  flutterSpeed: number;
  flutterAmplitude: number;
  swayFrequency: number;
  
  // Aesthetics & Palette
  type: LeafType;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  veinColor: string;
  stemColor: string;
  opacity: number;
  curl: number; // Subtle organic curvature
}

interface SparkleParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  pulseSpeed: number;
  vy: number;
  vx: number;
  color: string;
}

export const InteractiveBackground: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({
    x: -2000,
    y: -2000,
    prevX: -2000,
    prevY: -2000,
    vx: 0,
    vy: 0,
    active: false,
    lastMoveTime: 0
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const prevX = mouseRef.current.x;
      const prevY = mouseRef.current.y;
      
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.vx = (e.clientX - prevX) * 0.25;
      mouseRef.current.vy = (e.clientY - prevY) * 0.25;
      mouseRef.current.active = true;
      mouseRef.current.lastMoveTime = now;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.x = -2000;
      mouseRef.current.y = -2000;
      mouseRef.current.vx = 0;
      mouseRef.current.vy = 0;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resizeCanvas = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const isDark = theme === 'dark';

    // Rich Autumn Palettes: Orange, Burnt Orange, Golden Amber, Crimson, Scarlet & Deep Russets
    const autumnPalettes = [
      {
        primary: '#ea580c', // Burnt Orange
        secondary: '#f97316', // Radiant Orange
        accent: '#fdba74', // Apricot Highlight
        vein: '#9a3412', // Rust Vein
        stem: '#7c2d12',
      },
      {
        primary: '#dc2626', // Crimson Maple
        secondary: '#ef4444', // Scarlet
        accent: '#fca5a5', // Soft Rose Light
        vein: '#991b1b', // Deep Burgundy
        stem: '#450a0a',
      },
      {
        primary: '#d97706', // Golden Amber
        secondary: '#f59e0b', // Radiant Gold
        accent: '#fef08a', // Sunlit Yellow
        vein: '#b45309', // Warm Bronze
        stem: '#78350f',
      },
      {
        primary: '#b91c1c', // Deep Crimson
        secondary: '#ea580c', // Ember Flame
        accent: '#fed7aa', // Warm Peach
        vein: '#7f1d1d',
        stem: '#431407',
      },
      {
        primary: '#c2410c', // Rich Russet
        secondary: '#fb923c', // Tangerine
        accent: '#fde047', // Golden Leaf Rim
        vein: '#7c2d12',
        stem: '#3e1806',
      },
      {
        primary: '#ca8a04', // Honey Ochre
        secondary: '#eab308', // Canary Autumn
        accent: '#fef9c3', // Pale Sun
        vein: '#854d0e',
        stem: '#713f12',
      }
    ];

    const leafTypes: LeafType[] = ['maple', 'oak', 'birch', 'maple', 'oak'];

    // Spawn Leaves with realistic physics parameters
    const totalLeaves = Math.min(52, Math.max(30, Math.floor(width / 28)));
    const leaves: LeafPhysics[] = [];

    const createLeaf = (initialSpawn = false): LeafPhysics => {
      const z = Math.random(); // 0 (far away, slower, smaller) to 1 (near camera, faster, larger)
      const palette = autumnPalettes[Math.floor(Math.random() * autumnPalettes.length)];
      const type = leafTypes[Math.floor(Math.random() * leafTypes.length)];
      const size = (16 + Math.random() * 22) * (0.65 + z * 0.55);
      const mass = (size / 24) * (0.8 + z * 0.4);

      return {
        x: Math.random() * width,
        y: initialSpawn ? Math.random() * (height + 200) - 100 : -70 - Math.random() * 120,
        z,
        size,
        vx: (Math.random() - 0.45) * 0.6,
        vy: (0.7 + Math.random() * 0.9) * (0.75 + z * 0.55),
        terminalVelocity: (1.2 + Math.random() * 1.4) * (0.8 + z * 0.5),
        mass,
        airResistance: 0.965 + Math.random() * 0.02,
        
        // 3D tumbling angles
        roll: Math.random() * Math.PI * 2,
        pitch: Math.random() * Math.PI * 2,
        yaw: Math.random() * Math.PI * 2,
        rollSpeed: (Math.random() - 0.5) * 0.032,
        pitchSpeed: 0.02 + Math.random() * 0.028,
        yawSpeed: (Math.random() - 0.5) * 0.022,
        
        // Oscillation / aerodynamic flutter
        flutterPhase: Math.random() * Math.PI * 2,
        flutterSpeed: 0.025 + Math.random() * 0.03,
        flutterAmplitude: 1.4 + Math.random() * 2.2,
        swayFrequency: 0.012 + Math.random() * 0.016,
        
        // Palette
        type,
        primaryColor: palette.primary,
        secondaryColor: palette.secondary,
        accentColor: palette.accent,
        veinColor: palette.vein,
        stemColor: palette.stem,
        opacity: (0.78 + z * 0.22) * (isDark ? 0.95 : 0.9),
        curl: (Math.random() - 0.5) * 0.2
      };
    };

    for (let i = 0; i < totalLeaves; i++) {
      leaves.push(createLeaf(true));
    }

    // Floating golden embers & glowing atmospheric pollen
    const sparkles: SparkleParticle[] = [];
    const sparkleCount = 40;
    for (let i = 0; i < sparkleCount; i++) {
      sparkles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.6 + 0.8,
        alpha: Math.random() * 0.8,
        maxAlpha: Math.random() * 0.55 + 0.35,
        pulseSpeed: 0.012 + Math.random() * 0.02,
        vy: 0.25 + Math.random() * 0.45,
        vx: (Math.random() - 0.48) * 0.4,
        color: isDark ? '#fbbf24' : '#d97706'
      });
    }

    // Geometry Drawers: Maple, Oak, and Birch
    const drawMapleLeafGeometry = (ctx2d: CanvasRenderingContext2D, size: number, leaf: LeafPhysics) => {
      const s = size * 0.72;
      ctx2d.beginPath();
      // Center Stem Base
      ctx2d.moveTo(0, s * 0.92);
      
      // Bottom left lobe
      ctx2d.bezierCurveTo(-s * 0.45, s * 0.65, -s * 0.88, s * 0.62, -s * 0.86, s * 0.25);
      ctx2d.lineTo(-s * 0.58, s * 0.16);
      
      // Middle left lobe with serrated tip
      ctx2d.bezierCurveTo(-s * 0.98, 0.05, -s * 1.15, -s * 0.38, -s * 0.75, -s * 0.52);
      ctx2d.lineTo(-s * 0.42, -s * 0.38);
      
      // Crown central lobe (apex tip)
      ctx2d.bezierCurveTo(-s * 0.45, -s * 0.92, -s * 0.22, -s * 1.28, 0, -s * 1.32);
      ctx2d.bezierCurveTo(s * 0.22, -s * 1.28, s * 0.45, -s * 0.92, 0.42 * s, -s * 0.38);
      
      // Middle right lobe
      ctx2d.lineTo(s * 0.75, -s * 0.52);
      ctx2d.bezierCurveTo(s * 1.15, -s * 0.38, s * 0.98, 0.05, s * 0.58, s * 0.16);
      
      // Bottom right lobe
      ctx2d.lineTo(s * 0.86, s * 0.25);
      ctx2d.bezierCurveTo(s * 0.88, s * 0.62, s * 0.45, s * 0.65, 0, s * 0.92);
      ctx2d.closePath();

      // Multi-stop radial/linear shading
      const grad = ctx2d.createLinearGradient(0, -s * 1.3, 0, s * 0.95);
      grad.addColorStop(0, leaf.accentColor);
      grad.addColorStop(0.4, leaf.secondaryColor);
      grad.addColorStop(1, leaf.primaryColor);
      ctx2d.fillStyle = grad;
      ctx2d.fill();

      // Stem & Veins
      ctx2d.strokeStyle = leaf.stemColor;
      ctx2d.lineWidth = 1.35;
      ctx2d.beginPath();
      ctx2d.moveTo(0, s * 1.4); // Protruding stem
      ctx2d.lineTo(0, -s * 0.95); // Central midrib
      
      // Primary lateral vein branches
      ctx2d.moveTo(0, s * 0.22);
      ctx2d.lineTo(-s * 0.55, -s * 0.22);
      ctx2d.moveTo(0, s * 0.22);
      ctx2d.lineTo(s * 0.55, -s * 0.22);
      
      ctx2d.moveTo(0, s * 0.55);
      ctx2d.lineTo(-s * 0.45, s * 0.32);
      ctx2d.moveTo(0, s * 0.55);
      ctx2d.lineTo(s * 0.45, s * 0.32);
      ctx2d.stroke();
    };

    const drawOakLeafGeometry = (ctx2d: CanvasRenderingContext2D, size: number, leaf: LeafPhysics) => {
      const s = size * 0.7;
      ctx2d.beginPath();
      ctx2d.moveTo(0, s * 0.95);
      
      // Left rounded sinuous lobes
      ctx2d.bezierCurveTo(-s * 0.55, s * 0.78, -s * 0.78, s * 0.42, -s * 0.38, s * 0.28);
      ctx2d.bezierCurveTo(-s * 0.85, s * 0.12, -s * 0.92, -s * 0.32, -s * 0.42, -s * 0.42);
      ctx2d.bezierCurveTo(-s * 0.72, -s * 0.78, -s * 0.35, -s * 1.15, 0, -s * 1.25);
      
      // Right rounded sinuous lobes
      ctx2d.bezierCurveTo(s * 0.35, -s * 1.15, s * 0.72, -s * 0.78, s * 0.42, -s * 0.42);
      ctx2d.bezierCurveTo(s * 0.92, -s * 0.32, s * 0.85, s * 0.12, s * 0.38, s * 0.28);
      ctx2d.bezierCurveTo(s * 0.78, s * 0.42, s * 0.55, s * 0.78, 0, s * 0.95);
      ctx2d.closePath();

      const grad = ctx2d.createLinearGradient(0, -s * 1.25, 0, s * 0.95);
      grad.addColorStop(0, leaf.accentColor);
      grad.addColorStop(0.35, leaf.secondaryColor);
      grad.addColorStop(1, leaf.primaryColor);
      ctx2d.fillStyle = grad;
      ctx2d.fill();

      // Stem & midrib structure
      ctx2d.strokeStyle = leaf.stemColor;
      ctx2d.lineWidth = 1.35;
      ctx2d.beginPath();
      ctx2d.moveTo(0, s * 1.38);
      ctx2d.lineTo(0, -s * 0.92);
      
      // Lateral curved veins
      ctx2d.moveTo(0, s * 0.18);
      ctx2d.lineTo(-s * 0.48, -s * 0.08);
      ctx2d.moveTo(0, s * 0.18);
      ctx2d.lineTo(s * 0.48, -s * 0.08);
      
      ctx2d.moveTo(0, -s * 0.22);
      ctx2d.lineTo(-s * 0.38, -s * 0.52);
      ctx2d.moveTo(0, -s * 0.22);
      ctx2d.lineTo(s * 0.38, -s * 0.52);
      ctx2d.stroke();
    };

    const drawBirchLeafGeometry = (ctx2d: CanvasRenderingContext2D, size: number, leaf: LeafPhysics) => {
      const s = size * 0.75;
      ctx2d.beginPath();
      ctx2d.moveTo(0, s * 0.95);
      // Delicate ovate silhouette with slender acuminate tip
      ctx2d.bezierCurveTo(-s * 0.78, s * 0.55, -s * 0.88, -s * 0.18, 0, -s * 1.28);
      ctx2d.bezierCurveTo(s * 0.88, -s * 0.18, s * 0.78, s * 0.55, 0, s * 0.95);
      ctx2d.closePath();

      const grad = ctx2d.createLinearGradient(0, -s * 1.28, 0, s * 0.95);
      grad.addColorStop(0, leaf.accentColor);
      grad.addColorStop(0.45, leaf.secondaryColor);
      grad.addColorStop(1, leaf.primaryColor);
      ctx2d.fillStyle = grad;
      ctx2d.fill();

      // Delicate pinnate veins
      ctx2d.strokeStyle = leaf.stemColor;
      ctx2d.lineWidth = 1.2;
      ctx2d.beginPath();
      ctx2d.moveTo(0, s * 1.35);
      ctx2d.lineTo(0, -s * 0.9);
      
      ctx2d.moveTo(0, s * 0.25);
      ctx2d.lineTo(-s * 0.42, 0);
      ctx2d.moveTo(0, s * 0.25);
      ctx2d.lineTo(s * 0.42, 0);
      
      ctx2d.moveTo(0, -s * 0.15);
      ctx2d.lineTo(-s * 0.35, -s * 0.45);
      ctx2d.moveTo(0, -s * 0.15);
      ctx2d.lineTo(s * 0.35, -s * 0.45);
      ctx2d.stroke();
    };

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // 1. Dynamic Autumn Dusk Atmospheric Horizon Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.94)'); // Deep Slate 900
        bgGrad.addColorStop(0.4, 'rgba(17, 14, 34, 0.90)'); // Twilight Dusk Violet
        bgGrad.addColorStop(1, 'rgba(28, 14, 8, 0.96)'); // Warm Autumn Hearth Charcoal
      } else {
        bgGrad.addColorStop(0, 'rgba(238, 242, 246, 0.92)'); // Crisp Morning Sky
        bgGrad.addColorStop(0.45, 'rgba(248, 250, 252, 0.88)'); // Soft Daylight
        bgGrad.addColorStop(1, 'rgba(254, 243, 199, 0.86)'); // Warm Amber Haze
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Soft Ambient Glowing Orbs
      const orb1X = width * 0.22 + Math.sin(time * 0.35) * 70;
      const orb1Y = height * 0.28 + Math.cos(time * 0.28) * 50;
      const orb1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, 520);
      if (isDark) {
        orb1.addColorStop(0, 'rgba(234, 88, 12, 0.13)');
        orb1.addColorStop(0.55, 'rgba(180, 83, 9, 0.04)');
        orb1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        orb1.addColorStop(0, 'rgba(249, 115, 22, 0.11)');
        orb1.addColorStop(0.55, 'rgba(245, 158, 11, 0.04)');
        orb1.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = orb1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = width * 0.8 + Math.cos(time * 0.32) * 85;
      const orb2Y = height * 0.72 + Math.sin(time * 0.38) * 60;
      const orb2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, 580);
      if (isDark) {
        orb2.addColorStop(0, 'rgba(220, 38, 38, 0.10)'); // Crimson glow
        orb2.addColorStop(0.6, 'rgba(245, 158, 11, 0.03)');
        orb2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        orb2.addColorStop(0, 'rgba(217, 119, 6, 0.09)');
        orb2.addColorStop(0.6, 'rgba(234, 88, 12, 0.03)');
        orb2.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = orb2;
      ctx.fillRect(0, 0, width, height);

      // 3. Mouse Interactive Thermal Draft & Breeze Field
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      if (mx > -500 && my > -500) {
        const cursorGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 260);
        if (isDark) {
          cursorGlow.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
          cursorGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.04)');
          cursorGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          cursorGlow.addColorStop(0, 'rgba(234, 88, 12, 0.12)');
          cursorGlow.addColorStop(0.5, 'rgba(217, 119, 6, 0.04)');
          cursorGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        ctx.fillStyle = cursorGlow;
        ctx.fillRect(0, 0, width, height);
      }

      // 4. Floating Golden Breeze Embers & Pollen
      for (let i = 0; i < sparkles.length; i++) {
        const sp = sparkles[i];
        sp.y += sp.vy;
        sp.x += sp.vx + Math.sin(time * 1.2 + i) * 0.45;
        sp.alpha += sp.pulseSpeed;
        if (sp.alpha > sp.maxAlpha || sp.alpha < 0.08) {
          sp.pulseSpeed = -sp.pulseSpeed;
        }
        if (sp.y > height + 20) {
          sp.y = -10;
          sp.x = Math.random() * width;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, sp.alpha));
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Global Wind Turbulence Field
      // Harmonic multi-frequency wind pattern
      const globalWind = Math.sin(time * 0.6) * 0.75 + Math.sin(time * 1.4) * 0.35 + 0.25; // Gentle rightward drift

      // Sort leaves by Z depth (ascending: far leaves rendered first, near leaves rendered last with crisp overlap)
      leaves.sort((a, b) => a.z - b.z);

      // 6. Physics Step & Render Falling Autumn Leaves
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];

        // Aerodynamic flutter & lift calculation
        leaf.flutterPhase += leaf.flutterSpeed;
        const flutterLift = Math.sin(leaf.flutterPhase) * leaf.flutterAmplitude;
        const swayForce = Math.sin(time * leaf.swayFrequency * 60 + leaf.flutterPhase) * (0.8 + leaf.z * 0.9);

        // Terminal velocity acceleration
        if (leaf.vy < leaf.terminalVelocity) {
          leaf.vy += 0.025 * (1 + leaf.mass * 0.2);
        }
        leaf.vy *= leaf.airResistance;

        // Apply velocity & wind forces
        leaf.x += leaf.vx + swayForce + globalWind * (0.6 + leaf.z * 0.6);
        leaf.y += leaf.vy + (flutterLift * 0.25);

        // 3D Rotation & Tumbling
        leaf.yaw += leaf.yawSpeed;
        leaf.pitch += leaf.pitchSpeed;
        leaf.roll += leaf.rollSpeed;

        // Interactive Mouse Draft Reaction
        if (mx > -500 && my > -500) {
          const dx = leaf.x - mx;
          const dy = leaf.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 200;

          if (dist < maxDist && dist > 0) {
            const push = (1 - dist / maxDist) * 4.2;
            leaf.x += (dx / dist) * push;
            leaf.y += (dy / dist) * push * 0.7;
            leaf.yaw += (dx > 0 ? 0.08 : -0.08);
            leaf.pitch += 0.06;
          }
        }

        // Viewport bounds wrap & reset
        if (leaf.y > height + 80) {
          leaf.y = -60 - Math.random() * 40;
          leaf.x = Math.random() * width;
        }
        if (leaf.x < -80) leaf.x = width + 60;
        if (leaf.x > width + 80) leaf.x = -60;

        // Render Leaf with 3D Tumbling & Layered Drop Shadows
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.yaw);

        // 3D Pitch/Roll foreshortening transformation
        const cosPitch = Math.cos(leaf.pitch);
        const cosRoll = Math.cos(leaf.roll);
        
        // Prevent scale from collapsing completely to zero (keep minimum thickness for visual richness)
        const scaleX = Math.abs(cosRoll) > 0.15 ? cosRoll : (cosRoll < 0 ? -0.15 : 0.15);
        const scaleY = Math.abs(cosPitch) > 0.18 ? cosPitch : (cosPitch < 0 ? -0.18 : 0.18);
        ctx.scale(scaleX, scaleY);

        // Layered Realistic Drop Shadow (scales with Z depth and light angle)
        const shadowDistance = (6 + leaf.z * 18) * (0.8 + Math.abs(cosPitch) * 0.4);
        ctx.shadowColor = isDark 
          ? `rgba(0, 0, 0, ${0.45 + leaf.z * 0.35})` 
          : `rgba(120, 53, 15, ${0.15 + leaf.z * 0.22})`;
        ctx.shadowBlur = (8 + leaf.z * 16);
        ctx.shadowOffsetX = shadowDistance * 0.35;
        ctx.shadowOffsetY = shadowDistance;

        ctx.globalAlpha = leaf.opacity;

        if (leaf.type === 'maple') {
          drawMapleLeafGeometry(ctx, leaf.size, leaf);
        } else if (leaf.type === 'oak') {
          drawOakLeafGeometry(ctx, leaf.size, leaf);
        } else {
          drawBirchLeafGeometry(ctx, leaf.size, leaf);
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
