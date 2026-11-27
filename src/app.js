(() => {
  'use strict';

const STAKEHOLDER_DATA = {
  farmer: {
    kicker: 'Producer & Originator',
    title: 'Farmer',
    description:
      'Farmers register harvested crop lots, log weighbridge and moisture records, and build a portable financial history that helps accelerate fair payment.',
    ctaLabel: 'Explore Farmer Features',
    ctaTarget: '#features',
    activities: [
      'Register crop harvests with lot quantity, grade, and origin details.',
      'Track crop-to-cash progress from farm-gate dispatch to final payout.',
      'Build a Farmer Financial Passport backed by verified trade settlements.',
      'Receive automated disbursements as soon as delivery conditions clear.',
    ],
  },
  buyer: {
    kicker: 'Procurement & Offtaker',
    title: 'Buyer',
    description:
      'Buyers verify incoming produce quality against purchase orders, confirm delivery weights, and authorize clean settlements with full invoice confidence.',
    ctaLabel: 'View Verification Flow',
    ctaTarget: '#how-it-works',
    activities: [
      'Inspect verified harvest lots and moisture test records before acceptance.',
      'Approve digital invoices matched directly to weighbridge and dispatch proofs.',
      'Avoid disputed billing with automated duplicate invoice screening.',
      'Trigger transparent milestone settlements upon warehouse receipt.',
    ],
  },
  transporter: {
    kicker: 'Logistics & Custody',
    title: 'Transporter',
    description:
      'Transporters log pickup timestamps, transit checkpoints, and destination handoffs while monitoring route weather windows to protect crop quality.',
    ctaLabel: 'See Transit Workflow',
    ctaTarget: '#how-it-works',
    activities: [
      'Confirm farm-gate pickup and bind consignment weight to the trade lot.',
      'Monitor weather intelligence alerts for rain or humidity along transit corridors.',
      'Capture digital proof of delivery at buyer warehouses or mandis.',
      'Receive direct freight fee settlement when cargo handoff is verified.',
    ],
  },
  financier: {
    kicker: 'Working Capital & Risk',
    title: 'Financier',
    description:
      'Financiers review verified invoices, evaluate historical farmer trade reliability, and advance short-term liquidity without duplicate pledge exposure.',
    ctaLabel: 'Inspect Risk Controls',
    ctaTarget: '#features',
    activities: [
      'Verify invoice authenticity against physical dispatch and buyer confirmation.',
      'Detect duplicate or previously pledged invoices before releasing capital.',
      'Assess creditworthiness using verified Farmer Financial Passport records.',
      'Collect automated repayments directly from smart settlement splits.',
    ],
  },
};

const FEATURES_DATA = {
  'crop-to-cash': {
    kicker: 'Module 01 · Supply Chain Visibility',
    title: 'Crop-to-Cash Tracking',
    description:
      'Crop-to-Cash Tracking creates a unified milestone ledger connecting farm-gate harvest registration, transit custody, buyer inspection, and final payout.',
    points: [
      'Links physical lot weight and moisture readings directly to trade milestones.',
      'Gives farmers, buyers, and lenders a shared view of settlement readiness.',
      'Reduces payment delays caused by missing paper receipts or manual reconciliation.',
    ],
    roles: 'Farmers, Buyers, Transporters, Financiers',
  },
  'invoice-verification': {
    kicker: 'Module 02 · Document Integrity',
    title: 'Invoice Verification',
    description:
      'Invoice Verification validates every trade invoice against weighbridge tickets, dispatch logs, and buyer purchase terms before funds are committed.',
    points: [
      'Cross-checks quantity, grade, and unit pricing against approved trade orders.',
      'Prevents mismatched or unverified paperwork from entering settlement queues.',
      'Produces an auditable verification trail for every approved agricultural invoice.',
    ],
    roles: 'Buyers, Financiers, Farmers',
  },
  'smart-settlement': {
    kicker: 'Module 03 · Automated Payouts',
    title: 'Smart Settlement',
    description:
      'Smart Settlement automates conditional payment distribution once agreed delivery, quality, and invoice verification checkpoints are fulfilled.',
    points: [
      'Supports clean split payouts across farmers, logistics partners, and lenders.',
      'Eliminates manual follow-ups after buyer warehouse acceptance is recorded.',
      'Ensures predictable, rule-based settlement timing across every harvest cycle.',
    ],
    roles: 'Farmers, Buyers, Transporters, Financiers',
  },
  'weather-intelligence': {
    kicker: 'Module 04 · Climate Context',
    title: 'Weather Intelligence',
    description:
      'Weather Intelligence pairs regional rainfall, temperature, and humidity signals with harvest storage and transit schedules to reduce spoilage risk.',
    points: [
      'Alerts logistics coordinators to adverse weather along active crop corridors.',
      'Contextualizes moisture variance during harvest intake and grading.',
      'Helps stakeholders time dispatches and storage for stronger grade retention.',
    ],
    roles: 'Farmers, Transporters, Buyers',
  },
  'farmer-passport': {
    kicker: 'Module 05 · Verified Reputation',
    title: 'Farmer Financial Passport',
    description:
      'Farmer Financial Passport compiles verified harvest deliveries, quality compliance, and completed settlements into a portable trust profile.',
    points: [
      'Turns consistent seasonal deliveries into credible financial history.',
      'Helps farmers qualify for timely working capital with lower friction.',
      'Reduces onboarding and due-diligence time for agricultural financiers.',
    ],
    roles: 'Farmers, Financiers',
  },
  'duplicate-detection': {
    kicker: 'Module 06 · Fraud Prevention',
    title: 'Duplicate Invoice Detection',
    description:
      'Duplicate Invoice Detection screens every submitted invoice fingerprint to ensure the same crop lot or receipt cannot be pledged twice.',
    points: [
      'Detects matching invoice IDs, overlapping weighbridge slips, and lot hashes.',
      'Protects financiers from double-financing exposure across multiple desks.',
      'Preserves trust across verified buyer and producer networks.',
    ],
    roles: 'Financiers, Buyers',
  },
};

const SHOWCASE_STAGES = [
  {
    stage: 'Stage 01 · Harvest Registered',
    note: 'Origin weight & moisture verified at farm gate',
    progress: '28%',
  },
  {
    stage: 'Stage 02 · Transit Monitored',
    note: 'Clear weather corridor · GPS custody active',
    progress: '56%',
  },
  {
    stage: 'Stage 03 · Invoice Verified',
    note: 'Unique invoice hash · Zero duplicate pledges',
    progress: '82%',
  },
  {
    stage: 'Stage 04 · Smart Settlement',
    note: 'Escrow milestone cleared · Payout scheduled',
    progress: '100%',
  },
];

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToSection(selector) {
  const target = document.querySelector(selector);
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function initNavigation() {
  const header = document.getElementById('site-header');
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  const navLinks = Array.from(document.querySelectorAll('.nav-link, .mobile-nav-link'));
  const sectionIds = ['home', 'about', 'features', 'how-it-works', 'contact'];

  function setMobileMenuState(isOpen) {
    if (!toggleBtn || !mobileDrawer) {
      return;
    }
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    mobileDrawer.hidden = !isOpen;
  }

  function updateActiveNav(activeId) {
    navLinks.forEach((link) => {
      const matches = link.getAttribute('data-section') === activeId;
      link.classList.toggle('is-active', matches);
    });
  }

  if (toggleBtn && mobileDrawer) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      setMobileMenuState(!isExpanded);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') {
        return;
      }
      const target = document.querySelector(href);
      if (target) {
        event.preventDefault();
        scrollToSection(href);
        setMobileMenuState(false);
      }
    });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            updateActiveNav(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-35% 0px -50% 0px',
        threshold: 0.05,
      }
    );

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) {
        observer.observe(section);
      }
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      if (header) {
        header.classList.toggle('is-scrolled', window.scrollY > 24);
      }
    },
    { passive: true }
  );

  return {
    closeMobileMenu: () => setMobileMenuState(false),
  };
}

function initStakeholderSelector() {
  const tabs = Array.from(document.querySelectorAll('.stakeholder-tab'));
  const panel = document.getElementById('stakeholder-panel');
  if (!tabs.length || !panel) {
    return;
  }

  function renderStakeholder(roleKey, animate = true) {
    const data = STAKEHOLDER_DATA[roleKey];
    if (!data) {
      return;
    }

    tabs.forEach((tab) => {
      const isSelected = tab.getAttribute('data-stakeholder') === roleKey;
      tab.classList.toggle('is-active', isSelected);
      tab.setAttribute('aria-selected', String(isSelected));
      if (isSelected) {
        panel.setAttribute('aria-labelledby', tab.id);
      }
    });

    if (animate) {
      panel.classList.remove('is-switching');
      void panel.offsetWidth;
      panel.classList.add('is-switching');
    }

    panel.innerHTML = '';

    const summaryCol = document.createElement('div');
    const kicker = document.createElement('p');
    kicker.className = 'stakeholder-role-kicker';
    kicker.textContent = data.kicker;

    const title = document.createElement('h3');
    title.className = 'stakeholder-role-title';
    title.textContent = data.title;

    const desc = document.createElement('p');
    desc.className = 'stakeholder-role-desc';
    desc.textContent = data.description;

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn btn-sage btn-shimmer';
    actionBtn.textContent = data.ctaLabel + ' ';
    const arrow = document.createElement('span');
    arrow.className = 'btn-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '&rarr;';
    actionBtn.appendChild(arrow);
    actionBtn.addEventListener('click', () => scrollToSection(data.ctaTarget));

    summaryCol.append(kicker, title, desc, actionBtn);

    const activitiesBox = document.createElement('div');
    activitiesBox.className = 'stakeholder-activities-box';

    const activitiesHeading = document.createElement('h4');
    activitiesHeading.className = 'activities-heading';
    activitiesHeading.textContent = `Core ${data.title} Activities on AgriSettleX`;

    const list = document.createElement('ul');
    list.className = 'activities-list';

    data.activities.forEach((activityText, idx) => {
      const li = document.createElement('li');
      li.style.setProperty('--item-idx', String(idx));

      const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      iconSvg.setAttribute('viewBox', '0 0 24 24');
      iconSvg.setAttribute('fill', 'none');
      iconSvg.setAttribute('stroke', 'currentColor');
      iconSvg.setAttribute('stroke-width', '2');
      iconSvg.setAttribute('class', 'activity-check');
      iconSvg.setAttribute('aria-hidden', 'true');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 13l4 4L19 7');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      iconSvg.appendChild(path);

      const textSpan = document.createElement('span');
      textSpan.textContent = activityText;

      li.append(iconSvg, textSpan);
      list.appendChild(li);
    });

    activitiesBox.append(activitiesHeading, list);
    panel.append(summaryCol, activitiesBox);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const roleKey = tab.getAttribute('data-stakeholder');
      if (roleKey) {
        renderStakeholder(roleKey, true);
      }
    });
  });

  renderStakeholder('farmer', false);
}

function createModalController() {
  let activeModal = null;
  let lastFocusedElement = null;

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      return;
    }
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    activeModal = modal;
    document.body.style.overflow = 'hidden';

    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeModal(modalId) {
    const modal = modalId ? document.getElementById(modalId) : activeModal;
    if (!modal || modal.hidden) {
      return;
    }
    modal.hidden = true;
    activeModal = null;
    document.body.style.overflow = '';

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-modal');
      closeModal(id);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeModal) {
      closeModal(activeModal.id);
    }
  });

  return { openModal, closeModal };
}

function initFeatureModals(modalController) {
  const kickerEl = document.getElementById('feature-modal-kicker');
  const titleEl = document.getElementById('feature-modal-title');
  const descEl = document.getElementById('feature-modal-description');
  const pointsEl = document.getElementById('feature-modal-points');
  const rolesEl = document.getElementById('feature-modal-roles');
  const ctaEl = document.getElementById('feature-modal-cta');

  function openFeatureDetail(featureKey) {
    const feature = FEATURES_DATA[featureKey];
    if (!feature || !titleEl || !descEl || !pointsEl || !rolesEl || !kickerEl) {
      return;
    }

    kickerEl.textContent = feature.kicker;
    titleEl.textContent = feature.title;
    descEl.textContent = feature.description;
    rolesEl.textContent = feature.roles;

    pointsEl.innerHTML = '';
    feature.points.forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      pointsEl.appendChild(li);
    });

    modalController.openModal('feature-modal');
  }

  document.querySelectorAll('[data-feature-btn]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-feature-btn');
      if (key) {
        openFeatureDetail(key);
      }
    });
  });

  if (ctaEl) {
    ctaEl.addEventListener('click', () => {
      modalController.closeModal('feature-modal');
      scrollToSection('#stakeholders');
    });
  }
}

function initLoginModal(modalController, navController) {
  const navLoginBtn = document.getElementById('nav-login-btn');
  const mobileLoginBtn = document.getElementById('mobile-login-btn');
  const loginExploreBtn = document.getElementById('login-modal-explore');

  [navLoginBtn, mobileLoginBtn].forEach((btn) => {
    if (!btn) {
      return;
    }
    btn.addEventListener('click', () => {
      navController.closeMobileMenu();
      modalController.openModal('login-modal');
    });
  });

  if (loginExploreBtn) {
    loginExploreBtn.addEventListener('click', () => {
      modalController.closeModal('login-modal');
      scrollToSection('#stakeholders');
    });
  }
}

function initCtaButtons(navController) {
  document.querySelectorAll('[data-scroll-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-scroll-target');
      if (target) {
        navController.closeMobileMenu();
        scrollToSection(target);
      }
    });
  });
}

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) {
    return;
  }

  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email');
  const messageInput = document.getElementById('contact-message');
  const nameError = document.getElementById('error-name');
  const emailError = document.getElementById('error-email');
  const messageError = document.getElementById('error-message');
  const successBox = document.getElementById('contact-success');
  const successText = document.getElementById('contact-success-text');

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setFieldError(input, errorEl, message) {
    if (!input || !errorEl) {
      return;
    }
    if (message) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  function validateForm() {
    let isValid = true;
    const nameVal = nameInput.value.trim();
    const emailVal = emailInput.value.trim();
    const messageVal = messageInput.value.trim();

    if (!nameVal) {
      setFieldError(nameInput, nameError, 'Please enter your name.');
      isValid = false;
    } else {
      setFieldError(nameInput, nameError, '');
    }

    if (!emailVal) {
      setFieldError(emailInput, emailError, 'Please enter your email address.');
      isValid = false;
    } else if (!emailPattern.test(emailVal)) {
      setFieldError(emailInput, emailError, 'Please enter a valid email address (e.g. name@domain.com).');
      isValid = false;
    } else {
      setFieldError(emailInput, emailError, '');
    }

    if (!messageVal) {
      setFieldError(messageInput, messageError, 'Please enter a brief message.');
      isValid = false;
    } else {
      setFieldError(messageInput, messageError, '');
    }

    return isValid;
  }

  [nameInput, emailInput, messageInput].forEach((input) => {
    if (!input) {
      return;
    }
    input.addEventListener('input', () => {
      if (successBox) {
        successBox.hidden = true;
      }
      if (input.classList.contains('is-invalid')) {
        validateForm();
      }
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateForm()) {
      if (successBox) {
        successBox.hidden = true;
      }
      return;
    }

    const senderName = nameInput.value.trim();
    form.reset();
    if (successBox && successText) {
      successText.textContent = `Thank you, ${senderName}. Your inquiry has been validated and recorded in this frontend demo.`;
      successBox.hidden = false;
    }
  });
}

function initBotanicalMotes() {
  const container = document.getElementById('botanical-motes');
  if (!container || prefersReducedMotion()) {
    return;
  }

  const moteCount = 24;
  for (let i = 0; i < moteCount; i += 1) {
    const mote = document.createElement('span');
    mote.className = 'botanical-mote';

    const size = 3 + ((i * 7) % 6);
    const left = (i * 4.2 + ((i % 3) * 2.1)) % 100;
    const duration = 12 + ((i * 3) % 10);
    const delay = -((i * 1.7) % 14);
    const drift = ((i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 14));
    const opacity = (0.28 + ((i % 4) * 0.12)).toFixed(2);

    mote.style.width = `${size}px`;
    mote.style.height = `${size}px`;
    mote.style.left = `${left}%`;
    mote.style.setProperty('--mote-duration', `${duration}s`);
    mote.style.setProperty('--mote-delay', `${delay}s`);
    mote.style.setProperty('--mote-drift', `${drift}px`);
    mote.style.setProperty('--mote-opacity', opacity);

    container.appendChild(mote);
  }
}

function initInteractiveTilt() {
  if (prefersReducedMotion()) {
    return;
  }

  const surfaces = Array.from(document.querySelectorAll('[data-tilt]'));
  surfaces.forEach((surface) => {
    surface.addEventListener('mousemove', (event) => {
      const rect = surface.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateY = ((x - centerX) / centerX) * 4.5;
      const rotateX = ((centerY - y) / centerY) * 4.5;

      surface.classList.add('is-tilting');
      surface.style.setProperty('--tilt-rx', `${rotateX.toFixed(2)}deg`);
      surface.style.setProperty('--tilt-ry', `${rotateY.toFixed(2)}deg`);
      surface.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
      surface.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
    });

    surface.addEventListener('mouseleave', () => {
      surface.classList.remove('is-tilting');
      surface.style.setProperty('--tilt-rx', '0deg');
      surface.style.setProperty('--tilt-ry', '0deg');
    });
  });
}

function initShowcaseCycle() {
  const stageEl = document.getElementById('showcase-cycle-stage');
  const noteEl = document.getElementById('showcase-cycle-note');
  const fillEl = document.getElementById('showcase-cycle-fill');

  if (!stageEl || !noteEl || !fillEl) {
    return;
  }

  let index = 2;
  const applyStage = (item) => {
    stageEl.textContent = item.stage;
    noteEl.textContent = item.note;
    fillEl.style.width = item.progress;
  };

  applyStage(SHOWCASE_STAGES[index]);

  if (prefersReducedMotion()) {
    return;
  }

  window.setInterval(() => {
    index = (index + 1) % SHOWCASE_STAGES.length;
    stageEl.style.opacity = '0';
    noteEl.style.opacity = '0';

    window.setTimeout(() => {
      applyStage(SHOWCASE_STAGES[index]);
      stageEl.style.opacity = '1';
      noteEl.style.opacity = '1';
    }, 200);
  }, 3600);
}

function animateCounter(el) {
  const targetValue = Number(el.getAttribute('data-count-to'));
  const suffix = el.getAttribute('data-count-suffix') || '';
  if (!Number.isFinite(targetValue) || prefersReducedMotion()) {
    el.textContent = `${targetValue}${suffix}`;
    return;
  }

  const duration = 900;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * targetValue);
    el.textContent = `${current}${suffix}`;
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  }

  window.requestAnimationFrame(tick);
}

function initScrollEnhancements() {
  const backToTopBtn = document.getElementById('back-to-top');
  const revealElements = Array.from(document.querySelectorAll('.reveal-on-scroll'));
  const countElements = Array.from(document.querySelectorAll('[data-count-to]'));

  document.documentElement.classList.add('js-enhanced');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    revealElements.forEach((el) => revealObserver.observe(el));

    const counterObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );

    countElements.forEach((el) => counterObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('is-visible'));
  }

  let ticking = false;
  const updateScrollEffects = () => {
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const ratio = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    document.documentElement.style.setProperty('--scroll-progress', ratio.toFixed(4));

    if (backToTopBtn) {
      backToTopBtn.hidden = window.scrollY < 360;
    }

    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollEffects);
        ticking = true;
      }
    },
    { passive: true }
  );

  updateScrollEffects();

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      scrollToSection('#home');
    });
  }

  const footerYear = document.getElementById('footer-year');
  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const navController = initNavigation();
  const modalController = createModalController();

  initStakeholderSelector();
  initFeatureModals(modalController);
  initLoginModal(modalController, navController);
  initCtaButtons(navController);
  initContactForm();
  initBotanicalMotes();
  initInteractiveTilt();
  initShowcaseCycle();
  initScrollEnhancements();
});
})();
