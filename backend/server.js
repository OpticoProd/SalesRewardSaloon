const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const { createCanvas } = require('canvas');
const { JSDOM } = require('jsdom');
const { jsPDF } = require('jspdf');
const bodyParser = require('body-parser');
const { Buffer } = require('buffer');
const { initializeSocket } = require('./socket'); // socket helper (will return io)
let io = null; // will be set when HTTP server is created
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Middleware to parse JSON and handle CORS
app.use(express.json({ limit: '10mb' })); // Adjust if needed
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(
  cors({
    // origin: ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000'],
    origin: '*',
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: '10mb' }));

// Serve uploaded reward images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/barcodes', require('./routes/generatedBarcodes'));
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB schemas
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  plainPassword: { type: String, select: false },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  status: { type: String, enum: ['pending', 'approved', 'disapproved'], default: 'pending' },
  points: { type: Number, default: 0 },
  location: String,
  uniqueCode: {
    type: String,
    unique: true,
    sparse: true,
    required: function () {
      return this.role === 'admin' || this.role === 'superadmin';
    },
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () {
      return this.role === 'user';
    },
  },
  userLimit: { type: Number, default: null },
  rewardProgress: [
    {
      rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' },
      pointsEarned: { type: Number, default: 0 },
    },
  ],
});

const BarcodeSchema = new mongoose.Schema({
  value: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pointsAwarded: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  location: String,
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: mongoose.Schema.Types.Mixed,
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { unique: true }
);

const BarcodeRangeSchema = new mongoose.Schema({
  start: { type: String, required: true },
  end: { type: String, required: true },
  points: { type: Number, required: true, min: 0 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const PreGeneratedBarcodeSchema = new mongoose.Schema({
  value: { type: String, unique: true, required: true },
  baseValue: { type: String, required: true },
  suffix: { type: String, required: true },
  rangeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BarcodeRange', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, required: true },
});

const RewardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  bundalValue: { type: Number },
  pointsRequired: { type: Number, required: true },
  image: { type: String }, // Base64 or URL for reward image
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: { type: String, required: true },
  // type: { type: String, enum: ['reward_achieved', 'redemption_request', 'redemption_approved'], required: true },
  // type: { type: String, enum: ['reward_achieved', 'redemption_request', 'redemption_approved', 'user_registration'], required: true }, // <--- FIX HERE
  type: {
    type: String,
    enum: [
      'reward_achieved',
      'redemption_request',
      'redemption_approved',
      'user_registration',
      'admin_registration',
    ],
    required: true,
  },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
// NEW - History schema to log edits/scans/rewards (added for timeline feature)
const HistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: [
      'edit',
      'scan',
      'reward',
      'redemption',
      'point_add',
      'point_redeem',
      'cash_reward',
      'barcode_range_created',
      'password_change', // ✅ Added this
    ],
    required: true,
  },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: { type: String },
  details: { type: mongoose.Schema.Types.Mixed }, // {amount, barcode?, by, etc.}
  createdAt: { type: Date, default: Date.now },
});

// NEW - model registration
const History = mongoose.model('History', HistorySchema);

const RewardRedemptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
  type: { type: String, enum: ['item', 'cash'], default: 'item' }, // ✅ New field for cash vs item redemption
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  redeemedAt: { type: Date, default: Date.now },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const Reward = mongoose.model('Reward', RewardSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const RewardRedemption = mongoose.model('RewardRedemption', RewardRedemptionSchema);

// MongoDB models
const User = mongoose.model('User', UserSchema);
const Barcode = mongoose.model('Barcode', BarcodeSchema);
const Setting = mongoose.model('Setting', SettingSchema);
const BarcodeRange = mongoose.model('BarcodeRange', BarcodeRangeSchema);
const PreGeneratedBarcode = mongoose.model('PreGeneratedBarcode', PreGeneratedBarcodeSchema);

// Generate unique code
const generateUniqueCode = async (name, role) => {
  if (!['user', 'admin', 'superadmin'].includes(role)) return null;
  const base = name.toLowerCase().replace(/\s+/g, '');
  let code,
    count = 1;
  do {
    code = `${base}-${String(count).padStart(3, '0')}`;
    count++;
  } while (await User.findOne({ uniqueCode: code }));
  return code;
};

// Generate random 5-character alphanumeric suffix
const generateRandomSuffix = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return suffix;
};

// Setup super admin
const setupSuperAdmin = async () => {
  try {
    const superAdmin = await User.findOne({ role: 'superadmin' });
    if (!superAdmin) {
      const plainPassword = 'Admin123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const uniqueCode = 'SUPERADMINDEMO';
      await User.create({
        name: 'Salon prod',
        mobile: '1234567890',
        password: hashedPassword,
        plainPassword,
        role: 'superadmin',
        status: 'approved',
        uniqueCode,
        adminId: null,
      });
      console.log('Super Admin created', { name: 'Salon prod', mobile: '1234567890', pass: 'Admin123' });
    }
  } catch (error) {
    console.error('Error setting up super admin:', error);
  }
};
setupSuperAdmin();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  // ✅ Remove 'Bearer ' prefix
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId);
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to check roles
const checkRole = roles => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `${roles.join(' or ')} access required` });
  }
  next();
};

// Input validation for registration
const validateRegister = [
  body('name').notEmpty().withMessage('Name is required'),
  body('mobile').isMobilePhone().withMessage('Valid mobile number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('adminId')
    .if(body('role').equals('user'))
    .notEmpty()
    .withMessage('Admin ID is required for users'),
];

// Input validation for login
const validateLogin = [
  body('mobile').isMobilePhone().withMessage('Valid mobile number is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register a new user
app.post('/register', validateRegister, handleValidationErrors, async (req, res) => {
  try {
    const { name, mobile, password, location, adminId, role } = req.body;

    // ✅ Check if mobile already exists
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ message: 'Mobile number already registered' });
    }

    // ✅ If registering user under an admin, validate admin
    if (role === 'user' && adminId) {
      const admin = await User.findOne({ _id: adminId, role: 'admin', status: 'approved' });
      if (!admin) {
        return res.status(400).json({ message: 'Invalid or unapproved admin selected' });
      }
      if (admin.userLimit && (await User.countDocuments({ adminId })) >= admin.userLimit) {
        return res.status(400).json({ message: 'Admin user limit reached' });
      }
    }

    // ✅ Password hash & unique code
    const hashedPassword = await bcrypt.hash(password, 10);
    const uniqueCode =
      role !== 'user'
        ? await generateUniqueCode(name, role)
        : await generateUniqueCode(name, role || 'user');

    if (role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot create superadmin through this endpoint' });
    }

    // ✅ Create user
    const newUser = new User({
      name,
      mobile,
      password: hashedPassword,
      plainPassword: password,
      location,
      role: role || 'user',
      status: 'pending',
      adminId: role === 'user' ? adminId : null,
      uniqueCode,
    });

    await newUser.save();

    // ✅ If admin registered → notify superadmins
    if (newUser.role === 'admin') {
      const superAdmins = await User.find({ role: 'superadmin' });
      const notifications = superAdmins.map(superAdmin => ({
        adminId: superAdmin._id, // The superadmin who receives this
        userId: newUser._id, // The new admin this notification is about
        message: `New admin '${newUser.name}' requires approval.`,
        type: 'admin_registration',
      }));

      if (notifications.length > 0) {
        const createdNotifications = await Notification.insertMany(notifications);
        if (global.emitters) {
          // Live toast notification
          global.emitters.adminNeedsApproval({ id: newUser._id.toString(), name: newUser.name });

          // Send full notification objects for the notification bell/history
          createdNotifications.forEach(notification => {
            const populatedNotification = {
              ...notification.toObject(),
              userId: { _id: newUser._id, name: newUser.name },
            };
            global.emitters.notificationUpdated(populatedNotification);
          });
        }
      }
    }

    // ✅ If user registered under admin → notify that admin
    if (newUser.status === 'pending' && newUser.role === 'user') {
      const adminNotification = new Notification({
        adminId: newUser.adminId,
        message: `New user ${newUser.name} (${newUser.mobile}) registered and awaiting approval.`,
        type: 'user_registration',
        userId: newUser._id,
        read: false,
        createdAt: Date.now(),
      });
      await adminNotification.save();

      // ✅ Socket emit for admin bell updates
      if (global.emitters) {
        global.emitters.userPendingApproval({
          userId: newUser._id.toString(),
          name: newUser.name,
          mobile: newUser.mobile,
          notificationId: adminNotification._id.toString(),
        });
        global.emitters.notificationUpdated(adminNotification.toObject());
      }
    }

    res.status(201).json({
      message: 'Wait for approval from administrator',
      status: newUser.status,
      requiresApproval: newUser.status === 'pending',
      user: newUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Log in a user
app.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { mobile, password } = req.body;
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(400).json({ message: 'Invalid mobile number or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid mobile number or password' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        message:
          user.status === 'pending'
            ? 'Account pending approval. Please contact your administrator.'
            : 'Account has been disapproved',
        status: user.status,
        requiresApproval: true,
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key'
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        uniqueCode: user.uniqueCode,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/generate-pdf', authenticateToken, async (req, res) => {
  console.log('PDF generation request received');
  try {
    const { barcodeSettings, useAdminRanges, selectedRangeId } = req.body;

    let barcodeData = [];
    let prefix = barcodeSettings.prefix;
    let companyName = barcodeSettings.companyName || 'Default Company';
    let pdfMode = barcodeSettings.mode;

    if (useAdminRanges && selectedRangeId) {
      const range = await BarcodeRange.findById(selectedRangeId);
      if (!range) return res.status(400).json({ message: 'Invalid range ID' });

      const barcodes = await PreGeneratedBarcode.find({ rangeId: selectedRangeId });

      if (!barcodes || barcodes.length === 0) {
        return res.status(400).json({ message: 'No barcodes found for selected range' });
      }

      barcodeData = barcodes.map(b => ({
        value: b.value,
        points: b.points,
      }));
      prefix = range.start.match(/^[A-Z]+/)?.[0] || 'OPT';
    } else {
      const { startNumber, count, digitCount, pointsPerScan } = barcodeSettings;
      const points = parseInt(pointsPerScan) || 50;

      if (
        !prefix ||
        !startNumber ||
        !count ||
        !digitCount ||
        isNaN(startNumber) ||
        isNaN(count) ||
        isNaN(digitCount)
      ) {
        return res.status(400).json({ message: 'Invalid barcode settings input.' });
      }

      const maxNumber = parseInt(startNumber) + parseInt(count) - 1;
      const minDigits = Math.ceil(Math.log10(maxNumber + 1));
      if (parseInt(digitCount) < minDigits) {
        return res
          .status(400)
          .json({ message: `Digit count must be at least ${minDigits} for ${count} barcodes` });
      }

      for (let i = 0; i < parseInt(count); i++) {
        barcodeData.push({
          value: `${prefix}${(parseInt(startNumber) + i)
            .toString()
            .padStart(parseInt(digitCount), '0')}`,
          points,
        });
      }
    }

    const doc = new jsPDF({ unit: 'mm', format: [330.2, 482.6], compress: true });
    const cols = 7;
    const rows = 28;
    const layoutWidth = 286;
    const layoutHeight = 451.57;
    const marginX = (330.2 - layoutWidth) / 2;
    const marginY = (482.6 - layoutHeight) / 2;

    const boxWidth = layoutWidth / cols;
    const boxHeight = layoutHeight / rows;
    const barcodeWidth = boxWidth - 8;
    const barcodeHeight = 6;
    const companyFontSize = 5;
    const barcodeFontSize = 5;
    const pointsFontSize = 4;

    let x = marginX;
    let y = marginY;

    for (let i = 0; i < barcodeData.length; i++) {
      const barcodeValue = barcodeData[i].value;
      let imgData = null;

      if (pdfMode !== 'only-outline') {
        const pngBuffer = await bwipjs.toBuffer({
          bcid: 'code128',
          text: barcodeValue,
          scale: 1,
          height: barcodeHeight,
          includetext: false,
        });
        imgData = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      }

      if (pdfMode !== 'without-outline') {
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.setFillColor(255, 255, 255);
        doc.rect(x + 0.5, y + 0.5, boxWidth - 1, boxHeight - 1, 'FD');
      }

      if (pdfMode !== 'only-outline') {
        if (companyName) {
          doc.setFontSize(companyFontSize);
          doc.setFont('helvetica', 'bold');
          const textWidth = doc.getTextWidth(companyName);
          doc.text(companyName, x + (boxWidth - textWidth) / 2, y + 4.2);
        }

        const barcodeX = x + (boxWidth - barcodeWidth) / 2;
        const barcodeY = y + 5.5;
        if (imgData) {
          doc.addImage(imgData, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
        }

        doc.setFontSize(barcodeFontSize);
        doc.setFont('helvetica', 'normal');
        const valTextWidth = doc.getTextWidth(barcodeValue);
        doc.text(barcodeValue, x + (boxWidth - valTextWidth) / 2, barcodeY + barcodeHeight + 3);

        // Optional points rendering
        // doc.setFontSize(pointsFontSize);
        // const pointsText = `Points: ${barcodeData[i].points}`;
        // const pointsTextWidth = doc.getTextWidth(pointsText);
        // doc.text(pointsText, x + (boxWidth - pointsTextWidth) / 2, barcodeY + barcodeHeight + 6);
      }

      x += boxWidth;
      if ((i + 1) % cols === 0) {
        x = marginX;
        y += boxHeight;
      }

      if ((i + 1) % (cols * rows) === 0 && i + 1 < barcodeData.length) {
        doc.addPage();
        x = marginX;
        y = marginY;
      }
    }

    const pdfBase64 = doc.output('datauristring').split(',')[1];
    res.status(200).json({ pdf: pdfBase64 });
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all admins
app.get('/admins', async (req, res) => {
  try {
    let isSuperAdmin = false;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const decoded = jwt.verify(authHeader, process.env.JWT_SECRET || 'your_jwt_secret_key');
        const user = await User.findById(decoded.userId);
        if (user && user.role === 'superadmin') {
          isSuperAdmin = true;
        }
      } catch (error) {
        console.log('Invalid or expired token, proceeding as public request');
      }
    }

    const admins = await User.find(
      { role: 'admin' },
      isSuperAdmin
        ? 'name mobile uniqueCode status createdAt _id userLimit'
        : 'name mobile uniqueCode _id'
    ).where(isSuperAdmin ? {} : { status: 'approved' });

    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ message: 'Server error fetching admins' });
  }
});

// Get pending admins (superadmin only)
app.get('/admins/pending', authenticateToken, checkRole(['superadmin']), async (req, res) => {
  try {
    const admins = await User.find(
      { role: 'admin', status: 'pending' },
      'name mobile uniqueCode createdAt'
    );
    res.json(admins);
  } catch (error) {
    console.error('Error fetching pending admins:', error);
    res.status(500).json({ message: 'Server error fetching pending admins' });
  }
});

// Approve/disapprove admin (superadmin only)
app.put('/admins/:id/status', authenticateToken, checkRole(['superadmin']), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'disapproved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.status = status;
    await admin.save();

    res.json({
      message: `Admin ${status} successfully`,
      admin: {
        id: admin._id,
        name: admin.name,
        mobile: admin.mobile,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error('Error updating admin status:', error);
    res.status(500).json({ message: 'Server error updating admin status' });
  }
});

// Update admin user limit (superadmin only)
app.put(
  '/admins/:id/user-limit',
  authenticateToken,
  checkRole(['superadmin']),
  async (req, res) => {
    try {
      const { userLimit } = req.body;
      if (!Number.isInteger(userLimit) || userLimit < 0) {
        return res.status(400).json({ message: 'Invalid user limit' });
      }

      const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      admin.userLimit = userLimit;
      await admin.save();

      res.json({
        message: 'User limit updated successfully',
        admin: {
          id: admin._id,
          name: admin.name,
          userLimit: admin.userLimit,
        },
      });
    } catch (error) {
      console.error('Error updating user limit:', error);
      res.status(500).json({ message: 'Server error updating user limit' });
    }
  }
);

// Get admin password (superadmin only)
app.get('/admins/:id/password', authenticateToken, checkRole(['superadmin']), async (req, res) => {
  try {
    const admin = await User.findById(req.params.id).select('+plainPassword');
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (!admin.plainPassword) {
      return res.status(400).json({ message: 'Plain password not available' });
    }

    res.json({ password: admin.plainPassword });
  } catch (error) {
    console.error('Error fetching admin password:', error);
    res.status(500).json({ message: 'Server error fetching admin password' });
  }
});

// Update own password (admin or superadmin)
app.put('/admins/:id/password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }

    // Find user
    const user = await User.findById(id).select('+plainPassword +password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure only the same admin or a superadmin can change
    if (req.user.role !== 'superadmin' && req.user.id !== id) {
      return res.status(403).json({ message: 'Not authorized to change this password' });
    }

    // Check old password
    if (user.plainPassword !== oldPassword) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // Update password
    user.plainPassword = newPassword; // Store plain password (if required)
    user.password = await bcrypt.hash(newPassword, 10); // Store hashed password
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error updating password' });
  }
});

// Get all users (admin or superadmin only)
app.get('/users', authenticateToken, async (req, res) => {
  try {
    let query;
    console.log('Logged-in user role:', req.user.role);
    console.log('AdminId from query:', req.query.adminId);

    if (req.user.role === 'superadmin') {
      if (req.query.adminId) {
        // Make sure adminId exists and is valid
        query = {
          adminId: new mongoose.Types.ObjectId(req.query.adminId),
          role: 'user',
        };
      } else {
        query = { role: 'user' };
      }
    } else {
      // req.user._id is already ObjectId
      query = { adminId: req.user._id, role: 'user' };
    }

    const users = await User.find(query).select('-password').lean();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Get a single user by ID
app.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (
      req.user._id.toString() !== req.params.id &&
      req.user.role !== 'superadmin' &&
      (req.user.role !== 'admin' || user.adminId.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

// Get user password (admin or superadmin)
app.get('/users/:id/password', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+plainPassword');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'admin' && user.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (user.role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can view admin passwords' });
    }

    if (!user.plainPassword) {
      return res.status(400).json({ message: 'Plain password not available' });
    }

    res.json({ password: user.plainPassword });
  } catch (error) {
    console.error('Error fetching user password:', error);
    res.status(500).json({ message: 'Server error fetching user password' });
  }
});

// Change password endpoint with debug logs
app.put('/users/:id/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    console.log('💡 Request body:', req.body);
    console.log('💡 Target user ID param:', req.params.id);

    const targetUser = await User.findById(req.params.id).select(
      '+password +plainPassword +role +adminId'
    );
    console.log('💡 Fetched target user:', targetUser);

    if (!targetUser) {
      console.log('❌ Target user not found');
      return res.status(404).json({ message: 'User not found' });
    }

    const requester = req.user; // set by authenticateToken
    console.log('💡 Requester:', requester);

    // Admin modifying a user: check adminId
    if (requester.role === 'admin') {
      if (!targetUser.adminId) {
        console.log('⚠️ Target user has no adminId');
      }
      if (targetUser.adminId?.toString() !== requester._id.toString()) {
        console.log('❌ Admin trying to modify user not under them');
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Only superadmin can change admin passwords
    if (targetUser.role === 'admin' && requester.role !== 'superadmin') {
      console.log('❌ Non-superadmin trying to change admin password');
      return res.status(403).json({ message: 'Only superadmins can change admin passwords' });
    }

    // Self password change: verify currentPassword
    if (requester._id.toString() === targetUser._id.toString()) {
      if (!currentPassword) {
        console.log('❌ Current password missing for self-change');
        return res.status(400).json({ message: 'Current password required' });
      }
      const match = await bcrypt.compare(currentPassword, targetUser.password);
      console.log('💡 Password match result:', match);
      if (!match) {
        console.log('❌ Current password incorrect');
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    } else {
      console.log('💡 Admin/Superadmin changing someone else password');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      console.log('❌ New password invalid:', newPassword);
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    targetUser.password = hashed;
    targetUser.plainPassword = newPassword; // optional, not recommended

    // Save user
    await targetUser.save();
    console.log('✅ Password updated in DB');

    // Create history
    try {
      const historyRecord = await History.create({
        userId: targetUser._id,
        action: 'password_change',
        actorId: requester._id,
        actorRole: requester.role,
        details: { by: requester._id.toString() === targetUser._id.toString() ? 'self' : 'admin' },
        createdAt: new Date(),
      });
      console.log('✅ History created:', historyRecord._id);
    } catch (err) {
      console.error('⚠️ Error creating history record:', err.message);
    }

    // Notify via emitter if exists
    try {
      if (emitters?.userUpdated) {
        emitters.userUpdated({
          id: targetUser._id.toString(),
          name: targetUser.name,
          mobile: targetUser.mobile,
          status: targetUser.status,
          location: targetUser.location,
          points: targetUser.points,
        });
        console.log('✅ Emitter called for user update');
      } else {
        console.log('⚠️ Emitters undefined or userUpdated missing');
      }
    } catch (err) {
      console.error('⚠️ Error calling emitter:', err.message);
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('❌ Error changing password:', err);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

// Update user status
app.put('/users/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, adminId } = req.body;
    if (!['approved', 'disapproved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'admin' && user.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
      return res.status(403).json({ message: 'Cannot modify status of admins' });
    }

    user.status = status;
    if (adminId && status === 'approved' && user.role === 'user') {
      const admin = await User.findOne({ _id: adminId, role: 'admin', status: 'approved' });
      if (!admin) {
        return res.status(400).json({ message: 'Invalid or unapproved admin selected' });
      }
      user.adminId = adminId;
    }

    await user.save();

    res.json({
      message: `User ${status} successfully`,
      user: {
        id: user._id,
        name: user.name,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Server error updating user status' });
  }
});

// Update user details
app.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { name, mobile, location, points } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'admin' && user.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
      return res.status(403).json({ message: 'Cannot modify admins' });
    }

    if (mobile && mobile !== user.mobile) {
      const existingUser = await User.findOne({ mobile });
      if (existingUser) {
        return res.status(400).json({ message: 'Mobile number already registered' });
      }
    }

    // Capture previous values for history logging
    const beforeValues = {
      name: user.name,
      mobile: user.mobile,
      location: user.location,
      points: user.points,
    };

    // Apply updates
    user.name = name || user.name;
    user.mobile = mobile || user.mobile;
    user.location = location || user.location;
    user.points = points !== undefined ? points : user.points;
    await user.save();

    try {
      // NEW - create history record(s) for changed fields
      const changes = [];
      const afterValues = {
        name: user.name,
        mobile: user.mobile,
        location: user.location,
        points: user.points,
      };
      ['name', 'mobile', 'location', 'points'].forEach(field => {
        if (String(beforeValues[field]) !== String(afterValues[field])) {
          changes.push({
            userId: user._id,
            action: 'edit',
            actorId: req.user?._id,
            actorRole: req.user?.role,
            details: { field, before: beforeValues[field], after: afterValues[field] },
            createdAt: new Date(),
          });
        }
      });
      if (changes.length > 0) {
        try {
          await History.insertMany(changes);
          if (emitters) {
            emitters.historyUpdated({ userId: user._id.toString(), items: changes });
          }
        } catch (histErr) {
          console.error('History insert error:', histErr.message);
        }
      }

      if (emitters) {
        emitters.userUpdated({
          id: user._id.toString(),
          name: user.name,
          mobile: user.mobile,
          status: user.status,
          location: user.location,
          points: user.points,
        });
      }
    } catch (e) {
      console.error('Socket emit error (user update):', e.message);
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        location: user.location,
        points: user.points,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// Delete a user
app.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'admin' && user.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
      return res.status(403).json({ message: 'Cannot delete admins' });
    }

    await Barcode.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: 'User and associated barcodes deleted',
      deletedUser: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// Reset user points
app.put('/users/:id/reset-points', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'admin' && user.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
      return res.status(403).json({ message: 'Cannot reset points for admins' });
    }

    user.points = 0;
    await user.save();

    res.json({
      message: 'Points reset successfully',
      user: {
        id: user._id,
        name: user.name,
        points: user.points,
      },
    });
  } catch (error) {
    console.error('Error resetting points:', error);
    res.status(500).json({ message: 'Server error resetting points' });
  }
});

// Create a new barcode
app.post('/barcodes', authenticateToken, checkRole(['user']), async (req, res) => {
  try {
    const { value, location } = req.body;
    if (!value || !/^[A-Z0-9-]+$/.test(value)) {
      return res.status(400).json({ message: 'Invalid barcode value (alphanumeric with suffix)' });
    }

    if (req.user.status !== 'approved') {
      return res.status(403).json({
        message: 'Your account is not approved to perform this action',
        status: req.user.status,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.adminId) {
      return res.status(400).json({ message: 'User not assigned to an admin or not found' });
    }

    const existingBarcode = await Barcode.findOne({ value });
    if (existingBarcode) {
      return res.status(400).json({
        message: 'Barcode already scanned dear',
        scannedBy: existingBarcode.userId,
      });
    }

    let points = 50;
    try {
      const preGeneratedBarcode = await PreGeneratedBarcode.findOne({
        value,
        adminId: user.adminId,
      });
      if (!preGeneratedBarcode) {
        return res.status(400).json({ message: 'barcode not found' });
      }
      points = preGeneratedBarcode.points || 50;
    } catch (dbError) {
      console.error('Database error during barcode validation:', dbError);
      return res.status(500).json({ message: 'Error validating barcode' });
    }

    const barcode = new Barcode({
      value,
      userId: req.user._id,
      pointsAwarded: points,
      location,
      adminId: user.adminId,
    });

    await barcode.save();
    // NEW - log scan history
    try {
      await History.create({
        userId: user._id,
        action: 'scan',
        actorId: user._id,
        actorRole: 'user',
        details: { value, points },
      });
      if (emitters) {
        emitters.historyUpdated({
          userId: user._id.toString(),
          items: [{ action: 'scan', details: { value, points } }],
        });
      }
    } catch (histErr) {
      console.error('History create (scan) error:', histErr.message);
    }
    user.points = (user.points || 0) + points;

    const rewards = await Reward.find({
      adminId: user.adminId,
      pointsRequired: { $lte: user.points },
    });

    for (const reward of rewards) {
      const existingNotification = await Notification.findOne({
        userId: user._id,
        rewardId: reward._id,
        type: 'reward_achieved',
      });
      if (!existingNotification) {
        const notification = new Notification({
          userId: user._id,
          adminId: user.adminId,
          message: `${user.name} has earned a reward: ${reward.name}`,
          type: 'reward_achieved',
          rewardId: reward._id,
        });
        await notification.save();

        // NEW - log reward achieved in history
        try {
          await History.create({
            userId: user._id,
            action: 'reward',
            actorId: user._id,
            actorRole: 'user',
            details: {
              rewardId: reward._id,
              rewardName: reward.name,
              points: reward.pointsRequired,
            },
          });
          if (emitters) {
            emitters.historyUpdated({
              userId: user._id.toString(),
              items: [{ action: 'reward', details: { rewardId: reward._id } }],
            });
          }
        } catch (histErr) {
          console.error('History create (reward) error:', histErr.message);
        }

        try {
          if (io) {
            emitters.notificationUpdated(notification);
            if (user.adminId) {
              emitters.notificationUpdated(notification);
            }
          }
        } catch (emitErr) {
          console.error('Socket emit error (notification):', emitErr);
        }
      }

      const existingRedemption = await RewardRedemption.findOne({
        userId: user._id,
        rewardId: reward._id,
        status: 'pending',
      });

      if (!existingRedemption) {
        const redemption = new RewardRedemption({
          userId: user._id,
          rewardId: reward._id,
          adminId: user.adminId,
          status: 'pending',
        });
        await redemption.save();
        // NEW - log redemption request
        try {
          await History.create({
            userId: user._id,
            action: 'redemption',
            actorId: user._id,
            actorRole: 'user',
            details: { rewardId: reward._id, redemptionId: redemption._id },
          });
          if (emitters) {
            emitters.historyUpdated({
              userId: user._id.toString(),
              items: [{ action: 'redemption', details: { rewardId: reward._id } }],
            });
          }
        } catch (histErr) {
          console.error('History create (redemption) error:', histErr.message);
        }

        try {
          if (io && user.adminId) {
            emitters.redemptionUpdated(redemption);
          }
        } catch (emitErr) {
          console.error('Socket emit error (redemption):', emitErr);
        }
      }
    }

    // Save user points and emit updates
    await user.save();
    try {
      if (io) {
        emitters.pointsUpdated({ userId: user._id.toString(), points: user.points });
        if (user.adminId) {
          emitters.userUpdated({ id: user._id.toString(), points: user.points });
        }
        emitters.barcodeUpdated({
          value,
          userId: user._id.toString(),
          pointsAwarded: points,
          location,
        });
      }
    } catch (emitErr) {
      console.error('Socket emit error (barcode):', emitErr);
    }

    res.status(201).json({
      message: 'Barcode scanned successfully',
      pointsAwarded: points,
      totalPoints: user.points,
      barcode: {
        value,
        location,
        scannedAt: barcode.createdAt,
      },
    });
  } catch (error) {
    console.error('Error scanning barcode:', error);
    res.status(500).json({ message: 'Server error scanning barcode' });
  }
});

// Get all barcodes
app.get('/barcodes', authenticateToken, async (req, res) => {
  try {
    let barcodes;
    if (req.user.role === 'superadmin') {
      barcodes = await Barcode.find().populate('userId', 'name mobile');
    } else if (req.user.role === 'admin') {
      barcodes = await Barcode.find({ adminId: req.user._id }).populate('userId', 'name mobile');
    } else {
      return res.status(403).json({ message: 'Admin or Super Admin access required' });
    }
    res.json(barcodes);
  } catch (error) {
    console.error('Error fetching barcodes:', error);
    res.status(500).json({ message: 'Server error fetching barcodes' });
  }
});

// Get barcodes for a specific user
app.get('/barcodes/user/:userId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (
      req.user._id.toString() !== req.params.userId &&
      req.user.role !== 'superadmin' &&
      (req.user.role !== 'admin' || user.adminId.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const barcodes = await Barcode.find({ userId: req.params.userId }).populate(
      'userId',
      'name mobile'
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        points: user.points,
      },
      barcodes: barcodes.map(b => ({
        _id: b._id, // Include _id for key in frontend
        value: b.value,
        points: b.pointsAwarded,
        scannedAt: b.createdAt,
        location: b.location,
        userId: {
          _id: b.userId?._id,
          name: b.userId?.name,
          mobile: b.userId?.mobile,
        },
      })),
      totalBarcodes: barcodes.length,
      totalPoints: barcodes.reduce((sum, b) => sum + b.pointsAwarded, 0),
    });
  } catch (error) {
    console.error('Error fetching user barcodes:', error);
    res.status(500).json({ message: 'Server error fetching user barcodes' });
  }
});

// Delete a barcode
app.delete('/barcodes/:id', authenticateToken, async (req, res) => {
  try {
    const barcode = await Barcode.findById(req.params.id);
    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found' });
    }

    if (req.user.role === 'admin' && barcode.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(barcode.userId);
    if (user) {
      user.points = Math.max(0, user.points - barcode.pointsAwarded);
      await user.save();
    }

    await Barcode.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Barcode deleted successfully',
      pointsDeducted: barcode.pointsAwarded,
      user: user
        ? {
            id: user._id,
            name: user.name,
            newPoints: user.points,
          }
        : null,
    });
  } catch (error) {
    console.error('Error deleting barcode:', error);
    res.status(500).json({ message: 'Server error deleting barcode' });
  }
});

// Delete all barcodes
app.delete('/barcodes', authenticateToken, async (req, res) => {
  try {
    let barcodes;
    if (req.user.role === 'superadmin') {
      barcodes = await Barcode.find();
    } else if (req.user.role === 'admin') {
      barcodes = await Barcode.find({ adminId: req.user._id });
    } else {
      return res.status(403).json({ message: 'Admin or Super Admin access required' });
    }

    for (const barcode of barcodes) {
      const user = await User.findById(barcode.userId);
      if (user) {
        user.points = Math.max(0, user.points - barcode.pointsAwarded);
        await user.save();
      }
    }

    const totalDeleted = barcodes.length;
    if (req.user.role === 'superadmin') {
      await Barcode.deleteMany({});
    } else {
      await Barcode.deleteMany({ adminId: req.user._id });
    }

    res.json({
      message: 'All barcodes deleted successfully',
      totalDeleted,
    });
  } catch (error) {
    console.error('Error deleting all barcodes:', error);
    res.status(500).json({ message: 'Server error deleting all barcodes' });
  }
});

// Export barcodes as CSV
app.get('/export-barcodes', authenticateToken, async (req, res) => {
  try {
    let barcodes;
    if (req.user.role === 'superadmin') {
      barcodes = await Barcode.find().populate('userId', 'name mobile');
    } else if (req.user.role === 'admin') {
      barcodes = await Barcode.find({ adminId: req.user._id }).populate('userId', 'name mobile');
    } else {
      return res.status(403).json({ message: 'Admin or Super Admin access required' });
    }

    const fields = [
      { label: 'Barcode Value', value: 'value' },
      { label: 'User Name', value: 'userId.name' },
      { label: 'User Mobile', value: 'userId.mobile' },
      { label: 'Points Awarded', value: 'pointsAwarded' },
      { label: 'Scan Date', value: 'createdAt' },
      { label: 'User Location', value: 'location' },
    ];

    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(barcodes);
    res.header('Content-Type', 'text/csv');
    res.attachment('barcodes_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting barcodes:', error);
    res.status(500).json({ message: 'Server error exporting barcodes' });
  }
});

// Get all barcode ranges
app.get(
  '/barcode-ranges',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      let ranges;
      if (req.user.role === 'superadmin') {
        ranges = await BarcodeRange.find().populate('adminId', 'name');
      } else {
        ranges = await BarcodeRange.find({ adminId: req.user._id });
      }
      res.json(ranges);
    } catch (error) {
      console.error('Error fetching barcode ranges:', error);
      res.status(500).json({ message: 'Server error fetching barcode ranges' });
    }
  }
);

// Create a barcode range
app.post(
  '/barcode-ranges',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { start, end, points } = req.body;

      // Line 3: Unchanged - Validate required fields
      if (!start || !end || points === undefined) {
        return res.status(400).json({ message: 'Start, end, and points are required' });
      }
      // Line 6: Unchanged - Validate alphanumeric barcodes
      if (!/^[A-Z0-9]+$/.test(start) || !/^[A-Z0-9]+$/.test(end)) {
        return res.status(400).json({ message: 'Barcodes must be alphanumeric' });
      }
      // Line 9: Unchanged - Validate points
      if (!Number.isInteger(points) || points < 0) {
        return res.status(400).json({ message: 'Points must be a non-negative integer' });
      }

      // Line 12: Unchanged - Parse start barcode
      const startMatch = start.match(/^(.*?)(\d+)$/);
      if (!startMatch) {
        return res.status(400).json({ message: 'Unable to parse start barcode format' });
      }

      // Line 16: Unchanged - Extract prefix and digits
      const prefix = startMatch[1]; // e.g., "OPT1LA"
      const startDigits = startMatch[2]; // e.g., "001"
      const startNum = parseInt(startDigits, 10);
      const startNumLength = startDigits.length;

      // Line 21: Unchanged - Parse end barcode
      const endMatch = end.match(/(\d+)$/);
      if (!endMatch) {
        return res.status(400).json({ message: 'Unable to parse end barcode format' });
      }
      const endNum = parseInt(endMatch[1], 10);

      // Line 26: Unchanged - Validate range
      if (startNum > endNum) {
        return res
          .status(400)
          .json({ message: 'End barcode must be greater than or equal to start barcode' });
      }

      // Line 30: Unchanged - Create barcode range
      const range = new BarcodeRange({
        start,
        end,
        points,
        adminId: req.user._id,
      });

      // Line 36: Unchanged - Save range to database
      await range.save();

      // Line 38: Unchanged - Generate base values
      const baseValues = [];
      for (let num = startNum; num <= endNum; num++) {
        const numStr = num.toString().padStart(startNumLength, '0');
        baseValues.push(`${prefix}${numStr}`);
      }

      // Line 44: Unchanged - Prepare barcodes
      const barcodes = [];
      const existingValues = new Set();
      const generatedValues = new Set();

      // Line 48: Unchanged - Query existing barcodes
      const existing = await PreGeneratedBarcode.find({
        baseValue: { $in: baseValues },
      }).select('value');

      // Line 52: Unchanged - Collect existing values
      existing.forEach(b => existingValues.add(b.value));

      // Line 54: Unchanged - Generate unique barcodes
      for (const baseValue of baseValues) {
        let fullValue, suffix;
        let attempts = 0;

        do {
          suffix = generateRandomSuffix(); // e.g., "A1B2C"
          fullValue = `${baseValue}-${suffix}`;
          attempts++;
        } while (
          (existingValues.has(fullValue) || generatedValues.has(fullValue)) &&
          attempts < 10
        );

        if (attempts >= 10) {
          console.warn(`Skipping ${baseValue}: could not generate unique suffix`);
          continue;
        }

        generatedValues.add(fullValue);
        barcodes.push({
          value: fullValue,
          baseValue,
          suffix,
          rangeId: range._id,
          adminId: req.user._id,
          points,
        });
      }

      // Line 76: Unchanged - Insert barcodes
      await PreGeneratedBarcode.insertMany(barcodes, { ordered: false });

      // Line 78: CHANGE - Add history logging for barcode range creation
      const historyEntry = await History.create({
        userId: req.user._id,
        action: 'barcode_range_created',
        actorId: req.user._id,
        actorRole: req.user.role,
        details: { start, end, points },
        createdAt: new Date(),
      });

      // Line 87: CHANGE - Update Socket.IO events
      try {
        if (io) {
          // CHANGE: Emit barcodeRange:created to superadmin room instead of admin and global
          io.to('superadmin').emit('barcodeRange:created', {
            _id: range._id,
            start: range.start,
            end: range.end,
            points: range.points,
            adminId: req.user._id,
          });
          // CHANGE: Emit history:updated to superadmin room
          io.to('superadmin').emit('history:updated', {
            userId: req.user._id,
            items: [
              {
                _id: historyEntry._id,
                action: 'barcode_range_created',
                details: { start, end, points },
                createdAt: historyEntry.createdAt,
              },
            ],
          });
          // CHANGE: Retain original event for admin to maintain existing functionality
          io.to(req.user._id.toString()).emit('barcodeRangeCreated', range);
        }
      } catch (emitErr) {
        console.error('Socket emit error (barcode-range):', emitErr);
      }

      // Line 108: Unchanged - Send response
      res.status(201).json({
        message: 'Barcode range created successfully with pre-generated barcodes',
        barcodeRange: range,
        barcodeCount: barcodes.length,
      });
    } catch (error) {
      console.error('Error creating barcode range:', error);
      res.status(500).json({ message: 'Server error creating barcode range' });
    }
  }
);

// Update a barcode range
app.put(
  '/barcode-ranges/:id',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { start, end, points } = req.body;
      const range = await BarcodeRange.findById(req.params.id);
      if (!range || range.adminId.toString() !== req.user._id.toString()) {
        return res.status(404).json({ message: 'Range not found or access denied' });
      }

      if (start && !/^[A-Z0-9]+$/.test(start)) {
        return res.status(400).json({ message: 'Start barcode must be alphanumeric' });
      }
      if (end && !/^[A-Z0-9]+$/.test(end)) {
        return res.status(400).json({ message: 'End barcode must be alphanumeric' });
      }
      if (start && end && start > end) {
        return res
          .status(400)
          .json({ message: 'End barcode must be greater than or equal to start barcode' });
      }
      if (points !== undefined && (!Number.isInteger(points) || points < 0)) {
        return res.status(400).json({ message: 'Points must be a non-negative integer' });
      }

      // Delete existing pre-generated barcodes if range changes
      if (start || end) {
        await PreGeneratedBarcode.deleteMany({ rangeId: range._id });
        const newStart = start || range.start;
        const newEnd = end || range.end;
        const newPoints = points !== undefined ? points : range.points;

        const barcodes = [];
        let current = newStart;
        while (current <= newEnd) {
          let suffix;
          let fullValue;
          do {
            suffix = generateRandomSuffix();
            fullValue = `${current}-${suffix}`;
          } while (await PreGeneratedBarcode.findOne({ value: fullValue }));

          barcodes.push({
            value: fullValue,
            baseValue: current,
            suffix,
            rangeId: range._id,
            adminId: req.user._id,
            points: newPoints,
          });

          const prefix = current.match(/^[A-Z]+/)?.[0] || '';
          const number = parseInt(current.match(/\d+$/)?.[0] || '0');
          current = `${prefix}${number + 1}`;
        }
        await PreGeneratedBarcode.insertMany(barcodes);
      } else if (points !== undefined) {
        await PreGeneratedBarcode.updateMany({ rangeId: range._id }, { points });
      }

      range.start = start || range.start;
      range.end = end || range.end;
      range.points = points !== undefined ? points : range.points;

      await range.save();
      res.json({
        message: 'Barcode range updated successfully',
        barcodeRange: range,
      });
    } catch (error) {
      console.error('Error updating barcode range:', error);
      res.status(500).json({ message: 'Server error updating barcode range' });
    }
  }
);

// Delete a barcode range
app.delete(
  '/barcode-ranges/:id',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const range = await BarcodeRange.findById(req.params.id);
      if (!range || range.adminId.toString() !== req.user._id.toString()) {
        return res.status(404).json({ message: 'Range not found or access denied' });
      }

      await PreGeneratedBarcode.deleteMany({ rangeId: range._id });
      await range.deleteOne();
      res.json({ message: 'Barcode range and associated barcodes deleted successfully' });
    } catch (error) {
      console.error('Error deleting barcode range:', error);
      res.status(500).json({ message: 'Server error deleting barcode range' });
    }
  }
);

// Create a reward
app.post('/rewards', authenticateToken, checkRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { name, price, bundalValue, pointsRequired, image } = req.body;
    if (!name || !price || !pointsRequired) {
      return res.status(400).json({ message: 'Name, price, and points required' });
    }
    const reward = new Reward({
      name,
      price,
      bundalValue,
      pointsRequired,
      image,
      adminId: req.user._id,
    });
    await reward.save();

    // Emit socket event to notify all users about the new reward
    if (global.emitters) {
      console.log('📢 Emitting rewardCreated event for new reward:', reward._id);
      global.emitters.rewardCreated({
        rewardId: reward._id,
        adminId: reward.adminId,
        reward: reward.toObject(),
      });
      // Also emit reward:updated for compatibility
      global.emitters.rewardUpdated({
        rewardId: reward._id,
        adminId: reward.adminId,
        reward: reward.toObject(),
      });
      console.log('✅ Reward creation events emitted');
    } else {
      console.warn('⚠️ global.emitters not available - socket may not be initialized');
    }

    res.status(201).json({ message: 'Reward created', reward });
  } catch (error) {
    console.error('Error creating reward:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all rewards
app.get('/rewards', authenticateToken, async (req, res) => {
  try {
    let rewards;
    if (req.user.role === 'superadmin') {
      rewards = await Reward.find();
    } else if (req.user.role === 'admin') {
      rewards = await Reward.find({ adminId: req.user._id });
    } else {
      rewards = await Reward.find({ adminId: req.user.adminId });
    }
    res.json(rewards);
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a reward
app.put('/rewards/:id', authenticateToken, checkRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { name, price, bundalValue, pointsRequired, image } = req.body;
    const reward = await Reward.findById(req.params.id);
    if (!reward || reward.adminId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Reward not found or access denied' });
    }
    reward.name = name || reward.name;
    reward.price = price || reward.price;
    reward.bundalValue = bundalValue || reward.bundalValue;
    reward.pointsRequired = pointsRequired || reward.pointsRequired;
    reward.image = image || reward.image;
    await reward.save();

    // Emit socket event to notify all users about the reward update
    if (global.emitters) {
      console.log('📢 Emitting reward:updated event for reward:', reward._id);
      global.emitters.rewardUpdated({
        rewardId: reward._id,
        adminId: reward.adminId,
        reward: reward.toObject(),
      });
      console.log('✅ Reward update event emitted');
    } else {
      console.warn('⚠️ global.emitters not available - socket may not be initialized');
    }

    res.json({ message: 'Reward updated', reward });
  } catch (error) {
    console.error('Error updating reward:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a reward
app.delete(
  '/rewards/:id',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const reward = await Reward.findById(req.params.id);
      if (!reward || reward.adminId.toString() !== req.user._id.toString()) {
        return res.status(404).json({ message: 'Reward not found or access denied' });
      }
      const adminId = reward.adminId;
      await reward.deleteOne();

      // Emit socket event to notify all users about the reward deletion
      if (global.emitters) {
        console.log('📢 Emitting reward:deleted event for reward:', req.params.id);
        global.emitters.rewardUpdated({
          rewardId: req.params.id,
          adminId: adminId,
          deleted: true,
        });
        console.log('✅ Reward deletion event emitted');
      }

      res.json({ message: 'Reward deleted' });
    } catch (error) {
      console.error('Error deleting reward:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// R
app.delete('/redemptions/:id', authenticateToken, async (req, res) => {
  try {
    // Validate redemption ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`Invalid redemption ID: ${req.params.id}`);
      return res.status(400).json({ message: 'Invalid redemption ID' });
    }

    // Validate user authentication
    if (!req.user?._id) {
      console.error('User ID not found in request');
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    console.log(`Attempting to delete redemption ID: ${req.params.id} for user: ${req.user._id}`);

    // Delete redemption matching _id and userId
    const redemption = await RewardRedemption.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!redemption) {
      console.warn(`Redemption not found for ID: ${req.params.id} and user: ${req.user._id}`);
      return res
        .status(404)
        .json({ message: 'Redemption not found or you are not authorized to delete it' });
    }

    console.log(`Redemption deleted successfully: ${req.params.id}`);
    res.status(200).json({ message: 'Redemption deleted' });
  } catch (error) {
    console.error('Error deleting redemption:', {
      message: error.message,
      stack: error.stack,
      redemptionId: req.params.id,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /notifications/:id
app.delete('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (
      !notification ||
      (req.user._id.toString() !== notification.userId?.toString() &&
        req.user._id.toString() !== notification.adminId?.toString())
    ) {
      return res.status(403).json({ message: 'Not authorized to delete this notification' });
    }

    await notification.deleteOne();
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error deleting notification' });
  }
});

// Get notifications
app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    let notifications;
    if (req.user.role === 'admin') {
      notifications = await Notification.find({ adminId: req.user._id }).populate(
        'userId rewardId'
      );
    } else if (req.user.role === 'superadmin') {
      notifications = await Notification.find().populate('userId rewardId');
    } else {
      notifications = await Notification.find({ userId: req.user._id }).populate('rewardId');
    }
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
app.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const userIdStr = req.user._id.toString();

    // ✅ Authorization logic based on middleware-provided req.user
    const isOwner =
      (notification.userId && notification.userId.toString() === userIdStr) ||
      (notification.adminId && notification.adminId.toString() === userIdStr);

    // Allow superadmin to mark any notification
    const canMarkRead = isOwner || req.user.role === 'superadmin';

    if (!canMarkRead) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // ✅ Mark as read
    notification.read = true;
    await notification.save();

    console.log(`Notification ${notification._id} marked as read by ${req.user._id}`);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit redemption request
app.post('/redemptions', authenticateToken, async (req, res) => {
  try {
    const { rewardId, type = 'item' } = req.body; // ✅ Added type param for cash
    const reward = await Reward.findById(rewardId);
    if (!reward) return res.status(404).json({ message: 'Reward not found' });

    if (req.user.points < reward.pointsRequired) {
      return res.status(400).json({ message: 'Insufficient points' });
    }

    const redemption = new RewardRedemption({
      userId: req.user._id,
      rewardId,
      type, // ✅ Store type
      adminId: req.user.adminId || req.user._id,
    });
    await redemption.save();

    // Notify admin
    const messageType = type === 'cash' ? 'Cash Reward' : 'Redemption';
    const notification = new Notification({
      adminId: redemption.adminId,
      message: `${messageType} request for ${reward.name} by ${req.user.name}`,
      type: 'redemption_request',
      rewardId,
    });
    await notification.save();

    if (global.emitters) {
      global.emitters.redemptionUpdated(redemption.toObject());
      global.emitters.notificationUpdated(notification);
    }

    res.json({ message: `${messageType} request submitted`, redemption });
  } catch (error) {
    console.error('Error requesting redemption:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// NEW - Manual point add/redeem by admin
app.post(
  '/manual-point',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { userId, amount, type } = req.body; // type: 'add' or 'redeem'
      if (!userId || !amount || !['add', 'redeem'].includes(type)) {
        return res.status(400).json({ message: 'Invalid request' });
      }
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const change = type === 'add' ? amount : -amount;
      user.points = Math.max(0, user.points + change);
      await user.save();

      const history = new History({
        userId,
        action: type === 'add' ? 'point_add' : 'point_redeem',
        actorId: req.user._id,
        actorRole: req.user.role,
        details: { amount: Math.abs(amount), type },
        createdAt: Date.now(),
      });
      await history.save();

      // Emit updates
      if (global.emitters) {
        // ✅ This event updates the user's total points on the main list.
        global.emitters.userUpdated({
          id: user._id.toString(),
          points: user.points,
        });
        // ✅ This event triggers the history refresh on the frontend.
        global.emitters.historyUpdated({
          userId: user._id.toString(),
          item: history.toObject(),
        });
      }

      res.json({ message: `Points ${type}ed successfully`, newPoints: user.points });
    } catch (error) {
      console.error('Manual point error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Approve/reject redemption
app.put(
  '/redemptions/:id',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const redemption = await RewardRedemption.findById(req.params.id).populate('rewardId userId');
      if (!redemption || redemption.adminId.toString() !== req.user._id.toString()) {
        return res.status(404).json({ message: 'Redemption not found or access denied' });
      }

      redemption.status = status;

      if (status === 'approved') {
        const user = await User.findById(redemption.userId._id);
        user.points = Math.max(0, user.points - redemption.rewardId.pointsRequired); // ✅ Subtract only reward points
        await user.save();

        const notification = new Notification({
          userId: redemption.userId._id,
          message: `Your reward ${redemption.rewardId.name} has been approved!`,
          type: 'redemption_approved',
          rewardId: redemption.rewardId._id,
        });
        await notification.save();
        await redemption.save();

        // emit update to user and admin
        if (io) {
          try {
            // notify the user who requested
            if (redemption.userId && redemption.userId._id) {
              emitters.redemptionUpdated({
                ...redemption,
                userId: redemption.userId?._id?.toString?.() || redemption.userId?.toString?.(),
              });
            } else if (redemption.userId) {
              emitters.redemptionUpdated({
                ...redemption,
                userId: redemption.userId?.toString?.(),
              });
            }

            // notify admin as well (current user)
            emitters.redemptionUpdated({ ...redemption, userId: req.user._id?.toString?.() });
          } catch (emitErr) {
            console.error('Socket emit error (redemption update):', emitErr);
          }
        }
      } else {
        // ✅ This is the 'rejected' case
        await redemption.save();

        // ✅ Create a notification for the user about the rejection
        const notification = new Notification({
          userId: redemption.userId._id,
          message: `Your request for reward "${redemption.rewardId.name}" has been rejected.`,
          type: 'redemption_approved', // Using the same type for simplicity, message clarifies status
          rewardId: redemption.rewardId._id,
        });
        await notification.save();

        // ✅ Emit updates to the specific user and the admin
        if (global.emitters) {
          const payload = {
            ...redemption.toObject(),
            userId: redemption.userId._id.toString(),
          };
          global.emitters.redemptionUpdated(payload);
          global.emitters.notificationUpdated(notification);
        }
      }

      res.json({ message: `Redemption ${status}`, redemption });
    } catch (error) {
      console.error('Error updating redemption:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Approve/reject redemption (improved with cash handling and history)
app.put(
  '/redemptions/:id/status',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const redemption = await RewardRedemption.findById(req.params.id).populate('userId rewardId');
      if (!redemption) return res.status(404).json({ message: 'Redemption not found' });

      if (redemption.status !== 'pending') {
        return res.status(400).json({ message: 'Redemption already processed' });
      }

      redemption.status = status;
      if (status === 'approved') {
        const user = await User.findById(redemption.userId._id);
        user.points = Math.max(0, user.points - redemption.rewardId.pointsRequired);
        await user.save();

        // ✅ Create history for approval (including cash)
        const historyAction = redemption.type === 'cash' ? 'cash_reward' : 'redemption';
        const history = new History({
          userId: user._id,
          action: historyAction,
          actorId: req.user._id,
          actorRole: req.user.role,
          details: {
            rewardId: redemption.rewardId._id,
            amount: redemption.rewardId.pointsRequired,
            type: redemption.type,
          },
        });
        await history.save();

        const message =
          redemption.type === 'cash'
            ? `Your cash reward for ${redemption.rewardId.name} approved!`
            : `Your reward ${redemption.rewardId.name} approved!`;
        const notification = new Notification({
          userId: redemption.userId._id,
          message,
          type: 'redemption_approved',
          rewardId: redemption.rewardId._id,
        });
        await notification.save();
        await redemption.save();

        // emit update to user and admin
        if (io) {
          try {
            if (redemption.userId && redemption.userId._id) {
              emitters.redemptionUpdated({
                ...redemption,
                userId: redemption.userId?._id?.toString?.() || redemption.userId?.toString?.(),
              });
            } else if (redemption.userId) {
              emitters.redemptionUpdated({
                ...redemption,
                userId: redemption.userId?.toString?.(),
              });
            }
            emitters.redemptionUpdated({ ...redemption, userId: req.user._id?.toString?.() });
            emitters.userHistoryUpdated(history); // ✅ Emit history update
          } catch (emitErr) {
            console.error('Socket emit error (redemption update):', emitErr);
          }
        }
      } else {
        await redemption.save();

        const message =
          redemption.type === 'cash'
            ? `Your cash request for "${redemption.rewardId.name}" rejected.`
            : `Your request for reward "${redemption.rewardId.name}" rejected.`;
        const notification = new Notification({
          userId: redemption.userId._id,
          message,
          type: 'redemption_approved',
          rewardId: redemption.rewardId._id,
        });
        await notification.save();

        if (global.emitters) {
          const payload = {
            ...redemption.toObject(),
            userId: redemption.userId._id.toString(),
          };
          global.emitters.redemptionUpdated(payload);
          global.emitters.notificationUpdated(notification);
        }
      }

      res.json({ message: `Redemption ${status}`, redemption });
    } catch (error) {
      console.error('Error updating redemption:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get reward history
app.get('/redemptions', authenticateToken, async (req, res) => {
  try {
    let redemptions;
    if (req.user.role === 'superadmin') {
      redemptions = await RewardRedemption.find().populate('userId rewardId');
    } else if (req.user.role === 'admin') {
      redemptions = await RewardRedemption.find({ adminId: req.user._id }).populate(
        'userId rewardId'
      );
    } else {
      redemptions = await RewardRedemption.find({ userId: req.user._id }).populate('rewardId');
    }
    res.json(redemptions);
  } catch (error) {
    console.error('Error fetching redemptions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pre-generated barcodes for a range
app.get(
  '/pregenerated-barcodes/:rangeId',
  authenticateToken,
  checkRole(['superadmin']),
  async (req, res) => {
    try {
      const range = await BarcodeRange.findById(req.params.rangeId);
      if (!range) {
        return res.status(404).json({ message: 'Barcode range not found' });
      }

      const barcodes = await PreGeneratedBarcode.find({ rangeId: req.params.rangeId });
      res.json({
        range,
        barcodes,
        total: barcodes.length,
      });
    } catch (error) {
      console.error('Error fetching pre-generated barcodes:', error);
      res.status(500).json({ message: 'Server error fetching pre-generated barcodes' });
    }
  }
);

// Generate barcode PDF
// app.post(
//   '/generate-barcode-pdf',
//   authenticateToken,
//   checkRole(['superadmin']),
//   async (req, res) => {
//     try {
//       const { rangeId, start, end, prefix } = req.body;
//       let barcodes = [];

//       if (rangeId) {
//         // ✅ Load pre-generated from DB
//         const preGeneratedBarcodes = await PreGeneratedBarcode.find({ rangeId });
//         if (!preGeneratedBarcodes.length) {
//           return res.status(400).json({ message: 'No barcodes found for this range' });
//         }

//         barcodes = preGeneratedBarcodes.map(b => ({
//           value: b.value,
//           points: b.points || 0,
//         }));
//       } else if (start && end && prefix) {
//         // ✅ Temporary barcodes (no suffix, not stored)
//         let current = parseInt(start);
//         const stop = parseInt(end);
//         if (isNaN(current) || isNaN(stop) || current > stop) {
//           return res.status(400).json({ message: 'Invalid start or end values' });
//         }

//         while (current <= stop) {
//           barcodes.push({
//             value: `${prefix}${current}`,
//             points: 50,
//           });
//           current++;
//         }
//       } else {
//         return res.status(400).json({ message: 'Provide either rangeId or start/end/prefix' });
//       }

//       // ✅ Setup PDF
//       const PDFDocument = require('pdfkit');
//       const bwipjs = require('bwip-js');
//       const doc = new PDFDocument({ size: 'A4', margin: 20 });
//       const buffers = [];

//       doc.on('data', buffers.push.bind(buffers));
//       doc.on('end', () => {
//         const pdfData = Buffer.concat(buffers);
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', 'attachment; filename=barcodes.pdf');
//         res.send(pdfData);
//       });

//       // ✅ Layout config
//       const cols = 4;
//       const rows = 10;
//       const boxWidth = 130;
//       const boxHeight = 100;
//       const padding = 15;

//       let x = doc.page.margins.left;
//       let y = doc.page.margins.top;
//       let count = 0;

//       for (const barcode of barcodes) {
//         const pngBuffer = await bwipjs.toBuffer({
//           bcid: 'code128',
//           text: barcode.value,
//           scale: 1,
//           height: 20,
//           includetext: false,
//         });

//         doc.rect(x, y, boxWidth, boxHeight).stroke();
//         doc.image(pngBuffer, x + 15, y + 10, { width: boxWidth - 30 });
//         doc
//           .fontSize(10)
//           .text(barcode.value, x + 10, y + 40, { width: boxWidth - 20, align: 'center' });
//         doc.fontSize(9).text(`Points: ${barcode.points}`, x + 10, y + 60, { align: 'center' });

//         count++;
//         x += boxWidth + padding;
//         if (count % cols === 0) {
//           x = doc.page.margins.left;
//           y += boxHeight + padding;
//         }
//         if (count % (cols * rows) === 0 && count < barcodes.length) {
//           doc.addPage();
//           x = doc.page.margins.left;
//           y = doc.page.margins.top;
//         }
//       }

//       doc.end();
//     } catch (error) {
//       console.error('Error generating PDF:', error);
//       res.status(500).json({ message: 'Server error generating PDF' });
//     }
//   }
// );
app.post('/rewards', authenticateToken, checkRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { name, price, bundalValue, pointsRequired, image } = req.body;

    if (!name || !price || !pointsRequired) {
      return res.status(400).json({ message: 'Name, price, and points required' });
    }

    // Optional: Validate base64
    if (image && !image.startsWith('data:')) {
      return res.status(400).json({ message: 'Invalid image format' });
    }

    const reward = new Reward({
      name,
      price,
      bundalValue,
      pointsRequired,
      image, // base64 string
      adminId: req.user._id,
    });

    await reward.save(); // <-- DB save first

    // NOW emit to EVERYONE
    try {
      if (global.emitters) {
        console.log('📢 Emitting rewardCreated event for new reward:', reward._id);
        global.emitters.rewardCreated({
          rewardId: reward._id,
          adminId: reward.adminId,
          reward: reward.toObject(),
        });
        // Also emit reward:updated for compatibility
        global.emitters.rewardUpdated({
          rewardId: reward._id,
          adminId: reward.adminId,
          reward: reward.toObject(),
        });
        console.log('✅ Reward creation events emitted');
      }
    } catch (emitErr) {
      console.error('Socket emit error:', emitErr);
    }

    res.status(201).json({ message: 'Reward created', reward });
  } catch (error) {
    console.error('Error creating reward:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// NEW - History API endpoints
app.get('/history/user/:id', authenticateToken, async (req, res) => {
  try {
    const histories = await History.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.json(histories);
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ message: 'Server error fetching history' });
  }
});

// Top users by added points (scans + manual adds only)
app.get(
  '/stats/top-users',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      // Determine scope
      let matchUsers = { role: 'user' };
      if (req.user.role === 'admin') {
        matchUsers.adminId = req.user._id;
      }

      // Find relevant users first (limits aggregation scope)
      const users = await User.find(matchUsers).select('_id name mobile points status').lean();
      const userIds = users.map(u => u._id);

      if (userIds.length === 0) return res.json([]);

      // Aggregate History for added points only
      const added = await History.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            action: { $in: ['scan', 'point_add'] },
          },
        },
        {
          $group: {
            _id: '$userId',
            totalAdded: {
              $sum: {
                $ifNull: [
                  {
                    $cond: [
                      { $eq: ['$action', 'scan'] },
                      { $ifNull: ['$details.points', 0] },
                      { $ifNull: ['$details.amount', 0] },
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { totalAdded: -1 } },
        { $limit: 3 }, // Updated to 3 to match "Top 3 Users"
      ]);

      // Join with users info
      const idToUser = users.reduce((acc, u) => {
        acc[u._id.toString()] = u;
        return acc;
      }, {});

      const result = added
        .map(row => {
          const u = idToUser[row._id.toString()];
          if (!u) return null;
          return {
            userId: u._id,
            name: u.name,
            mobile: u.mobile,
            status: u.status,
            totalAddedPoints: row.totalAdded || 0,
            currentPoints: u.points || 0,
          };
        })
        .filter(Boolean);

      res.json(result);
    } catch (error) {
      console.error('Error computing top users:', error);
      res.status(500).json({ message: 'Server error computing top users' });
    }
  }
);

app.get(
  '/history/admin',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      if (req.user.role === 'superadmin') {
        const histories = await History.find().sort({ createdAt: -1 });
        return res.json(histories);
      }
      const userIds = (await User.find({ adminId: req.user._id })).map(u => u._id);
      const histories = await History.find({ userId: { $in: userIds } }).sort({ createdAt: -1 });
      res.json(histories);
    } catch (error) {
      console.error('Error fetching admin history:', error);
      res.status(500).json({ message: 'Server error fetching history' });
    }
  }
);

// Get points per scan setting
app.get('/settings/points-per-scan', authenticateToken, async (req, res) => {
  try {
    let setting;
    if (req.user.role === 'superadmin') {
      setting = await Setting.findOne({ key: 'pointsPerScan', adminId: null });
    } else if (req.user.role === 'admin') {
      setting = await Setting.findOne({ key: 'pointsPerScan', adminId: req.user._id });
    } else {
      setting = await Setting.findOne({ key: 'pointsPerScan', adminId: req.user.adminId });
    }

    res.json({
      points: setting ? setting.value : 50,
      isDefault: !setting,
      setBy: setting ? (setting.adminId ? 'your admin' : 'superadmin') : 'system default',
    });
  } catch (error) {
    console.error('Error fetching points setting:', error);
    res.status(500).json({ message: 'Server error fetching points setting' });
  }
});

// Update points per scan setting
app.put(
  '/settings/points-per-scan',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { points } = req.body;
      if (!Number.isInteger(points) || points < 0) {
        return res.status(400).json({ message: 'Points must be a non-negative integer' });
      }

      const adminId = req.user.role === 'superadmin' ? null : req.user._id;

      await Setting.findOneAndUpdate(
        { key: 'pointsPerScan', adminId },
        { key: 'pointsPerScan', value: points, adminId },
        { upsert: true }
      );

      res.json({
        message: 'Points per scan updated successfully',
        points,
        appliesTo: adminId ? 'your users' : 'all users (global)',
      });
    } catch (error) {
      console.error('Error updating points setting:', error);
      res.status(500).json({ message: 'Server error updating points setting' });
    }
  }
);

// Get barcode range setting
app.get('/settings/barcode-range', authenticateToken, async (req, res) => {
  try {
    let setting;
    let fetchedFor = 'unknown';
    let query = { key: 'barcodeRange' };

    if (req.user.role === 'superadmin') {
      query.adminId = null;
      fetchedFor = 'superadmin (global)';
    } else if (req.user.role === 'admin') {
      query.adminId = req.user._id;
      fetchedFor = `admin (id: ${req.user._id})`;
    } else {
      query.adminId = req.user.adminId || null;
      fetchedFor = `user (adminId: ${req.user.adminId || 'none'})`;
    }

    setting = await Setting.findOne(query);

    if (!setting && req.user.role !== 'superadmin') {
      query.adminId = null;
      setting = await Setting.findOne({ key: 'barcodeRange', adminId: null });
      fetchedFor += ' -> superadmin (global fallback)';
    }

    const range = setting ? setting.value : { start: '0', end: '9999999999999' };

    res.json({
      range,
      isDefault: !setting,
      setBy: setting ? (setting.adminId ? 'your admin' : 'superadmin') : 'system default',
    });
  } catch (error) {
    console.error('Error fetching barcode range setting:', error);
    res.status(500).json({ message: 'Server error fetching barcode range setting' });
  }
});

// Update barcode range setting
app.put(
  '/settings/barcode-range',
  authenticateToken,
  checkRole(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const { start, end } = req.body;
      if (!start || !end || start > end || typeof start !== 'string' || typeof end !== 'string') {
        return res.status(400).json({ message: 'Invalid barcode range' });
      }

      const adminId = req.user.role === 'superadmin' ? null : req.user._id;

      await Setting.findOneAndUpdate(
        { key: 'barcodeRange', adminId },
        { key: 'barcodeRange', value: { start, end }, adminId },
        { upsert: true }
      );

      res.json({
        message: 'Barcode range updated successfully',
        range: { start, end },
        appliesTo: adminId ? 'your users' : 'all users (global)',
      });
    } catch (error) {
      console.error('Error updating barcode range setting:', error);
      res.status(500).json({ message: 'Server error updating barcode range setting' });
    }
  }
);

// Start the server
// Start the HTTP server and initialize Socket.IO
const http = require('http');
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// initialize socket.io and store global reference
try {
  const { io: ioServer, emitters } = initializeSocket(server);
  io = ioServer;
  global.io = ioServer;
  global.emitters = emitters;
  console.log('Socket.IO initialized');
} catch (err) {
  console.error('Failed to initialize Socket.IO:', err);
}
