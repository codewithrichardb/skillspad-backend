export const getPasswordResetEmailTemplate = (user, resetLink, origin) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Skillspad</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4f46e5;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .header img {
            max-width: 150px;
        }
        .content {
            padding: 30px 20px;
            background-color: #f9fafb;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4f46e5;
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            font-size: 14px;
            color: #6b7280;
            background-color: #f3f4f6;
            border-radius: 0 0 8px 8px;
        }
        .code {
            background-color: #e5e7eb;
            padding: 10px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            letter-spacing: 2px;
            margin: 15px 0;
            display: inline-block;
        }
        .note {
            font-size: 14px;
            color: #6b7280;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="${origin}/images/logo-white.png" alt="Skillspad Logo">
    </div>
    
    <div class="content">
        <h2>Reset Your Password</h2>
        <p>Hello ${user.name || 'there'},</p>
        <p>We received a request to reset your password for your Skillspad account.</p>
        <p>Click the button below to choose a new password:</p>
        
        <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p class="code">${resetLink}</p>
        
        <p class="note">
            <strong>Note:</strong> This password reset link will expire in 1 hour for security reasons.
            If you didn't request this password reset, you can safely ignore this email.
        </p>
        
        <p>Best regards,<br>The Skillspad Team</p>
    </div>
    
    <div class="footer">
        <p>© ${new Date().getFullYear()} Skillspad. All rights reserved.</p>
        <p>This is an automated message, please do not reply to this email.</p>
    </div>
</body>
</html>
`;
