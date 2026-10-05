const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');

function signToken(user) {
  const id = user._id.toString();
  return jwt.sign(
    { id, role: user.role, name: user.fullName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function toSafeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  };
}

function encodingArrayToBuffer(encoding) {
  if (!Array.isArray(encoding)) return null;
  const floatArray = new Float32Array(encoding);
  return Buffer.from(floatArray.buffer);
}

async function signupFieldWorker(req, res) {
  const { fullName, username, password } = req.body;
  if (!fullName || !username || !password) {
    res.status(400).json({ success: false, message: 'fullName, username, password are required' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ success: false, message: 'faceImage file is required' });
    return;
  }

  try {
    const normalizedUsername = String(username).toLowerCase().trim();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      res.status(400).json({ success: false, message: 'Username already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Cloudinary already uploaded the file — req.file.path is the secure_url
    const faceImageUrl = req.file.path;

    let encoding = null;
    try {
      const pythonResp = await axios.post(
        'http://localhost:5001/register-face',
        { imageUrl: faceImageUrl, userId: normalizedUsername },
        { headers: { 'Content-Type': 'application/json' } }
      );
      encoding = pythonResp?.data?.encoding;
    } catch (e) {
      console.warn('Python service unavailable, using mock encoding');
      encoding = new Array(128).fill(0.1);
    }

    if (!Array.isArray(encoding) || encoding.length !== 128) {
      encoding = new Array(128).fill(0.1);
    }

    const user = await User.create({
      fullName,
      username: normalizedUsername,
      password: hashedPassword,
      role: 'FIELD_WORKER',
      faceImagePath: faceImageUrl,   // now a Cloudinary https:// URL
      faceEncoding: encodingArrayToBuffer(encoding),
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      message: 'Field worker registered successfully',
      data: {
        token,
        user: toSafeUser(user),
      },
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Signup failed' });
    }
  }
}

async function signupTeamLead(req, res) {
  const { fullName, username, password } = req.body;
  if (!fullName || !username || !password) {
    res.status(400).json({ success: false, message: 'fullName, username, password are required' });
    return;
  }

  try {
    const normalizedUsername = String(username).toLowerCase().trim();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      res.status(400).json({ success: false, message: 'Username already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      username: normalizedUsername,
      password: hashedPassword,
      role: 'TEAM_LEAD',
      faceImagePath: null,
      faceEncoding: null,
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      message: 'Team lead registered successfully',
      data: {
        token,
        user: toSafeUser(user),
      },
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Signup failed' });
    }
  }
}

async function signupAdmin(req, res) {
  const { fullName, username, password } = req.body;
  if (!fullName || !username || !password) {
    res.status(400).json({ success: false, message: 'fullName, username, password are required' });
    return;
  }

  try {
    const normalizedUsername = String(username).toLowerCase().trim();
    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      res.status(400).json({ success: false, message: 'Username already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      username: normalizedUsername,
      password: hashedPassword,
      role: 'ADMIN',
      faceImagePath: null,
      faceEncoding: null,
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        token,
        user: toSafeUser(user),
      },
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Signup failed' });
    }
  }
}

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password are required' });
    return;
  }

  try {
    const normalizedUsername = String(username).toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername, isDeleted: false });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const token = signToken(user);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        role: user.role,
        name: user.fullName,
        id: user._id.toString(),
      },
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Login failed' });
    }
  }
};

const getMe = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Success',
      data: user,
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Failed to load user' });
    }
  }
};

module.exports = {
  signupFieldWorker,
  signupTeamLead,
  signupAdmin,
  login,
  getMe,
};
