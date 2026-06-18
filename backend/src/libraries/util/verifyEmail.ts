import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export const sendEmail = async (email: String, verificationLink: String) => {

  try {

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your Email',
      html: `
        <!DOCTYPE html>
<html lang="en" style="margin:0; padding:0;">
<head>
  <meta charset="UTF-8" />
  <title>Verify your email</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    /* Fallback styles for clients that support <style> */
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 20px !important;
      }
      .card {
        padding: 20px !important;
      }
      .btn {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f5fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f5fb; padding:30px 0;">
    <tr>
      <td align="center">
        <table class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="width:600px; max-width:100%; background-color:transparent; padding:0 20px;">
          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
                <!-- You can replace this with an <img> logo -->
                Tilt 360
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table class="card" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:16px; padding:32px; box-shadow:0 10px 30px rgba(15, 23, 42, 0.08);">
                <!-- Title -->
                <tr>
                  <td style="font-size:22px; font-weight:700; color:#111827; padding-bottom:8px;">
                    Verify your email address
                  </td>
                </tr>

                <!-- Subtitle -->
                <tr>
                  <td style="font-size:14px; color:#6b7280; padding-bottom:24px;">
                    Thanks for signing up! Please confirm that this email address belongs to you by clicking the button below.
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href=" ${verificationLink}"
                       class="btn"
                       style="
                         display:inline-block;
                         padding:12px 28px;
                         border-radius:999px;
                         background:linear-gradient(135deg,#4f46e5,#6366f1);
                         color:#ffffff;
                         font-size:14px;
                         font-weight:600;
                         letter-spacing:0.03em;
                         text-decoration:none;
                         text-transform:uppercase;
                       ">
                      Click to Verify
                    </a>
                  </td>
                </tr>

                <!-- Info / Note -->
                <tr>
                  <td style="font-size:13px; color:#6b7280; padding-bottom:8px; line-height:1.6;">
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td style="font-size:12px; color:#9ca3af; line-height:1.6; padding-bottom:24px;">
                    If the button doesn’t work, copy and paste this link into your browser:
                    <br />
                    <span style="word-break:break-all; color:#4f46e5;">
                      ${verificationLink}
                    </span>
                  </td>
                </tr>

                <!-- Footer text -->
                <tr>
                  <td style="font-size:12px; color:#9ca3af; line-height:1.6;">
                    If you didn’t create an account with Tilt 360, you can safely ignore this email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom small footer -->
          <tr>
            <td align="center" style="padding-top:16px; font-size:11px; color:#9ca3af;">
              © 2025 Tilt 360. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
    }
    await transporter.sendMail(mailOptions);
    return true
  } catch (error) {
    console.log(error);
    return false
  }
}

export const sendEmailForResetPassword = async (email: String, otp: Number) => {
  try {
      const mailOptions = {
          from: process.env.EMAIL_USER,  
          to: email,
          subject: 'OTP for Reset Password',
          html: `
          <div style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden;">
      
      <div style="background: #4f46e5; padding: 20px; text-align: center; color: #ffffff;">
        <h2>Password Reset Verification</h2>
      </div>

      <div style="padding: 25px; color: #333333; text-align: center;">
        <p style="font-size: 16px; margin-bottom: 10px;">Hello,</p>
        <p style="font-size: 16px;">Use the OTP below to reset your password:</p>

        <h1 style="font-size: 36px; letter-spacing: 4px; background: #e0e7ff; display: inline-block; padding: 10px 20px; border-radius: 8px; margin: 20px 0; color: #4338ca;">
          ${otp}
        </h1>

        <p style="font-size: 14px; color: #666;">This OTP is valid for the next <strong>5 minutes</strong>.</p>
      </div>

      <div style="background: #f9fafb; text-align: center; padding: 15px;">
        <p style="font-size: 12px; color: #888888;">
          If you did not request this, please ignore this email.
        </p>
      </div>
    </div>
  </div>
  `
      }
      await transporter.sendMail(mailOptions)
      return true
  } catch (error) {
      console.error("Error sending email:", error)
      return false
  }
}