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
// closeResultBtn and shareBtn are now dynamically injected in showResults()

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
    ui.resultContainer.classList.remove('hidden');
    ui.resultGrid.innerHTML = '';

    results.forEach((char, index) => {
        const card = document.createElement('div');
        const rarityClass = char.rarity.toLowerCase();
        card.className = `result-card char-card ${rarityClass} ${char.charId}`;
        card.style.animationDelay = `${index * 0.1}s`;
        const imgUrl = char.imageUrl || `https://via.placeholder.com/150/000000/FFFFFF?text=${char.charId}`;
        card.innerHTML = `
            <span class="badge ${rarityClass}">${char.rarity}</span>
            <img src="${imgUrl}" alt="${char.name}">
            <div class="info"><span class="name">${char.name}</span></div>
        `;
        ui.resultGrid.appendChild(card);
    });

    const actions = doc.querySelector('.result-actions');
    actions.innerHTML = `
        <button id="draw-again-btn" class="btn-primary" style="background: var(--accent-color); color: #000;">AGAIN (${results.length === 10 ? '10x' : 'Single'})</button>
        <button id="share-btn" class="btn-primary" style="background: var(--secondary-color); box-shadow: 0 0 15px rgba(255, 0, 85, 0.4);">SHARE RESULT</button>
        <button id="close-result-btn" class="btn-secondary">CANCEL</button>
    `;

    doc.getElementById('close-result-btn').addEventListener('click', closeResults);
    doc.getElementById('share-btn').addEventListener('click', handleShare);
    doc.getElementById('draw-again-btn').addEventListener('click', () => {
        handleDrawAgain(results.length === 10 ? 'ten' : 'single', results.length === 10 ? 10 : 1);
    });

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
    ui.resultContainer.insertBefore(div, doc.querySelector('.result-actions'));
    return div;
}

function closeResults() {
    ui.gachaOverlay.classList.add('hidden');
    ui.resultContainer.classList.add('hidden');
    state.isAnimating = false;
}

async function handleDrawAgain(type, cost) {
    closeResults();
    setTimeout(() => handleDraw(type, cost), 100);
}

async function handleShare() {
    const originalText = ui.shareBtn.textContent;
    ui.shareBtn.textContent = "GENERATING...";
    ui.shareBtn.disabled = true;

    try {
        const posterView = doc.createElement('div');
        posterView.style.cssText = `
            position: absolute; left: 0; top: 0;
            width: 800px; padding: 40px;
            background: #0d0d12;
            color: white; font-family: 'Orbitron', 'Zen Maru Gothic', sans-serif;
            text-align: center;
            z-index: -9999;
            opacity: 1;
        `;

        posterView.innerHTML = `
            <h1 style="color: #00f0ff; text-shadow: 0 0 20px rgba(0,240,255,0.6); margin: 0 0 10px 0; font-size: 44px;">GACHA RESULTS</h1>
            <p style="color: #a0a0b0; margin-bottom: 30px; letter-spacing: 2px; font-size: 20px;">PLAYER: ${state.user.userId}</p>
        `;

        const gridClone = ui.resultGrid.cloneNode(true);
        gridClone.style.cssText = `
            display: flex; flex-wrap: wrap; justify-content: center;
            gap: 15px; margin-bottom: 30px; width: 100%;
        `;

        gridClone.querySelectorAll('.result-card').forEach(c => {
            c.style.cssText = `
                width: 135px; aspect-ratio: 3/4; position: relative;
                border-radius: 10px; overflow: hidden; border: 2px solid #333;
                animation: none; flex-shrink: 0; opacity: 1; transform: none;
            `;
            if (c.classList.contains('ssr')) c.style.borderColor = '#ffd700';
            else if (c.classList.contains('sr')) c.style.borderColor = '#c0c0c0';
        });

        posterView.appendChild(gridClone);

        const footer = doc.createElement('div');
        footer.style.cssText = `color: #444; font-size: 14px; margin-top: 30px; border-top: 1px solid #222; padding-top: 20px;`;
        footer.textContent = `Generated at ${new Date().toLocaleString()} | Gacha System`;
        posterView.appendChild(footer);

        doc.body.appendChild(posterView);

        const cloneImages = Array.from(posterView.querySelectorAll('img'));
        await Promise.all(cloneImages.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(r => { img.onload = r; img.onerror = r; });
        }));

        await new Promise(r => setTimeout(r, 400));

        const canvas = await html2canvas(posterView, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0d0d12',
            scale: 2,
            width: 800,
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
                text: `Check my Pulls! ID: ${state.user.userId}`
            });
        } else {
            const link = doc.createElement('a');
            link.download = `gacha_${state.user.userId}.png`;
            link.href = dataUrl;
            link.click();
            alert("網頁版不支援直接分享，已為您下載高畫質海報！");
        }
    } catch (e) {
        console.error("Share failed", e);
        alert("產生失敗，建議直接截圖分享！");
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
