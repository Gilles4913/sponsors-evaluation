export default function handler(req, res) {
  res.status(200).json({ resend_api_key_present: !!process.env.RESEND_API_KEY });
}
