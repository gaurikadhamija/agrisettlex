(() => {
  'use strict';

  const { ROLE_CONFIG, NAV_LABELS, TIMELINE_STEPS, createInitialState } = window.AgriSettleX;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(num) {
    const val = Number(num) || 0;
    return '$' + val.toLocaleString('en-US');
  }

  function statusBadge(status) {
    const normalized = String(status || 'Pending').toLowerCase();
    let tone = 'pending';
    if (['approved', 'accepted', 'active', 'verified', 'nominal', 'stored', 'offer sent'].includes(normalized)) {
      tone = 'approved';
    } else if (['completed', 'paid', 'delivered'].includes(normalized)) {
      tone = 'completed';
    } else if (['disputed', 'flagged', 'warning'].includes(normalized)) {
      tone = 'disputed';
    } else if (['rejected'].includes(normalized)) {
      tone = 'rejected';
    }
    return `<span class="status-badge status-badge--${tone}">${escapeHtml(status)}</span>`;
  }

  function computeNetting(obligations) {
    const balances = new Map();
    let grossTotal = 0;

    obligations.forEach((obl) => {
      const amt = Number(obl.amount) || 0;
      if (amt <= 0) {
        return;
      }
      grossTotal += amt;
      balances.set(obl.from, (balances.get(obl.from) || 0) - amt);
      balances.set(obl.to, (balances.get(obl.to) || 0) + amt);
    });

    const participantRows = Array.from(balances.entries()).map(([participant, net]) => ({
      participant,
      net,
    }));

    const debtors = participantRows
      .filter((r) => r.net < 0)
      .map((r) => ({ name: r.participant, amt: Math.abs(r.net) }))
      .sort((a, b) => b.amt - a.amt);

    const creditors = participantRows
      .filter((r) => r.net > 0)
      .map((r) => ({ name: r.participant, amt: r.net }))
      .sort((a, b) => b.amt - a.amt);

    const netTransfers = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amt, creditors[j].amt);
      if (pay > 0) {
        netTransfers.push({
          from: debtors[i].name,
          to: creditors[j].name,
          amount: pay,
        });
      }
      debtors[i].amt -= pay;
      creditors[j].amt -= pay;
      if (debtors[i].amt <= 0.01) {
        i += 1;
      }
      if (creditors[j].amt <= 0.01) {
        j += 1;
      }
    }

    const netTotal = netTransfers.reduce((sum, item) => sum + item.amount, 0);
    const saved = Math.max(grossTotal - netTotal, 0);

    return {
      grossTotal,
      netTotal,
      saved,
      participantRows,
      netTransfers,
    };
  }

  function createWorkspaceController({ onLogout }) {
    let state = createInitialState();
    let currentUser = null;
    let currentTab = 'overview';
    let searchQuery = '';
    let invoiceFilter = 'All';
    let toastTimer = null;

    const elements = {
      sidebarNav: document.getElementById('ws-sidebar-nav'),
      sidebarRoleTag: document.getElementById('ws-sidebar-role'),
      workspaceTitle: document.getElementById('ws-topbar-title'),
      searchInput: document.getElementById('ws-global-search'),
      notifBtn: document.getElementById('ws-notif-btn'),
      notifBadge: document.getElementById('ws-notif-badge'),
      notifDrawer: document.getElementById('ws-notif-popover'),
      notifList: document.getElementById('ws-notif-list'),
      markAllReadBtn: document.getElementById('ws-mark-all-read'),
      helpBtn: document.getElementById('ws-help-btn'),
      avatarEl: document.getElementById('ws-user-avatar'),
      userNameEl: document.getElementById('ws-user-name'),
      userRoleEl: document.getElementById('ws-user-role'),
      userMenuTrigger: document.getElementById('ws-user-menu-trigger'),
      userDropdown: document.getElementById('ws-user-dropdown'),
      mainContent: document.getElementById('ws-main-content'),
      sidebar: document.getElementById('ws-sidebar'),
      sidebarToggle: document.getElementById('ws-sidebar-toggle'),
      sidebarOverlay: document.getElementById('ws-sidebar-overlay'),
      modalBackdrop: document.getElementById('ws-modal'),
      modalKicker: document.getElementById('ws-modal-kicker'),
      modalTitle: document.getElementById('ws-modal-title'),
      modalBody: document.getElementById('ws-modal-body'),
      modalClose: document.getElementById('ws-modal-close'),
      toast: document.getElementById('ws-toast'),
    };

    function showToast(message) {
      if (!elements.toast) {
        return;
      }
      elements.toast.textContent = message;
      elements.toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        elements.toast.hidden = true;
      }, 3200);
    }

    function pushNotification(category, title) {
      state.notifications.unshift({
        id: 'NTF-' + Date.now(),
        category,
        title,
        time: 'Just now',
        read: false,
      });
      renderNotifications();
    }

    function openWsModal(kicker, title, bodyHtml, onReady) {
      if (!elements.modalBackdrop || !elements.modalBody) {
        return;
      }
      elements.modalKicker.textContent = kicker;
      elements.modalTitle.textContent = title;
      elements.modalBody.innerHTML = bodyHtml;
      elements.modalBackdrop.hidden = false;
      document.body.style.overflow = 'hidden';
      if (typeof onReady === 'function') {
        onReady(elements.modalBody);
      }
    }

    function closeWsModal() {
      if (!elements.modalBackdrop) {
        return;
      }
      elements.modalBackdrop.hidden = true;
      document.body.style.overflow = '';
    }

    function closeSidebarMobile() {
      if (elements.sidebar) {
        elements.sidebar.classList.remove('is-open');
      }
      if (elements.sidebarOverlay) {
        elements.sidebarOverlay.hidden = true;
      }
      if (elements.sidebarToggle) {
        elements.sidebarToggle.setAttribute('aria-expanded', 'false');
      }
    }

    function renderNotifications() {
      const unreadCount = state.notifications.filter((n) => !n.read).length;
      if (elements.notifBadge) {
        elements.notifBadge.textContent = String(unreadCount);
        elements.notifBadge.hidden = unreadCount === 0;
      }

      if (!elements.notifList) {
        return;
      }

      if (!state.notifications.length) {
        elements.notifList.innerHTML = '<p class="ws-empty-note">No notifications yet.</p>';
        return;
      }

      elements.notifList.innerHTML = state.notifications
        .map(
          (item) => `
          <button type="button" class="ws-notif-item ${item.read ? 'is-read' : 'is-unread'}" data-notif-id="${escapeHtml(item.id)}">
            <div class="ws-notif-top">
              <span class="ws-notif-category">${escapeHtml(item.category)}</span>
              <span class="ws-notif-time">${escapeHtml(item.time)}</span>
            </div>
            <p class="ws-notif-title">${escapeHtml(item.title)}</p>
            <span class="ws-notif-state">${item.read ? 'Read' : 'Unread · Click to mark read'}</span>
          </button>
        `
        )
        .join('');

      elements.notifList.querySelectorAll('[data-notif-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-notif-id');
          const found = state.notifications.find((n) => n.id === id);
          if (found && !found.read) {
            found.read = true;
            renderNotifications();
          }
        });
      });
    }

    function renderSidebar() {
      if (!currentUser || !elements.sidebarNav) {
        return;
      }
      const roleCfg = ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.farmer;
      if (elements.sidebarRoleTag) {
        elements.sidebarRoleTag.textContent = `${roleCfg.label} Portal`;
      }

      const itemsHtml = roleCfg.navItems
        .map(
          (tabKey) => `
          <button
            type="button"
            class="ws-nav-item ${currentTab === tabKey ? 'is-active' : ''}"
            data-ws-tab="${escapeHtml(tabKey)}"
          >
            <span>${escapeHtml(NAV_LABELS[tabKey] || tabKey)}</span>
          </button>
        `
        )
        .join('');

      elements.sidebarNav.innerHTML = `
        ${itemsHtml}
        <button type="button" class="ws-nav-item ws-nav-item--logout" id="ws-sidebar-logout">
          <span>Logout</span>
        </button>
      `;

      elements.sidebarNav.querySelectorAll('[data-ws-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-ws-tab');
          if (tab) {
            currentTab = tab;
            closeSidebarMobile();
            renderSidebar();
            renderMain();
          }
        });
      });

      const logoutBtn = document.getElementById('ws-sidebar-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          closeSidebarMobile();
          onLogout();
        });
      }
    }

    function renderTopbar() {
      if (!currentUser) {
        return;
      }
      const roleCfg = ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.farmer;
      if (elements.workspaceTitle) {
        elements.workspaceTitle.textContent = roleCfg.workspaceTitle;
      }
      if (elements.userNameEl) {
        elements.userNameEl.textContent = currentUser.name;
      }
      if (elements.userRoleEl) {
        elements.userRoleEl.textContent = roleCfg.label;
      }
      if (elements.avatarEl) {
        const initials = currentUser.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join('');
        elements.avatarEl.textContent = initials || 'AX';
      }
    }

    function matchesSearch(fields) {
      if (!searchQuery) {
        return true;
      }
      const q = searchQuery.toLowerCase();
      return fields.some((field) => String(field ?? '').toLowerCase().includes(q));
    }

    function renderTimelineStepper(activeStageIndex) {
      return `
        <div class="ws-timeline" aria-label="Crop-to-Cash Transaction Timeline">
          ${TIMELINE_STEPS.map((step, idx) => {
            let stateClass = '';
            if (idx < activeStageIndex) {
              stateClass = 'is-done';
            } else if (idx === activeStageIndex) {
              stateClass = 'is-current';
            }
            return `
              <div class="ws-timeline-step ${stateClass}">
                <span class="ws-timeline-dot tabular-nums">${idx + 1}</span>
                <span class="ws-timeline-label">${escapeHtml(step)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderFarmerOverview() {
      const totalListings = state.cropListings.length;
      const activeAgreements = state.agreements.filter((a) => a.status !== 'Rejected').length;
      const pendingInvoices = state.invoices.filter((i) => i.status === 'Pending').length;
      const receivedTotal = state.invoices
        .filter((i) => i.status === 'Paid')
        .reduce((sum, i) => sum + i.amount, 0);
      const expectedTotal = state.invoices
        .filter((i) => i.status === 'Accepted' || i.status === 'Pending')
        .reduce((sum, i) => sum + i.amount, 0);

      const filteredListings = state.cropListings.filter((c) =>
        matchesSearch([c.id, c.crop, c.grade, c.location])
      );
      const filteredInvoices = state.invoices.filter((inv) => {
        const statusOk = invoiceFilter === 'All' || inv.status === invoiceFilter;
        return statusOk && matchesSearch([inv.id, inv.buyer, inv.status]);
      });

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Welcome back, ${escapeHtml(currentUser.name)}</p>
            <h2 class="ws-heading">Manage your harvest inventory, sales, and Crop-to-Cash payouts</h2>
            <p class="ws-subtext">Demo session · ${escapeHtml(ROLE_CONFIG.farmer.org)}</p>
          </div>
          <div class="ws-quick-actions">
            <button type="button" class="btn btn-sage btn-sm" id="ws-open-add-listing">+ Add Crop Listing</button>
            <button type="button" class="btn btn-glass btn-sm" id="ws-open-passport-btn">View Passport</button>
          </div>
        </div>

        <div class="ws-kpi-grid ws-kpi-grid--5">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Total Crop Listings</span>
            <strong class="ws-kpi-value tabular-nums">${totalListings}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Active Purchase Agreements</span>
            <strong class="ws-kpi-value tabular-nums">${activeAgreements}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Pending Invoices</span>
            <strong class="ws-kpi-value tabular-nums">${pendingInvoices}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Payments Received</span>
            <strong class="ws-kpi-value tabular-nums">${formatCurrency(receivedTotal)}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Expected Receivables</span>
            <strong class="ws-kpi-value tabular-nums">${formatCurrency(expectedTotal)}</strong>
          </article>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Crop Inventory</h3>
              <p class="ws-card-subtitle">Active harvest lots listed for procurement</p>
            </div>
            <button type="button" class="btn btn-sage btn-sm" id="ws-add-listing-inline">Add Crop Listing</button>
          </div>
          ${renderCropListingsTable(filteredListings, 'farmer')}
        </section>

        <div class="ws-two-col">
          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">My Sales</h3>
                <p class="ws-card-subtitle">Active buyer agreements and delivery status</p>
              </div>
            </div>
            <div class="ws-table-wrap">
              <table class="ws-table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Crop</th>
                    <th class="num">Qty</th>
                    <th>Agreement</th>
                    <th>Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.agreements
                    .filter((a) => matchesSearch([a.id, a.buyer, a.crop, a.status, a.deliveryStatus]))
                    .map(
                      (a) => `
                    <tr>
                      <td><strong>${escapeHtml(a.buyer)}</strong></td>
                      <td>${escapeHtml(a.crop)}</td>
                      <td class="num tabular-nums">${a.quantity} MT</td>
                      <td>${statusBadge(a.status)}</td>
                      <td>${statusBadge(a.deliveryStatus)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Financial Passport &amp; Weather Alerts</h3>
                <p class="ws-card-subtitle">Verified seasonal credibility &amp; sample climate alerts</p>
              </div>
              <button type="button" class="btn btn-glass btn-sm" id="ws-open-passport-card">View Passport</button>
            </div>
            <div class="ws-passport-summary">
              <div>
                <span class="ws-kpi-label">Verified Sales</span>
                <strong class="tabular-nums">14 Settled Lots</strong>
              </div>
              <div>
                <span class="ws-kpi-label">Accepted Invoices</span>
                <strong class="tabular-nums">${state.invoices.filter((i) => i.buyerAccepted).length} Verified</strong>
              </div>
              <div>
                <span class="ws-kpi-label">On-Time History</span>
                <strong class="tabular-nums">98.2%</strong>
              </div>
            </div>
            <div class="ws-alert-stack">
              ${state.weatherAlerts
                .map(
                  (w) => `
                <div class="ws-alert-item">
                  <div class="ws-alert-head">
                    <strong>${escapeHtml(w.region)}</strong>
                    ${statusBadge(w.severity)}
                  </div>
                  <p>${escapeHtml(w.message)}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </section>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Invoice Wallet</h3>
              <p class="ws-card-subtitle">Track Pending, Accepted, Paid, and Disputed invoices</p>
            </div>
            <div class="ws-filter-pills">
              ${['All', 'Pending', 'Accepted', 'Paid', 'Disputed']
                .map(
                  (st) => `
                <button type="button" class="ws-filter-pill ${invoiceFilter === st ? 'is-active' : ''}" data-inv-filter="${st}">
                  ${st}
                </button>
              `
                )
                .join('')}
            </div>
          </div>
          ${renderInvoicesTable(filteredInvoices, 'farmer')}
        </section>
      `;
    }

    function renderBuyerOverview() {
      const activePOs = state.agreements.length;
      const pendingDeliveries = state.agreements.filter((a) => !a.deliveryConfirmed).length;
      const awaitingInvoices = state.invoices.filter((i) => i.status === 'Pending').length;
      const totalPayables = state.invoices
        .filter((i) => i.status === 'Accepted' || i.status === 'Pending')
        .reduce((sum, i) => sum + i.amount, 0);

      const filteredListings = state.cropListings.filter((c) =>
        matchesSearch([c.id, c.crop, c.location, c.farmer])
      );

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Welcome back, ${escapeHtml(currentUser.name)}</p>
            <h2 class="ws-heading">Procure verified harvests, confirm deliveries, and approve invoices</h2>
            <p class="ws-subtext">Demo session · ${escapeHtml(ROLE_CONFIG.buyer.org)}</p>
          </div>
          <div class="ws-quick-actions">
            <button type="button" class="btn btn-sage btn-sm" data-jump-tab="agreements">Review Agreements</button>
            <button type="button" class="btn btn-glass btn-sm" data-jump-tab="settlement">Open Smart Settlement</button>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Active Purchase Orders</span>
            <strong class="ws-kpi-value tabular-nums">${activePOs}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Pending Deliveries</span>
            <strong class="ws-kpi-value tabular-nums">${pendingDeliveries}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Invoices Awaiting Approval</span>
            <strong class="ws-kpi-value tabular-nums">${awaitingInvoices}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Total Payables</span>
            <strong class="ws-kpi-value tabular-nums">${formatCurrency(totalPayables)}</strong>
          </article>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Browse Crop Listings</h3>
              <p class="ws-card-subtitle">Available verified harvest lots from registered farmers</p>
            </div>
          </div>
          ${renderCropListingsTable(filteredListings, 'buyer')}
        </section>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Delivery Verification</h3>
              <p class="ws-card-subtitle">Compare expected vs received quantities before approving settlement</p>
            </div>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Agreement</th>
                  <th>Farmer</th>
                  <th class="num">Expected</th>
                  <th class="num">Received</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${state.agreements
                  .filter((a) => matchesSearch([a.id, a.crop, a.farmer, a.deliveryStatus]))
                  .map(
                    (a) => `
                  <tr>
                    <td class="tabular-nums"><strong>${escapeHtml(a.id)}</strong> · ${escapeHtml(a.crop)}</td>
                    <td>${escapeHtml(a.farmer)}</td>
                    <td class="num tabular-nums">${a.expectedQty} MT</td>
                    <td class="num tabular-nums">${a.receivedQty} MT</td>
                    <td>${statusBadge(a.deliveryConfirmed ? 'Completed' : a.deliveryStatus)}</td>
                    <td>
                      <div class="ws-row-actions">
                        <button type="button" class="btn btn-sage btn-xs" data-confirm-delivery="${escapeHtml(a.id)}" ${a.deliveryConfirmed ? 'disabled' : ''}>
                          ${a.deliveryConfirmed ? 'Confirmed' : 'Confirm Delivery'}
                        </button>
                        <button type="button" class="btn btn-glass btn-xs" data-report-discrepancy="${escapeHtml(a.id)}">
                          Report Discrepancy
                        </button>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Invoice Management</h3>
              <p class="ws-card-subtitle">Approve validated invoices or raise a discrepancy dispute</p>
            </div>
          </div>
          ${renderInvoicesTable(
            state.invoices.filter((inv) => matchesSearch([inv.id, inv.farmer, inv.status])),
            'buyer'
          )}
        </section>
      `;
    }

    function renderTransporterWarehouseOverview() {
      const assigned = state.shipments.length;
      const inTransit = state.shipments.filter((s) => s.status === 'In Transit').length;
      const completed = state.shipments.filter((s) => s.status === 'Delivered').length;
      const pendingConfirm = state.shipments.filter((s) => !s.confirmed).length;

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Welcome back, ${escapeHtml(currentUser.name)}</p>
            <h2 class="ws-heading">Coordinate crop dispatches, delivery confirmations, and warehouse receipts</h2>
            <p class="ws-subtext">Demo session · ${escapeHtml(ROLE_CONFIG[currentUser.role].org)}</p>
          </div>
          <div class="ws-quick-actions">
            <button type="button" class="btn btn-sage btn-sm" id="ws-open-add-whr">+ Add Warehouse Receipt</button>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Assigned Shipments</span>
            <strong class="ws-kpi-value tabular-nums">${assigned}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">In-Transit Shipments</span>
            <strong class="ws-kpi-value tabular-nums">${inTransit}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Completed Deliveries</span>
            <strong class="ws-kpi-value tabular-nums">${completed}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Pending Confirmations</span>
            <strong class="ws-kpi-value tabular-nums">${pendingConfirm}</strong>
          </article>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Shipment Management &amp; Live Updates</h3>
              <p class="ws-card-subtitle">Advance consignment milestones and record delivery confirmation</p>
            </div>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Crop</th>
                  <th>Pickup</th>
                  <th>Destination</th>
                  <th class="num">Quantity</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody>
                ${state.shipments
                  .filter((s) => matchesSearch([s.id, s.crop, s.pickup, s.destination, s.status]))
                  .map(
                    (s) => `
                  <tr>
                    <td class="tabular-nums"><strong>${escapeHtml(s.id)}</strong></td>
                    <td>${escapeHtml(s.crop)}</td>
                    <td>${escapeHtml(s.pickup)}</td>
                    <td>${escapeHtml(s.destination)}</td>
                    <td class="num tabular-nums">${escapeHtml(s.quantity)}</td>
                    <td class="tabular-nums">${escapeHtml(s.deliveryDate)}</td>
                    <td>${statusBadge(s.status)}</td>
                    <td>
                      <div class="ws-row-actions">
                        <select class="ws-select-inline" data-shipment-select="${escapeHtml(s.id)}" aria-label="Update status for ${escapeHtml(s.id)}">
                          <option value="Dispatched" ${s.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                          <option value="In Transit" ${s.status === 'In Transit' ? 'selected' : ''}>In Transit</option>
                          <option value="Delivered" ${s.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                        <button type="button" class="btn btn-sage btn-xs" data-confirm-shipment="${escapeHtml(s.id)}" ${s.confirmed ? 'disabled' : ''}>
                          ${s.confirmed ? 'Confirmed' : 'Confirm'}
                        </button>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Warehouse Records</h3>
              <p class="ws-card-subtitle">Verified grain receipts and storage references</p>
            </div>
            <button type="button" class="btn btn-glass btn-sm" id="ws-add-whr-inline">+ Sample Receipt Entry</button>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Receipt Ref</th>
                  <th>Crop</th>
                  <th>Lot ID</th>
                  <th class="num">Received Qty</th>
                  <th class="num">Moisture</th>
                  <th>Recorded At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${state.warehouseReceipts
                  .map(
                    (w) => `
                  <tr>
                    <td class="tabular-nums"><strong>${escapeHtml(w.receiptId)}</strong></td>
                    <td>${escapeHtml(w.crop)}</td>
                    <td class="tabular-nums">${escapeHtml(w.lotId)}</td>
                    <td class="num tabular-nums">${escapeHtml(w.quantity)}</td>
                    <td class="num tabular-nums">${escapeHtml(w.moisture)}</td>
                    <td class="tabular-nums">${escapeHtml(w.recordedAt)}</td>
                    <td>${statusBadge(w.status)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    function renderFinancierOverview() {
      const acceptedUnpaid = state.invoices.filter((i) => i.buyerAccepted && i.status !== 'Paid').length;
      const requestsCount = state.financingRequests.length;
      const offersCount = state.financingRequests.filter((r) => r.indicativeOffer).length;
      const pendingReviews = state.financingRequests.filter((r) => r.reviewStatus === 'Pending').length;
      const dupCount = state.duplicateAlerts.length;

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Welcome back, ${escapeHtml(currentUser.name)}</p>
            <h2 class="ws-heading">Review accepted agricultural invoices and screen duplicate pledges</h2>
            <p class="ws-subtext">Demo simulation only · No real lending or fund disbursal is executed</p>
          </div>
          <div class="ws-quick-actions">
            <button type="button" class="btn btn-sage btn-sm" data-jump-tab="settlement">Inspect Net Settlement</button>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Accepted Unpaid Invoices</span>
            <strong class="ws-kpi-value tabular-nums">${acceptedUnpaid}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Financing Requests</span>
            <strong class="ws-kpi-value tabular-nums">${requestsCount}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Indicative Offers</span>
            <strong class="ws-kpi-value tabular-nums">${offersCount}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Pending Reviews</span>
            <strong class="ws-kpi-value tabular-nums">${pendingReviews}</strong>
          </article>
        </div>

        <section class="glass-panel ws-section-card ws-warning-panel">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Duplicate Invoice Shield (${dupCount} Alert)</h3>
              <p class="ws-card-subtitle">Automated cross-financier check for repeated invoice identifiers</p>
            </div>
            <div class="ws-inline-check">
              <input type="text" id="ws-dup-check-input" class="form-input ws-input-sm" placeholder="Check Invoice ID (e.g. INV-2026-104)" />
              <button type="button" class="btn btn-sage btn-sm" id="ws-dup-check-btn">Screen ID</button>
            </div>
          </div>
          <div id="ws-dup-check-result" class="ws-dup-banner">
            ${state.duplicateAlerts
              .map(
                (d) => `
              <div class="ws-alert-item ws-alert-item--warn">
                <div class="ws-alert-head">
                  <strong>Warning: Duplicate Identifier ${escapeHtml(d.invoiceId)}</strong>
                  ${statusBadge('Disputed')}
                </div>
                <p>${escapeHtml(d.reason)} Flagged exposure: ${formatCurrency(d.flaggedAmount)}.</p>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Invoice Financing Requests</h3>
              <p class="ws-card-subtitle">Evaluate buyer-accepted invoices and issue indicative demo offers</p>
            </div>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Invoice ID</th>
                  <th>Buyer</th>
                  <th class="num">Amount</th>
                  <th>Buyer Acceptance</th>
                  <th>Due Date</th>
                  <th>Review Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${state.financingRequests
                  .filter((r) => matchesSearch([r.farmer, r.invoiceId, r.buyer, r.reviewStatus]))
                  .map(
                    (r) => `
                  <tr>
                    <td><strong>${escapeHtml(r.farmer)}</strong></td>
                    <td class="tabular-nums">
                      ${escapeHtml(r.invoiceId)}
                      ${r.duplicateWarning ? '<span class="ws-flag-inline">Duplicate Flag</span>' : ''}
                    </td>
                    <td>${escapeHtml(r.buyer)}</td>
                    <td class="num tabular-nums">${formatCurrency(r.amount)}</td>
                    <td>${statusBadge(r.buyerAcceptance)}</td>
                    <td class="tabular-nums">${escapeHtml(r.dueDate)}</td>
                    <td>
                      ${statusBadge(r.reviewStatus)}
                      ${r.indicativeOffer ? `<div class="ws-offer-note tabular-nums">${escapeHtml(r.indicativeOffer)}</div>` : ''}
                    </td>
                    <td>
                      <div class="ws-row-actions">
                        <button type="button" class="btn btn-glass btn-xs" data-fin-evidence="${escapeHtml(r.invoiceId)}">View Evidence</button>
                        <button type="button" class="btn btn-sage btn-xs" data-fin-offer="${escapeHtml(r.id)}">Indicative Offer</button>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    function renderWeatherInsuranceWorkspace() {
      const alertsCount = state.weatherAlerts.length;
      const monitoredLots = state.cropListings.length;
      const thresholdChecks = state.policyThresholds.length;
      const claimsUnderReview = state.insuranceClaims.filter((c) => c.status === 'Pending').length;
      const isInsurer = currentUser.role === 'insurer';

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Sample Climate &amp; Parametric Insurance Data</p>
            <h2 class="ws-heading">Weather &amp; Insurance Intelligence</h2>
            <p class="ws-subtext">Clearly labelled demonstration indicators · No live meteorological or insurer API connected</p>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Weather Risk Alerts</span>
            <strong class="ws-kpi-value tabular-nums">${alertsCount}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Monitored Crop Lots</span>
            <strong class="ws-kpi-value tabular-nums">${monitoredLots}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Policy Threshold Checks</span>
            <strong class="ws-kpi-value tabular-nums">${thresholdChecks}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Claims Under Review</span>
            <strong class="ws-kpi-value tabular-nums">${claimsUnderReview}</strong>
          </article>
        </div>

        <div class="ws-kpi-grid">
          ${state.weatherMetrics
            .map(
              (m) => `
            <article class="glass-subcard">
              <span class="ws-kpi-label">${escapeHtml(m.label)}</span>
              <strong class="ws-kpi-value tabular-nums">${escapeHtml(m.value)}</strong>
              <p class="ws-card-subtitle">${escapeHtml(m.note)}</p>
            </article>
          `
            )
            .join('')}
        </div>

        <div class="ws-two-col">
          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Configured Policy Thresholds</h3>
                <p class="ws-card-subtitle">Parametric climate triggers across insured crop lots</p>
              </div>
            </div>
            <div class="ws-alert-stack">
              ${state.policyThresholds
                .map(
                  (p) => `
                <div class="ws-alert-item">
                  <div class="ws-alert-head">
                    <strong>${escapeHtml(p.id)} · ${escapeHtml(p.title)}</strong>
                    ${statusBadge(p.status)}
                  </div>
                  <p>Trigger: ${escapeHtml(p.trigger)} · Covered Lots: ${escapeHtml(p.coveredLots)}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Crop &amp; Liquidity Risk Notifications</h3>
                <p class="ws-card-subtitle">Sample route advisories and settlement delay coverage</p>
              </div>
            </div>
            <div class="ws-alert-stack">
              ${state.weatherAlerts
                .map(
                  (w) => `
                <div class="ws-alert-item">
                  <div class="ws-alert-head">
                    <strong>${escapeHtml(w.cropLot)}</strong>
                    ${statusBadge(w.severity)}
                  </div>
                  <p>${escapeHtml(w.message)}</p>
                </div>
              `
                )
                .join('')}
              <div class="ws-alert-item">
                <div class="ws-alert-head">
                  <strong>Liquidity Risk Buffer (Sample)</strong>
                  ${statusBadge('Pending')}
                </div>
                <p>One disputed lot (INV-2026-104) paused from settlement batch pending duplicate review.</p>
              </div>
            </div>
          </section>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Insurance Claim Status</h3>
              <p class="ws-card-subtitle">Sample claim assessments linked to weather threshold events</p>
            </div>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Crop Lot</th>
                  <th>Farmer</th>
                  <th>Event Reason</th>
                  <th class="num">Claim Amount</th>
                  <th>Status</th>
                  ${isInsurer ? '<th>Demo Review</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${state.insuranceClaims
                  .map(
                    (c) => `
                  <tr>
                    <td class="tabular-nums"><strong>${escapeHtml(c.id)}</strong></td>
                    <td class="tabular-nums">${escapeHtml(c.lotId)}</td>
                    <td>${escapeHtml(c.farmer)}</td>
                    <td>${escapeHtml(c.reason)}</td>
                    <td class="num tabular-nums">${formatCurrency(c.amount)}</td>
                    <td>${statusBadge(c.status)}</td>
                    ${
                      isInsurer
                        ? `<td>
                            <div class="ws-row-actions">
                              <button type="button" class="btn btn-sage btn-xs" data-claim-action="Approved" data-claim-id="${escapeHtml(c.id)}">Approve</button>
                              <button type="button" class="btn btn-glass btn-xs" data-claim-action="Rejected" data-claim-id="${escapeHtml(c.id)}">Reject</button>
                            </div>
                          </td>`
                        : ''
                    }
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    function renderSmartSettlementWorkspace() {
      const netting = computeNetting(state.obligations);
      const pendingBatches = state.settlementBatches.filter((b) => b.status === 'Pending').length;
      const totalReceivables = netting.participantRows
        .filter((r) => r.net > 0)
        .reduce((sum, r) => sum + r.net, 0);
      const totalPayables = netting.participantRows
        .filter((r) => r.net < 0)
        .reduce((sum, r) => sum + Math.abs(r.net), 0);

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Proposed Calculation &amp; Approval Workflow</p>
            <h2 class="ws-heading">Smart Settlement &amp; Circular Netting Engine</h2>
            <p class="ws-subtext">Demonstrates multilateral netting across agricultural trade obligations · No real bank transfers occur</p>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Total Receivables (Net)</span>
            <strong class="ws-kpi-value tabular-nums">${formatCurrency(totalReceivables)}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Total Payables (Net)</span>
            <strong class="ws-kpi-value tabular-nums">${formatCurrency(totalPayables)}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Pending Settlement Batches</span>
            <strong class="ws-kpi-value tabular-nums">${pendingBatches}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Proposed Net Settlement</span>
            <strong class="ws-kpi-value tabular-nums">${formatCurrency(netting.netTotal)}</strong>
          </article>
        </div>

        <div class="ws-two-col">
          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Financial Obligations Table</h3>
                <p class="ws-card-subtitle">Circular obligations across Buyer, Farmer, Transporter &amp; Warehouse</p>
              </div>
            </div>
            <div class="ws-table-wrap">
              <table class="ws-table">
                <thead>
                  <tr>
                    <th>Participant A (Owes)</th>
                    <th>Participant B (Receives)</th>
                    <th class="num">Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.obligations
                    .map(
                      (o) => `
                    <tr>
                      <td><strong>${escapeHtml(o.from)}</strong></td>
                      <td>${escapeHtml(o.to)}</td>
                      <td class="num tabular-nums">${formatCurrency(o.amount)}</td>
                      <td class="tabular-nums">${escapeHtml(o.ref)}</td>
                      <td>${statusBadge(o.status)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Smart Netting Calculator</h3>
                <p class="ws-card-subtitle">Add a sample obligation to recalculate gross vs proposed net settlement</p>
              </div>
            </div>

            <form class="ws-netting-form" id="ws-add-obligation-form">
              <input type="text" id="obl-from" class="form-input ws-input-sm" placeholder="Participant A (Payer)" required />
              <input type="text" id="obl-to" class="form-input ws-input-sm" placeholder="Participant B (Payee)" required />
              <input type="number" id="obl-amount" class="form-input ws-input-sm" placeholder="Amount ($)" min="1" required />
              <button type="submit" class="btn btn-sage btn-sm">Add &amp; Net</button>
            </form>

            <div class="ws-netting-summary">
              <div class="ws-netting-stat">
                <span>Gross Obligations</span>
                <strong class="tabular-nums">${formatCurrency(netting.grossTotal)}</strong>
              </div>
              <div class="ws-netting-stat">
                <span>Proposed Net Settlement</span>
                <strong class="tabular-nums">${formatCurrency(netting.netTotal)}</strong>
              </div>
              <div class="ws-netting-stat ws-netting-stat--accent">
                <span>Liquidity Offset Saved</span>
                <strong class="tabular-nums">${formatCurrency(netting.saved)}</strong>
              </div>
            </div>

            <h4 class="ws-mini-heading">Net Position After Multilateral Netting</h4>
            <div class="ws-net-positions">
              ${netting.participantRows
                .map((row) => {
                  const isCreditor = row.net >= 0;
                  return `
                  <div class="ws-net-row">
                    <span>${escapeHtml(row.participant)}</span>
                    <strong class="tabular-nums ${isCreditor ? 'text-sage' : 'text-amber'}">
                      ${isCreditor ? 'Receives ' : 'Owes '}${formatCurrency(Math.abs(row.net))}
                    </strong>
                  </div>
                `;
                })
                .join('')}
            </div>

            <h4 class="ws-mini-heading">Proposed Net Settlement Transfers</h4>
            <div class="ws-net-transfers">
              ${netting.netTransfers
                .map(
                  (t) => `
                <div class="ws-transfer-chip">
                  <span>${escapeHtml(t.from)} &rarr; ${escapeHtml(t.to)}</span>
                  <strong class="tabular-nums">${formatCurrency(t.amount)}</strong>
                </div>
              `
                )
                .join('')}
            </div>
          </section>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Settlement Batches</h3>
              <p class="ws-card-subtitle">Review proposed net batches and run a demonstration approval</p>
            </div>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Participants</th>
                  <th class="num">Gross</th>
                  <th class="num">Proposed Net</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${state.settlementBatches
                  .map(
                    (b) => `
                  <tr>
                    <td class="tabular-nums"><strong>${escapeHtml(b.id)}</strong></td>
                    <td>${escapeHtml(b.participants)}</td>
                    <td class="num tabular-nums">${formatCurrency(b.grossAmount)}</td>
                    <td class="num tabular-nums"><strong>${formatCurrency(b.netAmount)}</strong></td>
                    <td>${statusBadge(b.status)}</td>
                    <td>
                      <div class="ws-row-actions">
                        <button type="button" class="btn btn-glass btn-xs" data-review-batch="${escapeHtml(b.id)}">Review Settlement</button>
                        <button type="button" class="btn btn-sage btn-xs" data-approve-batch="${escapeHtml(b.id)}" ${b.status === 'Completed' ? 'disabled' : ''}>
                          ${b.status === 'Completed' ? 'Approved' : 'Approve Demo'}
                        </button>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    function renderAdminOverview() {
      const participantsCount = state.adminParticipants.length;
      const tradeRecords = state.transactions.length;
      const invoiceRecords = state.invoices.length;
      const pendingDisputes = state.disputeVault.filter((d) => d.status === 'Disputed').length;

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Network Operations · Isolated Console</p>
            <h2 class="ws-heading">Administrator Workspace</h2>
            <p class="ws-subtext">Monitor participants, trade verification hashes, disputes, and duplicate alerts (sample data)</p>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Registered Participants</span>
            <strong class="ws-kpi-value tabular-nums">${participantsCount}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Total Trade Records</span>
            <strong class="ws-kpi-value tabular-nums">${tradeRecords}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Invoice Records</span>
            <strong class="ws-kpi-value tabular-nums">${invoiceRecords}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Pending Disputes</span>
            <strong class="ws-kpi-value tabular-nums">${pendingDisputes}</strong>
          </article>
        </div>

        <div class="ws-two-col">
          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Participant Management</h3>
                <p class="ws-card-subtitle">Approve or review onboarded stakeholder accounts</p>
              </div>
            </div>
            <div class="ws-table-wrap">
              <table class="ws-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Role</th>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.adminParticipants
                    .map(
                      (p) => `
                    <tr>
                      <td><strong>${escapeHtml(p.name)}</strong></td>
                      <td>${escapeHtml(p.role)}</td>
                      <td>${escapeHtml(p.org)}</td>
                      <td>${statusBadge(p.status)}</td>
                      <td>
                        <button type="button" class="btn btn-glass btn-xs" data-toggle-participant="${escapeHtml(p.id)}">
                          ${p.status === 'Approved' ? 'Mark Pending' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div>
                <h3 class="ws-card-title">Network Activity Analytics (Sample)</h3>
                <p class="ws-card-subtitle">Weekly verified trade &amp; invoice volume</p>
              </div>
            </div>
            <div class="ws-chart-bars" aria-label="Sample weekly trade volume bar chart">
              ${[
                { label: 'Mon', val: 48 },
                { label: 'Tue', val: 66 },
                { label: 'Wed', val: 58 },
                { label: 'Thu', val: 82 },
                { label: 'Fri', val: 94 },
                { label: 'Sat', val: 72 },
              ]
                .map(
                  (bar) => `
                <div class="ws-bar-col">
                  <div class="ws-bar-track">
                    <div class="ws-bar-fill" style="height: ${bar.val}%"></div>
                  </div>
                  <span class="ws-bar-label">${bar.label}</span>
                </div>
              `
                )
                .join('')}
            </div>
            <div class="ws-alert-item ws-alert-item--warn">
              <div class="ws-alert-head">
                <strong>Duplicate Record Alert</strong>
                ${statusBadge('Disputed')}
              </div>
              <p>INV-2026-104 flagged for overlapping invoice fingerprint; settlement paused.</p>
            </div>
          </section>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Sample Verification Log</h3>
              <p class="ws-card-subtitle">Demonstration audit hashes (no live blockchain network)</p>
            </div>
          </div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead>
                <tr>
                  <th>Sample Tx Hash</th>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${state.verificationLogs
                  .map(
                    (log) => `
                  <tr>
                    <td class="mono tabular-nums">${escapeHtml(log.txHash)}</td>
                    <td>${escapeHtml(log.event)}</td>
                    <td>${escapeHtml(log.actor)}</td>
                    <td class="tabular-nums">${escapeHtml(log.timestamp)}</td>
                    <td>${statusBadge(log.status)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    function renderCropListingsTable(listings, mode) {
      if (!listings.length) {
        return '<p class="ws-empty-note">No crop listings match your current search.</p>';
      }
      return `
        <div class="ws-table-wrap">
          <table class="ws-table">
            <thead>
              <tr>
                <th>Lot ID</th>
                <th>Crop</th>
                <th class="num">Quantity</th>
                <th>Quality Grade</th>
                <th>Location</th>
                <th class="num">Expected Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${listings
                .map(
                  (c) => `
                <tr>
                  <td class="tabular-nums"><strong>${escapeHtml(c.id)}</strong></td>
                  <td>${escapeHtml(c.crop)}</td>
                  <td class="num tabular-nums">${c.quantity} ${escapeHtml(c.unit)}</td>
                  <td>${escapeHtml(c.grade)}</td>
                  <td>${escapeHtml(c.location)}</td>
                  <td class="num tabular-nums">${formatCurrency(c.pricePerMt)}/${escapeHtml(c.unit)}</td>
                  <td>${statusBadge(c.status)}</td>
                  <td>
                    <div class="ws-row-actions">
                      <button type="button" class="btn btn-glass btn-xs" data-view-crop="${escapeHtml(c.id)}">View Details</button>
                      ${
                        mode === 'buyer'
                          ? `<button type="button" class="btn btn-sage btn-xs" data-create-po="${escapeHtml(c.id)}">Create PO</button>`
                          : ''
                      }
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderInvoicesTable(invoices, mode) {
      if (!invoices.length) {
        return '<p class="ws-empty-note">No invoices match the selected filter.</p>';
      }
      return `
        <div class="ws-table-wrap">
          <table class="ws-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>${mode === 'buyer' ? 'Farmer' : 'Buyer'}</th>
                <th class="num">Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices
                .map(
                  (inv) => `
                <tr>
                  <td class="tabular-nums">
                    <strong>${escapeHtml(inv.id)}</strong>
                    ${inv.duplicateFlag ? '<span class="ws-flag-inline">Duplicate Alert</span>' : ''}
                  </td>
                  <td>${escapeHtml(mode === 'buyer' ? inv.farmer : inv.buyer)}</td>
                  <td class="num tabular-nums">${formatCurrency(inv.amount)}</td>
                  <td class="tabular-nums">${escapeHtml(inv.dueDate)}</td>
                  <td>${statusBadge(inv.status)}</td>
                  <td>
                    <div class="ws-row-actions">
                      <button type="button" class="btn btn-glass btn-xs" data-view-invoice="${escapeHtml(inv.id)}">Details</button>
                      ${
                        mode === 'buyer' && inv.status === 'Pending'
                          ? `<button type="button" class="btn btn-sage btn-xs" data-approve-invoice="${escapeHtml(inv.id)}">Approve</button>
                             <button type="button" class="btn btn-glass btn-xs" data-dispute-invoice="${escapeHtml(inv.id)}">Dispute</button>`
                          : ''
                      }
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderTransactionsView() {
      const filteredTxns = state.transactions.filter((t) =>
        matchesSearch([t.id, t.crop, t.parties, t.status])
      );

      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">End-to-End Trade Lifecycle</p>
            <h2 class="ws-heading">My Transactions &amp; Crop-to-Cash Timeline</h2>
            <p class="ws-subtext">Track each trade from Crop Listed through Agreement, Shipment, Delivery, Invoice, and Settlement</p>
          </div>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Featured Trade Journey: ${escapeHtml(state.transactions[0].id)} (${escapeHtml(state.transactions[0].crop)})</h3>
              <p class="ws-card-subtitle">${escapeHtml(state.transactions[0].parties)}</p>
            </div>
            ${statusBadge(state.transactions[0].status)}
          </div>
          ${renderTimelineStepper(state.transactions[0].stageIndex)}
        </section>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">All Transaction Records</h3>
              <p class="ws-card-subtitle">Select any trade to inspect its milestone timeline</p>
            </div>
          </div>
          ${
            !filteredTxns.length
              ? '<p class="ws-empty-note">No transactions match your search.</p>'
              : `<div class="ws-table-wrap">
                  <table class="ws-table">
                    <thead>
                      <tr>
                        <th>Trade ID</th>
                        <th>Crop</th>
                        <th>Participants</th>
                        <th class="num">Value</th>
                        <th>Current Stage</th>
                        <th>Status</th>
                        <th>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredTxns
                        .map(
                          (t) => `
                        <tr>
                          <td class="tabular-nums"><strong>${escapeHtml(t.id)}</strong></td>
                          <td>${escapeHtml(t.crop)}</td>
                          <td>${escapeHtml(t.parties)}</td>
                          <td class="num tabular-nums">${formatCurrency(t.amount)}</td>
                          <td>${escapeHtml(TIMELINE_STEPS[t.stageIndex] || 'In Progress')}</td>
                          <td>${statusBadge(t.status)}</td>
                          <td><button type="button" class="btn btn-glass btn-xs" data-view-txn="${escapeHtml(t.id)}">Timeline</button></td>
                        </tr>
                      `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
          }
        </section>
      `;
    }

    function renderDisputesView() {
      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Immutable Chronological Audit Trail</p>
            <h2 class="ws-heading">Dispute Evidence Vault</h2>
            <p class="ws-subtext">Agreement records, delivery acknowledgements, quality reports, invoice approvals, and dispute updates</p>
          </div>
          <div class="ws-quick-actions">
            <button type="button" class="btn btn-sage btn-sm" id="ws-add-evidence-btn">+ Add Evidence Note</button>
          </div>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-vault-list">
            ${state.disputeVault
              .filter((item) => matchesSearch([item.category, item.ref, item.summary, item.status]))
              .map(
                (item) => `
              <article class="ws-vault-item">
                <div class="ws-vault-meta">
                  <span class="tabular-nums">${escapeHtml(item.timestamp)}</span>
                  <strong>${escapeHtml(item.category)}</strong>
                  <span class="ws-vault-ref tabular-nums">${escapeHtml(item.ref)}</span>
                  ${statusBadge(item.status)}
                </div>
                <p class="ws-vault-summary">${escapeHtml(item.summary)}</p>
              </article>
            `
              )
              .join('')}
          </div>
        </section>
      `;
    }

    function renderPassportView() {
      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Portable Agricultural Trade Reputation</p>
            <h2 class="ws-heading">Farmer Financial Passport</h2>
            <p class="ws-subtext">Verified seasonal deliveries, accepted invoices, and completed payout history</p>
          </div>
        </div>

        <div class="ws-kpi-grid">
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Verified Seasonal Sales</span>
            <strong class="ws-kpi-value tabular-nums">14 Trades</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Accepted Invoices</span>
            <strong class="ws-kpi-value tabular-nums">${state.invoices.filter((i) => i.buyerAccepted).length}</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Settled Volume</span>
            <strong class="ws-kpi-value tabular-nums">$118,400</strong>
          </article>
          <article class="glass-card ws-kpi-card">
            <span class="ws-kpi-label">Fulfillment Consistency</span>
            <strong class="ws-kpi-value tabular-nums">98.2%</strong>
          </article>
        </div>

        <section class="glass-panel ws-section-card">
          <div class="ws-card-header">
            <div>
              <h3 class="ws-card-title">Verified Settlement History</h3>
              <p class="ws-card-subtitle">Records shared with participating financiers upon farmer consent</p>
            </div>
          </div>
          ${renderInvoicesTable(state.invoices, 'farmer')}
        </section>
      `;
    }

    function renderSettingsView() {
      const roleCfg = ROLE_CONFIG[currentUser.role] || ROLE_CONFIG.farmer;
      return `
        <div class="ws-welcome-banner glass-panel">
          <div>
            <p class="ws-kicker">Demo Workspace Preferences</p>
            <h2 class="ws-heading">Profile &amp; Settings</h2>
            <p class="ws-subtext">Signed in as ${escapeHtml(currentUser.name)} (${escapeHtml(roleCfg.label)})</p>
          </div>
          <div class="ws-quick-actions">
            <button type="button" class="btn btn-glass btn-sm" id="ws-settings-logout">Logout</button>
          </div>
        </div>

        <div class="ws-two-col">
          <section class="glass-panel ws-section-card">
            <h3 class="ws-card-title">Account Summary (Demo Session)</h3>
            <div class="ws-profile-rows">
              <div><span>Full Name</span><strong>${escapeHtml(currentUser.name)}</strong></div>
              <div><span>Email</span><strong>${escapeHtml(currentUser.email)}</strong></div>
              <div><span>Active Role</span><strong>${escapeHtml(roleCfg.label)}</strong></div>
              <div><span>Organization</span><strong>${escapeHtml(roleCfg.org)}</strong></div>
            </div>
          </section>

          <section class="glass-panel ws-section-card">
            <h3 class="ws-card-title">Switch Stakeholder Role (Demo)</h3>
            <p class="ws-card-subtitle">Preview how navigation and modules adapt for other AgriSettleX participants.</p>
            <div class="ws-role-switch-grid">
              ${Object.values(ROLE_CONFIG)
                .map(
                  (r) => `
                <button type="button" class="btn ${r.key === currentUser.role ? 'btn-sage' : 'btn-glass'} btn-sm" data-switch-role="${escapeHtml(r.key)}">
                  ${escapeHtml(r.label)}
                </button>
              `
                )
                .join('')}
            </div>
          </section>
        </div>
      `;
    }

    function renderMain() {
      if (!currentUser || !elements.mainContent) {
        return;
      }

      let html = '';
      if (currentTab === 'overview') {
        if (currentUser.role === 'farmer') {
          html = renderFarmerOverview();
        } else if (currentUser.role === 'buyer') {
          html = renderBuyerOverview();
        } else if (currentUser.role === 'transporter' || currentUser.role === 'warehouse') {
          html = renderTransporterWarehouseOverview();
        } else if (currentUser.role === 'financier') {
          html = renderFinancierOverview();
        } else if (currentUser.role === 'insurer') {
          html = renderWeatherInsuranceWorkspace();
        } else if (currentUser.role === 'admin') {
          html = renderAdminOverview();
        }
      } else if (currentTab === 'listings') {
        const filtered = state.cropListings.filter((c) =>
          matchesSearch([c.id, c.crop, c.grade, c.location, c.farmer])
        );
        html = `
          <div class="ws-welcome-banner glass-panel">
            <div>
              <p class="ws-kicker">Harvest Marketplace</p>
              <h2 class="ws-heading">Crop Listings</h2>
              <p class="ws-subtext">Browse or manage verified crop harvests</p>
            </div>
            ${
              currentUser.role === 'farmer'
                ? '<button type="button" class="btn btn-sage btn-sm" id="ws-open-add-listing">+ Add Crop Listing</button>'
                : ''
            }
          </div>
          <section class="glass-panel ws-section-card">
            ${renderCropListingsTable(filtered, currentUser.role === 'buyer' ? 'buyer' : 'farmer')}
          </section>
        `;
      } else if (currentTab === 'agreements') {
        const filtered = state.agreements.filter((a) =>
          matchesSearch([a.id, a.crop, a.farmer, a.buyer, a.status])
        );
        html = `
          <div class="ws-welcome-banner glass-panel">
            <div>
              <p class="ws-kicker">Trade Commitments</p>
              <h2 class="ws-heading">Purchase Agreements</h2>
              <p class="ws-subtext">Agreed quantities, pricing, and delivery confirmations</p>
            </div>
          </div>
          <section class="glass-panel ws-section-card">
            <div class="ws-table-wrap">
              <table class="ws-table">
                <thead>
                  <tr>
                    <th>Agreement #</th>
                    <th>Farmer</th>
                    <th>Buyer</th>
                    <th>Crop</th>
                    <th class="num">Agreed Qty</th>
                    <th class="num">Total Value</th>
                    <th>Agreement Status</th>
                    <th>Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map(
                      (a) => `
                    <tr>
                      <td class="tabular-nums"><strong>${escapeHtml(a.id)}</strong></td>
                      <td>${escapeHtml(a.farmer)}</td>
                      <td>${escapeHtml(a.buyer)}</td>
                      <td>${escapeHtml(a.crop)}</td>
                      <td class="num tabular-nums">${a.quantity} MT</td>
                      <td class="num tabular-nums">${formatCurrency(a.priceTotal)}</td>
                      <td>${statusBadge(a.status)}</td>
                      <td>${statusBadge(a.deliveryStatus)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>
        `;
      } else if (currentTab === 'invoices') {
        const filtered = state.invoices.filter((inv) => {
          const statusOk = invoiceFilter === 'All' || inv.status === invoiceFilter;
          return statusOk && matchesSearch([inv.id, inv.farmer, inv.buyer, inv.status]);
        });
        html = `
          <div class="ws-welcome-banner glass-panel">
            <div>
              <p class="ws-kicker">Digital Trade Billing</p>
              <h2 class="ws-heading">Invoices</h2>
              <p class="ws-subtext">Inspect status, buyer acceptance, and duplicate shield checks</p>
            </div>
          </div>
          <section class="glass-panel ws-section-card">
            <div class="ws-card-header">
              <div class="ws-filter-pills">
                ${['All', 'Pending', 'Accepted', 'Paid', 'Disputed']
                  .map(
                    (st) => `
                  <button type="button" class="ws-filter-pill ${invoiceFilter === st ? 'is-active' : ''}" data-inv-filter="${st}">
                    ${st}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
            ${renderInvoicesTable(filtered, currentUser.role === 'buyer' ? 'buyer' : 'farmer')}
          </section>
        `;
      } else if (currentTab === 'settlement') {
        html = renderSmartSettlementWorkspace();
      } else if (currentTab === 'weather-insurance') {
        html = renderWeatherInsuranceWorkspace();
      } else if (currentTab === 'passport') {
        html = renderPassportView();
      } else if (currentTab === 'transactions') {
        html = renderTransactionsView();
      } else if (currentTab === 'disputes') {
        html = renderDisputesView();
      } else if (currentTab === 'settings') {
        html = renderSettingsView();
      }

      elements.mainContent.innerHTML = html;
      bindMainInteractions();
    }

    function bindMainInteractions() {
      const root = elements.mainContent;
      if (!root) {
        return;
      }

      root.querySelectorAll('[data-jump-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentTab = btn.getAttribute('data-jump-tab');
          renderSidebar();
          renderMain();
        });
      });

      root.querySelectorAll('[data-inv-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          invoiceFilter = btn.getAttribute('data-inv-filter');
          renderMain();
        });
      });

      // Add Crop Listing Modal (Farmer)
      [document.getElementById('ws-open-add-listing'), document.getElementById('ws-add-listing-inline')].forEach(
        (btn) => {
          if (!btn) {
            return;
          }
          btn.addEventListener('click', () => {
            openWsModal(
              'Crop Inventory',
              'Add Sample Crop Listing',
              `
                <form class="ws-modal-form" id="ws-add-crop-form">
                  <div class="form-field">
                    <label class="form-label" for="crop-name">Crop Name</label>
                    <input class="form-input" id="crop-name" required placeholder="e.g. Organic Mustard Seed" />
                  </div>
                  <div class="ws-form-row">
                    <div class="form-field">
                      <label class="form-label" for="crop-qty">Quantity (MT)</label>
                      <input class="form-input" id="crop-qty" type="number" min="1" required placeholder="25" />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for="crop-price">Expected Price ($/MT)</label>
                      <input class="form-input" id="crop-price" type="number" min="1" required placeholder="620" />
                    </div>
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="crop-grade">Quality Grade</label>
                    <input class="form-input" id="crop-grade" required placeholder="Grade A · 11.5% Moisture" />
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="crop-location">Location</label>
                    <input class="form-input" id="crop-location" required placeholder="Alwar, Rajasthan" />
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-glass" id="ws-modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-sage">Save Crop Listing</button>
                  </div>
                </form>
              `,
              (body) => {
                body.querySelector('#ws-modal-cancel').addEventListener('click', closeWsModal);
                body.querySelector('#ws-add-crop-form').addEventListener('submit', (e) => {
                  e.preventDefault();
                  const crop = body.querySelector('#crop-name').value.trim();
                  const quantity = Number(body.querySelector('#crop-qty').value);
                  const pricePerMt = Number(body.querySelector('#crop-price').value);
                  const grade = body.querySelector('#crop-grade').value.trim();
                  const location = body.querySelector('#crop-location').value.trim();
                  if (!crop || quantity <= 0 || pricePerMt <= 0 || !grade || !location) {
                    return;
                  }
                  const newId = 'CRP-' + (405 + state.cropListings.length);
                  state.cropListings.unshift({
                    id: newId,
                    crop,
                    quantity,
                    unit: 'MT',
                    grade,
                    location,
                    pricePerMt,
                    farmer: currentUser.name,
                    status: 'Active',
                  });
                  pushNotification('Crop Listing', `Added new lot ${newId}: ${crop} (${quantity} MT).`);
                  closeWsModal();
                  renderMain();
                  showToast(`Crop listing ${newId} added.`);
                });
              }
            );
          });
        }
      );

      // View Financial Passport Modal
      [document.getElementById('ws-open-passport-btn'), document.getElementById('ws-open-passport-card')].forEach(
        (btn) => {
          if (!btn) {
            return;
          }
          btn.addEventListener('click', () => {
            openWsModal(
              'Verified Reputation',
              'Farmer Financial Passport',
              `
                <p class="modal-description">Portable trade record for <strong>${escapeHtml(currentUser.name)}</strong> showing verified harvest deliveries and invoice settlement history.</p>
                <div class="ws-passport-summary">
                  <div><span class="ws-kpi-label">Verified Sales</span><strong>14 Lots</strong></div>
                  <div><span class="ws-kpi-label">Accepted Invoices</span><strong>${state.invoices.filter((i) => i.buyerAccepted).length}</strong></div>
                  <div><span class="ws-kpi-label">Settled Total</span><strong>$118,400</strong></div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-sage" id="ws-modal-ok">Close Passport</button>
                </div>
              `,
              (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
            );
          });
        }
      );

      // View Crop Details
      root.querySelectorAll('[data-view-crop]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-view-crop');
          const crop = state.cropListings.find((c) => c.id === id);
          if (!crop) {
            return;
          }
          openWsModal(
            'Crop Lot Record',
            `${crop.id} · ${crop.crop}`,
            `
              <div class="ws-profile-rows">
                <div><span>Producer</span><strong>${escapeHtml(crop.farmer)}</strong></div>
                <div><span>Quantity</span><strong>${crop.quantity} ${escapeHtml(crop.unit)}</strong></div>
                <div><span>Quality Grade</span><strong>${escapeHtml(crop.grade)}</strong></div>
                <div><span>Location</span><strong>${escapeHtml(crop.location)}</strong></div>
                <div><span>Expected Price</span><strong>${formatCurrency(crop.pricePerMt)} / ${escapeHtml(crop.unit)}</strong></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-sage" id="ws-modal-ok">Close</button>
              </div>
            `,
            (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
          );
        });
      });

      // Buyer: Create Purchase Order
      root.querySelectorAll('[data-create-po]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-create-po');
          const crop = state.cropListings.find((c) => c.id === id);
          if (!crop) {
            return;
          }
          openWsModal(
            'Procurement',
            `Create Purchase Order · ${crop.crop}`,
            `
              <form class="ws-modal-form" id="ws-po-form">
                <p class="modal-description">Farmer: <strong>${escapeHtml(crop.farmer)}</strong> · Available: ${crop.quantity} MT at ${formatCurrency(crop.pricePerMt)}/MT</p>
                <div class="form-field">
                  <label class="form-label" for="po-qty">Order Quantity (MT)</label>
                  <input class="form-input" id="po-qty" type="number" min="1" max="${crop.quantity}" value="${crop.quantity}" required />
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-glass" id="ws-modal-cancel">Cancel</button>
                  <button type="submit" class="btn btn-sage">Issue Purchase Order</button>
                </div>
              </form>
            `,
            (body) => {
              body.querySelector('#ws-modal-cancel').addEventListener('click', closeWsModal);
              body.querySelector('#ws-po-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const qty = Number(body.querySelector('#po-qty').value);
                if (qty <= 0) {
                  return;
                }
                const newAgrId = 'AGR-' + (884 + state.agreements.length);
                state.agreements.unshift({
                  id: newAgrId,
                  crop: crop.crop,
                  farmer: crop.farmer,
                  buyer: currentUser.name,
                  quantity: qty,
                  expectedQty: qty,
                  receivedQty: qty,
                  priceTotal: qty * crop.pricePerMt,
                  status: 'Approved',
                  deliveryStatus: 'Pending Verification',
                  deliveryConfirmed: false,
                });
                pushNotification('New Purchase Order', `Issued ${newAgrId} for ${qty} MT of ${crop.crop}.`);
                closeWsModal();
                renderMain();
                showToast(`Purchase Order ${newAgrId} created.`);
              });
            }
          );
        });
      });

      // Buyer: Confirm Delivery & Report Discrepancy
      root.querySelectorAll('[data-confirm-delivery]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-confirm-delivery');
          const agr = state.agreements.find((a) => a.id === id);
          if (!agr) {
            return;
          }
          agr.deliveryConfirmed = true;
          agr.deliveryStatus = 'Delivered';
          pushNotification('Delivery Confirmation', `Delivery confirmed for ${agr.id} (${agr.crop}).`);
          renderMain();
          showToast(`Delivery confirmed for ${agr.id}.`);
        });
      });

      root.querySelectorAll('[data-report-discrepancy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-report-discrepancy');
          const agr = state.agreements.find((a) => a.id === id);
          if (!agr) {
            return;
          }
          agr.deliveryStatus = 'Disputed';
          state.disputeVault.unshift({
            id: 'EVD-' + (10 + state.disputeVault.length),
            timestamp: '2026-11-27 11:30',
            category: 'Dispute Update',
            ref: agr.id,
            summary: `Buyer reported quantity/grade variance on ${agr.crop} (${agr.receivedQty}/${agr.expectedQty} MT).`,
            status: 'Disputed',
          });
          pushNotification('Dispute Update', `Discrepancy logged on ${agr.id}.`);
          renderMain();
          showToast(`Discrepancy recorded in Evidence Vault for ${agr.id}.`);
        });
      });

      // Buyer: Approve / Dispute Invoice
      root.querySelectorAll('[data-approve-invoice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-approve-invoice');
          const inv = state.invoices.find((i) => i.id === id);
          if (!inv) {
            return;
          }
          inv.status = 'Accepted';
          inv.buyerAccepted = true;
          pushNotification('Invoice Approval', `Invoice ${inv.id} approved for ${formatCurrency(inv.amount)}.`);
          renderMain();
          showToast(`Invoice ${inv.id} approved.`);
        });
      });

      root.querySelectorAll('[data-dispute-invoice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-dispute-invoice');
          const inv = state.invoices.find((i) => i.id === id);
          if (!inv) {
            return;
          }
          inv.status = 'Disputed';
          inv.buyerAccepted = false;
          pushNotification('Dispute Update', `Invoice ${inv.id} marked as Disputed.`);
          renderMain();
          showToast(`Invoice ${inv.id} flagged as Disputed.`);
        });
      });

      // View Invoice Details
      root.querySelectorAll('[data-view-invoice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-view-invoice');
          const inv = state.invoices.find((i) => i.id === id);
          if (!inv) {
            return;
          }
          openWsModal(
            'Invoice Record',
            inv.id,
            `
              <div class="ws-profile-rows">
                <div><span>Agreement</span><strong>${escapeHtml(inv.agreementId)}</strong></div>
                <div><span>Farmer</span><strong>${escapeHtml(inv.farmer)}</strong></div>
                <div><span>Buyer</span><strong>${escapeHtml(inv.buyer)}</strong></div>
                <div><span>Amount</span><strong>${formatCurrency(inv.amount)}</strong></div>
                <div><span>Due Date</span><strong>${escapeHtml(inv.dueDate)}</strong></div>
                <div><span>Sample Hash</span><strong class="mono">${escapeHtml(inv.hash)}</strong></div>
                <div><span>Status</span>${statusBadge(inv.status)}</div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-sage" id="ws-modal-ok">Close</button>
              </div>
            `,
            (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
          );
        });
      });

      // Transporter / Warehouse Shipment updates & Receipt entry
      root.querySelectorAll('[data-shipment-select]').forEach((select) => {
        select.addEventListener('change', () => {
          const id = select.getAttribute('data-shipment-select');
          const shp = state.shipments.find((s) => s.id === id);
          if (!shp) {
            return;
          }
          shp.status = select.value;
          pushNotification('Shipment Update', `Shipment ${shp.id} updated to ${shp.status}.`);
          renderMain();
          showToast(`Shipment ${shp.id} status: ${shp.status}`);
        });
      });

      root.querySelectorAll('[data-confirm-shipment]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-confirm-shipment');
          const shp = state.shipments.find((s) => s.id === id);
          if (!shp) {
            return;
          }
          shp.status = 'Delivered';
          shp.confirmed = true;
          pushNotification('Delivery Confirmation', `Shipment ${shp.id} delivery confirmed.`);
          renderMain();
          showToast(`Shipment ${shp.id} confirmed delivered.`);
        });
      });

      [document.getElementById('ws-open-add-whr'), document.getElementById('ws-add-whr-inline')].forEach((btn) => {
        if (!btn) {
          return;
        }
        btn.addEventListener('click', () => {
          openWsModal(
            'Warehouse Custody',
            'Add Sample Warehouse Receipt',
            `
              <form class="ws-modal-form" id="ws-whr-form">
                <div class="form-field">
                  <label class="form-label" for="whr-crop">Crop Name</label>
                  <input class="form-input" id="whr-crop" required placeholder="e.g. Yellow Soybean" />
                </div>
                <div class="ws-form-row">
                  <div class="form-field">
                    <label class="form-label" for="whr-qty">Received Qty (MT)</label>
                    <input class="form-input" id="whr-qty" required placeholder="35.0 MT" />
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="whr-moisture">Moisture Reading</label>
                    <input class="form-input" id="whr-moisture" required placeholder="11.1%" />
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-glass" id="ws-modal-cancel">Cancel</button>
                  <button type="submit" class="btn btn-sage">Record Receipt</button>
                </div>
              </form>
            `,
            (body) => {
              body.querySelector('#ws-modal-cancel').addEventListener('click', closeWsModal);
              body.querySelector('#ws-whr-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const crop = body.querySelector('#whr-crop').value.trim();
                const quantity = body.querySelector('#whr-qty').value.trim();
                const moisture = body.querySelector('#whr-moisture').value.trim();
                if (!crop || !quantity || !moisture) {
                  return;
                }
                const receiptId = 'WHR-' + (9014 + state.warehouseReceipts.length);
                state.warehouseReceipts.unshift({
                  receiptId,
                  crop,
                  lotId: 'CRP-403',
                  quantity,
                  moisture,
                  recordedAt: '2026-11-27 12:05',
                  status: 'Verified',
                });
                closeWsModal();
                renderMain();
                showToast(`Warehouse receipt ${receiptId} added.`);
              });
            }
          );
        });
      });

      // Smart Settlement: Add obligation & Batch review/approve
      const oblForm = document.getElementById('ws-add-obligation-form');
      if (oblForm) {
        oblForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const from = document.getElementById('obl-from').value.trim();
          const to = document.getElementById('obl-to').value.trim();
          const amount = Number(document.getElementById('obl-amount').value);
          if (!from || !to || amount <= 0 || from.toLowerCase() === to.toLowerCase()) {
            showToast('Enter two distinct participants and a positive amount.');
            return;
          }
          state.obligations.push({
            id: 'OBL-' + (state.obligations.length + 1),
            from,
            to,
            amount,
            ref: 'REF-' + (400 + state.obligations.length),
            status: 'Approved',
          });
          renderMain();
          showToast('Obligation added and multilateral netting recalculated.');
        });
      }

      root.querySelectorAll('[data-review-batch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-review-batch');
          const batch = state.settlementBatches.find((b) => b.id === id);
          if (!batch) {
            return;
          }
          const netting = computeNetting(state.obligations);
          openWsModal(
            'Proposed Net Settlement Review',
            batch.id,
            `
              <p class="modal-description">Participants: <strong>${escapeHtml(batch.participants)}</strong></p>
              <div class="ws-passport-summary">
                <div><span class="ws-kpi-label">Gross Obligations</span><strong>${formatCurrency(batch.grossAmount)}</strong></div>
                <div><span class="ws-kpi-label">Proposed Net</span><strong>${formatCurrency(batch.netAmount)}</strong></div>
                <div><span class="ws-kpi-label">Status</span>${statusBadge(batch.status)}</div>
              </div>
              <p class="ws-card-subtitle">Note: Demonstration calculation only. No live bank settlement or transfer is triggered.</p>
              <div class="ws-net-transfers">
                ${netting.netTransfers
                  .map(
                    (t) => `<div class="ws-transfer-chip"><span>${escapeHtml(t.from)} &rarr; ${escapeHtml(t.to)}</span><strong>${formatCurrency(t.amount)}</strong></div>`
                  )
                  .join('')}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-glass" id="ws-modal-ok">Close</button>
              </div>
            `,
            (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
          );
        });
      });

      root.querySelectorAll('[data-approve-batch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-approve-batch');
          const batch = state.settlementBatches.find((b) => b.id === id);
          if (!batch) {
            return;
          }
          batch.status = 'Completed';
          pushNotification('Settlement Update', `Demo settlement batch ${batch.id} marked Completed.`);
          renderMain();
          showToast(`Demo settlement ${batch.id} approved.`);
        });
      });

      // Financier: Duplicate check + Evidence + Indicative offer
      const dupCheckBtn = document.getElementById('ws-dup-check-btn');
      if (dupCheckBtn) {
        dupCheckBtn.addEventListener('click', () => {
          const input = document.getElementById('ws-dup-check-input');
          const resultBox = document.getElementById('ws-dup-check-result');
          const queryId = (input ? input.value.trim().toUpperCase() : '') || 'INV-2026-104';
          const isDup = state.duplicateAlerts.some((d) => d.invoiceId.toUpperCase() === queryId) || queryId === 'INV-2026-104';
          if (resultBox) {
            resultBox.innerHTML = isDup
              ? `<div class="ws-alert-item ws-alert-item--warn"><div class="ws-alert-head"><strong>Duplicate Detected: ${escapeHtml(queryId)}</strong>${statusBadge('Disputed')}</div><p>Matching invoice hash already pledged in system; financing blocked for safety.</p></div>`
              : `<div class="ws-alert-item"><div class="ws-alert-head"><strong>Clear: ${escapeHtml(queryId)}</strong>${statusBadge('Approved')}</div><p>No duplicate invoice identifier found in current demo registry.</p></div>`;
          }
        });
      }

      root.querySelectorAll('[data-fin-evidence]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const invId = btn.getAttribute('data-fin-evidence');
          const inv = state.invoices.find((i) => i.id === invId);
          openWsModal(
            'Invoice Evidence Package',
            invId,
            `
              <p class="modal-description">Verified trade evidence linked to <strong>${escapeHtml(invId)}</strong>.</p>
              ${renderTimelineStepper(inv && inv.buyerAccepted ? 4 : 2)}
              <div class="modal-footer">
                <button type="button" class="btn btn-sage" id="ws-modal-ok">Close Evidence</button>
              </div>
            `,
            (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
          );
        });
      });

      root.querySelectorAll('[data-fin-offer]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const reqId = btn.getAttribute('data-fin-offer');
          const req = state.financingRequests.find((r) => r.id === reqId);
          if (!req) {
            return;
          }
          openWsModal(
            'Demo Financing Offer',
            `Indicative Offer · ${req.invoiceId}`,
            `
              <form class="ws-modal-form" id="ws-offer-form">
                <p class="modal-description">Farmer: <strong>${escapeHtml(req.farmer)}</strong> · Invoice Amount: ${formatCurrency(req.amount)}</p>
                <div class="ws-form-row">
                  <div class="form-field">
                    <label class="form-label" for="offer-advance">Advance Ratio (%)</label>
                    <input class="form-input" id="offer-advance" type="number" min="50" max="95" value="80" required />
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="offer-rate">Indicative Fee (%)</label>
                    <input class="form-input" id="offer-rate" type="number" step="0.1" min="0.5" max="10" value="1.8" required />
                  </div>
                </div>
                <p class="ws-card-subtitle">Demonstration only · No actual lending or disbursal occurs.</p>
                <div class="modal-footer">
                  <button type="button" class="btn btn-glass" id="ws-modal-cancel">Cancel</button>
                  <button type="submit" class="btn btn-sage">Send Indicative Offer</button>
                </div>
              </form>
            `,
            (body) => {
              body.querySelector('#ws-modal-cancel').addEventListener('click', closeWsModal);
              body.querySelector('#ws-offer-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const adv = body.querySelector('#offer-advance').value;
                const fee = body.querySelector('#offer-rate').value;
                req.reviewStatus = 'Offer Sent';
                req.indicativeOffer = `${adv}% advance · ${fee}% fee`;
                pushNotification('Financing Review', `Indicative offer sent for ${req.invoiceId}.`);
                closeWsModal();
                renderMain();
                showToast(`Indicative offer logged for ${req.invoiceId}.`);
              });
            }
          );
        });
      });

      // Insurer claims review
      root.querySelectorAll('[data-claim-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const status = btn.getAttribute('data-claim-action');
          const id = btn.getAttribute('data-claim-id');
          const claim = state.insuranceClaims.find((c) => c.id === id);
          if (!claim) {
            return;
          }
          claim.status = status;
          renderMain();
          showToast(`Claim ${claim.id} updated to ${status}.`);
        });
      });

      // Admin participant toggle
      root.querySelectorAll('[data-toggle-participant]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle-participant');
          const p = state.adminParticipants.find((item) => item.id === id);
          if (!p) {
            return;
          }
          p.status = p.status === 'Approved' ? 'Pending' : 'Approved';
          renderMain();
          showToast(`${p.name} status set to ${p.status}.`);
        });
      });

      // Transaction Timeline detail modal
      root.querySelectorAll('[data-view-txn]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-view-txn');
          const txn = state.transactions.find((t) => t.id === id);
          if (!txn) {
            return;
          }
          openWsModal(
            'Crop-to-Cash Journey',
            `${txn.id} · ${txn.crop}`,
            `
              <p class="modal-description">${escapeHtml(txn.parties)} · ${formatCurrency(txn.amount)}</p>
              ${renderTimelineStepper(txn.stageIndex)}
              <div class="modal-footer">
                <button type="button" class="btn btn-sage" id="ws-modal-ok">Close</button>
              </div>
            `,
            (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
          );
        });
      });

      // Dispute Evidence Vault note
      const addEvdBtn = document.getElementById('ws-add-evidence-btn');
      if (addEvdBtn) {
        addEvdBtn.addEventListener('click', () => {
          openWsModal(
            'Evidence Vault',
            'Add Chronological Evidence Entry',
            `
              <form class="ws-modal-form" id="ws-evd-form">
                <div class="form-field">
                  <label class="form-label" for="evd-ref">Reference ID</label>
                  <input class="form-input" id="evd-ref" required placeholder="e.g. INV-2026-104" />
                </div>
                <div class="form-field">
                  <label class="form-label" for="evd-summary">Evidence Note</label>
                  <textarea class="form-input form-textarea" id="evd-summary" rows="3" required placeholder="Describe inspection or dispute update..."></textarea>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-glass" id="ws-modal-cancel">Cancel</button>
                  <button type="submit" class="btn btn-sage">Append Record</button>
                </div>
              </form>
            `,
            (body) => {
              body.querySelector('#ws-modal-cancel').addEventListener('click', closeWsModal);
              body.querySelector('#ws-evd-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const ref = body.querySelector('#evd-ref').value.trim();
                const summary = body.querySelector('#evd-summary').value.trim();
                if (!ref || !summary) {
                  return;
                }
                state.disputeVault.unshift({
                  id: 'EVD-' + (10 + state.disputeVault.length),
                  timestamp: '2026-11-27 12:18',
                  category: 'Dispute Update',
                  ref,
                  summary,
                  status: 'Pending',
                });
                closeWsModal();
                renderMain();
                showToast('Evidence entry added to Dispute Vault.');
              });
            }
          );
        });
      }

      // Settings: switch role & logout
      root.querySelectorAll('[data-switch-role]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextRole = btn.getAttribute('data-switch-role');
          if (ROLE_CONFIG[nextRole]) {
            currentUser.role = nextRole;
            currentTab = 'overview';
            renderTopbar();
            renderSidebar();
            renderMain();
            showToast(`Switched demo view to ${ROLE_CONFIG[nextRole].workspaceTitle}.`);
          }
        });
      });

      const settingsLogout = document.getElementById('ws-settings-logout');
      if (settingsLogout) {
        settingsLogout.addEventListener('click', onLogout);
      }
    }

    function initStaticShellListeners() {
      if (elements.searchInput) {
        elements.searchInput.addEventListener('input', () => {
          searchQuery = elements.searchInput.value.trim();
          renderMain();
        });
      }

      if (elements.notifBtn && elements.notifDrawer) {
        elements.notifBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const willOpen = elements.notifDrawer.hidden;
          elements.notifDrawer.hidden = !willOpen;
          if (elements.userDropdown) {
            elements.userDropdown.hidden = true;
          }
        });
      }

      if (elements.markAllReadBtn) {
        elements.markAllReadBtn.addEventListener('click', () => {
          state.notifications.forEach((n) => {
            n.read = true;
          });
          renderNotifications();
        });
      }

      if (elements.helpBtn) {
        elements.helpBtn.addEventListener('click', () => {
          openWsModal(
            'Workspace Guide',
            'AgriSettleX Demo Environment',
            `
              <p class="modal-description">
                This interactive workspace demonstrates role-based agricultural trade, invoice verification,
                multilateral netting settlement, and climate/insurance monitoring using sample browser-session data.
              </p>
              <ul class="modal-list">
                <li>Use the left sidebar to navigate modules tailored to your stakeholder role.</li>
                <li>Use the top search bar to filter crop listings, invoices, and transactions live.</li>
                <li>Switch roles anytime from Settings or the user profile menu.</li>
              </ul>
              <div class="modal-footer">
                <button type="button" class="btn btn-sage" id="ws-modal-ok">Got It</button>
              </div>
            `,
            (body) => body.querySelector('#ws-modal-ok').addEventListener('click', closeWsModal)
          );
        });
      }

      if (elements.userMenuTrigger && elements.userDropdown) {
        elements.userMenuTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          elements.userDropdown.hidden = !elements.userDropdown.hidden;
          if (elements.notifDrawer) {
            elements.notifDrawer.hidden = true;
          }
        });
      }

      document.getElementById('ws-dropdown-profile')?.addEventListener('click', () => {
        if (elements.userDropdown) {
          elements.userDropdown.hidden = true;
        }
        currentTab = 'settings';
        renderSidebar();
        renderMain();
      });

      document.getElementById('ws-dropdown-logout')?.addEventListener('click', () => {
        if (elements.userDropdown) {
          elements.userDropdown.hidden = true;
        }
        onLogout();
      });

      document.addEventListener('click', (e) => {
        if (elements.notifDrawer && !elements.notifDrawer.hidden && !elements.notifDrawer.contains(e.target) && !elements.notifBtn.contains(e.target)) {
          elements.notifDrawer.hidden = true;
        }
        if (elements.userDropdown && !elements.userDropdown.hidden && !elements.userDropdown.contains(e.target) && !elements.userMenuTrigger.contains(e.target)) {
          elements.userDropdown.hidden = true;
        }
      });

      if (elements.sidebarToggle && elements.sidebar && elements.sidebarOverlay) {
        elements.sidebarToggle.addEventListener('click', () => {
          const isOpen = elements.sidebar.classList.toggle('is-open');
          elements.sidebarOverlay.hidden = !isOpen;
          elements.sidebarToggle.setAttribute('aria-expanded', String(isOpen));
        });
        elements.sidebarOverlay.addEventListener('click', closeSidebarMobile);
      }

      if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeWsModal);
      }

      if (elements.modalBackdrop) {
        elements.modalBackdrop.addEventListener('click', (e) => {
          if (e.target === elements.modalBackdrop) {
            closeWsModal();
          }
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modalBackdrop && !elements.modalBackdrop.hidden) {
          closeWsModal();
        }
      });
    }

    initStaticShellListeners();

    return {
      mount(user) {
        state = createInitialState();
        currentUser = { ...user };
        currentTab = 'overview';
        searchQuery = '';
        invoiceFilter = 'All';
        if (elements.searchInput) {
          elements.searchInput.value = '';
        }
        renderTopbar();
        renderSidebar();
        renderNotifications();
        renderMain();
      },
      reset() {
        currentUser = null;
        closeWsModal();
        closeSidebarMobile();
      },
    };
  }

  window.AgriSettleX = window.AgriSettleX || {};
  window.AgriSettleX.createWorkspaceController = createWorkspaceController;
})();
