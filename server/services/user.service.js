const bcrypt = require('bcrypt');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');

const roleIdToRole = (roleId) => {
  const n = Number(roleId);
  if (n === 1) return ROLES.ADMIN;
  if (n === 2) return ROLES.TEAM_LEAD;
  if (n === 3) return ROLES.FIELD_WORKER;
  return ROLES.TEAM_LEAD;
};

const createUser = async (userData) => {
  const { name, email, password, role_id } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  const username = String(email).toLowerCase().trim();
  const user = await User.create({
    fullName: name,
    username,
    password: hashedPassword,
    role: roleIdToRole(role_id),
  });
  return user._id.toString();
};

const findByEmail = async (email) => {
  const username = String(email).toLowerCase().trim();
  const user = await User.findOne({ username, isDeleted: false });
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.fullName,
    email: user.username,
    password: user.password,
    role_name: user.role,
  };
};

const findById = async (id) => {
  const user = await User.findById(id).select('-password');
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.fullName,
    email: user.username,
    role_id: user.role,
    role_name: user.role,
    phone: '',
  };
};

module.exports = { createUser, findByEmail, findById };
