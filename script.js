// =========================================================================
// CUSTOM CURSOR LOGIC
// =========================================================================
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');

let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Immediate dot follow
    if (cursor) {
        cursor.style.left = `${mouseX}px`;
        cursor.style.top = `${mouseY}px`;
    }
});

// Smooth ring follow using requestAnimationFrame
const renderCursor = () => {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;

    if (cursorRing) {
        cursorRing.style.left = `${ringX}px`;
        cursorRing.style.top = `${ringY}px`;
    }
    requestAnimationFrame(renderCursor);
};
renderCursor();

// Hover states for links and buttons
const interactables = document.querySelectorAll('a, button, .cursor-hover');
interactables.forEach(el => {
    el.addEventListener('mouseenter', () => {
        if (cursor) cursor.classList.add('scale-150', 'bg-white');
        if (cursorRing) cursorRing.classList.add('scale-150', 'border-pz-accent', 'shadow-[0_0_20px_rgba(6,182,212,0.6)]');
    });
    el.addEventListener('mouseleave', () => {
        if (cursor) cursor.classList.remove('scale-150', 'bg-white');
        if (cursorRing) cursorRing.classList.remove('scale-150', 'border-pz-accent', 'shadow-[0_0_20px_rgba(6,182,212,0.6)]');
    });
});

// =========================================================================
// THREE.JS PARTICLES 
// =========================================================================
const initThreeJS = (canvasId, particleCount, color1Hex, color2Hex, zDepth) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = zDepth;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(color1Hex);
    const color2 = new THREE.Color(color2Hex);

    for (let i = 0; i < particleCount; i++) {
        // Spread particles
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 2;

        const mixedColor = color1.clone().lerp(color2, Math.random());
        colors[i * 3] = mixedColor.r;
        colors[i * 3 + 1] = mixedColor.g;
        colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let time = 0;
    let animationFrameId;

    const animate = () => {
        time += 0.001;
        particles.rotation.y = time * 0.4;
        particles.rotation.x = time * 0.15;
        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { renderer, animationFrameId };
};


// =========================================================================
// INITIALIZATION: LOADER & GSAP TIMELINES
// =========================================================================

gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {

    // 1. Init Loader Particles (Blue & Purple)
    const loader3D = initThreeJS("loader-canvas", 400, "#06B6D4", "#7C3AED", 4);

    // 2. Init Main BG Particles (Darker, sparse)
    initThreeJS("bg-canvas", 600, "#7C3AED", "#EC4899", 5);

    // 3. Run Loader Timeline
    const tl = gsap.timeline();

    tl.to("#loader-content", {
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
        delay: 0.2
    })
        .to("#loader-glow", {
            opacity: 1,
            scale: 1.08,
            duration: 1,
            ease: "sine.inOut",
            yoyo: true,
            repeat: 1
        }, "-=0.8")
        .to("#loader-progress-text", {
            opacity: 1,
            duration: 0.3
        }, "<")
        .to("#loader-progress-bar", {
            width: "100%",
            duration: 2.5,
            ease: "power2.inOut",
            onUpdate: function () {
                const progress = Math.round(this.progress() * 100);
                const textEl = document.getElementById("loader-progress-text");
                if (textEl) textEl.textContent = progress + "%";
            }
        }, "-=1.5")
        .to("#loader-wrapper", {
            opacity: 0,
            y: -40,
            duration: 0.8,
            ease: "power3.inOut",
            onStart: () => {
                gsap.to("#main-content", {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: "power3.out"
                });
            },
            onComplete: () => {
                document.getElementById("loader-wrapper").style.display = "none";
                if (loader3D) cancelAnimationFrame(loader3D.animationFrameId); // Save resources

                // Start Hero Animations
                startHeroAnimations();

                // Re-calc scroll triggers after layout shifts
                ScrollTrigger.refresh();
            }
        });

    // 4. Start Hero entry animations once loader is gone
    function startHeroAnimations() {
        // High performance 90fps zoom-in effect requested by user
        gsap.fromTo(".hero-text > *",
            { opacity: 0, scale: 0.94, y: 0 },
            { opacity: 1, scale: 1, y: 0, duration: 1.2, stagger: 0.12, ease: "power4.out", force3D: true }
        );

        gsap.fromTo(".hero-visual",
            { opacity: 0, scale: 0.85, y: 0 },
            { opacity: 1, scale: 1, y: 0, duration: 1.5, ease: "power4.out", delay: 0.3, force3D: true }
        );
    }

    // 5. ScrollTrigger Reveals for Elements class="reveal"
    gsap.utils.toArray('.reveal').forEach(el => {
        gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
                trigger: el,
                start: "top 85%", // Trigger when element hits 85% down viewport
                toggleActions: "play none none none"
            }
        });
    });

    // 6. Floating Hire Btn Logic
    const floatingBtn = document.getElementById('floating-btn');
    if (floatingBtn) {
        ScrollTrigger.create({
            trigger: "#skills",
            start: "top center",
            onEnter: () => gsap.to(floatingBtn, { opacity: 1, duration: 0.3, y: 0 }),
            onLeaveBack: () => gsap.to(floatingBtn, { opacity: 0, duration: 0.3, y: 10 }),
        });
    }

});

// =========================================================================
// TELEGRAM CONTACT FORM NOTIFIER
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("contact-submit");
    const nameInput = document.getElementById("contact-name");
    const emailInput = document.getElementById("contact-email");
    const descInput = document.getElementById("contact-desc");

    if (!submitBtn || !nameInput || !emailInput || !descInput) return;

    // Telegram Bot Credentials
    const BOT_TOKEN = "8698380996:AAGtAravHhmLEaK8aLEhAhmkryu6Oz0VlEw";
    const CHAT_ID = "989740810";

    submitBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const desc = descInput.value.trim();

        if (!name || !email || !desc) {
            alert("Please fill in all fields before sending.");
            return;
        }

        // Store original button text and set loading state
        const btnSpan = submitBtn.querySelector("span");
        const originalText = btnSpan.textContent;
        btnSpan.textContent = "Sending...";
        submitBtn.style.pointerEvents = "none";
        submitBtn.style.opacity = "0.7";

        // Construct a highly readable, premium formatted message for Telegram
        const messageText = `
🚀 *NEW PORTFOLIO INQUIRY* 🚀

👤 *Name:* ${name}
📧 *Email:* ${email}

📝 *Project Description:*
${desc}

_Sent securely from your Portfolio_
        `;

        const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

        try {
            const response = await fetch(telegramApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: messageText,
                    parse_mode: "Markdown"
                })
            });

            if (response.ok) {
                // Success state
                btnSpan.textContent = "Message Sent ✓";
                submitBtn.style.background = "linear-gradient(90deg, #00ff88, #00d2ff)";
                submitBtn.style.color = "#000";
                
                // Clear inputs
                nameInput.value = "";
                emailInput.value = "";
                descInput.value = "";

                // Reset button after 3.5 seconds
                setTimeout(() => {
                    btnSpan.textContent = originalText;
                    submitBtn.style.background = "";
                    submitBtn.style.color = "";
                    submitBtn.style.pointerEvents = "auto";
                    submitBtn.style.opacity = "1";
                }, 3500);

            } else {
                throw new Error("API Error");
            }

        } catch (error) {
            console.error("Telegram Error:", error);
            btnSpan.textContent = "Error Sending!";
            submitBtn.style.background = "#ff3366";
            
            setTimeout(() => {
                btnSpan.textContent = originalText;
                submitBtn.style.background = "";
                submitBtn.style.pointerEvents = "auto";
                submitBtn.style.opacity = "1";
            }, 3000);
        }
    });

});
