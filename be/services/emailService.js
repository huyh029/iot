class EmailService {
  constructor() {
    this.apiKey = null;
    this.isConfigured = false;
  }

  ensureConnection() {
    if (this.isConfigured && this.apiKey) {
      return true;
    }

    this.apiKey = process.env.BREVO_API_KEY;
    
    if (!this.apiKey) {
      console.log('⚠️ Email service not configured (missing BREVO_API_KEY)');
      return false;
    }
    
    this.isConfigured = true;
    console.log('✅ Brevo API configured');
    return true;
  }

  async sendEmail(to, subject, html) {
    if (!this.ensureConnection()) {
      console.log('⚠️ Email not sent - service not configured');
      return false;
    }

    try {
      console.log(`📧 Sending email to: ${to}`);
      
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { 
            name: 'Smart Garden', 
            email: 'hhhh1112223335661@gmail.com'
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('📧 Email sent successfully:', data.messageId);
        return true;
      } else {
        console.error('❌ Brevo API error:', data);
        return false;
      }
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

  async sendDeviceOfflineAlert(userEmail, deviceData) {
    const { deviceName, deviceId, lastSeen } = deviceData;
    
    const subject = `📴 Cảnh báo: Thiết bị "${deviceName}" đã ngừng hoạt động`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🌱 Smart Garden</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #dc2626;">📴 Thiết bị đã ngừng hoạt động</h2>
          <p><strong>Thiết bị:</strong> ${deviceName}</p>
          <p><strong>Mã thiết bị:</strong> ${deviceId}</p>
          <p><strong>Lần hoạt động cuối:</strong> ${new Date(lastSeen).toLocaleString('vi-VN')}</p>
          <p><strong>Thời gian phát hiện:</strong> ${new Date().toLocaleString('vi-VN')}</p>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 10px; margin-top: 15px;">
            <p style="margin: 0; color: #991b1b;">⚠️ Vui lòng kiểm tra kết nối mạng hoặc nguồn điện của thiết bị.</p>
          </div>
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
