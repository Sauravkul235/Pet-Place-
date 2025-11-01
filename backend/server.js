require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');

const app = express();
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// 🔍 Debug log every incoming request
app.use((req, res, next) => {
  console.log(`🧭 ${req.method} ${req.url}`);
  next();
});
app.use(bodyParser.json());
app.use(express.json());
app.use('/image', express.static(path.join(__dirname, 'Frontend/image')));
app.use(express.static(path.join(__dirname, 'public')));  
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error(' MySQL connection failed:', err);
    process.exit(1);
  } else {
    console.log(' Connected to MySQL database (petplace)');
    connection.release();
  }
});

function generateToken(userId) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set in .env');
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// JWT Middleware 
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied - No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;  
    next();
  });
}

// Root Test
app.get('/', (req, res) => {
  res.send('Pet Place Backend ');
});

//----- AUTH ROUTES -----
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Please fill all fields (name, email, phone, password)' });
  }
  if (name.length > 100 || email.length > 100) {
    return res.status(400).json({ message: 'Name or email too long (max 100 characters)' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ message: 'Phone number must be 10 digits' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB connection error:', err);
      return res.status(500).json({ message: 'Server error during signup' });
    }

    connection.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone], (err, results) => {
      if (err) {
        connection.release();
        console.error('Query error:', err);
        return res.status(500).json({ message: 'Server error during signup' });
      }
      if (results.length > 0) {
        connection.release();
        return res.status(400).json({ message: 'Email or phone already registered' });
      }

      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          connection.release();
          console.error('Hash error:', err);
          return res.status(500).json({ message: 'Server error during signup' });
        }

        connection.query(
          'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
          [name, email, phone, hashedPassword],
          (err, result) => {
            connection.release();
            if (err) {
              console.error('Insert error:', err);
              return res.status(500).json({ message: 'Server error during signup' });
            }

            const userId = result.insertId;
            const token = generateToken(userId);

            db.query('SELECT id, name, email, phone, created_at FROM users WHERE id = ?', [userId], (err, users) => {
              if (err) {
                console.error('Fetch user error:', err);
                return res.status(500).json({ message: 'Server error' });
              }
              const user = users[0];

              res.status(201).json({
                message: 'User registered successfully',
                token,
                user
              });
            });
          }
        );
      });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please fill email and password' });
  }
  if (email.length > 100) {
    return res.status(400).json({ message: 'Email too long (max 100 characters)' });
  }

  db.getConnection((err, connection) => {
    if (err) {
      console.error('DB connection error:', err);
      return res.status(500).json({ message: 'Server error during login' });
    }

    connection.query('SELECT id, name, email, phone, password FROM users WHERE email = ?', [email], (err, users) => {
      connection.release();
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ message: 'Server error during login' });
      }
      if (users.length === 0) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = users[0];

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error('Compare error:', err);
          return res.status(500).json({ message: 'Server error during login' });
        }
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = generateToken(user.id);

        db.query('SELECT id, name, email, phone, created_at FROM users WHERE id = ?', [user.id], (err, userDetails) => {
          if (err) {
            console.error('Fetch user error:', err);
            return res.status(500).json({ message: 'Server error' });
          }
          const userData = userDetails[0];

          res.json({
            message: 'Login successful',
            token,
            user: userData
          });
        });
      });
    });
  });
});

//---- user for admin table -----
app.get('/api/users', (req, res) => {
  db.query('SELECT id, name, email, phone, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      console.error('Fetch users error:', err);
      return res.status(500).json({ message: 'Server error fetching users' });
    }
    res.json({ users });
  });
});

//-----product routes -----
app.get('/api/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json({ products: results });
  });
});

app.get('/api/products/:id',(req, res) => {  
  const id = req.params.id;
  console.log(` Fetching product with ID: ${id}`);
  db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Product fetch error:', err);
      return res.status(500).json({ message: 'Server error fetching product' });
    }
    if (results.length > 0) {
      res.json({ product: results[0] });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  });
});

app.post('/api/products', authenticateToken, (req, res) => {  
  const { name, category, price, stock, description, image_url } = req.body;
  if (!name || !category || price <= 0) {
    return res.status(400).json({ message: 'Invalid input: Name and category required; price > 0' });
  }
  db.query(
    'INSERT INTO products (name, category, price, stock, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [name, category, price, stock || 0,  description,  image_url],
    (err, result) => {
      if (err) {
        console.error('Product insert error:', err);
        return res.status(500).json({ message: 'Server error adding product' });
      }
      res.status(201).json({ message: 'Product added', id: result.insertId });
    }
  );
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { name, description, category, price, stock, image_url } = req.body;
  console.log(`Attempting to update product ID: ${id} with data:`, req.body);  
  db.query(
    'UPDATE products SET name=?, description=?, category=?, price=?, stock=?, image_url=? WHERE id=?',
    [name, description, category, price, stock, image_url, id],
    (err, result) => {
      if (err) {
        console.error('SQL error updating product:', err);  
        return res.status(500).json({ message: 'Server error: ' + err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM products WHERE id=?', [id], (err, result) => {
    if (err || result.affectedRows === 0) {
      return res.status(500).json({ message: 'Server error deleting product' });
    }
    res.json({ message: 'Product deleted' });
  });
});

//---- orders routes -----
app.get('/api/orders', authenticateToken, (req, res) => {
  console.log('📥 Fetching orders for admin');
  db.query(`
    SELECT o.*, u.name as user_name, p.name as product_name 
    FROM orders o 
    JOIN users u ON o.user_id = u.id 
    JOIN products p ON o.product_id = p.id 
    ORDER BY o.created_at DESC
  `, (err, orders) => {
    if (err) {
      console.error('Orders fetch error:', err);
      return res.status(500).json({ message: 'Server error fetching orders' });
    }
    res.json({ orders });
  });
});

// POST /api/orders (Creates a new order)
app.post('/api/orders', authenticateToken, (req, res) => {
  const { product_id, quantity, total_price, customer_name, payment_method } = req.body;
  const user_id = req.user.userId;  
  if (!product_id || quantity <= 0 || total_price <= 0){
    return res.status(400).json({ message: 'Invalid order data: product_id, quantity > 0, total_price > 0 required' });
  }
  db.query('SELECT stock FROM products WHERE id = ?', [product_id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const stock = results[0].stock;
    if (stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    db.query(
      'INSERT INTO orders (user_id, product_id, quantity, total_price, status, payment_method) VALUES (?, ?, ?, ?, "Pending", ?)',
      [user_id, product_id, quantity, total_price, payment_method],
      (err, result) => {
        if (err) {
          console.error('Order insert error:', err);
          return res.status(500).json({ message: 'Server error creating order' });
        }
        db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product_id], (err) => {
          if (err) console.error('Stock update error:', err);
        });
        res.status(201).json({ message: 'Order created successfully', order_id: result.insertId });
      }
    );
  });
});

app.put('/api/orders/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {  // Changed to lowercase
    return res.status(400).json({ message: 'Invalid status' });
  }
     
  db.query('UPDATE orders SET status=? WHERE id=?', [status, id], (err, result) => {
    if (err || result.affectedRows === 0) {
      return res.status(500).json({ message: 'Server error updating order' });
    }
    res.json({ message: 'Order status updated' });
  });
});
 
//DELETE route for cleaning up completed/cancelled orders
app.delete('/api/orders/cleanup', authenticateToken, (req, res) => {
  const sql = 'DELETE FROM orders WHERE status IN ("completed", "cancelled")';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error deleting completed/cancelled orders:', err);
      return res.status(500).json({ error: 'Failed to delete completed/cancelled orders' });
    }
    res.json({ message: `${result.affectedRows} completed/cancelled orders deleted successfully.` });
  });
});

//----- appointments routes -----
app.get('/api/appointments', authenticateToken, (req, res) => {
  console.log('📥 Fetching all appointments for admin');
  db.query(`
    SELECT a.*, u.name as customer_name
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.appointment_date DESC
  `, (err, appointments) => {
    if (err) {
      console.error('Appointments fetch error:', err);
      return res.status(500).json({ message: 'Server error fetching appointments' });
    }
    console.log('Fetched appointments:', appointments.length);
    res.json({ appointments });
  });
});

app.get('/api/appointments/date/:date', authenticateToken, (req, res) => {
  const date = req.params.date;
  const userId = req.user.userId;

  const query = `
    SELECT appointment_time, user_id, status 
    FROM appointments 
    WHERE DATE(appointment_date) = ? 
      AND status IN ("confirmed", "pending")
  `;

  db.query(query, [date], (err, results) => {
    if (err) {
      console.error('Appointments fetch error:', err);
      return res.status(500).json({ message: 'Server error fetching appointments' });
    }

    // Return which slots are booked and who owns them
    const bookedSlots = {};
    results.forEach(a => {
      bookedSlots[a.appointment_time] = {
        booked: true,
        ownedByUser: a.user_id === userId,
        status: a.status
      };
    });

    res.json(bookedSlots);
  });
});

// POST /api/appointments (Creates a new appointment)
app.post('/api/appointments', authenticateToken, (req, res) => {
  const { customer_name, customer_phone, pet_type, service_type, appointment_date, appointment_time, additional_notes } = req.body;
  const user_id = req.user.userId; 
  
  if (!customer_name || !customer_phone || !pet_type || !service_type || !appointment_date || !appointment_time) {
    console.error('Bad request: Missing fields', req.body);
    return res.status(400).json({ message: 'Missing required fields' });
  }
  db.query(
    'INSERT INTO appointments (user_id, customer_name, customer_phone, pet_type, service_type, appointment_date, appointment_time, additional_notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending")',
    [user_id, customer_name, customer_phone, pet_type, service_type, appointment_date, appointment_time, additional_notes],
    (err, result) => {
      if (err) {
         console.error('Database error:', err);  
        return res.status(500).json({ message: 'Server error creating appointment' });
      }
      res.status(201).json({ message: 'Appointment booked successfully', id: result.insertId });
    }
  );
});

app.put('/api/appointments/cancel', authenticateToken, (req, res) => {
  console.log('Cancel request body:', req.body);
  console.log(' Authenticated user:', req.user);

  const { appointment_date, appointment_time } = req.body;
  const user_id = req.user.userId; 

  if (!appointment_date || !appointment_time) {
    return res.status(400).json({ message: 'Missing date or time' });
  }

  const query = `
    DELETE FROM appointments 
    WHERE appointment_date = ? 
    AND appointment_time = ? 
    AND user_id = ?;
  `;

  db.query(query, [appointment_date, appointment_time, user_id], (err, result) => {
    if (err) {
      console.error('Cancel error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No appointment found or not yours' });
    }

    res.json({ message: 'Appointment cancelled successfully!' });
  });
});

//  PUT /api/appointments/reschedule - Reschedule an appointment
app.put('/api/appointments/reschedule', authenticateToken, (req, res) => {
  const { old_date, old_time, new_date, new_time } = req.body;
  const user_id = req.user.userId;

  if (!old_date || !old_time || !new_date || !new_time) {
    return res.status(400).json({ message: 'Missing old/new date or time' });
  }

  const query = `
    UPDATE appointments
    SET appointment_date = ?, appointment_time = ?, status = "pending"
    WHERE user_id = ? AND appointment_date = ? AND appointment_time = ?
  `;

  db.query(query, [new_date, new_time, user_id, old_date, old_time], (err, result) => {
    if (err) {
      console.error('Reschedule error:', err);
      return res.status(500).json({ message: 'Database error during reschedule' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No matching appointment found or not owned by user' });
    }

    res.json({ message: 'Appointment rescheduled successfully' });
  });
});

// PUT route for updating appointment status
app.put('/api/appointments/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  db.query('UPDATE appointments SET status=? WHERE id=?', [status, id], (err, result) => {
    if (err || result.affectedRows === 0) {
      console.error('Appointment update error:', err);
      return res.status(500).json({ message: 'Server error updating appointment' });
    }
    res.json({ message: 'Appointment status updated' });
  });
});
cron.schedule('* * * * *', () => {
  console.log('🧪 Test cleanup job running every minute...');
  const today = new Date().toISOString().split('T')[0];
  db.query('DELETE FROM appointments WHERE appointment_date < ?', [today], (err, result) => {
    if (err) console.error('❌ Cleanup test error:', err);
    else console.log(`✅ Deleted ${result.affectedRows} expired appointments`);
  });
});

// DELETE route for cleaning up old appointments
app.delete('/api/appointments/cleanup', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.query('DELETE FROM appointments WHERE appointment_date < ?', [today], (err, result) => {
    if (err) {
      console.error('Error deleting old appointments:', err);
      return res.status(500).json({ error: 'Failed to delete old appointments' });
    }
    res.json({ message: `${result.affectedRows} old appointments deleted.` });
  });
});

//----- contact messages routes -----
app.post('/api/contact', (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Name, email, and message are required' });
  }

  db.query(
    'INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)',
    [name, email, phone, message],
    (err, result) => {
      if (err) {
        console.error('Error saving contact message:', err);
        return res.status(500).json({ message: 'Server error saving message' });
      }
      res.status(201).json({ message: 'Message sent successfully!' });
    }
  );
});

// Fetch all contact messages for admin panel
app.get('/api/contact', (req, res) => {
  db.query('SELECT * FROM contact_messages ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('Error fetching contact messages:', err);
      return res.status(500).json({ message: 'Server error fetching messages' });
    }
    res.json({ messages: results });
  });
});

//----- Mock Payment Route -----
app.post('/api/mock-payment', authenticateToken, (req, res) => {
  const { method } = req.body || {};
  console.log(`💳 Mock payment initiated using ${method}`);
  
  setTimeout(() => {
    const success = true; 
    
    if (success) {
      res.json({ success: true, message: `Mock payment via ${method} successful.` });
    } else {
      res.status(400).json({ success: false, message: 'Mock payment failed, please retry.' });
    }
  }, 1500);
});

// ---- Export Orders within Date Range (Full Report) ----
app.get('/api/orders/export', authenticateToken, (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: 'Start and end dates are required' });
  }
  const query = `
    SELECT 
      o.id,
      u.name AS user_name,
      p.name AS product_name,
      o.quantity,
      o.total_price,
      o.status,
      o.payment_method,
      o.created_at
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN products p ON o.product_id = p.id
    WHERE DATE(o.created_at) BETWEEN ? AND ?
    ORDER BY o.created_at DESC
  `;

  db.query(query, [start, end], (err, results) => {
    if (err) {
      console.error('❌ Export orders query error:', err);
      return res.status(500).json({ message: 'Server error exporting orders' });
    }

    console.log(`✅ Exported ${results.length} orders from ${start} to ${end}`);
    res.json({ orders: results });
  });
});

app.use((req, res) => {
  console.log('404 for route:', req.url);
  res.status(404).json({ message: 'Route not found: ' + req.url });
});
// Global Error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ message: 'Server error: ' + err.message });
});
// port listener
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

