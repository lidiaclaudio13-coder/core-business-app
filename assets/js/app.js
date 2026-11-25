'use strict';

import { renderActivateScreen, renderAuthScreen, renderProfileView } from './modules/auth.js?ver=3.3.0';
import { renderClientsView } from './modules/clients.js?ver=3.3.0';
import { renderClientBookView, renderClientBookingsView, renderClientDashboard } from './modules/dashboard-client.js?ver=3.3.0';
import { renderStaffDashboard } from './modules/dashboard-staff.js?ver=3.3.0';
import { renderOwnerHomeView } from './modules/owner-home.js?ver=3.3.0';
import { renderShopManageView } from './modules/shop-manage.js?ver=3.3.0';
import { renderStaffView } from './modules/staff.js?ver=3.3.0';

const config = window.CBA_CONFIG || {};

const state = {
    nonce: config.nonce || '',
    authenticated: Boolean(config.authenticated),
    user: null,
    brand: config.brand || {},
    nav: [],
    currentPath: window.location.pathname,
    manageBookingCode: new URLSearchParams(window.location.search).get('manage_booking') || ''
};

const ICONS = {
    home: '<span class="material-symbols-outlined">spa</span>',
    calendar: '<span class="material-symbols-outlined">calendar_month</span>',
    'plus-circle': '<span class="material-symbols-outlined">add_circle</span>',
    users: '<span class="material-symbols-outlined">group</span>',
    scissors: '<span class="material-symbols-outlined">content_cut</span>',
    badge: '<span class="material-symbols-outlined">workspace_premium</span>',
    store: '<span class="material-symbols-outlined">storefront</span>',
    user: '<span class="material-symbols-outlined">account_circle</span>'
};

const ROLE_LABELS = {
    administrator: 'Super Admin',
    business_owner: 'Titolare',
    business_staff: 'Staff',
    business_client: 'Area Cliente',
    guest: 'Area Riservata'
};

export function showToast(message, durationMs = 3200) {
    const container = document.getElementById('cba-toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'cba-toast';
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
        el.remove();
    }, durationMs);
}

export async function apiFetch(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('X-WP-Nonce', state.nonce);
    if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const baseRestUrl = config.restUrl || '/wp-json/core-app/v1/';
    const normalizedBase = baseRestUrl.endsWith('/') ? baseRestUrl : `${baseRestUrl}/`;
    const cleanEndpoint = endpoint.replace(/^\/+/, '');

    const response = await fetch(`${normalizedBase}${cleanEndpoint}`, {
        ...options,
        headers,
        credentials: 'same-origin'
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error(data.message || `Errore di comunicazione con il server (HTTP ${response.status}).`);
        err.code = data.code || '';
        err.data = data.data || {};
        err.status = response.status;
        throw err;
    }

    return data;
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
        });
    }
}

function setupConnectivityAndInstallBanners() {
    const offlineBanner = document.getElementById('cba-offline-banner');
    const syncNetwork = () => {
        if (offlineBanner) {
            offlineBanner.hidden = navigator.onLine;
        }
    };
    window.addEventListener('online', syncNetwork);
    window.addEventListener('offline', syncNetwork);
    syncNetwork();

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const dismissed = localStorage.getItem('cba_ios_install_dismissed') === '1';
    const iosBanner = document.getElementById('cba-ios-install-banner');

    if (isIos && !isStandalone && !dismissed && iosBanner) {
        iosBanner.hidden = false;
        document.getElementById('cba-dismiss-ios')?.addEventListener('click', () => {
            iosBanner.hidden = true;
            localStorage.setItem('cba_ios_install_dismissed', '1');
        });
    }
}

function normalizePath(path) {
    return String(path || '/app').replace(/\/+$/, '') || '/app';
}

function applySessionPayload(payload) {
    state.authenticated = Boolean(payload.authenticated);
    state.nonce = payload.nonce || state.nonce;
    state.brand = payload.brand || state.brand;
    state.user = payload.user || null;
    state.nav = payload.nav || [];

    if (!state.authenticated) {
        navigateTo('/app');
        return;
    }

    const currentNormalized = normalizePath(state.currentPath);
    const defaultHome = state.nav[0]?.path || '/app';
    if (currentNormalized === '/app/activate' || currentNormalized === '/app') {
        navigateTo(defaultHome);
    } else {
        renderBottomNav();
        renderCurrentView();
    }
}

function renderBottomNav() {
    const navEl = document.getElementById('cba-bottom-nav');
    if (!navEl) return;

    if (!state.authenticated || !state.nav.length) {
        navEl.hidden = true;
        navEl.innerHTML = '';
        return;
    }

    const currentNormalized = normalizePath(state.currentPath);

    navEl.hidden = false;
    navEl.innerHTML = `
        <div class="cba-bottom-nav__inner">
            ${state.nav.map((item) => {
                const activeClass = currentNormalized === normalizePath(item.path) ? 'is-active' : '';
                const iconHtml = ICONS[item.icon] || ICONS.home;
                return `
                    <button type="button" class="cba-nav-item ${activeClass}" data-path="${item.path}">
                        ${iconHtml}
                        <span>${item.label}</span>
                    </button>
                `;
            }).join('')}
        </div>
    `;

    navEl.querySelectorAll('.cba-nav-item').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetPath = btn.getAttribute('data-path');
            if (targetPath) {
                navigateTo(targetPath);
            }
        });
    });
}

export function navigateTo(path) {
    if (state.currentPath !== path) {
        window.history.pushState({}, '', path);
        state.currentPath = path;
    }
    renderBottomNav();
    renderCurrentView();
}

function renderCurrentView() {
    const viewport = document.getElementById('cba-viewport');
    const roleBadge = document.getElementById('cba-role-badge');
    if (!viewport) return;

    const currentRole = state.user?.role || 'guest';
    if (roleBadge) {
        roleBadge.textContent = ROLE_LABELS[currentRole] || 'Area Riservata';
    }

    const routePath = normalizePath(state.currentPath);

    if (routePath === '/app/activate') {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token') || '';
        renderActivateScreen(viewport, token, applySessionPayload);
        return;
    }

    if (!state.authenticated) {
        renderAuthScreen(viewport, state, applySessionPayload);
        return;
    }

    switch (routePath) {
        case '/app':
            if (currentRole === 'business_client') {
                renderClientDashboard(viewport, state);
            } else if (currentRole === 'business_staff') {
                renderStaffDashboard(viewport, state);
            } else {
                renderOwnerHomeView(viewport, state);
            }
            break;

        case '/app/home':
            if (currentRole === 'business_client') {
                renderClientDashboard(viewport, state);
            } else if (currentRole === 'business_staff') {
                renderStaffDashboard(viewport, state);
            } else {
                renderOwnerHomeView(viewport, state);
            }
            break;

        case '/app/agenda':
            renderStaffDashboard(viewport, state);
            break;

        case '/app/book':
            renderClientBookView(viewport, state);
            break;

        case '/app/bookings':
            renderClientBookingsView(viewport, state);
            break;

        case '/app/staff':
            renderStaffView(viewport, state);
            break;

        case '/app/manage':
        case '/app/services':
            renderShopManageView(viewport, state);
            break;

        case '/app/profile':
            renderProfileView(viewport, state, applySessionPayload);
            break;

        case '/app/clients':
            renderClientsView(viewport, state);
            break;

        default: {
            const activeNav = state.nav.find((item) => normalizePath(item.path) === routePath) || state.nav[0];
            viewport.innerHTML = `
                <section class="cba-card">
                    <span class="cba-pill">${ROLE_LABELS[currentRole] || currentRole}</span>
                    <h2 class="cba-card__title" style="margin-top:12px;">${activeNav ? activeNav.label : 'Panoramica'}</h2>
                    <p class="cba-card__desc" style="margin-top:6px;">Sezione predisposta e collegata alla nuova navigazione.</p>
                </section>
            `;
            break;
        }
    }
}

async function init() {
    registerServiceWorker();
    setupConnectivityAndInstallBanners();

    window.addEventListener('popstate', () => {
        state.currentPath = window.location.pathname;
        renderBottomNav();
        renderCurrentView();
    });

    try {
        const res = await apiFetch('bootstrap');
        if (res.ok && res.data) {
            state.authenticated = Boolean(res.data.authenticated);
            state.nonce = res.data.nonce || state.nonce;
            state.brand = res.data.brand || state.brand;
            state.user = res.data.user || null;
            state.nav = res.data.nav || [];
        }
    } catch (err) {
        showToast(err.message);
    }

    if (state.authenticated && normalizePath(state.currentPath) === '/app' && state.nav[0]?.path && state.nav[0].path !== '/app') {
        navigateTo(state.nav[0].path);
        if (state.manageBookingCode) {
            openManageBookingOverlay(state.manageBookingCode);
        }
        return;
    }

    renderBottomNav();
    renderCurrentView();
    if (state.authenticated && state.manageBookingCode) {
        openManageBookingOverlay(state.manageBookingCode);
    }
}

function escModal(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function openManageBookingOverlay(code) {
    document.getElementById('cba-booking-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cba-booking-overlay';
    overlay.className = 'cba-modal-overlay';
    overlay.innerHTML = `
        <div class="cba-modal-card">
            <div class="cba-skeleton cba-skeleton--title"></div>
            <div class="cba-skeleton cba-skeleton--text"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeOverlay = () => {
        overlay.remove();
        state.manageBookingCode = '';
        const url = new URL(window.location.href);
        if (url.searchParams.has('manage_booking')) {
            url.searchParams.delete('manage_booking');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
    };

    try {
        const res = await apiFetch(`bookings/by-code/${encodeURIComponent(code)}`);
        const b = res?.data;
        if (!b) throw new Error('Appuntamento non trovato.');

        const canAct = b.status === 'pending' || b.status === 'confirmed';
        const isRejected = b.reschedule_status === 'rejected';
        const isPendingReschedule = b.reschedule_status === 'pending';

        overlay.innerHTML = `
            <div class="cba-modal-card">
                <div class="cba-row-between" style="margin-bottom:12px;">
                    <span class="cba-pill">${escModal(b.booking_code)}</span>
                    <button type="button" id="cba-bm-close" class="cba-icon-btn" aria-label="Chiudi">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <h2 class="cba-card__title">${escModal(b.service_name)}</h2>
                <p class="cba-card__desc" style="margin-top:6px;">
                    📅 <strong>${escModal(b.booking_date)}</strong> alle ore <strong>${escModal(b.start_time)}</strong>${b.end_time ? ` – ${escModal(b.end_time)}` : ''}
                </p>
                <p class="cba-card__desc" style="margin-top:2px;">
                    ✂️ Operatrice: <strong>${escModal(b.staff_name)}</strong>
                </p>

                ${isRejected ? `
                    <div class="cba-alert-banner" style="margin-top:14px;flex-direction:column;align-items:flex-start;gap:10px;">
                        <span><strong>Non possiamo modificare perché non siamo disponibili nella fascia richiesta.</strong><br>Vuoi annullare o rimane confermato come inizialmente prenotato?</span>
                        <div style="display:flex;gap:8px;width:100%;">
                            <button type="button" id="cba-bm-keep" class="cba-btn cba-btn--sm" style="flex:1;">Mantieni confermato</button>
                            <button type="button" id="cba-bm-cancel-rejected" class="cba-btn cba-btn--danger cba-btn--sm" style="flex:1;">Annulla appuntamento</button>
                        </div>
                    </div>
                ` : isPendingReschedule ? `
                    <div class="cba-invite-box" style="margin-top:14px;">
                        <strong>Richiesta di modifica inviata</strong>
                        <p class="cba-card__desc" style="margin-top:4px;">
                            In attesa di conferma dal salone per il <strong>${escModal(b.requested_date)}</strong> alle <strong>${escModal(b.requested_time)}</strong>.
                        </p>
                    </div>
                ` : !canAct ? `
                    <div class="cba-empty-box" style="margin-top:14px;">
                        <strong>Stato attuale: ${escModal(b.status)}</strong>
                        <p class="cba-card__desc" style="margin-top:4px;">Questo appuntamento non può più essere modificato.</p>
                    </div>
                ` : `
                    <form id="cba-bm-reschedule-form" class="cba-form" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--cba-border);" novalidate>
                        <h3 class="cba-section-heading" style="font-size:1rem;">Richiedi Modifica</h3>
                        <div class="cba-grid-2">
                            <div class="cba-field">
                                <label class="cba-label" for="bm-date">Nuova Data</label>
                                <input id="bm-date" name="requested_date" type="date" class="cba-input" value="${escModal(b.booking_date)}" required>
                            </div>
                            <div class="cba-field">
                                <label class="cba-label" for="bm-time">Nuovo Orario</label>
                                <input id="bm-time" name="requested_time" type="time" class="cba-input" value="${escModal(b.start_time)}" required>
                            </div>
                        </div>
                        <div class="cba-field">
                            <label class="cba-label" for="bm-note">Nota (opzionale)</label>
                            <input id="bm-note" name="requested_note" type="text" class="cba-input" placeholder="Es. preferenza orario...">
                        </div>
                        <button type="submit" id="cba-bm-req-btn" class="cba-btn">Invia Richiesta di Modifica</button>
                    </form>

                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--cba-border);">
                        <button type="button" id="cba-bm-cancel-btn" class="cba-btn cba-btn--danger">Annulla Appuntamento</button>
                    </div>
                `}
            </div>
        `;

        document.getElementById('cba-bm-close')?.addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });

        document.getElementById('cba-bm-keep')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                await apiFetch(`bookings/${b.id}/reschedule-reply`, {
                    method: 'POST',
                    body: JSON.stringify({ choice: 'keep' })
                });
                showToast('Appuntamento confermato come prenotato!');
                closeOverlay();
                renderCurrentView();
            } catch (err) {
                showToast(err.message);
                btn.disabled = false;
            }
        });

        document.getElementById('cba-bm-cancel-rejected')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                await apiFetch(`bookings/${b.id}/reschedule-reply`, {
                    method: 'POST',
                    body: JSON.stringify({ choice: 'cancel' })
                });
                showToast('Appuntamento annullato.');
                closeOverlay();
                renderCurrentView();
            } catch (err) {
                showToast(err.message);
                btn.disabled = false;
            }
        });

        document.getElementById('cba-bm-reschedule-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('cba-bm-req-btn');
            const fd = new FormData(e.currentTarget);
            btn.disabled = true;
            btn.textContent = 'Invio richiesta...';
            try {
                const r = await apiFetch(`bookings/${b.id}/request-reschedule`, {
                    method: 'POST',
                    body: JSON.stringify({
                        requested_date: fd.get('requested_date'),
                        requested_time: fd.get('requested_time'),
                        requested_note: fd.get('requested_note')
                    })
                });
                showToast(r.data?.message || 'Richiesta di modifica inviata al salone!');
                closeOverlay();
                renderCurrentView();
            } catch (err) {
                showToast(err.message);
                btn.disabled = false;
                btn.textContent = 'Invia Richiesta di Modifica';
            }
        });

        document.getElementById('cba-bm-cancel-btn')?.addEventListener('click', async (e) => {
            if (!window.confirm('Sei sicura di voler annullare questo appuntamento?')) return;
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Annullamento...';
            try {
                await apiFetch(`bookings/${b.id}/status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'cancelled' })
                });
                showToast('Appuntamento annullato.');
                closeOverlay();
                renderCurrentView();
            } catch (err) {
                showToast(err.message);
                btn.disabled = false;
                btn.textContent = 'Annulla Appuntamento';
            }
        });
    } catch (err) {
        showToast(err.message);
        closeOverlay();
    }
}

init();
