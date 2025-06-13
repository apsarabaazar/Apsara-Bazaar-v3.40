// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendEmail} = require('../mailer'); // Correctly import sendEmail

// Utility function to generate a 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

router.get('/signup', (req, res) => {
    if (req.session.user) {
        res.redirect('/'); // Redirect to the homepage if logged in
    } else {
        res.render('auth/signup'); // Render signup page if not logged in
    }
});
router.post('/send-otp', async (req, res) => {
    const { name, username, email, password } = req.body;

    // List of reserved usernames (all checked in lowercase)
    const reservedUsernames = [
        'admin',
        'administrator',
        'root',
        'superuser',
        'support',
        'help',
        'test',
        'user',
        'info',
        'contact',
        'mail',
        'guest',
        'system',
        'manager',
        'moderator',
        'staff',
        'owner',
        'Anonumous'
    ];

    // Block reserved usernames
    if (reservedUsernames.includes(username.trim().toLowerCase())) {
        return res.status(400).send({ message: 'Username not allowed. Please choose a different one.' });
    }

    const emailPattern = /@gmail\.com$/;
    if (!emailPattern.test(email)) {
        return res.status(400).send({ message: 'Invalid email. Must end with "@gmail.com"' });
    }

    try {
        // Check if email already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).send({ message: 'Email already exists' });

        // Check if username already exists
        user = await User.findOne({ username });
        if (user) return res.status(400).send({ message: 'Username already exists' });

        // Generate a random OTP
        const currentOtp = generateOtp();
        const otpemail = {
            to: email,
            subject: 'Your OTP for Apsara Bazaar',
            text: `Your OTP code is ${currentOtp}`
        };
        await sendEmail(otpemail);

        // Store user data and OTP temporarily until OTP is verified
        req.session.pendingUser = { name, username, email, password, otp: currentOtp };

        res.status(200).json({ message: 'OTP sent to your email. Please verify.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Endpoint for verifying OTP
router.post('/verify-otp', async (req, res) => {
    const { otp } = req.body;
    const { otp: currentOtp, ...pendingUser } = req.session.pendingUser || {};

    if (!currentOtp || otp !== currentOtp) {
        return res.status(400).send({ message: 'Invalid OTP. Please try again.' });
    }

    // Proceed with user registration after OTP verification
    const { name, username, email, password } = pendingUser;

    try {
        // Create new user
        const newUser = new User({ name, username, email, password, rank: "Fapper" });
        await newUser.save();
        console.log("New User registered: " + newUser);
        req.session.user = newUser;

        delete req.session.pendingUser; // Clear pending user data
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});
router.get('/login', (req, res) => {
    if (req.session.user) {
        res.redirect('/'); // Redirect to the homepage if logged in
    } else {
        res.render('auth/login'); // Render login page if not logged in
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send({ message: 'User not found' });

        if (user.password !== password) return res.status(400).send({ message: 'Invalid Password' });

        req.session.user = user;
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/logout', (req, res) => {
    // Preserve guest session if it exists
    const guestData = req.session.guest;

    // Regenerate the session (destroys current session and creates a new one)
    req.session.regenerate((err) => {
        if (err) {
            console.error('Session regeneration error:', err);
            return res.status(500).send('Error logging out');
        }

        // Restore guest data into the new session
        if (guestData) {
            req.session.guest = guestData;
        }

        res.redirect('/');
    });
});


router.get('/create-post', (req, res) => {
    if (!req.session.user && !req.session.guest) {
        return res.status(401).send({ message: 'Unauthorized. Please log in to create a post.' });
    }
    res.render('auth/create-post'); // Render the post.ejs page
});

module.exports = router;
