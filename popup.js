async function loadStreams() {
    try {
        document.getElementById('header-title').innerText = browser.i18n.getMessage("popupTitle");

        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;

        const currentTab = tabs[0];
        const tabId = currentTab.id;
        const currentUrl = currentTab.url || "";
        const streamList = document.getElementById('stream-list');

        const streams = await browser.runtime.sendMessage({ type: "GET_STREAMS", tabId: tabId, tabUrl: currentUrl, tabTitle: currentTab.title }) || [];

        streamList.innerHTML = '';

        if (streams.length === 0) {
            streamList.textContent = '';
            const msgDiv = document.createElement('div');
            msgDiv.className = 'empty-msg';
            msgDiv.textContent = browser.i18n.getMessage("emptyMsg");
            streamList.appendChild(msgDiv);
            return;
        }

        console.log("Flux reçus :", streams); // Pour le debug

        // Groupage par type (Exactement les mêmes que dans background.js)
        const groups = {
            'youtube': streams.filter(s => s.type === 'youtube'),
            'manifests': streams.filter(s => s.type === 'manifests'),
            'videos': streams.filter(s => s.type === 'videos'),
            'segments': streams.filter(s => s.type === 'segments')
        };

        // On affiche les groupes s'ils existent
        if (groups.youtube.length > 0) addGroup(streamList, browser.i18n.getMessage("groupYoutube"), groups.youtube);
        if (groups.manifests.length > 0) addGroup(streamList, browser.i18n.getMessage("groupManifests"), groups.manifests);
        if (groups.videos.length > 0) addGroup(streamList, browser.i18n.getMessage("groupVideos"), groups.videos);
        if (groups.segments.length > 0) addGroup(streamList, browser.i18n.getMessage("groupSegments"), groups.segments);

        // Sécurité : Afficher tout ce qui n'a pas été groupé
        const others = streams.filter(s => s.type !== 'youtube' && s.type !== 'manifests' && s.type !== 'videos' && s.type !== 'segments');
        if (others.length > 0) addGroup(streamList, browser.i18n.getMessage("groupOthers"), others);

        attachEvents();

    } catch (err) {
        console.error("Popup Error:", err);
        const errorMsg = browser.i18n.getMessage("errorMsg", err.message);
        const listDiv = document.getElementById('stream-list');
        listDiv.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'empty-msg';
        errorDiv.textContent = errorMsg;
        listDiv.appendChild(errorDiv);
    }
}

function addGroup(container, title, items) {
    const section = document.createElement('div');
    section.className = 'group-section';
    const h3 = document.createElement('h3');
    h3.className = 'group-title';
    h3.textContent = title;
    section.appendChild(h3);

    items.forEach(stream => {
        const item = document.createElement('div');
        item.className = 'stream-item';

        const cleanTitle = (stream.title || "Vidéo").trim().substring(0, 50);
        const fileName = stream.type === 'youtube' ? 'YouTube HD' : cleanTitle;
        const isYt = stream.type === 'youtube' ? "true" : "false";

        const infoDiv = document.createElement('div');
        infoDiv.className = 'stream-info';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'stream-title';
        titleDiv.title = stream.title || '';
        titleDiv.textContent = fileName;

        const urlDiv = document.createElement('div');
        urlDiv.className = 'stream-url';
        urlDiv.title = stream.url || '';
        urlDiv.textContent = stream.url;

        infoDiv.appendChild(titleDiv);
        infoDiv.appendChild(urlDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const btnDl = document.createElement('button');
        btnDl.className = 'btn-download';
        btnDl.setAttribute('data-url', stream.url);
        btnDl.setAttribute('data-name', stream.title || '');
        btnDl.setAttribute('data-referer', stream.pageUrl || '');
        btnDl.setAttribute('data-youtube', isYt);
        btnDl.textContent = browser.i18n.getMessage("btnDownload");

        const btnCp = document.createElement('button');
        btnCp.className = 'btn-copy';
        btnCp.setAttribute('data-url', stream.url);
        btnCp.textContent = browser.i18n.getMessage("btnCopy");

        actionsDiv.appendChild(btnDl);
        actionsDiv.appendChild(btnCp);

        item.appendChild(infoDiv);
        item.appendChild(actionsDiv);

        section.appendChild(item);
    });

    container.appendChild(section);
}

function attachEvents() {
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.onclick = (e) => {
            const url = e.target.getAttribute('data-url');
            const name = e.target.getAttribute('data-name');
            const referer = e.target.getAttribute('data-referer');
            const isYoutube = e.target.getAttribute('data-youtube') === "true";

            browser.runtime.sendMessage({
                type: "SEND_TO_FDM",
                url: url,
                filename: name,
                referer: referer,
                isYoutube: isYoutube
            });
            window.close();
        };
    });

    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.onclick = (e) => {
            const url = e.target.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(() => {
                e.target.innerText = browser.i18n.getMessage("btnCopied");
                setTimeout(() => e.target.innerText = browser.i18n.getMessage("btnCopy"), 1500);
            });
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('header-title').textContent = browser.i18n.getMessage("popupTitle") || "FDM Stream Capture";

    // Wire up the settings button
    const settingsBtn = document.getElementById('open-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (browser.runtime.openOptionsPage) {
                browser.runtime.openOptionsPage();
            } else {
                window.open(browser.runtime.getURL('options.html'));
            }
        });
    }

    const btnScan = document.getElementById('btn-scan-page');
    const btnDlSelected = document.getElementById('btn-dl-selected');
    const btnShowCart = document.getElementById('btn-show-cart');
    const btnClearCart = document.getElementById('btn-clear-cart');
    let batchItems = [];

    const strCart = browser.i18n.getMessage("strCart") || "Panier";
    const strDlSelected = browser.i18n.getMessage("strDlSelected") || "Télécharger sélection";

    btnScan.textContent = browser.i18n.getMessage("btnScanPage") || "Scanner la page";
    btnClearCart.textContent = browser.i18n.getMessage("btnClearCart") || "Vider";

    // Init Cart badge
    browser.runtime.sendMessage({ type: "GET_CATCH_LOG" }).then(log => {
        if (log && log.length > 0) {
            btnShowCart.textContent = `${strCart} (${log.length})`;
        } else {
            btnShowCart.textContent = `${strCart} (0)`;
        }
    }).catch(() => { });

    btnShowCart.addEventListener('click', async () => {
        try {
            const log = await browser.runtime.sendMessage({ type: "GET_CATCH_LOG" }) || [];
            batchItems = log.map(s => ({
                url: s.url,
                title: s.title || "Vidéo",
                type: s.type || 'MEDIA',
                referer: s.pageUrl || ""
            }));
            renderBatchList(batchItems, true);
        } catch (e) { }
    });

    btnClearCart.addEventListener('click', async () => {
        await browser.runtime.sendMessage({ type: "CLEAR_CATCH_LOG" });
        btnShowCart.textContent = `${strCart} (0)`;
        btnDlSelected.style.display = 'none';
        btnClearCart.style.display = 'none';
        btnScan.style.display = 'block';
        btnShowCart.style.display = 'block';
        loadStreams(); // Revenir à la vue normale
    });

    btnScan.addEventListener('click', async () => {
        btnScan.textContent = browser.i18n.getMessage("scanInProgress") || "Recherche en cours...";
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                const response = await browser.tabs.sendMessage(tabs[0].id, { type: "SCAN_PAGE" });
                if (response && response.items) {
                    batchItems = response.items;
                    renderBatchList(batchItems);
                }
            }
        } catch (e) {
            console.error(e);
            btnScan.textContent = browser.i18n.getMessage("scanError") || "Erreur (Rechargez la page)";
            setTimeout(() => btnScan.textContent = browser.i18n.getMessage("btnScanPage") || "Scanner la page", 2000);
        }
    });

    btnDlSelected.addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('.batch-checkbox:checked');
        const selectedUrls = Array.from(checkedBoxes).map(cb => cb.value);
        const selectedItems = batchItems.filter(item => selectedUrls.includes(item.url));

        if (selectedItems.length > 0) {
            browser.runtime.sendMessage({
                type: "DOWNLOAD_BATCH",
                items: selectedItems
            });
            btnDlSelected.textContent = browser.i18n.getMessage("cartSentMsg") || "Fichiers envoyés !";
            setTimeout(() => window.close(), 1500);
        }
    });

    function renderBatchList(items, isCart = false) {
        const streamList = document.getElementById('stream-list');
        streamList.innerHTML = '';
        btnScan.style.display = 'none';
        btnShowCart.style.display = 'none';
        btnDlSelected.style.display = 'block';
        if (isCart) btnClearCart.style.display = 'block';
        else btnClearCart.style.display = 'none';

        if (items.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'empty-msg';
            msg.textContent = browser.i18n.getMessage("cartEmptyMsg") || "Aucun média trouvé.";
            streamList.appendChild(msg);
            return;
        }

        const section = document.createElement('div');
        section.className = 'group-section';
        const h3 = document.createElement('h3');
        h3.className = 'group-title';
        const selMsg = browser.i18n.getMessage("cartSelectMsg") || "Sélectionnez les fichiers";
        h3.textContent = `${selMsg} (${items.length})`;
        section.appendChild(h3);

        const toggleAll = document.createElement('label');
        toggleAll.style.cursor = 'pointer';
        toggleAll.style.fontSize = '12px';
        toggleAll.style.display = 'block';
        toggleAll.style.marginBottom = '10px';
        toggleAll.style.fontWeight = 'bold';
        const toggleStr = browser.i18n.getMessage("cartToggleAll") || "Tout cocher / décocher";
        const toggleCheckbox = document.createElement('input');
        toggleCheckbox.type = 'checkbox';
        toggleCheckbox.checked = true;
        toggleCheckbox.id = 'toggle-all';
        toggleAll.appendChild(toggleCheckbox);
        toggleAll.appendChild(document.createTextNode(' ' + toggleStr));
        section.appendChild(toggleAll);

        const updateCount = () => {
            const checked = document.querySelectorAll('.batch-checkbox:checked').length;
            btnDlSelected.textContent = `${strDlSelected} (${checked})`;
        };

        const listDiv = document.createElement('div');
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'stream-item selectable';

            const checkDiv = document.createElement('div');
            checkDiv.className = 'checkbox-container';
            checkDiv.style.display = 'flex';
            const batchCb = document.createElement('input');
            batchCb.type = 'checkbox';
            batchCb.className = 'batch-checkbox';
            batchCb.value = item.url;
            batchCb.checked = true;
            checkDiv.appendChild(batchCb);

            row.appendChild(checkDiv);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'stream-info';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'stream-title';
            titleDiv.textContent = item.title;

            const urlDiv = document.createElement('div');
            urlDiv.className = 'stream-url';
            urlDiv.textContent = item.url;

            infoDiv.appendChild(titleDiv);
            infoDiv.appendChild(urlDiv);

            row.appendChild(infoDiv);

            row.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = row.querySelector('input');
                    cb.checked = !cb.checked;
                }
                updateCount();
            });

            listDiv.appendChild(row);
        });

        section.appendChild(listDiv);
        streamList.appendChild(section);

        document.getElementById('toggle-all').addEventListener('change', (e) => {
            document.querySelectorAll('.batch-checkbox').forEach(cb => cb.checked = e.target.checked);
            updateCount();
        });

        updateCount();
    }

    loadStreams();
});
