/**
 * FDM Helper - Popup Logic (ESM)
 */

import api from './browser-compat.js';

let allStreams = [];
let cart = new Set();
let cartMode = false;

function updateCartUI() {
    const btnCart  = document.getElementById('btn-show-cart');
    const btnDl    = document.getElementById('btn-dl-selected');
    const btnClear = document.getElementById('btn-clear-cart');
    const btnScan  = document.getElementById('btn-scan-page');
    const selected = cart.size;
    const total    = allStreams.length;

    if (btnCart)  btnCart.textContent = `Panier (${total})`;
    if (btnDl)    { btnDl.textContent = `Télécharger (${selected})`; btnDl.style.display = selected > 0 ? '' : 'none'; }
    if (btnClear) btnClear.style.display = selected > 0 ? '' : 'none';
    if (btnScan)  btnScan.style.display  = cartMode ? 'none' : '';
}

function formatSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024)       return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

const STATUS_UI = {
    pending:          { cls: 'pending',  label: 'En attente' },
    sent_to_fdm:      { cls: 'sent',     label: 'Envoyé à FDM' },
    fallback_browser: { cls: 'fallback', label: 'Navigateur' },
    completed:        { cls: 'completed',label: 'Terminé' },
    failed:           { cls: 'failed',   label: 'Échec' }
};

let statusByUrl = new Map();

async function loadDownloadStatuses() {
    const data = await api.storage.local.get('downloadHistory');
    statusByUrl = new Map();
    (data.downloadHistory || []).forEach(e => {
        if (!statusByUrl.has(e.url)) statusByUrl.set(e.url, e.status);
    });
}

function applyPill(pill, status) {
    const ui = STATUS_UI[status];
    pill.className = 'status-pill';
    if (!ui) { pill.style.display = 'none'; pill.textContent = ''; return; }
    pill.style.display = 'inline-flex';
    pill.classList.add(ui.cls);
    pill.textContent = ui.label;
}

function refreshPills() {
    document.querySelectorAll('.status-pill[data-url]').forEach(pill => {
        applyPill(pill, statusByUrl.get(pill.dataset.url));
    });
}

async function loadStreams() {
    try {
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) headerTitle.innerText = api.i18n.getMessage("popupTitle") || "FDM Stream Capture";

        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;

        const currentTab = tabs[0];
        const tabId = currentTab.id;
        const currentUrl = currentTab.url || "";

        allStreams = await api.runtime.sendMessage({
            type: "GET_STREAMS",
            tabId: tabId,
            tabUrl: currentUrl,
            tabTitle: currentTab.title
        }) || [];

        await loadDownloadStatuses();
        renderStreams(allStreams);

    } catch (err) {
        console.error("Popup Error:", err);
        const listDiv = document.getElementById('stream-list');
        if (listDiv) {
            listDiv.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty';
            const p = document.createElement('p');
            p.textContent = `Erreur: ${err.message || "Impossible de charger"}`;
            emptyDiv.appendChild(p);
            listDiv.appendChild(emptyDiv);
        }
    }
}

function renderStreams(streams) {
    const streamList = document.getElementById('stream-list');
    if (!streamList) return;
    streamList.replaceChildren();

    if (streams.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty';
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "1.5");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", "5 3 19 12 5 21 5 3");
        svg.appendChild(poly);
        const p = document.createElement('p');
        p.textContent = api.i18n.getMessage("emptyMsg") || "Aucun flux détecté";
        emptyDiv.appendChild(svg);
        emptyDiv.appendChild(p);
        streamList.appendChild(emptyDiv);
        return;
    }

    const groups = {
        'youtube': streams.filter(s => s.type === 'youtube'),
        'manifests': streams.filter(s => s.type === 'manifests'),
        'videos': streams.filter(s => s.type === 'videos'),
        'segments': streams.filter(s => s.type === 'segments')
    };

    const others = streams.filter(s => !['youtube', 'manifests', 'videos', 'segments'].includes(s.type));

    const groupConfig = [
        { key: 'youtube', label: api.i18n.getMessage("groupYoutube") || "YouTube", items: groups.youtube },
        { key: 'manifests', label: api.i18n.getMessage("groupManifests") || "HLS/DASH", items: groups.manifests },
        { key: 'videos', label: api.i18n.getMessage("groupVideos") || "Vidéos", items: groups.videos },
        { key: 'segments', label: api.i18n.getMessage("groupSegments") || "Segments", items: groups.segments },
        { key: 'others', label: api.i18n.getMessage("groupOthers") || "Autres", items: others }
    ].filter(g => g.items.length > 0);

    groupConfig.forEach(group => addTimelineSection(streamList, group.label, group.items, group.key));
    attachEvents();
}

function addTimelineSection(container, title, items, type) {
    const section = document.createElement('div');
    section.className = 'tl-section';

    const label = document.createElement('div');
    label.className = 'tl-label';
    label.textContent = `${title} · ${items.length}`;
    section.appendChild(label);

    items.forEach((stream, index) => {
        const item = document.createElement('div');
        item.className = 'tl-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const card = document.createElement('div');
        card.className = 'tl-card';

        const header = document.createElement('div');
        header.className = 'tl-card-header';

        const badge = document.createElement('span');
        const typeLabels = { youtube: 'YT', manifests: 'HLS', videos: 'MP4', segments: 'SEG', others: 'FILE' };
        badge.className = `tl-type-badge ${stream.type || 'others'}`;
        badge.textContent = typeLabels[stream.type] || 'FILE';
        
        const time = document.createElement('span');
        time.className = 'tl-time';
        time.textContent = new Date(stream.timestamp).toLocaleTimeString();

        const pill = document.createElement('span');
        pill.className = 'status-pill';
        pill.dataset.url = stream.url;
        applyPill(pill, statusByUrl.get(stream.url));

        const meta = document.createElement('div');
        meta.className = 'tl-card-meta';
        meta.appendChild(pill);
        meta.appendChild(time);

        header.appendChild(badge);
        header.appendChild(meta);
        card.appendChild(header);

        const stitle = document.createElement('div');
        stitle.className = 'tl-title';
        stitle.textContent = stream.title || "Vidéo détectée";
        card.appendChild(stitle);

        const actions = document.createElement('div');
        actions.className = 'tl-actions';

        const cbWrapper = document.createElement('label');
        cbWrapper.className = 'checkbox-wrapper';
        cbWrapper.style.cssText = 'position:absolute;top:10px;right:10px;display:none;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'cb-batch';
        cb.checked = cart.has(stream.url);
        const cbVisual = document.createElement('span');
        cbVisual.className = 'cb-visual';
        cb.onchange = () => {
            if (cb.checked) cart.add(stream.url); else cart.delete(stream.url);
            updateCartUI();
        };
        cbWrapper.appendChild(cb);
        cbWrapper.appendChild(cbVisual);
        card.appendChild(cbWrapper);
        card.dataset.cbWrapper = '';
        card._cbWrapper = cbWrapper;

        // Feature 2 — taille fichier
        if (stream.size && stream.size > 0) {
            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'tl-size';
            sizeSpan.textContent = formatSize(stream.size);
            meta.insertBefore(sizeSpan, meta.firstChild);
        }

        const dlBtn = document.createElement('button');
        dlBtn.className = 'tl-btn tl-btn-dl';
        dlBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> FDM';

        const sendDirect = (url) => {
            statusByUrl.set(url, 'pending');
            applyPill(pill, 'pending');
            dlBtn.disabled = true;
            setTimeout(() => { dlBtn.disabled = false; }, 1500);
            api.runtime.sendMessage({
                type: "SEND_TO_FDM",
                url,
                filename: stream.title,
                referer: stream.pageUrl || "",
                isYoutube: stream.type === 'youtube'
            });
        };

        // Feature 3 — sélecteur qualité HLS
        const isHLS = stream.type === 'manifests' && stream.url.toLowerCase().includes('.m3u8');
        const qualityContainer = document.createElement('div');
        qualityContainer.className = 'quality-picker';
        qualityContainer.style.display = 'none';

        dlBtn.onclick = async () => {
            if (!isHLS) { sendDirect(stream.url); return; }
            dlBtn.disabled = true;
            qualityContainer.style.display = '';
            qualityContainer.innerHTML = '<span class="quality-loading">Analyse du flux…</span>';
            const { variants } = await api.runtime.sendMessage({
                type: 'PARSE_HLS_MANIFEST',
                url: stream.url,
                referer: stream.pageUrl || ''
            });
            if (!variants || variants.length <= 1) {
                qualityContainer.style.display = 'none';
                dlBtn.disabled = false;
                sendDirect(stream.url);
                return;
            }
            const label = document.createElement('span');
            label.className = 'quality-picker-label';
            label.textContent = 'Choisir la qualité';
            const list = document.createElement('div');
            list.className = 'quality-list';
            variants.forEach((v, i) => {
                const qBtn = document.createElement('button');
                qBtn.className = 'quality-btn' + (i === 0 ? ' best' : '');
                const mbps = (v.bandwidth / 1000000).toFixed(1);
                qBtn.textContent = v.resolution ? `${v.resolution}` : `${mbps} Mbps`;
                qBtn.title = `${mbps} Mbps`;
                qBtn.onclick = () => {
                    qualityContainer.style.display = 'none';
                    dlBtn.disabled = false;
                    sendDirect(v.url);
                };
                list.appendChild(qBtn);
            });
            qualityContainer.innerHTML = '';
            qualityContainer.appendChild(label);
            qualityContainer.appendChild(list);
        };

        actions.appendChild(dlBtn);
        card.appendChild(actions);
        card.appendChild(qualityContainer);
        item.appendChild(card);
        container.appendChild(item);
    });
}

function setCartMode(enabled) {
    cartMode = enabled;
    document.querySelectorAll('.tl-card').forEach(card => {
        if (card._cbWrapper) card._cbWrapper.style.display = enabled ? '' : 'none';
    });
    updateCartUI();
}

function attachEvents() {
    const settingsBtn = document.getElementById('open-settings');
    if (settingsBtn) settingsBtn.onclick = () => api.runtime.openOptionsPage();

    const btnScan = document.getElementById('btn-scan-page');
    if (btnScan) btnScan.onclick = () => api.runtime.sendMessage({ type: 'SCAN_HIDDEN_STREAMS' });

    const btnCart = document.getElementById('btn-show-cart');
    if (btnCart) btnCart.onclick = () => setCartMode(!cartMode);

    const btnDl = document.getElementById('btn-dl-selected');
    if (btnDl) btnDl.onclick = () => {
        if (cart.size === 0) return;
        const items = allStreams
            .filter(s => cart.has(s.url))
            .map(s => ({ url: s.url, filename: s.title, referer: s.pageUrl || '', isYoutube: s.type === 'youtube' }));
        api.runtime.sendMessage({ type: 'SEND_BATCH_TO_FDM', items });
        allStreams.filter(s => cart.has(s.url)).forEach(s => {
            statusByUrl.set(s.url, 'pending');
        });
        refreshPills();
        cart.clear();
        setCartMode(false);
    };

    const btnClear = document.getElementById('btn-clear-cart');
    if (btnClear) btnClear.onclick = () => {
        cart.clear();
        document.querySelectorAll('.cb-batch').forEach(cb => { cb.checked = false; });
        setCartMode(false);
    };

    updateCartUI();
}

api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.downloadHistory) return;
    const history = changes.downloadHistory.newValue || [];
    statusByUrl = new Map();
    history.forEach(e => { if (!statusByUrl.has(e.url)) statusByUrl.set(e.url, e.status); });
    refreshPills();
});

document.addEventListener('DOMContentLoaded', loadStreams);