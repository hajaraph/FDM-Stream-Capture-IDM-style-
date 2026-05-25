import api from './browser-compat.js';

let currentTabId = null;

async function initSidebar() {
    // Listen for tab activation changes
    api.tabs.onActivated.addListener(activeInfo => {
        currentTabId = activeInfo.tabId;
        refreshStreams();
    });

    // Listen for tab URL updates
    api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tabId === currentTabId && changeInfo.status === 'complete') {
            refreshStreams();
        }
    });

    // Get current active tab on startup
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
        currentTabId = tabs[0].id;
        refreshStreams();
    }

    // Listen for real-time updates from background
    api.runtime.onMessage.addListener((message) => {
        if (message.type === 'STREAMS_UPDATED' && (message.tabId === currentTabId || message.tabId === -1)) {
            refreshStreams();
        }
    });

    // Setup UI actions
    document.getElementById('clear-btn').onclick = async () => {
        if (confirm("Voulez-vous vider le log de capture ?")) {
            await api.runtime.sendMessage({ type: "CLEAR_CATCH_LOG" });
            refreshStreams();
        }
    };

    document.getElementById('settings-btn').onclick = () => {
        api.runtime.openOptionsPage();
    };
}

async function refreshStreams() {
    if (!currentTabId) return;

    try {
        const tab = await api.tabs.get(currentTabId);
        const streams = await api.runtime.sendMessage({
            type: "GET_STREAMS",
            tabId: currentTabId,
            tabUrl: tab.url,
            tabTitle: tab.title
        });

        renderSidebarStreams(streams);
    } catch (e) {
        console.warn("Sidebar refresh error:", e);
    }
}

function renderSidebarStreams(streams) {
    const list = document.getElementById('stream-list');
    list.innerHTML = '';

    if (!streams || streams.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <p>Aucun flux détecté sur cette page</p>
            </div>
        `;
        return;
    }

    const template = document.getElementById('stream-template');
    
    // Grouping
    const groups = {
        'youtube': streams.filter(s => s.type === 'youtube'),
        'manifests': streams.filter(s => s.type === 'manifests'),
        'videos': streams.filter(s => s.type === 'videos'),
        'others': streams.filter(s => !['youtube', 'manifests', 'videos'].includes(s.type))
    };

    const groupOrder = [
        { key: 'youtube', label: 'YouTube' },
        { key: 'manifests', label: 'Playlists HLS/DASH' },
        { key: 'videos', label: 'Vidéos Directes' },
        { key: 'others', label: 'Autres' }
    ];

    groupOrder.forEach(group => {
        const groupItems = groups[group.key];
        if (groupItems && groupItems.length > 0) {
            const label = document.createElement('div');
            label.className = 'group-label';
            label.textContent = group.label;
            list.appendChild(label);

            groupItems.forEach(stream => {
                const clone = template.content.cloneNode(true);
                const card = clone.querySelector('.stream-card');
                
                card.querySelector('.stream-title').textContent = stream.title || "Flux sans titre";
                
                const typeTag = card.querySelector('.type-tag');
                typeTag.textContent = stream.type.toUpperCase();
                typeTag.classList.add(`type-${stream.type}`);
                
                const timeStr = new Date(stream.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                card.querySelector('.stream-time').textContent = timeStr;

                card.onclick = () => {
                    api.runtime.sendMessage({
                        type: "SEND_TO_FDM",
                        url: stream.url,
                        filename: stream.title,
                        referer: stream.pageUrl || "",
                        isYoutube: stream.type === 'youtube'
                    });
                };

                list.appendChild(clone);
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', initSidebar);