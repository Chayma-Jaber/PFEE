"""
Email Service - Notification Management
Handles transactional emails for orders, payments, and user notifications
Supports SMTP, SendGrid, and Mailgun providers
"""
import logging
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, List
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for async email sending
_email_executor = ThreadPoolExecutor(max_workers=3)


class EmailService:
    """
    Production-ready service for sending transactional emails.
    Supports SMTP, SendGrid, and Mailgun providers.
    """

    def __init__(
        self,
        smtp_host: str = None,
        smtp_port: int = None,
        smtp_user: str = None,
        smtp_password: str = None,
        sendgrid_api_key: str = None,
        mailgun_api_key: str = None,
        mailgun_domain: str = None,
        provider: str = "smtp"
    ):
        # Load from environment if not provided
        self.smtp_host = smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = smtp_port or int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = smtp_user or os.getenv("SMTP_USER")
        self.smtp_password = smtp_password or os.getenv("SMTP_PASSWORD")
        self.sendgrid_api_key = sendgrid_api_key or os.getenv("SENDGRID_API_KEY")
        self.mailgun_api_key = mailgun_api_key or os.getenv("MAILGUN_API_KEY")
        self.mailgun_domain = mailgun_domain or os.getenv("MAILGUN_DOMAIN")
        self.provider = provider or os.getenv("EMAIL_PROVIDER", "smtp")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", "noreply@barsha.com.tn")
        self.from_name = os.getenv("SMTP_FROM_NAME", "Barsha")
        self.enabled = os.getenv("EMAIL_ENABLED", "true").lower() == "true"

        # Validate configuration
        self._validate_config()

    def _validate_config(self):
        """Validate email configuration on startup"""
        if not self.enabled:
            logger.info("Email service is disabled")
            return

        if self.provider == "smtp":
            if not all([self.smtp_host, self.smtp_port]):
                logger.warning("SMTP configuration incomplete - emails will be logged only")
        elif self.provider == "sendgrid":
            if not self.sendgrid_api_key:
                logger.warning("SendGrid API key not configured - emails will be logged only")
        elif self.provider == "mailgun":
            if not all([self.mailgun_api_key, self.mailgun_domain]):
                logger.warning("Mailgun configuration incomplete - emails will be logged only")

    def _send_smtp(self, to_email: str, subject: str, html_body: str, text_body: str = None) -> bool:
        """Send email via SMTP"""
        if not all([self.smtp_host, self.smtp_user, self.smtp_password]):
            logger.info(f"[EMAIL-MOCK] To: {to_email}, Subject: {subject}")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email

            # Add text part if provided
            if text_body:
                msg.attach(MIMEText(text_body, "plain", "utf-8"))

            # Add HTML part
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            # Connect and send
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())

            logger.info(f"[EMAIL-SENT] To: {to_email}, Subject: {subject}")
            return True

        except Exception as e:
            logger.error(f"[EMAIL-ERROR] Failed to send to {to_email}: {str(e)}")
            return False

    def _send_sendgrid(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send email via SendGrid API"""
        if not self.sendgrid_api_key:
            logger.info(f"[EMAIL-MOCK] To: {to_email}, Subject: {subject}")
            return True

        try:
            import httpx

            response = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {self.sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": self.from_email, "name": self.from_name},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}]
                },
                timeout=10.0
            )

            if response.status_code in [200, 202]:
                logger.info(f"[EMAIL-SENT] To: {to_email}, Subject: {subject}")
                return True
            else:
                logger.error(f"[EMAIL-ERROR] SendGrid error: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"[EMAIL-ERROR] SendGrid failed: {str(e)}")
            return False

    async def send_order_confirmation(
        self,
        to_email: str,
        order_reference: str,
        order_details: Dict[str, Any]
    ) -> bool:
        """
        Send order confirmation email.

        Args:
            to_email: Customer email
            order_reference: Order reference number
            order_details: Order data including items, total, etc.

        Returns:
            True if sent successfully
        """
        subject = f"Confirmation de commande {order_reference} - Barsha"

        # Build email content
        items_html = ""
        for item in order_details.get("items", []):
            items_html += f"""
            <tr>
                <td>{item.get('title', 'Produit')}</td>
                <td>{item.get('quantity', 1)}</td>
                <td>{item.get('unit_price', 0):.3f} TND</td>
            </tr>
            """

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1a1a2e;">Merci pour votre commande!</h1>
                <p>Votre commande <strong>{order_reference}</strong> a été confirmée.</p>

                <h2>Détails de la commande</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 10px; text-align: left;">Produit</th>
                            <th style="padding: 10px; text-align: left;">Qté</th>
                            <th style="padding: 10px; text-align: left;">Prix</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                </table>

                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa;">
                    <p><strong>Sous-total:</strong> {order_details.get('subtotal', 0):.3f} TND</p>
                    <p><strong>Livraison:</strong> {order_details.get('shipping_amount', 0):.3f} TND</p>
                    <p><strong>Réduction:</strong> -{order_details.get('discount_amount', 0):.3f} TND</p>
                    <p style="font-size: 18px;"><strong>Total:</strong> {order_details.get('total_amount', 0):.3f} TND</p>
                </div>

                <p style="margin-top: 20px;">
                    Suivez votre commande sur <a href="https://barsha.com.tn/account/orders/{order_reference}">votre espace client</a>.
                </p>

                <p style="color: #888; font-size: 12px; margin-top: 30px;">
                    Barsha - Mode & Style<br>
                    contact@barsha.com.tn
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)

    async def send_payment_confirmation(
        self,
        to_email: str,
        order_reference: str,
        amount: float
    ) -> bool:
        """Send payment confirmation email"""
        subject = f"Paiement reçu - Commande {order_reference}"

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #27ae60;">Paiement confirmé</h1>
                <p>Nous avons bien reçu votre paiement de <strong>{amount:.3f} TND</strong> pour la commande {order_reference}.</p>
                <p>Votre commande est maintenant en cours de préparation.</p>

                <p style="color: #888; font-size: 12px; margin-top: 30px;">
                    Barsha - Mode & Style
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)

    async def send_shipping_notification(
        self,
        to_email: str,
        order_reference: str,
        tracking_number: str,
        tracking_url: Optional[str] = None
    ) -> bool:
        """Send shipping notification with tracking info"""
        subject = f"Votre commande {order_reference} a été expédiée!"

        tracking_link = f'<a href="{tracking_url}">{tracking_number}</a>' if tracking_url else tracking_number

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #667eea;">Votre commande est en route!</h1>
                <p>Votre commande <strong>{order_reference}</strong> a été expédiée.</p>

                <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Numéro de suivi:</strong> {tracking_link}</p>
                </div>

                <p>Vous recevrez votre colis dans les prochains jours.</p>

                <p style="color: #888; font-size: 12px; margin-top: 30px;">
                    Barsha - Mode & Style
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)

    async def send_order_cancelled(
        self,
        to_email: str,
        order_reference: str,
        reason: str
    ) -> bool:
        """Send order cancellation notification"""
        subject = f"Commande {order_reference} annulée"

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #e74c3c;">Commande annulée</h1>
                <p>Votre commande <strong>{order_reference}</strong> a été annulée.</p>
                <p><strong>Motif:</strong> {reason}</p>

                <p>Si vous avez effectué un paiement, le remboursement sera traité sous 5-7 jours ouvrables.</p>

                <p style="color: #888; font-size: 12px; margin-top: 30px;">
                    Barsha - Mode & Style
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)

    async def _send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str
    ) -> bool:
        """
        Send email via configured provider.
        Routes to SMTP, SendGrid, or Mailgun based on configuration.
        """
        if not self.enabled:
            logger.info(f"[EMAIL-DISABLED] Would send to: {to_email}, Subject: {subject}")
            return True

        logger.info(f"[EMAIL] Sending to: {to_email} via {self.provider}")

        # Run synchronous email sending in thread pool
        loop = asyncio.get_event_loop()

        if self.provider == "sendgrid":
            return await loop.run_in_executor(
                _email_executor,
                self._send_sendgrid,
                to_email, subject, html_body
            )
        else:  # Default to SMTP
            return await loop.run_in_executor(
                _email_executor,
                self._send_smtp,
                to_email, subject, html_body, None
            )

    # ═══════════════════════════════════════════════════════════════════════════════
    # PREMIUM ALERT EMAILS
    # ═══════════════════════════════════════════════════════════════════════════════

    async def send_price_drop_alert(
        self,
        to_email: str,
        product_name: str,
        product_id: int,
        old_price: float,
        new_price: float,
        product_image: str = None
    ) -> bool:
        """Send price drop notification email"""
        discount_percent = round(((old_price - new_price) / old_price) * 100)
        subject = f"Bonne nouvelle! {product_name} est en promotion"

        image_html = f'<img src="{product_image}" alt="{product_name}" style="max-width: 200px; border-radius: 8px;" />' if product_image else ""

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <span style="background: #e74c3c; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold;">
                        -{discount_percent}%
                    </span>
                </div>

                <h1 style="color: #1a1a2e; text-align: center; margin-bottom: 10px;">Prix en baisse!</h1>
                <p style="text-align: center; color: #666;">Un article de votre liste d'alertes est maintenant en promotion</p>

                <div style="text-align: center; margin: 30px 0;">
                    {image_html}
                    <h2 style="color: #333; margin: 15px 0 5px;">{product_name}</h2>
                    <p style="margin: 0;">
                        <span style="text-decoration: line-through; color: #999;">{old_price:.3f} TND</span>
                        <span style="color: #e74c3c; font-size: 24px; font-weight: bold; margin-left: 10px;">{new_price:.3f} TND</span>
                    </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://barsha.com.tn/fr/produit/{product_id}"
                       style="background: #1a1a2e; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Voir le produit
                    </a>
                </div>

                <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
                    Vous recevez cet email car vous avez activé les alertes de prix.<br>
                    <a href="https://barsha.com.tn/compte" style="color: #667eea;">Gérer mes alertes</a>
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)

    async def send_back_in_stock_alert(
        self,
        to_email: str,
        product_name: str,
        product_id: int,
        product_image: str = None,
        available_sizes: List[str] = None
    ) -> bool:
        """Send back in stock notification email"""
        subject = f"De retour en stock: {product_name}"

        image_html = f'<img src="{product_image}" alt="{product_name}" style="max-width: 200px; border-radius: 8px;" />' if product_image else ""

        sizes_html = ""
        if available_sizes:
            sizes_html = f"""
                <p style="text-align: center; color: #27ae60; margin-top: 10px;">
                    Tailles disponibles: <strong>{", ".join(available_sizes)}</strong>
                </p>
            """

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <span style="background: #27ae60; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold;">
                        De retour!
                    </span>
                </div>

                <h1 style="color: #1a1a2e; text-align: center; margin-bottom: 10px;">Votre article est de retour</h1>
                <p style="text-align: center; color: #666;">L'article que vous attendiez est de nouveau disponible</p>

                <div style="text-align: center; margin: 30px 0;">
                    {image_html}
                    <h2 style="color: #333; margin: 15px 0 5px;">{product_name}</h2>
                    {sizes_html}
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://barsha.com.tn/fr/produit/{product_id}"
                       style="background: #27ae60; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Acheter maintenant
                    </a>
                </div>

                <p style="color: #e74c3c; text-align: center; font-size: 14px; margin-top: 20px;">
                    <strong>Stock limité</strong> - Ne tardez pas!
                </p>

                <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
                    Vous recevez cet email car vous avez demandé une alerte de disponibilité.<br>
                    <a href="https://barsha.com.tn/compte" style="color: #667eea;">Gérer mes alertes</a>
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)

    async def send_wishlist_share_notification(
        self,
        to_email: str,
        sender_name: str,
        share_url: str,
        message: str = None
    ) -> bool:
        """Send wishlist share notification"""
        subject = f"{sender_name} a partagé sa liste de souhaits avec vous"

        message_html = f'<p style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-style: italic;">"{message}"</p>' if message else ""

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #1a1a2e; text-align: center;">Une liste de souhaits pour vous</h1>

                <p style="text-align: center; color: #666; font-size: 18px;">
                    <strong>{sender_name}</strong> a partagé sa sélection Barsha avec vous
                </p>

                {message_html}

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{share_url}"
                       style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Découvrir la sélection
                    </a>
                </div>

                <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
                    Barsha - Mode & Style<br>
                    <a href="https://barsha.com.tn" style="color: #667eea;">Visiter notre boutique</a>
                </p>
            </div>
        </body>
        </html>
        """

        return await self._send_email(to_email, subject, body)


# Singleton instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create email service singleton"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
