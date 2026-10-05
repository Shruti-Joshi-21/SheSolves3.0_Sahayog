const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const faceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sevasetu/faces',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    resource_type: 'image',
  },
});

const attendanceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sevasetu/attendance',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
  },
});

const reportStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sevasetu/reports',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
  },
});

module.exports = { cloudinary, faceStorage, attendanceStorage, reportStorage };
