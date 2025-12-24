require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmail() {
  console.log('🧪 Testing Brevo Email Service...\n');
  console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? '***configured***' : 'NOT SET');
  
  const testEmail = 'huyh01480@gmail.com';
  
  // Test 1: Simple email
  console.log('\n📧 Test 1: Sending simple email...');
  const result1 = await emailService.sendEmail(
    testEmail,
    '🧪 Test Email từ Smart Garden',
    '<h1>Hello!</h1><p>Đây là email test từ hệ thống Smart Garden sử dụng Brevo API.</p>'
  );
  console.log('Result:', result1 ? '✅ SUCCESS' : '❌ FAILED');

  // Test 2: Threshold alert
  console.log('\n📧 Test 2: Sending threshold alert...');
  const result2 = await emailService.sendThresholdAlert(testEmail, {
    deviceName: 'ESP32-Test',
    sensorType: 'temperature',
    value: 35,
    threshold: 30,
    condition: 'above'
  });
  console.log('Result:', result2 ? '✅ SUCCESS' : '❌ FAILED');

  console.log('\n🏁 Test completed!');
}

testEmail().catch(console.error);
