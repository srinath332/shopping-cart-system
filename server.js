const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Database Connection Pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root', // Update with your MySQL password
    database: 'shopping_cart_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'shopping_cart_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Authorization Middleware
const requireAuth = (role = null) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized. Please login.' });
        }
        if (role && req.session.user.role !== role) {
            return res.status(403).json({ error: 'Forbidden. Access restricted.' });
        }
        next();
    };
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    const { name, password, phone, role } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password required.' });

    try {
        const userRole = role === 'admin' ? 'admin' : 'customer';
        const [result] = await db.execute(
            'INSERT INTO users (name, password, phone, role) VALUES (?, ?, ?, ?)',
            [name, password, phone || null, userRole]
        );
        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { name, password } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT user_id, name, role FROM users WHERE name = ? AND password = ?',
            [name, password]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid name or password.' });
        }
        req.session.user = rows[0];
        res.json({ message: 'Login successful', user: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- PRODUCT ROUTES ---
app.get('/api/products', async (req, res) => {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND product_name LIKE ?';
        params.push(`%${search}%`);
    }

    try {
        const [products] = await db.execute(query, params);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', requireAuth('admin'), async (req, res) => {
    const { product_name, category, price, stck, description } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO products (product_name, category, price, stck, description) VALUES (?, ?, ?, ?, ?)',
            [product_name, category, price, stck, description]
        );
        res.status(201).json({ message: 'Product added', productId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', requireAuth('admin'), async (req, res) => {
    const { product_name, category, price, stck, description } = req.body;
    try {
        await db.execute(
            'UPDATE products SET product_name=?, category=?, price=?, stck=?, description=? WHERE product_id=?',
            [product_name, category, price, stck, description, req.params.id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', requireAuth('admin'), async (req, res) => {
    try {
        await db.execute('DELETE FROM products WHERE product_id = ?', [req.params.id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CART ROUTES ---
app.get('/api/cart', requireAuth('customer'), async (req, res) => {
    try {
        const [items] = await db.execute(
            `SELECT c.cart_id, c.quantity, p.product_id, p.product_name, p.price, p.stck 
             FROM cart c 
             JOIN products p ON c.product_id = p.product_id 
             WHERE c.user_id = ?`,
            [req.session.user.user_id]
        );
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cart', requireAuth('customer'), async (req, res) => {
    const { product_id, quantity } = req.body;
    const userId = req.session.user.user_id;

    try {
        const [existing] = await db.execute(
            'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
            [userId, product_id]
        );

        if (existing.length > 0) {
            await db.execute(
                'UPDATE cart SET quantity = quantity + ? WHERE cart_id = ?',
                [quantity || 1, existing[0].cart_id]
            );
        } else {
            await db.execute(
                'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
                [userId, product_id, quantity || 1]
            );
        }
        res.json({ message: 'Item added to cart' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/cart/:id', requireAuth('customer'), async (req, res) => {
    const { quantity } = req.body;
    try {
        await db.execute('UPDATE cart SET quantity = ? WHERE cart_id = ?', [quantity, req.params.id]);
        res.json({ message: 'Cart updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/cart/:id', requireAuth('customer'), async (req, res) => {
    try {
        await db.execute('DELETE FROM cart WHERE cart_id = ?', [req.params.id]);
        res.json({ message: 'Item removed from cart' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ORDER ROUTES ---
app.post('/api/orders', requireAuth('customer'), async (req, res) => {
    const userId = req.session.user.user_id;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [cartItems] = await connection.execute(
            `SELECT c.product_id, c.quantity, p.price, p.stck 
             FROM cart c JOIN products p ON c.product_id = p.product_id 
             WHERE c.user_id = ?`,
            [userId]
        );

        if (cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Cart is empty' });
        }

        let totalAmount = 0;
        for (const item of cartItems) {
            if (item.stck < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ error: `Insufficient stock for product ID ${item.product_id}` });
            }
            totalAmount += item.price * item.quantity;
        }

        const [orderResult] = await connection.execute(
            'INSERT INTO orders (user_id, total_amount, order_date, status) VALUES (?, ?, CURDATE(), "Pending")',
            [userId, totalAmount]
        );

        for (const item of cartItems) {
            await connection.execute(
                'UPDATE products SET stck = stck - ? WHERE product_id = ?',
                [item.quantity, item.product_id]
            );
        }

        await connection.execute('DELETE FROM cart WHERE user_id = ?', [userId]);

        await connection.commit();
        res.status(201).json({ message: 'Order placed successfully', orderId: orderResult.insertId });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.get('/api/orders', requireAuth(), async (req, res) => {
    try {
        let query = 'SELECT o.*, u.name as customer_name FROM orders o JOIN users u ON o.user_id = u.user_id';
        let params = [];

        if (req.session.user.role !== 'admin') {
            query += ' WHERE o.user_id = ?';
            params.push(req.session.user.user_id);
        }

        query += ' ORDER BY o.order_id DESC';
        const [orders] = await db.execute(query, params);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});