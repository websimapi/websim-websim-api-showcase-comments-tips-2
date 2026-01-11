import { Api } from './api.js';
import { UI } from './ui.js';

export const COSMETICS = [
    { key: "fire", price: 25, label: "Fire Aura", icon: "🔥", type: "aura", desc: 'Tip 25+ with message "fire"' },
    { key: "ice", price: 25, label: "Frost Aura", icon: "🧊", type: "aura", desc: 'Tip 25+ with message "ice"' },
    { key: "sparkle", price: 25, label: "Sparkle Aura", icon: "✨", type: "aura", desc: 'Tip 25+ with message "sparkle"' },
    { key: "rainbow", price: 100, label: "Rainbow Name", type: "name-style", desc: 'Tip 100+ with message "rainbow"' },
    { key: "gold", price: 100, label: "Golden Name", type: "name-style", desc: 'Tip 100+ with message "gold"' },
    { key: "crown", price: 500, label: "Royal Crown", icon: "👑", type: "badge", desc: 'Tip 500+ with message "crown"' },
    { key: "dragon", price: 500, label: "Dragon Companion", icon: "🐉", type: "badge", desc: 'Tip 500+ with message "dragon"' },
];

class App {
    constructor() {
        this.currentTab = 'all';
        this.nextCursor = null;
        this.isLoading = false;
        this.userUnlockedKeys = new Set();
        this.unlockedByUserId = {}; // Track unlocks for all users we see
        
        this.els = {
            title: document.getElementById('project-title'),
            owner: document.getElementById('owner-username'),
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),
            feed: document.getElementById('comments-container'),
            loading: document.getElementById('loading-spinner'),
            loadMore: document.getElementById('load-more'),
            tabs: document.querySelectorAll('.tab-btn'),
            btnComment: document.getElementById('btn-comment'),
            btnTip: document.getElementById('btn-tip'),
            btnCopyInfo: document.getElementById('btn-copy-info'),
            btnRewards: document.getElementById('btn-rewards'),
            modal: document.getElementById('modal-overlay'),
            closeModal: document.getElementById('close-modal'),
            tierList: document.getElementById('tier-list'),
            modalTitle: document.querySelector('.modal-header h2')
        };

        this.init();
    }

    async init() {
        try {
            const { project, user, creator } = await Api.getProjectData();
            this.currentUser = user;
            
            // UI Setup
            this.els.title.innerText = project.title;
            this.els.owner.innerText = creator.username;
            
            if (user) {
                this.els.userAvatar.src = user.avatar_url;
                this.els.userAvatar.classList.remove('hidden');
                this.els.userName.innerText = user.username;
            }

            // Events
            this.els.tabs.forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });

            this.els.loadMore.addEventListener('click', () => this.loadComments(true));
            
            this.els.btnComment.addEventListener('click', () => {
                Api.postComment("I'm checking out the cosmetic shop!");
            });

            this.els.btnTip.addEventListener('click', () => {
                this.openRewardsModal();
            });

            this.els.btnRewards.addEventListener('click', () => {
                this.openRewardsModal();
            });

            this.els.closeModal.addEventListener('click', () => {
                this.els.modal.classList.add('hidden');
            });

            this.els.modal.addEventListener('click', (e) => {
                if (e.target === this.els.modal) this.els.modal.classList.add('hidden');
            });

            this.els.btnCopyInfo.addEventListener('click', () => this.copyTechnicalOverview());

            // Initial Load of all tips to calculate unlocks for everyone
            await this.refreshUnlockedCosmetics();

            // Listen for new comments in real-time
            Api.onCommentCreated((data) => {
                const comment = data.comment;
                UI.showToast(`New activity from ${comment.author.username}!`);
                
                // Process unlock if it's a tip
                this.processCommentForUnlocks(comment);

                // If we are on the "Latest" tab, prepending it
                if (this.currentTab === 'all' && !comment.parent_comment_id) {
                    const card = UI.renderComment(comment, this.unlockedByUserId[comment.author.id] || new Set());
                    this.els.feed.prepend(card);
                }
            });

            // Initial Load
            await this.loadComments();

        } catch (err) {
            console.error("Initialization failed", err);
        }
    }

    async refreshUnlockedCosmetics() {
        try {
            const tips = await Api.fetchComments({ onlyTips: true });
            this.unlockedByUserId = {};
            tips.data.forEach(item => {
                this.processCommentForUnlocks(item.comment);
            });
            
            if (this.currentUser) {
                this.userUnlockedKeys = this.unlockedByUserId[this.currentUser.id] || new Set();
            }
        } catch (err) {
            console.error("Failed to calculate unlocks", err);
        }
    }

    processCommentForUnlocks(comment) {
        const userId = comment.author.id;
        const tipAmount = comment.card_data?.credits_spent || 0;
        const message = (comment.raw_content || "").toLowerCase();

        if (!this.unlockedByUserId[userId]) {
            this.unlockedByUserId[userId] = new Set();
        }

        COSMETICS.forEach(cosmetic => {
            if (tipAmount >= cosmetic.price && message.includes(cosmetic.key)) {
                this.unlockedByUserId[userId].add(cosmetic.key);
            }
        });
    }

    openRewardsModal() {
        this.els.modalTitle.innerText = "Cosmetic Shop";
        this.renderCosmetics();
        this.els.modal.classList.remove('hidden');
    }

    renderCosmetics() {
        this.els.tierList.innerHTML = '';
        COSMETICS.forEach(item => {
            const isUnlocked = this.userUnlockedKeys.has(item.key);
            const card = document.createElement('div');
            card.className = `tier-card cosmetic-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            
            card.innerHTML = `
                <div class="tier-info">
                    <div class="tier-name">${item.icon || ''} ${item.label}</div>
                    <div class="tier-reward">${item.desc}</div>
                </div>
                <button class="tier-cost" ${isUnlocked ? 'disabled' : ''}>
                    ${isUnlocked ? 'Unlocked' : item.price + ' gold'}
                </button>
            `;

            if (!isUnlocked) {
                card.querySelector('.tier-cost').addEventListener('click', () => {
                    Api.postComment(`${item.key}`, item.price);
                    this.els.modal.classList.add('hidden');
                });
            }

            this.els.tierList.appendChild(card);
        });
    }

    async switchTab(tab) {
        if (this.currentTab === tab) return;
        
        this.currentTab = tab;
        this.nextCursor = null;
        
        this.els.tabs.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.els.feed.innerHTML = '';
        await this.loadComments();
    }

    copyTechnicalOverview() {
        const overview = `Websim API Showcase: Keyword Unlocks
This project demonstrates conditional content unlocking based on Tip Comments.

Key Implementation Details:
1. Message-Based Logic:
   - Uses window.websim.postComment() to send specific keywords.
   - Parses 'raw_content' of tip comments to detect unlock triggers.
   
2. Cosmetic System:
   - Defines a registry of rewards tied to price thresholds AND keyword matching.
   - Allows multiple rewards at the same price point (e.g., 'fire' vs 'ice' at 25 gold).

3. Persistence Simulation:
   - Aggregates historical tip data via '/api/v1/projects/{id}/comments?only_tips=true'.
   - Builds a local 'unlockedByUserId' map to apply visuals across the entire feed.

4. Dynamic UI Injection:
   - 'ui.js' renders comment cards with conditional CSS classes based on unlocked rewards.
   - Supports 'auras', 'name-styles' (gradients/glows), and 'badges'.

5. Real-time Feedback:
   - 'comment:created' listener automatically re-scans new comments for potential unlocks.`;

        navigator.clipboard.writeText(overview).then(() => {
            UI.showToast("Technical overview copied!");
        }).catch(() => UI.showToast("Copy failed."));
    }

    async loadComments(isMore = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        if (!isMore) {
            this.els.loading.classList.remove('hidden');
            this.els.loadMore.classList.add('hidden');
        }

        try {
            const options = {
                cursor: this.nextCursor,
                sortBy: this.currentTab === 'best' ? 'best' : null,
                onlyTips: this.currentTab === 'tips'
            };

            const result = await Api.fetchComments(options);
            this.els.loading.classList.add('hidden');
            
            if (result.data.length === 0 && !isMore) {
                this.els.feed.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted)">No activity yet. Start the trend!</div>';
            } else {
                result.data.forEach(item => {
                    const userUnlocks = this.unlockedByUserId[item.comment.author.id] || new Set();
                    const card = UI.renderComment(item.comment, userUnlocks);
                    this.els.feed.appendChild(card);
                });
            }

            this.nextCursor = result.meta.has_next_page ? result.meta.end_cursor : null;
            this.els.loadMore.classList.toggle('hidden', !this.nextCursor);

        } catch (err) {
            console.error("Load failed", err);
            this.els.loading.innerText = "Error loading.";
        } finally {
            this.isLoading = false;
        }
    }
}

new App();