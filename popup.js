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
            streamList.innerHTML = ''; // Clear list first safely
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

    } catch (err) {
        console.error("Popup Error:", err);
        const listDiv = document.getElementById('stream-list');
        listDiv.textContent = ''; // Clear safely
        
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty';
        const p = document.createElement('p');
        p.textContent = `Erreur: ${err.message || "Impossible de charger"}`;
        emptyDiv.appendChild(p);
        listDiv.appendChild(emptyDiv);
    }
}

function addTimelineSection(container, title, items) {
    const section = document.createElement('div');
    section.className = 'tl-section';

    const line = document.createElement('div');
    line.className = 'tl-line';
    section.appendChild(line);

    const label = document.createElement('div');
    label.className = 'tl-label';
    label.textContent = `${title} · ${items.length}`;
    section.appendChild(label);

    items.forEach(stream => {
        const item = document.createElement('div');
        item.className = 'tl-item';
        item.setAttribute('data-type', stream.type || 'others');

        const dot = document.createElement('div');
        dot.className = 'tl-dot';
        item.appendChild(dot);

        const card = document.createElement('div');
        card.className = 'tl-card';

        const header = document.createElement('div');
        header.className = 'tl-card-header';

        const type = document.createElement('span');
        type.className = 'tl-type';
        const typeLabels = { youtube: 'YT', manifests: 'HLS', videos: 'MP4', segments: 'SEG', others: 'FILE' };
        type.textContent = typeLabels[stream.type] || 'FILE';
        header.appendChild(type);

        const time = document.createElement('span');
        time.className = 'tl-time';
        if (stream.timestamp) {
            const ago = Math.floor((Date.now() - stream.timestamp) / 60000);
            time.textContent = ago < 1 ? 'maintenant' : `${ago}m`;
        } else {
            time.textContent = 'maintenant';
        }
        header.appendChild(time);

        card.appendChild(header);

        const titleText = document.createElement('div');
        titleText.className = 'tl-title';
        titleText.textContent = stream.type === 'youtube' ? 'YouTube HD' : (stream.title || "Vidéo").trim().substring(0, 40);
        titleText.title = stream.title || '';
        card.appendChild(titleText);

        const url = document.createElement('div');
        url.className = 'tl-url';
        url.textContent = stream.url;
        url.title = stream.url;
        card.appendChild(url);

        const actions = document.createElement('div');
        actions.className = 'tl-actions';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'tl-btn tl-btn-dl';
        dlBtn.setAttribute('data-url', stream.url);
        dlBtn.setAttribute('data-name', stream.title || '');
        dlBtn.setAttribute('data-referer', stream.pageUrl || '');
        dlBtn.setAttribute('data-youtube', stream.type === 'youtube' ? "true" : "false");
        
        // Create SVG safely
        const dlSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        dlSvg.setAttribute("viewBox", "0 0 24 24");
        dlSvg.setAttribute("fill", "none");
        dlSvg.setAttribute("stroke", "currentColor");
        dlSvg.setAttribute("stroke-width", "2.5");
        const dlPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        dlPath1.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
        const dlPoly1 = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        dlPoly1.setAttribute("points", "7 10 12 15 17 10");
        const dlLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        dlLine.setAttribute("x1", "12"); dlLine.setAttribute("y1", "15");
        dlLine.setAttribute("x2", "12"); dlLine.setAttribute("y2", "3");
        dlSvg.appendChild(dlPath1); dlSvg.appendChild(dlPoly1); dlSvg.appendChild(dlLine);
        dlBtn.appendChild(dlSvg);
        actions.appendChild(dlBtn);

        const cpBtn = document.createElement('button');
        cpBtn.className = 'tl-btn tl-btn-cp';
        cpBtn.setAttribute('data-url', stream.url);
        
        // Create SVG safely
        const cpSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        cpSvg.setAttribute("viewBox", "0 0 24 24");
        cpSvg.setAttribute("fill", "none");
        cpSvg.setAttribute("stroke", "currentColor");
        cpSvg.setAttribute("stroke-width", "2.5");
        const cpRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        cpRect.setAttribute("x", "9"); cpRect.setAttribute("y", "9");
        cpRect.setAttribute("width", "13"); cpRect.setAttribute("height", "13"); cpRect.setAttribute("rx", "2");
        const cpPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        cpPath.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
        cpSvg.appendChild(cpRect); cpSvg.appendChild(cpPath);
        cpBtn.appendChild(cpSvg);
        actions.appendChild(cpBtn);

        card.appendChild(actions);
        item.appendChild(card);
        section.appendChild(item);
    });

    container.appendChild(section);
}

function attachEvents() {
    document.querySelectorAll('.tl-btn-dl').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target.closest('.tl-btn-dl');
            api.runtime.sendMessage({
                type: "SEND_TO_FDM",
                url: target.getAttribute('data-url'),
                filename: target.getAttribute('data-name'),
                referer: target.getAttribute('data-referer'),
                isYoutube: target.getAttribute('data-youtube') === "true"
            });
            window.close();
        };
    });

    document.querySelectorAll('.tl-btn-cp').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target.closest('.tl-btn-cp');
            navigator.clipboard.writeText(target.getAttribute('data-url')).then(() => {
                target.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>`;
                setTimeout(() => {
                    target.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
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
            if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
            else window.open(api.runtime.getURL('options.html'));
        });
    }

    const btnScan = document.getElementById('btn-scan-page');
    const btnDlSelected = document.getElementById('btn-dl-selected');
    const btnShowCart = document.getElementById('btn-show-cart');
    const btnClearCart = document.getElementById('btn-clear-cart');
    let batchItems = [];

    const strCart = api.i18n.getMessage("strCart") || "Panier";
    const strDlSelected = api.i18n.getMessage("strDlSelected") || "Télécharger sélection";

    if (btnScan) btnScan.textContent = api.i18n.getMessage("btnScanPage") || "Scanner";
    if (btnClearCart) btnClearCart.textContent = api.i18n.getMessage("btnClearCart") || "Vider";

    api.runtime.sendMessage({ type: "GET_CATCH_LOG" }).then(log => {
        if (btnShowCart) btnShowCart.textContent = log && log.length > 0 ? `${strCart} (${log.length})` : `${strCart} (0)`;
    }).catch(() => { });

    if (btnShowCart) {
        btnShowCart.addEventListener('click', async () => {
            try {
                const log = await api.runtime.sendMessage({ type: "GET_CATCH_LOG" }) || [];
                batchItems = log.map(s => ({ url: s.url, title: s.title || "Vidéo", type: s.type || 'MEDIA', referer: s.pageUrl || "" }));
                renderBatchList(batchItems, true);
            } catch (e) { }
        });
    }

    if (btnClearCart) {
        btnClearCart.addEventListener('click', async () => {
            await api.runtime.sendMessage({ type: "CLEAR_CATCH_LOG" });
            batchItems = [];
            if (btnShowCart) btnShowCart.textContent = `${strCart} (0)`;
            if (btnDlSelected) { btnDlSelected.textContent = `${strDlSelected} (0)`; btnDlSelected.style.display = 'none'; }
            if (btnClearCart) btnClearCart.style.display = 'none';
            if (btnScan) btnScan.style.display = 'block';
            if (btnShowCart) btnShowCart.style.display = 'block';
            loadStreams();
        });
    }

    if (btnScan) {
        btnScan.addEventListener('click', async () => {
            btnScan.textContent = api.i18n.getMessage("scanInProgress") || "Recherche...";
            try {
                const tabs = await api.tabs.query({ active: true, currentWindow: true });
                if (tabs && tabs[0]) {
                    const response = await api.tabs.sendMessage(tabs[0].id, { type: "SCAN_PAGE" });
                    if (response && response.items) { batchItems = response.items; renderBatchList(batchItems); }
                }
            } catch (e) {
                console.error(e);
                btnScan.textContent = api.i18n.getMessage("scanError") || "Erreur";
                setTimeout(() => btnScan.textContent = api.i18n.getMessage("btnScanPage") || "Scanner", 2000);
            }
        });
    }

    if (btnDlSelected) {
        btnDlSelected.addEventListener('click', () => {
            const checked = document.querySelectorAll('.cb-batch:checked');
            const urls = Array.from(checked).map(cb => cb.value);
            const selected = batchItems.filter(item => urls.includes(item.url));
            if (selected.length > 0) {
                api.runtime.sendMessage({ type: "DOWNLOAD_BATCH", items: selected });
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
            streamList.textContent = ''; // Clear safely
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty';
            const p = document.createElement('p');
            p.textContent = api.i18n.getMessage("cartEmptyMsg") || "Aucun média";
            emptyDiv.appendChild(p);
            streamList.appendChild(emptyDiv);
            return;
        }

        const section = document.createElement('div');
        section.className = 'tl-section';
        const line = document.createElement('div');
        line.className = 'tl-line';
        section.appendChild(line);

        const label = document.createElement('div');
        label.className = 'tl-label';
        label.textContent = `${api.i18n.getMessage("cartSelectMsg") || "Sélection"} · ${items.length}`;
        section.appendChild(label);

        const toggleRow = document.createElement('div');
        toggleRow.style.cssText = 'display:flex;align-items:center;padding:6px 12px 14px 40px;gap:8px;background:var(--bg);margin:0 -12px 8px -12px;border-bottom:1px solid var(--border);';
        
        // Wrapper for custom checkbox
        const tcWrapper = document.createElement('label');
        tcWrapper.className = 'checkbox-wrapper';
        
        const tc = document.createElement('input');
        tc.type = 'checkbox';
        tc.checked = true;
        tc.id = 'toggle-all';
        tc.className = 'cb-batch'; // Use same class for styling logic
        
        tc.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.cb-batch').forEach(cbItem => cbItem.checked = isChecked);
            updateCount();
        });
        
        const tcVisual = document.createElement('span');
        tcVisual.className = 'cb-visual';
        
        tcWrapper.appendChild(tc);
        tcWrapper.appendChild(tcVisual);
        toggleRow.appendChild(tcWrapper);
        
        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = api.i18n.getMessage("cartToggleAll") || "Tout cocher";
        toggleLabel.style.cssText = 'font-size:12px;font-weight:500;color:var(--text);cursor:pointer;user-select:none;';
        toggleRow.appendChild(toggleLabel);
        
        section.appendChild(toggleRow);

        const updateCount = () => {
            const c = document.querySelectorAll('.cb-batch:checked').length;
            if (btnDlSelected) btnDlSelected.textContent = `${strDlSelected} (${c})`;
        };

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'tl-item';
            el.setAttribute('data-type', item.type === 'VIDEO' ? 'videos' : 'others');

            const dot = document.createElement('div');
            dot.className = 'tl-dot';
            el.appendChild(dot);

            const card = document.createElement('div');
            card.className = 'tl-card';
            card.style.cursor = 'pointer';

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';

            // Wrapper for custom checkbox
            const cbWrapper = document.createElement('label');
            cbWrapper.className = 'checkbox-wrapper';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'cb-batch';
            cb.value = item.url;
            cb.checked = true;
            cb.addEventListener('change', updateCount);
            
            const cbVisual = document.createElement('span');
            cbVisual.className = 'cb-visual';
            
            cbWrapper.appendChild(cb);
            cbWrapper.appendChild(cbVisual);
            row.appendChild(cbWrapper);

            const info = document.createElement('div');
            info.style.flex = '1';
            info.style.overflow = 'hidden';
            const t = document.createElement('div');
            t.className = 'tl-title';
            t.textContent = item.title;
            info.appendChild(t);
            const u = document.createElement('div');
            u.className = 'tl-url';
            u.textContent = item.url;
            info.appendChild(u);
            row.appendChild(info);

            card.appendChild(row);
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') { cb.checked = !cb.checked; updateCount(); }
            });

            el.appendChild(card);
            section.appendChild(el);
        });

        streamList.appendChild(section);

        document.getElementById('toggle-all').addEventListener('change', (e) => {
            document.querySelectorAll('.cb-batch').forEach(cb => cb.checked = e.target.checked);
            updateCount();
        });

        updateCount();
    }

    loadStreams();
});
