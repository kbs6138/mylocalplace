import { useEffect, useRef } from 'react';

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

export default function AtlasGlobe({ className = '', size = 240, intensity = 1 }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let isDisposed = false;
    let cleanup = () => {};

    const init = async () => {
      const probeCanvas = document.createElement('canvas');
      const probeContext = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!probeContext) {
        host.classList.add('atlas-globe-fallback');
        return;
      }
      probeContext.getExtension('WEBGL_lose_context')?.loseContext();

      const THREE = await import('three');
      if (isDisposed || hostRef.current !== host) return;

      const createArc = (start, end, height = 0.42) => {
        const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.15 + height);
        return new THREE.CatmullRomCurve3([start, mid, end], false, 'catmullrom', 0.72);
      };

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 4.4);

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        });
      } catch {
        host.classList.add('atlas-globe-fallback');
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden', 'true');

      const group = new THREE.Group();
      scene.add(group);

      scene.add(new THREE.AmbientLight(0xffffff, 1.5 * intensity));
      const keyLight = new THREE.DirectionalLight(0x9fbdff, 2.4 * intensity);
      keyLight.position.set(2.2, 3, 4);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x8ff0bd, 1.4 * intensity);
      rimLight.position.set(-3, -1.4, 2);
      scene.add(rimLight);

      const globeGeometry = new THREE.IcosahedronGeometry(1.08, 5);
      const globeMaterial = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        metalness: 0.32,
        roughness: 0.36,
        transparent: true,
        opacity: 0.88,
      });
      const globe = new THREE.Mesh(globeGeometry, globeMaterial);
      group.add(globe);

      const wireGeometry = new THREE.WireframeGeometry(globeGeometry);
      const wireMaterial = new THREE.LineBasicMaterial({
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.28,
      });
      const wire = new THREE.LineSegments(wireGeometry, wireMaterial);
      wire.scale.setScalar(1.004);
      group.add(wire);

      const ringMaterial = new THREE.LineBasicMaterial({
        color: 0x71ddb0,
        transparent: true,
        opacity: 0.56,
      });
      [0, Math.PI / 3, -Math.PI / 3].forEach((rotation, index) => {
        const ring = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            new THREE.EllipseCurve(0, 0, 1.38 + index * 0.08, 1.38 + index * 0.08, 0, Math.PI * 2).getPoints(160),
          ),
          ringMaterial.clone(),
        );
        ring.rotation.x = Math.PI / 2 + rotation;
        ring.rotation.z = rotation * 0.6;
        group.add(ring);
      });

      const points = [];
      for (let i = 0; i < 84; i += 1) {
        const y = 1 - (i / 83) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = i * 2.399963229728653;
        points.push(
          Math.cos(theta) * radius * 1.16,
          y * 1.16,
          Math.sin(theta) * radius * 1.16,
        );
      }
      const pointGeometry = new THREE.BufferGeometry();
      pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const pointMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.028,
        transparent: true,
        opacity: 0.86,
      });
      group.add(new THREE.Points(pointGeometry, pointMaterial));

      const arcMaterial = new THREE.LineBasicMaterial({
        color: 0xffc75e,
        transparent: true,
        opacity: 0.68,
      });
      [
        [new THREE.Vector3(-0.7, 0.54, 0.75), new THREE.Vector3(0.88, -0.1, 0.58), 0.36],
        [new THREE.Vector3(0.18, 0.84, -0.72), new THREE.Vector3(-0.82, -0.42, -0.42), 0.5],
        [new THREE.Vector3(-0.22, -0.78, 0.86), new THREE.Vector3(0.72, 0.5, -0.62), 0.44],
      ].forEach(([start, end, height]) => {
        const curve = createArc(start.normalize().multiplyScalar(1.17), end.normalize().multiplyScalar(1.17), height);
        const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), arcMaterial.clone());
        group.add(arc);
      });

      let frameId = 0;
      const pointer = { x: 0, y: 0 };
      const target = { x: -0.18, y: 0.32 };

      const resize = () => {
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const onPointerMove = (event) => {
        const rect = host.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 0.45;
        pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 0.36;
      };

      const observer = new ResizeObserver(resize);
      observer.observe(host);
      host.addEventListener('pointermove', onPointerMove);
      resize();

      const render = () => {
        target.x += (-0.18 + pointer.y - target.x) * 0.055;
        target.y += (0.32 + pointer.x - target.y) * 0.055;
        group.rotation.x = target.x;
        group.rotation.y += reducedMotion ? 0 : 0.0045;
        group.rotation.z = target.y * 0.18;
        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(render);
      };
      render();

      cleanup = () => {
        window.cancelAnimationFrame(frameId);
        observer.disconnect();
        host.removeEventListener('pointermove', onPointerMove);
        disposeObject(scene);
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    void init().catch(() => {
      if (!isDisposed) host.classList.add('atlas-globe-fallback');
    });

    return () => {
      isDisposed = true;
      cleanup();
    };
  }, [intensity]);

  return (
    <div
      ref={hostRef}
      className={`atlas-globe ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
