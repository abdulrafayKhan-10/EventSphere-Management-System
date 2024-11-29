const User = require('../Models/User');
// const bcrypt = require('bcrypt');
const bcryptjs = require("bcryptjs")
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOSTNAME, // e.g., smtp.gmail.com for Gmail
    port: process.env.SMTP_PORT, 
    secure: true, // Set to true if using port 465
    auth: {
        user: process.env.SMTP_USER, // Your SMTP username
        pass: process.env.SMTP_PASS,   // Your SMTP password
    },
});
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, phone, organization } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Email already in use" });
        }

        console.table({ name, email, password, role, phone, organization });

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[cC][oO][mM]$/;
        if (!emailRegex.test(email)) {
            console.log(email)
            return res.status(400).json({ message: "Invalid email format" });
        }

        if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
            console.log(password)
            return res.status(400).json({ message: "Password must be at least 8 characters long and contain both letters and numbers." });
        }

        if (role === 'Organizer' && (!organization || organization.trim() === '')) {
            console.log(organization)
            return res.status(400).json({ message: "Organization is required for the 'Organizer' role" });
        }

        const salt = await bcryptjs.genSalt(10)
        const hashedPassword = await bcryptjs.hash(password, salt)

        console.log(hashedPassword)

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            phone,
            organization,
        });

        await newUser.save();

        const token = jwt.sign({ userId: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '3h' });

        const mailOptions = {
            from: '"Event Sphere" eventsphere@worldoftech.company', // Sender address
            to: email, // Recipient
            subject: 'Welcome to Our Platform!',
            html: `<p>Hi ${name},</p>
                   <p>Thank you for registering. Please verify your email to complete your registration:</p>
                   <p><a href="http://localhost:5000/verify-email?token=${token}">Verify Email</a></p>
                   <p>If you did not register, please ignore this email.</p>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
            } else {
                console.log('Verification email sent:', info.response);
            }
        });

        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                phone: newUser.phone,
                organization: newUser.organization,
                profilePicture: newUser.profilePicture,
                createdAt: newUser.createdAt,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            message: "Login successful",
            token,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            organization: user.organization,
            profilePicture: user.profilePicture,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { name, phone, profilePicture, organization } = req.body;

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (profilePicture) user.profilePicture = profilePicture;
        if (organization && user.role === 'Organizer') user.organization = organization;

        user.updatedAt = Date.now();

        await user.save();

        res.json({
            message: "User updated successfully",
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                organization: user.organization,
                profilePicture: user.profilePicture,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await user.remove();
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createUser, loginUser, getProfile, updateUser, getAllUsers, deleteUser };