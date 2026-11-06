CREATE DATABASE IF NOT EXISTS shopping_cart_db;
USE shopping_cart_db;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role VARCHAR(20) DEFAULT 'customer'
);

CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stck INT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS cart (
    cart_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    order_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'Pending',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

INSERT INTO users (name, password, phone, role) VALUES 
('Admin User', 'admin123', '1234567890', 'admin'),
('John Doe', 'user123', '0987654321', 'customer');

INSERT INTO products (product_name, category, price, stck, description) VALUES 
('Wireless Headphones', 'Electronics', 99.99, 15, 'High quality noise canceling headphones.'),
('Mechanical Keyboard', 'Electronics', 129.50, 10, 'RGB backlit mechanical gaming keyboard.'),
('Cotton T-Shirt', 'Apparel', 19.99, 50, '100% organic cotton daily t-shirt.'),
('Running Shoes', 'Footwear', 85.00, 20, 'Lightweight comfortable running sneakers.');sudo mysql < schema.sql