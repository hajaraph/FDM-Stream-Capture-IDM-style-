async function loadStreams() {
    try {
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) headerTitle.innerText = api.i18n.getMessage("popupTitle") || "FDM Stream Capture";

        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;

        const currentTab = tabs[0];
        const tabId = currentTab.id;
        const currentUrl = currentTab.url || "";
        const streamList = document.getElementById('stream-list');

        const streams = await api.runtime.sendMessage({ type: "GET_STREAMS", tabId: tabId, tabUrl: currentUrl, tabTitle: currentTab.title }) || [];

        streamList.innerHTML = '';

        if (streams.length === 0) {
            streamList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <p>${api.i18n.getMessage("emptyMsg") || "Aucun flux détecté sur cette page."}<br><span style="font-size:11px;opacity:0.7">Lancez une vidéo pour commencer</span></p>
                </div>
            `;
            return;
        }

        console.log("Flux reçus :", streams);

        const groups = {
            'youtube': streams.filter(s => s.type === 'youtube'),
            'manifests': streams.filter(s => s.type === 'manifests'),
            'videos': streams.filter(s => s.type === 'videos'),
            'segments': streams.filter(s => s.type === 'segments')
        };

        if (groups.youtube.length > 0) addSection(streamList, api.i18n.getMessage("groupYoutube") || "YouTube", groups.youtube, 'youtube');
        if (groups.manifests.length > 0) addSection(streamList, api.i18n.getMessage("groupManifests") || "HLS/DASH", groups.manifests, 'manifests');
        if (groups.videos.length > 0) addSection(streamList, api.i18n.getMessage("groupVideos") || "Vidéos", groups.videos, 'videos');
        if (groups.segments.length > 0) addSection(streamList, api.i18n.getMessage("groupSegments") || "Segments", groups.segments, 'segments');

        const others = streams.filter(s => s.type !== 'youtube' && s.type !== 'manifests' && s.type !== 'videos' && s.type !== 'segments');
        if (others.length > 0) addSection(streamList, api.i18n.getMessage("groupOthers") || "Autres", others, 'others');

        attachEvents();

    } catch (err) {
        console.error("Popup Error:", err);
        const listDiv = document.getElementById('stream-list');
        listDiv.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v4M12 16h.01"></path>
                </svg>
                <p>Erreur: ${err.message || "Impossible de charger les flux"}</p>
            </div>
        `;
    }
}

function addSection(container, title, items, type) {
    const section = document.createElement('div');
    section.className = 'section';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = `${title} · ${items.length}`;
    section.appendChild(label);

    items.forEach(stream => {
        const card = document.createElement('div');
        card.className = 'card';

        const header = document.createElement('div');
        header.className = 'card-header';

        const badge = document.createElement('span');
        badge.className = `badge badge-${stream.type || 'others'}`;
        const labels = {
            youtube: 'YT',
            manifests: 'HLS',
            videos: 'MP4',
            segments: 'SEG',
            others: 'FILE'
        };
        badge.textContent = labels[stream.type] || 'FILE';
        header.appendChild(badge);

        const titleText = document.createElement('div');
        titleText.className = 'card-title';
        titleText.textContent = stream.type === 'youtube' ? 'YouTube HD' : (stream.title || "Vidéo").trim().substring(0, 45);
        header.appendChild(titleText);

        card.appendChild(header);

        const url = document.createElement('div');
        url.className = 'card-url';
        url.textContent = stream.url;
        url.title = stream.url;
        card.appendChild(url);

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn btn-primary';
        dlBtn.setAttribute('data-url', stream.url);
        dlBtn.setAttribute('data-name', stream.title || '');
        dlBtn.setAttribute('data-referer', stream.pageUrl || '');
        dlBtn.setAttribute('data-youtube', stream.type === 'youtube' ? "true" : "false");
        dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Télécharger`;
        actions.appendChild(dlBtn);

        const cpBtn = document.createElement('button');
        cpBtn.className = 'btn btn-secondary';
        cpBtn.setAttribute('data-url', stream.url);
        cpBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copier`;
        actions.appendChild(cpBtn);

        card.appendChild(actions);
        section.appendChild(card);
    });

    container.appendChild(section);
}

function attachEvents() {
    document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target.closest('.btn-primary');
            const url = target.getAttribute('data-url');
            const name = target.getAttribute('data-name');
            const referer = target.getAttribute('data-referer');
            const isYoutube = target.getAttribute('data-youtube') === "true";

            api.runtime.sendMessage({
                type: "SEND_TO_FDM",
                url: url,
                filename: name,
                referer: referer,
                isYoutube: isYoutube
            });
            window.close();
        };
    });

    document.querySelectorAll('.btn-secondary').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target.closest('.btn-secondary');
            const url = target.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(() => {
                const original = target.innerHTML;
                target.classList.add('copied');
                target.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>Copié !`;
                setTimeout(() => {
                    target.innerHTML = original;
                    target.classList.remove('copied');
                }, 1500);
            });
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.textContent = api.i18n.getMessage("popupTitle") || "FDM Stream Capture";

    const settingsBtn = document.getElementById('open-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (api.runtime.openOptionsPage) {
                api.runtime.openOptionsPage();
            } else {
                window.open(api.runtime.getURL('options.html'));
            }
        });
    }

    const btnScan = document.getElementById('btn-scan-page');
    const btnDlSelected = document.getElementById('btn-dl-selected');
    const btnShowCart = document.getElementById('btn-show-cart');
    const btnClearCart = document.getElementById('btn-clear-cart');
    let batchItems = [];

    const strCart = api.i18n.getMessage("strCart") || "Panier";
    const strDlSelected = api.i18n.getMessage("strDlSelected") || "Télécharger sélection";

    if (btnScan) btnScan.textContent = api.i18n.getMessage("btnScanPage") || "Scanner la page";
    if (btnClearCart) btnClearCart.textContent = api.i18n.getMessage("btnClearCart") || "Vider";

    api.runtime.sendMessage({ type: "GET_CATCH_LOG" }).then(log => {
        if (btnShowCart) {
            if (log && log.length > 0) {
                btnShowCart.textContent = `${strCart} (${log.length})`;
            } else {
                btnShowCart.textContent = `${strCart} (0)`;
            }
        }
    }).catch(() => { });

    if (btnShowCart) {
        btnShowCart.addEventListener('click', async () => {
            try {
                const log = await api.runtime.sendMessage({ type: "GET_CATCH_LOG" }) || [];
                batchItems = log.map(s => ({
                    url: s.url,
                    title: s.title || "Vidéo",
                    type: s.type || 'MEDIA',
                    referer: s.pageUrl || ""
                }));
                renderBatchList(batchItems, true);
            } catch (e) { }
        });
    }

    if (btnClearCart) {
        btnClearCart.addEventListener('click', async () => {
            await api.runtime.sendMessage({ type: "CLEAR_CATCH_LOG" });
            batchItems = [];
            if (btnShowCart) btnShowCart.textContent = `${strCart} (0)`;
            if (btnDlSelected) {
                btnDlSelected.textContent = `${strDlSelected} (0)`;
                btnDlSelected.style.display = 'none';
            }
            if (btnClearCart) btnClearCart.style.display = 'none';
            if (btnScan) btnScan.style.display = 'block';
            if (btnShowCart) btnShowCart.style.display = 'block';
            loadStreams();
        });
    }

    if (btnScan) {
        btnScan.addEventListener('click', async () => {
            btnScan.textContent = api.i18n.getMessage("scanInProgress") || "Recherche en cours...";
            try {
                const tabs = await api.tabs.query({ active: true, currentWindow: true });
                if (tabs && tabs[0]) {
                    const response = await api.tabs.sendMessage(tabs[0].id, { type: "SCAN_PAGE" });
                    if (response && response.items) {
                        batchItems = response.items;
                        renderBatchList(batchItems);
                    }
                }
            } catch (e) {
                console.error(e);
                btnScan.textContent = api.i18n.getMessage("scanError") || "Erreur (Rechargez la page)";
                setTimeout(() => btnScan.textContent = api.i18n.getMessage("btnScanPage") || "Scanner la page", 2000);
            }
        });
    }

    if (btnDlSelected) {
        btnDlSelected.addEventListener('click', () => {
            const checkedBoxes = document.querySelectorAll('.checkbox:checked');
            const selectedUrls = Array.from(checkedBoxes).map(cb => cb.value);
            const selectedItems = batchItems.filter(item => selectedUrls.includes(item.url));

            if (selectedItems.length > 0) {
                api.runtime.sendMessage({
                    type: "DOWNLOAD_BATCH",
                    items: selectedItems
                });
                btnDlSelected.textContent = api.i18n.getMessage("cartSentMsg") || "Envoyé !";
                setTimeout(() => window.close(), 1500);
            }
        });
    }

    function renderBatchList(items, isCart = false) {
        const streamList = document.getElementById('stream-list');
        streamList.innerHTML = '';
        if (btnScan) btnScan.style.display = 'none';
        if (btnShowCart) btnShowCart.style.display = 'none';
        if (btnDlSelected) btnDlSelected.style.display = 'block';
        if (isCart && btnClearCart) btnClearCart.style.display = 'block';
        else if (btnClearCart) btnClearCart.style.display = 'none';

        if (items.length === 0) {
            streamList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <path d="M9 12l2 2 4-4"></path>
                    </svg>
                    <p>${api.i18n.getMessage("cartEmptyMsg") || "Aucun média trouvé."}</p>
                </div>
            `;
            return;
        }

        const section = document.createElement('div');
        section.className = 'section';

        const label = document.createElement('div');
        label.className = 'section-label';
        const selMsg = api.i18n.getMessage("cartSelectMsg") || "Sélectionnez les fichiers";
        label.textContent = `${selMsg} · ${items.length}`;
        section.appendChild(label);

        const toggleAll = document.createElement('label');
        toggleAll.className = 'toggle-all';
        const toggleStr = api.i18n.getMessage("cartToggleAll") || "Tout cocher";
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.checked = true;
        toggleCheckbox.id = 'toggle-all';
        toggleCheckbox.className = 'checkbox';
        toggleAll.appendChild(toggleCheckbox);
        toggleAll.appendChild(document.createTextNode(toggleStr));
        section.appendChild(toggleAll);

        const updateCount = () => {
            const checked = document.querySelectorAll('.checkbox:checked').length;
            if (btnDlSelected) btnDlSelected.textContent = `${strDlSelected} (${checked})`;
        };

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card batch';

            const checkDiv = document.createElement('div');
            checkDiv.style.display = 'flex';
            checkDiv.style.alignItems = 'center';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'checkbox';
            cb.value = item.url;
            cb.checked = true;
            checkDiv.appendChild(cb);
            card.appendChild(checkDiv);

            const info = document.createElement('div');
            info.style.flex = '1';
            info.style.overflow = 'hidden';

            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = item.title;
            info.appendChild(title);

            const url = document.createElement('div');
            url.className = 'card-url';
            url.textContent = item.url;
            info.appendChild(url);

            card.appendChild(info);

            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const checkbox = card.querySelector('input');
                    checkbox.checked = !checkbox.checked;
                }
                updateCount();
            });

            section.appendChild(card);
        });

        streamList.appendChild(section);

        document.getElementById('toggle-all').addEventListener('change', (e) => {
            document.querySelectorAll('.checkbox').forEach(cb => cb.checked = e.target.checked);
            updateCount();
        });

        updateCount();
    }

    loadStreams();
});
