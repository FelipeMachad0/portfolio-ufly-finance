import axios from 'axios';
import { config } from '../config/runtimeConfig';

// config.apiUrl vem do runtime (window.__APP_CONFIG__) com fallback '/api'.
// Lendo import.meta.env aqui, a URL da API era resolvida em BUILD time: numa
// imagem de container (build sem arquivos .env) ficava undefined, o axios caía
// em caminho relativo e TODA chamada ia para /transactions em vez de
// /api/transactions.
const api = axios.create({
  baseURL: config.apiUrl,
});

// Versão estática (GitHub Pages): as chamadas são respondidas no navegador, a
// partir de src/demo/dados.json. A flag é de BUILD — fora dela o código da
// demo nem entra no bundle.
if (import.meta.env.VITE_STATIC_DEMO === 'true') {
  api.defaults.adapter = async (cfg) => (await import('../demo/api-estatica')).adapterEstatico(cfg);
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Rotas de autenticação: um 401 aqui é credencial recusada, não sessão expirada.
 * Derrubar a sessão nesse caso apagaria a mensagem de erro da própria tela de
 * login e recarregaria a página no meio da tentativa.
 */
const ROTAS_DE_AUTENTICACAO = /\/auth\/(login|entra)/;

/** Uma resposta 401 basta: a tela carrega várias requisições em paralelo. */
let derrubandoSessao = false;

/**
 * Sessão expirada (401) → limpa e volta para o login.
 *
 * Sem isto o token morto continuava no sessionStorage e a aplicação seguia se
 * comportando como se estivesse logada: cada página mostrava "Token inválido ou
 * expirado" em vermelho com a tabela vazia, o que parece perda de dados. O JWT
 * dura 24h (JWT_EXPIRY) e não há refresh, então isso acontece com todo mundo,
 * todo dia.
 */
api.interceptors.response.use(
  (resposta) => resposta,
  (erro: unknown) => {
    const e = erro as { response?: { status?: number }; config?: { url?: string } };
    const ehSessaoExpirada =
      e?.response?.status === 401 && !ROTAS_DE_AUTENTICACAO.test(e?.config?.url ?? '');

    if (ehSessaoExpirada && !derrubandoSessao) {
      derrubandoSessao = true;
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('user');
      // Recarga completa em vez de navegação do router: o estado da aplicação
      // inteira foi montado em cima de uma sessão que não vale mais.
      window.location.assign(`${import.meta.env.BASE_URL}login?sessao=expirada`);
    }
    return Promise.reject(erro);
  }
);

export default api;
