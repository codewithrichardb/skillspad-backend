export const getWelcomeEmailTemplate = (user, origin) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Skillspad</title>
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
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            margin: 0 10px;
            text-decoration: none;
            color: #4f46e5;
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="${origin}/images/logo-white.png" alt="Skillspad Logo">
    </div>
    
    <div class="content">
        <h2>Welcome to Skillspad, ${user.name}!</h2>
        <p>Thank you for joining Skillspad. We're excited to have you on board!</p>
        <p>With Skillspad, you can:</p>
        <ul>
            <li>Access premium courses from industry experts</li>
            <li>Track your learning progress</li>
            <li>Earn certificates upon course completion</li>
            <li>Connect with other learners</li>
        </ul>
        
        <div style="text-align: center;">
            <a href="${origin}/dashboard" class="button">Go to Dashboard</a>
        </div>
        
        <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
        
        <p>Best regards,<br>The Skillspad Team</p>
    </div>
    
    <div class="footer">
        <p>© ${new Date().getFullYear()} Skillspad. All rights reserved.</p>
        <div class="social-links">
            <a href="${origin}">Website</a> | 
            <a href="#">Twitter</a> | 
            <a href="#">Facebook</a> | 
            <a href="#">LinkedIn</a>
        </div>
        <p>If you didn't create an account with us, please ignore this email.</p>
    </div>
</body>
</html>
`;
