const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
  }

  ensureConnection() {
    if (this.isConfigured && this.transporter) {
      return true;
    }

    const smtpUser = process.env.BREVO_SMTP_USER;
    const smtpPass = process.env.BREVO_SMTP_PASS;
    
    if (!smtpUser || !smtpPass) {
      console.log('⚠️ Email service not configured (missing BREVO_SMTP_USER or BREVO_SMTP_PASS)');
      return false;
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    this.isConfigured = true;
    console.log('✅ Brevo email service configured');
    return true;
  }

  async sendEmail(to, subject, html) {
    if (!this.ensureConnection()) {
      console.log('⚠️ Email not sent - service not configured');
      return false;
    }

    try {
      console.log(`📧 Sending email to: ${to}`);
      
      const info = await this.transporter.sendMail({
        from: '"Smart Garden" <noreply@smartgarden.io>',
        to: to,
        subject: subject,
        html: html
      });

      console.log('📧 Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Send email error:', error.message);
      return false;
    }
  }

  async sendThresholdAlert(userEmail, alertData) {
    const { deviceName, sensorType, value, threshold, condition } = alertData;
    
    const conditionText = condition === 'above' ? 'vượt ngưỡng trên' : 'dưới ngưỡng';
    const sensorNames = {
      temperature: 'Nhiệt độ',
      humidity: 'Độ ẩm',
      light: 'Ánh sáng',
      soil_moisture: 'Độ ẩm đất'
    };

    const subject = `⚠️ Cảnh báo: ${sensorNames[sensorType] || sensorType} ${conditionText}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4cbe00; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🌱 Smart Garden</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #dc2626;">⚠️ Cảnh báo ngưỡng</h2>
          <p><strong>Thiết bị:</strong> ${deviceName}</p>
          <p><strong>Loại cảm biến:</strong> ${sensorNames[sensorType] || sensorType}</p>
          <p><strong>Giá trị hiện tại:</strong> <span style="color: #dc2626; font-size: 1.2em;">${value}</span></p>
          <p><strong>Ngưỡng:</strong> ${threshold}</p>
          <p><strong>Trạng thái:</strong> ${conditionText}</p>
          <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
        </div>
        <div style="padding: 15px; background: #e5e5e5; text-align: center; font-size: 12px; color: #666;">
          Email tự động từ hệ thống Smart Garden
        </div>
      </div>
    `;

    return this.sendEmail(userEmail, subject, html);
  }

  async sendAutoControlNotification(userEmail, controlData) {
    const { deviceName, controlType, action, reason } = controlData;
    
    const controlNames = {
      light: 'Đèn',
      fan: 'Quạt',
      pump: 'Máy bơm',
      watering: 'Tưới nước'
    };

    const subject = `🤖 Điều khiển tự động: ${controlNames[controlType] || controlType} đã ${action === 'on' ? 'BẬT' : 'TẮT'}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4cbe00; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🌱 Smart Garden</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #2563eb;">🤖 Điều khiển tự động</h2>
          <p><strong>Thiết bị:</strong> ${deviceName}</p>
          <p><strong>Thiết bị điều khiển:</strong> ${controlNames[controlType] || controlType}</p>
          <p><strong>Hành động:</strong> <span style="color: ${action === 'on' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${action === 'on' ? 'BẬT' : 'TẮT'}</span></p>
          <p><strong>Lý do:</strong> ${reason}</p>
          <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
        </div>
        <div style="padding: 15px; background: #e5e5e5; text-align: center; font-size: 12px; color: #666;">
          Email tự động từ hệ thống Smart Garden
        </div>
      </div>
    `;

    return this.sendEmail(userEmail, subject, html);
  }
}

const emailService = new EmailService();
module.exports = emailService;
