document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-linker');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            // Little visual feedback
            const btn = this;
            const originalChildren = Array.from(btn.childNodes);
            
            btn.textContent = 'Téléchargement...';
            
            setTimeout(() => {
                btn.textContent = '';
                originalChildren.forEach(child => btn.appendChild(child));
            }, 3000);
        });
    }
});
