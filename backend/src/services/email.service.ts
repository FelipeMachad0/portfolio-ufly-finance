import axios from 'axios';

export class EmailService {
  private readonly graphEndpoint = 'https://graph.microsoft.com/v1.0';
  private accessToken = '';

  async initialize(): Promise<void> {
    const tenantId = process.env.MSAL_TENANT_ID;
    const clientId = process.env.MSAL_CLIENT_ID;
    const clientSecret = process.env.MSAL_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Credenciais MSAL não configuradas (MSAL_TENANT_ID, MSAL_CLIENT_ID, MSAL_CLIENT_SECRET)');
    }

    const response = await axios.post<{ access_token: string }>(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    this.accessToken = response.data.access_token;
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    await axios.post(
      `${this.graphEndpoint}/me/sendMail`,
      {
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
  }

  async sendBudgetAlert(
    userEmail: string,
    categoryName: string,
    percentage: number,
    limitAmount: number,
    spent: number
  ): Promise<void> {
    const isExceeded = percentage >= 100;
    const subject = isExceeded
      ? `🚨 Orçamento excedido: ${categoryName}`
      : `⚠️ Alerta de orçamento: ${categoryName}`;

    const fmtBRL = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const htmlBody = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:${isExceeded ? '#EF4444' : '#F59E0B'}">
          ${isExceeded ? '🚨 Orçamento Excedido' : '⚠️ Limite se Aproximando'}
        </h2>
        <p>A categoria <strong>${categoryName}</strong> atingiu
           <strong>${percentage.toFixed(0)}%</strong> do orçamento.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb">Gasto</td>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">${fmtBRL(spent)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb">Limite</td>
            <td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">${fmtBRL(limitAmount)}</td>
          </tr>
        </table>
        <a href="${process.env.APP_URL ?? 'http://localhost:5173'}/budgets"
           style="background:#08133E;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
          Ver Orçamentos
        </a>
      </div>`;

    await this.sendEmail(userEmail, subject, htmlBody);
  }
}

export const emailService = new EmailService();
