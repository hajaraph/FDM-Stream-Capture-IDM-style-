if (typeof api === 'undefined') {
    var api = typeof browser !== 'undefined' ? browser : chrome;
}

document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-linker');
    const dlText = document.getElementById('dl-text');
    
    if (downloadBtn && dlText) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const originalText = dlText.textContent;
            dlText.textContent = 'Téléchargement...';
            
            // Force a clean download via extension API instead of raw href link
            const fileUrl = api.runtime.getURL('FDM_Linker.bat');
            api.downloads.download({
                url: fileUrl,
                filename: 'FDM_Linker.bat',
                saveAs: true
            }).catch(err => console.error("Erreur téléchargement: ", err));
            
            setTimeout(() => {
                dlText.textContent = originalText;
            }, 3000);
        });
    }
});
