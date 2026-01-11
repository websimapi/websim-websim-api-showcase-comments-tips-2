import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { COSMETICS } from './app.js';

export const UI = {
    renderComment(comment, unlockedKeys = new Set()) {
        const isTip = comment.card_data?.type === 'tip_comment';
        const tipAmount = comment.card_data?.credits_spent || 0;
        
        // Sanitize and parse markdown
        const rawHtml = marked.parse(comment.raw_content || '');
        const cleanHtml = DOMPurify.sanitize(rawHtml);

        const date = new Date(comment.created_at || Date.now()).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const card = document.createElement('div');
        card.className = 'comment-card';
        card.id = `comment-${comment.id}`;

        // Build cosmetics markers
        let auraClass = '';
        let nameStyleClass = '';
        let badgesHtml = '';

        unlockedKeys.forEach(key => {
            const cos = COSMETICS.find(c => c.key === key);
            if (!cos) return;
            if (cos.type === 'aura') auraClass = `aura-${cos.key}`;
            if (cos.type === 'name-style') nameStyleClass = `name-${cos.key}`;
            if (cos.type === 'badge') {
                badgesHtml += `<span class="cosmetic-badge" title="${cos.label}">${cos.icon}</span>`;
            }
        });

        if (auraClass) card.classList.add(auraClass);

        card.innerHTML = `
            ${isTip ? `
                <div class="tip-badge">
                    <img src="tip_icon.png" alt="Coin">
                    <span>${tipAmount} credits tipped</span>
                </div>
            ` : ''}
            <div class="comment-header">
                <div class="avatar-container">
                    <img src="${comment.author.avatar_url}" class="author-avatar" alt="${comment.author.username}">
                </div>
                <div class="author-info">
                    <div class="author-name ${nameStyleClass}">${comment.author.username} ${badgesHtml}</div>
                </div>
                <div class="comment-meta">${date}</div>
            </div>
            <div class="comment-content">
                ${cleanHtml}
            </div>
        `;
        return card;
    },

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);
        
        const audio = new Audio('notification.mp3');
        audio.play().catch(() => {});

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};