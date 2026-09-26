import { type ReactNode, useState, useEffect, useRef } from 'react';
import { IndicadorLeituras } from '../financial/IndicadorLeituras';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { iniciaisDoUsuario } from '../../utils/iniciais';

interface Props {
  children: ReactNode;
}

// ───────────────────────────────────────────────────────────
// Estrutura do menu — links diretos + dropdown "Cadastros"
// ───────────────────────────────────────────────────────────
interface NavLeaf {
  to: string;
  label: string;
}

interface NavDropdown {
  label: string;
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavDropdown;

const isDropdown = (e: NavEntry): e is NavDropdown =>
  (e as NavDropdown).children !== undefined;

const NAV: NavEntry[] = [
  { to: '/dashboard',     label: 'Home' },
  {
    label: 'Lançamentos',
    children: [
      { to: '/transactions?view=income',  label: 'Entradas' },
      { to: '/transactions?view=expense', label: 'Saídas' },
    ],
  },
  { to: '/dre',           label: 'DRE' },
  { to: '/reports',       label: 'Dashboard' },
  { to: '/centros-custo', label: 'Centros de Custo' },
  {
    label: 'Cadastros',
    children: [
      { to: '/clientes',     label: 'Clientes' },
      { to: '/projetos',     label: 'Projetos' },
      { to: '/fornecedores', label: 'Fornecedores' },
      { to: '/accounts',     label: 'Contas' },
      { to: '/categories',   label: 'Categorias' },
      { to: '/budgets',      label: 'Orçamentos' },
    ],
  },
];

// Lista plana com todos os destinos — usada pra cálculo de "ativo" e mobile
const ALL_LEAVES: NavLeaf[] = NAV.flatMap((e) =>
  isDropdown(e) ? e.children : [e],
);

export function Layout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!openDropdown) return;
    const onClick = (e: MouseEvent) => {
      const ref = dropdownRefs.current[openDropdown];
      if (ref && !ref.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openDropdown]);

  // Fecha dropdown na navegação
  useEffect(() => {
    setOpenDropdown(null);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Pathname (sem query) de um destino — alguns filhos usam ?view=
  const pathOf = (to: string) => to.split('?')[0];
  const currentFull = location.pathname + location.search;

  // Link ativo mais específico (evita conflitos com sub-rotas)
  const activeHref = ALL_LEAVES.reduce<string | null>((best, link) => {
    const lp = pathOf(link.to);
    const matches =
      location.pathname === lp || location.pathname.startsWith(lp + '/');
    if (matches && (!best || lp.length > best.length)) return lp;
    return best;
  }, null);

  // Item com query (?view=) casa pela URL completa; sem query, pelo pathname.
  const isLeafActive = (to: string) =>
    to.includes('?') ? currentFull === to : activeHref === to;
  const isDropdownActive = (group: NavDropdown) =>
    group.children.some((c) => pathOf(c.to) === activeHref);

  const initials = iniciaisDoUsuario(user?.name, user?.email);

  const userName = user?.name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="min-h-screen" style={{ background: 'var(--neutral-50)' }}>
      <header
        className="sticky top-0 z-50 h-16 flex items-center px-6 transition-shadow"
        style={{
          background: 'var(--ufly-navy)',
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        }}
      >
        <div className="max-w-[1280px] mx-auto w-full flex justify-between items-center gap-4">
          {/* Logo */}
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2.5 shrink-0"
            aria-label="Ufly Controle Financeiro — ir para home"
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/logo-ufly-mark-white.svg`}
              alt="Ufly"
              className="h-7"
            />
            <span
              className="hidden sm:inline-block text-[11px] tracking-[0.16em] uppercase font-medium pl-2 border-l whitespace-nowrap"
              style={{
                color: 'rgba(255,255,255,0.65)',
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              Controle Financeiro
            </span>
          </NavLink>

          {/* Hamburger mobile */}
          <button
            className="md:hidden text-white p-2 -mr-2"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Menu de navegação"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {mobileNavOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV.map((entry) => {
              if (isDropdown(entry)) {
                const active = isDropdownActive(entry);
                const isOpen = openDropdown === entry.label;
                return (
                  <div
                    key={entry.label}
                    ref={(el) => {
                      dropdownRefs.current[entry.label] = el;
                    }}
                    className="relative"
                  >
                    <button
                      onClick={() =>
                        setOpenDropdown(isOpen ? null : entry.label)
                      }
                      className="relative flex items-center gap-1 px-3 py-2 text-sm transition-colors whitespace-nowrap"
                      style={{
                        color: active
                          ? '#FFFFFF'
                          : 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {entry.label}
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s',
                        }}
                      >
                        <polyline points="3 5 6 8 9 5" />
                      </svg>
                      {active && (
                        <span
                          className="absolute bottom-0 left-3 right-6 h-0.5"
                          style={{ background: 'var(--ufly-cyan)' }}
                        />
                      )}
                    </button>

                    {isOpen && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 mt-1 w-52 bg-white z-50 py-1"
                        style={{
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: 'var(--shadow-lg)',
                        }}
                      >
                        {entry.children.map((c) => {
                          const childActive = isLeafActive(c.to);
                          return (
                            <NavLink
                              key={c.to}
                              to={c.to}
                              onClick={() => setOpenDropdown(null)}
                              className="block px-4 py-2 text-sm transition-colors"
                              style={{
                                color: childActive
                                  ? 'var(--ufly-deep)'
                                  : 'var(--neutral-700)',
                                background: childActive
                                  ? 'var(--ufly-ice-soft)'
                                  : 'transparent',
                                fontWeight: childActive ? 600 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (!childActive) {
                                  e.currentTarget.style.background =
                                    'var(--neutral-50)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!childActive) {
                                  e.currentTarget.style.background =
                                    'transparent';
                                }
                              }}
                            >
                              {c.label}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const active = isLeafActive(entry.to);
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  className="relative px-3 py-2 text-sm transition-colors whitespace-nowrap"
                  style={{
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {entry.label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-0.5"
                      style={{ background: 'var(--ufly-cyan)' }}
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User menu */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <IndicadorLeituras />
            {user && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors hover:opacity-90"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  aria-label="Menu do usuário"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                    style={{
                      background: 'var(--ufly-cyan)',
                      color: 'var(--ufly-navy)',
                    }}
                  >
                    {initials}
                  </div>
                  <span className="hidden lg:inline text-xs text-white">
                    {userName.split(' ')[0]}
                  </span>
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 mt-2 w-64 bg-white z-50"
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{ borderColor: 'var(--neutral-100)' }}
                      >
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'var(--neutral-900)' }}
                        >
                          {userName}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--neutral-500)' }}
                        >
                          {user.email}
                        </p>
                      </div>
                      <NavLink
                        to="/users"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm hover:bg-[var(--neutral-50)] transition-colors border-b"
                        style={{
                          color: 'var(--neutral-700)',
                          borderColor: 'var(--neutral-100)',
                        }}
                      >
                        Gerenciar Usuários
                      </NavLink>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--neutral-50)] transition-colors"
                        style={{ color: 'var(--danger)' }}
                      >
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <nav
          className="md:hidden border-b"
          style={{
            background: 'var(--ufly-navy)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <div className="max-w-[1280px] mx-auto px-6 py-3 flex flex-col gap-0.5">
            {NAV.map((entry) => {
              if (isDropdown(entry)) {
                return (
                  <div key={entry.label} className="mt-2">
                    <p
                      className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold"
                      style={{ color: 'rgba(255,255,255,0.45)' }}
                    >
                      {entry.label}
                    </p>
                    {entry.children.map((c) => {
                      const active = isLeafActive(c.to);
                      return (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          onClick={() => setMobileNavOpen(false)}
                          className="block px-5 py-2 text-sm transition-colors"
                          style={{
                            color: active
                              ? '#FFFFFF'
                              : 'rgba(255,255,255,0.65)',
                            background: active
                              ? 'rgba(255,255,255,0.08)'
                              : 'transparent',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          {c.label}
                        </NavLink>
                      );
                    })}
                  </div>
                );
              }

              const active = isLeafActive(entry.to);
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  onClick={() => setMobileNavOpen(false)}
                  className="block px-3 py-2.5 text-sm transition-colors"
                  style={{
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {entry.label}
                </NavLink>
              );
            })}
            {user && (
              <>
                <NavLink
                  to="/users"
                  onClick={() => setMobileNavOpen(false)}
                  className="block px-3 py-2.5 text-sm mt-3 border-t pt-3"
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  Gerenciar Usuários
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2.5 text-sm text-left"
                  style={{ color: 'var(--ufly-cyan)' }}
                >
                  Sair ({user.email})
                </button>
              </>
            )}
          </div>
        </nav>
      )}

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
