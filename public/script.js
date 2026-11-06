let currentUser = null;

// Modal controllers
function openAuthModal() { document.getElementById('auth-modal').classList.add('active'); }
function closeAuthModal() { document.getElementById('auth-modal').classList.remove('active'); }
function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
        tabs[0].classList.add('active');
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
    } else {
        tabs[1].classList.add('active');
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    }
}

// Check Authentication status
async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        const nav = document.getElementById('nav-links');
        if (!nav) return;
        
        if (data.loggedIn) {
            currentUser = data.user;
            nav.innerHTML = `
                <span class="user-badge">${currentUser.name} (${currentUser.role})</span>
                <a href="index.html">Store</a>
                ${currentUser.role === 'customer' ? '<a href="cart.html">Cart/Orders</a>' : ''}
                ${currentUser.role === 'admin' ? '<a href="admin.html">Admin Panel</a>' : ''}
                <button class="btn btn-outline" style="padding:0.4rem 0.8rem;" onclick="logout()">Logout</button>
            `;
        } else {
            currentUser = null;
            nav.innerHTML = `
                <a href="index.html">Store</a>
                <button class="btn btn-primary" onclick="openAuthModal()">Sign In</button>
            `;
        }
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

// Login Form Listener
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('login-name').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            const data = await res.json();
            if (res.ok) {
                window.location.reload();
            } else {
                alert(data.error || 'Login failed.');
            }
        } catch (err) {
            alert('Server connection error.');
        }
    });
}

// Register Form Listener
const regForm = document.getElementById('register-form');
if (regForm) {
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const password = document.getElementById('reg-password').value;
        const phone = document.getElementById('reg-phone').value;
        const role = document.getElementById('reg-role').value;
        
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, phone, role })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Registration successful! Please login now.');
                switchAuthTab('login');
                regForm.reset();
            } else {
                alert(data.error || 'Registration failed.');
            }
        } catch (err) {
            alert('Server connection error.');
        }
    });
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = 'index.html';
}

// Fetch & render products with cards
async function fetchProducts() {
    const search = document.getElementById('search-input')?.value || '';
    const category = document.getElementById('category-input')?.value || '';
    const res = await fetch(`/api/products?search=${search}&category=${category}`);
    const products = await res.json();
    
    const container = document.getElementById('product-list');
    if (!container) return;
    
    if(products.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">No products found.</p>`;
        return;
    }

    container.innerHTML = products.map(p => `
        <div class="product-card">
            <div>
                <span class="badge badge-category">${p.category}</span>
                <h3>${p.product_name}</h3>
                <p>${p.description || 'No description available.'}</p>
                <div class="price">$${Number(p.price).toFixed(2)}</div>
                <span class="badge ${p.stck > 0 ? 'badge-stock' : 'badge-out'}">
                    ${p.stck > 0 ? `${p.stck} In Stock` : 'Out of Stock'}
                </span>
            </div>
            <button class="btn btn-primary" style="margin-top:1rem;" onclick="addToCart(${p.product_id})" ${p.stck < 1 ? 'disabled' : ''}>
                ${p.stck < 1 ? 'Out of Stock' : 'Add to Cart'}
            </button>
        </div>
    `).join('');
}

// Add item to cart
async function addToCart(productId) {
    if (!currentUser) {
        alert('Please sign in first to add items to your cart.');
        openAuthModal();
        return;
    }

    if (currentUser.role !== 'customer') {
        alert('Admin accounts cannot add items to the customer cart.');
        return;
    }

    try {
        const res = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });
        const data = await res.json();

        if (res.ok) {
            alert('Item added to cart!');
        } else {
            alert(data.error || 'Failed to add item to cart.');
        }
    } catch (err) {
        alert('Error connecting to the server.');
    }
}

// Aliases so both fetchCart() and fetchCartItems() work seamlessly
async function fetchCart() {
    await fetchCartItems();
}

// Fetch and render items on cart.html table
async function fetchCartItems() {
    const tableBody = document.getElementById('cart-body');
    const totalContainer = document.getElementById('cart-total');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/cart');
        if (!res.ok) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Please log in as a customer to view your cart.</td></tr>`;
            return;
        }

        const items = await res.json();

        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">Your cart is empty.</td></tr>`;
            if (totalContainer) totalContainer.innerText = '0.00';
            return;
        }

        let total = 0;
        tableBody.innerHTML = items.map(item => {
            const itemTotal = Number(item.price) * item.quantity;
            total += itemTotal;
            return `
                <tr>
                    <td>${item.product_name}</td>
                    <td>$${Number(item.price).toFixed(2)}</td>
                    <td>${item.quantity}</td>
                    <td>$${itemTotal.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-outline" style="padding: 0.2rem 0.6rem; color: #ef4444; border-color: #ef4444;" onclick="removeFromCart(${item.cart_id})">Remove</button>
                    </td>
                </tr>
            `;
        }).join('');

        if (totalContainer) {
            totalContainer.innerText = total.toFixed(2);
        }
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error loading cart items.</td></tr>`;
    }
}

// Remove item from cart
async function removeFromCart(cartId) {
    try {
        const res = await fetch(`/api/cart/${cartId}`, { method: 'DELETE' });
        if (res.ok) {
            fetchCartItems();
        }
    } catch (err) {
        alert('Error removing item.');
    }
}

// Place Order function (Checkout)
async function placeOrder() {
    try {
        const res = await fetch('/api/orders', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert('Order placed successfully!');
            window.location.reload();
        } else {
            alert(data.error || 'Checkout failed.');
        }
    } catch (err) {
        alert('Error completing purchase.');
    }
}

// Fetch Order History placeholder
async function fetchOrderHistory() {
    const historyBody = document.getElementById('order-history-body');
    if (!historyBody) return;

    try {
        const res = await fetch('/api/orders');
        if (!res.ok) return;
        const orders = await res.json();

        if (orders.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">No past orders found.</td></tr>`;
            return;
        }

        historyBody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.order_id}</td>
                <td>${o.order_date ? o.order_date.split('T')[0] : 'N/A'}</td>
                <td>$${Number(o.total_amount).toFixed(2)}</td>
                <td><span class="badge badge-stock">${o.status}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading order history', err);
    }
}