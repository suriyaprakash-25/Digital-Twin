/**
 * DigitalTwinHero.jsx
 *
 * Premium Interactive 3D Digital Twin visualization for the Driveportz homepage hero.
 *
 * Architecture:
 * - React Three Fiber Canvas with genuine GLB vehicle model
 * - Automotive-grade PBR lighting (HDRI environment + area lights)
 * - Auto-rotating turntable with mouse-reactive camera offset
 * - Teal glowing platform (3D rings + ground plane)
 * - 4 floating glassmorphic data cards (DOM overlay)
 * - SVG connection lines between cards and vehicle center
 * - 5 ecosystem feature icons row
 * - Tagline pill
 * - Full responsive design (desktop/tablet/mobile)
 * - Lazy-loaded 3D scene with loading indicator
 *
 * Model: Ferrari 458 Italia (CC-BY, by vicent091036 via Three.js examples)
 */
import { useRef, useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Activity, ShieldCheck, TrendingUp, Calendar,
  FileText, BarChart3, Scale, Wrench, PieChart
} from 'lucide-react';

/* ── CSS Keyframes (injected once) ───────────────────── */
const heroStyles = `
  @keyframes heroFadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes heroFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes cardSlideIn {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes platformGlow {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.85; }
  }
  @keyframes floatSubtle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 8px rgba(13,148,136,0.15); }
    50% { box-shadow: 0 0 20px rgba(13,148,136,0.3); }
  }

  .dt-card-float {
    animation: floatSubtle 6s ease-in-out infinite;
  }
  .dt-card-float-alt {
    animation: floatSubtle 7s ease-in-out 1.5s infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .dt-card-float, .dt-card-float-alt {
      animation: none !important;
    }
  }
`;

/* ══════════════════════════════════════════════════════
   3D SCENE COMPONENTS
═══════════════════════════════════════════════════════ */

/** Teal glowing platform rings rendered in 3D */
function GlowingPlatform() {
  const groupRef = useRef();
  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#0d9488'),
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  }), []);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      // Subtle pulse on inner ring
      const children = groupRef.current.children;
      if (children[2]) {
        children[2].material.opacity = 0.2 + Math.sin(t * 1.5) * 0.12;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer ring */}
      <mesh>
        <ringGeometry args={[3.8, 4.0, 64]} />
        <meshBasicMaterial color="#0d9488" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {/* Middle ring */}
      <mesh>
        <ringGeometry args={[3.0, 3.15, 64]} />
        <meshBasicMaterial color="#0d9488" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner glowing ring */}
      <mesh>
        <ringGeometry args={[2.2, 2.4, 64]} />
        <meshBasicMaterial color="#14b8a6" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* Ground disc with radial gradient feel */}
      <mesh>
        <circleGeometry args={[2.2, 64]} />
        <meshBasicMaterial color="#0d9488" transparent opacity={0.04} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Auto-rotating vehicle model loaded from GLB */
function VehicleModel({ onLoaded }) {
  const { scene } = useGLTF('/models/sedan.glb');
  const groupRef = useRef();

  useEffect(() => {
    if (scene) {
      // Apply premium materials to the car
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const name = (child.material?.name || child.name || '').toLowerCase();

          // Car body - bright metallic silver/white to contrast teal theme
          if (name.includes('body') || name.includes('paint')) {
            child.material = new THREE.MeshPhysicalMaterial({
              color: new THREE.Color('#e2e8f0'), // slate-200 (bright silver)
              metalness: 0.6,
              roughness: 0.2,
              clearcoat: 1.0,
              clearcoatRoughness: 0.05,
              envMapIntensity: 1.8,
            });
          }
          // Glass
          else if (name.includes('glass') || name.includes('window')) {
            child.material = new THREE.MeshPhysicalMaterial({
              color: new THREE.Color('#88ccdd'),
              metalness: 0.1,
              roughness: 0,
              transmission: 0.9,
              transparent: true,
              opacity: 0.4,
              envMapIntensity: 1.0,
            });
          }
          // Chrome/metal details
          else if (name.includes('chrome') || name.includes('detail') || name.includes('trim')) {
            child.material = new THREE.MeshPhysicalMaterial({
              color: new THREE.Color('#e8e8e8'),
              metalness: 1.0,
              roughness: 0.08,
              envMapIntensity: 2.0,
            });
          }
          // Default: keep existing material but enhance
          else if (child.material) {
            if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
              child.material.envMapIntensity = 1.2;
            }
          }
        }
      });

      // Reset scale and position before measuring, since useGLTF caches the scene object
      scene.scale.setScalar(1);
      scene.position.set(0, 0, 0);
      scene.updateMatrixWorld(true);

      // Compute bounding box and center/scale the model
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 4.8 / maxDim; // normalize to ~4.8 units wide

      scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      scene.scale.setScalar(scale);

      if (onLoaded) onLoaded();
    }
  }, [scene, onLoaded]);

  // Auto-rotate
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

/** Camera rig that responds to mouse position */
function CameraRig({ mousePos, isMobile }) {
  const { camera } = useThree();

  useFrame(() => {
    if (isMobile) return;

    // Smooth camera offset based on mouse
    const targetX = 4.5 + mousePos.x * 0.8;
    const targetY = 2.2 + mousePos.y * -0.4;
    const targetZ = 6 + mousePos.y * 0.3;

    camera.position.x += (targetX - camera.position.x) * 0.04;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.position.z += (targetZ - camera.position.z) * 0.04;
    camera.lookAt(0, 0.5, 0);
  });

  return null;
}

/** Loading indicator inside the Canvas */
function CanvasLoader() {
  return (
    <mesh position={[0, 1, 0]}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial color="#14b8a6" transparent opacity={0.6} />
    </mesh>
  );
}

// Preload the model
useGLTF.preload('/models/sedan.glb');

/* ══════════════════════════════════════════════════════
   DOM OVERLAY COMPONENTS
═══════════════════════════════════════════════════════ */

/* ── Data Card Component ─────────────────────────────── */
function DTCard({ icon: Icon, label, primaryValue, secondaryLine, tertiaryLine, accentColor, delay, className, style }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        animation: visible ? `cardSlideIn 0.5s ease forwards` : 'none',
        ...style,
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(13, 148, 136, 0.15)',
          borderRadius: '16px',
          padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(13, 148, 136, 0.05)',
          minWidth: '155px',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e0f7f3 0%, #ccfbf1 100%)',
              border: '1.5px solid rgba(13, 148, 136, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={16} color="#0d9488" strokeWidth={2.2} />
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#64748b',
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </span>
        </div>

        {/* Primary value */}
        <div
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: secondaryLine ? '4px' : '0',
          }}
        >
          {primaryValue}
        </div>

        {/* Secondary line */}
        {secondaryLine && (
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              color: accentColor || '#64748b',
              lineHeight: 1.4,
            }}
          >
            {secondaryLine}
          </div>
        )}

        {/* Tertiary line */}
        {tertiaryLine && (
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 500,
              color: '#94a3b8',
              lineHeight: 1.4,
              marginTop: '2px',
            }}
          >
            {tertiaryLine}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Vehicle IQ Card (special with progress bar) ─────── */
function VehicleIQCard({ delay, isMobile }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="dt-card-float"
      style={{
        position: 'absolute',
        top: isMobile ? '2%' : '6%',
        left: isMobile ? '50%' : '26%',
        transform: isMobile ? 'translateX(-50%) scale(0.85)' : 'scale(1)',
        transformOrigin: 'top center',
        zIndex: 20,
        opacity: visible ? 1 : 0,
        animation: visible ? `cardSlideIn 0.5s ease forwards` : 'none',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(13, 148, 136, 0.18)',
          borderRadius: '16px',
          padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(13, 148, 136, 0.05)',
          minWidth: '155px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e0f7f3 0%, #ccfbf1 100%)',
              border: '1.5px solid rgba(13, 148, 136, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Activity size={16} color="#0d9488" strokeWidth={2.2} />
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
            Vehicle IQ
          </span>
        </div>

        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          92 / 100
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
          <div
            style={{
              width: '92%',
              height: '100%',
              background: 'linear-gradient(90deg, #0d9488, #14b8a6)',
              borderRadius: '2px',
              transition: 'width 1.5s ease',
            }}
          />
        </div>

        <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#0d9488', marginTop: '6px' }}>
          Excellent Condition
        </div>
      </div>
    </div>
  );
}

/* ── Connection Lines SVG Overlay ────────────────────── */
function ConnectionLines({ visible }) {
  return (
    <svg
      viewBox="0 0 700 550"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        opacity: visible ? 0.55 : 0,
        transition: 'opacity 1s ease',
      }}
      preserveAspectRatio="none"
    >
      {/* Vehicle IQ to vehicle center */}
      <path
        d="M 280 80 Q 340 130 370 210"
        stroke="#0d9488"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.5"
      />
      <circle cx="370" cy="210" r="3" fill="#0d9488" opacity="0.7">
        <animate attributeName="r" values="3;5;3" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Service History to vehicle */}
      <path
        d="M 600 120 Q 530 170 450 230"
        stroke="#0d9488"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.5"
      />
      <circle cx="450" cy="230" r="3" fill="#0d9488" opacity="0.7">
        <animate attributeName="r" values="3;5;3" dur="3s" begin="0.5s" repeatCount="indefinite" />
      </circle>

      {/* Estimated Value to vehicle */}
      <path
        d="M 170 260 Q 250 280 330 300"
        stroke="#0d9488"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.5"
      />
      <circle cx="330" cy="300" r="3" fill="#0d9488" opacity="0.7">
        <animate attributeName="r" values="3;5;3" dur="3s" begin="1s" repeatCount="indefinite" />
      </circle>

      {/* Next Service to vehicle */}
      <path
        d="M 630 300 Q 550 310 470 310"
        stroke="#0d9488"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        fill="none"
        opacity="0.5"
      />
      <circle cx="470" cy="310" r="3" fill="#0d9488" opacity="0.7">
        <animate attributeName="r" values="3;5;3" dur="3s" begin="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Ecosystem Feature Icon ──────────────────────────── */
function EcoIcon({ icon: Icon, label, delay }) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.5s ease, transform 0.5s ease`,
        cursor: 'default',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: hovered ? 'rgba(13, 148, 136, 0.08)' : 'rgba(255, 255, 255, 0.8)',
          border: `1.5px solid ${hovered ? '#0d9488' : 'rgba(13, 148, 136, 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          transform: hovered ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <Icon size={20} color="#0d9488" strokeWidth={1.8} />
      </div>
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          color: '#475569',
          letterSpacing: '0.01em',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── 3D Loading Overlay ──────────────────────────────── */
function LoadingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        background: 'rgba(248, 250, 252, 0.7)',
        backdropFilter: 'blur(4px)',
        transition: 'opacity 0.5s ease',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #0d9488',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div style={{ marginTop: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
        Loading 3D Model...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function DigitalTwinHero() {
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [linesVisible, setLinesVisible] = useState(false);
  const rafRef = useRef(null);

  // Detect capabilities & check WebGL support upfront
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    // Start entrance sequence
    const t1 = setTimeout(() => setLoaded(true), 300);
    const t2 = setTimeout(() => setLinesVisible(true), 2100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Mouse tracking for camera rig / parallax (desktop only)
  const handleMouseMove = useCallback((e) => {
    if (isMobile) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      setMousePos({ x, y });
    });
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setMousePos({ x: 0, y: 0 });
  }, []);

  const handleModelLoaded = useCallback(() => {
    setModelReady(true);
  }, []);

  // Canvas created handler — configure renderer for premium look
  const handleCanvasCreated = useCallback(({ gl: renderer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }, []);

  // Vehicle parallax transform (used in fallback mode)
  const vehicleTransform = isMobile || reducedMotion
    ? 'none'
    : `perspective(1200px) rotateY(${mousePos.x * 3}deg) rotateX(${mousePos.y * -1.5}deg)`;

  return (
    <>
      <style>{heroStyles}</style>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: isMobile ? '600px' : '560px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        {/* ── Background subtle gradient ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(13,148,136,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />

        {/* ── 3D Canvas OR Image Fallback ── */}
        {!webglFailed ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
            }}
          >
            <ErrorBoundary 
              fallback={null}
              onError={(error) => {
                console.error("3D Canvas error, falling back to image:", error);
                setWebglFailed(true);
                setModelReady(true);
              }}
            >
              <Canvas
                camera={{
                  position: [4.5, 2.2, 6],
                  fov: isMobile ? 50 : 40,
                  near: 0.1,
                  far: 100,
                }}
                shadows
                dpr={[1, 1.5]}
                gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: 'high-performance',
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                }}
                onCreated={handleCanvasCreated}
              >
              {/* Studio Lighting Rig (no external HDRI dependency) */}
              <ambientLight intensity={0.4} />
              <hemisphereLight
                color="#b0e0e6"
                groundColor="#1a3a3a"
                intensity={0.5}
              />
              {/* Key light */}
              <directionalLight
                position={[8, 10, 5]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-far={20}
                shadow-camera-left={-5}
                shadow-camera-right={5}
                shadow-camera-top={5}
                shadow-camera-bottom={-5}
              />
              {/* Fill light */}
              <directionalLight position={[-6, 4, -3]} intensity={0.6} color="#b0e0e6" />
              {/* Rim/back light */}
              <directionalLight position={[0, 3, -8]} intensity={0.8} color="#e0f0ff" />
              {/* Top accent */}
              <spotLight
                position={[0, 10, 0]}
                intensity={0.8}
                angle={0.6}
                penumbra={1}
                color="#14b8a6"
              />
              {/* Front kick */}
              <pointLight position={[5, 1, 5]} intensity={0.3} color="#ffffff" />

              {/* Vehicle Model */}
              <Suspense fallback={<CanvasLoader />}>
                <VehicleModel onLoaded={handleModelLoaded} />
              </Suspense>

              {/* Platform */}
              <GlowingPlatform />

              {/* Ground shadow (local mesh, no external deps) */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
                <planeGeometry args={[12, 12]} />
                <shadowMaterial transparent opacity={0.2} />
              </mesh>

              {/* Camera Rig */}
              <CameraRig mousePos={mousePos} isMobile={isMobile} />
            </Canvas>
          </ErrorBoundary>
          </div>
        ) : (
          /* ── Image Fallback (when WebGL is unavailable) ── */
          <div
            style={{
              position: 'relative',
              zIndex: 8,
              width: '100%',
              maxWidth: isMobile ? '340px' : '520px',
              margin: isMobile ? '20px auto 0' : '-10px auto 0',
              transform: vehicleTransform,
              transition: 'transform 0.15s ease-out',
              opacity: imageLoaded ? 1 : 0,
              animation: imageLoaded ? 'heroFadeUp 0.8s ease forwards' : 'none',
            }}
          >
            <img
              src="/hero-vehicle.png"
              alt="Premium sedan - Driveportz Digital Twin"
              onLoad={() => setImageLoaded(true)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 30px 60px rgba(15, 23, 42, 0.15))',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              loading="eager"
              draggable="false"
            />
          </div>
        )}

        {/* ── Loading Overlay ── */}
        <LoadingOverlay visible={!modelReady} />

        {/* ── Connection Lines (desktop only) ── */}
        {!isMobile && <ConnectionLines visible={linesVisible && modelReady && !reducedMotion} />}

        {/* ── Data Cards ── */}
        {/* Vehicle IQ - top center-left */}
        <VehicleIQCard delay={reducedMotion ? 0 : (modelReady ? 400 : 3000)} isMobile={isMobile} />

        {/* Service History - top right */}
        <DTCard
          icon={ShieldCheck}
          label="Service History"
          primaryValue="Verified"
          secondaryLine="12 Records • No Tampering"
          delay={reducedMotion ? 0 : (modelReady ? 600 : 3200)}
          className="dt-card-float-alt"
          style={{
            position: 'absolute',
            top: isMobile ? '18%' : '4%',
            right: isMobile ? 'auto' : '2%',
            bottom: isMobile ? 'auto' : 'auto',
            left: isMobile ? '-2%' : 'auto',
            transform: isMobile ? 'scale(0.8)' : 'scale(1)',
            transformOrigin: 'left center',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        />

        {/* Estimated Value - left mid */}
        <DTCard
          icon={TrendingUp}
          label="Estimated Value"
          primaryValue={<>₹8.4L <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', marginLeft: '6px' }}>↗ +12%</span></>}
          secondaryLine="vs. Market Average"
          delay={reducedMotion ? 0 : (modelReady ? 800 : 3400)}
          className="dt-card-float"
          style={{
            position: 'absolute',
            top: isMobile ? 'auto' : '38%',
            left: isMobile ? '-2%' : '0%',
            bottom: isMobile ? '24%' : 'auto',
            transform: isMobile ? 'scale(0.8)' : 'scale(1)',
            transformOrigin: 'left center',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        />

        {/* Next Service - right mid */}
        <DTCard
          icon={Calendar}
          label="Next Service"
          primaryValue="18 Days"
          secondaryLine="Oil Service Due"
          accentColor="#64748b"
          delay={reducedMotion ? 0 : (modelReady ? 1000 : 3600)}
          className="dt-card-float-alt"
          style={{
            position: 'absolute',
            top: isMobile ? 'auto' : '42%',
            right: isMobile ? '-2%' : '0%',
            bottom: isMobile ? '28%' : 'auto',
            transform: isMobile ? 'scale(0.8)' : 'scale(1)',
            transformOrigin: 'right center',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        />

        {/* ── Ecosystem Features Row (desktop) ── */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              bottom: '4%',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '32px',
              zIndex: 15,
            }}
          >
            <EcoIcon icon={FileText} label="Service History" delay={reducedMotion ? 0 : (modelReady ? 1500 : 4000)} />
            <EcoIcon icon={TrendingUp} label="Resale Value" delay={reducedMotion ? 0 : (modelReady ? 1600 : 4100)} />
            <EcoIcon icon={Scale} label="Legal Reminders" delay={reducedMotion ? 0 : (modelReady ? 1700 : 4200)} />
            <EcoIcon icon={Wrench} label="Find Garages" delay={reducedMotion ? 0 : (modelReady ? 1800 : 4300)} />
            <EcoIcon icon={BarChart3} label="Analytics" delay={reducedMotion ? 0 : (modelReady ? 1900 : 4400)} />
          </div>
        )}

        {/* ── Tagline Pill (desktop) ── */}
        {!isMobile && (
          <div
            style={{
              position: 'absolute',
              bottom: '-2%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(240, 253, 250, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(13, 148, 136, 0.15)',
              borderRadius: '999px',
              padding: '6px 20px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#0d9488',
              letterSpacing: '0.01em',
              zIndex: 15,
              opacity: modelReady ? 1 : 0,
              transition: 'opacity 0.6s ease 2s',
              whiteSpace: 'nowrap',
            }}
          >
            Interactive 3D Digital Twin • {webglFailed ? 'Hover to Explore' : 'Rotate to Explore'}
          </div>
        )}

        {/* ── Mobile: Ecosystem icons (2x3 grid) ── */}
        {isMobile && (
          <div
            style={{
              position: 'absolute',
              bottom: '-2%',
              left: '50%',
              transform: 'translateX(-50%) scale(0.9)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              width: '100%',
              maxWidth: '320px',
              zIndex: 15,
            }}
          >
            <EcoIcon icon={FileText} label="Service History" delay={0} />
            <EcoIcon icon={TrendingUp} label="Resale Value" delay={0} />
            <EcoIcon icon={Scale} label="Legal" delay={0} />
            <EcoIcon icon={Wrench} label="Garages" delay={0} />
            <EcoIcon icon={BarChart3} label="Analytics" delay={0} />
            <EcoIcon icon={PieChart} label="Reports" delay={0} />
          </div>
        )}
      </div>
    </>
  );
}
