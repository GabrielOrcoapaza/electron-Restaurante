import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import {
    GET_ALL_COMPANIES,
    GET_COMPANIES_FOR_CARTA_DIGITAL,
} from "../../graphql/queries";
import "./LandingPage.css";

// Los banners ahora usan URLs de Unsplash directamente

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "";
const API_MEDIA_URL = GRAPHQL_URL
    ? GRAPHQL_URL.replace("/graphql", "/media/")
    : "/media/";

// Helper para caché persistente con IndexedDB (mayor capacidad que localStorage para imágenes)
const cacheDB = {
    name: "SumAppLandingCache",
    storeName: "queries",
    init() {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.name, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(this.storeName)) {
                    request.result.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    async set(key: string, val: any) {
        try {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.storeName, "readwrite");
                tx.objectStore(this.storeName).put(val, key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.error("IDB Cache Set Error:", e);
        }
    },
    async get(key: string) {
        try {
            const db = await this.init();
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, "readonly");
                const store = tx.objectStore(this.storeName);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }
};

/**
 * Función para obtener la URL completa de una imagen de forma segura.
 * Evita duplicar el prefijo /media/ si el path ya lo contiene.
 */
const getFullImageUrl = (path: string | null | undefined): string => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;

    try {
        if (!path || path === "NULL" || path === "null") return "";

        // Si el path ya tiene /media/, nos aseguramos de no duplicarlo
        if (path.startsWith("/media/")) {
            const base = API_MEDIA_URL.replace(/\/media\/?$/, "");
            const url = new URL(path, base || window.location.origin);
            return url.toString();
        }

        const url = new URL(
            path,
            API_MEDIA_URL.startsWith("http")
                ? API_MEDIA_URL
                : window.location.origin +
                      (API_MEDIA_URL.startsWith("/") ? "" : "/") +
                      API_MEDIA_URL,
        );
        return url.toString();
    } catch (err) {
        console.warn("Error construyendo URL de imagen:", err, {
            path,
            API_MEDIA_URL,
        });
        // Fallback simple si falla el constructor de URL
        return `${API_MEDIA_URL}${path}`.replace(/\/+/g, "/");
    }
};

const banners = [
    {
        title: "El ecosistema definitivo para tu restaurante",
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2070",
        btnText: "CONOCE SUMAPP",
        link: "#downloads",
    },
    {
        title: "Toma pedidos en segundos desde cualquier lugar",
        image: "https://images.unsplash.com/photo-1556742044-3c52d6e88c02?auto=format&fit=crop&q=80&w=2070",
        btnText: "VER APP DE MOZOS",
        link: "#downloads",
    },
    {
        title: "Tu carta digital, ahora más inteligente que nunca",
        image: "https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&q=80&w=2070",
        btnText: "PROBAR DEMO",
        link: "#menu-preview",
    },
];

const LandingPage: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("sumaq-theme") === "dark";
    });
    const [activeDownloadTab] = useState<
        "downloads" | "guide"
    >("downloads");

    const { data: _companiesData } = useQuery(GET_ALL_COMPANIES, {
        onCompleted: (data) => {
            if (data?.allCompanies) {
                setDisplayCompanies(data.allCompanies);
                cacheDB.set("cache_landing_companies", data.allCompanies);
            }
        },
        fetchPolicy: 'cache-and-network'
    });

    const { data: _menuData } = useQuery(GET_COMPANIES_FOR_CARTA_DIGITAL, {
        onCompleted: (data) => {
            if (data?.allCompanies) {
                const companies = data.allCompanies;
                setDisplayMenu(companies);
                cacheDB.set("cache_landing_menu", companies);
                
                // Inicializar selección si no hay nada seleccionado
                if (companies.length > 0 && !selectedCompanyId) {
                    const firstCompany = companies[0];
                    setSelectedCompanyId(firstCompany.id);
                    if (firstCompany.branches?.length > 0) {
                        setSelectedBranchId(firstCompany.branches[0].id);
                    }
                }
            }
        },
        fetchPolicy: 'cache-and-network'
    });

    // Estados para manejar los datos combinados (Query + Cache)
    const [displayCompanies, setDisplayCompanies] = useState<any[]>([]);
    const [displayMenu, setDisplayMenu] = useState<any[]>([]);

    // Cargar caché inicial desde IndexedDB al montar el componente
    useEffect(() => {
        const loadInitialCache = async () => {
            const [cachedCompanies, cachedMenu] = await Promise.all([
                cacheDB.get("cache_landing_companies"),
                cacheDB.get("cache_landing_menu")
            ]);
            
            if (cachedCompanies) setDisplayCompanies(cachedCompanies as any[]);
            if (cachedMenu) {
                const menu = cachedMenu as any[];
                setDisplayMenu(menu);
                // Si no hay nada seleccionado aún, inicializar con el caché
                if (menu.length > 0 && !selectedCompanyId) {
                    setSelectedCompanyId(menu[0].id);
                    if (menu[0].branches?.length > 0) {
                        setSelectedBranchId(menu[0].branches[0].id);
                    }
                }
            }
        };
        loadInitialCache();
    }, []);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % banners.length);
        }, 10000);
        return () => clearInterval(timer);
    }, []);


    useEffect(() => {
        localStorage.setItem("sumaq-theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    const selectedCompany = useMemo(() => {
        if (!displayMenu || !selectedCompanyId) return null;
        return displayMenu.find(
            (c: any) => c.id === selectedCompanyId,
        );
    }, [displayMenu, selectedCompanyId]);

    const selectedBranch = useMemo(() => {
        if (!selectedCompany?.branches) return null;
        if (!selectedBranchId) return selectedCompany.branches[0];
        return (
            selectedCompany.branches.find(
                (b: any) => b.id === selectedBranchId,
            ) || selectedCompany.branches[0]
        );
    }, [selectedCompany, selectedBranchId]);

    // Los useEffect que sincronizaban la selección se han movido a onCompleted y el cargador de caché
    // para evitar renderizados en cadena que causan advertencias de Apollo.

    return (
        <div className={`landing-container ${darkMode ? "dark-mode" : ""}`}>
            {/* Nav */}
            <nav className={`landing-nav ${isScrolled ? "scrolled" : ""}`}>
                <div className="landing-logo">
                    Sum<span>app</span>
                </div>
                <div className="nav-actions">
                    <button
                        className="dark-mode-toggle"
                        onClick={() => setDarkMode(!darkMode)}
                        aria-label="Toggle Theme"
                    >
                        {darkMode ? "☀️" : "🌙"}
                    </button>
                    <Link to="/login" className="login-link">
                        ACCEDER
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <header className="banner-container">
                {banners.map((slide, index) => (
                    <div
                        key={index}
                        className={`banner-slide ${index === currentSlide ? "active" : ""}`}
                        style={{ backgroundImage: `url(${slide.image})` }}
                    >
                        <div className="banner-overlay" />
                        <div className="banner-content">
                            <h1>{slide.title}</h1>
                            <a href={slide.link} className="banner-btn">
                                {slide.btnText}
                            </a>
                        </div>
                    </div>
                ))}

                <div className="banner-dots">
                    {banners.map((_, index) => (
                        <span
                            key={index}
                            className={`dot ${index === currentSlide ? "active" : ""}`}
                            onClick={() => setCurrentSlide(index)}
                        ></span>
                    ))}
                </div>
            </header>

            {/* Features */}
            <section className="info-section">
                <div className="section-wrapper">
                    <span className="info-badge">Tecnología de Vanguardia</span>
                    <h2>Ecosistema Integrado</h2>
                    
                    <div className="info-grid">
                        <div className="info-card">
                            <div className="card-icon">📱</div>
                            <h3>App de Mozos</h3>
                            <p>Toma pedidos instantáneos que se sincronizan en tiempo real con cocina y caja.</p>
                            <ul className="info-feature-list">
                                <li className="info-point">✓ Interfaz táctil rápida</li>
                                <li className="info-point">✓ Notas y preferencias</li>
                                <li className="info-point">✓ División de cuentas</li>
                            </ul>
                        </div>
                        
                        <div className="info-card">
                            <div className="card-icon">📠</div>
                            <h3>Control de Cocina</h3>
                            <p>Evita errores con un sistema inteligente de comandas impresas o digitales.</p>
                            <ul className="info-feature-list">
                                <li className="info-point">✓ Múltiples impresoras</li>
                                <li className="info-point">✓ Alertas de demora</li>
                                <li className="info-point">✓ Orden por categorías</li>
                            </ul>
                        </div>

                        <div className="info-card">
                            <div className="card-icon">🖥️</div>
                            <h3>Gestión de Caja</h3>
                            <p>Software robusto para controlar ventas, inventarios y reportes detallados.</p>
                            <ul className="info-feature-list">
                                <li className="info-point">✓ Facturación electrónica</li>
                                <li className="info-point">✓ Arqueos automáticos</li>
                                <li className="info-point">✓ Control de stock</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Clients */}
            <section className="clients-section">
                <div className="section-wrapper">
                    <h2>Empresas que confían en nosotros</h2>
                    <div className="logos-container">
                        {displayCompanies?.slice(0, 8).map((c: any) => (
                            <img
                                key={c.id}
                                src={c.logo ? getFullImageUrl(c.logo) : c.logoBase64 ? (c.logoBase64.startsWith("data:") ? c.logoBase64 : `data:image/png;base64,${c.logoBase64}`) : "/logo_company.png"}
                                alt={c.commercialName}
                                className="client-logo"
                                onError={(e) => { (e.target as HTMLImageElement).src = "/logo_company.png"; }}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* Digital Menu Preview */}
            <section className="digital-menu-section" id="menu-preview">
                <div className="section-wrapper">
                    <div className="menu-preview-container">
                        <div className="menu-info">
                            <span className="preview-pill">NUEVA FUNCIÓN</span>
                            <h2>Carta Digital Interactiva</h2>
                            <p>Ofrece a tus clientes una experiencia visual de primer nivel directamente en su smartphone.</p>
                            
                            <select
                                className="company-select"
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                            >
                                {displayMenu?.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.denomination}</option>
                                ))}
                            </select>

                            <div className="qr-preview-section">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/carta/${selectedCompanyId}${selectedBranchId ? `?branch=${selectedBranchId}` : ""}`)}&bgcolor=ffffff&color=0f172a&margin=5`}
                                    alt="QR Preview"
                                />
                                <p className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    ESCANEAME PARA PROBAR
                                </p>
                            </div>
                        </div>

                        <div className="menu-mockup">
                            <div className="menu-preview-display">
                                <header className="preview-header">
                                    <div className="preview-avatar">
                                        <img
                                            src={selectedCompany?.logo ? getFullImageUrl(selectedCompany.logo) : selectedCompany?.logoBase64 ? (selectedCompany.logoBase64.startsWith("data:") ? selectedCompany.logoBase64 : `data:image/png;base64,${selectedCompany.logoBase64}`) : "/logo_company.png"}
                                            alt="Logo"
                                        />
                                    </div>
                                    <h3>{selectedCompany?.commercialName || "Restaurante"}</h3>
                                </header>
                                <div className="preview-items">
                                    {selectedBranch?.categories?.[0]?.subcategories?.[0]?.products?.slice(0, 4).map((p: any) => (
                                        <div key={p.id} className="preview-item">
                                            <div className="preview-item-image">
                                                <img src={p.image ? getFullImageUrl(p.image) : p.imageBase64 ? (p.imageBase64.startsWith("data:") ? p.imageBase64 : `data:image/png;base64,${p.imageBase64}`) : "/default_dish.png"} alt={p.name} />
                                            </div>
                                            <div className="item-info">
                                                <h4>{p.name}</h4>
                                                <p>{p.description}</p>
                                                <span className="item-price">S/ {Number(p.salePrice).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Downloads */}
            <section className="download-section" id="downloads">
                <div className="section-wrapper">
                    <div className="download-box">
                        <span className="download-badge">SISTEMA COMPLETO</span>
                        <h2>Lleva Sumapp a tu negocio</h2>
                        <a href="https://github.com/GabrielOrcoapaza/electron-Restaurante/releases/latest/download/SumApp.exe" className="download-btn">
                            Descargar para Windows
                        </a>
                        
                        <div className="platform-grid">
                            <div className="platform-card">
                                <h4>Desktop App</h4>
                                <p>Control total desde tu PC</p>
                            </div>
                            <div className="platform-card">
                                <h4>Android App</h4>
                                <p>Toma pedidos en movimiento</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="contact-section">
                <div className="section-wrapper">
                    <h2>¿Listo para empezar?</h2>
                    <p>Contáctanos y digitaliza tu restaurante hoy mismo.</p>
                    <a href={`https://wa.me/51973591709?text=${encodeURIComponent("Hola, quiero información sobre Sumaq.")}`} className="whatsapp-btn">
                        SOLICITAR DEMO
                    </a>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-brand">SUMAPP</div>
                <p>&copy; {new Date().getFullYear()} Soluciones 4 Sumapp. Tecnología para crecer.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
