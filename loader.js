/**
 * LOADER.JS — Protocol Zero Cinematic Loader
 * Steps 2–6 of the loading sequence using Three.js + GSAP
 * 
 * Integration:
 *   1. Include <div id="pz-loader">...</div> before your main content
 *   2. Include loader.css in your <head>
 *   3. Load Three.js and GSAP before this script
 *   4. Call `initProtocolZeroLoader(onComplete)` where onComplete reveals your main page
 */

function initProtocolZeroLoader(onComplete) {
    // -------------------------------------------------------
    // STEP 2 — THREE.JS PARTICLE BACKGROUND (Neural Network)
    // -------------------------------------------------------
    const canvas = document.getElementById('pz-loader-canvas');
    let loaderRAF = null;

    if (canvas && typeof THREE !== 'undefined') {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(innerWidth, innerHeight);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
        camera.position.z = 5;

        // Optimized 350 particles for 60fps
        const COUNT = 350;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(COUNT * 3);
        const col = new Float32Array(COUNT * 3);

        // Blue (#06B6D4) and Purple (#7C3AED) — neural network palette
        const C1 = new THREE.Color('#7C3AED');
        const C2 = new THREE.Color('#06B6D4');

        for (let i = 0; i < COUNT; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 22;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 12;

            const mix = C1.clone().lerp(C2, Math.random());
            col[i * 3] = mix.r;
            col[i * 3 + 1] = mix.g;
            col[i * 3 + 2] = mix.b;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        const mat = new THREE.PointsMaterial({
            size: 0.055,
            vertexColors: true,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const pts = new THREE.Points(geo, mat);
        scene.add(pts);

        // Slow floating motion using requestAnimationFrame
        let t = 0;
        const tick = () => {
            loaderRAF = requestAnimationFrame(tick);
            t += 0.0008;
            pts.rotation.y = t;
            pts.rotation.x = t * 0.3;
            renderer.render(scene, camera);
        };
        tick();

        window.addEventListener('resize', () => {
            camera.aspect = innerWidth / innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(innerWidth, innerHeight);
        });
    }

    // -------------------------------------------------------
    // STEPS 3–6 — GSAP CINEMATIC TIMELINE
    // -------------------------------------------------------
    const tl = gsap.timeline();

    // STEP 3: Logo reveal — opacity 0→1, scale 0.9→1, 1.2s, power3.out
    tl.to('#pz-loader-inner', {
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: 'power3.out',
        delay: 0.25
    })

        // STEP 4: Glow pulse — scale 1→1.08, opacity breathing, 1s
        .to('#pz-loader-glow', {
            opacity: 1,
            scale: 1.08,
            duration: 0.9,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: 1
        }, '-=0.8')

        // Fade in percentage counter alongside glow
        .to('#pz-loader-pct', { opacity: 1, duration: 0.3 }, '<')

        // STEP 5: Thin neon progress bar — 0→100% width over 2.5s
        .to('#pz-loader-bar', {
            width: '100%',
            duration: 2.5,
            ease: 'power2.inOut',
            onUpdate: function () {
                const el = document.getElementById('pz-loader-pct');
                if (el) el.textContent = Math.round(this.progress() * 100) + '%';
            }
        }, '-=1.6')

        // STEP 6: Loader exit — opacity fade + translateY(-40px) in 0.8s
        .to('#pz-loader', {
            opacity: 0,
            y: -40,
            duration: 0.8,
            ease: 'power2.in',
            onStart: () => {
                // Main website rises in simultaneously
                gsap.to('#main', {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power2.out',
                    delay: 0.1
                });
            },
            onComplete: () => {
                const el = document.getElementById('pz-loader');
                if (el) el.style.display = 'none';
                if (loaderRAF) cancelAnimationFrame(loaderRAF);
                if (typeof onComplete === 'function') onComplete();
            }
        });
}
