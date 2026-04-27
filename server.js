const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'healthbite_hackathon_super_secret';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers to read/write JSON
const readData = (filename) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', filename), 'utf-8'));
const writeData = (filename, data) => fs.writeFileSync(path.join(__dirname, 'data', filename), JSON.stringify(data, null, 2));

// API Routes

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password, age, gender, goal, weight } = req.body;
    const users = readData('users.json');

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = { id: Date.now(), name, email, password: hashedPassword, age: parseInt(age), gender: gender.toLowerCase(), goal, weight: parseInt(weight) };
    users.push(newUser);
    writeData('users.json', users);

    const token = jwt.sign({ id: newUser.id, name, age, gender: gender.toLowerCase(), goal, weight: parseInt(weight) }, SECRET_KEY, { expiresIn: '100y' });
    res.json({ token, user: { name, age, gender: gender.toLowerCase(), goal, weight: parseInt(weight) } });
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const users = readData('users.json');
    const user = users.find(u => u.email === email);

    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, name: user.name, age: user.age, gender: user.gender, goal: user.goal, weight: user.weight }, SECRET_KEY, { expiresIn: '100y' });
    res.json({ token, user: { name: user.name, age: user.age, gender: user.gender, goal: user.goal, weight: user.weight } });
});

// Auth Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

// Get Profile
app.get('/api/profile', auth, (req, res) => {
    res.json(req.user);
});

// Get Menu (with recommendations if logged in)
app.get('/api/menu', (req, res) => {
    const menu = readData('menu.json');
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    let user = null;
    if (token && token !== 'null') {
        try {
            user = jwt.verify(token, SECRET_KEY);
        } catch (e) {}
    }

    const menuWithRecs = menu.map(item => {
        let recommended = false;
        if (user) {
            const ageMatch = user.age >= item.recommended_for.minAge && user.age <= item.recommended_for.maxAge;
            const genderMatch = item.recommended_for.genders.includes('all') || item.recommended_for.genders.includes(user.gender.toLowerCase());
            
            // Weight & Goal custom filtering logic
            let goalMatch = true;
            if (user.weight > 85 || user.goal === 'weight_loss') {
                if (item.tags.includes('High Calorie')) goalMatch = false;
            }
            if (user.weight < 60 || user.goal === 'muscle_gain') {
                if (!item.tags.includes('High Protein') && !item.tags.includes('High Calorie')) goalMatch = false;
            }

            if (ageMatch && genderMatch && goalMatch) {
                recommended = true;
            }
        }
        return { ...item, isRecommended: recommended };
    });

    res.json(menuWithRecs);
});

// Get Areas
app.get('/api/areas', (req, res) => {
    res.json(readData('areas.json'));
});

// Place Order
app.post('/api/order', auth, (req, res) => {
    const { items, address, paymentMethod, total } = req.body;
    res.json({ message: 'Order placed successfully!', orderId: `ORD${Date.now()}`, eta: address.eta });
});

// Serve frontend paths explicitly, redirecting to appropriate HTML
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkout.html')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
