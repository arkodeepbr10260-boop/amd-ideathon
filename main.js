const API_URL = 'http://localhost:3000/api';
let cart = JSON.parse(localStorage.getItem('cart') || '{}');
let menuData = [];
let currentETA = null;
let discountPercent = 0;
let macroChartInst = null;
let calorieChartInst = null;

function updateCartItem(id, change) {
    cart[id] = (cart[id] || 0) + change;
    if (cart[id] <= 0) {
        delete cart[id];
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    if(document.getElementById('checkout-items')) {
        loadCheckout();
    }
}

function applyCoupon() {
    const code = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msg = document.getElementById('coupon-msg');
    if (code === 'FIRST50') {
        discountPercent = 0.5;
        msg.innerText = "🎉 Coupon applied! 50% off.";
        msg.style.color = "var(--green)";
    } else if (code === 'WELCOME10') {
        discountPercent = 0.1;
        msg.innerText = "🎉 Coupon applied! 10% off.";
        msg.style.color = "var(--green)";
    } else {
        discountPercent = 0;
        msg.innerText = "Invalid or expired coupon code.";
        msg.style.color = "red";
    }
    loadCheckout();
}

function updateCartBadge() {
    const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('cart-badge');
    if (badge) {
        if (totalItems > 0) {
            badge.style.display = 'inline-block';
            badge.innerText = totalItems;
        } else {
            badge.style.display = 'none';
        }
    }
}

function initNav() {
    const user = JSON.parse(localStorage.getItem('user'));
    const navLinks = document.getElementById('nav-links');
    if(!navLinks) return;
    
    if (user) {
        navLinks.innerHTML = `
            <span style="font-weight: 600; color: var(--green);">Hi, ${user.name}</span>
            <button class="btn" onclick="logout()" style="background:transparent; color:var(--text); border:1px solid #ccc;">Logout</button>
            <a href="/checkout" class="btn" style="position:relative;">🛒 Checkout 
                <span id="cart-badge" style="position:absolute; top:-5px; right:-5px; background:var(--orange); color:white; border-radius:50%; width:20px; height:20px; line-height:20px; font-size:0.75rem; text-align:center; display:none;">0</span>
            </a>
        `;
    } else {
        navLinks.innerHTML = `
            <a href="/login" class="btn" style="background:transparent; color:var(--text); border:1px solid #ccc;">Login / Register</a>
            <a href="/checkout" class="btn" style="position:relative;">🛒 Checkout
                <span id="cart-badge" style="position:absolute; top:-5px; right:-5px; background:var(--orange); color:white; border-radius:50%; width:20px; height:20px; line-height:20px; font-size:0.75rem; text-align:center; display:none;">0</span>
            </a>
        `;
    }
    updateCartBadge();
    renderDashboard(user);
}

function renderDashboard(user) {
    const dash = document.getElementById('user-dashboard');
    if(!dash) return;
    
    if (user) {
        dash.style.display = 'block';
        
        let idealWeight = user.gender === 'female' ? 60 : 75;
        let score = 100 - Math.abs(user.weight - idealWeight);
        if (score > 98) score = 98;
        if (score < 60) score = 60 + (user.weight % 10);
        if (user.goal === 'weight_loss' && user.weight > idealWeight) score += 5;
        if (score > 100) score = 100;
        
        let hour = new Date().getHours();
        let waterPct = Math.min(100, Math.max(10, Math.floor((hour / 20) * 100)));
        
        // Water target in liters (approx 33ml per kg)
        let waterTargetLiters = (user.weight * 0.033).toFixed(1);
        let waterTargetElem = document.getElementById('water-target');
        if(waterTargetElem) waterTargetElem.innerText = `Target: ${waterTargetLiters} L / day`;

        // Calculate Macros based on goal and weight
        let proteinTgt = 0, carbsTgt = 0, fatsTgt = 0;
        if (user.goal === 'muscle_gain') {
            proteinTgt = Math.round(user.weight * 2.2);
            carbsTgt = Math.round(user.weight * 4.0); 
            fatsTgt = Math.round(user.weight * 1.0);
        } else if (user.goal === 'weight_loss') {
            proteinTgt = Math.round(user.weight * 1.8);
            carbsTgt = Math.round(user.weight * 2.0); 
            fatsTgt = Math.round(user.weight * 0.8);
        } else {
            proteinTgt = Math.round(user.weight * 1.2);
            carbsTgt = Math.round(user.weight * 3.0); 
            fatsTgt = Math.round(user.weight * 1.0);
        }
        
        let pElem = document.getElementById('tgt-protein');
        let cElem = document.getElementById('tgt-carbs');
        let fElem = document.getElementById('tgt-fats');
        if(pElem) pElem.innerText = proteinTgt + 'g';
        if(cElem) cElem.innerText = carbsTgt + 'g';
        if(fElem) fElem.innerText = fatsTgt + 'g';
        
        document.getElementById('health-score').innerText = Math.floor(score);
        document.getElementById('water-intake').innerText = waterPct + '%';
        
        setTimeout(() => {
            const bar = document.getElementById('water-bar');
            if(bar) bar.style.width = waterPct + '%';
        }, 100);
        
        let desc = "Great! Keep it up.";
        if(score < 75) desc = "Let's focus on those goals.";
        document.getElementById('health-desc').innerText = desc;

        // --- NEW CHART LOGIC ---
        let bmr = user.weight * 24; 
        let tdee = bmr * 1.55; 
        let targetCals = tdee;
        if(user.goal === 'weight_loss') targetCals -= 500;
        if(user.goal === 'muscle_gain') targetCals += 500;
        targetCals = Math.round(targetCals);

        if(macroChartInst) macroChartInst.destroy();
        if(calorieChartInst) calorieChartInst.destroy();

        const ctxMacro = document.getElementById('macroChart');
        if(ctxMacro) {
            macroChartInst = new Chart(ctxMacro, {
                type: 'doughnut',
                data: {
                    labels: ['Protein', 'Carbs', 'Fats'],
                    datasets: [{
                        data: [proteinTgt * 4, carbsTgt * 4, fatsTgt * 9],
                        backgroundColor: ['#2d6a4f', '#74c69d', '#f4845f'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: { legend: { display: false } }
                }
            });
        }

        const ctxCal = document.getElementById('calorieChart');
        if(ctxCal) {
            let consumed = Math.round(targetCals * 0.45); // visually appealing dummy data for today
            calorieChartInst = new Chart(ctxCal, {
                type: 'bar',
                data: {
                    labels: ['Consumed', 'Target'],
                    datasets: [{
                        data: [consumed, targetCals],
                        backgroundColor: ['#f4845f', '#2d6a4f'],
                        borderRadius: 5,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, display: false },
                        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', weight: 'bold' } } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: function(context) { return context.raw + ' kcal'; } } }
                    }
                }
            });
        }
    } else {
        dash.style.display = 'none';
    }
}

async function loadMenu() {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const res = await fetch(`${API_URL}/menu`, { headers });
    menuData = await res.json();
    renderMenu(menuData);
}

function renderMenu(items) {
    const grid = document.getElementById('menu-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const sorted = [...items].sort((a,b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));

    sorted.forEach(item => {
        const recBadge = item.isRecommended ? `<div class="rec-badge">✨ Recommended for You</div>` : '';
        const qtyInCart = cart[item.id] || 0;
        const qtyDisplay = qtyInCart > 0 ? `<div style="position:absolute; bottom:65px; right:20px; background:rgba(26,26,46,0.8); color:white; padding:2px 8px; border-radius:10px; font-size:0.8rem; backdrop-filter:blur(5px);">${qtyInCart} in cart</div>` : '';
        
        grid.innerHTML += `
        <div class="menu-item">
            ${recBadge}
            <img src="${item.image}" alt="${item.name}" class="menu-img">
            <div class="menu-name">${item.name}</div>
            <div style="color: #666; font-size:0.85rem; margin-bottom:10px; font-weight:600;">${item.tags.join(' • ')}</div>
            <div class="menu-price">₹${item.price}</div>
            ${qtyDisplay}
            <button class="add-btn" onclick="addToCart(${item.id})">+</button>
        </div>`;
    });
}

function filterMenu(tag, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.style.background = 'white';
        b.style.color = 'var(--green)';
    });
    btn.style.background = 'var(--green)';
    btn.style.color = 'white';

    if (tag === 'All') renderMenu(menuData);
    else renderMenu(menuData.filter(i => i.tags.includes(tag)));
}

function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    localStorage.setItem('cart', JSON.stringify(cart));
    
    updateCartBadge();
    
    if(document.getElementById('menu-grid')) {
        renderMenu(menuData);
    }
}

async function loadCheckout() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        alert("Please login to place an order.");
        window.location.href = '/login';
        return;
    }

    const container = document.getElementById('checkout-items');
    if(!container) return;

    const resMenu = await fetch(`${API_URL}/menu`);
    const allMenu = await resMenu.json();
    
    let total = 0;
    container.innerHTML = '';
    
    if (Object.keys(cart).length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">Your cart is empty.</p>';
        document.getElementById('place-order-btn').disabled = true;
        document.getElementById('total-price').innerText = `₹0`;
        return;
    }

    Object.entries(cart).forEach(([id, qty]) => {
        const item = allMenu.find(m => m.id == id);
        if(!item) return;
        total += item.price * qty;
        container.innerHTML += `
        <div class="cart-item-sm">
            <img src="${item.image}" class="cart-item-img">
            <div style="flex:1;">
                <strong>${item.name}</strong><br>
                <div style="display:inline-flex; align-items:center; gap:8px; margin-top:5px;">
                    <button class="btn" style="padding:0; width:22px; height:22px; border-radius:5px; background:#ddd; color:#333; line-height:1;" onclick="updateCartItem(${id}, -1)">-</button>
                    <span style="font-weight:bold; width:15px; text-align:center;">${qty}</span>
                    <button class="btn" style="padding:0; width:22px; height:22px; border-radius:5px; background:#ddd; color:#333; line-height:1;" onclick="updateCartItem(${id}, 1)">+</button>
                </div>
            </div>
            <div style="font-weight:900; color:var(--green); font-size:1.1rem;">₹${item.price * qty}</div>
        </div>`;
    });

    let discountAmount = total * discountPercent;
    let finalTotal = total - discountAmount;

    if (discountPercent > 0) {
        document.getElementById('total-price').innerHTML = `
            <div style="font-size:1rem; color:#888; text-decoration:line-through; font-weight:600;">₹${total.toFixed(2)}</div>
            <div style="color:var(--orange); font-size:1.1rem;">- ₹${discountAmount.toFixed(2)}</div>
            <div>₹${finalTotal.toFixed(2)}</div>
        `;
    } else {
        document.getElementById('total-price').innerText = `₹${total.toFixed(2)}`;
    }
    
    checkPincodeETA();
}

function checkPincodeETA() {
    const pincode = document.getElementById('pincode-input').value.trim();
    const err = document.getElementById('address-error');
    const etaDisplay = document.getElementById('eta-display');
    const btn = document.getElementById('place-order-btn');

    if (/^560\d{3}$/.test(pincode)) {
        err.style.display = 'none';
        const calcEta = (parseInt(pincode.slice(-2)) % 30) + 15;
        currentETA = calcEta;
        etaDisplay.innerText = `Estimated Delivery: ${currentETA} mins`;
        btn.disabled = Object.keys(cart).length === 0;
    } else {
        err.style.display = 'block';
        etaDisplay.innerText = '';
        currentETA = null;
        btn.disabled = true;
    }
}

function toggleCardFields() {
    const paymentMethods = document.getElementsByName('payment');
    let selected = 'upi';
    for(let m of paymentMethods) {
        if(m.checked) selected = m.value;
    }
    
    const cardDetails = document.getElementById('card-details');
    if(selected === 'card') {
        cardDetails.style.display = 'block';
    } else {
        cardDetails.style.display = 'none';
    }
}

function initiateOrder() {
    if(!currentETA) {
        alert("Please enter a valid pincode and check ETA first.");
        return;
    }

    const paymentMethods = document.getElementsByName('payment');
    let selected = 'upi';
    for(let m of paymentMethods) {
        if(m.checked) selected = m.value;
    }

    if(selected === 'card') {
        document.getElementById('otp-modal').style.display = 'flex';
    } else {
        finalSubmitOrder();
    }
}

function verifyOTP() {
    const otp = document.getElementById('otp-input').value;
    if(otp.length === 4) {
        document.getElementById('otp-modal').style.display = 'none';
        finalSubmitOrder();
    } else {
        alert("Please enter a 4-digit OTP.");
    }
}

async function finalSubmitOrder() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/order`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cart, address: { eta: currentETA } })
    });

    const data = await res.json();
    if(res.ok) {
        alert('🎉 Order Placed successfully! Expected delivery in ' + data.eta + ' mins.');
        localStorage.removeItem('cart');
        window.location.href = '/';
    } else {
        alert('Error placing order: ' + (data.error || 'Unknown error'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initNav();
    if(document.getElementById('menu-grid')) {
        loadMenu();
    }
    if(document.getElementById('checkout-items')) {
        loadCheckout();
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}
