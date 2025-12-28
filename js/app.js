// Main App Logic
// Uses window.gachaApi provided by api.js

// State
const state = {
    user: null, // { userId, tickets }
    pool: [],
    isAnimating: false
};

// DOM Elements
const doc = document;
const screens = {
    loading: doc.getElementById('loading'),
    login: doc.getElementById('login-screen'),
    lobby: doc.getElementById('lobby-screen')
};
const ui = {
    summonAnimation: doc.querySelector('.summon-animation'),
    userIdInput: doc.getElementById('user-id-input'),
    startBtn: doc.getElementById('start-btn'),
    displayUserId: doc.getElementById('display-user-id'),
    ticketCount: doc.getElementById('ticket-count'),
    charPool: doc.getElementById('character-pool'),
    drawOneBtn: doc.getElementById('draw-one-btn'),
    drawTenBtn: doc.getElementById('draw-ten-btn'),
    gachaOverlay: doc.getElementById('gacha-overlay'),
    resultContainer: doc.getElementById('result-container'),
    resultGrid: doc.getElementById('result-grid'),
    closeResultBtn: doc.getElementById('close-result-btn'),
    shareBtn: doc.getElementById('share-btn'),
    errorMsg: doc.getElementById('error-message')
};

// Init
window.addEventListener('DOMContentLoaded', () => {
    switchScreen('login');
});

// Event Listeners
ui.startBtn.addEventListener('click', handleLogin);
ui.drawOneBtn.addEventListener('click', () => handleDraw('single', 1));
ui.drawTenBtn.addEventListener('click', () => handleDraw('ten', 10));
ui.closeResultBtn.addEventListener('click', closeResults);
ui.shareBtn.addEventListener('click', handleShare);

async function handleLogin() {
    const userId = ui.userIdInput.value.trim();
    if (!userId) return;

    setLoading(true);
    const res = await window.gachaApi.initUser(userId);
    setLoading(false);

    if (res.status === 'success') {
        state.user = { userId: res.data.userId, tickets: res.data.tickets };
        state.pool = res.data.characterPool;
        renderLobby();
        switchScreen('lobby');
    } else {
        alert("Login failed: " + res.message);
    }
}

async function handleDraw(type, cost) {
    if (state.isAnimating) return;
    if (state.user.tickets < cost) {
        showError("NOT ENOUGH TICKETS");
        return;
    }

    state.isAnimating = true;
    showError(""); // Clear errors

    // UI Optimistic Update (Optional, but let's wait for server for strictness or play animation first)
    ui.summonAnimation.classList.remove('hidden'); // Show animation
    ui.resultContainer.classList.add('hidden'); // Ensure results are hidden
    ui.gachaOverlay.classList.remove('hidden');
    // Start summoning animation visuals here if you had a video/canvas

    const res = await window.gachaApi.draw(state.user.userId, type, cost);

    if (res.status === 'success') {
        // Dramatic delay for animation
        setTimeout(() => {
            state.user.tickets = res.data.ticketsAfter;
            updateTicketUI();

            // Hide animation, Show results
            ui.summonAnimation.classList.add('hidden');
            showResults(res.data.results);
            state.isAnimating = false;
        }, 2000);
    } else {
        ui.gachaOverlay.classList.add('hidden');
        showError(res.message);
        state.isAnimating = false;
    }
}

function showResults(results) {
    // Hide Summon Circle, Show Cards
    ui.resultContainer.classList.remove('hidden');
    ui.resultGrid.innerHTML = '';

    results.forEach((char, index) => {
        const card = document.createElement('div');
        // Add rarity and charId class for specific styling
        const rarityClass = char.rarity.toLowerCase();
        card.className = `result-card char-card ${rarityClass} ${char.charId}`;
        card.style.animationDelay = `${index * 0.1}s`; // Staggered reveal

        // Use placeholder if image fails or is empty
        const imgUrl = char.imageUrl || `https://via.placeholder.com/150/000000/FFFFFF?text=${char.charId}`;

        card.innerHTML = `
            <span class="badge ${rarityClass}">${char.rarity}</span>
            <img src="${imgUrl}" alt="${char.name}">
            <div class="info">
                <span class="name">${char.name}</span>
            </div>
        `;
        ui.resultGrid.appendChild(card);
    });

    // Render Summary if more than 1 result
    const summaryContainer = document.getElementById('result-summary') || createSummaryContainer();
    if (results.length > 1) {
        summaryContainer.classList.remove('hidden');
        renderSummary(results, summaryContainer);
    } else {
        summaryContainer.classList.add('hidden');
    }
}

function createSummaryContainer() {
    const div = document.createElement('div');
    div.id = 'result-summary';
    div.className = 'result-summary hidden';
    // Insert before the button
    ui.resultContainer.insertBefore(div, ui.closeResultBtn);
    return div;
}

function renderSummary(results, container) {
    const stats = {};
    results.forEach(r => {
        stats[r.name] = (stats[r.name] || 0) + 1;
    });

    // Sort by count desc, then name
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    container.innerHTML = `
        <h3>DRAW SUMMARY</h3>
        <ul>
            ${sorted.map(([name, count]) => `<li>${name} x${count}</li>`).join('')}
        </ul>
    `;
}

function closeResults() {
    ui.gachaOverlay.classList.add('hidden');
    ui.resultContainer.classList.add('hidden');
}

async function handleShare() {
    const originalText = ui.shareBtn.textContent;
    ui.shareBtn.textContent = "GENERATING...";
    ui.shareBtn.disabled = true;

    try {
        const actions = doc.querySelector('.result-actions');
        const summary = doc.getElementById('result-summary');

        // 1. Prepare for high-res capture
        // Create a temporary "Poster Wrapper" to style the result for sharing
        const posterView = doc.createElement('div');
        posterView.className = 'poster-view';
        posterView.style.cssText = `
            position: fixed; left: -9999px; top: 0;
            width: 1000px; padding: 40px;
            background: #0d0d12;
            color: white; font-family: 'Orbitron', 'Zen Maru Gothic', sans-serif;
            text-align: center;
        `;

        // Add Header
        const header = doc.createElement('div');
        header.innerHTML = `
            <h1 style="color: #00f0ff; text-shadow: 0 0 20px rgba(0,240,255,0.6); margin-bottom: 5px;">GACHA RESULTS</h1>
            <p style="color: #a0a0b0; margin-bottom: 30px; letter-spacing: 2px;">IDENTIFIED AS: ${state.user.userId}</p>
        `;
        posterView.appendChild(header);

        // Clone Grid and force 5 columns
        const gridClone = ui.resultGrid.cloneNode(true);
        gridClone.style.cssText = `
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        `;
        // Ensure all cloned cards have visible styles (no animations)
        gridClone.querySelectorAll('.result-card').forEach(c => {
            c.style.animation = 'none';
            c.style.opacity = '1';
            c.style.transform = 'none';
        });
        posterView.appendChild(gridClone);

        // Add Summary if needed
        if (summary && !summary.classList.contains('hidden')) {
            const summaryClone = summary.cloneNode(true);
            summaryClone.style.margin = '20px auto';
            summaryClone.style.maxWidth = 'none';
            posterView.appendChild(summaryClone);
        }

        // Add Footer
        const footer = doc.createElement('div');
        footer.style.color = '#555';
        footer.style.fontSize = '12px';
        footer.style.marginTop = '20px';
        footer.textContent = `Generated at ${new Date().toLocaleString()} | Gacha System v1.0`;
        posterView.appendChild(footer);

        doc.body.appendChild(posterView);

        // 2. Capture
        const canvas = await html2canvas(posterView, {
            useCORS: true,
            backgroundColor: '#0d0d12',
            scale: 3, // Very high quality
            logging: false
        });

        doc.body.removeChild(posterView);

        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'gacha-result.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Gacha Summon Results',
                text: `My Gacha Results for player ${state.user.userId}!`
            });
        } else {
            const link = doc.createElement('a');
            link.download = `gacha_${state.user.userId}.png`;
            link.href = dataUrl;
            link.click();
            alert("網頁版不支援直接分享，已為您下載高畫質截圖！");
        }
    } catch (e) {
        console.error("Share failed", e);
        alert("產生失敗，請手動截圖。");
    } finally {
        ui.shareBtn.textContent = originalText;
        ui.shareBtn.disabled = false;
    }
}

function renderLobby() {
    ui.displayUserId.textContent = state.user.userId;
    updateTicketUI();

    ui.charPool.innerHTML = state.pool.map(char => {
        const rarityClass = char.rarity.toLowerCase();
        return `
        <div class="char-card ${rarityClass} ${char.charId}">
            <span class="badge ${rarityClass}">${char.rarity}</span>
            <img src="${char.imageUrl || 'https://via.placeholder.com/120'}" alt="${char.name}">
            <div class="info">
                <span class="name">${char.name}</span>
                <span class="rate">${char.weight}%</span>
            </div>
        </div>
    `}).join('');
}

function updateTicketUI() {
    ui.ticketCount.textContent = state.user.tickets;
}

function switchScreen(name) {
    Object.values(screens).forEach(el => el.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

function setLoading(isLoading) {
    if (isLoading) {
        ui.startBtn.textContent = "CONNECTING...";
        ui.startBtn.disabled = true;
    } else {
        ui.startBtn.textContent = "START GAME";
        ui.startBtn.disabled = false;
    }
}

function showError(msg) {
    ui.errorMsg.textContent = msg;
    ui.errorMsg.classList.remove('hidden');
    if (msg) {
        setTimeout(() => ui.errorMsg.classList.add('hidden'), 3000);
    }
}
