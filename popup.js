/**
 * FDM Helper - Popup Logic (ESM)
 */

import api from './browser-compat.js';

let allStreams = [];

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

        header.appendChild(badge);
        header.appendChild(time);
        card.appendChild(header);

        const stitle = document.createElement('div');
        stitle.className = 'tl-title';
        stitle.textContent = stream.title || "Vidéo détectée";
        card.appendChild(stitle);

        const actions = document.createElement('div');
        actions.className = 'tl-actions';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'tl-btn tl-btn-dl';
        dlBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> FDM';
        dlBtn.onclick = () => {
            api.runtime.sendMessage({
                type: "SEND_TO_FDM",
                url: stream.url,
                filename: stream.title,
                referer: stream.pageUrl || "",
                isYoutube: stream.type === 'youtube'
            });
        };

        actions.appendChild(dlBtn);
        card.appendChild(actions);
        item.appendChild(card);
        container.appendChild(item);
    });
}

function attachEvents() {
    const settingsBtn = document.getElementById('open-settings');
    if (settingsBtn) {
        settingsBtn.onclick = () => api.runtime.openOptionsPage();
    }
}

document.addEventListener('DOMContentLoaded', loadStreams);