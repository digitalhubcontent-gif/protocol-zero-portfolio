document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('nav');
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  const hireMeBtn = document.querySelector('.ncta');
  const desktopLinks = document.querySelectorAll('.nlinks a');
  const mobileLinks = document.querySelectorAll('.mobile-nav a');
  
  if (!nav) return;

  // ============================================================
  // SCROLL DETECTION (STICKY STATE)
  // ============================================================
  let ticking = false;

  function handleScroll() {
    const currentScrollY = window.scrollY;
    
    // Background style based on scroll position
    if (currentScrollY > 50) {
      nav.classList.add('nav-scrolled');
    } else {
      nav.classList.remove('nav-scrolled');
    }

    ticking = false;
  }

  // Use requestAnimationFrame for scroll performance
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(handleScroll);
      ticking = true;
    }
  }, { passive: true });

  // Init state
  handleScroll();

  // ============================================================
  // ACTIVE SECTION DETECTION (IntersectionObserver)
  // ============================================================
  const sections = document.querySelectorAll('section[id]');
  
  const observerOptions = {
    root: null,
    rootMargin: "-40% 0px -55% 0px",
    threshold: 0
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        // Update both desktop and mobile links
        document.querySelectorAll(`nav .nlinks a, .mobile-nav a`).forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(sec => sectionObserver.observe(sec));

  // ============================================================
  // MAGNETIC HOVER (Desktop only)
  // ============================================================
  desktopLinks.forEach(link => {
    link.addEventListener('mousemove', (e) => {
      const rect = link.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      
      // Calculate offset (max 4px) based on 60px assumed radius
      const maxOffset = 4;
      let x = (distanceX / 60) * maxOffset;
      let y = (distanceY / 60) * maxOffset;
      
      // Clamp values
      x = Math.max(-maxOffset, Math.min(maxOffset, x));
      y = Math.max(-maxOffset, Math.min(maxOffset, y));
      
      link.style.transform = `translate(${x}px, ${y}px)`;
    });

    link.addEventListener('mouseleave', () => {
      link.style.transform = `translate(0px, 0px)`;
    });
  });

  // ============================================================
  // HIRE ME BUTTON PULSE
  // ============================================================
  if (hireMeBtn) {
    hireMeBtn.addEventListener('click', function(e) {
      // Don't preventDefault here, let the smooth scroll handle it
      this.classList.remove('btn-pulse');
      // Force reflow
      void this.offsetWidth;
      this.classList.add('btn-pulse');
    });
  }

  // ============================================================
  // MOBILE HAMBURGER MENU
  // ============================================================
  function closeMobileMenu() {
    navToggle.classList.remove('active');
    mobileNav.classList.remove('open');
  }

  function toggleMobileMenu() {
    navToggle.classList.toggle('active');
    mobileNav.classList.toggle('open');
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', toggleMobileMenu);
    
    mobileLinks.forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        closeMobileMenu();
      }
    });

    // Close on outside click (clicking body, not nav and not menu)
    document.addEventListener('click', (e) => {
      if (mobileNav.classList.contains('open') && 
          !nav.contains(e.target) && 
          !mobileNav.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  // ============================================================
  // SMOOTH SCROLL BEHAVIOR
  // ============================================================
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const allNavLinks = document.querySelectorAll('a[href^="#"]');
  
  allNavLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;
      
      e.preventDefault();
      
      const start = window.pageYOffset;
      // Target position minus navbar height buffer (approx 70px) and a fixed 20px offset
      const targetOffset = targetElement.getBoundingClientRect().top + start - 90;
      
      const distance = targetOffset - start;
      const duration = 900;
      let startTime = null;
      
      function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        
        let progress = timeElapsed / duration;
        progress = Math.min(progress, 1);
        
        const ease = easeInOutCubic(progress);
        
        window.scrollTo(0, start + distance * ease);
        
        if (timeElapsed < duration) {
          window.requestAnimationFrame(animation);
        } else {
          // Push state gently without jumping
          history.pushState(null, null, targetId);
        }
      }
      
      window.requestAnimationFrame(animation);
    });
  });
});
